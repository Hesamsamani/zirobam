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
  /** Beats per measure, in quarter notes: 3 or 4. */
  beats: 3 | 4;
  /**
   * The tune for the right hand. Notes are written like `E4q`, `F#4e`, `Bb3h.` (step, optional # or b,
   * octave, length w h q e s, optional dot), rests like `rq`. Measures are separated by `|`.
   */
  melody: string;
}

export interface ParsedNote {
  token: string;
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

const TOKEN = /^(?:([A-G])([#b]?)(\d)|(r))([whqes])(\.?)$/;

function readNote(token: string): ParsedNote {
  const match = TOKEN.exec(token);
  if (!match) throw new Error(`Cannot read the note "${token}"`);
  const [, step, accidental, octave, rest, code, dot] = match;
  const base = DURATIONS[code];
  if (dot && base.divisions % 2 !== 0) throw new Error(`A dotted sixteenth is not supported: "${token}"`);
  return {
    token,
    rest: Boolean(rest),
    pitch: rest ? '' : `${step}${accidental}${octave}`,
    step: step ?? '',
    alter: accidental === '#' ? 1 : accidental === 'b' ? -1 : 0,
    octave: octave ? Number(octave) : 0,
    duration: dot ? (base.divisions * 3) / 2 : base.divisions,
    type: base.type,
    dotted: Boolean(dot),
  };
}

/** Reads the melody text into measures and checks that each measure has exactly the right length. */
export function parseMelody(text: string, beats: number, beatType: number): ParsedNote[][] {
  const length = (beats * 16) / beatType;
  const measures = text
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => part.split(/\s+/).map(readNote));
  measures.forEach((notes, index) => {
    const total = notes.reduce((sum, note) => sum + note.duration, 0);
    if (total !== length) {
      throw new Error(`Measure ${index + 1} has ${total / 4} beats, expected ${length / 4}: ${notes.map((n) => n.token).join(' ')}`);
    }
  });
  return measures;
}

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

function keyAlter(step: string, fifths: number): number {
  if (fifths > 0 && SHARP_ORDER.slice(0, fifths).includes(step)) return 1;
  if (fifths < 0 && FLAT_ORDER.slice(0, -fifths).includes(step)) return -1;
  return 0;
}

function checkKey(measures: ParsedNote[][], fifths: number): void {
  for (const note of measures.flat()) {
    if (note.rest) continue;
    const inKey = keyAlter(note.step, fifths);
    if (note.alter === inKey) continue;
    const written = `${note.step}${note.alter > 0 ? '#' : note.alter < 0 ? 'b' : ''}${note.octave}`;
    if (note.alter === 0) {
      const needed = `${note.step}${inKey > 0 ? '#' : 'b'}${note.octave}`;
      throw new Error(`"${note.token}": the key signature has ${needed}, so write ${needed} (a plain ${written} would need a natural sign)`);
    }
    throw new Error(`"${note.token}": ${written} is not in the key signature, and accidentals outside the key are not supported`);
  }
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function noteXml(note: ParsedNote): string {
  const dot = note.dotted ? '<dot/>' : '';
  if (note.rest) return `      <note><rest/><duration>${note.duration}</duration><type>${note.type}</type>${dot}<staff>1</staff></note>`;
  const alter = note.alter !== 0 ? `<alter>${note.alter}</alter>` : '';
  return `      <note><pitch><step>${note.step}</step>${alter}<octave>${note.octave}</octave></pitch><duration>${note.duration}</duration><type>${note.type}</type>${dot}<staff>1</staff></note>`;
}

/** MusicXML for a song: the tune in the right hand, a rest in the left hand (like the hand-written songs). */
export function buildSongXml(spec: SongSpec): string {
  const measures = parseMelody(spec.melody, spec.beats, 4);
  checkKey(measures, spec.fifths);
  const length = spec.beats * 4;
  const restXml =
    spec.beats === 4
      ? `<rest/><duration>${length}</duration><type>whole</type><staff>2</staff>`
      : `<rest/><duration>${length}</duration><type>half</type><dot/><staff>2</staff>`;

  const body = measures
    .map((notes, index) => {
      const attributes =
        index === 0
          ? `      <attributes>
        <divisions>4</divisions>
        <key><fifths>${spec.fifths}</fifths></key>
        <time><beats>${spec.beats}</beats><beat-type>4</beat-type></time>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
`
          : '';
      return `    <measure number="${index + 1}">
${attributes}${notes.map(noteXml).join('\n')}
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
