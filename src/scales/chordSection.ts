import { formatNumber, t, type MessageKey } from '../i18n';
import type { PianoVoice } from '../playback/pianoVoice';
import { CHORD_FAMILIES } from '../theory/chordCatalog';
import { chordsOfScale, inversionsOf, type ScaleChord } from '../theory/diatonic';
import { ascendFrom, type SpelledScale } from '../theory/spell';
import type { Choice } from './dictionaryState';
import { stepsOf } from './stairs';

export interface ChordSectionDeps {
  voice: PianoVoice;
  /** A note name without octave, as the student has chosen to read it. */
  formatName(note: string): string;
  /** A filter was changed: the fields of the choice that change. */
  onChange(patch: Partial<Choice>): void;
  /** A card was pressed. Without this, the chord is played. */
  onOpen?(chord: ScaleChord): void;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/** The chords of a scale, with their filters, as a grid of cards. */
export class ChordSection {
  readonly element: HTMLElement;
  private readonly deps: ChordSectionDeps;
  private readonly title: HTMLElement;
  private readonly count: HTMLElement;
  private readonly families: HTMLElement;
  private readonly degree: HTMLSelectElement;
  private readonly primary: HTMLButtonElement;
  private readonly inversionsButton: HTMLButtonElement;
  private readonly quarterNote: HTMLElement;
  private readonly empty: HTMLElement;
  private readonly cards: HTMLElement;
  private readonly status: HTMLElement;
  /** Whether the turns of each chord are shown with it. Kept while the scale changes. */
  private inversions = false;

  constructor(deps: ChordSectionDeps) {
    this.deps = deps;
    this.element = make('section', 'dict-chords');

    const head = make('div', 'dict-chords-head');
    this.title = make('h3', 'dict-chords-title');
    this.count = make('p', 'dict-chords-count');
    head.append(this.title, this.count);

    this.families = make('div', 'sc-chips dict-families');
    this.families.setAttribute('role', 'group');
    this.degree = make('select', 'dict-degree');
    this.degree.addEventListener('change', () => this.deps.onChange({ degree: this.degree.value === '' ? null : Number(this.degree.value) }));
    this.primary = make('button', 'sc-chip dict-primary');
    this.primary.type = 'button';
    this.inversionsButton = make('button', 'sc-chip dict-inversions');
    this.inversionsButton.type = 'button';
    this.inversionsButton.addEventListener('click', () => {
      this.inversions = !this.inversions;
      this.redraw();
    });
    const filters = make('div', 'dict-filters');
    filters.append(this.degree, this.primary, this.inversionsButton);

    this.quarterNote = make('p', 'dict-chords-quarter');
    this.quarterNote.hidden = true;
    this.empty = make('p', 'dict-chords-empty');
    this.empty.hidden = true;
    this.cards = make('div', 'dict-cards');
    this.status = make('p', 'dict-chords-status');
    this.status.setAttribute('role', 'status');

    this.element.append(head, this.families, filters, this.quarterNote, this.empty, this.cards, this.status);
  }

  private scale: SpelledScale | null = null;
  private choice: Choice | null = null;

  /** Draws the chords of a scale for a choice of filters. */
  show(scale: SpelledScale, choice: Choice): void {
    this.scale = scale;
    this.choice = choice;
    this.status.textContent = '';
    this.redraw();
  }

  /** The screen was left: stop the sound. */
  deactivate(): void {
    this.deps.voice.stopAll();
  }

  private redraw(): void {
    const { scale, choice } = this;
    if (!scale || !choice) return;
    this.title.textContent = t('dict.chords.heading');
    this.drawFilters(scale, choice);
    this.drawQuarterNote(scale);

    const filter = { families: choice.family === 'all' ? undefined : [choice.family], degree: choice.degree, primaryOnly: choice.primaryOnly };
    const chords = chordsOfScale(scale, filter).flatMap((chord) => (this.inversions ? [chord, ...inversionsOf(chord)] : [chord]));
    this.count.textContent = t('dict.chords.count', { count: chords.length });
    this.empty.hidden = chords.length > 0;
    this.empty.textContent = chords.length > 0 ? '' : t('dict.chords.empty');
    this.cards.replaceChildren(...chords.map((chord) => this.card(chord)));
  }

  private drawFilters(scale: SpelledScale, choice: Choice): void {
    // only the families that have a chord in this scale
    const present = new Set(chordsOfScale(scale).map((chord) => chord.def.family));
    this.families.setAttribute('aria-label', t('dict.chords.family'));
    const chips = (['all', ...CHORD_FAMILIES.filter((family) => present.has(family))] as const).map((family) => {
      const chip = make('button', 'sc-chip');
      chip.type = 'button';
      chip.textContent = t(family === 'all' ? 'dict.all' : (`chord.family.${family}` as MessageKey));
      chip.dataset.family = family;
      chip.setAttribute('aria-pressed', String(choice.family === family));
      chip.addEventListener('click', () => this.deps.onChange({ family }));
      return chip;
    });
    this.families.replaceChildren(...chips);

    this.degree.setAttribute('aria-label', t('dict.chords.degree'));
    const options = [new Option(t('dict.chords.allDegrees'), '')];
    for (const step of stepsOf(scale)) {
      if (step.quarter) continue; // a quarter tone is no root of a chord
      options.push(new Option(t('dict.chords.degreeOption', { degree: formatNumber(step.degree), note: this.deps.formatName(step.name) }), String(step.degree)));
    }
    this.degree.replaceChildren(...options);
    this.degree.value = choice.degree === null ? '' : String(choice.degree);

    this.primary.textContent = t('dict.chords.primary');
    this.primary.setAttribute('aria-pressed', String(choice.primaryOnly));
    this.primary.onclick = () => this.deps.onChange({ primaryOnly: !choice.primaryOnly });
    this.inversionsButton.textContent = t('dict.chords.inversions');
    this.inversionsButton.setAttribute('aria-pressed', String(this.inversions));
  }

  private drawQuarterNote(scale: SpelledScale): void {
    const quarter = stepsOf(scale).filter((step) => step.quarter).length;
    this.quarterNote.hidden = quarter === 0;
    this.quarterNote.textContent = quarter === 0 ? '' : t('dict.chords.quarter', { count: formatNumber(quarter) });
  }

  /** The name of a chord as it is read: `Bbm7`, `C/E`, with the note names the student has chosen. */
  private symbolOf(chord: ScaleChord): string {
    const { formatName } = this.deps;
    return `${formatName(chord.root)}${chord.def.symbol}${chord.bass ? `/${formatName(chord.bass)}` : ''}`;
  }

  private card(chord: ScaleChord): HTMLButtonElement {
    const card = make('button', 'dict-card');
    card.type = 'button';
    card.dataset.primary = String(chord.primary);
    card.dataset.degree = String(chord.degree);
    card.dataset.chord = chord.def.id;
    card.dataset.inversion = String(chord.inversion);
    const symbol = this.symbolOf(chord);
    card.setAttribute('aria-label', t('dict.card.listen', { chord: symbol }));

    const text = (className: string, content: string): HTMLSpanElement => {
      const span = make('span', className);
      span.textContent = content;
      return span;
    };
    const meta = make('span', 'dict-card-meta');
    meta.append(text('dict-card-degree', t('dict.card.degree', { degree: formatNumber(chord.degree) })), text('dict-card-roman', chord.roman), text('dict-card-count sr-only', t('dict.card.notes', { count: formatNumber(chord.noteCount) })));
    const name = text('dict-card-symbol', symbol);
    name.setAttribute('dir', 'ltr');
    card.append(meta, name, text('dict-card-name', t(`chord.name.${chord.def.id}` as MessageKey)), text('dict-card-notes', chord.notes.map((note) => this.deps.formatName(note)).join(' · ')));
    if (chord.primary) card.append(text('dict-card-main', t('dict.card.main')));
    card.addEventListener('click', () => (this.deps.onOpen ? this.deps.onOpen(chord) : void this.hear(chord)));
    return card;
  }

  /** The notes one after the other, then all together. */
  private async hear(chord: ScaleChord): Promise<void> {
    const { voice } = this.deps;
    if (!(await voice.ready())) {
      this.status.textContent = t('ear.noSound');
      return;
    }
    voice.stopAll();
    const pitches = ascendFrom(chord.notes);
    pitches.forEach((pitch, i) => voice.play(pitch, 0.9, 0.05 + i * 0.3));
    const together = 0.05 + pitches.length * 0.3 + 0.3;
    for (const pitch of pitches) voice.play(pitch, 1.8, together);
  }
}
