import { describe, expect, it, vi } from 'vitest';
import { MicInput, type AudioContextLike, type MicDeps, type MicFrame } from '../audio/micInput';

function tone(frequency: number, sampleRate: number, amplitude: number, length = 2048): Float32Array {
  return Float32Array.from({ length }, (_, i) => amplitude * (Math.sin(2 * Math.PI * frequency * (i / sampleRate)) + 0.4 * Math.sin(4 * Math.PI * frequency * (i / sampleRate))));
}

function setup(options: { frequency?: number; amplitude?: number; getUserMedia?: MicDeps['getUserMedia'] | null; sounding?: boolean } = {}) {
  const { frequency = 440, amplitude = 0.3, sounding = false } = options;
  const sampleRate = 44100;
  const tracks = [{ stop: vi.fn() }];
  const stream = { getTracks: () => tracks } as unknown as MediaStream;
  const disconnect = vi.fn();
  const close = vi.fn(async () => undefined);
  let samples = tone(frequency, sampleRate, amplitude);
  const context: AudioContextLike = {
    sampleRate,
    createMediaStreamSource: () => ({ connect: vi.fn(), disconnect }),
    createAnalyser: () => ({ fftSize: 0, getFloatTimeDomainData: (buffer) => buffer.set(samples.subarray(0, buffer.length)) }),
    resume: vi.fn(async () => undefined),
    close,
  };
  let tick: (() => void) | null = null;
  let appSounding = sounding;
  const getUserMedia = options.getUserMedia === null ? undefined : (options.getUserMedia ?? vi.fn(async () => stream));
  const deps: MicDeps = {
    getUserMedia,
    createContext: () => context,
    setInterval: (handler) => {
      tick = handler;
      return 7;
    },
    clearInterval: vi.fn(),
    isAppSounding: () => appSounding,
  };
  const mic = new MicInput(deps);
  const frames: MicFrame[] = [];
  mic.onFrame.on((f) => frames.push(f));
  const states: string[] = [];
  mic.onState.on((s) => states.push(s));
  return { mic, deps, frames, states, tracks, disconnect, close, tick: () => tick!(), setSamples: (s: Float32Array) => (samples = s), setSounding: (v: boolean) => (appSounding = v) };
}

describe('MicInput', () => {
  it('asks for the sound with echo cancelling, noise suppression and gain control off', async () => {
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [] }) as unknown as MediaStream);
    const { mic } = setup({ getUserMedia });
    await mic.start();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  });

  it('listens, and tells the pitch of what it hears at every look', async () => {
    const { mic, frames, states, tick } = setup();
    expect(await mic.start()).toBe('on');
    expect(states).toEqual(['starting', 'on']);
    tick();
    expect(frames).toHaveLength(1);
    expect(Math.abs(1200 * Math.log2(frames[0].frequency! / 440))).toBeLessThan(3);
    expect(frames[0].clarity).toBeGreaterThan(0.9);
    expect(frames[0].level).toBeGreaterThan(0.1);
  });

  it('hears nothing in a quiet room: below the gate there is no pitch', async () => {
    const { mic, frames, tick } = setup({ amplitude: 0.002 });
    await mic.start();
    tick();
    expect(frames[0].frequency).toBeNull();
    expect(frames[0].level).toBeLessThan(0.012);
  });

  it('reads nothing while the app is sounding itself', async () => {
    const { mic, frames, tick, setSounding } = setup();
    await mic.start();
    setSounding(true);
    tick();
    expect(frames[0]).toEqual({ frequency: null, clarity: 0, level: 0 });
    setSounding(false);
    tick();
    expect(frames[1].frequency).not.toBeNull();
  });

  it('is denied when the student says no, and unavailable when the browser has no microphone or fails', async () => {
    const denied = setup({ getUserMedia: vi.fn(async () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }))) });
    expect(await denied.mic.start()).toBe('denied');
    const broken = setup({ getUserMedia: vi.fn(async () => Promise.reject(new Error('no device'))) });
    expect(await broken.mic.start()).toBe('unavailable');
    const none = setup({ getUserMedia: null });
    expect(await none.mic.start()).toBe('unavailable');
  });

  it('can be started again after it was denied', async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('no'), { name: 'NotAllowedError' }))
      .mockResolvedValueOnce({ getTracks: () => [] } as unknown as MediaStream);
    const { mic } = setup({ getUserMedia });
    expect(await mic.start()).toBe('denied');
    expect(await mic.start()).toBe('on');
  });

  it('does not start twice', async () => {
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [] }) as unknown as MediaStream);
    const { mic } = setup({ getUserMedia });
    await mic.start();
    await mic.start();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('lets go of the microphone when it stops: the tracks, the source, the clock and the context', async () => {
    const { mic, deps, tracks, disconnect, close, states } = setup();
    await mic.start();
    mic.stop();
    expect(tracks[0].stop).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(deps.clearInterval).toHaveBeenCalledWith(7);
    expect(mic.state).toBe('off');
    expect(states.at(-1)).toBe('off');
  });

  it('lets go of a microphone that arrives after it was stopped', async () => {
    let resolve!: (stream: MediaStream) => void;
    const tracks = [{ stop: vi.fn() }];
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((r) => (resolve = r)));
    const { mic } = setup({ getUserMedia });
    const started = mic.start();
    mic.stop();
    resolve({ getTracks: () => tracks } as unknown as MediaStream);
    await started;
    expect(tracks[0].stop).toHaveBeenCalled();
    expect(mic.state).toBe('off');
  });
});
