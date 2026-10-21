import { CHORD_DEFS, chordDegrees, spellChord, type ChordDef } from '../theory/chordCatalog';
import { ROOT_SPELLINGS } from '../theory/spell';

export interface ChordReading {
  /** The root as written: `Bb`. */
  root: string;
  rootPc: number;
  def: ChordDef;
  /** The notes of the chord from its root up, spelled the way harmony asks for. */
  notes: string[];
  /** The lowest note when it is not the root (`C/E`), otherwise null. */
  bass: string | null;
  /** 0 for the root position, 1 for the first turn, and so on. */
  inversion: number;
  /** `Cmaj7`, `C/E`. */
  symbol: string;
}

const pcOf = (midi: number): number => ((midi % 12) + 12) % 12;

/** The notes of each chord of the catalog as a set of semitones above its root, for matching. */
const SHAPES = CHORD_DEFS.map((def) => ({ def, tones: new Set(chordDegrees(def).map((d) => d.semitones % 12)) }));

/** How many signs the notes carry; a double sign makes the spelling nearly unusable. */
function cost(notes: readonly string[]): number {
  return notes.reduce((sum, note) => sum + (note.length - 1) + (/##|bb/.test(note.slice(1)) ? 1000 : 0), 0);
}

/** The root written with the fewest signs for the chord it makes: D flat major, F sharp minor. */
export function spell(rootPc: number, def: ChordDef): { root: string; notes: string[] } | null {
  let best: { root: string; notes: string[]; cost: number } | null = null;
  for (const root of ROOT_SPELLINGS[rootPc]) {
    const notes = spellChord(root, def);
    if (!notes) continue;
    const total = cost(notes);
    if (!best || total < best.cost) best = { root, notes, cost: total };
  }
  return best ? { root: best.root, notes: best.notes } : null;
}

/**
 * What chord the keys make, as the dictionary names it. The keys are taken as a set of notes whatever their octave;
 * a chord whose root is the lowest key is preferred (A C E G is Am7, not C6 over A). Two notes a fifth apart are a
 * power chord; fewer than that, or notes that fit no chord of the catalog, have no name (null).
 */
export function detectChord(midis: readonly number[]): ChordReading | null {
  if (midis.length === 0) return null;
  const bassPc = pcOf(Math.min(...midis));
  const pcs = new Set(midis.map(pcOf));
  if (pcs.size < 2) return null;

  const matches: { rootPc: number; def: ChordDef }[] = [];
  for (const root of pcs) {
    const tones = new Set([...pcs].map((pc) => (pc - root + 12) % 12));
    for (const shape of SHAPES) {
      if (shape.tones.size === tones.size && [...tones].every((tone) => shape.tones.has(tone))) matches.push({ rootPc: root, def: shape.def });
    }
  }
  if (matches.length === 0) return null;
  // the chord whose root is the lowest note first, then the order of the catalog
  matches.sort((a, z) => Number(z.rootPc === bassPc) - Number(a.rootPc === bassPc) || CHORD_DEFS.indexOf(a.def) - CHORD_DEFS.indexOf(z.def));

  for (const match of matches) {
    const spelled = spell(match.rootPc, match.def);
    if (!spelled) continue;
    const bassIndex = spelled.notes.findIndex((note) => pcOf(noteMidi(note)) === bassPc);
    const bass = match.rootPc === bassPc || bassIndex < 0 ? null : spelled.notes[bassIndex];
    return {
      root: spelled.root,
      rootPc: match.rootPc,
      def: match.def,
      notes: spelled.notes,
      bass,
      inversion: bass === null ? 0 : bassIndex,
      symbol: `${spelled.root}${match.def.symbol}${bass ? `/${bass}` : ''}`,
    };
  }
  return null;
}

/** The key class of a note name without octave, from 0 to 11. */
function noteMidi(note: string): number {
  const letter = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[note[0] as 'C'];
  const signs = note.slice(1);
  const alter = signs.split('').reduce((sum, ch) => sum + (ch === '#' ? 1 : ch === 'b' ? -1 : 0), 0);
  return letter + alter + 120;
}
