import { Chord, Key, Note, Scale } from 'tonal';

/** The twelve starting notes, as pitch classes: 0 is C, 1 is C sharp or D flat, and so on. */
export const ROOT_PITCH_CLASSES: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export type ScaleType = 'major' | 'minor' | 'harmonic' | 'melodic' | 'pentaMajor' | 'pentaMinor';
export type ChordType = 'major' | 'minor' | 'dim' | 'aug' | 'maj7' | 'm7' | 'dom7';

export const SCALE_TYPES: readonly ScaleType[] = ['major', 'minor', 'harmonic', 'melodic', 'pentaMajor', 'pentaMinor'];
export const CHORD_TYPES: readonly ChordType[] = ['major', 'minor', 'dim', 'aug', 'maj7', 'm7', 'dom7'];

/** The names tonal knows these by. */
const SCALE_NAMES: Readonly<Record<ScaleType, string>> = {
  major: 'major',
  minor: 'minor',
  harmonic: 'harmonic minor',
  melodic: 'melodic minor',
  pentaMajor: 'major pentatonic',
  pentaMinor: 'minor pentatonic',
};
const CHORD_SYMBOLS: Readonly<Record<ChordType, string>> = {
  major: 'M', minor: 'm', dim: 'dim', aug: 'aug', maj7: 'maj7', m7: 'm7', dom7: '7',
};

/** How a starting note can be spelled; the one with the fewest signs wins, and one that needs a double sign never does if another does not. */
const SPELLINGS: Readonly<Record<number, readonly string[]>> = {
  0: ['C', 'B#'], 1: ['C#', 'Db'], 2: ['D'], 3: ['D#', 'Eb'], 4: ['E', 'Fb'], 5: ['F', 'E#'],
  6: ['F#', 'Gb'], 7: ['G'], 8: ['G#', 'Ab'], 9: ['A'], 10: ['A#', 'Bb'], 11: ['B', 'Cb'],
};

/** A scale or chord written out: the notes with their octaves, going up. */
export interface Spelled {
  /** The starting note as it is written ("Db"). */
  root: string;
  /** From the root in octave 4 upwards. A scale ends on the root an octave higher. */
  notes: string[];
  /** The key signature when the scale has one (the major and the natural minor scales); null otherwise. */
  fifths: number | null;
  /** The kind of scale; a chord has none. */
  scaleType?: ScaleType;
}

const signs = (note: string): number => (note.match(/[#b]/g) ?? []).length;
const hasDouble = (note: string): boolean => /##|bb/.test(note);

/** The notes in order, each in the first octave from `startOctave` that lies above the one before. */
function ascend(names: readonly string[], startOctave: number): string[] {
  const out: string[] = [];
  let previous = -1;
  for (const name of names) {
    let octave = startOctave;
    while ((Note.midi(`${name}${octave}`) ?? 0) <= previous) octave++;
    out.push(`${name}${octave}`);
    previous = Note.midi(`${name}${octave}`) ?? previous;
  }
  return out;
}

function best<T extends { score: number }>(candidates: T[]): T {
  return candidates.reduce((a, b) => (b.score < a.score ? b : a));
}

/** The scale starting on a pitch class, spelled without double signs and with as few signs as possible. */
export function scaleOf(pitchClass: number, type: ScaleType): Spelled {
  const candidates = SPELLINGS[pitchClass].map((root) => {
    const names = Scale.get(`${root} ${SCALE_NAMES[type]}`).notes;
    const fifths = type === 'major' ? Key.majorKey(root).alteration : type === 'minor' ? Key.minorKey(root).alteration : null;
    const double = names.some(hasDouble);
    const score = (double ? 1000 : 0) + (fifths === null ? names.reduce((sum, n) => sum + signs(n), 0) : Math.abs(fifths));
    return { root, names, fifths, score };
  });
  const chosen = best(candidates);
  return { root: chosen.root, notes: ascend([...chosen.names, chosen.root], 4), fifths: chosen.fifths, scaleType: type };
}

/** The chord on a pitch class, going up from the root in octave 4. */
export function chordOf(pitchClass: number, type: ChordType): Spelled {
  const candidates = SPELLINGS[pitchClass].map((root) => {
    const names = Chord.get(`${root}${CHORD_SYMBOLS[type]}`).notes;
    const score = (names.some(hasDouble) ? 1000 : 0) + names.reduce((sum, n) => sum + signs(n), 0);
    return { root, names, score };
  });
  const chosen = best(candidates);
  return { root: chosen.root, notes: ascend(chosen.names, 4), fifths: null };
}

type Fingers = readonly number[];
const RH_STANDARD: Fingers = [1, 2, 3, 1, 2, 3, 4, 5];
const LH_STANDARD: Fingers = [5, 4, 3, 2, 1, 3, 2, 1];

/** The agreed fingering of the common scales, one octave up. Only keys named with a white key and no signs. */
const FINGERING: Record<string, { right: Fingers; left: Fingers }> = {
  'C:major': { right: RH_STANDARD, left: LH_STANDARD },
  'D:major': { right: RH_STANDARD, left: LH_STANDARD },
  'E:major': { right: RH_STANDARD, left: LH_STANDARD },
  'G:major': { right: RH_STANDARD, left: LH_STANDARD },
  'A:major': { right: RH_STANDARD, left: LH_STANDARD },
  'F:major': { right: [1, 2, 3, 4, 1, 2, 3, 4], left: LH_STANDARD },
  'B:major': { right: RH_STANDARD, left: [4, 3, 2, 1, 4, 3, 2, 1] },
};
for (const root of ['A', 'E', 'D']) {
  for (const type of ['minor', 'harmonic', 'melodic']) FINGERING[`${root}:${type}`] = { right: RH_STANDARD, left: LH_STANDARD };
}

/** The finger numbers under the notes of a scale, or null when this scale has no agreed fingering (or is a chord). */
export function fingering(spelled: Spelled, hand: 'right' | 'left'): number[] | null {
  if (!spelled.scaleType) return null;
  const entry = FINGERING[`${spelled.root}:${spelled.scaleType}`];
  return entry ? [...entry[hand]] : null;
}
