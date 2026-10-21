import { Interval } from 'tonal';
import { spellAbove, type Degree } from './spell';

export const CHORD_FAMILIES = ['triad', 'sixth', 'seventh', 'suspended', 'power', 'quartal', 'ninth', 'eleventh', 'thirteenth', 'add', 'altered'] as const;
export type ChordFamily = (typeof CHORD_FAMILIES)[number];

export interface ChordDef {
  id: string;
  family: ChordFamily;
  /** What follows the root in the name of the chord: `m7b5` makes `Cm7b5`. */
  symbol: string;
  /** The notes as intervals above the root, in the names `tonal` uses: `1P 3m 5d`. */
  formula: readonly string[];
  /** What follows the Roman numeral: `°7`, `maj7`, `ø7`. */
  romanSuffix: string;
}

function chord(id: string, family: ChordFamily, symbol: string, formula: string, romanSuffix: string): ChordDef {
  return { id, family, symbol, formula: formula.split(' '), romanSuffix };
}

/** The chords of the dictionary, family by family. A name the student reads is in the translations (`chord.name.<id>`). */
export const CHORD_DEFS: readonly ChordDef[] = [
  chord('major', 'triad', '', '1P 3M 5P', ''),
  chord('minor', 'triad', 'm', '1P 3m 5P', ''),
  chord('dim', 'triad', 'dim', '1P 3m 5d', '°'),
  chord('aug', 'triad', 'aug', '1P 3M 5A', '+'),

  chord('six', 'sixth', '6', '1P 3M 5P 6M', '6'),
  chord('m6', 'sixth', 'm6', '1P 3m 5P 6M', '6'),

  chord('maj7', 'seventh', 'maj7', '1P 3M 5P 7M', 'maj7'),
  chord('dom7', 'seventh', '7', '1P 3M 5P 7m', '7'),
  chord('m7', 'seventh', 'm7', '1P 3m 5P 7m', '7'),
  chord('m7b5', 'seventh', 'm7b5', '1P 3m 5d 7m', 'ø7'),
  chord('dim7', 'seventh', 'dim7', '1P 3m 5d 7d', '°7'),
  chord('mMaj7', 'seventh', 'mMaj7', '1P 3m 5P 7M', 'maj7'),
  chord('aug7', 'seventh', '7#5', '1P 3M 5A 7m', '+7'),
  chord('augMaj7', 'seventh', 'maj7#5', '1P 3M 5A 7M', '+maj7'),

  chord('sus2', 'suspended', 'sus2', '1P 2M 5P', 'sus2'),
  chord('sus4', 'suspended', 'sus4', '1P 4P 5P', 'sus4'),
  chord('dom7sus4', 'suspended', '7sus4', '1P 4P 5P 7m', '7sus4'),

  chord('power', 'power', '5', '1P 5P', '5'),

  chord('quartal', 'quartal', 'Quartal', '1P 4P 7m', ''),
  chord('quintal', 'quartal', 'Quintal', '1P 5P 9M', ''),

  chord('dom9', 'ninth', '9', '1P 3M 5P 7m 9M', '9'),
  chord('maj9', 'ninth', 'maj9', '1P 3M 5P 7M 9M', 'maj9'),
  chord('m9', 'ninth', 'm9', '1P 3m 5P 7m 9M', '9'),

  chord('dom11', 'eleventh', '11', '1P 3M 5P 7m 9M 11P', '11'),
  chord('m11', 'eleventh', 'm11', '1P 3m 5P 7m 9M 11P', '11'),
  chord('maj11', 'eleventh', 'maj11', '1P 3M 5P 7M 9M 11P', 'maj11'),

  chord('dom13', 'thirteenth', '13', '1P 3M 5P 7m 9M 13M', '13'),
  chord('m13', 'thirteenth', 'm13', '1P 3m 5P 7m 9M 13M', '13'),
  chord('maj13', 'thirteenth', 'maj13', '1P 3M 5P 7M 9M 13M', 'maj13'),

  chord('add9', 'add', 'add9', '1P 3M 5P 9M', 'add9'),
  chord('madd9', 'add', 'madd9', '1P 3m 5P 9M', 'add9'),
  chord('add11', 'add', 'add11', '1P 3M 5P 11P', 'add11'),

  chord('dom7b9', 'altered', '7b9', '1P 3M 5P 7m 9m', '7♭9'),
  chord('dom7s9', 'altered', '7#9', '1P 3M 5P 7m 9A', '7♯9'),
  chord('dom7b5', 'altered', '7b5', '1P 3M 5d 7m', '7♭5'),
  chord('dom7s11', 'altered', '7#11', '1P 3M 5P 7m 11A', '7♯11'),
  chord('dom7b13', 'altered', '7b13', '1P 3M 5P 7m 13m', '7♭13'),
];

const BY_ID: ReadonlyMap<string, ChordDef> = new Map(CHORD_DEFS.map((d) => [d.id, d]));

export function getChord(id: string): ChordDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown chord "${id}"`);
  return found;
}

export function chordsOfFamily(family: ChordFamily): ChordDef[] {
  return CHORD_DEFS.filter((d) => d.family === family);
}

const degreeCache = new Map<string, Degree[]>();

/** The notes of a chord as letters and semitones above the root, ready for `spellAbove`. */
export function chordDegrees(def: ChordDef): Degree[] {
  let degrees = degreeCache.get(def.id);
  if (!degrees) {
    degrees = def.formula.map((name) => {
      const interval = Interval.get(name);
      return { letterSteps: interval.step, semitones: interval.semitones };
    });
    degreeCache.set(def.id, degrees);
  }
  return degrees;
}

/** True when the chord has a minor third: its Roman numeral is then written in lower case (ii, vii°). */
export function hasMinorThird(def: ChordDef): boolean {
  return def.formula.includes('3m');
}

/** The notes of a chord on a root, with the spelling that harmony asks for (B dim7 is B D F A flat); null when that needs more than a double sign. */
export function spellChord(root: string, def: ChordDef): string[] | null {
  return spellAbove(root, chordDegrees(def));
}
