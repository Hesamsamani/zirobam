import { storageGet, storageSet } from '../core/safeStorage';

const KEY = 'lessons.read.v1';

/** Which lessons the student has read. Kept in the browser; unknown lessons are dropped. */
export class LessonProgress {
  private readonly order: readonly string[];
  private readonly read = new Set<string>();

  constructor(ids: readonly string[]) {
    this.order = ids;
    this.load();
  }

  private load(): void {
    try {
      const saved: unknown = JSON.parse(storageGet(KEY) ?? '[]');
      if (!Array.isArray(saved)) return;
      for (const id of saved) if (typeof id === 'string' && this.order.includes(id)) this.read.add(id);
    } catch {
      // damaged data: start fresh
    }
  }

  private save(): void {
    storageSet(KEY, JSON.stringify([...this.read]));
  }

  isRead(id: string): boolean {
    return this.read.has(id);
  }

  /** Returns true the first time a lesson is marked, so the caller can reward it once. */
  markRead(id: string): boolean {
    if (!this.order.includes(id) || this.read.has(id)) return false;
    this.read.add(id);
    this.save();
    return true;
  }

  count(): number {
    return this.read.size;
  }

  total(): number {
    return this.order.length;
  }

  all(): string[] {
    return this.order.filter((id) => this.read.has(id));
  }

  isComplete(): boolean {
    return this.read.size === this.order.length;
  }

  /** The first lesson in course order that has not been read, or null when all are. */
  firstUnread(): string | null {
    return this.order.find((id) => !this.read.has(id)) ?? null;
  }

  reset(): void {
    this.read.clear();
    this.save();
  }
}
