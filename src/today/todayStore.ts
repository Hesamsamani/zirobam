import { storageGet, storageSet } from '../core/safeStorage';
import { dayString } from '../stats/days';
import type { PlanBlock } from './planner';

interface Stored {
  version: 1;
  day: string;
  plan: PlanBlock[];
  done: string[];
  /** The whole plan of the day was done and paid for: it is paid once a day, however it is ticked off and on again. */
  rewarded: boolean;
}

export interface TodayStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface TodayProgress {
  done: number;
  total: number;
}

const KEY = 'today.v1';
const browserStorage: TodayStorage = { getItem: storageGet, setItem: storageSet };

const isBlock = (value: unknown): value is PlanBlock => {
  if (typeof value !== 'object' || value === null) return false;
  const b = value as Record<string, unknown>;
  const reason = b.reason as Record<string, unknown> | undefined;
  return typeof b.id === 'string' && typeof b.kind === 'string' && typeof b.minutes === 'number' && typeof reason?.key === 'string';
};

/**
 * The plan of today, kept for the day: the plan is made the first time it is asked for and then stays as it is until the
 * next day, so that what was done is not lost when the practice memory changes. A new day makes a new plan.
 */
export class TodayStore {
  private readonly storage: TodayStorage;
  private readonly build: () => PlanBlock[];
  private readonly today: () => string;
  private data: Stored | null = null;

  constructor(build: () => PlanBlock[], storage: TodayStorage = browserStorage, today: () => string = () => dayString(new Date())) {
    this.build = build;
    this.storage = storage;
    this.today = today;
  }

  private load(): Stored | null {
    try {
      const raw = this.storage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as Partial<Stored> | null;
      if (data && data.version === 1 && typeof data.day === 'string' && Array.isArray(data.plan) && data.plan.every(isBlock) && Array.isArray(data.done)) {
        return { version: 1, day: data.day, plan: data.plan, done: data.done.filter((id): id is string => typeof id === 'string'), rewarded: data.rewarded === true };
      }
    } catch {
      // damaged: a new plan
    }
    return null;
  }

  private save(): void {
    try {
      if (this.data) this.storage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // not kept
    }
  }

  private current(): Stored {
    const day = this.today();
    if (!this.data) this.data = this.load();
    if (!this.data || this.data.day !== day) {
      this.data = { version: 1, day, plan: this.build(), done: [], rewarded: false };
      this.save();
    }
    return this.data;
  }

  plan(): PlanBlock[] {
    return this.current().plan.map((b) => ({ ...b, reason: { ...b.reason } }));
  }

  isDone(id: string): boolean {
    return this.current().done.includes(id);
  }

  progress(): TodayProgress {
    const data = this.current();
    return { done: data.plan.filter((b) => data.done.includes(b.id)).length, total: data.plan.length };
  }

  /** Marks a block done (or not done again). Returns true when this made the whole plan done for the first time today (that is what is paid for). */
  setDone(id: string, done: boolean): boolean {
    const data = this.current();
    if (!data.plan.some((b) => b.id === id)) return false;
    const has = data.done.includes(id);
    if (done && !has) data.done.push(id);
    if (!done && has) data.done = data.done.filter((d) => d !== id);
    const now = this.progress();
    const first = done && !has && now.total > 0 && now.done === now.total && !data.rewarded;
    if (first) data.rewarded = true;
    this.save();
    return first;
  }

  /** A new plan for today, for when the student wants another. Done blocks are forgotten, but a plan that was paid for stays paid for. */
  remake(): void {
    const rewarded = this.current().rewarded;
    this.data = { version: 1, day: this.today(), plan: this.build(), done: [], rewarded };
    this.save();
  }
}
