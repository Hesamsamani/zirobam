import { EventEmitter } from '../core/events';

export type ScoreKind = 'xml' | 'midi' | 'maker';

export interface NewScore {
  /** A library song id, or `file-<hash>` for a file that has no row in the library. */
  id: string;
  title: string;
  artist?: string;
  kind: ScoreKind;
  /** MusicXML text, or the bytes of a MIDI file. */
  data: string | ArrayBuffer;
  /** When the score was added, for a score that comes back from a backup. Now, when left out. */
  addedAt?: number;
}

export interface ScoreSummary {
  id: string;
  title: string;
  artist?: string;
  kind: ScoreKind;
  size: number;
  addedAt: number;
}

export interface StoredScore extends ScoreSummary {
  data: string | ArrayBuffer;
}

export type PutResult = { ok: true } | { ok: false; reason: 'full' | 'invalid' };

const DB_NAME = 'music-notes-trainer';
const META = 'scores';
const BLOBS = 'blobs';
/** About 30 MB of scores in all: a score is rarely more than a few hundred kilobytes. */
export const DEFAULT_MAX_BYTES = 30 * 1024 * 1024;

function byteLength(data: string | ArrayBuffer): number {
  if (typeof data !== 'string') return data.byteLength;
  return typeof TextEncoder === 'undefined' ? data.length : new TextEncoder().encode(data).length;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * The student's own scores: files they attached to library songs or opened themselves.
 * They live in the browser (IndexedDB); when that is not available they last until the page closes.
 * A small description of every score is kept in memory so the library can ask `has(id)` at once.
 */
export class ScoreStore {
  private readonly factory: IDBFactory | null;
  private readonly maxBytes: number;
  private db: IDBDatabase | null = null;
  private readonly memory = new Map<string, StoredScore>();
  private readonly index = new Map<string, ScoreSummary>();
  private readonly changes = new EventEmitter<void>();
  private opening: Promise<void> | null = null;

  constructor(factory: IDBFactory | null = typeof indexedDB === 'undefined' ? null : indexedDB, options: { maxBytes?: number } = {}) {
    this.factory = factory;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  }

  /** Opens the database and reads the list of scores. Safe to call many times. */
  ready(): Promise<void> {
    this.opening ??= this.open();
    return this.opening;
  }

  private async open(): Promise<void> {
    if (!this.factory) return;
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = this.factory!.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore(META, { keyPath: 'id' });
          req.result.createObjectStore(BLOBS);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('The score database is blocked'));
      });
      const all = (await request(db.transaction(META, 'readonly').objectStore(META).getAll())) as ScoreSummary[];
      for (const summary of all) this.index.set(summary.id, summary);
      this.db = db;
    } catch {
      this.db = null; // private window or blocked storage: the scores last until the page closes
    }
  }

  /** True when the scores survive closing the page. */
  persistent(): boolean {
    return this.db !== null;
  }

  has(id: string): boolean {
    return this.index.has(id);
  }

  count(): number {
    return this.index.size;
  }

  totalSize(): number {
    let total = 0;
    for (const summary of this.index.values()) total += summary.size;
    return total;
  }

  async list(): Promise<ScoreSummary[]> {
    await this.ready();
    return [...this.index.values()].sort((a, b) => b.addedAt - a.addedAt || a.id.localeCompare(b.id));
  }

  async get(id: string): Promise<StoredScore | null> {
    await this.ready();
    const summary = this.index.get(id);
    if (!summary) return null;
    if (!this.db) return this.memory.get(id) ?? null;
    const tx = this.db.transaction(BLOBS, 'readonly');
    const data = (await request(tx.objectStore(BLOBS).get(id))) as string | ArrayBuffer | undefined;
    return data === undefined ? null : { ...summary, data };
  }

  /** Adds a score or replaces the one with the same id. */
  async put(score: NewScore): Promise<PutResult> {
    await this.ready();
    const size = byteLength(score.data);
    if (!score.id || size === 0) return { ok: false, reason: 'invalid' };
    const replaced = this.index.get(score.id)?.size ?? 0;
    if (this.totalSize() - replaced + size > this.maxBytes) return { ok: false, reason: 'full' };

    const summary: ScoreSummary = { id: score.id, title: score.title, artist: score.artist, kind: score.kind, size, addedAt: score.addedAt ?? Date.now() };
    if (this.db) {
      const tx = this.db.transaction([META, BLOBS], 'readwrite');
      tx.objectStore(META).put(summary);
      tx.objectStore(BLOBS).put(score.data, score.id);
      await finished(tx);
    } else {
      this.memory.set(score.id, { ...summary, data: score.data });
    }
    this.index.set(score.id, summary);
    this.changes.emit();
    return { ok: true };
  }

  async remove(id: string): Promise<void> {
    await this.ready();
    if (!this.index.has(id)) return;
    if (this.db) {
      const tx = this.db.transaction([META, BLOBS], 'readwrite');
      tx.objectStore(META).delete(id);
      tx.objectStore(BLOBS).delete(id);
      await finished(tx);
    } else {
      this.memory.delete(id);
    }
    this.index.delete(id);
    this.changes.emit();
  }

  onChange(listener: () => void): () => void {
    return this.changes.on(listener);
  }
}
