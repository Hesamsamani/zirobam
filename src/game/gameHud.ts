import { formatNumber, t } from '../i18n';
import type { GameStore } from './gameStore';
import { svgIcon } from './badgeIcons';

const SVG_NS = 'http://www.w3.org/2000/svg';

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/** A strip with the player's rank and the way to the next one, today's goal as a ring, and the streak. */
export class GameHud {
  readonly element: HTMLElement;
  private readonly store: GameStore;
  private readonly rankName: HTMLElement;
  private readonly rankNote: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly barFill: HTMLElement;
  private readonly ring: SVGSVGElement;
  private readonly ringArc: SVGCircleElement;
  private readonly goalText: HTMLElement;
  private readonly streakText: HTMLElement;
  private readonly streakItem: HTMLElement;
  private readonly unsubscribe: () => void;

  constructor(store: GameStore) {
    this.store = store;
    this.element = make('div', 'game-hud');

    const rank = make('div', 'hud-item hud-rank');
    this.rankName = make('span', 'hud-rank-name');
    this.bar = make('div', 'hud-bar');
    this.bar.setAttribute('role', 'progressbar');
    this.bar.setAttribute('aria-valuemin', '0');
    this.bar.setAttribute('aria-valuemax', '100');
    this.barFill = make('div', 'hud-bar-fill');
    this.bar.appendChild(this.barFill);
    this.rankNote = make('span', 'hud-rank-note');
    rank.append(this.rankName, this.bar, this.rankNote);

    const goal = make('div', 'hud-item hud-goal');
    this.ring = document.createElementNS(SVG_NS, 'svg');
    this.ring.setAttribute('class', 'hud-ring');
    this.ring.setAttribute('viewBox', '0 0 36 36');
    this.ring.setAttribute('role', 'img');
    const track = document.createElementNS(SVG_NS, 'circle');
    track.setAttribute('class', 'hud-ring-track');
    this.ringArc = document.createElementNS(SVG_NS, 'circle');
    this.ringArc.setAttribute('class', 'hud-ring-arc');
    for (const circle of [track, this.ringArc]) {
      circle.setAttribute('cx', '18');
      circle.setAttribute('cy', '18');
      circle.setAttribute('r', '15.9155'); // circumference of 100, so a dash length is a percentage
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke-width', '3.4');
    }
    this.ringArc.setAttribute('stroke-linecap', 'round');
    this.ringArc.setAttribute('transform', 'rotate(-90 18 18)');
    this.ring.append(track, this.ringArc);
    this.goalText = make('span', 'hud-goal-text');
    goal.append(this.ring, this.goalText);

    const streak = make('div', 'hud-item hud-streak');
    this.streakItem = streak;
    streak.appendChild(svgIcon('flame', 'hud-flame'));
    this.streakText = make('span', 'hud-streak-text');
    streak.appendChild(this.streakText);

    this.element.append(rank, goal, streak);
    this.unsubscribe = store.onChange(() => this.refresh());
    this.refresh();
  }

  refresh(): void {
    const { level, into, needed } = this.store.levelProgress();
    const percent = Math.round((into / needed) * 100);
    this.rankName.textContent = t('game.rank', { n: formatNumber(level) });
    this.rankNote.textContent = t('game.xpToNext', { n: formatNumber(needed - into), next: formatNumber(level + 1) });
    this.barFill.style.width = `${percent}%`;
    this.bar.setAttribute('aria-valuenow', String(percent));
    this.bar.setAttribute('aria-label', this.rankName.textContent);

    const today = this.store.todayXp();
    const goal = this.store.goal();
    const done = today >= goal;
    const goalPercent = Math.min(100, Math.round((today / goal) * 100));
    const goalLabel = done ? t('game.goalDone') : t('game.goal', { xp: formatNumber(today), goal: formatNumber(goal) });
    this.goalText.textContent = goalLabel;
    this.ring.setAttribute('aria-label', done ? goalLabel : t('game.goal', { xp: formatNumber(today), goal: formatNumber(goal) }));
    this.ringArc.setAttribute('stroke-dasharray', `${goalPercent} ${100 - goalPercent}`);
    this.element.dataset.goalDone = String(done);

    const streak = this.store.streak();
    this.streakText.textContent = t('game.streak', { n: formatNumber(streak) });
    this.streakItem.dataset.active = String(streak > 0);
  }

  dispose(): void {
    this.unsubscribe();
  }
}
