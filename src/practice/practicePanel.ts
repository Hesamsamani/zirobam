import { formatNumber, t, type MessageKey } from '../i18n';
import type { StepType } from '../upload/steps';

export interface PanelStep {
  measures: readonly number[];
  type: StepType;
}

export interface PracticeView {
  steps: readonly PanelStep[];
  /** 0-based index of the current step. */
  currentIndex: number;
  measureCount: number;
  /** 1 for the first try at a step. */
  attempt: number;
  /** The piece's name and key, shown at the top of the panel. */
  title?: string;
  subtitle?: string;
}

export interface PracticePanelDeps {
  onJump(stepIndex: number): void;
  onPrevious(): void;
  onNext(): void;
}

export type StatusTone = 'hint' | 'good' | 'retry';

/** Measures per row, like the systems of a printed score. */
const SYSTEM_SIZE = 8;
const SVG_NS = 'http://www.w3.org/2000/svg';

const TYPE_LABELS: Readonly<Record<StepType, MessageKey>> = {
  single: 'practice.stepType.single',
  pair: 'practice.stepType.pair',
  consolidate: 'practice.stepType.consolidate',
};
const TYPE_HINTS: Readonly<Record<StepType, MessageKey>> = {
  single: 'practice.hint.single',
  pair: 'practice.hint.pair',
  consolidate: 'practice.hint.consolidate',
};

/** A teacher's pencil marks: a bracket for one measure, a tie for two, a long slur for a phrase. */
const GLYPHS: Readonly<Record<StepType, { path: string; dots: ReadonlyArray<[number, number]> }>> = {
  single: { path: 'M6 4v9h16V4', dots: [] },
  pair: { path: 'M5 5c0 9 18 9 18 0', dots: [[9, 3]] },
  consolidate: { path: 'M2 6c0 10 24 10 24 0', dots: [[7, 3], [12, 3], [17, 3], [22, 3]] },
};

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

function glyph(type: StepType): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 28 16');
  svg.setAttribute('class', 'pp-glyph');
  svg.setAttribute('aria-hidden', 'true');
  const { path, dots } = GLYPHS[type];
  const line = document.createElementNS(SVG_NS, 'path');
  line.setAttribute('d', path);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'currentColor');
  line.setAttribute('stroke-width', '2');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(line);
  for (const [cx, cy] of dots) {
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', String(cx));
    dot.setAttribute('cy', String(cy));
    dot.setAttribute('r', '1.6');
    dot.setAttribute('fill', 'currentColor');
    svg.appendChild(dot);
  }
  return svg;
}

/**
 * The practice step panel: which step this is, a map of the piece's measures with a pencil bracket under
 * the measures of the current step, step buttons, and a line that says how the last try went.
 */
export class PracticePanel {
  readonly element: HTMLElement;
  private readonly deps: PracticePanelDeps;
  private readonly glyphHolder: HTMLElement;
  private readonly typeEl: HTMLElement;
  private readonly whereEl: HTMLElement;
  private readonly countEl: HTMLElement;
  private readonly attemptEl: HTMLElement;
  private readonly prevButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly mapEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly songTitle: HTMLElement;
  private readonly songKey: HTMLElement;
  private readonly jumpTogether: HTMLButtonElement;
  private readonly jumpWhole: HTMLButtonElement;
  private readonly jumps: HTMLElement;
  private view: PracticeView | null = null;
  private builtFor = 0;
  private buttons: HTMLButtonElement[] = [];
  private systems: Array<{ row: HTMLElement; first: number; last: number }> = [];

  constructor(deps: PracticePanelDeps) {
    this.deps = deps;
    this.element = make('div', 'practice-panel');

    const song = make('div', 'pp-song');
    this.songTitle = make('span', 'pp-song-title');
    this.songKey = make('span', 'pp-song-key');
    song.append(this.songTitle, this.songKey);

    const head = make('div', 'pp-head');
    this.glyphHolder = make('span', 'pp-glyph-holder');
    const title = make('div', 'pp-title');
    this.typeEl = make('span', 'pp-type');
    this.whereEl = make('span', 'pp-where');
    title.append(this.typeEl, this.whereEl);

    const steps = make('div', 'pp-steps');
    const counts = make('div', 'pp-counts');
    this.countEl = make('span', 'pp-count');
    this.attemptEl = make('span', 'pp-attempt');
    this.attemptEl.hidden = true;
    counts.append(this.countEl, this.attemptEl);
    this.prevButton = this.stepButton('pp-prev', '‹', () => deps.onPrevious());
    this.nextButton = this.stepButton('pp-next', '›', () => deps.onNext());
    const nav = make('div', 'pp-nav');
    nav.setAttribute('dir', 'ltr'); // like the map: earlier on the left, later on the right
    nav.append(this.prevButton, this.nextButton);
    steps.append(counts, nav);
    head.append(this.glyphHolder, title, steps);

    this.mapEl = make('div', 'pp-map');
    this.mapEl.setAttribute('role', 'group');
    this.mapEl.setAttribute('dir', 'ltr');
    this.mapEl.addEventListener('keydown', (e) => this.handleKey(e));

    this.statusEl = make('p', 'pp-status');
    this.statusEl.setAttribute('aria-live', 'polite');
    this.statusEl.dataset.tone = 'hint';

    // Shortcuts to the longer steps, so they are one press away instead of many presses of "next"
    const jumps = make('div', 'pp-jumps');
    this.jumpTogether = make('button', 'pp-jump pp-jump-together');
    this.jumpTogether.type = 'button';
    this.jumpTogether.addEventListener('click', () => this.jump('phrase'));
    this.jumpWhole = make('button', 'pp-jump pp-jump-whole');
    this.jumpWhole.type = 'button';
    this.jumpWhole.addEventListener('click', () => this.jump('whole'));
    jumps.append(this.jumpTogether, this.jumpWhole);
    this.jumps = jumps;

    const foot = make('div', 'pp-foot');
    foot.append(this.statusEl, jumps);

    this.element.append(song, head, this.mapEl, foot);
  }

  private stepButton(className: string, glyphChar: string, onClick: () => void): HTMLButtonElement {
    const button = make('button', `pp-step-btn ${className}`);
    button.type = 'button';
    button.textContent = glyphChar;
    button.addEventListener('click', onClick);
    return button;
  }

  /** Puts a small tool (a button) in the row of the step buttons, where it costs no extra room. */
  addTool(tool: HTMLElement): void {
    this.jumps.appendChild(tool);
  }

  /** Shows a step. The status line goes back to the hint for that kind of step. */
  update(view: PracticeView): void {
    this.view = view;
    const step = view.steps[view.currentIndex];
    if (!step) return;

    this.element.dataset.type = step.type;
    this.songTitle.textContent = view.title ?? '';
    this.songKey.textContent = view.subtitle ?? '';
    this.element.classList.toggle('has-song', Boolean(view.title));
    this.glyphHolder.replaceChildren(glyph(step.type));
    this.typeEl.textContent = t(TYPE_LABELS[step.type]);
    this.whereEl.textContent = this.describe(step.measures);
    this.countEl.textContent = t('practice.stepOf', { current: formatNumber(view.currentIndex + 1), total: formatNumber(view.steps.length) });
    this.attemptEl.hidden = view.attempt < 2;
    this.attemptEl.textContent = t('practice.attempt', { n: formatNumber(view.attempt) });
    this.prevButton.disabled = view.currentIndex <= 0;
    this.nextButton.disabled = view.currentIndex >= view.steps.length - 1;
    this.prevButton.setAttribute('aria-label', t('practice.prev'));
    this.nextButton.setAttribute('aria-label', t('practice.next'));
    this.mapEl.setAttribute('aria-label', t('practice.map'));
    this.updateJumps(view);

    if (this.builtFor !== view.measureCount) this.buildMap(view.measureCount);
    this.paintMap(view, step);
    this.setStatus(t(TYPE_HINTS[step.type]), 'hint');
  }

  private jumpIndex(kind: 'phrase' | 'whole'): number {
    const view = this.view;
    if (!view) return -1;
    if (kind === 'whole') return view.steps.length - 1;
    return view.steps.findIndex((s, i) => i > view.currentIndex && s.type === 'consolidate');
  }

  private jump(kind: 'phrase' | 'whole'): void {
    const index = this.jumpIndex(kind);
    if (index >= 0 && index !== this.view?.currentIndex) this.deps.onJump(index);
  }

  private updateJumps(view: PracticeView): void {
    const hasPhrases = view.steps.some((s) => s.type === 'consolidate');
    this.jumpTogether.hidden = !hasPhrases;
    this.jumpWhole.hidden = !hasPhrases;
    this.jumpTogether.textContent = t('practice.jumpTogether');
    this.jumpTogether.setAttribute('aria-label', t('practice.jumpTogetherAria'));
    this.jumpTogether.disabled = this.jumpIndex('phrase') < 0;
    this.jumpWhole.textContent = t('practice.jumpWhole');
    this.jumpWhole.setAttribute('aria-label', t('practice.jumpWholeAria'));
    this.jumpWhole.disabled = view.currentIndex >= view.steps.length - 1;
  }

  /** Say how the last try went. Shown until the step changes. */
  setStatus(message: string, tone: StatusTone): void {
    this.statusEl.textContent = message;
    this.statusEl.dataset.tone = tone;
  }

  refresh(): void {
    if (this.view) this.update(this.view);
  }

  private describe(measures: readonly number[]): string {
    if (measures.length === 1) return t('practice.measure', { n: formatNumber(measures[0]) });
    return t('practice.measures', {
      from: formatNumber(measures[0]),
      to: formatNumber(measures[measures.length - 1]),
    });
  }

  // ----- the map -----

  private buildMap(measureCount: number): void {
    this.builtFor = measureCount;
    this.buttons = [];
    this.systems = [];
    this.mapEl.replaceChildren();
    const columns = Math.max(1, Math.min(SYSTEM_SIZE, measureCount));
    for (let first = 1; first <= measureCount; first += columns) {
      const last = Math.min(measureCount, first + columns - 1);
      const system = make('div', 'pp-system');
      const row = make('div', 'pp-measures');
      row.style.setProperty('--columns', String(columns));
      for (let n = first; n <= last; n++) {
        const button = make('button', 'pp-measure');
        button.type = 'button';
        button.dataset.measure = String(n);
        button.addEventListener('click', () => this.jumpToMeasure(n));
        this.buttons.push(button);
        row.appendChild(button);
      }
      system.appendChild(row);
      this.mapEl.appendChild(system);
      this.systems.push({ row, first, last });
    }
  }

  private singleIndex(measure: number): number {
    const steps = this.view?.steps ?? [];
    const single = steps.findIndex((s) => s.type === 'single' && s.measures.includes(measure));
    return single >= 0 ? single : steps.findIndex((s) => s.measures.includes(measure));
  }

  private jumpToMeasure(measure: number): void {
    const index = this.singleIndex(measure);
    if (index >= 0) this.deps.onJump(index);
  }

  private paintMap(view: PracticeView, step: PanelStep): void {
    const first = step.measures[0];
    this.buttons.forEach((button, i) => {
      const n = i + 1;
      const inStep = step.measures.includes(n);
      const done = !inStep && this.singleIndex(n) < view.currentIndex;
      button.dataset.state = inStep ? 'current' : done ? 'done' : 'todo';
      button.textContent = formatNumber(n);
      button.tabIndex = n === first ? 0 : -1;
      button.setAttribute(
        'aria-label',
        t(inStep ? 'practice.measureCurrent' : done ? 'practice.measureDone' : 'practice.measureAria', { n: formatNumber(n) })
      );
      if (inStep) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });

    const firstMeasure = step.measures[0];
    const lastMeasure = step.measures[step.measures.length - 1];
    for (const system of this.systems) {
      system.row.querySelector('.pp-bracket')?.remove();
      const from = Math.max(firstMeasure, system.first);
      const to = Math.min(lastMeasure, system.last);
      if (from > to) continue;
      const bracket = make('div', 'pp-bracket');
      bracket.dataset.type = step.type;
      bracket.style.setProperty('--from', String(from - system.first + 1));
      bracket.style.setProperty('--to', String(to - system.first + 2));
      bracket.classList.toggle('open-start', firstMeasure < system.first);
      bracket.classList.toggle('open-end', lastMeasure > system.last);
      system.row.appendChild(bracket);
    }
  }

  private handleKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const index = this.buttons.indexOf(target as HTMLButtonElement);
    if (index < 0) return;
    let next = -1;
    if (event.key === 'ArrowRight') next = Math.min(this.buttons.length - 1, index + 1);
    else if (event.key === 'ArrowLeft') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = this.buttons.length - 1;
    if (next < 0) return;
    event.preventDefault();
    this.buttons[next].focus();
  }
}
