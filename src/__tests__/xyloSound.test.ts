import { describe, it, expect, vi, beforeEach } from 'vitest';

interface FakeSynth {
  volume: { value: number };
  maxPolyphony: number;
  triggerAttackRelease: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  options: unknown;
}

const state = vi.hoisted(() => ({ created: [] as unknown[], started: 0 }));

vi.mock('tone', () => {
  class FMSynth {}
  class PolySynth {
    volume = { value: 0 };
    maxPolyphony = 32;
    triggerAttackRelease = vi.fn();
    dispose = vi.fn();
    options: unknown;
    constructor(_voice: unknown, options: unknown) {
      this.options = options;
      state.created.push(this);
    }
    toDestination() {
      return this;
    }
  }
  return {
    FMSynth,
    PolySynth,
    start: () => {
      state.started++;
      return Promise.resolve();
    },
  };
});

import { XyloSound } from '../xylophone/xyloSound';

const synths = () => state.created as FakeSynth[];

describe('XyloSound', () => {
  beforeEach(() => {
    state.created.length = 0;
    state.started = 0;
  });

  it('builds its synth only when the first bar is hit', () => {
    new XyloSound();
    expect(state.created).toHaveLength(0);
  });

  it('reuses one synth for every hit', () => {
    const sound = new XyloSound();
    for (const note of ['C4', 'D4', 'E4', 'C4']) sound.play(note);
    expect(state.created).toHaveLength(1);
    expect(synths()[0].triggerAttackRelease).toHaveBeenCalledTimes(4);
  });

  it('plays the written pitch as a short, struck note', () => {
    new XyloSound().play('G4');
    const [note, duration, time, velocity] = synths()[0].triggerAttackRelease.mock.calls[0];
    expect(note).toBe('G4');
    expect(duration).toBe('8n');
    expect(time).toBeUndefined();
    expect(velocity).toBeGreaterThan(0);
    expect(velocity).toBeLessThanOrEqual(1);
  });

  it('asks the browser to start audio on a key press (it is blocked until the first gesture)', () => {
    new XyloSound().play('C4');
    expect(state.started).toBe(1);
  });

  it('is tuned like a wooden bar: a quick decay with no sustain', () => {
    new XyloSound().play('C4');
    const options = synths()[0].options as { envelope: { sustain: number; decay: number }; harmonicity: number };
    expect(options.envelope.sustain).toBe(0);
    expect(options.envelope.decay).toBeLessThan(0.6);
    expect(options.harmonicity).toBeGreaterThan(1);
  });

  it('allows many bars to ring at once', () => {
    new XyloSound().play('C4');
    expect(synths()[0].maxPolyphony).toBeGreaterThanOrEqual(8);
  });

  it('builds a fresh synth after dispose', () => {
    const sound = new XyloSound();
    sound.play('C4');
    sound.dispose();
    expect(synths()[0].dispose).toHaveBeenCalledTimes(1);
    sound.play('C4');
    expect(state.created).toHaveLength(2);
  });
});
