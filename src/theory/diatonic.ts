import { CHORD_DEFS, chordDegrees, spellChord, type ChordDef, type ChordFamily } from './chordCatalog';
import { STEP_SEMITONES, parseNoteName } from './pitch';
import { romanNumeral } from './roman';
import type { SpelledScale } from './spell';

/** A chord of a scale. */
export interface ScaleChord {
  /** The place of its root in the scale: 1 for the first note. */
  degree: number;
  roman: string;
  def: ChordDef;
  /** The root as written, without octave: `Bb`. */
  root: string;
  /** What the chord is called: `Bbm7`, or `Bbm7/Ab` for an inversion. */
  symbol: string;
  /** The notes from the lowest up, with the spelling that harmony asks for. */
  notes: string[];
  noteCount: number;
  /** 0 for the root position, 1 for the first inversion, and so on. */
  inversion: number;
  /** The lowest note, for an inversion. */
  bass?: string;
  /** One of the main chords: the major or minor triad on the first, fourth or fifth degree. */
  primary: boolean;
}

export interface ChordFilter {
  /** Only these families (all when left out). */
  families?: readonly ChordFamily[];
  /** Only the chords on this degree of the scale. */
  degree?: number | null;
  /** Only the main chords. */
  primaryOnly?: boolean;
}

/** A pitch in half semitones, round the octave: a quarter tone is a whole number of these. */
const halfStep = (semitones: number): number => (((Math.round(semitones * 2) % 24) + 24) % 24);
/** The distances from the scale's root that make a chord a main one: the root itself, a fourth and a fifth above it. */
const MAIN_OFFSETS: readonly number[] = [0, 5, 7];

/**
 * The chords of a scale, by degree and then in the order of the catalog. A chord is in the scale when every one of
 * its notes is: the quarter tones of a Persian mode are no root and no chord tone, so only the notes of the piano make chords.
 */
export function chordsOfScale(scale: SpelledScale, filter: ChordFilter = {}): ScaleChord[] {
  const root = parseNoteName(scale.root);
  if (!root) throw new Error(`"${scale.root}" is not a note name`);
  const rootSemitones = STEP_SEMITONES[root.step] + root.alter;
  const inScale = new Set(scale.offsets.map((offset) => halfStep(rootSemitones + offset)));

  const found: ScaleChord[] = [];
  scale.names.forEach((name, index) => {
    const degree = index + 1;
    const absolute = rootSemitones + scale.offsets[index];
    if (!Number.isInteger(absolute)) return; // a quarter tone is not a root
    if (filter.degree != null && filter.degree !== degree) return;
    for (const def of CHORD_DEFS) {
      if (filter.families && !filter.families.includes(def.family)) continue;
      if (!chordDegrees(def).every((tone) => inScale.has(halfStep(absolute + tone.semitones)))) continue;
      const notes = spellChord(name, def);
      if (!notes) continue;
      const primary = def.family === 'triad' && (def.id === 'major' || def.id === 'minor') && MAIN_OFFSETS.includes(scale.offsets[index]);
      if (filter.primaryOnly && !primary) continue;
      found.push({ degree, roman: romanNumeral(scale.root, name, def), def, root: name, symbol: `${name}${def.symbol}`, notes, noteCount: notes.length, inversion: 0, primary });
    }
  });
  return found;
}

/** The chord with its root lowest again, whichever turn it is in. */
export function rootPositionOf(chord: ScaleChord): ScaleChord {
  if (chord.inversion === 0) return chord;
  const count = chord.notes.length;
  const notes = [...chord.notes.slice(count - chord.inversion), ...chord.notes.slice(0, count - chord.inversion)];
  return { ...chord, notes, inversion: 0, bass: undefined, symbol: `${chord.root}${chord.def.symbol}` };
}

/** Each turn of a chord, one for each note but the root: C is C/E and C/G, a seventh chord has three. */
export function inversionsOf(chord: ScaleChord): ScaleChord[] {
  const rootPosition = rootPositionOf(chord).notes;
  return Array.from({ length: rootPosition.length - 1 }, (_, i) => {
    const turn = i + 1;
    const notes = [...rootPosition.slice(turn), ...rootPosition.slice(0, turn)];
    return { ...chord, symbol: `${chord.root}${chord.def.symbol}/${notes[0]}`, notes, inversion: turn, bass: notes[0] };
  });
}
