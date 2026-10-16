import { t, applyTranslations, formatNumber, type MessageKey } from '../i18n';
import type { NoteInputHub } from '../input/noteInput';
import { MAX_STAGE, RECENT_LIMIT } from './noteStats';
import type { AnswerResult, Clef, NameTheNoteQuiz } from './nameTheNote';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export interface LearnViewDeps {
  quiz: NameTheNoteQuiz;
  hub: NoteInputHub;
  renderNote: (pitch: string, clef: Clef, into: HTMLElement) => void;
  formatLetter: (letter: string) => string;
  autoAdvanceMs?: number;
  /** Called whenever the view closes, however it happened. */
  onClose?: () => void;
  /** What the Close button does. Without it the button just closes the view. */
  onExit?: () => void;
  /** Called after every answer to a question. */
  onAnswer?: (result: AnswerResult) => void;
  /** Opens the lessons screen. Without it there is no Lessons button. */
  onOpenLessons?: () => void;
}

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  i18nKey?: MessageKey
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  if (i18nKey) {
    el.dataset.i18n = i18nKey;
    el.textContent = t(i18nKey);
  }
  return el;
}

export class LearnView {
  readonly element: HTMLElement;
  private readonly deps: LearnViewDeps;
  private readonly quizPanel: HTMLElement;
  private readonly noteHolder: HTMLElement;
  private readonly answerButtons = new Map<string, HTMLButtonElement>();
  private readonly feedback: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly combo: HTMLElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly stageSelect: HTMLSelectElement;
  private readonly unsubscribe: Array<() => void>;
  private locked = false;
  private opened = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(deps: LearnViewDeps) {
    this.deps = deps;
    this.element = make('section', 'learn-view');
    this.element.id = 'learnView';
    this.element.hidden = true;

    // Header
    const header = make('div', 'learn-header');
    header.appendChild(make('h2', 'learn-title', 'learn.title'));
    const controls = make('div', 'learn-controls');
    this.stageSelect = make('select', 'learn-stage-select');
    this.stageSelect.id = 'learnStage';
    this.stageSelect.addEventListener('change', () => this.changeStage());
    const closeButton = make('button', 'learn-text-btn', 'learn.close');
    closeButton.type = 'button';
    closeButton.addEventListener('click', () => (this.deps.onExit ? this.deps.onExit() : this.close()));
    controls.appendChild(this.stageSelect);
    if (deps.onOpenLessons) {
      const lessonsButton = make('button', 'learn-text-btn learn-open-lessons', 'learn.lessons');
      lessonsButton.type = 'button';
      lessonsButton.addEventListener('click', () => deps.onOpenLessons?.());
      controls.appendChild(lessonsButton);
    }
    controls.appendChild(closeButton);
    header.appendChild(controls);

    // Quiz panel
    this.quizPanel = make('div', 'learn-quiz');
    this.stats = make('p', 'learn-stats');
    this.combo = make('p', 'learn-combo');
    this.combo.hidden = true;
    const card = make('div', 'learn-card');
    card.setAttribute('dir', 'ltr');
    this.noteHolder = make('div', 'learn-note');
    card.appendChild(this.noteHolder);
    const answers = make('div', 'learn-answers');
    answers.setAttribute('dir', 'ltr');
    for (const letter of LETTERS) {
      const button = make('button', 'learn-answer');
      button.type = 'button';
      button.dataset.letter = letter;
      button.addEventListener('click', () => this.answerWithLetter(letter));
      this.answerButtons.set(letter, button);
      answers.appendChild(button);
    }
    this.feedback = make('p', 'learn-feedback');
    this.feedback.setAttribute('aria-live', 'polite');
    this.nextButton = make('button', 'learn-next learn-text-btn', 'learn.next');
    this.nextButton.type = 'button';
    this.nextButton.hidden = true;
    this.nextButton.addEventListener('click', () => this.askNext());
    this.quizPanel.append(
      this.stats, this.combo, card, make('p', 'learn-prompt', 'learn.prompt'), answers,
      this.feedback, this.nextButton, make('p', 'learn-hint', 'learn.hint')
    );

    this.element.append(header, this.quizPanel);
    this.element.dataset.panel = 'quiz';

    this.unsubscribe = [deps.hub.onNoteOn.on(({ noteName }) => this.handlePlayed(noteName))];
    this.refresh();
  }

  isOpen(): boolean {
    return this.opened;
  }

  open(): void {
    this.opened = true;
    this.element.hidden = false;
    this.showQuiz();
  }

  close(): void {
    this.opened = false;
    this.element.hidden = true;
    this.clearTimer();
    this.deps.onClose?.();
  }

  dispose(): void {
    this.clearTimer();
    for (const off of this.unsubscribe) off();
  }

  /** Re-apply translations and labels after the language or the note-name system changes. */
  refresh(): void {
    applyTranslations(this.element);
    for (const [letter, button] of this.answerButtons) button.textContent = this.deps.formatLetter(letter);
    this.refreshStageSelect();
    this.refreshStats();
  }

  // ----- quiz -----

  private showQuiz(): void {
    this.askNext();
  }

  private askNext(): void {
    this.clearTimer();
    const question = this.deps.quiz.next();
    this.locked = false;
    this.element.dataset.pitch = question.pitch;
    delete this.element.dataset.result;
    this.feedback.textContent = '';
    this.nextButton.hidden = true;
    for (const button of this.answerButtons.values()) {
      button.disabled = false;
      button.classList.remove('correct', 'wrong');
    }
    this.deps.renderNote(question.pitch, question.clef, this.noteHolder);
    this.refreshStageSelect();
    this.refreshStats();
  }

  private answerWithLetter(letter: string): void {
    if (!this.canAnswer()) return;
    this.showResult(this.deps.quiz.answerLetter(letter), letter);
  }

  private handlePlayed(noteName: string): void {
    if (!this.canAnswer()) return;
    const result = this.deps.quiz.answerPitch(noteName);
    this.showResult(result, noteName[0]);
  }

  private canAnswer(): boolean {
    return this.opened && !this.locked && this.element.dataset.panel === 'quiz' && this.deps.quiz.current() !== null;
  }

  private showResult(result: AnswerResult, chosenLetter: string): void {
    this.locked = true;
    for (const button of this.answerButtons.values()) button.disabled = true;
    this.answerButtons.get(result.expectedLetter)?.classList.add('correct');
    if (!result.correct) this.answerButtons.get(chosenLetter)?.classList.add('wrong');

    let message = result.correct
      ? t('learn.correct')
      : t('learn.wrong', { name: this.deps.formatLetter(result.expectedLetter) });
    if (result.unlockedStage) message += ` ${t('learn.unlocked', { n: result.unlockedStage })}`;
    this.feedback.textContent = message;
    this.element.dataset.result = result.correct ? 'correct' : 'wrong';
    this.refreshStageSelect();
    this.refreshStats();
    this.deps.onAnswer?.(result);

    if (result.correct) {
      this.timer = setTimeout(() => this.askNext(), this.deps.autoAdvanceMs ?? 900);
    } else {
      this.nextButton.hidden = false;
      this.nextButton.focus();
    }
  }

  private changeStage(): void {
    if (this.deps.quiz.setStage(Number(this.stageSelect.value))) this.askNext();
    else this.refreshStageSelect();
  }

  private refreshStageSelect(): void {
    const max = this.deps.quiz.getMaxStage();
    this.stageSelect.replaceChildren();
    for (let stage = 1; stage <= MAX_STAGE; stage++) {
      const option = document.createElement('option');
      option.value = String(stage);
      const name = t(`learn.stageName.${stage}` as MessageKey);
      option.textContent = stage <= max ? t('learn.stage', { n: stage, name }) : t('learn.stageLocked', { n: stage, name });
      option.disabled = stage > max;
      this.stageSelect.appendChild(option);
    }
    this.stageSelect.value = String(this.deps.quiz.getStage());
  }

  private refreshStats(): void {
    const recent = this.deps.quiz.recentAccuracy();
    this.stats.textContent =
      recent.answered >= RECENT_LIMIT
        ? t('learn.stats', { pct: Math.round(recent.accuracy * 100), n: recent.answered })
        : t('learn.noStats');
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Shows the number of right answers in a row (from 2 up). */
  setCombo(count: number): void {
    this.combo.hidden = count < 2;
    this.combo.textContent = count < 2 ? '' : t('game.combo', { n: formatNumber(count) });
  }
}
