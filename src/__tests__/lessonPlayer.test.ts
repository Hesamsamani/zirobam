import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LessonPlayer, type PlayerBackend } from '../lessons/lessonPlayer';

function fakeBackend(ready = true) {
  const played: Array<{ note: string; seconds: number; startsIn: number }> = [];
  const backend: PlayerBackend = {
    ready: vi.fn(async () => ready),
    play: vi.fn((note, seconds, startsIn) => void played.push({ note, seconds, startsIn })),
    stopAll: vi.fn(),
  };
  return { backend, played };
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('LessonPlayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('plays one key for a moment', async () => {
    const { backend, played } = fakeBackend();
    new LessonPlayer(backend).playNote('E4');
    await flush();
    expect(played).toEqual([{ note: 'E4', seconds: 1, startsIn: 0 }]);
  });

  it('does not play a key when the sound cannot be loaded', async () => {
    const { backend, played } = fakeBackend(false);
    new LessonPlayer(backend).playNote('E4');
    await flush();
    expect(played).toEqual([]);
  });

  it('schedules every note of an example at the tempo', async () => {
    const { backend, played } = fakeBackend();
    const player = new LessonPlayer(backend, 60); // one beat a second
    player.playExample({ clef: 'treble', notes: 'C4q D4h E4q' }, () => {});
    await flush();
    expect(played).toEqual([
      { note: 'C4', seconds: expect.closeTo(0.95, 2), startsIn: 0 },
      { note: 'D4', seconds: expect.closeTo(1.95, 2), startsIn: 1 },
      { note: 'E4', seconds: expect.closeTo(0.95, 2), startsIn: 3 },
    ]);
  });

  it('tells when the example is over, after its last beat', async () => {
    const { backend } = fakeBackend();
    const done = vi.fn();
    new LessonPlayer(backend, 60).playExample({ clef: 'treble', notes: 'C4w' }, done);
    await flush();
    vi.advanceTimersByTime(3900);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(done).toHaveBeenCalledOnce();
  });

  it('waits for the trailing rests', async () => {
    const { backend } = fakeBackend();
    const done = vi.fn();
    new LessonPlayer(backend, 60).playExample({ clef: 'treble', notes: 'C4q rq rh' }, done);
    await flush();
    vi.advanceTimersByTime(3500);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(700);
    expect(done).toHaveBeenCalledOnce();
  });

  it('can be stopped: the sound stops and the example never reports it ended', async () => {
    const { backend } = fakeBackend();
    const done = vi.fn();
    const stop = new LessonPlayer(backend, 60).playExample({ clef: 'treble', notes: 'C4w' }, done);
    await flush();
    stop();
    expect(backend.stopAll).toHaveBeenCalled();
    vi.advanceTimersByTime(10000);
    expect(done).not.toHaveBeenCalled();
  });

  it('plays nothing if it is stopped before the sound has loaded', async () => {
    const { backend, played } = fakeBackend();
    const stop = new LessonPlayer(backend).playExample({ clef: 'treble', notes: 'C4w' }, () => {});
    stop();
    await flush();
    expect(played).toEqual([]);
  });

  it('ends at once when the sound cannot be loaded', async () => {
    const { backend, played } = fakeBackend(false);
    const done = vi.fn();
    new LessonPlayer(backend).playExample({ clef: 'treble', notes: 'C4w' }, done);
    await flush();
    expect(played).toEqual([]);
    expect(done).toHaveBeenCalledOnce();
  });

  it('plays a grand staff with both hands', async () => {
    const { backend, played } = fakeBackend();
    new LessonPlayer(backend, 60).playExample({ clef: 'grand', notes: 'E4w', lower: 'C3w' }, () => {});
    await flush();
    expect(played.map((p) => p.note).sort()).toEqual(['C3', 'E4']);
    expect(played.every((p) => p.startsIn === 0)).toBe(true);
  });

  it('turns a flat or sharp into the name the sampler understands', async () => {
    const { backend, played } = fakeBackend();
    new LessonPlayer(backend, 60).playExample({ clef: 'treble', notes: 'Bb4q F#4q rh' }, () => {});
    await flush();
    expect(played.map((p) => p.note)).toEqual(['A#4', 'F#4']);
  });
});
