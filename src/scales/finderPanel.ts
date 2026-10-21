import { t, type MessageKey } from '../i18n';
import { parseNoteName, pianoMidi, type Pitch } from '../theory/pitch';
import type { ScaleId } from '../theory/scaleCatalog';
import { findScales } from '../theory/scaleFinder';
import { spellScale } from '../theory/spell';
import { buildCircle } from './circleOfFifths';

export interface FinderDeps {
  /** A note name without octave, as the student has chosen to read it. */
  formatName(note: string): string;
  /** A scale was chosen from the results or the circle: the root (0 to 11) and the scale. */
  onChoose(root: number, scale: ScaleId): void;
}

/** The names of the twelve notes with sharps: what the chips are written with. */
const CHIPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** How many results are listed. */
const RESULTS = 24;

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/** The notes of a key press as one of the twelve notes, or null when it is not a note. */
function pitchClassOf(note: string): number | null {
  const name = parseNoteName(note);
  if (!name || name.octave === null) return null;
  return pianoMidi({ step: name.step, alter: name.alter, octave: name.octave } as Pitch) % 12;
}

/** Find a scale from its notes: choose the notes, and the scales that hold them are listed. Beside it, the circle of fifths. */
export class FinderPanel {
  readonly element: HTMLElement;
  private readonly deps: FinderDeps;
  private readonly title: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly notes: HTMLElement;
  private readonly clear: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly results: HTMLElement;
  private readonly circleTitle: HTMLElement;
  private readonly circleHint: HTMLElement;
  private readonly circle: HTMLElement;
  private readonly chosen = new Set<number>();

  constructor(deps: FinderDeps) {
    this.deps = deps;
    this.element = make('section', 'dict-finder');
    this.title = make('h3', 'fd-title');
    this.hint = make('p', 'fd-hint');
    this.notes = make('div', 'sc-chips fd-notes');
    this.notes.setAttribute('role', 'group');
    this.clear = make('button', 'sc-chip fd-clear');
    this.clear.type = 'button';
    this.clear.addEventListener('click', () => {
      this.chosen.clear();
      this.render();
    });
    this.status = make('p', 'fd-status');
    this.status.setAttribute('role', 'status');
    this.results = make('div', 'fd-results');
    this.circleTitle = make('h3', 'fd-title');
    this.circleHint = make('p', 'fd-hint');
    this.circle = make('div', 'fd-circle');
    this.element.append(this.title, this.hint, this.notes, this.clear, this.status, this.results, this.circleTitle, this.circleHint, this.circle);
    this.render();
  }

  /** The notes now chosen, as numbers from 0 to 11. */
  selected(): number[] {
    return [...this.chosen].sort((a, z) => a - z);
  }

  /** A key was pressed on the keyboard: its note is added (or taken away again if it was there). */
  keyPressed(note: string): void {
    const pc = pitchClassOf(note);
    if (pc === null) return;
    this.toggle(pc);
  }

  /** Draws the panel again, for a new language or a new way of writing the notes. */
  render(): void {
    this.title.textContent = t('find.title');
    this.hint.textContent = t('find.hint');
    this.notes.setAttribute('aria-label', t('find.notes'));
    this.notes.replaceChildren(
      ...CHIPS.map((name, pc) => {
        const chip = make('button', 'sc-chip');
        chip.type = 'button';
        chip.textContent = this.deps.formatName(name);
        chip.dataset.pc = String(pc);
        chip.setAttribute('aria-pressed', String(this.chosen.has(pc)));
        chip.addEventListener('click', () => this.toggle(pc));
        return chip;
      }),
    );
    this.clear.textContent = t('find.clear');
    this.clear.disabled = this.chosen.size === 0;
    this.drawResults();
    this.circleTitle.textContent = t('circle.title');
    this.circleHint.textContent = t('circle.hint');
    this.circle.replaceChildren(buildCircle({ formatName: this.deps.formatName, onChoose: this.deps.onChoose }));
  }

  private toggle(pc: number): void {
    if (this.chosen.has(pc)) this.chosen.delete(pc);
    else this.chosen.add(pc);
    this.render();
  }

  private drawResults(): void {
    if (this.chosen.size === 0) {
      this.status.textContent = t('find.none');
      this.results.replaceChildren();
      return;
    }
    const found = findScales([...this.chosen], RESULTS);
    this.status.textContent = found.length === 0 ? t('find.empty') : t('find.found', { count: found.length });
    this.results.replaceChildren(
      ...found.map((match) => {
        const button = make('button', 'fd-result');
        button.type = 'button';
        button.dataset.root = String(match.root);
        button.dataset.scale = match.scale;
        button.dataset.exact = String(match.exact);
        const name = make('span', 'fd-result-name');
        name.textContent = t('dict.scale.title', { root: this.deps.formatName(spellScale(match.root, match.scale).root), scale: t(`scale.name.${match.scale}` as MessageKey) });
        const fit = make('span', 'fd-result-fit');
        fit.textContent = match.exact ? t('find.exact') : t('find.more', { count: match.extra });
        button.append(name, fit);
        button.addEventListener('click', () => this.deps.onChoose(match.root, match.scale));
        return button;
      }),
    );
  }
}
