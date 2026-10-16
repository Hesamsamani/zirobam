import type { NoteData } from '../musicGenerator';

/** Which hand the student practises: the other one is played by the app. */
export type HandChoice = 'both' | 'right' | 'left';

/** What happens at one moment of a piece: the notes the student plays and the notes the app plays. */
export interface TimingEvent {
  /** Start time in beats. */
  time: number;
  /** Duration in beats. */
  duration: number;
  /** The notes to play at this moment (e.g. ['C4', 'E4', 'G4']). Empty for a rest. */
  pitches: string[];
  /** True if any of the pitches is held over a tie. */
  isTieContinuation?: boolean;
  /** The pitches that are only held (no new key press). */
  tiedPitches?: string[];
  /** Notes of the hand that is not practised: the app plays them, the student does not. */
  accompaniment?: string[];
}

/** A pitch string like 'C4', 'F#5' or 'Bb3', or null for a rest. */
export function noteDataToPitch(note: NoteData): string | null {
  if (note.isRest) return null;
  let name = note.step;
  if (note.alter === 1) name += '#';
  else if (note.alter === -1) name += 'b';
  return `${name}${note.octave}`;
}

/** All pitches of a note, including the notes of a chord. */
export function getAllPitchesFromNote(note: NoteData): string[] {
  if (note.isRest) return [];
  const pitches: string[] = [];
  const main = noteDataToPitch(note);
  if (main) pitches.push(main);
  for (const chordNote of note.chordNotes ?? []) {
    let name = chordNote.step;
    if (chordNote.alter === 1) name += '#';
    else if (chordNote.alter === -1) name += 'b';
    pitches.push(`${name}${chordNote.octave}`);
  }
  return pitches;
}

/** The same key written with sharps, so that a flat and its sharp compare as equal. */
export function normalizeNote(note: string): string {
  return note
    .replace('Db', 'C#')
    .replace('Eb', 'D#')
    .replace('Fb', 'E')
    .replace('Gb', 'F#')
    .replace('Ab', 'G#')
    .replace('Bb', 'A#')
    .replace('Cb', 'B');
}

const hasPitches = (notes: readonly NoteData[]): boolean => notes.some((n) => !n.isRest);

/** The hand that is really practised: a hand that only rests in this piece cannot be asked for. */
export function effectiveHand(right: readonly NoteData[], left: readonly NoteData[], hand: HandChoice): HandChoice {
  if (hand === 'right' && !hasPitches(right)) return 'both';
  if (hand === 'left' && !hasPitches(left)) return 'both';
  return hand;
}

const roundTime = (t: number): number => Math.round(t * 1000) / 1000;

interface Draft {
  duration: number;
  pitches: string[];
  tied: string[];
  accompaniment: string[];
}

/**
 * The moments of a piece, in order: where every note of either hand starts, with the notes to play.
 * With one hand chosen, only that hand's notes are asked for; the other hand's notes go to `accompaniment`
 * (except those that are only held over a tie, which are still ringing).
 */
export function buildTimingEventList(right: readonly NoteData[], left: readonly NoteData[], hand: HandChoice = 'both'): TimingEvent[] {
  const drafts = new Map<number, Draft>();

  const add = (notes: readonly NoteData[], practised: boolean): void => {
    let time = 0;
    for (const note of notes) {
      const key = roundTime(time);
      const pitches = getAllPitchesFromNote(note);
      const held = note.tieEnd === true && !note.isRest;
      let draft = drafts.get(key);
      if (!draft) {
        draft = { duration: note.duration, pitches: [], tied: [], accompaniment: [] };
        drafts.set(key, draft);
      } else if (note.duration < draft.duration) {
        draft.duration = note.duration; // the shortest note at this moment
      }
      if (practised) {
        draft.pitches.push(...pitches);
        if (held) draft.tied.push(...pitches);
      } else if (!held) {
        draft.accompaniment.push(...pitches);
      }
      time += note.duration;
    }
  };
  add(right, hand !== 'left');
  add(left, hand !== 'right');

  const times = [...drafts.keys()].sort((a, b) => a - b);
  return times.map((time, i) => {
    const draft = drafts.get(time)!;
    const next = i < times.length - 1 ? times[i + 1] : time + draft.duration;
    const hasTied = draft.tied.length > 0;
    return {
      time,
      duration: next - time,
      pitches: draft.pitches,
      isTieContinuation: hasTied,
      tiedPitches: hasTied ? draft.tied : undefined,
      accompaniment: draft.accompaniment.length > 0 ? draft.accompaniment : undefined,
    };
  });
}
