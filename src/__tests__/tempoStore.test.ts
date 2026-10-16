import { describe, it, expect, vi } from 'vitest';
import { TempoStore, BEATS_OPTIONS } from '../metronome/tempoStore';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe('TempoStore', () => {
  it('starts with sensible defaults', () => {
    const store = new TempoStore(fakeStorage());
    expect(store.state).toEqual({ bpm: 30, enabled: true, volume: 50, beatsPerBar: 4, accent: true });
  });

  it('keeps the tempo inside the supported range', () => {
    const store = new TempoStore(fakeStorage());
    store.setBpm(5000);
    expect(store.state.bpm).toBe(200);
    store.setBpm(1);
    expect(store.state.bpm).toBe(20);
    store.setBpm(Number.NaN);
    expect(store.state.bpm).toBe(30);
    store.setBpm(87.6);
    expect(store.state.bpm).toBe(88);
  });

  it('tells listeners what changed, and only when something changed', () => {
    const store = new TempoStore(fakeStorage());
    const seen: string[] = [];
    store.onChange((_state, key) => seen.push(key));
    store.setBpm(90);
    store.setBpm(90);
    store.setEnabled(false);
    store.setEnabled(false);
    store.setVolume(70);
    store.setBeatsPerBar(3);
    store.setAccent(false);
    expect(seen).toEqual(['bpm', 'enabled', 'volume', 'beatsPerBar', 'accent']);
  });

  it('gives listeners the new state', () => {
    const store = new TempoStore(fakeStorage());
    const listener = vi.fn();
    store.onChange(listener);
    store.setBpm(120);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ bpm: 120 }), 'bpm');
  });

  it('stops telling a listener after it unsubscribed', () => {
    const store = new TempoStore(fakeStorage());
    const listener = vi.fn();
    const off = store.onChange(listener);
    off();
    store.setBpm(100);
    expect(listener).not.toHaveBeenCalled();
  });

  it('only accepts the supported beats per bar', () => {
    const store = new TempoStore(fakeStorage());
    expect(BEATS_OPTIONS).toEqual([2, 3, 4, 6]);
    store.setBeatsPerBar(5 as never);
    expect(store.state.beatsPerBar).toBe(4);
    store.setBeatsPerBar(6);
    expect(store.state.beatsPerBar).toBe(6);
  });

  it('keeps the volume on the 0 to 100 scale', () => {
    const store = new TempoStore(fakeStorage());
    store.setVolume(250);
    expect(store.state.volume).toBe(100);
    store.setVolume(-3);
    expect(store.state.volume).toBe(0);
  });

  it('remembers beats per bar and the accent, but not the tempo', () => {
    const storage = fakeStorage();
    const first = new TempoStore(storage);
    first.setBeatsPerBar(3);
    first.setAccent(false);
    first.setBpm(140);
    const second = new TempoStore(storage);
    expect(second.state.beatsPerBar).toBe(3);
    expect(second.state.accent).toBe(false);
    expect(second.state.bpm).toBe(30);
  });

  it('ignores damaged saved data', () => {
    for (const saved of ['not json', '{"beatsPerBar":7,"accent":"yes"}', '[]', 'null']) {
      const store = new TempoStore(fakeStorage({ 'metronome.v1': saved }));
      expect(store.state.beatsPerBar).toBe(4);
      expect(store.state.accent).toBe(true);
    }
  });

  it('works when storage is not available', () => {
    const store = new TempoStore(null);
    store.setBeatsPerBar(2);
    expect(store.state.beatsPerBar).toBe(2);
  });
});
