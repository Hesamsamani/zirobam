import { EventEmitter } from '../core/events';
import { clampBpm, DEFAULT_BPM } from '../core/tempo';

export type BeatsPerBar = 2 | 3 | 4 | 6;
export const BEATS_OPTIONS: readonly BeatsPerBar[] = [2, 3, 4, 6];

export interface TempoState {
  bpm: number;
  /** The metronome clicks during exercises. */
  enabled: boolean;
  /** 0 to 100, the same scale as the volume slider in the options. */
  volume: number;
  beatsPerBar: BeatsPerBar;
  /** The first beat of every bar is louder and higher. */
  accent: boolean;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'metronome.v1';

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isBeats(value: unknown): value is BeatsPerBar {
  return BEATS_OPTIONS.includes(value as BeatsPerBar);
}

/**
 * The metronome settings shared by the exercise, the options panel and the floating metronome window,
 * so a change made in one place shows up in the others. Only the standalone-metronome choices (beats per
 * bar, accent) are remembered; the tempo always comes from the exercise.
 */
export class TempoStore {
  private current: TempoState = { bpm: DEFAULT_BPM, enabled: true, volume: 50, beatsPerBar: 4, accent: true };
  private readonly storage: StorageLike | null;
  private readonly changes = new EventEmitter<{ state: TempoState; key: keyof TempoState }>();

  constructor(storage: StorageLike | null = defaultStorage()) {
    this.storage = storage;
    this.load();
  }

  get state(): TempoState {
    return { ...this.current };
  }

  onChange(listener: (state: TempoState, key: keyof TempoState) => void): () => void {
    return this.changes.on(({ state, key }) => listener(state, key));
  }

  setBpm(value: number): void {
    this.update('bpm', clampBpm(value));
  }

  setEnabled(value: boolean): void {
    this.update('enabled', value);
  }

  setVolume(value: number): void {
    const v = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : this.current.volume;
    this.update('volume', v);
  }

  setBeatsPerBar(value: BeatsPerBar): void {
    if (isBeats(value)) this.update('beatsPerBar', value);
  }

  setAccent(value: boolean): void {
    this.update('accent', value);
  }

  private update<K extends keyof TempoState>(key: K, value: TempoState[K]): void {
    if (this.current[key] === value) return;
    this.current = { ...this.current, [key]: value };
    if (key === 'beatsPerBar' || key === 'accent') this.save();
    this.changes.emit({ state: this.state, key });
  }

  private load(): void {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      const { beatsPerBar, accent } = parsed as { beatsPerBar?: unknown; accent?: unknown };
      if (isBeats(beatsPerBar)) this.current.beatsPerBar = beatsPerBar;
      if (typeof accent === 'boolean') this.current.accent = accent;
    } catch {
      // damaged data: keep the defaults
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(
        STORAGE_KEY,
        JSON.stringify({ beatsPerBar: this.current.beatsPerBar, accent: this.current.accent })
      );
    } catch {
      // storage unavailable: not remembered
    }
  }
}
