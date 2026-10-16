import { describe, it, expect } from 'vitest';
import { getSongById } from '../songs';
import { extractMelody } from '../xylophone/songMelody';

/**
 * The first notes of each tune, written down from the well-known melody and not copied from the song
 * data, so that a slip in the data (or a later edit) shows up here. The length of every measure is
 * checked elsewhere; these pin the pitches.
 */
const OPENINGS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['row-row-row', ['C4', 'C4', 'C4', 'D4', 'E4', 'E4', 'D4', 'E4', 'F4', 'G4']],
  ['alle-meine-entchen', ['C4', 'D4', 'E4', 'F4', 'G4', 'G4', 'A4', 'A4', 'A4', 'A4', 'G4']],
  ['when-the-saints', ['C4', 'E4', 'F4', 'G4', 'C4', 'E4', 'F4', 'G4', 'C4', 'E4', 'F4', 'G4', 'E4', 'C4', 'E4', 'D4']],
  ['pop-goes-the-weasel', ['C4', 'C4', 'D4', 'D4', 'E4', 'G4', 'E4', 'C4']],
  ['fuchs-gans', ['D4', 'E4', 'F#4', 'G4', 'A4', 'A4', 'A4', 'A4', 'B4', 'G4', 'D5', 'B4', 'A4']],
  ['sur-le-pont', ['G4', 'G4', 'G4', 'A4', 'A4', 'A4', 'B4', 'C5', 'D5', 'G4']],
  ['we-wish-you', ['D4', 'G4', 'G4', 'A4', 'G4', 'F#4', 'E4', 'E4', 'E4', 'A4', 'A4', 'B4', 'A4', 'G4']],
  ['silent-night', ['G4', 'A4', 'G4', 'E4', 'G4', 'A4', 'G4', 'E4', 'D5', 'D5', 'B4', 'C5', 'C5', 'G4']],
  ['amazing-grace', ['D4', 'G4', 'B4', 'G4', 'B4', 'A4', 'G4', 'E4', 'D4']],
  ['auld-lang-syne', ['C4', 'F4', 'F4', 'F4', 'A4', 'G4', 'F4', 'G4', 'A4', 'F4', 'F4', 'A4', 'C5', 'D5']],
  ['scarborough-fair', ['D4', 'D4', 'A4', 'A4', 'A4', 'E4', 'F4', 'E4', 'D4', 'A4', 'C5', 'D5', 'C5', 'A4', 'B4', 'G4', 'A4']],
  ['o-tannenbaum', ['D4', 'G4', 'G4', 'G4', 'A4', 'B4', 'B4', 'B4', 'B4', 'A4', 'B4', 'C5', 'F#4', 'A4', 'G4']],
  ['away-in-a-manger', ['C4', 'F4', 'F4', 'G4', 'A4', 'F4', 'F4', 'A4', 'Bb4', 'C5', 'C5', 'D5']],
  ['brahms-lullaby', ['G4', 'G4', 'Bb4', 'G4', 'G4', 'Bb4', 'G4', 'Bb4', 'Eb5', 'D5', 'C5']],
  ['o-come-all-ye-faithful', ['G4', 'G4', 'D4', 'G4', 'A4', 'D4', 'B4', 'A4', 'B4', 'C5', 'B4', 'A4', 'G4', 'G4', 'F#4', 'E4', 'F#4', 'G4', 'A4', 'B4']],
  ['skye-boat-song', ['D4', 'E4', 'D4', 'G4', 'G4', 'A4', 'B4', 'A4', 'D5']],
  ['it-came-upon-midnight-clear', ['F4', 'G4', 'A4', 'G4', 'F4', 'G4', 'A4', 'Bb4', 'A4', 'G4', 'C5']],
  ['joy-to-the-world', ['D5', 'C#5', 'B4', 'A4', 'G4', 'F#4', 'E4', 'D4']],
  ['greensleeves', ['E4', 'G4', 'A4', 'B4', 'C5', 'B4', 'A4', 'F#4', 'D4', 'E4', 'F#4', 'G4', 'E4', 'E4', 'D#4', 'E4', 'F#4', 'D#4', 'B3', 'E4']],
  ['danny-boy', ['D4', 'Eb4', 'F4', 'G4', 'F4', 'G4', 'C5', 'Bb4', 'G4', 'F4', 'Eb4', 'C4']],
  ['eine-kleine', ['G4', 'D4', 'G4', 'D4', 'G4', 'D4', 'G4', 'B4', 'D5', 'C5', 'A4', 'C5', 'A4', 'C5', 'A4', 'F#4', 'A4', 'D4']],
  ['fur-elise', ['E5', 'D#5', 'E5', 'D#5', 'E5', 'B4', 'D5', 'C5', 'A4', 'C4', 'E4', 'A4', 'B4', 'E4', 'G#4', 'B4', 'C5']],
];

describe('the tunes of the public-domain songs', () => {
  it.each(OPENINGS)('%s starts the way the tune goes', (id, opening) => {
    const song = getSongById(id);
    expect(song, id).toBeDefined();
    const pitches = extractMelody(song!.xml).map((n) => n.pitch);
    expect(pitches.slice(0, opening.length)).toEqual(opening);
  });

  it('ends the tunes that should come home on the key note', () => {
    const lastPitch = (id: string) => extractMelody(getSongById(id)!.xml).at(-1)!.pitch;
    expect(lastPitch('silent-night')).toBe('C4');
    expect(lastPitch('amazing-grace')).toBe('G4');
    expect(lastPitch('auld-lang-syne')).toBe('F4');
    expect(lastPitch('o-come-all-ye-faithful')).toBe('G4');
    expect(lastPitch('row-row-row')).toBe('C4');
    expect(lastPitch('alle-meine-entchen')).toBe('C4');
    expect(lastPitch('when-the-saints')).toBe('C4');
    expect(lastPitch('skye-boat-song')).toBe('G4');
    expect(lastPitch('greensleeves')).toBe('E4');
    expect(lastPitch('fur-elise')).toBe('A4');
    expect(lastPitch('joy-to-the-world')).toBe('D4');
  });
});
