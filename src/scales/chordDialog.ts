import { downloadBytes } from '../backup/download';
import { formatNumber, t, type MessageKey } from '../i18n';
import type { NotationToolkit } from '../learn/noteCard';
import { buildKeysPicture } from '../lessons/keysPicture';
import { renderStaffPicture } from '../lessons/staffPicture';
import type { PianoVoice } from '../playback/pianoVoice';
import { chordMidiSpec } from '../theory/chordMidi';
import { inversionsOf, rootPositionOf, type ScaleChord } from '../theory/diatonic';
import { guitarShapes, OPEN_STRINGS, shapeMidi, type GuitarShape } from '../theory/guitar';
import { buildMidiFile, midiFileName } from '../theory/midiExport';
import { keyName, parseNoteName, STEP_SEMITONES } from '../theory/pitch';
import { ascendFrom } from '../theory/spell';
import { openDialog, type DialogHandle } from '../ui/dialog';
import { showNotice } from '../ui/notice';
import { chordSymbol } from './chordSymbol';
import { buildFretboardPicture } from './fretboardPicture';

export interface ChordDialogDeps {
  toolkit: NotationToolkit;
  voice: PianoVoice;
  /** A note name, with or without an octave, as the student has chosen to read it. */
  formatName(note: string): string;
  /** Gives the student a file to keep. The browser's download without this. */
  download?(fileName: string, bytes: Uint8Array): void;
  /** Tells the student something short. A status notice without this. */
  notify?(text: string): void;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteOfMidi = (midi: number): string => `${SHARP_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

const pitchClassOf = (note: string): number => {
  const parsed = parseNoteName(note);
  if (!parsed) throw new Error(`Cannot read the note "${note}"`);
  return (((STEP_SEMITONES[parsed.step] + parsed.alter) % 12) + 12) % 12;
};

/** How many guitar shapes a chord shows. */
const SHAPES = 8;
const ARPEGGIO_GAP = 0.3;
const STRUM_GAP = 0.07;

/**
 * The dialog of a chord: its notes on the staff and on the keys, every turn of it, the shapes on a guitar, and buttons to
 * hear it (all at once or as an arpeggio) and to take it away as a MIDI file. The turn the card showed is the one open
 * at first; the other turns are a button away.
 */
export function openChordDialog(opened: ScaleChord, deps: ChordDialogDeps): DialogHandle {
  const turns = [rootPositionOf(opened), ...inversionsOf(opened)];
  let current = turns[opened.inversion] ?? turns[0];
  const symbolOf = (chord: ScaleChord): string => chordSymbol(chord, deps.formatName);

  const body = make('div', 'cd');
  const kind = make('p', 'cd-kind');
  const sub = make('p', 'cd-sub');
  const notesRow = make('p', 'cd-notes-row');
  const notesLabel = make('span', 'sr-only');
  const notes = make('span', 'cd-notes');
  notes.setAttribute('dir', 'ltr');
  notesRow.append(notesLabel, notes);

  const turnsRow = make('div', 'sc-chips cd-turns');
  turnsRow.setAttribute('role', 'group');
  const chips = turns.map((_turn, index) => {
    const chip = make('button', 'sc-chip');
    chip.type = 'button';
    chip.dataset.inversion = String(index);
    chip.addEventListener('click', () => {
      current = turns[index];
      update();
    });
    return chip;
  });
  turnsRow.append(...chips);

  const play = make('button', 'cd-btn cd-btn-primary cd-play');
  const arpeggio = make('button', 'cd-btn cd-arpeggio');
  const midi = make('button', 'cd-btn cd-midi');
  for (const button of [play, arpeggio, midi]) button.type = 'button';
  const actions = make('div', 'cd-actions');
  actions.append(play, arpeggio, midi);
  const status = make('p', 'cd-status');
  status.setAttribute('role', 'status');

  const staff = make('div', 'cd-staff');
  staff.setAttribute('dir', 'ltr');
  const keys = make('div', 'cd-keys');
  keys.setAttribute('dir', 'ltr');

  const guitar = make('section', 'cd-guitar');
  const guitarTitle = make('h3', 'cd-guitar-title');
  const tuning = make('p', 'cd-tuning');
  const shapes = make('div', 'cd-shapes');
  guitar.append(guitarTitle, tuning, shapes);

  body.append(kind, sub, notesRow, turnsRow, actions, status, staff, keys, guitar);

  const pitchesOf = (chord: ScaleChord): string[] => ascendFrom(chord.notes, 4);

  // ----- sound -----

  const withSound = async (start: () => void): Promise<void> => {
    if (!(await deps.voice.ready())) {
      status.textContent = t('ear.noSound');
      return;
    }
    status.textContent = '';
    deps.voice.stopAll();
    start();
  };

  const playNote = (note: string): void => void withSound(() => deps.voice.play(note, 1.5, 0.02));

  play.addEventListener('click', () =>
    void withSound(() => {
      for (const pitch of pitchesOf(current)) deps.voice.play(pitch, 2.4, 0.05);
    }),
  );

  arpeggio.addEventListener('click', () =>
    void withSound(() => {
      const pitches = pitchesOf(current);
      pitches.forEach((pitch, i) => deps.voice.play(pitch, 0.9, 0.05 + i * ARPEGGIO_GAP));
      const together = 0.05 + pitches.length * ARPEGGIO_GAP + ARPEGGIO_GAP;
      for (const pitch of pitches) deps.voice.play(pitch, 1.8, together);
    }),
  );

  midi.addEventListener('click', () => {
    // the letters of the chord, not the names the student reads: a file name should not depend on the language
    const title = `${current.root}${current.def.symbol}${current.bass ? ` over ${current.bass}` : ''}`;
    const fileName = midiFileName(title);
    (deps.download ?? downloadBytes)(fileName, buildMidiFile(chordMidiSpec(title, pitchesOf(current))));
    (deps.notify ?? showNotice)(t('cd.midi.saved', { file: fileName }));
  });

  const strum = (shape: GuitarShape): void =>
    void withSound(() => {
      let i = 0;
      for (const midiNote of shapeMidi(shape)) {
        if (midiNote === null) continue;
        deps.voice.play(noteOfMidi(midiNote), 2, 0.05 + i * STRUM_GAP);
        i++;
      }
    });

  // ----- the pictures -----

  const drawStaff = (chord: ScaleChord): void => {
    const token = `${pitchesOf(chord).join('+')}w`;
    try {
      renderStaffPicture(staff, {
        toolkit: deps.toolkit,
        spec: { clef: 'treble', notes: token, fifths: 0, beats: 4, free: true },
        names: false,
        formatName: (note) => deps.formatName(note),
        description: t('cd.staff'),
      });
      // a chord is narrow: let the picture be only as wide as it needs, not as the dialog
      const svg = staff.querySelector('svg');
      if (svg) svg.style.maxWidth = '340px';
    } catch {
      staff.replaceChildren();
    }
  };

  const drawKeys = (chord: ScaleChord): void => {
    const pitches = pitchesOf(chord);
    const marks: Record<string, string> = {};
    for (const pitch of pitches) marks[keyName(pitch)] = '';
    const rootIndex = Math.max(0, chord.notes.indexOf(chord.root));
    const octave = (note: string): number => Number(/-?\d+$/.exec(note)![0]);
    const from = `C${octave(pitches[0])}`;
    const to = `C${Math.max(octave(pitches[0]) + 2, octave(pitches[pitches.length - 1]) + 1)}`;
    keys.replaceChildren(
      buildKeysPicture({
        from,
        to,
        names: 'white',
        marks,
        rootNotes: [keyName(pitches[rootIndex])],
        formatName: (note) => deps.formatName(note),
        formatMark: (text) => text,
        onPlay: playNote,
        ariaLabel: t('cd.keys'),
      }),
    );
  };

  const drawGuitar = (chord: ScaleChord): void => {
    guitarTitle.textContent = t('cd.guitar');
    tuning.textContent = t('cd.guitar.tuning', { notes: OPEN_STRINGS.map((m) => deps.formatName(SHARP_NAMES[m % 12])).join(' ') });
    const rootPc = pitchClassOf(chord.root);
    const found = guitarShapes(chord.def, rootPc, { bassPc: chord.bass ? pitchClassOf(chord.bass) : undefined, limit: SHAPES });
    if (found.length === 0) {
      const none = make('p', 'cd-guitar-none');
      none.textContent = t('cd.guitar.none');
      shapes.replaceChildren(none);
      return;
    }
    const symbol = symbolOf(chord);
    shapes.replaceChildren(
      ...found.map((shape) => {
        const figure = make('figure', 'cd-shape');
        figure.dataset.frets = shape.frets.join(',');
        figure.dataset.kind = shape.kind;
        const label = t(`cd.shape.${shape.kind}` as MessageKey);
        const frets = shape.frets.map((fret) => (fret < 0 ? t('cd.shape.muted') : formatNumber(fret))).join(', ');
        const picture = buildFretboardPicture(shape, { ariaLabel: t('cd.shape.aria', { chord: symbol, kind: label, frets }), rootPc });
        const caption = make('figcaption', 'cd-shape-caption');
        const kindText = make('span', 'cd-shape-kind');
        kindText.textContent = label;
        caption.append(kindText);
        if (shape.baseFret > 1) {
          const position = make('span', 'cd-shape-pos');
          position.textContent = t('cd.shape.fromFret', { fret: formatNumber(shape.baseFret) });
          caption.append(position);
        }
        const hear = make('button', 'cd-btn cd-shape-hear');
        hear.type = 'button';
        hear.textContent = t('cd.shape.hear');
        hear.setAttribute('aria-label', t('cd.shape.hearAria', { kind: label, chord: symbol }));
        hear.addEventListener('click', () => strum(shape));
        figure.append(picture, caption, hear);
        return figure;
      }),
    );
  };

  // ----- the whole dialog -----

  let titleElement: HTMLElement | null = null;

  const update = (): void => {
    const chord = current;
    if (titleElement) titleElement.textContent = symbolOf(chord);
    kind.textContent = t(`chord.name.${chord.def.id}` as MessageKey);
    sub.textContent = t('cd.sub', { degree: formatNumber(chord.degree), roman: chord.roman });
    notesLabel.textContent = t('cd.notes');
    notes.textContent = chord.notes.map((note) => deps.formatName(note)).join(' · ');
    turnsRow.setAttribute('aria-label', t('cd.turns'));
    chips.forEach((chip, index) => {
      chip.textContent = t(`cd.turn.${index}` as MessageKey);
      chip.setAttribute('aria-pressed', String(turns[index] === chord));
    });
    play.textContent = t('cd.play');
    arpeggio.textContent = t('cd.arpeggio');
    midi.textContent = t('cd.midi');
    deps.voice.stopAll();
    status.textContent = '';
    drawStaff(chord);
    drawKeys(chord);
    drawGuitar(chord);
  };

  update();
  const handle = openDialog({ title: symbolOf(current), body, className: 'chord-dialog', onClose: () => deps.voice.stopAll() });
  titleElement = handle.element.querySelector<HTMLElement>('.app-dialog-title');
  titleElement?.setAttribute('dir', 'ltr');
  return handle;
}
