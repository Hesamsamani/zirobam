import { storageGet, storageSet } from '../core/safeStorage';
import { formatNumber, t, type MessageKey } from '../i18n';
import { buildKeysPicture } from '../lessons/keysPicture';
import { createBackButton } from '../menu/backButton';
import type { NoteInputHub } from '../input/noteInput';
import { RECENT_LIMIT, type NoteStats } from '../learn/noteStats';
import { UNLOCK_ACCURACY } from '../learn/nameTheNote';
import type { PianoVoice } from '../playback/pianoVoice';
import { WaitSession } from '../practice/waitMode';
import { EAR_STAGES, makeQuestion, seededRng, type EarQuestion, type Rng } from './questions';

const STAGE_KEY = 'ear.stage';

/** The piano the ear exercises listen with. */
export type EarVoice = PianoVoice;

export interface EarViewDeps {
  stats: NoteStats;
  voice: EarVoice;
  /** MIDI and other note input: the exercises of stage 5 are answered by playing. */
  hub: NoteInputHub;
  formatName(note: string): string;
  onBack(): void;
  /** A question was answered (for the rewards). */
  onAnswer(correct: boolean): void;
  random?: Rng;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

const percent = (value: number): string => t('aids.percent', { n: formatNumber(Math.round(value * 100)) });

/** The ear training screen: listen, then answer with a button or, in the last stage, by playing. */
export class EarView {
  readonly element: HTMLElement;
  private readonly deps: EarViewDeps;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly stages: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly hear: HTMLButtonElement;
  private readonly choices: HTMLElement;
  private readonly keyboardHolder: HTMLElement;
  private readonly feedback: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly melody: HTMLElement;
  private readonly next: HTMLButtonElement;
  private readonly rng: Rng;

  private stage = 1;
  private question: EarQuestion | null = null;
  private previous: EarQuestion | null = null;
  /** The question was answered (right), so only "Next" is left. */
  private done = false;
  /** The first try at this question was wrong, so it does not count as right any more. */
  private missed = false;
  private session: WaitSession | null = null;
  private active = false;
  private heard = false;
  /** A line about a stage that was just opened, shown with the progress. */
  private progressNote = '';

  constructor(deps: EarViewDeps) {
    this.deps = deps;
    this.rng = deps.random ?? seededRng(Math.floor(Math.random() * 2 ** 31));
    this.element = make('section', 'ear-view');
    this.element.id = 'earView';
    this.element.dataset.views = 'ear';

    const header = make('header', 'view-header');
    this.title = make('h2', 'view-title');
    this.subtitle = make('p', 'view-subtitle');
    header.append(createBackButton(deps.onBack), this.title, this.subtitle);

    this.stages = make('div', 'ear-stages');
    this.stages.setAttribute('role', 'group');
    this.prompt = make('p', 'ear-prompt');
    this.hear = make('button', 'ear-hear');
    this.hear.type = 'button';
    this.hear.addEventListener('click', () => void this.play());
    this.choices = make('div', 'ear-choices');
    this.keyboardHolder = make('div', 'ear-keyboard');
    this.keyboardHolder.setAttribute('dir', 'ltr');
    this.melody = make('p', 'ear-melody');
    this.feedback = make('p', 'ear-feedback');
    this.feedback.setAttribute('role', 'status');
    this.next = make('button', 'ear-next');
    this.next.type = 'button';
    this.next.hidden = true;
    this.next.addEventListener('click', () => void this.ask(true));
    this.progress = make('p', 'ear-progress');

    const card = make('div', 'ear-card');
    card.append(this.prompt, this.hear, this.choices, this.keyboardHolder, this.melody, this.feedback, this.next);
    this.element.append(header, this.stages, card, this.progress);

    deps.hub.onNoteOn.on(({ noteName }) => {
      if (this.active) this.played(noteName, false);
    });

    const saved = Number(storageGet(STAGE_KEY));
    this.stage = this.allowed(saved) ? saved : 1;
    this.refresh();
  }

  private allowed(stage: number): boolean {
    return Number.isInteger(stage) && stage >= 1 && stage <= EAR_STAGES && stage <= this.deps.stats.getMaxStage();
  }

  /** The question on the screen (for tests and the end-to-end hook). */
  currentQuestion(): EarQuestion | null {
    return this.question;
  }

  /** The screen opens: the first question of the stage is ready, and waits to be heard. */
  activate(): void {
    this.active = true;
    if (!this.question) void this.ask(false);
    this.refresh();
  }

  /** The screen closes: nothing keeps playing, and notes from a MIDI keyboard are not taken any more. */
  deactivate(): void {
    this.active = false;
    this.deps.voice.stopAll();
  }

  /** Writes the texts again, after the language or the note names changed. */
  refresh(): void {
    this.title.textContent = t('ear.title');
    this.subtitle.textContent = t('ear.subtitle');
    this.buildStages();
    this.renderQuestion();
    this.renderProgress();
  }

  // ----- stages -----

  private buildStages(): void {
    const max = this.deps.stats.getMaxStage();
    this.stages.replaceChildren();
    this.stages.setAttribute('aria-label', t('ear.title'));
    for (let n = 1; n <= EAR_STAGES; n++) {
      const locked = n > max;
      const chip = make('button', 'ear-stage');
      chip.type = 'button';
      chip.dataset.stage = String(n);
      chip.disabled = locked;
      chip.setAttribute('aria-pressed', String(n === this.stage));
      chip.setAttribute('aria-label', locked ? t('ear.stageLocked', { n: formatNumber(n) }) : `${t('ear.stage', { n: formatNumber(n) })}: ${t(`ear.stage.${n}` as MessageKey)}`);
      const number = make('span', 'ear-stage-n');
      number.textContent = formatNumber(n);
      const name = make('span', 'ear-stage-name');
      name.textContent = t(`ear.stage.${n}` as MessageKey);
      chip.append(number, name);
      chip.addEventListener('click', () => this.chooseStage(n));
      this.stages.appendChild(chip);
    }
  }

  private chooseStage(stage: number): void {
    if (!this.allowed(stage) || stage === this.stage) return;
    this.stage = stage;
    storageSet(STAGE_KEY, String(stage));
    this.deps.voice.stopAll();
    this.previous = null;
    void this.ask(false);
    this.refresh();
  }

  // ----- a question -----

  private async ask(autoplay: boolean): Promise<void> {
    this.question = makeQuestion(this.stage, this.rng, this.previous);
    this.previous = this.question;
    this.done = false;
    this.missed = false;
    this.heard = false;
    this.session = this.question.stage === 5 ? new WaitSession(this.question.notes.map((note) => ({ pitches: [note] }))) : null;
    this.feedback.textContent = '';
    this.feedback.dataset.tone = '';
    this.next.hidden = true;
    this.renderQuestion();
    // test hook (see CLAUDE.md): the end-to-end tests read what is asked
    const detail = { stage: this.question.stage, kind: this.question.kind, notes: this.question.notes, answer: 'answer' in this.question ? this.question.answer : null };
    (window as unknown as { __earQuestion?: unknown }).__earQuestion = detail;
    document.dispatchEvent(new CustomEvent('trainer:ear', { detail }));
    if (autoplay) await this.play();
  }

  private async play(): Promise<void> {
    const question = this.question;
    if (!question) return;
    const { voice } = this.deps;
    if (!(await voice.ready())) {
      this.setFeedback(t('ear.noSound'), 'bad');
      return;
    }
    voice.stopAll();
    this.heard = true;
    for (const step of question.plan) for (const note of step.notes) voice.play(note, step.length, step.at + 0.05);
    this.renderQuestion();
  }

  private renderQuestion(): void {
    const question = this.question;
    this.hear.textContent = t(this.heard ? 'ear.hearAgain' : 'ear.hear');
    this.hear.setAttribute('data-heard', String(this.heard));
    this.choices.replaceChildren();
    this.keyboardHolder.replaceChildren();
    this.melody.textContent = '';
    if (!question) return;
    this.prompt.textContent = t(this.promptKey(question));

    if (question.stage === 5) {
      this.keyboardHolder.appendChild(
        buildKeysPicture({
          from: 'C4',
          to: 'C5',
          names: 'white',
          formatName: (note) => this.deps.formatName(note),
          formatMark: (text) => text,
          onPlay: (note) => this.played(note, true),
          ariaLabel: t('ear.keyboard'),
        }),
      );
      if (question.kind === 'playMelody') this.renderMelodyProgress();
      return;
    }

    const labelOf = (choice: string): string => {
      if (question.kind === 'higher') return t(`ear.answer.${choice}` as MessageKey);
      if (question.kind === 'interval') return t(`ear.interval.${choice}` as MessageKey);
      return t(`ear.chord.${choice}` as MessageKey);
    };
    for (const choice of question.choices as readonly string[]) {
      const button = make('button', 'ear-choice');
      button.type = 'button';
      button.dataset.choice = choice;
      button.textContent = labelOf(choice);
      button.disabled = this.done;
      button.addEventListener('click', () => this.choose(choice));
      this.choices.appendChild(button);
    }
  }

  private promptKey(question: EarQuestion): MessageKey {
    switch (question.kind) {
      case 'higher':
        return 'ear.prompt.higher';
      case 'interval':
        return question.together ? 'ear.prompt.intervalTogether' : 'ear.prompt.interval';
      case 'chord':
        return 'ear.prompt.chord';
      case 'playNote':
        return 'ear.prompt.playNote';
      case 'playMelody':
        return 'ear.prompt.playMelody';
    }
  }

  private renderMelodyProgress(): void {
    const question = this.question;
    if (!question || question.kind !== 'playMelody' || !this.session) return;
    const index = this.session.finished() ? question.notes.length : this.session.index() + 1;
    this.melody.textContent = t('ear.melodyProgress', { n: formatNumber(Math.min(index, question.notes.length)), total: formatNumber(question.notes.length) });
  }

  // ----- answering -----

  private choose(choice: string): void {
    const question = this.question;
    if (!question || this.done || question.stage === 5) return;
    const correct = choice === question.answer;
    this.finish(correct);
    const answerText = (this.choices.querySelector(`[data-choice="${question.answer}"]`) as HTMLElement | null)?.textContent ?? '';
    this.setFeedback(correct ? t('ear.correct') : t('ear.wrong', { answer: answerText }), correct ? 'good' : 'bad');
    for (const button of this.choices.querySelectorAll<HTMLButtonElement>('.ear-choice')) {
      button.disabled = true;
      if (button.dataset.choice === question.answer) button.dataset.state = 'right';
      else if (button.dataset.choice === choice) button.dataset.state = 'wrong';
    }
  }

  /** A note was played (on the keys of the screen, or on a MIDI keyboard) while stage 5 listens. */
  private played(note: string, fromScreen: boolean): void {
    const question = this.question;
    if (!question || question.stage !== 5 || this.done || !this.session) return;
    if (fromScreen) {
      void this.deps.voice.ready().then((ok) => ok && this.deps.voice.play(note, 0.9, 0));
    }
    const press = this.session.press(note);
    if (press.result === 'ignored') return;
    if (press.result === 'wrong') {
      this.missed = true;
      this.setFeedback(t('ear.wrongPlay', { played: this.deps.formatName(note) }), 'bad');
      return;
    }
    this.renderMelodyProgress();
    if (press.result === 'done') {
      this.finish(!this.missed);
      this.setFeedback(t('ear.correct'), 'good');
    } else {
      this.setFeedback('', '');
    }
  }

  /** The question is over: count it, check whether the next stage opens, offer the next question. */
  private finish(correct: boolean): void {
    const question = this.question;
    if (!question) return;
    this.done = true;
    this.deps.stats.record(question.key, question.stage, correct);
    this.deps.onAnswer(correct);
    this.next.textContent = t('ear.next');
    this.next.hidden = false;
    this.next.focus();
    const recent = this.deps.stats.recent(question.stage);
    if (recent.answered >= RECENT_LIMIT && recent.accuracy >= UNLOCK_ACCURACY && this.deps.stats.unlock(question.stage + 1)) {
      this.progressNote = t('ear.unlocked', { n: formatNumber(question.stage + 1) });
      this.buildStages();
    }
    this.renderProgress();
  }

  private setFeedback(text: string, tone: 'good' | 'bad' | ''): void {
    this.feedback.textContent = text;
    this.feedback.dataset.tone = tone;
  }

  private renderProgress(): void {
    const recent = this.deps.stats.recent(this.stage);
    const line = t('ear.progress', { answered: formatNumber(recent.answered), limit: formatNumber(RECENT_LIMIT), percent: percent(recent.accuracy) });
    this.progress.textContent = this.progressNote ? `${this.progressNote} ${line}` : line;
  }
}
