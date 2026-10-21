import { downloadBytes } from '../backup/download';
import { formatNumber, t, type MessageKey } from '../i18n';
import { freshSeed } from '../core/rng';
import type { NotationToolkit } from '../learn/noteCard';
import { renderStaffPicture } from '../lessons/staffPicture';
import { createBackButton } from '../menu/backButton';
import type { PianoVoice } from '../playback/pianoVoice';
import { chordSymbol } from '../scales/chordSymbol';
import { DEFAULT_CHOICE, spellChoice, type Choice, type ChoiceStorage } from '../scales/dictionaryState';
import { ScalePicker } from '../scales/scalePicker';
import { MAX_TITLE, type SongDraft } from '../songs/songMaker';
import { buildMidiFile, midiFileName } from '../theory/midiExport';
import { showNotice } from '../ui/notice';
import {
  BAR_CHOICES,
  BPM_MAX,
  BPM_MIN,
  CONTOURS,
  DEFAULT_STATE,
  DENSITIES,
  FEELS,
  OCTAVES,
  RANGES,
  SEED_MAX,
  keepConsistent,
  queryOf,
  readSettings,
  stateFromQuery,
  writeSettings,
  type GenTab,
  type GeneratorState,
} from './generatorState';
import { buildPiece } from './pieceBuilder';
import { planPlayback } from './playPlan';
import { METER_IDS } from './rhythmCells';
import { barsOfSpec, pieceMidiSpec, pieceSpec, pieceXml, songDraftOf, type GeneratedPiece } from './scoreXml';
import { STYLE_IDS } from './styles';

export interface GeneratorViewDeps {
  toolkit: NotationToolkit;
  voice: PianoVoice;
  /** A note name, with or without an octave, as the student has chosen to read it. */
  formatName(note: string): string;
  onBack(): void;
  /** Opens the piece on the practice stand. */
  practise(xml: string, title: string): void;
  /** Saves the tune as a song of "Write a song" and opens it there; false when that did not work. */
  openInMaker(draft: SongDraft): Promise<boolean>;
  /** The query of the address, without the question mark. The browser's address without this. */
  readAddress?(): string;
  /** Puts the query into the address without a new step in the history. */
  writeAddress?(query: string): void;
  storage?: ChoiceStorage;
  download?(fileName: string, bytes: Uint8Array): void;
  notify?(text: string): void;
  /** A new seed. A random one without this. */
  newSeed?(): number;
}

/** Bars drawn on a line of the staff. */
const BARS_PER_LINE = 4;
/** Seconds before the first note, so that a click is not lost. */
const LEAD_IN = 0.1;

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

function browserQuery(): string {
  const at = window.location.hash.indexOf('?');
  return at < 0 ? '' : window.location.hash.slice(at + 1);
}

/** The music maker: choose a scale and a style, and a progression (or a melody) is made, drawn, played and kept. */
export class GeneratorView {
  readonly id = 'generator' as const;
  readonly element: HTMLElement;
  private readonly deps: GeneratorViewDeps;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly aside: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly picker: ScalePicker;
  private readonly tabs: HTMLElement;
  private readonly controls: HTMLElement;
  private readonly summary: HTMLElement;
  private readonly problem: HTMLElement;
  private readonly ribbon: HTMLElement;
  private readonly score: HTMLElement;
  private readonly actions: HTMLElement;
  private readonly status: HTMLElement;

  private state: GeneratorState;
  private piece: GeneratedPiece | null = null;
  private active = false;
  private playing = false;
  private timers: number[] = [];

  constructor(deps: GeneratorViewDeps) {
    this.deps = deps;
    this.state = { ...DEFAULT_STATE, ...readSettings(deps.storage), seed: (deps.newSeed ?? freshSeed)() };

    this.element = make('section', 'generator-view');
    this.element.id = 'generatorView';
    this.element.dataset.views = 'generator';

    const header = make('header', 'view-header');
    this.title = make('h2', 'view-title');
    this.subtitle = make('p', 'view-subtitle');
    header.append(createBackButton(deps.onBack), this.title, this.subtitle);

    this.picker = new ScalePicker({ onChange: (patch) => this.set({ ...(patch.root !== undefined ? { root: patch.root } : {}), ...(patch.scale ? { scale: patch.scale } : {}), ...(patch.category ? { category: patch.category } : {}) }), formatName: deps.formatName });
    this.aside = make('aside', 'dict-aside');
    this.aside.dataset.open = 'false';
    this.toggle = make('button', 'dict-toggle');
    this.toggle.type = 'button';
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.addEventListener('click', () => this.setAsideOpen(this.aside.dataset.open !== 'true'));
    this.aside.append(this.toggle, this.picker.element);

    this.tabs = make('div', 'sc-tabs gen-tabs');
    this.tabs.setAttribute('role', 'group');
    this.controls = make('div', 'gen-controls');
    this.summary = make('h3', 'gen-summary');
    this.problem = make('p', 'gen-problem');
    this.problem.setAttribute('role', 'status');
    this.ribbon = make('div', 'gen-ribbon');
    this.score = make('div', 'gen-score');
    this.actions = make('div', 'sc-actions gen-actions');
    this.status = make('p', 'gen-status');
    this.status.setAttribute('role', 'status');

    const main = make('div', 'dict-main');
    main.append(this.tabs, this.controls, this.summary, this.problem, this.ribbon, this.actions, this.status, this.score);
    const layout = make('div', 'dict-layout');
    layout.append(this.aside, main);
    this.element.append(header, layout);
    this.render();
  }

  /** What is on the screen (for tests). */
  current(): { state: GeneratorState; piece: GeneratedPiece | null } {
    return { state: this.state, piece: this.piece };
  }

  /** The screen is shown. What the address says is taken, and the address then says what is shown. */
  activate(): void {
    this.active = true;
    this.state = stateFromQuery((this.deps.readAddress ?? browserQuery)(), this.state);
    this.render();
    this.writeAddress();
  }

  deactivate(): void {
    this.active = false;
    this.stopSound();
  }

  /** The address changed while the screen was open (the Back button, a pasted link). */
  change(): void {
    if (!this.active) return;
    const next = stateFromQuery((this.deps.readAddress ?? browserQuery)(), this.state);
    if (queryOf(next) === queryOf(this.state)) return;
    this.stopSound();
    this.state = next;
    this.render();
  }

  /** Draws the screen again, for a new language or a new way of writing the notes. */
  refresh(): void {
    this.render();
  }

  // ----- the state -----

  private set(patch: Partial<GeneratorState>): void {
    this.stopSound();
    this.state = keepConsistent({ ...this.state, ...patch });
    writeSettings(this.state, this.deps.storage);
    this.render();
    if (this.active) this.writeAddress();
  }

  private writeAddress(): void {
    const query = queryOf(this.state);
    (this.deps.writeAddress ?? ((q) => history.replaceState(null, '', `#/generator?${q}`)))(query);
  }

  private setAsideOpen(open: boolean): void {
    this.aside.dataset.open = String(open);
    this.toggle.setAttribute('aria-expanded', String(open));
  }

  // ----- drawing -----

  private scaleTitle(): string {
    const scale = spellChoice(this.state.root, this.state.scale);
    return t('dict.scale.title', { root: this.deps.formatName(scale.root), scale: t(`scale.name.${this.state.scale}` as MessageKey) });
  }

  private render(): void {
    const { state } = this;
    this.title.textContent = t('gen.title');
    this.subtitle.textContent = t('gen.subtitle');
    this.picker.render({ ...DEFAULT_CHOICE, root: state.root, scale: state.scale, category: state.category } satisfies Choice);
    this.toggle.textContent = this.scaleTitle();

    const result = buildPiece(state, `${this.scaleTitle()} ${t(`gen.style.${state.style}` as MessageKey)}`.slice(0, MAX_TITLE));
    this.piece = result.ok ? result.piece : null;
    this.drawTabs();
    this.drawControls();
    this.problem.hidden = result.ok;
    this.problem.textContent = result.ok ? '' : t('gen.noChords');
    this.status.textContent = '';
    this.drawSummary();
    this.drawRibbon();
    this.drawActions();
    // the staff is the costly part: it is not drawn while the screen is hidden (the shell hides it with this class), and is when it is shown
    if (this.element.classList.contains('view-hidden')) this.score.replaceChildren();
    else this.drawScore();
  }

  private chip(text: string, pressed: boolean, data: Record<string, string>, onClick: () => void): HTMLButtonElement {
    const chip = make('button', 'sc-chip');
    chip.type = 'button';
    chip.textContent = text;
    chip.setAttribute('aria-pressed', String(pressed));
    for (const [name, value] of Object.entries(data)) chip.dataset[name] = value;
    chip.addEventListener('click', onClick);
    return chip;
  }

  private group(label: string, name: string, chips: HTMLElement[], note?: string): HTMLElement {
    const group = make('div', `gen-group gen-group-${name}`);
    const heading = make('span', 'gen-label');
    heading.textContent = label;
    const row = make('div', 'sc-chips');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', label);
    row.append(...chips);
    group.append(heading, row);
    if (note) {
      const hint = make('p', 'gen-note');
      hint.textContent = note;
      group.append(hint);
    }
    return group;
  }

  private drawTabs(): void {
    this.tabs.setAttribute('aria-label', t('gen.tabs'));
    this.tabs.replaceChildren(
      ...(['prog', 'melody'] as const).map((tab: GenTab) => {
        const button = this.chip(t(`gen.tab.${tab}` as MessageKey), this.state.tab === tab, { tab }, () => this.set({ tab }));
        button.classList.add('sc-tab');
        return button;
      }),
    );
  }

  private drawControls(): void {
    const { state } = this;
    const groups: HTMLElement[] = [];

    groups.push(
      this.group(
        t('gen.style'),
        'style',
        STYLE_IDS.map((style) => this.chip(t(`gen.style.${style}` as MessageKey), state.style === style, { style }, () => this.set({ style }))),
      ),
      this.group(
        t('gen.bars'),
        'bars',
        BAR_CHOICES.map((bars) => this.chip(formatNumber(bars), state.bars === bars, { bars: String(bars) }, () => this.set({ bars }))),
      ),
    );

    if (state.tab === 'melody') {
      groups.push(
        this.group(
          t('gen.over'),
          'over',
          (['scale', 'progression'] as const).map((over) =>
            this.chip(t(`gen.over.${over}` as MessageKey), state.over === over, { over }, () => this.set(over === 'progression' ? { over, meter: '4/4' } : { over })),
          ),
          t('gen.over.note'),
        ),
        this.group(
          t('gen.meter'),
          'meter',
          METER_IDS.map((meter) => this.chip(meter.replace(/\d/g, (d) => formatNumber(Number(d))), state.meter === meter, { meter: meter.replace('/', '') }, () => this.set({ meter }))),
        ),
        this.group(
          t('gen.density'),
          'density',
          DENSITIES.map((density) => this.chip(t(`gen.density.${density}` as MessageKey), state.density === density, { density }, () => this.set({ density }))),
        ),
        this.group(
          t('gen.feel'),
          'feel',
          FEELS.map((feel) => this.chip(t(`gen.feel.${feel}` as MessageKey), state.feel === feel, { feel }, () => this.set({ feel }))),
        ),
        this.group(
          t('gen.contour'),
          'contour',
          CONTOURS.map((contour) => this.chip(t(`gen.contour.${contour}` as MessageKey), state.contour === contour, { contour }, () => this.set({ contour }))),
        ),
        this.group(
          t('gen.range'),
          'range',
          RANGES.map((range) => this.chip(t(`gen.range.${range}` as MessageKey), state.range === range, { range }, () => this.set({ range }))),
        ),
        this.group(
          t('gen.octave'),
          'octave',
          OCTAVES.map((octave) => this.chip(formatNumber(octave), state.octave === octave, { octave: String(octave) }, () => this.set({ octave }))),
        ),
      );
    }
    groups.push(this.seedAndTempo());
    this.controls.replaceChildren(...groups);
  }

  /** The seed, a button for a new piece, and the tempo. */
  private seedAndTempo(): HTMLElement {
    const { state } = this;
    const row = make('div', 'gen-group gen-group-seed');

    const seedLabel = make('label', 'gen-field');
    const seedText = make('span', 'gen-label');
    seedText.textContent = t('gen.seed');
    const seed = make('input', 'gen-seed');
    seed.type = 'text';
    seed.inputMode = 'numeric';
    seed.value = String(state.seed);
    seed.title = t('gen.seed.hint');
    seed.setAttribute('dir', 'ltr');
    seed.addEventListener('change', () => {
      const value = /^\d+$/.test(seed.value.trim()) ? Number(seed.value.trim()) : 0;
      if (value >= 1 && value <= SEED_MAX) this.set({ seed: value });
      else seed.value = String(this.state.seed);
    });
    seedLabel.append(seedText, seed);

    const fresh = make('button', 'sc-chip gen-new');
    fresh.type = 'button';
    fresh.textContent = t('gen.seed.new');
    fresh.addEventListener('click', () => this.set({ seed: (this.deps.newSeed ?? freshSeed)() }));

    const bpmLabel = make('label', 'gen-field');
    const bpmText = make('span', 'gen-label');
    bpmText.textContent = `${t('gen.bpm')} (${t('gen.bpm.unit')})`;
    const bpm = make('input', 'gen-bpm');
    bpm.type = 'number';
    bpm.min = String(BPM_MIN);
    bpm.max = String(BPM_MAX);
    bpm.step = '1';
    bpm.value = state.bpm === null ? '' : String(state.bpm);
    bpm.placeholder = this.piece ? String(this.piece.bpm) : t('gen.bpm.auto');
    bpm.title = t('gen.bpm.auto');
    bpm.addEventListener('change', () => {
      const text = bpm.value.trim();
      if (text === '') return this.set({ bpm: null });
      const value = Number(text);
      if (Number.isInteger(value) && value >= BPM_MIN && value <= BPM_MAX) this.set({ bpm: value });
      else bpm.value = this.state.bpm === null ? '' : String(this.state.bpm);
    });
    bpmLabel.append(bpmText, bpm);

    row.append(seedLabel, fresh, bpmLabel);
    return row;
  }

  private drawSummary(): void {
    const piece = this.piece;
    this.summary.textContent = piece
      ? t('gen.summary', { scale: this.scaleTitle(), style: t(`gen.style.${this.state.style}` as MessageKey), bars: this.state.bars, bpm: piece.bpm })
      : this.scaleTitle();
  }

  private drawRibbon(): void {
    const progression = this.piece?.progression;
    this.ribbon.hidden = !progression;
    this.ribbon.setAttribute('aria-label', t('gen.chords'));
    if (!progression) {
      this.ribbon.replaceChildren();
      return;
    }
    const bars = Array.from({ length: progression.bars }, (_, bar) => {
      const cell = make('div', 'gen-bar');
      cell.dataset.bar = String(bar);
      for (const chord of progression.chords.filter((c) => c.bar === bar)) {
        const button = make('button', 'gen-chord');
        button.type = 'button';
        const symbol = chordSymbol(chord.chord, this.deps.formatName);
        button.setAttribute('aria-label', t('gen.chord.aria', { bar: formatNumber(bar + 1), chord: symbol }));
        const name = make('span', 'gen-chord-symbol');
        name.setAttribute('dir', 'ltr');
        name.textContent = symbol;
        const roman = make('span', 'gen-chord-roman');
        roman.textContent = chord.chord.roman;
        button.append(name, roman);
        button.addEventListener('click', () => void this.hearChord(chord.voicing));
        cell.append(button);
      }
      return cell;
    });
    this.ribbon.replaceChildren(...bars);
  }

  private drawActions(): void {
    const piece = this.piece;
    const button = (className: string, text: string, onClick: () => void, disabled = false): HTMLButtonElement => {
      const b = make('button', className);
      b.type = 'button';
      b.textContent = text;
      b.disabled = disabled;
      b.addEventListener('click', onClick);
      return b;
    };
    const play = button('sc-hear gen-play', t(this.playing ? 'gen.stop' : 'gen.play'), () => (this.playing ? this.stopSound() : void this.play()), !piece);
    const midi = button('sc-along gen-midi', t('gen.midi'), () => this.saveMidi(), !piece);
    const practise = button('sc-along gen-practise', t('gen.practise'), () => piece && this.deps.practise(pieceXml(piece), piece.title), !piece);
    const maker = button('sc-along gen-maker', t('gen.maker'), () => void this.openMaker(), !piece?.melody);
    this.actions.replaceChildren(play, midi, practise, maker);
  }

  private drawScore(): void {
    const piece = this.piece;
    this.score.hidden = !piece;
    if (!piece) {
      this.score.replaceChildren();
      return;
    }
    this.score.setAttribute('aria-label', t('gen.score'));
    const spec = pieceSpec(piece);
    const bars = spec.notes.split(' | ').length;
    const lines: HTMLElement[] = [];
    for (let from = 0; from < bars; from += BARS_PER_LINE) {
      const line = make('div', 'sc-staff gen-line');
      line.setAttribute('dir', 'ltr');
      try {
        renderStaffPicture(line, { toolkit: this.deps.toolkit, spec: barsOfSpec(spec, from, BARS_PER_LINE), names: false, formatName: (note) => note, description: t('gen.score') });
        // a line of four bars may be drawn bigger than a lesson picture: it is the piece itself
        const svg = line.querySelector('svg');
        if (svg) svg.style.maxWidth = '760px';
      } catch {
        line.replaceChildren();
      }
      lines.push(line);
    }
    this.score.replaceChildren(...lines);
  }

  // ----- sound and files -----

  private async ready(): Promise<boolean> {
    if (await this.deps.voice.ready()) return true;
    this.status.textContent = t('ear.noSound');
    return false;
  }

  private async hearChord(voicing: readonly string[]): Promise<void> {
    if (this.playing || !(await this.ready())) return;
    this.status.textContent = '';
    this.deps.voice.stopAll();
    for (const pitch of voicing) this.deps.voice.play(pitch, 1.6, 0.05);
  }

  private async play(): Promise<void> {
    const piece = this.piece;
    if (!piece || !(await this.ready())) return;
    this.status.textContent = '';
    this.deps.voice.stopAll();
    const plan = planPlayback(piece);
    for (const note of plan.notes) this.deps.voice.play(note.pitch, note.seconds, LEAD_IN + note.at);
    this.playing = true;
    this.drawActions();
    plan.barStarts.forEach((start, bar) => this.timers.push(window.setTimeout(() => this.markBar(bar), (LEAD_IN + start) * 1000)));
    this.timers.push(window.setTimeout(() => this.stopSound(), (LEAD_IN + plan.total + 0.4) * 1000));
  }

  private markBar(bar: number | null): void {
    for (const cell of this.ribbon.querySelectorAll<HTMLElement>('.gen-bar')) cell.dataset.current = String(bar !== null && cell.dataset.bar === String(bar));
  }

  private stopSound(): void {
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers = [];
    this.deps.voice.stopAll();
    this.markBar(null);
    if (this.playing) {
      this.playing = false;
      this.drawActions();
    }
  }

  private saveMidi(): void {
    const piece = this.piece;
    if (!piece) return;
    const fileName = midiFileName(piece.title);
    (this.deps.download ?? downloadBytes)(fileName, buildMidiFile(pieceMidiSpec(piece)));
    (this.deps.notify ?? showNotice)(t('gen.midi.saved', { file: fileName }));
  }

  private async openMaker(): Promise<void> {
    const draft = this.piece ? songDraftOf(this.piece) : null;
    if (!draft) return;
    if (!(await this.deps.openInMaker(draft))) (this.deps.notify ?? showNotice)(t('gen.maker.failed'));
  }
}
