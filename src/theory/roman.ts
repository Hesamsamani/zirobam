import { hasMinorThird, type ChordDef } from './chordCatalog';
import { STEPS, STEP_SEMITONES, parseNoteName } from './pitch';

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;
/** Semitones from the tonic to the degrees of the major scale: the measure every numeral is taken against. */
const MAJOR_OFFSET = [0, 2, 4, 5, 7, 9, 11] as const;
/** A sign before a numeral; k and o are the quarter tones when the scale itself starts on one. */
const SIGN: Readonly<Record<number, string>> = { [-2]: '♭♭', [-1]: '♭', [-0.5]: 'k', [0]: '', [0.5]: 'o', [1]: '♯', [2]: '♯♯' };

function readName(name: string) {
  const parsed = parseNoteName(name);
  if (!parsed || parsed.octave !== null) throw new Error(`"${name}" is not a note name without an octave`);
  return { index: STEPS.indexOf(parsed.step), semitones: STEP_SEMITONES[parsed.step] + parsed.alter };
}

/**
 * The Roman numeral of a chord in a scale: the degree is the letter of the chord's root counted from the scale's root,
 * a flat or a sharp stands before it when the root is not on the major scale of the same root (♭III, ♭VII), a small
 * letter means a minor third (ii, vii°), and what the chord adds follows (7, maj7, ø7, °7, sus4, 13). A minor scale is
 * numbered against the major scale on its root, so A minor is i, ii°, ♭III, iv, v, ♭VI, ♭VII.
 */
export function romanNumeral(scaleRoot: string, chordRoot: string, def: ChordDef): string {
  const scale = readName(scaleRoot);
  const chord = readName(chordRoot);
  const steps = (chord.index - scale.index + 7) % 7;
  const above = (((chord.semitones - scale.semitones) % 12) + 12) % 12;
  const alter = ((((above - MAJOR_OFFSET[steps] + 6) % 12) + 12) % 12) - 6;
  const numeral = hasMinorThird(def) ? NUMERALS[steps].toLowerCase() : NUMERALS[steps];
  return `${SIGN[alter] ?? ''}${numeral}${def.romanSuffix}`;
}
