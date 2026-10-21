import { fifthsOfNames } from './keySignature';
import { STEPS, STEP_SEMITONES, accidentalToken, parseNoteName, parsePitch, pitchMidi, type Alter, type Step } from './pitch';
import { getScale, parseFormula, type ScaleId } from './scaleCatalog';

const ALTERS: ReadonlySet<number> = new Set([-2, -1, -0.5, 0, 0.5, 1, 2]);

/** How a root can be written, for each of the twelve notes; the one with the fewest signs wins, the first listed on a tie. */
export const ROOT_SPELLINGS: Readonly<Record<number, readonly string[]>> = {
  0: ['C', 'B#'], 1: ['C#', 'Db'], 2: ['D'], 3: ['D#', 'Eb'], 4: ['E', 'Fb'], 5: ['F', 'E#'],
  6: ['F#', 'Gb'], 7: ['G'], 8: ['G#', 'Ab'], 9: ['A'], 10: ['A#', 'Bb'], 11: ['B', 'Cb'],
};

/** A note that lies above a root by so many letters (0 is the root's own letter) and so many semitones (a quarter tone is .5). */
export interface Degree {
  letterSteps: number;
  semitones: number;
}

/** How far a pitch (in semitones above C) is from the natural note of a letter, taken the short way round the octave. */
const alterOn = (step: Step, absolute: number): number => ((((absolute - STEP_SEMITONES[step] + 6) % 12) + 12) % 12) - 6;

/**
 * The names of notes above a root: each takes the letter `letterSteps` after the root's, with the sign that makes it
 * `semitones` above the root. A note three quarter tones from its letter (B flat koron) has no sign here, so it is
 * written from the next letter instead (A sori, the same pitch). Null when a note would need more than a double sign.
 * Throws for a root that is not a name.
 */
export function spellAbove(root: string, above: readonly Degree[]): string[] | null {
  const parsed = parseNoteName(root);
  if (!parsed || parsed.octave !== null) throw new Error(`"${root}" is not a note name without an octave`);
  const rootIndex = STEPS.indexOf(parsed.step);
  const rootSemitones = STEP_SEMITONES[parsed.step] + parsed.alter;
  const names: string[] = [];
  for (const { letterSteps, semitones } of above) {
    const index = (rootIndex + letterSteps) % 7;
    const absolute = rootSemitones + semitones;
    let step = STEPS[index];
    let alter = alterOn(step, absolute);
    if (Math.abs(alter) === 1.5) {
      // toward the sign: a note 1.5 below its letter is half a tone from the letter below, and the same above
      const neighbour = STEPS[(index + (alter < 0 ? -1 : 1) + 7) % 7];
      if (ALTERS.has(alterOn(neighbour, absolute))) {
        step = neighbour;
        alter = alterOn(neighbour, absolute);
      }
    }
    if (!ALTERS.has(alter)) return null;
    names.push(`${step}${accidentalToken(alter as Alter)}`);
  }
  return names;
}

/** A scale written out on a root. */
export interface SpelledScale {
  id: ScaleId;
  /** The root as written: `Db`, `F#`, `Ek`. */
  root: string;
  /** The notes from the root up, without octaves and without the root repeated: `['D', 'Ek', 'F', ...]`. */
  names: string[];
  /** The same notes from the root in the octave asked for, ending with the root an octave higher. */
  pitches: string[];
  /** Each note's distance from the root in semitones, a quarter tone as .5. */
  offsets: number[];
  /** The key signature, sharps positive and flats negative, for a mode of the major scale; null for any other scale. */
  fifths: number | null;
  /** True when a note is a quarter tone. */
  hasQuarterTones: boolean;
}

/** How many signs the notes carry; a quarter tone counts one, and a double sign is made so costly that it is used only when there is no other way. */
function cost(names: readonly string[], fifths: number | null): number {
  const doubles = names.some((name) => /##|bb/.test(name.slice(1)));
  const signs = fifths !== null ? Math.abs(fifths) : names.reduce((sum, name) => sum + (name.length - 1), 0);
  return (doubles ? 1000 : 0) + signs;
}

/** Each note in the first octave, counting from `octave`, that lies above the note before it: `['C', 'E', 'G']` from 4 is C4, E4, G4. */
export function ascendFrom(names: readonly string[], octave = 4): string[] {
  const out: string[] = [];
  let previous = -Infinity;
  for (const name of names) {
    let at = octave;
    while (out.length > 0 && pitchMidi(parsePitch(`${name}${at}`)!) <= previous) at++;
    out.push(`${name}${at}`);
    previous = pitchMidi(parsePitch(`${name}${at}`)!);
  }
  return out;
}

/**
 * A scale on a root. A number is one of the twelve notes (0 is C): it is written with the fewest signs, and without a
 * double sign if another spelling avoids it. A text is a root as it is written (`Db`, `Ek`) and is used as it is.
 */
export function spellScale(root: number | string, id: ScaleId, octave = 4): SpelledScale {
  const def = getScale(id);
  const notes = parseFormula(def.formula);
  const above = notes.map((note) => ({ letterSteps: note.degree - 1, semitones: note.offset }));
  if (typeof root === 'number' && !(Number.isInteger(root) && root >= 0 && root <= 11)) throw new Error(`"${root}" is not one of the twelve notes (0 to 11)`);
  const candidates = typeof root === 'number' ? ROOT_SPELLINGS[root] : [root];

  let best: { root: string; names: string[]; fifths: number | null; cost: number } | null = null;
  for (const candidate of candidates) {
    const names = spellAbove(candidate, above);
    if (!names) continue;
    const fifths = def.keySignature ? fifthsOfNames(names) : null;
    const total = cost(names, fifths);
    if (!best || total < best.cost) best = { root: candidate, names, fifths, cost: total };
  }
  if (!best) throw new Error(`The ${id} scale on ${candidates.join(' or ')} needs more than a double sign`);

  return {
    id,
    root: best.root,
    names: best.names,
    pitches: ascendFrom([...best.names, best.root], octave),
    offsets: notes.map((note) => note.offset),
    fifths: best.fifths,
    hasQuarterTones: best.names.some((name) => /[ko]$/.test(name)),
  };
}
