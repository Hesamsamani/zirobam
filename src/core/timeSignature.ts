/** A time signature as the app keeps it: 6/8 is `{ beats: 6, beatType: 8 }`. */
export interface TimeSig {
  beats: number;
  beatType: number;
}

/**
 * The length of a measure in quarter notes, which is what the transport counts whatever a beat is in the
 * time signature: 4 in 4/4, 3 in 3/4 and in 6/8, 4 in 2/2. It is not a whole number in 3/8 (1.5).
 */
export function beatsPerMeasure(sig: TimeSig): number {
  return (sig.beats * 4) / sig.beatType;
}

/** The number of clicks of the count-in: one for each quarter note of a bar, a whole number, at least one. */
export function countInBeats(sig: TimeSig): number {
  return Math.max(1, Math.round(beatsPerMeasure(sig)));
}
