import { describe, it, expect } from 'vitest';
import { didPassPiece, MIN_PLAYED_FRACTION } from '../core/passRules';

describe('didPassPiece', () => {
  it('passes when every note was played without a mistake', () => {
    expect(didPassPiece({ hadMistake: false, notesPlayed: 16, notesRequired: 16 })).toBe(true);
  });

  it('does not pass after a mistake, even if enough notes were played', () => {
    expect(didPassPiece({ hadMistake: true, notesPlayed: 16, notesRequired: 16 })).toBe(false);
  });

  it('does not pass when nothing was played (the piece just ran to the end)', () => {
    expect(didPassPiece({ hadMistake: false, notesPlayed: 0, notesRequired: 16 })).toBe(false);
  });

  it('needs at least the minimum share of the notes', () => {
    const required = 10;
    const needed = Math.ceil(required * MIN_PLAYED_FRACTION);
    expect(didPassPiece({ hadMistake: false, notesPlayed: needed - 1, notesRequired: required })).toBe(false);
    expect(didPassPiece({ hadMistake: false, notesPlayed: needed, notesRequired: required })).toBe(true);
  });

  it('passes a piece that has no notes to play', () => {
    expect(didPassPiece({ hadMistake: false, notesPlayed: 0, notesRequired: 0 })).toBe(true);
  });
});
