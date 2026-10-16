import { describe, it, expect, beforeEach } from 'vitest';
import { BUILT_IN_SONGS, getSongById } from '../songs';
import { SONG_LIBRARY } from '../songs/library';
import { songTitle } from '../songs/songText';
import { parseMusicXML } from '../upload/parser';
import { generateSteps } from '../upload/steps';
import { extractMelody, playableSongs } from '../xylophone/songMelody';
import { barsForRow } from '../xylophone/keyRows';
import { initLocale, setLocale } from '../i18n';
import { en } from '../i18n/locales/en';
import { fa } from '../i18n/locales/fa';

const PITCH = /^([A-G])([#b]?)(\d)$/;
const midiOf = (pitch: string) => {
  const [, step, accidental, octave] = PITCH.exec(pitch)!;
  const semitone = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[step]!;
  return (Number(octave) + 1) * 12 + semitone + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
};

describe('the song list', () => {
  it('has many more songs than the first five', () => {
    expect(BUILT_IN_SONGS.length).toBeGreaterThanOrEqual(23);
    expect(SONG_LIBRARY.length).toBeGreaterThanOrEqual(18);
  });

  it('gives every song its own id', () => {
    const ids = BUILT_IN_SONGS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the first five songs first, so saved practice and tests still find them', () => {
    expect(BUILT_IN_SONGS.slice(0, 5).map((s) => s.id)).toEqual(['mary-lamb', 'twinkle', 'ode-to-joy', 'happy-birthday', 'minuet-g']);
    expect(getSongById('hot-cross-buns')).toBeDefined();
  });

  it('has songs at every difficulty and a set of exercises', () => {
    for (const difficulty of ['beginner', 'easy', 'intermediate'] as const) {
      expect(BUILT_IN_SONGS.some((s) => s.difficulty === difficulty), difficulty).toBe(true);
    }
    expect(BUILT_IN_SONGS.filter((s) => s.category === 'exercise').length).toBeGreaterThanOrEqual(8);
    expect(BUILT_IN_SONGS.filter((s) => s.category !== 'exercise').length).toBeGreaterThanOrEqual(14);
  });
});

describe.each(SONG_LIBRARY.map((song) => [song.id, song] as const))('song %s', (_id, song) => {
  it('is valid MusicXML that the practice mode can read', () => {
    const parsed = parseMusicXML(song.xml);
    expect(parsed.measures.length).toBeGreaterThanOrEqual(4);
    expect(parsed.title).toBe(song.title);
    expect(generateSteps(parsed.measures.length).length).toBeGreaterThan(parsed.measures.length);
  });

  it('has a right-hand part in every measure and only rests in the left hand', () => {
    const parsed = parseMusicXML(song.xml);
    for (const measure of parsed.measures) {
      expect(measure.rightHand.length, `measure ${measure.number}`).toBeGreaterThan(0);
      expect(measure.leftHand.every((n) => n.isRest)).toBe(true);
    }
  });

  it('stays in a comfortable range for reading (A3 to C6)', () => {
    for (const note of extractMelody(song.xml)) {
      const midi = midiOf(note.pitch);
      expect(midi, note.pitch).toBeGreaterThanOrEqual(midiOf('A3'));
      expect(midi, note.pitch).toBeLessThanOrEqual(midiOf('C6'));
    }
  });

  it('has a name in English and in Persian', () => {
    const english = songTitle(song);
    expect(english).not.toMatch(/^song\./);
    setLocale('fa');
    const persian = songTitle(song);
    expect(persian).not.toBe(english);
    expect(persian).toMatch(/[؀-ۿ]/);
    setLocale('en');
  });

  it('has a kind and a difficulty', () => {
    expect(['nursery', 'folk', 'classical', 'exercise']).toContain(song.category);
    expect(['beginner', 'easy', 'intermediate']).toContain(song.difficulty);
  });
});

describe('the xylophone', () => {
  it('can play most of the new songs on the home row, and skips the ones with sharps', () => {
    const names = barsForRow('home', 4).map((b) => b.noteName);
    const ids = playableSongs(BUILT_IN_SONGS, names).map((s) => s.song.id);
    for (const id of ['hot-cross-buns', 'au-clair', 'frere-jacques', 'london-bridge', 'old-macdonald', 'lightly-row', 'jingle-bells', 'ex-c-scale', 'ex-five-notes']) {
      expect(ids, id).toContain(id);
    }
    for (const id of ['yankee-doodle', 'canon-d', 'ex-g-scale', 'ex-f-scale']) {
      expect(ids, id).not.toContain(id);
    }
  });
});

describe('translations', () => {
  beforeEach(() => {
    localStorage.clear();
    initLocale();
  });

  it('has an English and a Persian name for every song key', () => {
    const keys = Object.keys(en).filter((k) => k.startsWith('song.'));
    expect(keys.length).toBeGreaterThanOrEqual(23);
    for (const key of keys) {
      expect((fa as Record<string, string>)[key], key).toBeTruthy();
    }
  });
});
