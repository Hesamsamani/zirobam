import type { BuiltInSong } from './index';

export type SongCategory = 'nursery' | 'folk' | 'classical' | 'exercise';

export interface SongSpec {
  id: string;
  title: string;
  composer: string;
  difficulty: BuiltInSong['difficulty'];
  category: SongCategory;
  /** Key signature: sharps (positive) or flats (negative). */
  fifths: number;
  /** The mode the tune is in, when it is not major (a minor tune has the key signature of its relative major). */
  mode?: 'minor' | 'dorian';
  /** Beats per measure, in quarter notes: 2, 3 or 4. */
  beats: 2 | 3 | 4;
  /**
   * The tune for the right hand. Notes are written like `E4q`, `F#4e`, `Bb3h.` (step, optional # or b,
   * octave, length w h q e s, optional dot, optional ~ to tie to the next note), rests like `rq`. A sharp or
   * flat outside the key signature is written the same way (`F#4q` in C major); a natural that cancels a sign
   * in force is written `Fn4q`. Measures are separated by `|`.
   */
  melody: string;
}

/** What is wrong with a melody text, so that a screen can say it in the student's language. */
export type MelodyProblem =
  | { kind: 'note'; token: string }
  | { kind: 'dotted16th'; token: string }
  | { kind: 'measure'; measure: number; beats: number; expected: number }
  /** A plain letter where the key signature has a sharp or flat. */
  | { kind: 'keySign'; token: string; needed: string; natural: string }
  /** A plain letter where an earlier sign in the same measure is still in force. */
  | { kind: 'carried'; token: string; needed: string; natural: string };

export class MelodyError extends Error {
  readonly problem: MelodyProblem;

  constructor(message: string, problem: MelodyProblem) {
    super(message);
    this.name = 'MelodyError';
    this.problem = problem;
  }
}

export interface ParsedNote {
  token: string;
  /** Tied to the next note (written with a ~ after the length). */
  tie: boolean;
  /** An explicit natural sign (written Fn4q). */
  natural: boolean;
  rest: boolean;
  /** "C4", "F#4", "Bb3"; empty for a rest. */
  pitch: string;
  step: string;
  alter: number;
  octave: number;
  /** Divisions of a quarter note: a quarter is 4, an eighth 2, a sixteenth 1. */
  duration: number;
  type: string;
  dotted: boolean;
}

const DURATIONS: Readonly<Record<string, { divisions: number; type: string }>> = {
  w: { divisions: 16, type: 'whole' },
  h: { divisions: 8, type: 'half' },
  q: { divisions: 4, type: 'quarter' },
  e: { divisions: 2, type: 'eighth' },
  s: { divisions: 1, type: '16th' },
};

const TOKEN = /^(?:([A-G])([#bn]?)(\d)|(r))([whqes])(\.?)(~?)$/;

function readNote(token: string): ParsedNote {
  const match = TOKEN.exec(token);
  if (!match) throw new MelodyError(`Cannot read the note "${token}"`, { kind: 'note', token });
  const [, step, accidental, octave, rest, code, dot, tie] = match;
  const base = DURATIONS[code];
  if (dot && base.divisions % 2 !== 0) throw new MelodyError(`A dotted sixteenth is not supported: "${token}"`, { kind: 'dotted16th', token });
  return {
    token,
    rest: Boolean(rest),
    tie: Boolean(tie),
    natural: accidental === 'n',
    pitch: rest ? '' : `${step}${accidental === 'n' ? '' : accidental}${octave}`,
    step: step ?? '',
    alter: accidental === '#' ? 1 : accidental === 'b' ? -1 : 0,
    octave: octave ? Number(octave) : 0,
    duration: dot ? (base.divisions * 3) / 2 : base.divisions,
    type: base.type,
    dotted: Boolean(dot),
  };
}

/**
 * Reads the melody text into measures and checks that each measure has exactly the right length
 * (unless `strict` is false, for notes that only illustrate lengths).
 */
export function parseMelody(text: string, beats: number, beatType: number, strict = true): ParsedNote[][] {
  const length = (beats * 16) / beatType;
  const measures = text
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => part.split(/\s+/).map(readNote));
  measures.forEach((notes, index) => {
    const total = notes.reduce((sum, note) => sum + note.duration, 0);
    if (strict && total !== length) {
      throw new MelodyError(`Measure ${index + 1} has ${total / 4} beats, expected ${length / 4}: ${notes.map((n) => n.token).join(' ')}`, {
        kind: 'measure',
        measure: index + 1,
        beats: total / 4,
        expected: length / 4,
      });
    }
  });
  return measures;
}

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

export function keyAlter(step: string, fifths: number): number {
  if (fifths > 0 && SHARP_ORDER.slice(0, fifths).includes(step)) return 1;
  if (fifths < 0 && FLAT_ORDER.slice(0, -fifths).includes(step)) return -1;
  return 0;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * The sign to draw next to a note: one is needed when the pitch differs from what is in force, which is the
 * key signature at the start of a measure and then whatever earlier notes of the same pitch in it set.
 */
function accidentalXml(note: ParsedNote, inForce: number): string {
  if (note.alter === inForce) return '';
  return note.alter > 0 ? '<accidental>sharp</accidental>' : note.alter < 0 ? '<accidental>flat</accidental>' : '<accidental>natural</accidental>';
}

function noteXml(note: ParsedNote, inForce: number, tieIn: boolean): string {
  const dot = note.dotted ? '<dot/>' : '';
  if (note.rest) return `      <note><rest/><duration>${note.duration}</duration><type>${note.type}</type>${dot}<staff>1</staff></note>`;
  const alter = note.alter !== 0 ? `<alter>${note.alter}</alter>` : '';
  const ties = (tieIn ? '<tie type="stop"/>' : '') + (note.tie ? '<tie type="start"/>' : '');
  const tied = (tieIn ? '<tied type="stop"/>' : '') + (note.tie ? '<tied type="start"/>' : '');
  const notations = tied ? `<notations>${tied}</notations>` : '';
  return `      <note><pitch><step>${note.step}</step>${alter}<octave>${note.octave}</octave></pitch><duration>${note.duration}</duration>${ties}<type>${note.type}</type>${dot}${accidentalXml(note, inForce)}<staff>1</staff>${notations}</note>`;
}

/**
 * The notes of every measure as XML. A plain letter where a sign is in force (the key signature, or an earlier
 * accidental in the same measure) is refused, because it would have to be a natural and the song says so with `n`.
 */
function measuresXml(measures: ParsedNote[][], fifths: number): string[] {
  let tieIn = false;
  return measures.map((notes) => {
    const changed = new Map<string, number>(); // step + octave -> the alteration in force, for this measure
    return notes
      .map((note) => {
        const id = `${note.step}${note.octave}`;
        const fromKey = !changed.has(id);
        const inForce = changed.get(id) ?? keyAlter(note.step, fifths);
        if (!note.rest && note.alter === 0 && !note.natural && inForce !== 0) {
          const needed = `${note.step}${inForce > 0 ? '#' : 'b'}${note.octave}`;
          const natural = `${note.step}n${note.octave}`;
          throw new MelodyError(
            fromKey
              ? `"${note.token}": the key signature has ${needed}, so write ${needed} (or ${natural} for a natural)`
              : `"${note.token}": ${needed} earlier in the measure is still in force, so write ${natural} for a natural`,
            { kind: fromKey ? 'keySign' : 'carried', token: note.token, needed, natural },
          );
        }
        const xml = noteXml(note, inForce, tieIn && !note.rest);
        if (!note.rest) changed.set(id, note.alter);
        tieIn = note.tie;
        return xml;
      })
      .join('\n');
  });
}

/** MusicXML for a song: the tune in the right hand, a rest in the left hand (like the hand-written songs). */
export function buildSongXml(spec: SongSpec): string {
  const measures = parseMelody(spec.melody, spec.beats, 4);
  const notesXml = measuresXml(measures, spec.fifths);
  const length = spec.beats * 4;
  const restType = spec.beats === 4 ? 'whole' : spec.beats === 3 ? 'half' : 'half';
  const restXml = `<rest/><duration>${length}</duration><type>${restType}</type>${spec.beats === 3 ? '<dot/>' : ''}<staff>2</staff>`;

  const body = measures
    .map((_, index) => {
      const attributes =
        index === 0
          ? `      <attributes>
        <divisions>4</divisions>
        <key><fifths>${spec.fifths}</fifths>${spec.mode ? `<mode>${spec.mode}</mode>` : ''}</key>
        <time><beats>${spec.beats}</beats><beat-type>4</beat-type></time>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
`
          : '';
      return `    <measure number="${index + 1}">
${attributes}${notesXml[index]}
      <backup><duration>${length}</duration></backup>
      <note>${restXml}</note>
    </measure>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>${escapeXml(spec.title)}</work-title></work>
  <identification><creator type="composer">${escapeXml(spec.composer)}</creator></identification>
  <part-list><score-part id="P1"><part-name print-object="no">Piano</part-name></score-part></part-list>
  <part id="P1">
${body}
  </part>
</score-partwise>`;
}

/** A built-in song made from a spec. */
export function defineSong(spec: SongSpec): BuiltInSong {
  return {
    id: spec.id,
    title: spec.title,
    composer: spec.composer,
    difficulty: spec.difficulty,
    category: spec.category,
    xml: buildSongXml(spec),
  };
}
