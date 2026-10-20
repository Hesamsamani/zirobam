import { createBackButton } from '../menu/backButton';
import { getLocale, t, type MessageKey } from '../i18n';
import { storageGet, storageRemove, storageSet } from '../core/safeStorage';
import type { NotationToolkit } from '../learn/noteCard';
import { renderStaffPicture } from '../lessons/staffPicture';
import {
  addToken,
  buildDraft,
  draftFromData,
  MAKER_KEYS,
  MAX_TITLE,
  measureBeats,
  noteToken,
  readDraft,
  removeLastToken,
  type DraftProblem,
  type NoteParts,
  type SongDraft,
} from './songMaker';

const DRAFT_KEY = 'maker.draft.v1';
/** The staff shows this many measures; a longer song would be too small to read. */
const PREVIEW_MEASURES = 4;
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const OCTAVES = [3, 4, 5, 6] as const;
const LENGTHS = ['w', 'h', 'q', 'e', 's'] as const;
const SIGNS: ReadonlyArray<{ value: NoteParts['accidental']; label: MessageKey; mark: string }> = [
  { value: '', label: 'maker.sign.none', mark: '–' },
  { value: '#', label: 'maker.sign.sharp', mark: '♯' },
  { value: 'b', label: 'maker.sign.flat', mark: '♭' },
  { value: 'n', label: 'maker.sign.natural', mark: '♮' },
];

export type SaveOutcome = 'saved' | 'memory' | 'full' | 'failed';

export interface SongMakerDeps {
  toolkit: NotationToolkit;
  onBack(): void;
  /** The MusicXML of a song made here, or null when there is none with this id. */
  open(id: string): Promise<string | null>;
  save(id: string, title: string, xml: string): Promise<SaveOutcome>;
  /** Practise a saved song. */
  practise(id: string): void;
  /** A new id for a song that is saved for the first time. */
  newId(): string;
  /** The text of a note letter ("C") in the student's note names. */
  formatName?(letter: string): string;
  /** The address changed to the song being edited. */
  onSaved?(id: string): void;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

function formatBeats(beats: number): string {
  return new Intl.NumberFormat(getLocale() === 'fa' ? 'fa-IR' : 'en').format(beats);
}

/** The words that say what is wrong with a song. */
function problemText(problem: DraftProblem): string {
  switch (problem.kind) {
    case 'empty':
      return t('maker.err.empty');
    case 'name':
      return t('maker.err.name', { max: MAX_TITLE });
    case 'tooLong':
      return t('maker.err.tooLong', { max: problem.max });
    case 'note':
      return t('maker.err.note', { token: problem.token });
    case 'dotted16th':
      return t('maker.err.dotted16th', { token: problem.token });
    case 'measure':
      return t('maker.err.measure', { measure: problem.measure, beats: formatBeats(problem.beats), expected: problem.expected });
    case 'keySign':
      return t('maker.err.keySign', { token: problem.token, needed: problem.needed, natural: problem.natural });
    case 'carried':
      return t('maker.err.carried', { token: problem.token, needed: problem.needed, natural: problem.natural });
  }
}

/** The screen where a student writes a song of their own, in the notation of the songs, and practises it. */
export class SongMakerView {
  readonly element: HTMLElement;
  private readonly deps: SongMakerDeps;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly name: HTMLInputElement;
  private readonly key: HTMLSelectElement;
  private readonly time: HTMLSelectElement;
  private readonly notes: HTMLTextAreaElement;
  private readonly palette: HTMLElement;
  private readonly preview: HTMLElement;
  private readonly count: HTMLElement;
  private readonly problem: HTMLElement;
  private readonly status: HTMLElement;
  private readonly saveButton: HTMLButtonElement;
  private readonly practiseButton: HTMLButtonElement;
  private readonly labels = new Map<HTMLElement, MessageKey>();
  /** Updates of the note buttons that show a choice (octave, sign, length). */
  private chipSync: Array<() => void> = [];

  /** The saved song being edited, or null for a song that has not been saved yet. */
  private currentId: string | null = null;
  /** The parts the note buttons write with. */
  private parts: Pick<NoteParts, 'accidental' | 'octave' | 'length' | 'dotted'> = { accidental: '', octave: 4, length: 'q', dotted: false };
  /** A save was tried, so the name and an empty song are reported too. */
  private attempted = false;

  constructor(deps: SongMakerDeps) {
    this.deps = deps;
    this.element = make('section', 'maker-view');
    this.element.id = 'makerView';
    this.element.dataset.views = 'maker';

    const header = make('header', 'view-header');
    this.title = make('h2', 'view-title');
    this.subtitle = make('p', 'view-subtitle');
    header.append(createBackButton(deps.onBack, 'maker.back'), this.title, this.subtitle);

    this.name = document.createElement('input');
    this.name.type = 'text';
    this.name.id = 'makerName';
    this.name.className = 'maker-input';
    this.name.maxLength = MAX_TITLE;
    this.name.autocomplete = 'off';
    this.name.setAttribute('dir', 'auto');

    this.key = document.createElement('select');
    this.key.id = 'makerKey';
    this.key.className = 'maker-input';
    this.key.setAttribute('dir', 'ltr');

    this.time = document.createElement('select');
    this.time.id = 'makerTime';
    this.time.className = 'maker-input';
    this.time.setAttribute('dir', 'ltr');
    // the value is the number of beats; six beats are 6/8 (eighth notes), the others are quarter notes
    for (const beats of [2, 3, 4, 6]) {
      const option = document.createElement('option');
      option.value = String(beats);
      option.textContent = beats === 6 ? '6/8' : `${beats}/4`;
      this.time.appendChild(option);
    }
    this.time.value = '4';

    this.notes = document.createElement('textarea');
    this.notes.id = 'makerNotes';
    this.notes.className = 'maker-input maker-notes';
    this.notes.rows = 4;
    this.notes.spellcheck = false;
    this.notes.autocomplete = 'off';
    this.notes.setAttribute('dir', 'ltr');
    this.notes.placeholder = 'C4q D4q E4q F4q | G4w';

    this.palette = make('fieldset', 'maker-palette');
    this.preview = make('div', 'maker-preview');
    this.preview.setAttribute('dir', 'ltr');
    this.count = make('p', 'maker-count');
    this.problem = make('p', 'maker-problem');
    this.problem.setAttribute('role', 'alert');
    this.status = make('p', 'maker-status');
    this.status.setAttribute('role', 'status');

    this.saveButton = make('button', 'maker-save');
    this.saveButton.type = 'button';
    this.practiseButton = make('button', 'maker-practise');
    this.practiseButton.type = 'button';
    this.saveButton.addEventListener('click', () => void this.submit(false));
    this.practiseButton.addEventListener('click', () => void this.submit(true));

    const form = make('div', 'maker-form');
    form.append(
      this.field('maker.name', this.name),
      this.row(this.field('maker.key', this.key), this.field('maker.time', this.time)),
      this.palette,
      this.field('maker.notes', this.notes),
    );
    const hint = make('p', 'maker-hint');
    this.labels.set(hint, 'maker.notesHint');
    form.append(this.problem, hint);

    const side = make('div', 'maker-side');
    const previewHeading = make('h3', 'maker-heading');
    this.labels.set(previewHeading, 'maker.preview');
    const actions = make('div', 'maker-actions');
    actions.append(this.saveButton, this.practiseButton);
    side.append(previewHeading, this.preview, this.count, actions, this.status);

    const layout = make('div', 'maker-layout');
    layout.append(form, side);
    this.element.append(header, layout);

    for (const input of [this.name, this.key, this.time, this.notes]) {
      input.addEventListener('input', () => this.changed());
      input.addEventListener('change', () => this.changed());
    }
    this.refresh();
  }

  /** A label with its control. */
  private field(label: MessageKey, control: HTMLElement): HTMLElement {
    const wrap = make('label', 'maker-field');
    const text = make('span', 'maker-label');
    this.labels.set(text, label);
    wrap.append(text, control);
    return wrap;
  }

  private row(...children: HTMLElement[]): HTMLElement {
    const row = make('div', 'maker-row');
    row.append(...children);
    return row;
  }

  /** Writes the texts again, after the language changed. */
  refresh(): void {
    this.title.textContent = t('maker.title');
    this.subtitle.textContent = t('maker.subtitle');
    for (const [el, key] of this.labels) el.textContent = t(key);
    this.name.placeholder = t('maker.namePlaceholder');

    const chosen = this.key.value || '0';
    this.key.replaceChildren();
    for (const key of MAKER_KEYS) {
      const option = document.createElement('option');
      option.value = String(key.fifths);
      option.textContent = t('maker.keyOption', { major: key.major, minor: key.minor });
      this.key.appendChild(option);
    }
    this.key.value = chosen;

    this.saveButton.textContent = t('maker.save');
    this.practiseButton.textContent = t('maker.savePractise');
    this.buildPalette();
    this.update();
  }

  /** Opens the screen: a saved song to edit, or a new one (the unfinished draft comes back). */
  async show(id: string | null): Promise<void> {
    this.attempted = false;
    this.status.textContent = '';
    this.currentId = null;
    if (id) {
      const xml = await this.deps.open(id);
      const draft = xml ? readDraft(xml) : null;
      if (draft) {
        this.currentId = id;
        this.fill(draft);
        return;
      }
      this.status.textContent = t('maker.notFound');
    }
    this.fill(this.loadDraft() ?? { title: '', fifths: 0, beats: 4, melody: '' });
  }

  private fill(draft: SongDraft): void {
    this.name.value = draft.title;
    this.key.value = String(draft.fifths);
    this.time.value = String(draft.beats);
    this.notes.value = draft.melody;
    this.update();
  }

  private read(): SongDraft {
    const beats = Number(this.time.value);
    const common = { title: this.name.value, fifths: Number(this.key.value), melody: this.notes.value };
    if (beats === 6) return { ...common, beats: 6, beatType: 8 };
    return { ...common, beats: beats === 2 || beats === 3 ? beats : 4 };
  }

  private loadDraft(): SongDraft | null {
    const text = storageGet(DRAFT_KEY);
    if (!text) return null;
    try {
      return draftFromData(JSON.parse(text));
    } catch {
      return null;
    }
  }

  private changed(): void {
    // a new song keeps its unfinished text, so a reload does not lose it
    if (this.currentId === null) storageSet(DRAFT_KEY, JSON.stringify(this.read()));
    this.status.textContent = '';
    this.update();
  }

  /** Shows which octave, sign and length the note buttons write with. */
  private syncChips(): void {
    for (const sync of this.chipSync) sync();
  }

  /** The note buttons: octave, sign, length, then the letters. They are built once; the pressed ones follow `parts`. */
  private buildPalette(): void {
    this.chipSync = [];
    const legend = document.createElement('legend');
    legend.className = 'maker-heading';
    legend.textContent = t('maker.add');
    this.palette.replaceChildren(legend);

    const group = (label: MessageKey, buttons: HTMLElement[]): void => {
      const row = make('div', 'maker-chips');
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', t(label));
      const caption = make('span', 'maker-chips-label');
      caption.textContent = t(label);
      row.append(caption, ...buttons);
      this.palette.appendChild(row);
    };
    const chip = (text: string, pressed: () => boolean, onClick: () => void, aria?: string): HTMLButtonElement => {
      const button = make('button', 'maker-chip');
      button.type = 'button';
      button.textContent = text;
      if (aria) button.setAttribute('aria-label', aria);
      button.addEventListener('click', () => {
        onClick();
        this.syncChips();
      });
      this.chipSync.push(() => button.setAttribute('aria-pressed', String(pressed())));
      return button;
    };

    group(
      'maker.octave',
      OCTAVES.map((octave) =>
        chip(
          String(octave),
          () => this.parts.octave === octave,
          () => {
            this.parts.octave = octave;
          },
        ),
      ),
    );
    group(
      'maker.sign',
      SIGNS.map((sign) =>
        chip(
          sign.mark,
          () => this.parts.accidental === sign.value,
          () => {
            this.parts.accidental = sign.value;
          },
          t(sign.label),
        ),
      ),
    );
    const dotted = chip(
      t('maker.dotted'),
      () => this.parts.dotted,
      () => {
        this.parts.dotted = !this.parts.dotted;
      },
    );
    // a sixteenth cannot be dotted
    this.chipSync.push(() => {
      dotted.disabled = this.parts.length === 's';
    });
    group('maker.length', [
      ...LENGTHS.map((length) =>
        chip(
          t(`maker.length.${length}` as MessageKey),
          () => this.parts.length === length,
          () => {
            this.parts.length = length;
            if (length === 's') this.parts.dotted = false;
          },
        ),
      ),
      dotted,
    ]);

    const letters = make('div', 'maker-letters');
    letters.setAttribute('role', 'group');
    letters.setAttribute('aria-label', t('maker.add'));
    const format = this.deps.formatName ?? ((letter: string) => letter);
    for (const letter of LETTERS) {
      const button = make('button', 'maker-note');
      button.type = 'button';
      button.dataset.letter = letter;
      button.textContent = format(letter);
      button.addEventListener('click', () => this.add(noteToken({ letter, ...this.parts })));
      letters.appendChild(button);
    }
    const rest = make('button', 'maker-note maker-rest');
    rest.type = 'button';
    rest.dataset.letter = 'r';
    rest.textContent = t('maker.rest');
    rest.addEventListener('click', () => this.add(noteToken({ letter: 'r', ...this.parts })));
    letters.appendChild(rest);
    this.palette.appendChild(letters);

    const tools = make('div', 'maker-tools');
    const tool = (action: string, label: MessageKey, onClick: () => void): HTMLButtonElement => {
      const button = make('button', 'maker-tool');
      button.type = 'button';
      button.dataset.action = action;
      button.textContent = t(label);
      button.addEventListener('click', onClick);
      return button;
    };
    tools.append(
      tool('bar', 'maker.bar', () => this.write(`${this.notes.value.trimEnd()} |`.trim())),
      tool('delete', 'maker.deleteLast', () => this.write(removeLastToken(this.notes.value))),
      tool('clear', 'maker.clear', () => this.write('')),
    );
    this.palette.appendChild(tools);
    this.syncChips();
  }

  private add(token: string): void {
    this.write(addToken(this.notes.value, token, measureBeats(this.read())));
  }

  private write(text: string): void {
    this.notes.value = text;
    this.changed();
  }

  /** Checks the song, shows what is wrong and draws the first measures. */
  private update(): void {
    const draft = this.read();
    // the notes are checked on their own, so a missing name does not hide a wrong note
    const notes = buildDraft({ ...draft, title: 'x' });
    const text = draft.melody.trim();
    const written = text.split('|').filter((part) => part.trim()).length;
    let message = '';
    if (!notes.ok) {
      const { problem } = notes;
      // the measure being typed is not finished yet, so it is not an error before a save is tried
      const unfinished = problem.kind === 'measure' && !text.endsWith('|') && problem.measure === written;
      if (problem.kind === 'empty') {
        if (this.attempted) message = problemText(problem);
      } else if (!unfinished || this.attempted) {
        message = problemText(problem);
      }
    }
    const name = draft.title.trim();
    if (message === '' && this.attempted && (name.length === 0 || name.length > MAX_TITLE)) {
      message = problemText({ kind: 'name' });
    }
    this.problem.textContent = message;
    this.notes.setAttribute('aria-invalid', String(message !== ''));
    this.drawPreview(draft);
    this.count.textContent = written > 0 ? t('maker.measureCount', { n: written }) : '';
  }

  private drawPreview(draft: SongDraft): void {
    const parts = draft.melody.split('|').filter((part) => part.trim().length > 0);
    if (parts.length === 0) {
      const empty = make('p', 'maker-empty');
      empty.setAttribute('dir', 'auto');
      empty.textContent = t('maker.previewEmpty');
      this.preview.replaceChildren(empty);
      return;
    }
    const shown = parts.slice(0, PREVIEW_MEASURES).join(' | ');
    try {
      renderStaffPicture(this.preview, {
        toolkit: this.deps.toolkit,
        spec: { clef: 'treble', notes: shown, fifths: draft.fifths, beats: draft.beats, beatType: draft.beatType, showTime: true, free: true },
        names: false,
        formatName: (note) => note,
        description: t('maker.preview'),
      });
    } catch {
      // text that cannot be read yet: keep the picture of what could be
    }
    if (this.preview.childElementCount === 0) return;
    if (parts.length > PREVIEW_MEASURES) {
      const more = make('p', 'maker-more');
      more.setAttribute('dir', 'auto');
      more.textContent = t('maker.previewMore', { shown: PREVIEW_MEASURES, total: parts.length });
      this.preview.appendChild(more);
    }
  }

  private async submit(practise: boolean): Promise<void> {
    this.attempted = true;
    const draft = this.read();
    const result = buildDraft(draft);
    this.update();
    if (!result.ok) {
      (result.problem.kind === 'name' ? this.name : this.notes).focus();
      return;
    }
    const id = this.currentId ?? this.deps.newId();
    const outcome = await this.deps.save(id, draft.title.trim(), result.xml);
    if (outcome === 'full' || outcome === 'failed') {
      this.status.textContent = t(outcome === 'full' ? 'maker.full' : 'maker.notSaved');
      return;
    }
    this.currentId = id;
    storageRemove(DRAFT_KEY);
    this.status.textContent = t(outcome === 'memory' ? 'scores.memoryOnly' : 'maker.saved');
    this.deps.onSaved?.(id);
    if (practise) this.deps.practise(id);
  }
}
