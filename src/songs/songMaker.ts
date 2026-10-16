import { buildSongXml, MelodyError, parseMelody, type MelodyProblem } from './songBuilder';

export const MAX_MEASURES = 64;
export const MAX_TITLE = 60;
/** The field of the MusicXML that holds the song as the student typed it, so it can be edited later. */
const SOURCE_FIELD = 'music-notes-trainer-maker';

/** A song as the song maker keeps it: the settings and the notes in the notation of the songs. */
export interface SongDraft {
  title: string;
  /** Key signature: sharps (positive) or flats (negative). */
  fifths: number;
  beats: 2 | 3 | 4;
  melody: string;
}

export type DraftProblem = MelodyProblem | { kind: 'empty' } | { kind: 'name' } | { kind: 'tooLong'; max: number };

export type DraftResult = { ok: true; xml: string; measures: number } | { ok: false; problem: DraftProblem };

const MAJOR_BY_FIFTHS = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const MINOR_BY_FIFTHS = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];

/** The fifteen key signatures, each named after its major and its minor key. */
export const MAKER_KEYS: ReadonlyArray<{ fifths: number; major: string; minor: string }> = MAJOR_BY_FIFTHS.map((major, index) => ({
  fifths: index - 7,
  major,
  minor: MINOR_BY_FIFTHS[index],
}));

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Checks a song and builds its MusicXML, with the song itself written into it for editing. Never throws. */
export function buildDraft(draft: SongDraft): DraftResult {
  const title = draft.title.trim();
  if (title.length === 0 || title.length > MAX_TITLE) return { ok: false, problem: { kind: 'name' } };
  const melody = draft.melody.trim();
  try {
    const measures = parseMelody(melody, draft.beats, 4);
    if (measures.length === 0) return { ok: false, problem: { kind: 'empty' } };
    if (measures.length > MAX_MEASURES) return { ok: false, problem: { kind: 'tooLong', max: MAX_MEASURES } };
    const xml = buildSongXml({
      id: 'maker',
      title,
      composer: 'Song maker',
      difficulty: 'easy',
      category: 'folk',
      fifths: draft.fifths,
      beats: draft.beats,
      melody,
    });
    const source = JSON.stringify({ v: 1, title, fifths: draft.fifths, beats: draft.beats, melody });
    const field = `<miscellaneous><miscellaneous-field name="${SOURCE_FIELD}">${escapeXml(source)}</miscellaneous-field></miscellaneous>`;
    return { ok: true, xml: xml.replace('</identification>', `${field}</identification>`), measures: measures.length };
  } catch (error) {
    if (error instanceof MelodyError) return { ok: false, problem: error.problem };
    throw error;
  }
}

/** The song written into MusicXML by `buildDraft`, or null for any other file. */
export function readDraft(xml: string): SongDraft | null {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return null;
  const field = Array.from(doc.getElementsByTagName('miscellaneous-field')).find((el) => el.getAttribute('name') === SOURCE_FIELD);
  if (!field?.textContent) return null;
  try {
    const data = JSON.parse(field.textContent) as Record<string, unknown>;
    const { title, fifths, beats, melody } = data;
    if (typeof title !== 'string' || typeof melody !== 'string') return null;
    if (typeof fifths !== 'number' || !Number.isInteger(fifths) || fifths < -7 || fifths > 7) return null;
    if (beats !== 2 && beats !== 3 && beats !== 4) return null;
    return { title, fifths, beats, melody };
  } catch {
    return null;
  }
}

/** An id for a song of the song maker; it cannot clash with a library song (`rock-...`) or a file (`file-...`). */
export function newMakerId(now: number = Date.now(), random: () => number = Math.random): string {
  return `maker-${now.toString(36)}${Math.floor(random() * 36 ** 4).toString(36)}`;
}

export interface NoteParts {
  /** A letter A to G, or `r` for a rest. */
  letter: string;
  accidental: '' | '#' | 'b' | 'n';
  octave: number;
  length: 'w' | 'h' | 'q' | 'e' | 's';
  dotted: boolean;
}

/** The text of one note or rest in the notation of the songs. */
export function noteToken(parts: NoteParts): string {
  const length = `${parts.length}${parts.dotted ? '.' : ''}`;
  return parts.letter === 'r' ? `r${length}` : `${parts.letter}${parts.accidental}${parts.octave}${length}`;
}

/** How many beats the measure being written has so far, or null when the text cannot be read. */
function beatsInLastMeasure(text: string): number | null {
  const lastBar = text.lastIndexOf('|');
  const measure = text.slice(lastBar + 1).trim();
  if (measure.length === 0) return 0;
  try {
    const [notes] = parseMelody(measure, 4, 4, false);
    return notes.reduce((sum, note) => sum + note.duration, 0) / 4;
  } catch {
    return null;
  }
}

/** Adds a note to the text, and a bar line when the note fills the measure exactly. */
export function addToken(text: string, token: string, beats: number): string {
  const joined = text.trim().length === 0 ? token : `${text.trimEnd()} ${token}`;
  return beatsInLastMeasure(joined) === beats ? `${joined} |` : joined;
}

/** Takes the last note, rest or bar line off the end of the text. */
export function removeLastToken(text: string): string {
  const trimmed = text.trimEnd();
  const cut = trimmed.search(/\S+$/);
  return cut <= 0 ? '' : trimmed.slice(0, cut).trimEnd();
}
