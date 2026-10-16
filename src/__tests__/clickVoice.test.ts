import { describe, it, expect, vi, beforeEach } from 'vitest';

interface FakeSynth {
  volume: { value: number };
  maxPolyphony: number;
  triggerAttackRelease: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

const created = vi.hoisted(() => [] as unknown[]);

vi.mock('tone', () => {
  class Synth {}
  class PolySynth {
    volume = { value: 0 };
    maxPolyphony = 32;
    triggerAttackRelease = vi.fn();
    dispose = vi.fn();
    constructor() {
      created.push(this);
    }
    toDestination() {
      return this;
    }
  }
  return { Synth, PolySynth };
});

import { ClickVoice, clickParams, beatParams } from '../metronome/clickVoice';

const synths = () => created as FakeSynth[];

describe('clickParams', () => {
  it('plays a high click on the beat at the base level minus 6 dB', () => {
    expect(clickParams(0, -20)).toEqual({ pitch: 'G5', volumeDb: -26, velocity: 1 });
  });

  it('plays subdivisions 18 dB quieter than the beat, through velocity', () => {
    const sub = clickParams(2, -20);
    expect(sub.pitch).toBe('C5');
    expect(sub.volumeDb).toBe(-26);
    expect(20 * Math.log10(sub.velocity)).toBeCloseTo(-18, 5);
  });
});

describe('beatParams', () => {
  it('plays the first beat of the bar higher and louder than the other beats', () => {
    const accented = beatParams(true, -20);
    const plain = beatParams(false, -20);
    expect(accented).toEqual({ pitch: 'G5', volumeDb: -26, velocity: 1 });
    expect(plain.pitch).toBe('C5');
    expect(plain.volumeDb).toBe(-26);
    expect(plain.velocity).toBeGreaterThan(0.2);
    expect(plain.velocity).toBeLessThan(1);
  });
});

describe('ClickVoice', () => {
  beforeEach(() => {
    created.length = 0;
  });

  it('creates its synth only when the first click is played', () => {
    new ClickVoice();
    expect(created).toHaveLength(0);
  });

  it('reuses one synth for every click instead of building one per click', () => {
    const voice = new ClickVoice();
    for (let i = 0; i < 100; i++) voice.play(i % 4, -20, i * 0.1);
    expect(created).toHaveLength(1);
    expect(synths()[0].triggerAttackRelease).toHaveBeenCalledTimes(100);
  });

  it('schedules the click at the time it was given and sets the volume', () => {
    const voice = new ClickVoice();
    voice.play(0, -20, 1.25);
    const synth = synths()[0];
    expect(synth.volume.value).toBe(-26);
    expect(synth.triggerAttackRelease).toHaveBeenCalledWith('G5', '32n', 1.25, 1);
  });

  it('plays a metronome beat through the same synth, at the given time', () => {
    const voice = new ClickVoice();
    voice.play(0, -20, 0.5);
    voice.playBeat(false, -20, 1.5);
    expect(created).toHaveLength(1);
    const calls = synths()[0].triggerAttackRelease.mock.calls;
    expect(calls[1][0]).toBe('C5');
    expect(calls[1][2]).toBe(1.5);
  });

  it('limits how many clicks can sound at once', () => {
    new ClickVoice().play(0, -20, 0);
    expect(synths()[0].maxPolyphony).toBe(4);
  });

  it('builds a fresh synth after dispose', () => {
    const voice = new ClickVoice();
    voice.play(0, -20, 0);
    voice.dispose();
    expect(synths()[0].dispose).toHaveBeenCalledTimes(1);
    voice.play(0, -20, 0);
    expect(created).toHaveLength(2);
  });
});
