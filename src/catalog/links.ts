import type { CatalogSong } from './types';

function query(song: CatalogSong): string {
  return `${song.title} ${song.artist}`;
}

/**
 * Where to look for the notes. Classical works are free on IMSLP (the music of composers who died long ago).
 * Other songs are looked up on MuseScore, where people share arrangements. Only the song's name is sent.
 */
export function sheetMusicUrl(song: CatalogSong): string {
  const search = new URLSearchParams();
  if (song.category === 'classical') {
    search.set('title', 'Special:Search');
    search.set('search', query(song));
    search.set('fulltext', 'Search');
    return `https://imslp.org/index.php?${search.toString()}`;
  }
  search.set('text', query(song));
  return `https://musescore.com/sheetmusic?${search.toString()}`;
}

/** A YouTube search, to hear the song before learning it. */
export function listenUrl(song: CatalogSong): string {
  const search = new URLSearchParams({ search_query: query(song) });
  return `https://www.youtube.com/results?${search.toString()}`;
}
