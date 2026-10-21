import { seededRng, type Rng } from '../core/rng';
import { storageGet, storageSet } from '../core/safeStorage';
import { formatNumber, t, type MessageKey } from '../i18n';
import { isSpaceReserved } from '../input/shortcuts';
import type { NoteInputHub } from '../input/noteInput';
import type { NotationToolkit } from '../learn/noteCard';
import type { NoteStats } from '../learn/noteStats';
import { renderStaffPicture } from '../lessons/staffPicture';
import { METERS } from '../generator/rhythmCells';
import { createBackButton } from '../menu/backButton';
import type { RhythmVerdict } from '../stats/mistakeLog';
import { nextRhythm, onsets, RHYTHM_LEVEL_COUNT, tokens, totalBeats, type RhythmExercise } from './rhythmGen';
import { didPassRhythm, medianOffset, scoreTaps, type ScoreSummary, type Verdict } from './tapScoring';

/** The clicks of the count-in and of the beat: the real ones are played by `ClickVoice`, a fake stands in for them in tests. */
export interface RhythmAudio {
  ready(): Promise<boolean>;
  /** Plays `count` clicks, one every `intervalMs`, the first `leadMs` from now (louder every `accentEvery`); gives the moment of the first one on the clock of the screen. */
  clicks(count: number, intervalMs: number, accentEvery: number, leadMs: number): number;
  stop(): void;
}

export interface RhythmViewDeps {
  hub: NoteInputHub;
  toolkit: NotationToolkit;
  audio: RhythmAudio;
  /** Milliseconds on a clock that goes steadily: `performance.now()`. */
  clock(): number;
  stats: NoteStats;
  onBack(): void;
  /** A piece was passed (for the rewards). */
  onPassed?(): void;
  /** Each note of a piece was on time, early, late or not played (for the practice memory). */
  onVerdict?(verdict: RhythmVerdict): void;
  random?: Rng;
  storage?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
}

type Phase = 'idle' | 'count' | 'tap' | 'calibrate' | 'done';

const KEY = 'rhythm.v1';
/** Time from pressing Start to the first click, in milliseconds. */
const LEAD_MS = 350;
/** Taps are taken a little before the first beat and a little after the last. */
const BEFORE_MS = 200;
const AFTER_MS = 350;
const CALIBRATION_CLICKS = 8;
const CALIBRATION_BPM = 80;

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

const verdictOf = (v: Verdict): RhythmVerdict => (v === 'perfect' || v === 'good' ? 'hit' : v);

/** The rhythm trainer: a rhythm on one line of the staff, a count-in of clicks, and taps judged against the beat. */
export class RhythmView {
  readonly id = 'rhythm' as const;
  readonly element: HTMLElement;
  private readonly deps: RhythmViewDeps;
  private readonly storage: NonNullable<RhythmViewDeps['storage']>;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly levels: HTMLElement;
  private readonly staff: HTMLElement;
  private readonly state: HTMLElement;
  private readonly result: HTMLElement;
  private readonly start: HTMLButtonElement;
  private readonly fresh: HTMLButtonElement;
  private readonly pad: HTMLButtonElement;
  private readonly delay: HTMLElement;
  private readonly calibrate: HTMLButtonElement;
  private readonly reset: HTMLButtonElement;
  private readonly rng: Rng;

  private level = 1;
  private exercise: RhythmExercise | null = null;
  private phase: Phase = 'idle';
  private offsetMs = 0;
  private active = false;
  private taps: number[] = [];
  private expectedMs: number[] = [];
  private windowStart = 0;
  private windowEnd = 0;
  private timer: number | null = null;
  private note = '';

  constructor(deps: RhythmViewDeps) {
    this.deps = deps;
    this.storage = deps.storage ?? { getItem: storageGet, setItem: storageSet };
    this.rng = deps.random ?? seededRng(Math.floor(Math.random() * 2 ** 31));
    this.offsetMs = this.loadOffset();

    this.element = make('section', 'rhythm-view');
    this.element.id = 'rhythmView';
    this.element.dataset.views = 'rhythm';

    const header = make('header', 'view-header');
    this.title = make('h2', 'view-title');
    this.subtitle = make('p', 'view-subtitle');
    header.append(createBackButton(deps.onBack), this.title, this.subtitle);

    this.levels = make('div', 'sc-chips rh-levels');
    this.levels.setAttribute('role', 'group');
    this.staff = make('div', 'sc-staff rh-staff');
    this.staff.setAttribute('dir', 'ltr');
    this.state = make('p', 'rh-state');
    this.state.setAttribute('role', 'status');
    this.result = make('p', 'rh-result');
    this.result.setAttribute('role', 'status');

    this.start = make('button', 'sc-hear rh-start');
    this.start.type = 'button';
    this.start.addEventListener('click', () => (this.phase === 'count' || this.phase === 'tap' || this.phase === 'calibrate' ? this.cancel() : void this.begin()));
    this.fresh = make('button', 'sc-chip rh-new');
    this.fresh.type = 'button';
    this.fresh.addEventListener('click', () => this.newExercise());
    const actions = make('div', 'sc-actions');
    actions.append(this.start, this.fresh);

    this.pad = make('button', 'rh-pad');
    this.pad.type = 'button';
    // a tap counts when the finger comes down, not when it is lifted
    this.pad.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.tap();
    });
    this.pad.addEventListener('keydown', (event) => {
      if (event.code !== 'Space' && event.code !== 'Enter') return;
      event.preventDefault();
      if (!event.repeat) this.tap();
    });

    this.delay = make('p', 'rh-delay');
    this.calibrate = make('button', 'sc-chip rh-calibrate');
    this.calibrate.type = 'button';
    this.calibrate.addEventListener('click', () => void this.beginCalibration());
    this.reset = make('button', 'sc-chip rh-reset');
    this.reset.type = 'button';
    this.reset.addEventListener('click', () => {
      this.offsetMs = 0;
      this.saveOffset();
      this.drawDelay();
    });
    const calibration = make('div', 'rh-calibration');
    calibration.append(this.delay, this.calibrate, this.reset);

    this.element.append(header, this.levels, this.staff, this.state, actions, this.pad, this.result, calibration);

    deps.hub.onNoteOn.on(() => {
      if (this.active) this.tap();
    });
    window.addEventListener('keydown', (event) => {
      if (!this.active || event.code !== 'Space' || event.repeat || isSpaceReserved(event.target)) return;
      event.preventDefault();
      this.tap();
    });
    this.refresh();
  }

  current(): { level: number; exercise: RhythmExercise | null; phase: Phase; offsetMs: number } {
    return { level: this.level, exercise: this.exercise, phase: this.phase, offsetMs: this.offsetMs };
  }

  activate(): void {
    this.active = true;
    if (!this.exercise) this.newExercise();
    this.refresh();
  }

  deactivate(): void {
    this.active = false;
    this.cancel();
  }

  change(): void {
    // the address of this screen has no name
  }

  refresh(): void {
    this.title.textContent = t('rhythm.title');
    this.subtitle.textContent = t('rhythm.subtitle');
    this.drawLevels();
    this.drawControls();
    this.drawDelay();
    this.drawExercise();
  }

  // ----- the exercise -----

  private newExercise(): void {
    this.cancel();
    this.exercise = nextRhythm(this.level, this.rng, this.exercise);
    this.phase = 'idle';
    this.note = '';
    this.result.textContent = '';
    this.refresh();
  }

  private drawLevels(): void {
    const max = this.deps.stats.getMaxStage();
    this.levels.setAttribute('aria-label', t('rhythm.levels'));
    this.levels.replaceChildren(
      ...Array.from({ length: RHYTHM_LEVEL_COUNT }, (_, i) => i + 1).map((level) => {
        const chip = make('button', 'sc-chip');
        chip.type = 'button';
        chip.textContent = formatNumber(level);
        chip.setAttribute('aria-label', t('rhythm.level', { n: formatNumber(level) }));
        chip.dataset.level = String(level);
        chip.disabled = level > max;
        chip.setAttribute('aria-pressed', String(this.level === level));
        chip.addEventListener('click', () => {
          this.level = level;
          this.exercise = null;
          this.newExercise();
        });
        return chip;
      }),
    );
  }

  private drawExercise(summary?: ScoreSummary): void {
    const exercise = this.exercise;
    if (!exercise) return;
    const m = METERS[exercise.level.meter];
    try {
      renderStaffPicture(this.staff, {
        toolkit: this.deps.toolkit,
        spec: { clef: 'treble', notes: tokens(exercise), fifths: 0, beats: m.beats, beatType: m.beatType, showTime: true },
        names: false,
        formatName: (n) => n,
        description: t('rhythm.staff'),
      });
    } catch {
      this.staff.replaceChildren();
    }
    // the notes of the staff, in the order of the taps that were wanted: colour each by how it went
    if (summary) {
      const heads = Array.from(this.staff.querySelectorAll<SVGElement>('.note'));
      summary.results.forEach((r, i) => heads[i]?.classList.add(`rh-${r.verdict}`));
    }
  }

  private drawControls(): void {
    const running = this.phase === 'count' || this.phase === 'tap' || this.phase === 'calibrate';
    this.start.textContent = running ? t('rhythm.stop') : this.phase === 'done' ? t('rhythm.again') : t('rhythm.start');
    this.fresh.textContent = t('rhythm.new');
    this.pad.textContent = t('rhythm.pad');
    const key: Record<Phase, MessageKey> = { idle: 'rhythm.state.idle', count: 'rhythm.state.count', tap: 'rhythm.state.tap', calibrate: 'rhythm.calibrate.running', done: 'rhythm.state.idle' };
    this.state.textContent = this.note || (this.phase === 'done' ? '' : t(key[this.phase]));
    this.state.dataset.phase = this.phase;
    this.pad.dataset.phase = this.phase;
  }

  // ----- taps -----

  private tap(): void {
    if (this.phase !== 'count' && this.phase !== 'tap' && this.phase !== 'calibrate') return;
    const now = this.deps.clock();
    if (now < this.windowStart || now > this.windowEnd) return;
    this.taps.push(now);
  }

  private async begin(): Promise<void> {
    const exercise = this.exercise;
    if (!exercise) return;
    this.cancel();
    if (!(await this.deps.audio.ready())) {
      this.note = t('rhythm.state.noSound');
      this.drawControls();
      return;
    }
    this.note = '';
    const m = METERS[exercise.level.meter];
    const beatMs = 60000 / exercise.level.bpm;
    // a click for every beat of the bar; in 6/8 a beat is a dotted quarter
    const clickBeats = exercise.level.meter === '6/8' ? 1.5 : 1;
    const clickMs = beatMs * clickBeats;
    const perBar = (m.units / 4) / clickBeats;
    const total = totalBeats(exercise);
    const clicks = perBar + total / clickBeats;
    const first = this.deps.audio.clicks(clicks, clickMs, perBar, LEAD_MS);
    const exerciseStart = first + perBar * clickMs;
    this.expectedMs = onsets(exercise).map((beat) => exerciseStart + beat * beatMs);
    this.windowStart = exerciseStart - BEFORE_MS;
    this.windowEnd = exerciseStart + total * beatMs + AFTER_MS;
    this.taps = [];
    this.phase = 'count';
    this.result.textContent = '';
    this.drawExercise();
    this.drawControls();
    this.timer = window.setTimeout(() => {
      this.phase = 'tap';
      this.drawControls();
      this.timer = window.setTimeout(() => this.finish(), Math.max(0, this.windowEnd - this.deps.clock()));
    }, Math.max(0, exerciseStart - this.deps.clock()));
  }

  private finish(): void {
    const exercise = this.exercise;
    this.timer = null;
    if (!exercise) return;
    this.deps.audio.stop();
    const summary = scoreTaps(this.expectedMs, this.taps, this.offsetMs);
    const passed = didPassRhythm(summary);
    this.phase = 'done';
    this.deps.stats.record(exercise.key, exercise.level.id, passed);
    for (const r of summary.results) this.deps.onVerdict?.(verdictOf(r.verdict));
    let unlocked = '';
    if (passed) {
      this.deps.onPassed?.();
      if (exercise.level.id < RHYTHM_LEVEL_COUNT && this.deps.stats.unlock(exercise.level.id + 1)) unlocked = ` ${t('rhythm.unlocked', { n: formatNumber(exercise.level.id + 1) })}`;
    }
    const deltas = summary.results.filter((r) => r.deltaMs !== null).map((r) => r.deltaMs as number);
    const average = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
    const lean = !passed && average < -25 ? ` ${t('rhythm.leaning.early')}` : !passed && average > 25 ? ` ${t('rhythm.leaning.late')}` : '';
    this.result.dataset.tone = passed ? 'good' : 'bad';
    this.result.textContent = `${t('rhythm.result', { perfect: summary.perfect, good: summary.good, early: summary.early, late: summary.late, missed: summary.missed, extra: summary.extraTaps })} ${t(passed ? 'rhythm.passed' : 'rhythm.failed')}${lean}${unlocked}`;
    this.drawLevels();
    this.drawControls();
    this.drawExercise(summary);
  }

  private cancel(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.deps.audio.stop();
    if (this.phase === 'count' || this.phase === 'tap' || this.phase === 'calibrate') {
      this.phase = 'idle';
      this.note = '';
      this.drawControls();
    }
  }

  // ----- the delay of the device -----

  private loadOffset(): number {
    try {
      const value = Number((JSON.parse(this.storage.getItem(KEY) ?? 'null') as { offsetMs?: unknown } | null)?.offsetMs);
      return Number.isFinite(value) ? Math.max(-300, Math.min(300, Math.round(value))) : 0;
    } catch {
      return 0;
    }
  }

  private saveOffset(): void {
    try {
      this.storage.setItem(KEY, JSON.stringify({ offsetMs: this.offsetMs }));
    } catch {
      // not kept
    }
  }

  private drawDelay(): void {
    this.delay.textContent = t('rhythm.delay', { ms: formatNumber(this.offsetMs) });
    this.calibrate.textContent = t('rhythm.calibrate');
    this.calibrate.title = t('rhythm.calibrate.hint');
    this.reset.textContent = t('rhythm.calibrate.reset');
    this.reset.disabled = this.offsetMs === 0;
  }

  private async beginCalibration(): Promise<void> {
    this.cancel();
    if (!(await this.deps.audio.ready())) {
      this.note = t('rhythm.state.noSound');
      this.drawControls();
      return;
    }
    this.note = '';
    const clickMs = 60000 / CALIBRATION_BPM;
    const first = this.deps.audio.clicks(CALIBRATION_CLICKS, clickMs, 4, LEAD_MS);
    const beats = Array.from({ length: CALIBRATION_CLICKS }, (_, i) => first + i * clickMs);
    this.windowStart = first - clickMs / 2;
    this.windowEnd = first + (CALIBRATION_CLICKS - 1) * clickMs + clickMs / 2;
    this.taps = [];
    this.phase = 'calibrate';
    this.drawControls();
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.deps.audio.stop();
      // each tap is compared with the click nearest to it
      const deltas = this.taps.map((tap) => {
        const nearest = beats.reduce((best, b) => (Math.abs(tap - b) < Math.abs(tap - best) ? b : best), beats[0]);
        return tap - nearest;
      });
      this.offsetMs = deltas.length >= 3 ? medianOffset(deltas) : this.offsetMs;
      this.saveOffset();
      this.phase = 'idle';
      this.note = t('rhythm.calibrate.done', { ms: formatNumber(this.offsetMs) });
      this.drawDelay();
      this.drawControls();
    }, Math.max(0, this.windowEnd - this.deps.clock()));
  }
}
