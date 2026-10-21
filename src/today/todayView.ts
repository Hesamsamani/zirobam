import { formatNumber, t, type MessageKey } from '../i18n';
import { createBackButton } from '../menu/backButton';
import type { BlockKind, PlanBlock } from './planner';
import { totalMinutes } from './planner';
import type { TodayStore } from './todayStore';

export interface TodayViewDeps {
  store: TodayStore;
  /** Opens the screen that a kind of block is about. */
  open(kind: BlockKind): void;
  /** The whole plan was done (for the rewards). */
  onAllDone?(): void;
  onBack(): void;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/** The sentence that says why a block is in the plan. */
export function reasonText(block: PlanBlock): string {
  const params = block.reason.count === undefined ? undefined : { count: formatNumber(block.reason.count) };
  return t(`today.reason.${block.reason.key}` as MessageKey, params);
}

/** The plan of the day: a few blocks, each with its reason, a way to start it and a way to tick it off. */
export class TodayView {
  readonly id = 'today' as const;
  readonly element: HTMLElement;
  private readonly deps: TodayViewDeps;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly list: HTMLElement;
  private readonly all: HTMLElement;
  private readonly remake: HTMLButtonElement;

  constructor(deps: TodayViewDeps) {
    this.deps = deps;
    this.element = make('section', 'today-view');
    this.element.id = 'todayView';
    this.element.dataset.views = 'today';

    const header = make('header', 'view-header');
    this.title = make('h2', 'view-title');
    this.subtitle = make('p', 'view-subtitle');
    header.append(createBackButton(deps.onBack), this.title, this.subtitle);

    this.progress = make('p', 'td-progress');
    this.progress.setAttribute('role', 'status');
    this.list = make('ol', 'td-list');
    this.all = make('p', 'td-all');
    this.remake = make('button', 'sc-chip td-remake');
    this.remake.type = 'button';
    this.remake.addEventListener('click', () => {
      this.deps.store.remake();
      this.refresh();
    });
    this.element.append(header, this.progress, this.list, this.all, this.remake);
    this.refresh();
  }

  activate(): void {
    this.refresh();
  }

  deactivate(): void {
    // nothing is running
  }

  change(): void {
    // the address of this screen has no name
  }

  refresh(): void {
    const { store } = this.deps;
    const plan = store.plan();
    const progress = store.progress();
    this.title.textContent = t('today.title');
    this.subtitle.textContent = t('today.subtitle', { minutes: formatNumber(totalMinutes(plan)) });
    this.progress.textContent = t('today.progress', { done: formatNumber(progress.done), total: formatNumber(progress.total) });
    this.all.textContent = progress.total > 0 && progress.done === progress.total ? t('today.all') : '';
    this.remake.textContent = t('today.remake');
    this.list.replaceChildren(...plan.map((block) => this.item(block)));
  }

  private item(block: PlanBlock): HTMLElement {
    const done = this.deps.store.isDone(block.id);
    const li = make('li', 'td-block');
    li.dataset.kind = block.kind;
    li.dataset.done = String(done);

    const name = make('h3', 'td-name');
    name.textContent = t(`today.block.${block.kind}` as MessageKey);
    const minutes = make('span', 'td-minutes');
    minutes.textContent = t('today.minutes', { n: formatNumber(block.minutes) });
    const head = make('div', 'td-head');
    head.append(name, minutes);

    const why = make('p', 'td-reason');
    why.textContent = reasonText(block);

    const start = make('button', 'sc-hear td-start');
    start.type = 'button';
    start.textContent = t('today.start');
    start.addEventListener('click', () => this.deps.open(block.kind));

    const tick = make('button', 'sc-chip td-done');
    tick.type = 'button';
    tick.textContent = t(done ? 'today.undo' : 'today.done');
    tick.setAttribute('aria-pressed', String(done));
    tick.addEventListener('click', () => {
      if (this.deps.store.setDone(block.id, !done)) this.deps.onAllDone?.();
      this.refresh();
    });

    const actions = make('div', 'sc-actions');
    actions.append(start, tick);
    li.append(head, why, actions);
    return li;
  }
}
