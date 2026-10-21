import { t, type MessageKey } from '../i18n';
import type { NoteInputHub } from '../input/noteInput';
import type { NotationToolkit } from '../learn/noteCard';
import { createBackButton } from '../menu/backButton';
import type { PianoVoice } from '../playback/pianoVoice';
import { getScale } from '../theory/scaleCatalog';
import { spellScale, type SpelledScale } from '../theory/spell';
import { ChordSection } from './chordSection';
import { formatParam, parseParam, readChoice, rootChipPc, writeChoice, type Choice, type ChoiceStorage, type Tab } from './dictionaryState';
import { ScalePanel } from './scalePanel';
import { ScalePicker } from './scalePicker';

export interface ScalesViewDeps {
  toolkit: NotationToolkit;
  voice: PianoVoice;
  hub: NoteInputHub;
  /** A note name, with or without an octave, as the student has chosen to read it. */
  formatName(note: string): string;
  onBack(): void;
  /** A scale was played along to the end (for the rewards). */
  onPlayed(): void;
  /** A key was pressed while playing along: the note the scale asked for, and whether the key was right. */
  onAnswer?(note: string, correct: boolean): void;
  /** Puts the root and the scale into the address (`d-shur`). Without this, the address is changed in place. */
  writeAddress?(param: string): void;
  /** Where the choice is kept; the browser's, without this. */
  storage?: ChoiceStorage;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/** Changes the address without a new step in the history, so that Back still leaves the screen. */
function replaceAddress(param: string): void {
  history.replaceState(null, '', `#/scales/${param}`);
}

/** The scale and chord dictionary: pick a scale, see and hear it, and find the chords that belong to it. */
export class ScalesView {
  readonly element: HTMLElement;
  private readonly deps: ScalesViewDeps;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly aside: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly tabs: HTMLElement;
  private readonly picker: ScalePicker;
  private readonly panel: ScalePanel;
  private readonly chords: ChordSection;

  private choice: Choice;
  private spelled: SpelledScale;
  private active = false;

  constructor(deps: ScalesViewDeps) {
    this.deps = deps;
    this.choice = readChoice(deps.storage);
    this.spelled = this.spell(this.choice);

    this.element = make('section', 'scales-view');
    this.element.id = 'scalesView';
    this.element.dataset.views = 'scales';

    const header = make('header', 'view-header');
    this.title = make('h2', 'view-title');
    this.subtitle = make('p', 'view-subtitle');
    header.append(createBackButton(deps.onBack), this.title, this.subtitle);

    this.picker = new ScalePicker({ onChange: (patch) => this.set(patch), formatName: deps.formatName });
    this.aside = make('aside', 'dict-aside');
    this.aside.id = 'dictAside';
    this.aside.dataset.open = 'false';
    this.toggle = make('button', 'dict-toggle');
    this.toggle.type = 'button';
    this.toggle.setAttribute('aria-controls', this.aside.id);
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.addEventListener('click', () => this.setAsideOpen(this.aside.dataset.open !== 'true'));
    this.aside.append(this.toggle, this.picker.element);

    this.tabs = make('div', 'sc-tabs');
    this.tabs.setAttribute('role', 'group');
    this.panel = new ScalePanel({
      toolkit: deps.toolkit,
      voice: deps.voice,
      formatName: deps.formatName,
      onPlayed: deps.onPlayed,
      onAnswer: deps.onAnswer,
      onLabels: (labels) => this.set({ labels }),
    });
    this.chords = new ChordSection({ voice: deps.voice, formatName: deps.formatName, onChange: (patch) => this.set(patch) });

    const main = make('div', 'dict-main');
    main.append(this.tabs, this.panel.element, this.chords.element);
    const layout = make('div', 'dict-layout');
    layout.append(this.aside, main);
    this.element.append(header, layout);

    deps.hub.onNoteOn.on(({ noteName }) => {
      if (this.active && this.choice.tab === 'scales') this.panel.keyPressed(noteName);
    });
    this.refresh();
  }

  /** What is on the screen (for tests and the end-to-end hook). */
  current(): { tab: Tab; spelled: SpelledScale; along: boolean } {
    return { tab: this.choice.tab, spelled: this.spelled, along: this.panel.current().along };
  }

  /** The screen is shown. An address such as `d-shur` chooses the scale it names. */
  activate(param: string | null = null): void {
    this.active = true;
    this.panel.activate();
    const named = param ? parseParam(param) : null;
    if (named) this.apply(named);
    else this.refresh();
  }

  deactivate(): void {
    this.active = false;
    this.panel.deactivate();
    this.chords.deactivate();
  }

  /** The address changed while the screen was open. An address that names nothing changes nothing. */
  applyParam(param: string | null): void {
    const named = param ? parseParam(param) : null;
    if (named) this.apply(named);
  }

  /** Draws the screen again, for a new language or a new way of writing the notes. */
  refresh(): void {
    this.title.textContent = t('dict.title');
    this.subtitle.textContent = t('dict.subtitle');
    this.spelled = this.spell(this.choice);
    this.picker.render(this.choice);
    this.toggle.textContent = this.summary();
    this.drawTabs();
    const scalesTab = this.choice.tab === 'scales';
    this.panel.element.hidden = !scalesTab;
    this.chords.element.hidden = scalesTab;
    if (scalesTab) this.panel.show(this.spelled, this.choice.labels);
    else this.chords.show(this.spelled, this.choice);
  }

  // ----- the choice -----

  /** The scale of a choice. A root that cannot be written (it would need a triple sign) is taken as its note of the piano. */
  private spell(choice: Choice): SpelledScale {
    try {
      return spellScale(choice.root, choice.scale);
    } catch {
      return spellScale(rootChipPc(choice.root), choice.scale);
    }
  }

  private summary(): string {
    return t('dict.scale.title', { root: this.deps.formatName(this.spelled.root), scale: t(`scale.name.${this.choice.scale}` as MessageKey) });
  }

  private set(patch: Partial<Choice>): void {
    this.deps.voice.stopAll();
    this.choice = { ...this.choice, ...patch };
    writeChoice(this.choice, this.deps.storage);
    this.refresh();
    if ('scale' in patch) this.setAsideOpen(false);
    // the address holds the root and the scale, nothing else
    if (this.active && ('root' in patch || 'scale' in patch)) (this.deps.writeAddress ?? replaceAddress)(formatParam(this.spelled.root, this.choice.scale));
  }

  /** The scale an address named: no new address is written, it is the address that changed. */
  private apply(named: { root: string; scale: Choice['scale'] }): void {
    this.choice = { ...this.choice, root: named.root, scale: named.scale, category: getScale(named.scale).category };
    writeChoice(this.choice, this.deps.storage);
    this.refresh();
  }

  // ----- the parts -----

  private drawTabs(): void {
    this.tabs.replaceChildren(
      ...(['scales', 'chords'] as const).map((tab) => {
        const button = make('button', 'sc-chip sc-tab');
        button.type = 'button';
        button.textContent = t(`dict.tab.${tab}` as MessageKey);
        button.dataset.tab = tab;
        button.setAttribute('aria-pressed', String(this.choice.tab === tab));
        button.addEventListener('click', () => this.set({ tab }));
        return button;
      }),
    );
  }

  /** On a phone the picker is folded away behind the button that names the scale. */
  private setAsideOpen(open: boolean): void {
    this.aside.dataset.open = String(open);
    this.toggle.setAttribute('aria-expanded', String(open));
  }
}
