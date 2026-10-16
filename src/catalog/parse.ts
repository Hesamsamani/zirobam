import type { CatalogSong, Category, Level } from './types';

/** Lower-case letters and digits only, for ids. Persian titles fall back to the English one. */
function slug(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readLevel(text: string, line: string): Level {
  const n = Number(text);
  if (n !== 1 && n !== 2 && n !== 3 && n !== 4) throw new Error(`Bad level "${text}" in: ${line}`);
  return n;
}

/**
 * Reads the song lists. A line `@ Artist | Artist in Persian | default level` starts an artist; every
 * line after it is a song: `Title | year | level | Title in Persian | built-in song`. Everything but
 * the title can be left empty. Lines starting with # are comments.
 */
export function parseCatalog(text: string, category: Category): CatalogSong[] {
  const songs: CatalogSong[] = [];
  const used = new Set<string>();
  let artist: { name: string; nameFa?: string; level: Level } | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('@')) {
      const [name, nameFa, level] = line.slice(1).split('|').map((part) => part.trim());
      artist = { name, nameFa: nameFa || undefined, level: readLevel(level ?? '', line) };
      continue;
    }

    if (!artist) throw new Error(`A song comes before any artist: ${line}`);
    const [title, year, level, titleFa, builtIn] = line.split('|').map((part) => part.trim());
    if (year && !/^\d{4}$/.test(year)) throw new Error(`Bad year "${year}" in: ${line}`);

    let id = `${category}-${slug(artist.name)}-${slug(title)}`;
    for (let n = 2; used.has(id); n++) id = `${category}-${slug(artist.name)}-${slug(title)}-${n}`;
    used.add(id);

    songs.push({
      id,
      title,
      titleFa: titleFa || undefined,
      artist: artist.name,
      artistFa: artist.nameFa,
      year: year ? Number(year) : undefined,
      level: level ? readLevel(level, line) : artist.level,
      category,
      builtIn: builtIn || undefined,
    });
  }
  return songs;
}
