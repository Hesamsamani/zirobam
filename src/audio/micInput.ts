import { EventEmitter } from '../core/events';
import { detectPitch } from './yin';

export type MicState = 'off' | 'starting' | 'on' | 'denied' | 'unavailable';

/** One look at the sound: the pitch (null when there is none), how sure it is, and how loud the sound is (0 to 1). */
export interface MicFrame {
  frequency: number | null;
  clarity: number;
  level: number;
}

export interface AnalyserLike {
  fftSize: number;
  getFloatTimeDomainData(buffer: Float32Array): void;
}

export interface AudioContextLike {
  readonly sampleRate: number;
  createMediaStreamSource(stream: MediaStream): { connect(node: unknown): void; disconnect(): void };
  createAnalyser(): AnalyserLike;
  resume?(): Promise<void>;
  close(): Promise<void>;
}

export interface MicDeps {
  /** Without this the browser has no microphone to offer. */
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createContext(): AudioContextLike;
  setInterval(handler: () => void, ms: number): number;
  clearInterval(id: number): void;
  /** True while the app's own sound is playing: the microphone would hear it, so nothing is read then. */
  isAppSounding?(): boolean;
}

/** How often the sound is looked at, in milliseconds, and how big a stretch is looked at. */
export const FRAME_MS = 25;
const FFT_SIZE = 2048;
/** Below this loudness (the root mean square of the samples) there is only room noise. */
const LEVEL_GATE = 0.012;
/** A pitch less sure than this is not a pitch. */
const MIN_CLARITY = 0.8;

/**
 * The microphone as an instrument: the sound is asked for with every kind of processing off (echo cancelling and
 * noise suppression would spoil a pitch), looked at every 25 ms, and its pitch is told to the listeners. Nothing leaves
 * the page. While the app's own voice sounds, the frames are empty.
 */
export class MicInput {
  readonly onFrame = new EventEmitter<MicFrame>();
  readonly onState = new EventEmitter<MicState>();
  private readonly deps: MicDeps;
  private current: MicState = 'off';
  private stream: MediaStream | null = null;
  private context: AudioContextLike | null = null;
  private source: { disconnect(): void } | null = null;
  private timer: number | null = null;

  constructor(deps: MicDeps) {
    this.deps = deps;
  }

  get state(): MicState {
    return this.current;
  }

  private setState(state: MicState): void {
    if (this.current === state) return;
    this.current = state;
    this.onState.emit(state);
  }

  /** Asks for the microphone and starts listening. Resolves with the state it ends in. */
  async start(): Promise<MicState> {
    if (this.current === 'on' || this.current === 'starting') return this.current;
    if (!this.deps.getUserMedia) {
      this.setState('unavailable');
      return this.current;
    }
    this.setState('starting');
    try {
      this.stream = await this.deps.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (error) {
      const name = (error as { name?: string } | null)?.name;
      this.setState(name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError' ? 'denied' : 'unavailable');
      return this.current;
    }
    // stopped while the question was open
    if (this.state !== 'starting') {
      this.release();
      return this.current;
    }
    const context = this.deps.createContext();
    await context.resume?.();
    const analyser = context.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    const source = context.createMediaStreamSource(this.stream);
    source.connect(analyser);
    this.context = context;
    this.source = source;

    const buffer = new Float32Array(analyser.fftSize);
    this.timer = this.deps.setInterval(() => {
      if (this.deps.isAppSounding?.()) {
        this.onFrame.emit({ frequency: null, clarity: 0, level: 0 });
        return;
      }
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
      const level = Math.sqrt(sum / buffer.length);
      if (level < LEVEL_GATE) {
        this.onFrame.emit({ frequency: null, clarity: 0, level });
        return;
      }
      const found = detectPitch(buffer, context.sampleRate);
      this.onFrame.emit(found && found.clarity >= MIN_CLARITY ? { frequency: found.frequency, clarity: found.clarity, level } : { frequency: null, clarity: found?.clarity ?? 0, level });
    }, FRAME_MS);
    this.setState('on');
    return this.current;
  }

  stop(): void {
    this.release();
    this.setState('off');
  }

  private release(): void {
    if (this.timer !== null) this.deps.clearInterval(this.timer);
    this.timer = null;
    this.source?.disconnect();
    this.source = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    void this.context?.close();
    this.context = null;
  }
}
