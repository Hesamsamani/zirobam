import { describe, it, expect } from 'vitest';
import { listenUrl, sheetMusicUrl } from '../catalog/links';
import type { CatalogSong } from '../catalog/types';

const pop: CatalogSong = { id: 'a', title: "Don't Stop Me Now", artist: 'Queen', level: 4, category: 'pop' };
const classical: CatalogSong = { id: 'b', title: 'Für Elise', artist: 'Ludwig van Beethoven', level: 3, category: 'classical' };

describe('catalog links', () => {
  it('searches the free scores of IMSLP for classical works', () => {
    const url = new URL(sheetMusicUrl(classical));
    expect(url.origin).toBe('https://imslp.org');
    expect(url.searchParams.get('search')).toBe('Für Elise Ludwig van Beethoven');
  });

  it('searches MuseScore for the other songs', () => {
    const url = new URL(sheetMusicUrl(pop));
    expect(url.origin).toBe('https://musescore.com');
    expect(url.pathname).toBe('/sheetmusic');
    expect(url.searchParams.get('text')).toBe("Don't Stop Me Now Queen");
  });

  it('searches YouTube to listen', () => {
    const url = new URL(listenUrl(pop));
    expect(url.origin).toBe('https://www.youtube.com');
    expect(url.searchParams.get('search_query')).toBe("Don't Stop Me Now Queen");
  });

  it('is safe for any title', () => {
    const odd = { ...pop, title: 'A&B=C #1 ?', artist: 'X/Y' };
    for (const url of [sheetMusicUrl(odd), listenUrl(odd)]) {
      expect(() => new URL(url)).not.toThrow();
      expect(url).not.toContain(' ');
    }
    expect(new URL(listenUrl(odd)).searchParams.get('search_query')).toBe('A&B=C #1 ? X/Y');
  });

  it('only ever points at these three sites', () => {
    const hosts = [sheetMusicUrl(pop), sheetMusicUrl(classical), listenUrl(pop)].map((u) => new URL(u).hostname);
    expect(hosts).toEqual(['musescore.com', 'imslp.org', 'www.youtube.com']);
  });
});
