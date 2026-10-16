import type { NewScore, ScoreKind, StoredScore } from '../scores/scoreStore';

/** The marker a backup file carries, so a file from another app is recognised and refused. */
export const BACKUP_APP = 'music-notes-trainer';
export const BACKUP_VERSION = 1;

/** A backup bigger than this is not one the app wrote. */
export const MAX_BACKUP_BYTES = 80 * 1024 * 1024;
const MAX_VALUE_CHARS = 2 * 1024 * 1024;
const MAX_SCORES = 500;
const MAX_SCORE_BYTES = 30 * 1024 * 1024;
const SCORE_ID = /^[A-Za-z0-9._-]{1,120}$/;
const SCORE_KINDS: readonly ScoreKind[] = ['xml', 'midi', 'maker'];

/** What the app keeps in the browser that is worth saving: progress, settings and the unfinished practice. */
const EXACT_KEYS: ReadonlySet<string> = new Set([
  'game.v1',
  'lessons.read.v1',
  'noteStats.v1',
  'xyloStats.v1',
  'sightreading-progress',
  'practiceState',
  'maker.draft.v1',
]);
const KEY_PREFIXES: readonly string[] = ['ui.', 'xylo.', 'learn.', 'metronome.', 'practice.'];

/** True for the browser keys that belong in a backup; everything else (other sites' data, devices) stays out. */
export function isBackupKey(key: string): boolean {
  return EXACT_KEYS.has(key) || KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export type BackupScoreData = { encoding: 'text'; data: string } | { encoding: 'base64'; data: string };

export interface BackupScore {
  id: string;
  title: string;
  artist?: string;
  kind: ScoreKind;
  addedAt: number;
  content: BackupScoreData;
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  storage: Record<string, string>;
  scores: BackupScore[];
}

/** The part of the browser storage the backup reads and writes. */
export interface KeyValueStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The part of the score store the backup uses. */
export interface ScoreSource {
  list(): Promise<Array<{ id: string }>>;
  get(id: string): Promise<StoredScore | null>;
}

export interface ScoreTarget {
  put(score: NewScore): Promise<{ ok: true } | { ok: false; reason: 'full' | 'invalid' }>;
}

export interface BackupSummary {
  settings: number;
  scores: number;
  exportedAt: string;
}

export type CheckResult =
  | { ok: true; backup: BackupFile; summary: BackupSummary }
  | { ok: false; reason: 'tooBig' | 'notJson' | 'notBackup' | 'newer' | 'damaged' };

export interface RestoreResult {
  settings: number;
  scores: number;
  /** Scores that did not fit or could not be written. */
  skipped: number;
}

function toBase64(bytes: Uint8Array): string {
  let text = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) text += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(text);
}

function fromBase64(text: string): ArrayBuffer {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

/** Gathers the progress, the settings and every score of the student into one file. */
export async function createBackup(storage: KeyValueStorage, scores: ScoreSource, now: Date = new Date()): Promise<BackupFile> {
  const kept: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key === null || !isBackupKey(key)) continue;
    const value = storage.getItem(key);
    if (value !== null && value.length <= MAX_VALUE_CHARS) kept[key] = value;
  }

  const stored: BackupScore[] = [];
  for (const { id } of await scores.list()) {
    const score = await scores.get(id);
    if (!score) continue;
    const content: BackupScoreData =
      typeof score.data === 'string' ? { encoding: 'text', data: score.data } : { encoding: 'base64', data: toBase64(new Uint8Array(score.data)) };
    stored.push({ id: score.id, title: score.title, artist: score.artist, kind: score.kind, addedAt: score.addedAt, content });
  }
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), storage: kept, scores: stored };
}

export function backupToText(backup: BackupFile): string {
  return JSON.stringify(backup);
}

/** The name the downloaded file gets: `music-notes-trainer-backup-2026-10-16.json`. */
export function backupFileName(now: Date = new Date()): string {
  return `${BACKUP_APP}-backup-${now.toISOString().slice(0, 10)}.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads a backup file and keeps only what is safe to use: the right kind of file, no newer than this app,
 * known keys with text values of a sensible size, and scores with a sane id, kind and content.
 * Anything else in the file is dropped, so a damaged or hand-edited file cannot write arbitrary data.
 */
export function checkBackup(text: string): CheckResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, reason: 'tooBig' };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'notJson' };
  }
  if (!isRecord(data) || data.app !== BACKUP_APP || typeof data.version !== 'number') return { ok: false, reason: 'notBackup' };
  if (data.version > BACKUP_VERSION) return { ok: false, reason: 'newer' };
  if (data.version !== BACKUP_VERSION || !isRecord(data.storage) || !Array.isArray(data.scores)) return { ok: false, reason: 'damaged' };

  const storage: Record<string, string> = {};
  for (const [key, value] of Object.entries(data.storage)) {
    if (isBackupKey(key) && typeof value === 'string' && value.length <= MAX_VALUE_CHARS) storage[key] = value;
  }

  const scores: BackupScore[] = [];
  const seen = new Set<string>();
  for (const raw of data.scores.slice(0, MAX_SCORES)) {
    if (!isRecord(raw)) continue;
    const { id, title, artist, kind, addedAt, content } = raw;
    if (typeof id !== 'string' || !SCORE_ID.test(id) || seen.has(id)) continue;
    if (typeof title !== 'string' || title.length === 0 || title.length > 200) continue;
    if (typeof kind !== 'string' || !SCORE_KINDS.includes(kind as ScoreKind)) continue;
    if (!isRecord(content) || typeof content.data !== 'string' || content.data.length > MAX_SCORE_BYTES * 1.4) continue;
    if (content.encoding !== 'text' && content.encoding !== 'base64') continue;
    if ((content.encoding === 'base64') !== (kind === 'midi')) continue; // only MIDI is binary
    if (content.encoding === 'base64' && !/^[A-Za-z0-9+/]*={0,2}$/.test(content.data)) continue;
    seen.add(id);
    scores.push({
      id,
      title,
      artist: typeof artist === 'string' && artist.length <= 200 ? artist : undefined,
      kind: kind as ScoreKind,
      addedAt: typeof addedAt === 'number' && Number.isFinite(addedAt) ? addedAt : 0,
      content: { encoding: content.encoding, data: content.data },
    });
  }

  const exportedAt = typeof data.exportedAt === 'string' && !Number.isNaN(Date.parse(data.exportedAt)) ? data.exportedAt : '';
  const backup: BackupFile = { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt, storage, scores };
  return { ok: true, backup, summary: { settings: Object.keys(storage).length, scores: scores.length, exportedAt } };
}

/** Writes a checked backup back: the settings and progress replace the current ones, the scores are added. */
export async function applyBackup(backup: BackupFile, storage: KeyValueStorage, scores: ScoreTarget): Promise<RestoreResult> {
  let settings = 0;
  for (const [key, value] of Object.entries(backup.storage)) {
    try {
      storage.setItem(key, value);
      settings++;
    } catch {
      // storage is full or blocked: the rest is still tried
    }
  }
  let restored = 0;
  let skipped = 0;
  // oldest first, so the newest score ends up first in the list again
  for (const score of [...backup.scores].sort((a, b) => a.addedAt - b.addedAt)) {
    const data = score.content.encoding === 'text' ? score.content.data : fromBase64(score.content.data);
    const result = await scores.put({ id: score.id, title: score.title, artist: score.artist, kind: score.kind, data, addedAt: score.addedAt || undefined });
    if (result.ok) restored++;
    else skipped++;
  }
  return { settings, scores: restored, skipped };
}

/** The browser's localStorage, which reads as empty when the browser blocks it; a write that fails still throws. */
export const browserStorage: KeyValueStorage = {
  get length() {
    try {
      return localStorage.length;
    } catch {
      return 0;
    }
  },
  key(index) {
    try {
      return localStorage.key(index);
    } catch {
      return null;
    }
  },
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    localStorage.setItem(key, value);
  },
};
