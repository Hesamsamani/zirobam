import { parseCatalog } from './parse';
import type { CatalogSong } from './types';

export * from './types';

let loading: Promise<CatalogSong[]> | null = null;

/**
 * The whole library. The lists are big, so they are loaded only when the Songs library screen opens
 * (each list is a separate file in the build) and then kept.
 */
export function loadCatalog(): Promise<CatalogSong[]> {
  if (!loading) {
    loading = Promise.all([
      import('./data/persian'),
      import('./data/popClassic'),
      import('./data/popModern'),
      import('./data/classical'),
      import('./data/modern'),
    ])
      .then(([persian, popClassic, popModern, classical, modern]) => [
        ...parseCatalog(persian.PERSIAN, 'persian'),
        ...parseCatalog(popClassic.POP_CLASSIC, 'pop'),
        ...parseCatalog(popModern.POP_MODERN, 'pop'),
        ...parseCatalog(classical.CLASSICAL, 'classical'),
        ...parseCatalog(modern.MODERN, 'modern'),
      ])
      .catch((error: unknown) => {
        loading = null; // try again next time
        throw error;
      });
  }
  return loading;
}
