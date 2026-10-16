import { describe, it, expect } from 'vitest';
import { parseCatalog } from '../catalog/parse';

const SAMPLE = `
# a comment line
@ The Beatles | | 2
Let It Be | 1970
Hey Jude|1968|3
Yellow Submarine||1

@ Googoosh | گوگوش | 3
Pol | | | پل
Man Hamoon Hamoonam|1972||من همونم همونم

@ Ludwig van Beethoven | بتهوون | 3
Ode to Joy | 1824 | 1 | | ode-to-joy
`;

describe('parseCatalog', () => {
  const songs = parseCatalog(SAMPLE, 'pop');

  it('reads every song under its artist', () => {
    expect(songs).toHaveLength(6);
    expect(songs.map((s) => s.title)).toEqual(['Let It Be', 'Hey Jude', 'Yellow Submarine', 'Pol', 'Man Hamoon Hamoonam', 'Ode to Joy']);
    expect(songs[0].artist).toBe('The Beatles');
  });

  it('takes the level of the artist unless the song has its own', () => {
    expect(songs[0].level).toBe(2);
    expect(songs[1].level).toBe(3);
    expect(songs[2].level).toBe(1);
  });

  it('reads the year when there is one', () => {
    expect(songs[0].year).toBe(1970);
    expect(songs[2].year).toBeUndefined();
  });

  it('reads the Persian names', () => {
    expect(songs[3].artistFa).toBe('گوگوش');
    expect(songs[3].titleFa).toBe('پل');
    expect(songs[0].artistFa).toBeUndefined();
    expect(songs[4].titleFa).toBe('من همونم همونم');
  });

  it('links to a built-in song', () => {
    expect(songs[5].builtIn).toBe('ode-to-joy');
    expect(songs[0].builtIn).toBeUndefined();
  });

  it('gives each song its category and a unique id made from artist and title', () => {
    expect(songs.every((s) => s.category === 'pop')).toBe(true);
    const ids = songs.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(songs[0].id).toBe('pop-the-beatles-let-it-be');
    expect(songs[3].id).toMatch(/^pop-googoosh-pol/);
  });

  it('keeps ids unique when the same title comes twice', () => {
    const twice = parseCatalog('@ A | | 1\nSong|2000\nSong|2001', 'pop');
    expect(new Set(twice.map((s) => s.id)).size).toBe(2);
  });

  it('refuses a song before any artist, a bad level or a bad year', () => {
    expect(() => parseCatalog('Song|2000', 'pop')).toThrow(/artist/i);
    expect(() => parseCatalog('@ A | | 9\nSong|2000', 'pop')).toThrow(/level/i);
    expect(() => parseCatalog('@ A | | 1\nSong|20x0', 'pop')).toThrow(/year/i);
    expect(() => parseCatalog('@ A | | 1\nSong|2000|7', 'pop')).toThrow(/level/i);
  });

  it('copes with Windows line endings and blank lines', () => {
    const songs2 = parseCatalog('@ A | | 2\r\n\r\nSong|1999\r\n', 'modern');
    expect(songs2).toHaveLength(1);
    expect(songs2[0].category).toBe('modern');
  });
});
