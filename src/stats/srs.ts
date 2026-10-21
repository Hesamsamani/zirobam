import { storageGet, storageSet } from '../core/safeStorage';
import { addDays, dayString, isDay } from './days';

/** Days to wait before an item comes back, for boxes 1 to 5. */
export const INTERVAL_DAYS = [1, 2, 4, 7, 14] as const;
/** The most items kept; past this the ones known best are let go. */
export const MAX_ITEMS = 3000;
/** An item name longer than this is not one. */
export const MAX_KEY_CHARS = 60;

const STORAGE_KEY = 'srs.v1';
const LAST_BOX = INTERVAL_DAYS.length;
const MAX_COUNT = 1_000_000_000;

/**
 * Where one thing the student is learning stands. It sits in a box from 1 (new or just missed) to 5 (well known).
 * `due` is the day it should come back; `seen` and `wrong` are how often it was answered, and how often wrongly.
 */
export interface SrsItem {
  box: number;
  due: string;
  seen: number;
  wrong: number;
}

type Row = [box: number, due: string, seen: number, wrong: number];

interface StoredData {
  version: 1;
  items: Record<string, Row>;
}

/** The part of the browser storage the store uses; it never throws (see `core/safeStorage`). */
export interface SrsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const browserStorage: SrsStorage = { getItem: storageGet, setItem: storageSet };

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_COUNT;

function isRow(value: unknown): value is Row {
  if (!Array.isArray(value) || value.length !== 4) return false;
  const [box, due, seen, wrong] = value as unknown[];
  return isCount(box) && box >= 1 && box <= LAST_BOX && isDay(due) && isCount(seen) && isCount(wrong) && wrong <= seen;
}

function load(storage: SrsStorage, key: string): Map<string, Row> {
  const items = new Map<string, Row>();
  try {
    const text = storage.getItem(key);
    if (!text) return items;
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return items;
    const { version, items: stored } = parsed as Partial<Record<keyof StoredData, unknown>>;
    if (version !== 1 || typeof stored !== 'object' || stored === null || Array.isArray(stored)) return items;
    for (const [name, row] of Object.entries(stored)) {
      if (name.length > 0 && name.length <= MAX_KEY_CHARS && isRow(row)) items.set(name, [row[0], row[1], row[2], row[3]]);
    }
    return items;
  } catch {
    return new Map();
  }
}

const toItem = ([box, due, seen, wrong]: Row): SrsItem => ({ box, due, seen, wrong });

/**
 * What the student should look at again, and when (the Leitner method). A new item starts in box 1. A right answer
 * moves it up one box, a wrong one sends it back to box 1, and it comes back after the number of days its box says.
 */
export class SrsStore {
  private readonly storage: SrsStorage;
  private readonly today: () => string;
  private readonly storageKey: string;
  private readonly items: Map<string, Row>;

  constructor(storage: SrsStorage = browserStorage, today: () => string = () => dayString(new Date()), storageKey: string = STORAGE_KEY) {
    this.storage = storage;
    this.today = today;
    this.storageKey = storageKey;
    this.items = load(storage, storageKey);
  }

  /** The answer to an item (`note:C4`, `ear:interval:m3`, `scale:d-shur`): moves it between the boxes and sets the day it comes back. */
  review(key: string, correct: boolean): SrsItem {
    const row = this.items.get(key) ?? ([1, this.today(), 0, 0] as Row);
    const box = correct ? Math.min(LAST_BOX, row[0] + 1) : 1;
    // an item that has never been seen starts in box 1, so a first right answer lands in box 2
    const next: Row = [box, addDays(this.today(), INTERVAL_DAYS[box - 1]), row[2] + 1, row[3] + (correct ? 0 : 1)];
    if (key.length === 0 || key.length > MAX_KEY_CHARS) return toItem(next);
    this.items.set(key, next);
    this.trim(key);
    this.save();
    return toItem(next);
  }

  get(key: string): SrsItem | undefined {
    const row = this.items.get(key);
    return row ? toItem(row) : undefined;
  }

  size(): number {
    return this.items.size;
  }

  /** The items to look at on `day` (today by default): those due that day or before, the least known first, then the ones that have waited longest. */
  due(day: string = this.today()): string[] {
    return [...this.items]
      .filter(([, row]) => row[1] <= day)
      .sort(([nameA, a], [nameB, b]) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) || (nameA < nameB ? -1 : nameA > nameB ? 1 : 0))
      .map(([name]) => name);
  }

  /** Lets go of the items known best (highest box, furthest from due) while there are too many; never the one just answered. */
  private trim(keep: string): void {
    const extra = this.items.size - MAX_ITEMS;
    if (extra <= 0) return;
    const best = [...this.items]
      .filter(([name]) => name !== keep)
      .sort(([, a], [, b]) => b[0] - a[0] || (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0))
      .slice(0, extra);
    for (const [name] of best) this.items.delete(name);
  }

  private save(): void {
    try {
      this.storage.setItem(this.storageKey, JSON.stringify({ version: 1, items: Object.fromEntries(this.items) } satisfies StoredData));
    } catch {
      // storage full or refused: the boxes just are not kept
    }
  }
}
