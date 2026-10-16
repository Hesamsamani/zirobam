import { storageGet, storageSet } from '../core/safeStorage';
import { clampBpm } from '../core/tempo';
import type { HandChoice } from './timingEvents';

const STORAGE_KEY = 'practice.options.v1';

/** How the student wants to practise a song, beyond "play along". */
export interface PracticeOptions {
  /** The piece waits at each note until it is played. */
  wait: boolean;
  /** A step that was played well is repeated instead of moving on. */
  loop: boolean;
  /** After each clean pass the tempo goes up a little, until it reaches the base tempo. */
  ladder: boolean;
  hand: HandChoice;
}

const DEFAULTS: PracticeOptions = { wait: false, loop: false, ladder: false, hand: 'both' };
const HANDS: readonly HandChoice[] = ['both', 'right', 'left'];

/** The quick speeds, as a share of the base tempo. */
export const SPEED_STEPS = [50, 75, 100] as const;
/** The tempo goes up by this much after each clean pass. */
export const LADDER_STEP = 5;

export function slowedBpm(base: number, percent: number): number {
  return clampBpm((base * percent) / 100);
}

/** The quick speed the tempo is at, or null when it is somewhere else. */
export function speedPercent(bpm: number, base: number): number | null {
  return SPEED_STEPS.find((percent) => slowedBpm(base, percent) === bpm) ?? null;
}

export function nextLadderBpm(bpm: number, base: number): number {
  if (bpm >= base) return bpm;
  return Math.min(base, clampBpm(bpm + LADDER_STEP));
}

function read(): PracticeOptions {
  const text = storageGet(STORAGE_KEY);
  if (!text) return { ...DEFAULTS };
  try {
    const data = JSON.parse(text) as Record<string, unknown> | null;
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return { ...DEFAULTS };
    return {
      wait: data.wait === true,
      loop: data.loop === true,
      ladder: data.ladder === true,
      hand: HANDS.includes(data.hand as HandChoice) ? (data.hand as HandChoice) : 'both',
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/** The practice options of the student, kept in the browser. */
export class PracticeOptionsStore {
  private options: PracticeOptions = read();
  private readonly listeners = new Set<() => void>();

  get(): PracticeOptions {
    return { ...this.options };
  }

  set(patch: Partial<PracticeOptions>): void {
    const next = { ...this.options, ...patch };
    if ((Object.keys(next) as Array<keyof PracticeOptions>).every((key) => next[key] === this.options[key])) return;
    this.options = next;
    storageSet(STORAGE_KEY, JSON.stringify(next));
    for (const listener of [...this.listeners]) listener();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }
}
