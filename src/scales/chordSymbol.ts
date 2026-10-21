import type { ScaleChord } from '../theory/diatonic';

/** The name of a chord as it is read: `Bbm7`, `C/E`, with the note names the student has chosen. */
export function chordSymbol(chord: ScaleChord, formatName: (note: string) => string): string {
  return `${formatName(chord.root)}${chord.def.symbol}${chord.bass ? `/${formatName(chord.bass)}` : ''}`;
}
