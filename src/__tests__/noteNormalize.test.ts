import { describe, it, expect } from 'vitest';
import { normalizeNote } from '../practice/timingEvents';
import { noteMatchesAny, normalizeNoteName, notesAreEqual } from '../core/noteUtils';

// The same key written with a sharp, so that a flat and its sharp compare as equal.
// Two functions did this with the same text replacements; both now follow one reading of the note.
const CASES: ReadonlyArray<readonly [string, string]> = [
  ['C4', 'C4'],
  ['C#4', 'C#4'],
  ['Db4', 'C#4'],
  ['Eb4', 'D#4'],
  ['Gb4', 'F#4'],
  ['Ab4', 'G#4'],
  ['Bb4', 'A#4'],
  ['Fb4', 'E4'],
  // the octave follows the key, not the letter
  ['Cb5', 'B4'],
  ['B#3', 'C4'],
  ['E#4', 'F4'],
  // double signs
  ['Dbb4', 'C4'],
  ['Bbb3', 'A3'],
  ['F##4', 'G4'],
  ['B##3', 'C#4'],
  // a quarter tone is on the key of its letter
  ['Ek4', 'E4'],
  ['Co4', 'C4'],
  // names without an octave
  ['Db', 'C#'],
  ['Cb', 'B'],
  ['G', 'G'],
];

describe.each([
  ['normalizeNote (practice)', normalizeNote],
  ['normalizeNoteName (core)', normalizeNoteName],
])('%s', (_name, normalize) => {
  it.each(CASES)('%s is the key %s', (note, key) => {
    expect(normalize(note)).toBe(key);
  });

  it('hands back text that is not a note', () => {
    expect(normalize('rest')).toBe('rest');
    expect(normalize('')).toBe('');
  });
});

describe('comparing notes', () => {
  it('a flat and its sharp are the same key', () => {
    expect(notesAreEqual('Db4', 'C#4')).toBe(true);
    expect(notesAreEqual('Gb3', 'F#3')).toBe(true);
  });

  it('Cb5 is the key below C5, not an octave higher', () => {
    expect(notesAreEqual('Cb5', 'B4')).toBe(true);
    expect(notesAreEqual('Cb5', 'B5')).toBe(false);
  });

  it('a note is found among the expected ones however it is spelled', () => {
    expect(noteMatchesAny('A#3', ['C4', 'Bb3'])).toBe(true);
    expect(noteMatchesAny('B#3', ['C4'])).toBe(true);
    expect(noteMatchesAny('C#4', ['C4', 'D4'])).toBe(false);
  });
});
