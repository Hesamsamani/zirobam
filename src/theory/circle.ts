/** A step of the circle of fifths: a major key and the minor key that shares its signature. */
export interface CircleKey {
  /** The major key as one of the twelve notes (0 is C). */
  major: number;
  /** The relative minor: a minor third below. */
  minor: number;
  /** The key signature: sharps positive, flats negative. The six-sharp key is written as F sharp (6), not G flat (-6). */
  fifths: number;
}

/** The twelve keys round the circle, from C clockwise by fifths. */
export function circleKeys(): CircleKey[] {
  return Array.from({ length: 12 }, (_, step) => {
    const major = (step * 7) % 12;
    // past six steps the circle is easier read with flats
    const fifths = step <= 6 ? step : step - 12;
    return { major, minor: (major + 9) % 12, fifths };
  });
}
