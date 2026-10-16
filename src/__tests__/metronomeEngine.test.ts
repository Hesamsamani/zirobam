import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { MetronomeEngine, tapTempo, type ClockLike, type BeatInfo } from '../metronome/metronomeEngine';
import { TempoStore } from '../metronome/tempoStore';

class FakeClock implements ClockLike {
  frequency = { value: 0 };
  started = 0;
  stopped = 0;
  disposed = 0;
  callback: (time: number) => void;
  constructor(callback: (time: number) => void, frequency: number) {
    this.callback = callback;
    this.frequency.value = frequency;
  }
  start() {
    this.started++;
  }
  stop() {
    this.stopped++;
  }
  dispose() {
    this.disposed++;
  }
  tick(time: number) {
    this.callback(time);
  }
}

describe('tapTempo', () => {
  it('needs at least two taps', () => {
    expect(tapTempo([])).toBeNull();
    expect(tapTempo([1000])).toBeNull();
  });

  it('averages the gaps between taps', () => {
    expect(tapTempo([0, 500, 1000, 1500])).toBe(120);
    expect(tapTempo([0, 1000])).toBe(60);
  });

  it('forgets taps from before a long pause', () => {
    expect(tapTempo([0, 100, 10000, 10500, 11000])).toBe(120);
  });

  it('uses only the last few taps', () => {
    expect(tapTempo([0, 2000, 4000, 4500, 5000, 5500, 6000])).toBe(120);
  });

  it('keeps the result inside the supported tempo range', () => {
    expect(tapTempo([0, 50, 100])).toBe(200);
    expect(tapTempo([0, 2400])).toBe(25);
  });
});

describe('MetronomeEngine', () => {
  let store: TempoStore;
  let voice: { playBeat: Mock<(accented: boolean, volumeDb: number, time?: number) => void> };
  let clocks: FakeClock[];
  let engine: MetronomeEngine;
  let beats: BeatInfo[];

  beforeEach(() => {
    store = new TempoStore(null);
    store.setBpm(120);
    voice = { playBeat: vi.fn<(accented: boolean, volumeDb: number, time?: number) => void>() };
    clocks = [];
    beats = [];
    engine = new MetronomeEngine(store, voice, (callback, frequency) => {
      const clock = new FakeClock(callback, frequency);
      clocks.push(clock);
      return clock;
    });
    engine.onBeat((info) => beats.push(info));
  });

  it('does nothing until it is started', () => {
    expect(engine.isRunning()).toBe(false);
    expect(clocks).toHaveLength(0);
  });

  it('runs a clock at one tick per beat', () => {
    engine.start();
    expect(engine.isRunning()).toBe(true);
    expect(clocks[0].started).toBe(1);
    expect(clocks[0].frequency.value).toBe(2); // 120 BPM = 2 beats per second
  });

  it('accents the first beat of each bar and counts around', () => {
    store.setBeatsPerBar(3);
    engine.start();
    for (let i = 0; i < 6; i++) clocks[0].tick(i * 0.5);
    expect(beats.map((b) => b.beat)).toEqual([0, 1, 2, 0, 1, 2]);
    expect(voice.playBeat.mock.calls.map((c) => c[0])).toEqual([true, false, false, true, false, false]);
    expect(beats[0]).toMatchObject({ beatsPerBar: 3, accented: true, time: 0 });
  });

  it('plays every beat at the time the clock gives, at the volume of the store', () => {
    store.setVolume(50);
    engine.start();
    clocks[0].tick(1.25);
    expect(voice.playBeat).toHaveBeenCalledWith(true, -20, 1.25);
  });

  it('does not accent when the accent is off', () => {
    store.setAccent(false);
    engine.start();
    clocks[0].tick(0);
    expect(voice.playBeat.mock.calls[0][0]).toBe(false);
    expect(beats[0].accented).toBe(false);
  });

  it('follows tempo changes while running', () => {
    engine.start();
    store.setBpm(60);
    expect(clocks[0].frequency.value).toBe(1);
  });

  it('starts counting from the first beat again when the bar length changes', () => {
    engine.start();
    clocks[0].tick(0);
    clocks[0].tick(0.5);
    store.setBeatsPerBar(6);
    clocks[0].tick(1);
    expect(beats[2]).toMatchObject({ beat: 0, beatsPerBar: 6 });
  });

  it('stops and lets go of the clock', () => {
    engine.start();
    engine.stop();
    expect(engine.isRunning()).toBe(false);
    expect(clocks[0].stopped).toBe(1);
    expect(clocks[0].disposed).toBe(1);
  });

  it('does not react to tempo changes after it stopped', () => {
    engine.start();
    engine.stop();
    store.setBpm(90);
    expect(clocks[0].frequency.value).toBe(2);
  });

  it('ignores a second start and a stop that was not started', () => {
    engine.stop();
    engine.start();
    engine.start();
    expect(clocks).toHaveLength(1);
  });

  it('tells listeners when it starts and stops', () => {
    const states: boolean[] = [];
    engine.onRunningChange((running) => states.push(running));
    engine.start();
    engine.stop();
    expect(states).toEqual([true, false]);
  });

  it('can start again after stopping, from the first beat', () => {
    engine.start();
    clocks[0].tick(0);
    engine.stop();
    engine.start();
    clocks[1].tick(0);
    expect(beats.map((b) => b.beat)).toEqual([0, 0]);
  });
});
