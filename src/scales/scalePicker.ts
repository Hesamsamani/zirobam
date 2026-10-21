import { t, type MessageKey } from '../i18n';
import { parseNoteName } from '../theory/pitch';
import { SCALES, SCALE_CATEGORIES, getScale, scalesOfCategory, type ScaleId } from '../theory/scaleCatalog';
import { searchScales, type ScaleHit } from '../theory/search';
import { spellScale } from '../theory/spell';
import { rootChipPc, type Choice } from './dictionaryState';

export interface ScalePickerDeps {
  /** A choice was made: the fields of the choice that change. */
  onChange(patch: Partial<Choice>): void;
  /** A note name without octave, as the student has chosen to read it. */
  formatName(note: string): string;
}

/** The letter of each of the twelve notes that has no sign. */
const NATURAL_LETTER: Readonly<Record<number, string>> = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/** True for a root that is a note without a sign, or a koron: the only roots the quarter-tone toggle can move. */
function isNaturalOrKoron(root: number | string): boolean {
  if (typeof root === 'number') return root in NATURAL_LETTER;
  const name = parseNoteName(root);
  return !!name && (name.alter === 0 || name.alter === -0.5);
}

const isKoron = (root: number | string): boolean => typeof root === 'string' && parseNoteName(root)?.alter === -0.5;

/** What choosing a scale does to the root: a Persian mode opens on its usual root, and a root that is a quarter tone goes back to its note for any other scale. */
function rootPatch(root: number | string, id: ScaleId): Partial<Choice> {
  const persian = getScale(id).persian;
  if (persian) return { root: persian.defaultRoot };
  const quarter = typeof root === 'string' && !Number.isInteger(parseNoteName(root)?.alter ?? 0);
  return quarter ? { root: rootChipPc(root) } : {};
}

/** The way to a scale: a search box, the groups, the scales of a group, and the root. */
export class ScalePicker {
  readonly element: HTMLElement;
  private readonly deps: ScalePickerDeps;
  private readonly search: HTMLInputElement;
  private readonly searchStatus: HTMLElement;
  private readonly categories: HTMLElement;
  private readonly scales: HTMLElement;
  private readonly rootLabel: HTMLElement;
  private readonly roots: HTMLElement;
  private readonly koron: HTMLButtonElement;
  private choice: Choice | null = null;
  private hits: ScaleHit[] = [];

  constructor(deps: ScalePickerDeps) {
    this.deps = deps;
    this.element = make('div', 'dict-picker');

    this.search = make('input', 'dict-search');
    this.search.type = 'search';
    this.search.setAttribute('autocomplete', 'off');
    this.search.setAttribute('spellcheck', 'false');
    this.search.addEventListener('input', () => this.searched());
    this.search.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (this.hits[0]) this.choose(this.hits[0]);
    });
    this.searchStatus = make('p', 'dict-search-status');
    this.searchStatus.setAttribute('role', 'status');

    this.categories = make('div', 'sc-chips dict-categories');
    this.categories.setAttribute('role', 'group');
    this.scales = make('div', 'sc-chips dict-scales');
    this.scales.setAttribute('role', 'group');
    this.rootLabel = make('p', 'dict-root-label');
    this.roots = make('div', 'sc-chips sc-roots');
    this.roots.setAttribute('role', 'group');
    this.koron = make('button', 'sc-chip dict-koron');
    this.koron.type = 'button';
    this.koron.addEventListener('click', () => this.toggleKoron());

    this.element.append(this.search, this.searchStatus, this.categories, this.scales, this.rootLabel, this.roots, this.koron);
  }

  /** Draws the picker for a choice. What was typed in the search box stays. */
  render(choice: Choice): void {
    this.choice = choice;
    this.search.setAttribute('aria-label', t('dict.search'));
    this.search.placeholder = t('dict.search.placeholder');
    this.drawCategories(choice);
    this.drawScales(choice);
    this.drawRoots(choice);
  }

  // ----- drawing -----

  private chip(text: string, pressed: boolean, onClick: () => void): HTMLButtonElement {
    const chip = make('button', 'sc-chip');
    chip.type = 'button';
    chip.textContent = text;
    chip.setAttribute('aria-pressed', String(pressed));
    chip.addEventListener('click', onClick);
    return chip;
  }

  private drawCategories(choice: Choice): void {
    this.categories.setAttribute('aria-label', t('dict.categories'));
    const chips = (['all', ...SCALE_CATEGORIES] as const).map((category) => {
      const chip = this.chip(t(category === 'all' ? 'dict.all' : (`scale.cat.${category}` as MessageKey)), choice.category === category, () => this.deps.onChange({ category }));
      chip.dataset.category = category;
      return chip;
    });
    this.categories.replaceChildren(...chips);
  }

  private drawScales(choice: Choice): void {
    this.scales.setAttribute('aria-label', t('dict.scalesList'));
    const query = this.search.value.trim();
    if (query) {
      this.hits = searchScales(query);
      this.searchStatus.textContent = this.hits.length > 0 ? t('dict.search.found', { count: this.hits.length }) : t('dict.search.none', { query });
      const chips = this.hits.map((hit) => {
        const name = t(`scale.name.${hit.id}` as MessageKey);
        const chip = this.chip(hit.rootName ? `${this.deps.formatName(hit.rootName)} ${name}` : name, choice.scale === hit.id, () => this.choose(hit));
        chip.dataset.type = hit.id;
        return chip;
      });
      this.scales.replaceChildren(...chips);
      return;
    }
    this.hits = [];
    this.searchStatus.textContent = '';
    const list = choice.category === 'all' ? SCALES : scalesOfCategory(choice.category);
    const chips = list.map((scale) => {
      const chip = this.chip(t(`scale.name.${scale.id}` as MessageKey), choice.scale === scale.id, () => this.deps.onChange({ scale: scale.id, ...rootPatch(choice.root, scale.id) }));
      chip.dataset.type = scale.id;
      return chip;
    });
    this.scales.replaceChildren(...chips);
  }

  private drawRoots(choice: Choice): void {
    this.rootLabel.textContent = t('dict.root');
    this.roots.setAttribute('aria-label', t('dict.root'));
    const pressed = rootChipPc(choice.root);
    const chips = Array.from({ length: 12 }, (_, pc) => {
      const chip = this.chip(this.deps.formatName(spellScale(pc, choice.scale).root), pc === pressed, () => this.pressedRoot(pc));
      chip.dataset.root = String(pc);
      return chip;
    });
    this.roots.replaceChildren(...chips);
    this.koron.textContent = t('dict.root.koron');
    this.koron.title = t('dict.root.koronHint');
    this.koron.disabled = !isNaturalOrKoron(choice.root);
    this.koron.setAttribute('aria-pressed', String(isKoron(choice.root)));
  }

  // ----- what the student does -----

  private searched(): void {
    if (this.choice) this.drawScales(this.choice);
  }

  /** A result of the search was chosen: the scale, its group, and the root that was typed (or its usual root, for a Persian mode). */
  private choose(hit: ScaleHit): void {
    const choice = this.choice;
    if (!choice) return;
    const root = hit.rootName !== null ? { root: hit.rootName } : rootPatch(choice.root, hit.id);
    this.search.value = '';
    this.deps.onChange({ scale: hit.id, category: getScale(hit.id).category, ...root });
  }

  private pressedRoot(pc: number): void {
    const choice = this.choice;
    // with the quarter-tone toggle on, a note without a sign keeps the quarter tone
    const letter = NATURAL_LETTER[pc];
    this.deps.onChange({ root: choice && isKoron(choice.root) && letter ? `${letter}k` : pc });
  }

  private toggleKoron(): void {
    const choice = this.choice;
    if (!choice) return;
    if (isKoron(choice.root)) {
      this.deps.onChange({ root: rootChipPc(choice.root) });
    } else {
      const letter = NATURAL_LETTER[rootChipPc(choice.root)];
      if (letter) this.deps.onChange({ root: `${letter}k` });
    }
  }
}
