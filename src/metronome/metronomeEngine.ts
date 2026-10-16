import * as Tone from 'tone';
import { EventEmitter } from '../core/events';
import { clampBpm } from '../core/tempo';
import { sliderToDb } from '../core/volume';
import type { BeatsPerBar, TempoStore } from './tempoStore';

/** The part of Tone.Clock the engine uses, so it can be tested with a fake. */
export interface ClockLike {
  frequency: { value: number };
  start(): void;
  stop(): void;
  dispose(): void;
}
export type ClockFactory = (callback: (time: number) => void, frequency: number) => ClockLike;

const toneClock: ClockFactory = (callback, frequency) => new Tone.Clock(callback, frequency);

export interface BeatInfo {
  /** 0 for the first beat of the bar. */
  beat: number;
  beatsPerBar: BeatsPerBar;
  accented: boolean;
  /** When the beat sounds, on the audio clock. */
  time: number;
}

/**
 * Tempo from tapping: the average gap between the last few taps. A pause longer than `maxGapMs`
 * starts a new count. Needs two taps; the result is kept inside the supported range.
 */
export function tapTempo(timestamps: readonly number[], maxGapMs = 2500): number | null {
  const taps: number[] = [];
  for (const t of timestamps) {
    if (taps.length > 0 && t - taps[taps.length - 1] > maxGapMs) taps.length = 0;
    taps.push(t);
  }
  const recent = taps.slice(-5);
  if (recent.length < 2) return null;
  const average = (recent[recent.length - 1] - recent[0]) / (recent.length - 1);
  return average > 0 ? clampBpm(60000 / average) : null;
}

/**
 * A stand-alone metronome. It runs its own clock, not the Transport the exercises use, so the two never
 * disturb each other. The tempo, bar length and accent come from the shared TempoStore and apply live.
 */
export class MetronomeEngine {
  private readonly store: TempoStore;
  private readonly voice: { playBeat(accented: boolean, volumeDb: number, time?: number): void };
  private readonly makeClock: ClockFactory;
  private readonly beatEvents = new EventEmitter<BeatInfo>();
  private readonly runningEvents = new EventEmitter<boolean>();
  private clock: ClockLike | null = null;
  private stopWatching: (() => void) | null = null;
  private count = 0;

  constructor(
    store: TempoStore,
    voice: { playBeat(accented: boolean, volumeDb: number, time?: number): void },
    clockFactory: ClockFactory = toneClock
  ) {
    this.store = store;
    this.voice = voice;
    this.makeClock = clockFactory;
  }

  isRunning(): boolean {
    return this.clock !== null;
  }

  onBeat(listener: (info: BeatInfo) => void): () => void {
    return this.beatEvents.on(listener);
  }

  onRunningChange(listener: (running: boolean) => void): () => void {
    return this.runningEvents.on(listener);
  }

  start(): void {
    if (this.clock) return;
    this.count = 0;
    const clock = this.makeClock(this.tick, this.store.state.bpm / 60);
    this.clock = clock;
    this.stopWatching = this.store.onChange((state, key) => {
      if (key === 'bpm') clock.frequency.value = state.bpm / 60;
      if (key === 'beatsPerBar') this.count = 0;
    });
    clock.start();
    this.runningEvents.emit(true);
  }

  stop(): void {
    if (!this.clock) return;
    this.stopWatching?.();
    this.stopWatching = null;
    this.clock.stop();
    this.clock.dispose();
    this.clock = null;
    this.runningEvents.emit(false);
  }

  private readonly tick = (time: number): void => {
    const { beatsPerBar, accent, volume } = this.store.state;
    const beat = this.count % beatsPerBar;
    this.count++;
    const accented = accent && beat === 0;
    this.voice.playBeat(accented, sliderToDb(volume), time);
    this.beatEvents.emit({ beat, beatsPerBar, accented, time });
  };
}
