import { describe, it, expect, beforeAll } from 'vitest';
import { loadCatalog } from '../catalog';
import { artistList } from '../catalog/filter';
import { BUILT_IN_SONGS } from '../songs';
import { CATEGORIES, LEVELS, type CatalogSong } from '../catalog/types';

let songs: CatalogSong[] = [];

beforeAll(async () => {
  songs = await loadCatalog();
});

describe('the song library data', () => {
  it('has more than a thousand songs from many artists', () => {
    expect(songs.length).toBeGreaterThan(1000);
    expect(artistList(songs).length).toBeGreaterThan(150);
  });

  it('covers Persian pop, international songs, classical works and modern piano', () => {
    for (const category of CATEGORIES) expect(songs.filter((s) => s.category === category).length, category).toBeGreaterThan(20);
    expect(songs.filter((s) => s.category === 'pop').length).toBeGreaterThan(500);
    expect(songs.filter((s) => s.category === 'classical').length).toBeGreaterThan(300);
  });

  it('has every level, so there is something for each student', () => {
    for (const level of LEVELS) expect(songs.filter((s) => s.level === level).length, `level ${level}`).toBeGreaterThan(30);
  });

  it('gives every song a different id', () => {
    const ids = songs.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists a song of an artist only once', () => {
    const seen = new Map<string, string>();
    for (const s of songs) {
      const key = `${s.category}|${s.artist}|${s.title}`.toLowerCase();
      expect(seen.has(key), `${s.artist}: ${s.title} is listed twice`).toBe(false);
      seen.set(key, s.id);
    }
  });

  it('has a title and an artist for every song, without stray spaces or marks', () => {
    for (const s of songs) {
      expect(s.title.length, s.id).toBeGreaterThan(0);
      expect(s.artist.length, s.id).toBeGreaterThan(0);
      expect(s.title, s.id).toBe(s.title.trim());
      expect(s.title, s.id).not.toMatch(/\|/);
      expect(s.artist, s.id).not.toMatch(/\|/);
    }
  });

  it('gives only sensible years', () => {
    for (const s of songs) {
      if (s.year === undefined) continue;
      expect(s.year, s.id).toBeGreaterThanOrEqual(1500);
      expect(s.year, s.id).toBeLessThanOrEqual(2026);
    }
  });

  it('writes Persian names for the Persian songs, in Persian letters', () => {
    const persian = songs.filter((s) => s.category === 'persian');
    expect(persian.length).toBeGreaterThan(50);
    for (const s of persian) {
      expect(s.artistFa, s.id).toBeTruthy();
      if (s.titleFa) expect(s.titleFa, s.id).toMatch(/[؀-ۿ]/);
      expect(s.titleFa ?? '', s.id).not.toMatch(/[يك]/);
      expect(s.artistFa ?? '', s.id).not.toMatch(/[يك]/);
    }
  });

  it('only links to built-in songs that exist', () => {
    const ids = new Set(BUILT_IN_SONGS.map((song) => song.id));
    const linked = songs.filter((s) => s.builtIn);
    expect(linked.length).toBeGreaterThan(5);
    for (const s of linked) expect(ids.has(s.builtIn!), `${s.title} -> ${s.builtIn}`).toBe(true);
  });

  it('keeps the beginner level for slow, simple songs: no beginner pop song is a long piece', () => {
    const beginners = songs.filter((s) => s.level === 1);
    expect(beginners.every((s) => s.title.length < 80)).toBe(true);
  });
});
