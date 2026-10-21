import { seededRng, type Rng } from '../core/rng';
import { formatNumber, t, type MessageKey } from '../i18n';
import { UNLOCK_ACCURACY } from '../learn/nameTheNote';
import { RECENT_LIMIT, type NoteStats } from '../learn/noteStats';
import { createBackButton } from '../menu/backButton';
import type { PianoVoice } from '../playback/pianoVoice';
import { SCALES, type ScaleId } from '../theory/scaleCatalog';
import { makeQuarterQuestion, QUARTER_STAGES, type QuarterAnswer, type QuarterQuestion } from './quarterEar';

export interface PersianViewDeps {
  voice: PianoVoice;
  stats: NoteStats;
  /** A note name without octave, as the student has chosen to read it. */
  formatName(note: string): string;
  /** Opens a mode in the scale dictionary. */
  openScale(root: string, scale: ScaleId): void;
  /** Opens the Persian music lessons. */
  openLessons(): void;
  onBack(): void;
  /** A question of the ear training was answered (for the rewards). */
  onAnswer?(correct: boolean): void;
  random?: Rng;
}

/** How long "Right!" stays before the next question, in milliseconds. */
const NEXT_DELAY_MS = 1300;
const LEAD_SECONDS = 0.1;

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/** The Persian music page: the twelve modes, a way into the lessons, and ear training for the quarter tones. */
export class PersianView {
  readonly id = 'persian' as const;
  readonly element: HTMLElement;
  private readonly deps: PersianViewDeps;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly draft: HTMLElement;
  private readonly lessons: HTMLButtonElement;
  private readonly modesTitle: HTMLElement;
  private readonly modes: HTMLElement;
  private readonly earTitle: HTMLElement;
  private readonly stages: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly hearButton: HTMLButtonElement;
  private readonly choices: HTMLElement;
  private readonly status: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly next: HTMLButtonElement;
  private readonly rng: Rng;

  private stage = 1;
  private question: QuarterQuestion | null = null;
  private answered = false;
  private unlockedNote = '';
  private timer: number | null = null;

  constructor(deps: PersianViewDeps) {
    this.deps = deps;
    this.rng = deps.random ?? seededRng(Math.floor(Math.random() * 2 ** 31));
    this.element = make('section', 'persian-view');
    this.element.id = 'persianView';
    this.element.dataset.views = 'persian';

    const header = make('header', 'view-header');
    this.title = make('h2', 'view-title');
    this.subtitle = make('p', 'view-subtitle');
    header.append(createBackButton(deps.onBack), this.title, this.subtitle);

    this.draft = make('p', 'dict-persian pr-draft');
    this.lessons = make('button', 'sc-hear pr-lessons');
    this.lessons.type = 'button';
    this.lessons.addEventListener('click', () => deps.openLessons());
    this.modesTitle = make('h3', 'pr-title');
    this.modes = make('div', 'pr-modes');

    this.earTitle = make('h3', 'pr-title');
    this.stages = make('div', 'sc-chips pr-stages');
    this.stages.setAttribute('role', 'group');
    this.prompt = make('p', 'pr-prompt');
    this.hearButton = make('button', 'sc-chip pr-hear');
    this.hearButton.type = 'button';
    this.hearButton.addEventListener('click', () => void this.hear());
    this.choices = make('div', 'sc-chips pr-choices');
    this.choices.setAttribute('role', 'group');
    this.status = make('p', 'pr-status');
    this.status.setAttribute('role', 'status');
    this.progress = make('p', 'pr-progress');
    this.next = make('button', 'sc-hear pr-next');
    this.next.type = 'button';
    this.next.addEventListener('click', () => this.nextQuestion());
    const ear = make('div', 'pr-ear');
    ear.append(this.earTitle, this.stages, this.prompt, this.hearButton, this.choices, this.status, this.next, this.progress);

    this.element.append(header, this.draft, this.lessons, this.modesTitle, this.modes, ear);
    this.refresh();
  }

  current(): { stage: number; question: QuarterQuestion | null } {
    return { stage: this.stage, question: this.question };
  }

  activate(): void {
    if (!this.question) this.nextQuestion(false);
    this.refresh();
  }

  deactivate(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.deps.voice.stopAll();
  }

  change(): void {
    // the address of this screen has no name
  }

  refresh(): void {
    this.title.textContent = t('persian.title');
    this.subtitle.textContent = t('persian.subtitle');
    this.draft.textContent = t('persian.draft');
    this.lessons.textContent = t('persian.lessons');
    this.modesTitle.textContent = t('persian.modes');
    this.earTitle.textContent = t('persian.ear');
    this.drawModes();
    this.drawStages();
    this.drawQuestion();
  }

  // ----- the modes -----

  private drawModes(): void {
    this.modes.replaceChildren(
      ...SCALES.filter((def) => def.persian).map((def) => {
        const info = def.persian!;
        const card = make('button', 'pr-mode');
        card.type = 'button';
        card.dataset.scale = def.id;
        const name = t(`scale.name.${def.id}` as MessageKey);
        const root = this.deps.formatName(info.defaultRoot);
        card.setAttribute('aria-label', t('persian.openMode', { mode: name, root }));
        const title = make('span', 'pr-mode-name');
        title.textContent = name;
        const rootText = make('span', 'pr-mode-root');
        rootText.setAttribute('dir', 'ltr');
        rootText.textContent = root;
        const kind = make('span', 'pr-mode-kind');
        kind.textContent = info.family === 'dastgah' ? t('persian.dastgah') : t('persian.avaz', { parent: t(`scale.name.${info.parent}` as MessageKey) });
        card.append(title, rootText, kind);
        card.addEventListener('click', () => this.deps.openScale(info.defaultRoot, def.id));
        return card;
      }),
    );
  }

  // ----- the ear training -----

  private drawStages(): void {
    const max = this.deps.stats.getMaxStage();
    this.stages.setAttribute('aria-label', t('persian.stages'));
    this.stages.replaceChildren(
      ...Array.from({ length: QUARTER_STAGES }, (_, i) => i + 1).map((stage) => {
        const chip = make('button', 'sc-chip');
        chip.type = 'button';
        chip.textContent = t('persian.stage', { n: formatNumber(stage) });
        chip.dataset.stage = String(stage);
        chip.disabled = stage > max;
        chip.setAttribute('aria-pressed', String(this.stage === stage));
        chip.addEventListener('click', () => {
          this.stage = stage;
          this.question = null;
          this.nextQuestion(true);
          this.refresh();
        });
        return chip;
      }),
    );
  }

  private nextQuestion(play = true): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.question = makeQuarterQuestion(this.stage, this.rng, this.question);
    this.answered = false;
    this.unlockedNote = '';
    this.status.textContent = '';
    this.status.dataset.tone = '';
    this.drawQuestion();
    if (play) void this.hear();
  }

  private drawQuestion(): void {
    const q = this.question;
    this.hearButton.textContent = t('persian.hear');
    this.next.textContent = t('persian.next');
    this.next.hidden = !this.answered;
    if (!q) {
      this.prompt.textContent = '';
      this.choices.replaceChildren();
      return;
    }
    this.prompt.textContent = t(`persian.q.${q.kind}` as MessageKey);
    this.choices.replaceChildren(
      ...q.choices.map((answer) => {
        const button = make('button', 'sc-chip pr-choice');
        button.type = 'button';
        button.dataset.answer = answer;
        button.textContent = t(`persian.a.${answer}` as MessageKey);
        button.disabled = this.answered;
        button.addEventListener('click', () => this.judge(answer));
        return button;
      }),
    );
    const recent = this.deps.stats.recent(q.stage);
    this.progress.textContent = [
      t('persian.progress', { answered: formatNumber(Math.min(recent.answered, RECENT_LIMIT)), limit: formatNumber(RECENT_LIMIT), percent: `${formatNumber(Math.round(recent.accuracy * 100))}%` }),
      this.unlockedNote,
    ]
      .filter(Boolean)
      .join(' ');
  }

  private async hear(): Promise<void> {
    const q = this.question;
    if (!q) return;
    if (!(await this.deps.voice.ready())) {
      this.status.textContent = t('persian.noSound');
      return;
    }
    this.deps.voice.stopAll();
    for (const sound of q.plan) this.deps.voice.play(sound.note, sound.seconds, LEAD_SECONDS + sound.at);
  }

  private judge(answer: QuarterAnswer): void {
    const q = this.question;
    if (!q || this.answered) return;
    const right = answer === q.answer;
    this.answered = true;
    this.deps.stats.record(q.key, q.stage, right);
    this.deps.onAnswer?.(right);
    const recent = this.deps.stats.recent(q.stage);
    if (right && recent.answered >= RECENT_LIMIT && recent.accuracy >= UNLOCK_ACCURACY && this.deps.stats.unlock(q.stage + 1)) {
      this.unlockedNote = t('persian.unlocked', { n: formatNumber(q.stage + 1) });
      this.drawStages();
    }
    this.status.dataset.tone = right ? 'good' : 'bad';
    this.status.textContent = right ? t('persian.right') : t('persian.wrong', { answer: t(`persian.a.${q.answer}` as MessageKey) });
    this.drawQuestion();
    if (right) this.timer = window.setTimeout(() => this.nextQuestion(), NEXT_DELAY_MS);
  }
}
