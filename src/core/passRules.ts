/** A piece counts as passed only if at least this share of its notes was actually played. */
export const MIN_PLAYED_FRACTION = 0.8;

export interface PieceResult {
  hadMistake: boolean;
  notesPlayed: number;
  notesRequired: number;
}

/**
 * Whether a finished piece counts as passed. Letting the piece run to the end without playing it
 * must not count, otherwise the levels would advance by themselves.
 */
export function didPassPiece({ hadMistake, notesPlayed, notesRequired }: PieceResult): boolean {
  if (hadMistake) return false;
  return notesRequired === 0 || notesPlayed >= notesRequired * MIN_PLAYED_FRACTION;
}
