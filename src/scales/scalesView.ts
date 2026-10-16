import { storageGet, storageSet } from '../core/safeStorage';
import { formatNumber, t, type MessageKey } from '../i18n';
import type { NoteInputHub } from '../input/noteInput';
import type { NotationToolkit } from '../learn/noteCard';
import { buildKeysPicture } from '../lessons/keysPicture';
import { renderStaffPicture } from '../lessons/staffPicture';
import { createBackButton } from '../menu/backButton';
import type { PianoVoice } from '../playback/pianoVoice';
import { normalizeNote } from '../practice/timingEvents';
import { WaitSession } from '../practice/waitMode';
import {
  CHORD_TYPES,
  ROOT_PITCH_CLASSES,
  SCALE_TYPES,
  chordOf,
  fingering,
  scaleOf,
  type ChordType,
  type ScaleType,
  type Spelled,
} from './scaleData';

const STORAGE_KEY = 'scales.v1';
type Tab = 'scales' | 'chords';
type Labels = 'names' | 'right' | 'left';

interface Choice {
  tab: Tab;
  root: number;
  scale: ScaleType;
  chord: ChordType;
  labels: Labels;
}

const DEFAULT_CHOICE: Choice = { tab: 'scales', root: 0, scale: 'major', chord: 'major', labels: 'names' };

export interface ScalesViewDeps {
  toolkit: NotationToolkit;
  voice: PianoVoice;
  hub: NoteInputHub;
  formatName(note: string): string;
  onBack(): void;
  /** A scale or chord was played along to the end (for the rewards). */
  onPlayed(): void;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

function readChoice(): Choice {
  const text = storageGet(STORAGE_KEY);
  if (!text) return { ...DEFAULT_CHOICE };
  try {
    const data = JSON.parse(text) as Partial<Record<keyof Choice, unknown>> | null;
    if (typeof data !== 'object' || data === null) return { ...DEFAULT_CHOICE };
    return {
      tab: data.tab === 'chords' ? 'chords' : 'scales',
      root: typeof data.root === 'number' && ROOT_PITCH_CLASSES.includes(data.root) ? data.root : 0,
      scale: SCALE_TYPES.includes(data.scale as ScaleType) ? (data.scale as ScaleType) : 'major',
      chord: CHORD_TYPES.includes(data.chord as ChordType) ? (data.chord as ChordType) : 'major',
      labels: data.labels === 'right' || data.labels === 'left' ? data.labels : 'names',
    };
  } catch {
    return { ...DEFAULT_CHOICE };
  }
}

/** The scales and chords screen: pick a starting note and a kind, see it, hear it, and play along. */
export class ScalesView {
  readonly element: HTMLElement;
  private readonly deps: ScalesViewDeps;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly roots: HTMLElement;
  private readonly types: HTMLElement;
  private readonly labelRow: HTMLElement;
  private readonly staff: HTMLElement;
  private readonly noFingering: HTMLElement;
  private readonly keysHolder: HTMLElement;
  private readonly notesLine: HTMLElement;
  private readonly hearButton: HTMLButtonElement;
  private readonly alongButton: HTMLButtonElement;
  private readonly status: HTMLElement;

  private choice: Choice = readChoice();
  private spelled: Spelled = scaleOf(0, 'major');
  private session: WaitSession | null = null;
  private active = false;

  constructor(deps: ScalesViewDeps) {
    this.deps = deps;
    this.element = make('section', 'scales-view');
    this.element.id = 'scalesView';
    this.element.dataset.views = 'scales';

    const header = make('header', 'view-header');
    this.title = make('h2', 'view-title');
    this.subtitle = make('p', 'view-subtitle');
    header.append(createBackButton(deps.onBack), this.title, this.subtitle);

    this.tabs = make('div', 'sc-tabs');
    this.tabs.setAttribute('role', 'group');
    this.roots = make('div', 'sc-chips sc-roots');
    this.roots.setAttribute('role', 'group');
    this.types = make('div', 'sc-chips sc-types');
    this.types.setAttribute('role', 'group');
    this.labelRow = make('div', 'sc-chips sc-labels');
    this.labelRow.setAttribute('role', 'group');
    this.staff = make('div', 'sc-staff');
    this.staff.setAttribute('dir', 'ltr');
    this.noFingering = make('p', 'sc-note');
    this.keysHolder = make('div', 'sc-keys');
    this.keysHolder.setAttribute('dir', 'ltr');
    this.notesLine = make('p', 'sc-notes');
    this.hearButton = make('button', 'sc-hear');
    this.hearButton.type = 'button';
    this.hearButton.addEventListener('click', () => void this.hear());
    this.alongButton = make('button', 'sc-along');
    this.alongButton.type = 'button';
    this.alongButton.addEventListener('click', () => this.toggleAlong());
    this.status = make('p', 'sc-status');
    this.status.setAttribute('role', 'status');

    const actions = make('div', 'sc-actions');
    actions.append(this.hearButton, this.alongButton);
    this.element.append(header, this.tabs, this.roots, this.types, this.labelRow, this.staff, this.noFingering, this.keysHolder, this.notesLine, actions, this.status);

    deps.hub.onNoteOn.on(({ noteName }) => {
      if (this.active) this.pressed(noteName, false);
    });
    this.refresh();
  }

  activate(): void {
    this.active = true;
    this.refresh();
  }

  deactivate(): void {
    this.active = false;
    this.deps.voice.stopAll();
    if (this.session) {
      this.stopAlong();
      this.refresh(); // the button says "Play along" again
    }
  }

  /** What is on the screen (for tests and the end-to-end hook). */
  current(): { tab: Tab; spelled: Spelled; along: boolean } {
    return { tab: this.choice.tab, spelled: this.spelled, along: this.session !== null };
  }

  private save(): void {
    storageSet(STORAGE_KEY, JSON.stringify(this.choice));
  }

  private set(patch: Partial<Choice>): void {
    this.stopAlong();
    this.deps.voice.stopAll();
    this.choice = { ...this.choice, ...patch };
    this.save();
    this.refresh();
  }

  // ----- drawing -----

  refresh(): void {
    const { tab, root, scale, chord } = this.choice;
    this.title.textContent = t('scales.title');
    this.subtitle.textContent = t('scales.subtitle');
    this.spelled = tab === 'scales' ? scaleOf(root, scale) : chordOf(root, chord);

    this.buildTabs();
    this.buildRoots();
    this.buildTypes();
    this.buildLabels();
    this.drawStaff();
    this.drawKeys();
    this.notesLine.textContent = t('scales.notes', { notes: this.spelled.notes.map((n) => this.deps.formatName(n.replace(/\d$/, ''))).join(' ') });
    this.hearButton.textContent = t('scales.play');
    this.alongButton.textContent = t(this.session ? 'scales.stopAlong' : 'scales.playAlong');
    this.alongButton.setAttribute('aria-pressed', String(this.session !== null));
  }

  private chip(text: string, pressed: boolean, onClick: () => void): HTMLButtonElement {
    const chip = make('button', 'sc-chip');
    chip.type = 'button';
    chip.textContent = text;
    chip.setAttribute('aria-pressed', String(pressed));
    chip.addEventListener('click', onClick);
    return chip;
  }

  private buildTabs(): void {
    this.tabs.replaceChildren();
    for (const tab of ['scales', 'chords'] as const) {
      const button = this.chip(t(`scales.tab.${tab}` as MessageKey), this.choice.tab === tab, () => this.set({ tab }));
      button.classList.add('sc-tab');
      button.dataset.tab = tab;
      this.tabs.appendChild(button);
    }
  }

  private buildRoots(): void {
    this.roots.replaceChildren();
    this.roots.setAttribute('aria-label', t('scales.root'));
    for (const pc of ROOT_PITCH_CLASSES) {
      const spelled = this.choice.tab === 'scales' ? scaleOf(pc, this.choice.scale) : chordOf(pc, this.choice.chord);
      const button = this.chip(this.deps.formatName(spelled.root), this.choice.root === pc, () => this.set({ root: pc }));
      button.dataset.root = String(pc);
      this.roots.appendChild(button);
    }
  }

  private buildTypes(): void {
    this.types.replaceChildren();
    this.types.setAttribute('aria-label', t('scales.type'));
    if (this.choice.tab === 'scales') {
      for (const type of SCALE_TYPES) {
        const button = this.chip(t(`scales.scale.${type}` as MessageKey), this.choice.scale === type, () => this.set({ scale: type }));
        button.dataset.type = type;
        this.types.appendChild(button);
      }
    } else {
      for (const type of CHORD_TYPES) {
        const button = this.chip(t(`scales.chord.${type}` as MessageKey), this.choice.chord === type, () => this.set({ chord: type }));
        button.dataset.type = type;
        this.types.appendChild(button);
      }
    }
  }

  private buildLabels(): void {
    this.labelRow.replaceChildren();
    this.labelRow.hidden = this.choice.tab !== 'scales';
    this.labelRow.setAttribute('aria-label', t('scales.labels'));
    if (this.choice.tab !== 'scales') return;
    for (const labels of ['names', 'right', 'left'] as const) {
      const button = this.chip(t(`scales.labels.${labels}` as MessageKey), this.choice.labels === labels, () => this.set({ labels }));
      button.dataset.labels = labels;
      this.labelRow.appendChild(button);
    }
  }

  /** The text under the notes of the staff: the note names or the fingers, and whether there is fingering. */
  private labelTexts(): { texts: string[]; missing: boolean } {
    const { tab, labels } = this.choice;
    if (tab === 'scales' && labels !== 'names') {
      const fingers = fingering(this.spelled, labels);
      if (fingers) return { texts: fingers.map((f) => formatNumber(f)), missing: false };
      return { texts: this.spelled.notes.map((n) => this.deps.formatName(n.replace(/\d$/, ''))), missing: true };
    }
    return { texts: this.spelled.notes.map((n) => this.deps.formatName(n.replace(/\d$/, ''))), missing: false };
  }

  private drawStaff(): void {
    const { texts, missing } = this.labelTexts();
    this.noFingering.hidden = !missing;
    this.noFingering.textContent = missing ? t('scales.noFingering') : '';
    const notes = this.spelled.notes;
    const four = this.choice.tab === 'scales' || notes.length === 4;
    const beats: 3 | 4 = four ? 4 : 3;
    const tokens = notes.map((note) => `${note}q`);
    // measures of the length of the time signature (the last one may be shorter)
    const measures: string[] = [];
    for (let i = 0; i < tokens.length; i += beats) measures.push(tokens.slice(i, i + beats).join(' '));
    let index = 0;
    try {
      renderStaffPicture(this.staff, {
        toolkit: this.deps.toolkit,
        spec: { clef: 'treble', notes: measures.join(' | '), fifths: this.spelled.fifths ?? 0, beats, free: true },
        names: true,
        formatName: () => texts[index++] ?? '',
        description: t('scales.staff'),
      });
    } catch {
      this.staff.replaceChildren();
    }
  }

  private drawKeys(): void {
    const marks: Record<string, string> = {};
    for (const note of this.spelled.notes) marks[normalizeNote(note)] = '';
    this.keysHolder.replaceChildren(
      buildKeysPicture({
        from: 'C4',
        to: 'C6',
        names: 'white',
        marks,
        formatName: (note) => this.deps.formatName(note),
        formatMark: (text) => text,
        onPlay: (note) => this.pressed(note, true),
        ariaLabel: t('scales.keys'),
      }),
    );
    this.markNext();
  }

  /** The key to play next is marked while playing along. */
  private markNext(): void {
    this.keysHolder.querySelectorAll('.lk-key').forEach((key) => key.classList.remove('next-key'));
    const session = this.session;
    if (!session || session.finished()) return;
    const note = normalizeNote(this.spelled.notes[session.index()]);
    this.keysHolder.querySelector(`.lk-key[data-note="${note}"]`)?.classList.add('next-key');
  }

  // ----- hearing and playing along -----

  private async hear(): Promise<void> {
    const { voice } = this.deps;
    if (!(await voice.ready())) {
      this.setStatus(t('ear.noSound'), 'bad');
      return;
    }
    voice.stopAll();
    const notes = this.spelled.notes;
    if (this.choice.tab === 'scales') {
      const path = [...notes, ...notes.slice(0, -1).reverse()];
      path.forEach((note, i) => voice.play(note, 0.55, 0.05 + i * 0.4));
    } else {
      notes.forEach((note, i) => voice.play(note, 0.9, 0.05 + i * 0.4));
      const start = 0.05 + notes.length * 0.4 + 0.3;
      for (const note of notes) voice.play(note, 1.8, start);
    }
  }

  private toggleAlong(): void {
    if (this.session) {
      this.stopAlong();
      this.refresh();
      return;
    }
    this.session = new WaitSession(this.spelled.notes.map((note) => ({ pitches: [note] })));
    this.setStatus(t('scales.along.hint'), '');
    this.refresh();
  }

  private stopAlong(): void {
    this.session = null;
    this.setStatus('', '');
  }

  /** A key was played (on the picture or on a MIDI keyboard). */
  private pressed(note: string, fromScreen: boolean): void {
    if (fromScreen) void this.deps.voice.ready().then((ok) => ok && this.deps.voice.play(note, 0.9, 0));
    const session = this.session;
    if (!session) return;
    const press = session.press(note);
    if (press.result === 'ignored') return;
    if (press.result === 'wrong') {
      this.setStatus(t('scales.along.wrong'), 'bad');
      return;
    }
    if (press.result === 'done') {
      this.session = null;
      this.setStatus(t('scales.along.done'), 'good');
      this.deps.onPlayed();
      this.refresh();
      return;
    }
    this.setStatus(t('scales.along.hint'), '');
    this.markNext();
  }

  private setStatus(text: string, tone: 'good' | 'bad' | ''): void {
    this.status.textContent = text;
    this.status.dataset.tone = tone;
  }
}
