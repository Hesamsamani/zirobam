import { pickOne, type Rng } from '../core/rng';
import { getChord, type ChordDef } from '../theory/chordCatalog';
import { spell } from './chordDetect';

export const CHORD_STAGES = 5;

export interface ChordQuestion {
  stage: number;
  /** The root as written: `Bb`. */
  root: string;
  rootPc: number;
  def: ChordDef;
  /** The notes to play, spelled the way harmony asks for, from the root up. */
  notes: string[];
  /** The note that must be lowest, for a turned chord; null when any note may be. */
  bass: string | null;
  inversion: number;
  /** What the question shows: `Bb`, `Cm7`, `C/E`. */
  symbol: string;
  /** A key for the statistics of this chord. */
  key: string;
}

interface StageSpec {
  naturalRoots: boolean;
  chords: readonly string[];
  inversions: boolean;
}

/** From the easiest: major and minor on the white keys, then every root, then more kinds, sevenths, and turned chords. */
const STAGES: readonly StageSpec[] = [
  { naturalRoots: true, chords: ['major', 'minor'], inversions: false },
  { naturalRoots: false, chords: ['major', 'minor'], inversions: false },
  { naturalRoots: false, chords: ['major', 'minor', 'dim', 'aug', 'sus2', 'sus4'], inversions: false },
  { naturalRoots: false, chords: ['maj7', 'dom7', 'm7', 'm7b5'], inversions: false },
  { naturalRoots: false, chords: ['major', 'minor', 'dim', 'maj7', 'dom7', 'm7'], inversions: true },
];

const NATURAL_PCS = [0, 2, 4, 5, 7, 9, 11];
const pcOf = (midi: number): number => ((midi % 12) + 12) % 12;
const notePc = (note: string): number => {
  const letter = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[note[0] as 'C'];
  return (letter + note.slice(1).split('').reduce((sum, ch) => sum + (ch === '#' ? 1 : ch === 'b' ? -1 : 0), 0) + 120) % 12;
};

/** A question of a stage (1 to 5): a chord to play, never the one just asked. */
export function makeChordQuestion(stage: number, rng: Rng, previous: ChordQuestion | null = null): ChordQuestion {
  const spec = STAGES[Math.max(1, Math.min(CHORD_STAGES, Math.floor(stage))) - 1];
  for (let attempt = 0; ; attempt++) {
    const rootPc = spec.naturalRoots ? pickOne(rng, NATURAL_PCS) : Math.floor(rng() * 12);
    const def = getChord(pickOne(rng, spec.chords));
    const spelled = spell(rootPc, def);
    if (!spelled) continue;
    const inversion = spec.inversions ? Math.floor(rng() * spelled.notes.length) : 0;
    const bass = inversion > 0 ? spelled.notes[inversion] : null;
    const symbol = `${spelled.root}${def.symbol}${bass ? `/${bass}` : ''}`;
    // another chord than the last one; after a few tries any chord will do
    if (previous && previous.symbol === symbol && attempt < 20) continue;
    return { stage, root: spelled.root, rootPc, def, notes: spelled.notes, bass, inversion, symbol, key: symbol };
  }
}

/** True when the keys are the notes of the chord (any octave, any doubling) and, for a turned chord, the bass is lowest. */
export function judgeChord(question: ChordQuestion, midis: readonly number[]): boolean {
  if (midis.length === 0) return false;
  const wanted = new Set(question.notes.map(notePc));
  const played = new Set(midis.map(pcOf));
  if (wanted.size !== played.size || ![...wanted].every((pc) => played.has(pc))) return false;
  return question.bass === null || pcOf(Math.min(...midis)) === notePc(question.bass);
}
