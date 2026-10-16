import { describe, it, expect } from 'vitest';
import {
  artistList,
  filterSongs,
  filterToQuery,
  normalize,
  queryToFilter,
  sortSongs,
} from '../catalog/filter';
import { DEFAULT_FILTER, type CatalogSong } from '../catalog/types';

const song = (over: Partial<CatalogSong> & Pick<CatalogSong, 'title' | 'artist'>): CatalogSong => ({
  id: `${over.artist}-${over.title}`,
  level: 2,
  category: 'pop',
  ...over,
});

const SONGS: CatalogSong[] = [
  song({ title: 'Let It Be', artist: 'The Beatles', year: 1970, level: 2 }),
  song({ title: 'Hey Jude', artist: 'The Beatles', year: 1968, level: 2 }),
  song({ title: 'Bohemian Rhapsody', artist: 'Queen', year: 1975, level: 4 }),
  song({ title: 'Imagine', artist: 'John Lennon', year: 1971, level: 1 }),
  song({ title: 'Pol', titleFa: 'پل', artist: 'Googoosh', artistFa: 'گوگوش', level: 3, category: 'persian' }),
  song({ title: 'Für Elise', artist: 'Ludwig van Beethoven', artistFa: 'بتهوون', year: 1810, level: 3, category: 'classical' }),
  song({ title: 'Nuvole Bianche', artist: 'Ludovico Einaudi', year: 2004, level: 3, category: 'modern' }),
];

const titles = (list: CatalogSong[]) => list.map((s) => s.title);

describe('normalize', () => {
  it('ignores case, accents and punctuation', () => {
    expect(normalize('Für  Élise!')).toBe('fur elise');
    expect(normalize("Don't Stop")).toBe('dont stop');
  });

  it('treats the Arabic and Persian forms of yeh and kaf as one', () => {
    expect(normalize('كتاب')).toBe(normalize('کتاب'));
    expect(normalize('علي')).toBe(normalize('علی'));
  });

  it('ignores the half space and turns Persian digits into Latin ones', () => {
    expect(normalize('می‌خواهم ۱۹۷۲')).toBe('میخواهم 1972');
  });
});

describe('filterSongs', () => {
  it('returns everything for the default filter', () => {
    expect(filterSongs(SONGS, DEFAULT_FILTER)).toHaveLength(SONGS.length);
  });

  it('finds words in the title or the artist, in any order', () => {
    expect(titles(filterSongs(SONGS, { ...DEFAULT_FILTER, text: 'beatles' }))).toEqual(['Let It Be', 'Hey Jude']);
    expect(titles(filterSongs(SONGS, { ...DEFAULT_FILTER, text: 'jude beatles' }))).toEqual(['Hey Jude']);
    expect(titles(filterSongs(SONGS, { ...DEFAULT_FILTER, text: 'FUR elise' }))).toEqual(['Für Elise']);
  });

  it('finds Persian titles and artists', () => {
    expect(titles(filterSongs(SONGS, { ...DEFAULT_FILTER, text: 'پل' }))).toEqual(['Pol']);
    expect(titles(filterSongs(SONGS, { ...DEFAULT_FILTER, text: 'گوگوش' }))).toEqual(['Pol']);
    expect(titles(filterSongs(SONGS, { ...DEFAULT_FILTER, text: 'بتهوون' }))).toEqual(['Für Elise']);
  });

  it('filters by part of an artist name', () => {
    expect(titles(filterSongs(SONGS, { ...DEFAULT_FILTER, artist: 'queen' }))).toEqual(['Bohemian Rhapsody']);
    expect(titles(filterSongs(SONGS, { ...DEFAULT_FILTER, artist: 'lud' }))).toEqual(['Für Elise', 'Nuvole Bianche']);
  });

  it('does not mix up the artist filter with the title', () => {
    expect(filterSongs(SONGS, { ...DEFAULT_FILTER, artist: 'imagine' })).toHaveLength(0);
  });

  it('filters by one or more levels', () => {
    expect(titles(filterSongs(SONGS, { ...DEFAULT_FILTER, levels: [1] }))).toEqual(['Imagine']);
    expect(titles(filterSongs(SONGS, { ...DEFAULT_FILTER, levels: [1, 4] })).sort()).toEqual(['Bohemian Rhapsody', 'Imagine']);
  });

  it('filters by category', () => {
    expect(titles(filterSongs(SONGS, { ...DEFAULT_FILTER, category: 'persian' }))).toEqual(['Pol']);
    expect(titles(filterSongs(SONGS, { ...DEFAULT_FILTER, category: 'classical' }))).toEqual(['Für Elise']);
  });

  it('shows only the songs that have a score of the student, when asked for "mine"', () => {
    const mine = (s: CatalogSong) => s.title === 'Imagine' || s.title === 'Pol';
    expect(titles(filterSongs(SONGS, { ...DEFAULT_FILTER, category: 'mine' }, mine)).sort()).toEqual(['Imagine', 'Pol']);
    expect(filterSongs(SONGS, { ...DEFAULT_FILTER, category: 'mine' })).toHaveLength(0);
    expect(titles(filterSongs(SONGS, { ...DEFAULT_FILTER, category: 'mine', levels: [1] }, mine))).toEqual(['Imagine']);
  });

  it('combines the filters', () => {
    expect(titles(filterSongs(SONGS, { ...DEFAULT_FILTER, text: 'let it', levels: [2], category: 'pop' }))).toEqual(['Let It Be']);
    expect(filterSongs(SONGS, { ...DEFAULT_FILTER, text: 'beatles', levels: [4] })).toHaveLength(0);
  });
});

describe('sortSongs', () => {
  it('sorts by artist, then title', () => {
    expect(sortSongs(SONGS, 'artist', 'en').map((s) => s.artist)).toEqual([
      'Googoosh', 'John Lennon', 'Ludovico Einaudi', 'Ludwig van Beethoven', 'Queen', 'The Beatles', 'The Beatles',
    ]);
    expect(titles(sortSongs(SONGS, 'artist', 'en')).slice(-2)).toEqual(['Hey Jude', 'Let It Be']);
  });

  it('sorts by title', () => {
    expect(titles(sortSongs(SONGS, 'title', 'en'))[0]).toBe('Bohemian Rhapsody');
  });

  it('puts the easiest or the hardest first, then by title', () => {
    expect(sortSongs(SONGS, 'easiest', 'en')[0].title).toBe('Imagine');
    expect(sortSongs(SONGS, 'hardest', 'en')[0].title).toBe('Bohemian Rhapsody');
    const easy = sortSongs(SONGS, 'easiest', 'en');
    expect(easy.map((s) => s.level)).toEqual([...easy.map((s) => s.level)].sort((a, b) => a - b));
  });

  it('puts the newest first and songs without a year last', () => {
    const newest = sortSongs(SONGS, 'newest', 'en');
    expect(newest[0].title).toBe('Nuvole Bianche');
    expect(newest[newest.length - 1].year).toBeUndefined();
  });

  it('does not change the list it is given', () => {
    const copy = [...SONGS];
    sortSongs(SONGS, 'title', 'en');
    expect(SONGS).toEqual(copy);
  });
});

describe('artistList', () => {
  it('lists each artist once with the number of songs, most songs first', () => {
    const list = artistList(SONGS);
    expect(list).toHaveLength(6);
    expect(list[0]).toEqual({ name: 'The Beatles', nameFa: undefined, count: 2 });
    expect(list.find((a) => a.name === 'Googoosh')).toEqual({ name: 'Googoosh', nameFa: 'گوگوش', count: 1 });
  });
});

describe('the address of a filter', () => {
  it('is empty for the default filter', () => {
    expect(filterToQuery(DEFAULT_FILTER)).toBe('');
  });

  it('only writes what was changed', () => {
    expect(filterToQuery({ ...DEFAULT_FILTER, artist: 'Queen' })).toBe('artist=Queen');
    expect(filterToQuery({ ...DEFAULT_FILTER, levels: [1, 2], category: 'persian', sort: 'easiest', text: 'a b' })).toBe(
      'q=a+b&level=1%2C2&cat=persian&sort=easiest'
    );
  });

  it('is read back the same', () => {
    const filter = { text: 'let it', artist: 'The Beatles', levels: [1, 3] as (1 | 3)[], category: 'pop' as const, sort: 'newest' as const };
    expect(queryToFilter(filterToQuery(filter))).toEqual(filter);
    expect(queryToFilter('?' + filterToQuery(filter))).toEqual(filter);
  });

  it('survives Persian text', () => {
    const filter = { ...DEFAULT_FILTER, text: 'گوگوش' };
    expect(queryToFilter(filterToQuery(filter)).text).toBe('گوگوش');
  });

  it('knows the kind "mine"', () => {
    expect(filterToQuery({ ...DEFAULT_FILTER, category: 'mine' })).toBe('cat=mine');
    expect(queryToFilter('cat=mine').category).toBe('mine');
  });

  it('ignores what it does not know', () => {
    expect(queryToFilter('level=9,2,x&cat=jazz&sort=random&q=a')).toEqual({ ...DEFAULT_FILTER, text: 'a', levels: [2] });
    expect(queryToFilter('')).toEqual(DEFAULT_FILTER);
  });
});
