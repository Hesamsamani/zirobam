import { seededRng, type Rng } from '../core/rng';
import { formatNumber, t, type MessageKey } from '../i18n';
import type { NoteInputHub } from '../input/noteInput';
import { UNLOCK_ACCURACY } from '../learn/nameTheNote';
import { RECENT_LIMIT, type NoteStats } from '../learn/noteStats';
import { buildKeysPicture } from '../lessons/keysPicture';
import { createBackButton } from '../menu/backButton';
import { keyName, parsePitch, pianoMidi } from '../theory/pitch';
import { ascendFrom } from '../theory/spell';
import { detectChord } from './chordDetect';
import { CHORD_STAGES, judgeChord, makeChordQuestion, type ChordQuestion } from './chordQuiz';
import { HeldNotes } from './heldNotes';

export interface ChordsViewDeps {
  hub: NoteInputHub;
  /** A note name, with or without an octave, as the student has chosen to read it. */
  formatName(note: string): string;
  stats: NoteStats;
  onBack(): void;
  /** A quiz question was answered (for the rewards). */
  onAnswer?(correct: boolean, question: ChordQuestion): void;
  random?: Rng;
  clock?: () => number;
}

type Tab = 'detect' | 'quiz';

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteOfMidi = (midi: number): string => `${SHARP_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
/** How often the held keys are looked at, in milliseconds. */
const POLL_MS = 40;
/** How long "Right!" stays before the next chord, in milliseconds. */
const NEXT_DELAY_MS = 1100;

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/** The chord reader: say what chord the keys make, or be asked for chords. */
export class ChordsView {
  readonly id = 'chords' as const;
  readonly element: HTMLElement;
  private readonly deps: ChordsViewDeps;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly keys: HTMLElement;
  private readonly detect: HTMLElement;
  private readonly name: HTMLElement;
  private readonly kind: HTMLElement;
  private readonly notes: HTMLElement;
  private readonly quiz: HTMLElement;
  private readonly stages: HTMLElement;
  private readonly ask: HTMLElement;
  private readonly target: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly status: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly show: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private readonly clear: HTMLButtonElement;

  private readonly held: HeldNotes;
  private readonly rng: Rng;
  private tab: Tab = 'detect';
  private stage = 1;
  private question: ChordQuestion | null = null;
  private answered = false;
  private revealed = false;
  private active = false;
  private timer: number | null = null;
  private nextTimer: number | null = null;
  private lastSeen = '';
  private unlockedNote = '';

  constructor(deps: ChordsViewDeps) {
    this.deps = deps;
    this.rng = deps.random ?? seededRng(Math.floor(Math.random() * 2 ** 31));
    this.held = new HeldNotes(deps.clock);

    this.element = make('section', 'chords-view');
    this.element.id = 'chordsView';
    this.element.dataset.views = 'chords';

    const header = make('header', 'view-header');
    this.title = make('h2', 'view-title');
    this.subtitle = make('p', 'view-subtitle');
    header.append(createBackButton(deps.onBack), this.title, this.subtitle);

    this.tabs = make('div', 'sc-tabs ch-tabs');
    this.tabs.setAttribute('role', 'group');
    this.keys = make('div', 'ch-keys');
    this.keys.setAttribute('dir', 'ltr');

    this.name = make('p', 'ch-name');
    this.name.setAttribute('dir', 'ltr');
    this.kind = make('p', 'ch-kind');
    this.notes = make('p', 'ch-notes');
    this.detect = make('div', 'ch-detect');
    this.detect.append(this.name, this.kind, this.notes);

    this.stages = make('div', 'sc-chips ch-stages');
    this.stages.setAttribute('role', 'group');
    this.ask = make('p', 'ch-ask');
    this.target = make('p', 'ch-target');
    this.target.setAttribute('dir', 'ltr');
    this.hint = make('p', 'ch-hint');
    this.status = make('p', 'ch-status');
    this.status.setAttribute('role', 'status');
    this.progress = make('p', 'ch-progress');
    this.show = make('button', 'sc-chip ch-show');
    this.show.type = 'button';
    this.show.addEventListener('click', () => {
      this.revealed = true;
      this.drawKeys();
    });
    this.next = make('button', 'sc-hear ch-next');
    this.next.type = 'button';
    this.next.addEventListener('click', () => this.nextQuestion());
    const actions = make('div', 'sc-actions');
    actions.append(this.show, this.next);
    this.quiz = make('div', 'ch-quiz');
    this.quiz.append(this.stages, this.ask, this.target, this.hint, this.status, actions, this.progress);

    this.clear = make('button', 'sc-chip ch-clear');
    this.clear.type = 'button';
    this.clear.addEventListener('click', () => {
      this.held.clear();
      this.lastSeen = '';
      this.drawKeys();
    });

    this.element.append(header, this.tabs, this.detect, this.quiz, this.keys, this.clear);

    deps.hub.onNoteOn.on(({ noteName }) => {
      if (!this.active) return;
      const pitch = parsePitch(noteName);
      if (pitch) this.held.press(pianoMidi(pitch));
      this.drawKeys();
    });
    deps.hub.onNoteOff.on(({ noteName }) => {
      if (!this.active) return;
      const pitch = parsePitch(noteName);
      if (pitch) this.held.release(pianoMidi(pitch));
      this.drawKeys();
    });
    this.refresh();
  }

  /** What is on the screen (for tests and the end-to-end hook). */
  current(): { tab: Tab; question: ChordQuestion | null; stage: number } {
    return { tab: this.tab, question: this.question, stage: this.stage };
  }

  activate(): void {
    this.active = true;
    this.held.clear();
    this.lastSeen = '';
    if (!this.question) this.nextQuestion();
    this.timer ??= window.setInterval(() => this.poll(), POLL_MS);
    this.refresh();
  }

  deactivate(): void {
    this.active = false;
    this.held.clear();
    if (this.timer !== null) window.clearInterval(this.timer);
    if (this.nextTimer !== null) window.clearTimeout(this.nextTimer);
    this.timer = null;
    this.nextTimer = null;
  }

  change(): void {
    // the address of this screen has no name
  }

  refresh(): void {
    this.title.textContent = t('chords.title');
    this.subtitle.textContent = t('chords.subtitle');
    this.tabs.setAttribute('aria-label', t('chords.tabs'));
    this.tabs.replaceChildren(
      ...(['detect', 'quiz'] as const).map((tab) => {
        const button = make('button', 'sc-chip sc-tab');
        button.type = 'button';
        button.textContent = t(`chords.tab.${tab}` as MessageKey);
        button.dataset.tab = tab;
        button.setAttribute('aria-pressed', String(this.tab === tab));
        button.addEventListener('click', () => this.setTab(tab));
        return button;
      }),
    );
    this.detect.hidden = this.tab !== 'detect';
    this.quiz.hidden = this.tab !== 'quiz';
    this.clear.textContent = t('chords.clear');
    this.drawStages();
    this.drawQuestion();
    this.drawDetection(this.held.down());
    this.drawKeys();
  }

  // ----- tabs and stages -----

  private setTab(tab: Tab): void {
    this.tab = tab;
    this.held.clear();
    this.lastSeen = '';
    this.refresh();
  }

  private drawStages(): void {
    const max = this.deps.stats.getMaxStage();
    this.stages.setAttribute('aria-label', t('chords.stages'));
    this.stages.replaceChildren(
      ...Array.from({ length: CHORD_STAGES }, (_, i) => i + 1).map((stage) => {
        const chip = make('button', 'sc-chip');
        chip.type = 'button';
        chip.textContent = t('chords.stage', { n: formatNumber(stage) });
        chip.dataset.stage = String(stage);
        chip.disabled = stage > max;
        chip.setAttribute('aria-pressed', String(this.stage === stage));
        chip.addEventListener('click', () => {
          this.stage = stage;
          this.question = null;
          this.nextQuestion();
          this.refresh();
        });
        return chip;
      }),
    );
  }

  // ----- the quiz -----

  private nextQuestion(): void {
    if (this.nextTimer !== null) window.clearTimeout(this.nextTimer);
    this.nextTimer = null;
    this.question = makeChordQuestion(this.stage, this.rng, this.question);
    this.answered = false;
    this.revealed = false;
    this.unlockedNote = '';
    this.held.clear();
    this.lastSeen = '';
    this.status.textContent = '';
    this.status.dataset.tone = '';
    this.drawQuestion();
    this.drawKeys();
  }

  private drawQuestion(): void {
    const q = this.question;
    this.ask.textContent = t('chords.quiz.ask');
    this.hint.textContent = t('chords.quiz.hint');
    this.show.textContent = t('chords.quiz.show');
    this.next.textContent = t('chords.quiz.next');
    this.next.hidden = !this.answered;
    this.show.hidden = this.answered || this.revealed;
    if (!q) {
      this.target.textContent = '';
      return;
    }
    const symbol = `${this.deps.formatName(q.root)}${q.def.symbol}${q.bass ? `/${this.deps.formatName(q.bass)}` : ''}`;
    this.target.textContent = symbol;
    const recent = this.deps.stats.recent(q.stage);
    this.progress.textContent = [
      t('chords.progress', { answered: formatNumber(Math.min(recent.answered, RECENT_LIMIT)), limit: formatNumber(RECENT_LIMIT), percent: `${formatNumber(Math.round(recent.accuracy * 100))}%` }),
      this.unlockedNote,
    ]
      .filter(Boolean)
      .join(' ');
  }

  /** The keys are looked at a few times a second: when they have stopped moving, they are read as a chord. */
  private poll(): void {
    if (!this.active) return;
    const settled = this.held.settled();
    const signature = settled ? settled.join(',') : '';
    if (signature === this.lastSeen) return;
    this.lastSeen = signature;
    if (!settled) return;
    if (this.tab === 'detect') this.drawDetection(settled);
    else this.judge(settled);
  }

  private judge(midis: readonly number[]): void {
    const q = this.question;
    if (!q || this.answered) return;
    // fewer keys than the chord has: the hand is still arriving
    if (new Set(midis.map((m) => m % 12)).size < new Set(q.notes).size && !judgeChord(q, midis)) return;
    const right = judgeChord(q, midis);
    this.answered = true;
    this.revealed = !right;
    this.deps.stats.record(q.key, q.stage, right);
    this.deps.onAnswer?.(right, q);
    const recent = this.deps.stats.recent(q.stage);
    if (right && recent.answered >= RECENT_LIMIT && recent.accuracy >= UNLOCK_ACCURACY && this.deps.stats.unlock(q.stage + 1)) {
      this.unlockedNote = t('chords.unlocked', { n: formatNumber(q.stage + 1) });
      this.drawStages();
    }
    this.status.dataset.tone = right ? 'good' : 'bad';
    this.status.textContent = right ? t('chords.quiz.right') : t('chords.quiz.wrong', { notes: q.notes.map((n) => this.deps.formatName(n)).join(' ') });
    this.drawQuestion();
    this.drawKeys();
    if (right) this.nextTimer = window.setTimeout(() => this.nextQuestion(), NEXT_DELAY_MS);
  }

  // ----- the detector -----

  private drawDetection(midis: readonly number[]): void {
    const reading = detectChord(midis);
    this.name.textContent = reading ? `${this.deps.formatName(reading.root)}${reading.def.symbol}${reading.bass ? `/${this.deps.formatName(reading.bass)}` : ''}` : '';
    this.kind.textContent = reading ? t(`chord.name.${reading.def.id}` as MessageKey) : midis.length >= 3 ? t('chords.detect.unknown') : t('chords.detect.none');
    this.notes.textContent = reading ? t('chords.notes', { notes: reading.notes.map((n) => this.deps.formatName(n)).join(' ') }) : '';
  }

  // ----- the keys -----

  /** A key pressed on the picture stays down until it is pressed again: a mouse or a finger cannot hold a chord. */
  private toggleKey(note: string): void {
    const pitch = parsePitch(note);
    if (!pitch) return;
    const midi = pianoMidi(pitch);
    if (this.held.down().includes(midi)) this.held.release(midi);
    else this.held.press(midi);
    this.drawKeys();
  }

  private drawKeys(): void {
    const marks: Record<string, string> = {};
    // the keys that are down
    for (const midi of this.held.down()) marks[keyName(noteOfMidi(midi))] = '';
    // after a wrong answer (or "Show the notes") the notes of the chord are shown once, from middle C
    if (this.tab === 'quiz' && this.revealed && this.question) for (const pitch of ascendFrom(this.question.notes, 4)) marks[keyName(pitch)] = '';
    this.keys.replaceChildren(
      buildKeysPicture({
        from: 'C3',
        to: 'C6',
        names: 'white',
        marks,
        formatName: (note) => this.deps.formatName(note),
        formatMark: (text) => text,
        onPlay: (note) => this.toggleKey(note),
        ariaLabel: t('chords.keys'),
      }),
    );
  }
}
