/** 1 beginner, 2 easy, 3 intermediate, 4 advanced: how hard a typical piano version of the song is. */
export type Level = 1 | 2 | 3 | 4;
export const LEVELS: readonly Level[] = [1, 2, 3, 4];

export type Category = 'persian' | 'pop' | 'classical' | 'modern';
export const CATEGORIES: readonly Category[] = ['persian', 'pop', 'classical', 'modern'];

export interface CatalogSong {
  id: string;
  title: string;
  /** The title in Persian letters, for songs that have one. */
  titleFa?: string;
  artist: string;
  artistFa?: string;
  /** The year it came out; classical works give the year of the composition when it is well known. */
  year?: number;
  level: Level;
  category: Category;
  /** The id of a built-in song with real notation, when the app has one. */
  builtIn?: string;
}

export type SortKey = 'artist' | 'title' | 'easiest' | 'hardest' | 'newest';
export const SORT_KEYS: readonly SortKey[] = ['artist', 'title', 'easiest', 'hardest', 'newest'];

export interface CatalogFilter {
  /** Words that must all appear in the title or the artist. */
  text: string;
  /** Part of an artist's name. */
  artist: string;
  /** Empty means every level. */
  levels: Level[];
  /** `mine` shows the songs the student has attached a score to. */
  category: Category | 'all' | 'mine';
  sort: SortKey;
}

export const DEFAULT_FILTER: Readonly<CatalogFilter> = { text: '', artist: '', levels: [], category: 'all', sort: 'artist' };
