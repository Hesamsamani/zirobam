import { soundOf } from '../theory/pitch';
import { exampleLength, exampleTimeline } from './exampleTimeline';
import type { StaffExample } from './exampleXml';

/** The sound behind the Play buttons and the clickable keys. */
export interface PlayerBackend {
  /** Loads the sound if needed; false when it is not available (offline, blocked). */
  ready(): Promise<boolean>;
  /** Sounds a note for `seconds`, starting `startsIn` seconds from now. The note is a sampler name, or a frequency in Hz for a quarter tone. */
  play(note: string | number, seconds: number, startsIn: number): void;
  stopAll(): void;
}

/** A note ends a little before the next one starts, so repeated notes are heard as separate notes. */
const GAP = 0.05;

/** What the sampler is given for a note: a sharp name (Bb4 is A#4), or a frequency for a quarter tone. */
const samplerName = soundOf;

/** Plays single keys and lesson examples. A new example is the caller's job to stop first. */
export class LessonPlayer {
  private readonly backend: PlayerBackend;
  private readonly bpm: number;

  constructor(backend: PlayerBackend, bpm = 80) {
    this.backend = backend;
    this.bpm = bpm;
  }

  playNote(note: string): void {
    void this.backend.ready().then((ok) => {
      if (ok) this.backend.play(samplerName(note), 1, 0);
    });
  }

  /** Starts the example. `onDone` runs when it has ended by itself; the returned function stops it. */
  playExample(spec: StaffExample, onDone: () => void): () => void {
    const secondsPerBeat = 60 / this.bpm;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    void this.backend.ready().then((ok) => {
      if (stopped) return;
      if (!ok) {
        onDone();
        return;
      }
      for (const event of exampleTimeline(spec)) {
        this.backend.play(samplerName(event.pitch), Math.max(0.1, event.length * secondsPerBeat - GAP), event.start * secondsPerBeat);
      }
      timer = setTimeout(() => {
        timer = null;
        if (!stopped) onDone();
      }, exampleLength(spec) * secondsPerBeat * 1000 + 150);
    });

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
      this.backend.stopAll();
    };
  }
}
