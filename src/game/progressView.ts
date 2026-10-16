import { formatNumber, getLocale, t, type MessageKey } from '../i18n';
import { createBackButton } from '../menu/backButton';
import { BADGES } from './achievements';
import { svgIcon } from './badgeIcons';
import { GameHud } from './gameHud';
import { GOALS, type GameStore } from './gameStore';

export interface ProgressViewDeps {
  store: GameStore;
  onBack(): void;
  /** Something to show under the progress, such as the backup panel. */
  footer?: HTMLElement;
}

const STATS: ReadonlyArray<{ id: string; label: MessageKey; value: (s: ReturnType<GameStore['stats']>) => number }> = [
  { id: 'correct', label: 'game.stat.correct', value: (s) => s.correct },
  { id: 'bestCombo', label: 'game.stat.bestCombo', value: (s) => s.bestCombo },
  { id: 'pieces', label: 'game.stat.pieces', value: (s) => s.piecesPassed },
  { id: 'steps', label: 'game.stat.steps', value: (s) => s.stepsPassed },
  { id: 'songs', label: 'game.stat.songs', value: (s) => s.songsFinished },
  { id: 'xylo', label: 'game.stat.xylo', value: (s) => s.xyloSongs },
];

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/** A day key like 2026-10-16 as a date in the language of the page (Persian dates in Persian). */
function formatDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(getLocale() === 'fa' ? 'fa-IR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** The progress screen: rank and streak, the daily goal, every badge, the numbers, and a way to start over. */
export class ProgressView {
  readonly element: HTMLElement;
  private readonly deps: ProgressViewDeps;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly hud: GameHud;
  private readonly body: HTMLElement;
  private readonly unsubscribe: () => void;
  private confirming = false;

  constructor(deps: ProgressViewDeps) {
    this.deps = deps;
    this.element = make('section', 'progress-view');
    this.element.id = 'progressView';
    this.element.dataset.views = 'progress';

    const header = make('header', 'view-header');
    this.title = make('h2', 'view-title');
    this.subtitle = make('p', 'view-subtitle');
    header.append(createBackButton(deps.onBack), this.title, this.subtitle);

    this.hud = new GameHud(deps.store);
    this.body = make('div', 'pv-body');
    this.element.append(header, this.hud.element, this.body);
    if (deps.footer) this.element.appendChild(deps.footer);

    this.unsubscribe = deps.store.onChange(() => this.render());
    this.render();
  }

  refresh(): void {
    this.hud.refresh();
    this.render();
  }

  dispose(): void {
    this.unsubscribe();
    this.hud.dispose();
  }

  private render(): void {
    const store = this.deps.store;
    const focused = (document.activeElement as HTMLElement | null)?.dataset?.goal;
    this.title.textContent = t('game.view.title');
    this.subtitle.textContent = t('game.view.subtitle');

    // Daily goal
    const goalGroup = make('div', 'pv-goal');
    goalGroup.setAttribute('role', 'group');
    goalGroup.setAttribute('aria-label', t('game.goalPick'));
    const goalLabel = make('span', 'pv-goal-label');
    goalLabel.textContent = t('game.goalPick');
    goalGroup.appendChild(goalLabel);
    for (const goal of GOALS) {
      const chip = make('button', 'pv-chip');
      chip.type = 'button';
      chip.dataset.goal = String(goal);
      chip.textContent = t('game.goalOption', { n: formatNumber(goal) });
      chip.setAttribute('aria-pressed', String(goal === store.goal()));
      chip.addEventListener('click', () => store.setGoal(goal));
      goalGroup.appendChild(chip);
    }

    // Badges
    const earned = BADGES.filter((b) => store.hasBadge(b.id)).length;
    const badgesHead = make('div', 'pv-head');
    const badgesTitle = make('h3', 'pv-heading');
    badgesTitle.textContent = t('game.view.badges');
    const count = make('span', 'pv-count');
    count.textContent = t('game.view.count', { n: formatNumber(earned), total: formatNumber(BADGES.length) });
    badgesHead.append(badgesTitle, count);

    const list = make('ul', 'pv-badges');
    for (const badge of BADGES) {
      const date = store.badgeDate(badge.id);
      const item = make('li', 'pv-badge');
      item.dataset.badge = badge.id;
      item.dataset.state = date ? 'earned' : 'locked';
      const iconHolder = make('span', 'pv-badge-icon');
      iconHolder.appendChild(svgIcon(badge.icon));
      const text = make('span', 'pv-badge-text');
      const name = make('span', 'pv-badge-title');
      name.textContent = t(badge.title);
      const desc = make('span', 'pv-badge-desc');
      desc.textContent = t(badge.desc);
      const status = make('span', 'pv-badge-status');
      status.textContent = date ? t('game.view.earned', { date: formatDay(date) }) : t('game.view.locked');
      text.append(name, desc, status);
      item.append(iconHolder, text);
      list.appendChild(item);
    }

    // Numbers
    const numbersTitle = make('h3', 'pv-heading');
    numbersTitle.textContent = t('game.view.numbers');
    const stats = make('dl', 'pv-stats');
    const counters = store.stats();
    for (const stat of STATS) {
      const row = make('div', 'pv-stat');
      row.dataset.stat = stat.id;
      const label = document.createElement('dt');
      label.textContent = t(stat.label);
      const value = document.createElement('dd');
      value.textContent = formatNumber(stat.value(counters));
      row.append(label, value);
      stats.appendChild(row);
    }

    // Start over
    const reset = make('div', 'pv-reset-area');
    const resetButton = make('button', 'pv-reset');
    resetButton.type = 'button';
    resetButton.textContent = t('game.view.reset');
    const confirm = make('div', 'pv-confirm');
    confirm.hidden = !this.confirming;
    confirm.setAttribute('role', 'group');
    const ask = make('p', 'pv-confirm-text');
    ask.textContent = t('game.view.resetAsk');
    const yes = make('button', 'pv-reset-yes');
    yes.type = 'button';
    yes.textContent = t('game.view.resetYes');
    const no = make('button', 'pv-reset-no');
    no.type = 'button';
    no.textContent = t('game.view.resetNo');
    resetButton.addEventListener('click', () => {
      this.confirming = true;
      confirm.hidden = false;
      no.focus();
    });
    no.addEventListener('click', () => {
      this.confirming = false;
      confirm.hidden = true;
      resetButton.focus();
    });
    yes.addEventListener('click', () => {
      this.confirming = false;
      store.reset();
    });
    const answers = make('div', 'pv-confirm-buttons');
    answers.append(yes, no);
    confirm.append(ask, answers);
    reset.append(resetButton, confirm);

    this.body.replaceChildren(goalGroup, badgesHead, list, numbersTitle, stats, reset);
    if (focused) this.body.querySelector<HTMLElement>(`[data-goal="${focused}"]`)?.focus();
  }
}
