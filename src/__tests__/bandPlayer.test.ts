import { describe, expect, it, vi } from 'vitest';
import type { Arrangement } from '../band/arrange';
import { BandPlayer, type BandBackend } from '../band/bandPlayer';
import type { BandPart } from '../band/patterns';
import { generateProgression } from '../generator/progression';
import { spellScale } from '../theory/spell';

function fakeBackend(ready = true) {
  let handlers: { onBeat(beat: number): void; onEnd(): void } | null = null;
  const calls: string[] = [];
  const starts: { arrangement: Arrangement; bpm: number; loop: boolean }[] = [];
  const backend: BandBackend = {
    ready: vi.fn(async () => ready),
    start: vi.fn((arrangement, options) => {
      calls.push('start');
      starts.push({ arrangement, bpm: options.bpm, loop: options.loop });
      handlers = options;
    }),
    stop: vi.fn(() => void calls.push('stop')),
    setBpm: vi.fn(),
    setMuted: vi.fn(),
  };
  return { backend, calls, starts, beat: (n: number) => handlers!.onBeat(n), end: () => handlers!.onEnd() };
}

const progression = (bars = 4, seed = 2) => generateProgression({ scale: spellScale(0, 'major'), style: 'pop', bars, seed, bpm: 100 });

describe('BandPlayer', () => {
  it('starts the band on the arrangement of the progression, at the tempo and looping', async () => {
    const { backend, starts } = fakeBackend();
    const player = new BandPlayer(backend);
    player.setProgression(progression());
    player.setBpm(96);
    expect(await player.play()).toBe('playing');
    expect(player.isPlaying()).toBe(true);
    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatchObject({ bpm: 96, loop: true });
    expect(starts[0].arrangement.loopBeats).toBe(16);
    expect(starts[0].arrangement.countInBeats).toBe(0);
  });

  it('has nothing to play without a progression, or with a progression without chords', async () => {
    const { backend } = fakeBackend();
    const player = new BandPlayer(backend);
    expect(await player.play()).toBe('nothing');
    player.setProgression({ ...progression(), chords: [] });
    expect(await player.play()).toBe('nothing');
    expect(backend.start).not.toHaveBeenCalled();
  });

  it('says so when the sounds cannot be loaded, and stays silent', async () => {
    const { backend } = fakeBackend(false);
    const player = new BandPlayer(backend);
    player.setProgression(progression());
    expect(await player.play()).toBe('noSound');
    expect(player.isPlaying()).toBe(false);
    expect(backend.start).not.toHaveBeenCalled();
  });

  it('stops, and tells the listeners', async () => {
    const { backend, calls } = fakeBackend();
    const player = new BandPlayer(backend);
    const states: boolean[] = [];
    player.onState((playing) => states.push(playing));
    player.setProgression(progression());
    await player.play();
    player.stop();
    player.stop();
    expect(states).toEqual([true, false]);
    expect(calls).toEqual(['stop', 'start', 'stop']);
    expect(player.isPlaying()).toBe(false);
  });

  it('gives each beat of the loop, and the chord on it, to the listeners; the count-in has none', async () => {
    const { backend, beat } = fakeBackend();
    const player = new BandPlayer(backend);
    const heard: [number, string | undefined][] = [];
    const stop = player.onBeat((b, chord) => heard.push([b, chord?.chord.symbol]));
    const p = progression();
    player.setProgression(p);
    player.setCountIn(true);
    await player.play();
    beat(-2);
    beat(0);
    beat(4);
    beat(16);
    expect(heard.map(([b]) => b)).toEqual([0, 4, 16]);
    expect(heard[0][1]).toBe(p.chords[0].chord.symbol);
    expect(heard[1][1]).toBe(p.chords.find((c) => c.bar === 1)!.chord.symbol);
    // the loop goes round: beat 16 is the start again
    expect(heard[2][1]).toBe(p.chords[0].chord.symbol);
    stop();
    beat(1);
    expect(heard).toHaveLength(3);
  });

  it('adds a count-in when asked', async () => {
    const { backend, starts } = fakeBackend();
    const player = new BandPlayer(backend);
    player.setProgression(progression());
    player.setCountIn(true);
    await player.play();
    expect(starts[0].arrangement.countInBeats).toBe(4);
  });

  it('plays once, then stops by itself, when it does not loop', async () => {
    const { backend, starts, end, beat } = fakeBackend();
    const player = new BandPlayer(backend);
    player.setProgression(progression());
    player.setLoop(false);
    await player.play();
    expect(starts[0].loop).toBe(false);
    const heard: number[] = [];
    player.onBeat((b) => heard.push(b));
    beat(15);
    beat(16); // past the end: still the last beat
    expect(heard).toEqual([15, 15]);
    end();
    expect(player.isPlaying()).toBe(false);
  });

  it('changes the tempo at once while it plays, without starting again', async () => {
    const { backend, starts } = fakeBackend();
    const player = new BandPlayer(backend);
    player.setProgression(progression());
    await player.play();
    player.setBpm(120);
    expect(backend.setBpm).toHaveBeenCalledWith(120);
    expect(starts).toHaveLength(1);
  });

  it('starts again when the transposition or the looping changes while it plays', async () => {
    const { backend, starts } = fakeBackend();
    const player = new BandPlayer(backend);
    player.setProgression(progression());
    await player.play();
    player.setTranspose(3);
    expect(starts).toHaveLength(2);
    const first = starts[0].arrangement.events.find((e) => e.part === 'chords')!.midis![0];
    const second = starts[1].arrangement.events.find((e) => e.part === 'chords')!.midis![0];
    expect(second - first).toBe(3);
    player.setLoop(false);
    expect(starts).toHaveLength(3);
    expect(starts[2].loop).toBe(false);
  });

  it('keeps the transposition between -6 and 6 semitones, in whole semitones', () => {
    const player = new BandPlayer(fakeBackend().backend);
    player.setTranspose(9);
    expect(player.getSettings().transpose).toBe(6);
    player.setTranspose(-9);
    expect(player.getSettings().transpose).toBe(-6);
    player.setTranspose(2.4);
    expect(player.getSettings().transpose).toBe(2);
  });

  it('mutes and unmutes a part, and mutes it again when it starts again', async () => {
    const { backend } = fakeBackend();
    const player = new BandPlayer(backend);
    player.setProgression(progression());
    player.setMuted('drums', true);
    expect(player.isMuted('drums')).toBe(true);
    expect(backend.setMuted).toHaveBeenCalledWith('drums', true);
    await player.play();
    const calls = vi.mocked(backend.setMuted).mock.calls.length;
    player.setTranspose(1); // starts again
    const again = vi.mocked(backend.setMuted).mock.calls.slice(calls);
    expect(again).toContainEqual(['drums', true] satisfies [BandPart, boolean]);
    player.setMuted('drums', false);
    expect(player.isMuted('drums')).toBe(false);
  });

  it('starts again on a new progression while it plays, and stops when there is none', async () => {
    const { backend, starts } = fakeBackend();
    const player = new BandPlayer(backend);
    player.setProgression(progression(4, 1));
    await player.play();
    player.setProgression(progression(8, 1));
    expect(starts).toHaveLength(2);
    expect(starts[1].arrangement.loopBeats).toBe(32);
    player.setProgression(null);
    expect(player.isPlaying()).toBe(false);
  });
});
