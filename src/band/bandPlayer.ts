import type { Progression, ProgressionChord } from '../generator/progression';
import { arrangeBand, chordAtBeat, type Arrangement } from './arrange';
import type { BandPart } from './patterns';

/** What the band plays through: the sounds, and a clock. The Tone.js one is in toneBackend.ts; a fake stands in for it in tests. */
export interface BandBackend {
  /** Loads the sounds; false when they cannot be loaded. */
  ready(): Promise<boolean>;
  /** Starts the arrangement from its beginning. `onBeat` gets each beat counted from the start of the loop (negative in the count-in). */
  start(arrangement: Arrangement, options: { bpm: number; loop: boolean; onBeat(beat: number): void; onEnd(): void }): void;
  stop(): void;
  /** A new tempo while it plays. */
  setBpm(bpm: number): void;
  /** A part falls silent, or is heard again. */
  setMuted(part: BandPart, muted: boolean): void;
}

export const TRANSPOSE_MIN = -6;
export const TRANSPOSE_MAX = 6;

export interface BandSettings {
  /** Beats a minute. */
  bpm: number;
  loop: boolean;
  countIn: boolean;
  transpose: number;
}

export type PlayResult = 'playing' | 'noSound' | 'nothing';

/** Plays a progression with the band, and keeps what the student can change while it plays. */
export class BandPlayer {
  private readonly backend: BandBackend;
  private progression: Progression | null = null;
  private settings: BandSettings = { bpm: 100, loop: true, countIn: false, transpose: 0 };
  private readonly muted = new Set<BandPart>();
  private playing = false;
  private readonly beatListeners = new Set<(beat: number, chord: ProgressionChord | null) => void>();
  private readonly stateListeners = new Set<(playing: boolean) => void>();

  constructor(backend: BandBackend) {
    this.backend = backend;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getSettings(): BandSettings {
    return { ...this.settings };
  }

  /** A listener for each beat of the loop and the chord that sounds on it; the count-in has none. Returns a way to stop listening. */
  onBeat(listener: (beat: number, chord: ProgressionChord | null) => void): () => void {
    this.beatListeners.add(listener);
    return () => this.beatListeners.delete(listener);
  }

  /** A listener for the band starting and stopping. */
  onState(listener: (playing: boolean) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /** The progression to play. A new one while the band plays starts again from its beginning; none stops it. */
  setProgression(progression: Progression | null): void {
    const changed = progression !== this.progression;
    this.progression = progression;
    if (!changed || !this.playing) return;
    if (progression && progression.chords.length > 0) this.begin();
    else this.stop();
  }

  async play(): Promise<PlayResult> {
    if (!this.progression || this.progression.chords.length === 0) return 'nothing';
    if (!(await this.backend.ready())) return 'noSound';
    this.begin();
    return 'playing';
  }

  stop(): void {
    if (!this.playing) return;
    this.backend.stop();
    this.setPlaying(false);
  }

  /** The tempo changes at once, also while the band plays. */
  setBpm(bpm: number): void {
    this.settings.bpm = bpm;
    if (this.playing) this.backend.setBpm(bpm);
  }

  setLoop(loop: boolean): void {
    this.settings.loop = loop;
    if (this.playing) this.begin();
  }

  setCountIn(countIn: boolean): void {
    this.settings.countIn = countIn;
  }

  /** Semitones, from -6 to 6; the bass and the chords change, so the band starts again. */
  setTranspose(transpose: number): void {
    this.settings.transpose = Math.max(TRANSPOSE_MIN, Math.min(TRANSPOSE_MAX, Math.round(transpose)));
    if (this.playing) this.begin();
  }

  setMuted(part: BandPart, muted: boolean): void {
    if (muted) this.muted.add(part);
    else this.muted.delete(part);
    this.backend.setMuted(part, muted);
  }

  isMuted(part: BandPart): boolean {
    return this.muted.has(part);
  }

  // ----- inside -----

  private begin(): void {
    const progression = this.progression;
    if (!progression) return;
    const { bpm, loop, countIn, transpose } = this.settings;
    const arrangement = arrangeBand(progression, { transpose, countIn });
    this.backend.stop();
    for (const part of this.muted) this.backend.setMuted(part, true);
    this.backend.start(arrangement, {
      bpm,
      loop,
      onBeat: (beat) => {
        if (beat < 0) return;
        const at = loop ? beat : Math.min(beat, arrangement.loopBeats - 1);
        const chord = chordAtBeat(progression, at);
        for (const listener of this.beatListeners) listener(at, chord);
      },
      onEnd: () => this.setPlaying(false),
    });
    this.setPlaying(true);
  }

  private setPlaying(playing: boolean): void {
    if (this.playing === playing) return;
    this.playing = playing;
    for (const listener of this.stateListeners) listener(playing);
  }
}
