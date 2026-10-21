import { parseNoteName } from './pitch';

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
/** The key signatures from none outwards, so that the simplest fit is found first. */
const SIGNATURES = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7];

/** The sign a key signature (sharps positive, flats negative) puts on a letter: 1, -1 or 0. */
export function keyAlter(step: string, fifths: number): number {
  if (fifths > 0 && SHARP_ORDER.slice(0, fifths).includes(step)) return 1;
  if (fifths < 0 && FLAT_ORDER.slice(0, -fifths).includes(step)) return -1;
  return 0;
}

/**
 * The key signature that gives seven notes the signs they have, when there is one: every letter once, and each
 * letter altered the way the key signature alters it. Null for anything else (a scale with a raised seventh,
 * a quarter tone, a double sign, fewer notes).
 */
export function fifthsOfNames(names: readonly string[]): number | null {
  const parsed = names.map(parseNoteName);
  if (parsed.length !== 7 || parsed.some((note) => note === null)) return null;
  if (new Set(parsed.map((note) => note!.step)).size !== 7) return null;
  return SIGNATURES.find((fifths) => parsed.every((note) => note!.alter === keyAlter(note!.step, fifths))) ?? null;
}
