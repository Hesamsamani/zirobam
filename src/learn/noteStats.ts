export interface PitchStat {
  seen: number;
  correct: number;
  lastSeen: number;
}

interface StatsData {
  version: 1;
  pitches: Record<string, PitchStat>;
  recent: Record<string, boolean[]>;
  maxStage: number;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'noteStats.v1';
export const RECENT_LIMIT = 20;
export const MAX_STAGE = 5;

function emptyData(): StatsData {
  return { version: 1, pitches: {}, recent: {}, maxStage: 1 };
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isValid(data: unknown): data is StatsData {
  if (!data || typeof data !== 'object') return false;
  const d = data as StatsData;
  return (
    d.version === 1 &&
    typeof d.pitches === 'object' && d.pitches !== null &&
    typeof d.recent === 'object' && d.recent !== null &&
    Number.isInteger(d.maxStage) && d.maxStage >= 1 && d.maxStage <= MAX_STAGE
  );
}

export class NoteStats {
  private data: StatsData;
  private readonly storage: StorageLike | null;

  constructor(storage: StorageLike | null = defaultStorage()) {
    this.storage = storage;
    this.data = this.load();
  }

  private load(): StatsData {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return emptyData();
      const parsed: unknown = JSON.parse(raw);
      return isValid(parsed) ? parsed : emptyData();
    } catch {
      return emptyData();
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // storage full or unavailable: progress just isn't kept
    }
  }

  record(pitch: string, stage: number, correct: boolean, now: number = Date.now()): void {
    const stat = this.data.pitches[pitch] ?? { seen: 0, correct: 0, lastSeen: 0 };
    stat.seen += 1;
    if (correct) stat.correct += 1;
    stat.lastSeen = now;
    this.data.pitches[pitch] = stat;

    const key = String(stage);
    const recent = this.data.recent[key] ?? [];
    recent.push(correct);
    this.data.recent[key] = recent.slice(-RECENT_LIMIT);
    this.save();
  }

  get(pitch: string): PitchStat | undefined {
    return this.data.pitches[pitch];
  }

  recent(stage: number): { answered: number; accuracy: number } {
    const answers = this.data.recent[String(stage)] ?? [];
    const correct = answers.filter(Boolean).length;
    return { answered: answers.length, accuracy: answers.length ? correct / answers.length : 0 };
  }

  getMaxStage(): number {
    return this.data.maxStage;
  }

  unlock(stage: number): boolean {
    if (stage <= this.data.maxStage || stage > MAX_STAGE) return false;
    this.data.maxStage = stage;
    this.save();
    return true;
  }

  reset(): void {
    this.data = emptyData();
    this.save();
  }
}
