import { keyAlter } from '../theory/keySignature';
import { accidentalToken, MUSICXML_ACCIDENTAL, pitchMidi, type Alter, type Step } from '../theory/pitch';
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
  /** Beats per measure: 2, 3 or 4 quarter notes, or 6 eighth notes (with `beatType: 8`). */
  beats: 2 | 3 | 4 | 6;
  /** What a beat is: 4 for a quarter note (the default), 8 for an eighth note (6/8). */
  beatType?: 4 | 8;
  /**
   * The tune for the right hand. Notes are written like `E4q`, `F#4e`, `Bb3h.` (step, optional sign,
   * octave, length w h q e s, optional dot, optional ~ to tie to the next note), rests like `rq`. The signs are
   * # sharp, b flat, ## and bb double, k koron and o sori (quarter tones down and up). A sign outside the key
   * signature is written the same way (`F#4q` in C major); a natural that cancels a sign in force is written
   * `Fn4q`. A chord joins its pitches with +, `C4+E4+G4h`. Measures are separated by `|`.
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

/** One pitch of a note or chord, as written. */
export interface ParsedPitch {
  /** "C4", "F#4", "Bb3", "Ek4"; a written natural leaves the sign out (Fn4 is "F4"). */
  pitch: string;
  step: string;
  /** Semitones from the letter: 1 sharp, -1 flat, 2 and -2 double, 0.5 sori and -0.5 koron. */
  alter: number;
  octave: number;
  /** An explicit natural sign (written Fn4q). */
  natural: boolean;
}

/** A note, a chord or a rest, with its length. For a chord the fields of the pitch are those of its lowest note. */
export interface ParsedNote extends ParsedPitch {
  token: string;
  /** Tied to the next note (written with a ~ after the length). */
  tie: boolean;
  rest: boolean;
  /** The other pitches of a chord, from the lowest up; empty for a single note or a rest. */
  chord: ParsedPitch[];
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

const SIGN_ALTER: Readonly<Record<string, number>> = { '': 0, n: 0, '#': 1, b: -1, '##': 2, bb: -2, k: -0.5, o: 0.5 };

// one pitch is a letter, an optional sign and an octave; "bb" comes before "b" so that Bbb is not read as Bb plus b
const PITCH = String.raw`[A-G](?:##|bb|[#bnko])?\d`;
const TOKEN = new RegExp(String.raw`^(?:(${PITCH}(?:\+${PITCH})*)|(r))([whqes])(\.?)(~?)$`);
const ONE_PITCH = /^([A-G])(##|bb|[#bnko])?(\d)$/;

function readPitch(text: string): ParsedPitch {
  const [, step, sign = '', digit] = ONE_PITCH.exec(text) as RegExpExecArray;
  return { pitch: `${step}${sign === 'n' ? '' : sign}${digit}`, step, alter: SIGN_ALTER[sign], octave: Number(digit), natural: sign === 'n' };
}

const midiOfParsed = (p: ParsedPitch): number => pitchMidi({ step: p.step as Step, alter: p.alter as Alter, octave: p.octave });

function readNote(token: string): ParsedNote {
  const match = TOKEN.exec(token);
  if (!match) throw new MelodyError(`Cannot read the note "${token}"`, { kind: 'note', token });
  const [, pitches, rest, code, dot, tie] = match;
  const base = DURATIONS[code];
  if (dot && base.divisions % 2 !== 0) throw new MelodyError(`A dotted sixteenth is not supported: "${token}"`, { kind: 'dotted16th', token });
  // a chord is a set of pitches: the lowest comes first, however they were written
  const [lowest, ...others] = rest ? [{ pitch: '', step: '', alter: 0, octave: 0, natural: false }] : pitches.split('+').map(readPitch).sort((a, b) => midiOfParsed(a) - midiOfParsed(b));
  return {
    ...lowest,
    token,
    rest: Boolean(rest),
    tie: Boolean(tie),
    chord: others,
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

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** How the notes of a staff are written out: a song is checked and indented, a lesson picture shows what it is given. */
export interface MeasuresXmlOptions {
  fifths: number;
  staff: number;
  /**
   * `song`: a plain letter where a sign is in force (the key signature, or an earlier accidental in the same
   * measure) is refused, because it would have to be a natural and the song says so with `n`; a natural is drawn
   * only where it cancels something; the notes are indented, one per line.
   * `picture`: nothing is refused, a written natural is always drawn, the notes follow each other without a break.
   */
  kind: 'song' | 'picture';
}

/**
 * The sign to draw next to a note: one is needed when the pitch differs from what is in force, which is the
 * key signature at the start of a measure and then whatever earlier notes of the same pitch in it set.
 */
function accidentalXml(pitch: ParsedPitch, inForce: number, kind: MeasuresXmlOptions['kind']): string {
  const sign = (alter: number) => `<accidental>${MUSICXML_ACCIDENTAL[alter as Alter]}</accidental>`;
  if (kind === 'picture' && pitch.natural) return sign(0);
  return pitch.alter === inForce ? '' : sign(pitch.alter);
}

/** One `<note>`: a single note, or one pitch of a chord (every pitch after the first is marked `<chord/>`). */
function noteElement(note: ParsedNote, pitch: ParsedPitch, isChordMember: boolean, inForce: number, tieIn: boolean, options: MeasuresXmlOptions): string {
  const alter = pitch.alter !== 0 ? `<alter>${pitch.alter}</alter>` : '';
  const ties = (tieIn ? '<tie type="stop"/>' : '') + (note.tie ? '<tie type="start"/>' : '');
  const tied = (tieIn ? '<tied type="stop"/>' : '') + (note.tie ? '<tied type="start"/>' : '');
  const notations = tied ? `<notations>${tied}</notations>` : '';
  const dot = note.dotted ? '<dot/>' : '';
  return `<note>${isChordMember ? '<chord/>' : ''}<pitch><step>${pitch.step}</step>${alter}<octave>${pitch.octave}</octave></pitch><duration>${note.duration}</duration>${ties}<type>${note.type}</type>${dot}${accidentalXml(pitch, inForce, options.kind)}<staff>${options.staff}</staff>${notations}</note>`;
}

function restElement(note: ParsedNote, staff: number): string {
  const dot = note.dotted ? '<dot/>' : '';
  return `<note><rest/><duration>${note.duration}</duration><type>${note.type}</type>${dot}<staff>${staff}</staff></note>`;
}

/** The notes of every measure as XML, tracking ties from one note (or measure) to the next, and the signs in force. */
export function measuresXml(measures: ParsedNote[][], options: MeasuresXmlOptions): string[] {
  const song = options.kind === 'song';
  let tieIn = false;
  return measures.map((notes) => {
    const changed = new Map<string, number>(); // step + octave -> the alteration in force, for this measure
    const elements: string[] = [];
    for (const note of notes) {
      if (note.rest) {
        elements.push(restElement(note, options.staff));
        tieIn = note.tie;
        continue;
      }
      [note, ...note.chord].forEach((pitch, index) => {
        const id = `${pitch.step}${pitch.octave}`;
        const fromKey = !changed.has(id);
        const inForce = changed.get(id) ?? keyAlter(pitch.step, options.fifths);
        if (song && pitch.alter === 0 && !pitch.natural && inForce !== 0) {
          const needed = `${pitch.step}${accidentalToken(inForce as Alter)}${pitch.octave}`;
          const natural = `${pitch.step}n${pitch.octave}`;
          throw new MelodyError(
            fromKey
              ? `"${note.token}": the key signature has ${needed}, so write ${needed} (or ${natural} for a natural)`
              : `"${note.token}": ${needed} earlier in the measure is still in force, so write ${natural} for a natural`,
            { kind: fromKey ? 'keySign' : 'carried', token: note.token, needed, natural },
          );
        }
        elements.push(noteElement(note, pitch, index > 0, inForce, tieIn, options));
        changed.set(id, pitch.alter);
      });
      tieIn = note.tie;
    }
    return song ? elements.map((element) => `      ${element}`).join('\n') : elements.join('');
  });
}

/** MusicXML for a song: the tune in the right hand, a rest in the left hand (like the hand-written songs). */
export function buildSongXml(spec: SongSpec): string {
  const beatType = spec.beatType ?? 4;
  const measures = parseMelody(spec.melody, spec.beats, beatType);
  const notesXml = measuresXml(measures, { fifths: spec.fifths, staff: 1, kind: 'song' });
  const length = (spec.beats * 16) / beatType; // divisions of a quarter note (4 to a quarter)
  const restType = spec.beats === 4 ? 'whole' : spec.beats === 3 ? 'half' : 'half';
  // x/4: a rest of the length of the measure; 6/8 has no single note value for that, so the rest is marked as the whole measure
  const restXml =
    beatType === 4
      ? `<rest/><duration>${length}</duration><type>${restType}</type>${spec.beats === 3 ? '<dot/>' : ''}<staff>2</staff>`
      : `<rest measure="yes"/><duration>${length}</duration><staff>2</staff>`;

  const body = measures
    .map((_, index) => {
      const attributes =
        index === 0
          ? `      <attributes>
        <divisions>4</divisions>
        <key><fifths>${spec.fifths}</fifths>${spec.mode ? `<mode>${spec.mode}</mode>` : ''}</key>
        <time><beats>${spec.beats}</beats><beat-type>${beatType}</beat-type></time>
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
