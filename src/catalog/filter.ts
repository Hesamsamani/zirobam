import { toLatinDigits } from '../i18n/digits';
import {
  CATEGORIES,
  DEFAULT_FILTER,
  LEVELS,
  SORT_KEYS,
  type CatalogFilter,
  type CatalogSong,
  type Category,
  type Level,
  type SortKey,
} from './types';

/** Text for comparing: no case, accents, punctuation or half spaces; Persian letter variants and digits unified. */
export function normalize(text: string): string {
  return toLatinDigits(text)
    .replace(/[يى]/g, 'ی') // Arabic yeh forms to Persian yeh
    .replace(/ك/g, 'ک') // Arabic kaf to Persian kaf
    .replace(/‌/g, '') // half space
    .normalize('NFKD')
    .replace(/[̀-ًͯ-ٟ]/g, '') // accents and Arabic marks
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function haystack(song: CatalogSong): string {
  return normalize([song.title, song.titleFa, song.artist, song.artistFa].filter(Boolean).join(' '));
}

function artistText(song: CatalogSong): string {
  return normalize([song.artist, song.artistFa].filter(Boolean).join(' '));
}

export function filterSongs(songs: readonly CatalogSong[], filter: CatalogFilter): CatalogSong[] {
  const words = normalize(filter.text).split(' ').filter(Boolean);
  const artist = normalize(filter.artist);
  return songs.filter((song) => {
    if (filter.category !== 'all' && song.category !== filter.category) return false;
    if (filter.levels.length > 0 && !filter.levels.includes(song.level)) return false;
    if (artist && !artistText(song).includes(artist)) return false;
    if (words.length > 0) {
      const text = haystack(song);
      if (!words.every((word) => text.includes(word))) return false;
    }
    return true;
  });
}

/** A sorted copy. Names sort by the rules of the language shown. */
export function sortSongs(songs: readonly CatalogSong[], sort: SortKey, locale: string): CatalogSong[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  const byTitle = (a: CatalogSong, b: CatalogSong) => collator.compare(a.title, b.title);
  const byArtist = (a: CatalogSong, b: CatalogSong) => collator.compare(a.artist, b.artist) || byTitle(a, b);
  const compare: Record<SortKey, (a: CatalogSong, b: CatalogSong) => number> = {
    artist: byArtist,
    title: (a, b) => byTitle(a, b) || byArtist(a, b),
    easiest: (a, b) => a.level - b.level || byArtist(a, b),
    hardest: (a, b) => b.level - a.level || byArtist(a, b),
    newest: (a, b) => (b.year ?? -1) - (a.year ?? -1) || byArtist(a, b),
  };
  return [...songs].sort(compare[sort]);
}

export interface ArtistEntry {
  name: string;
  nameFa?: string;
  count: number;
}

/** Every artist once, with how many songs they have, the most songs first. */
export function artistList(songs: readonly CatalogSong[]): ArtistEntry[] {
  const map = new Map<string, ArtistEntry>();
  for (const song of songs) {
    const entry = map.get(song.artist);
    if (entry) entry.count++;
    else map.set(song.artist, { name: song.artist, nameFa: song.artistFa, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** The part of an address that holds the filter. Only what differs from the default is written. */
export function filterToQuery(filter: CatalogFilter): string {
  const params = new URLSearchParams();
  if (filter.text) params.set('q', filter.text);
  if (filter.artist) params.set('artist', filter.artist);
  if (filter.levels.length > 0) params.set('level', filter.levels.join(','));
  if (filter.category !== DEFAULT_FILTER.category) params.set('cat', filter.category);
  if (filter.sort !== DEFAULT_FILTER.sort) params.set('sort', filter.sort);
  return params.toString();
}

export function queryToFilter(query: string): CatalogFilter {
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  const levels = (params.get('level') ?? '')
    .split(',')
    .map(Number)
    .filter((n): n is Level => (LEVELS as readonly number[]).includes(n));
  const category = params.get('cat') ?? '';
  const sort = params.get('sort') ?? '';
  return {
    text: params.get('q') ?? '',
    artist: params.get('artist') ?? '',
    levels: [...new Set(levels)].sort(),
    category: (CATEGORIES as readonly string[]).includes(category) ? (category as Category) : 'all',
    sort: (SORT_KEYS as readonly string[]).includes(sort) ? (sort as SortKey) : DEFAULT_FILTER.sort,
  };
}
