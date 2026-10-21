import { keyName, parsePitch } from '../theory/pitch';

/**
 * Whether a drawn notehead is the one a pressed key plays. Verovio tells the letter and the octave a notehead sits on;
 * the notes the piece expects are written (`Bb3`), and a key is named with a sharp (`A#3`). So the notehead is the one when
 * an expected note is written on that letter and octave and is struck on that key. Comparing only the letters would
 * miss every flat: the A sharp key is B flat, which is drawn on B.
 */
export function noteheadMatchesKey(expected: readonly string[], step: string, octave: string, playedKey: string): boolean {
  return expected.some((note) => {
    const written = parsePitch(note);
    return written !== null && written.step === step && String(written.octave) === octave && keyName(note) === playedKey;
  });
}
