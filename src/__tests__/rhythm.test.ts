import { describe, expect, it } from 'vitest';
import { seededRng } from '../core/rng';
import { METERS } from '../generator/rhythmCells';
import { parseMelody } from '../songs/songBuilder';
import { makeRhythm, nextRhythm, onsets, RHYTHM_LEVELS, RHYTHM_LEVEL_COUNT, tokens, totalBeats } from '../rhythm/rhythmGen';
import { didPassRhythm, medianOffset, scoreTaps } from '../rhythm/tapScoring';

describe('the levels', () => {
  it('are ten, from quarter notes to mixed sixteenths, with 3/4 and 6/8 on the way', () => {
    expect(RHYTHM_LEVEL_COUNT).toBe(10);
    expect(RHYTHM_LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(RHYTHM_LEVELS[7].meter).toBe('3/4');
    expect(RHYTHM_LEVELS[8].meter).toBe('6/8');
    expect(RHYTHM_LEVELS[0].restChance).toBe(0);
  });
});

describe('makeRhythm', () => {
  it('fills every bar of its meter exactly, for every level', () => {
    for (const level of RHYTHM_LEVELS) {
      const rng = seededRng(level.id);
      for (let i = 0; i < 40; i++) {
        const ex = makeRhythm(level.id, rng);
        expect(ex.bars).toHaveLength(level.bars);
        ex.bars.forEach((bar, b) => {
          expect(bar.reduce((s, n) => s + n.units, 0), `level ${level.id}`).toBe(METERS[level.meter].units);
          expect(bar[0].start).toBe(b * METERS[level.meter].units);
        });
      }
    }
  });

  it('never starts with a rest, and has no rests at all in the first level', () => {
    for (const level of RHYTHM_LEVELS) {
      const rng = seededRng(7);
      for (let i = 0; i < 60; i++) {
        const ex = makeRhythm(level.id, rng);
        expect(ex.bars[0][0].rest).toBe(false);
        if (level.restChance === 0) expect(ex.bars.flat().some((n) => n.rest)).toBe(false);
      }
    }
  });

  it('has rests in the levels that ask for them', () => {
    const rng = seededRng(3);
    let rests = 0;
    for (let i = 0; i < 100; i++) rests += makeRhythm(4, rng).bars.flat().filter((n) => n.rest).length;
    expect(rests).toBeGreaterThan(10);
  });

  it('is the same for the same seed, and not always the same piece', () => {
    expect(makeRhythm(5, seededRng(11))).toEqual(makeRhythm(5, seededRng(11)));
    const keys = new Set(Array.from({ length: 20 }, (_, i) => makeRhythm(5, seededRng(i + 1)).key));
    expect(keys.size).toBeGreaterThan(5);
  });

  it('writes tokens the notation of the songs reads, in the meter of the level', () => {
    for (const level of RHYTHM_LEVELS) {
      const ex = makeRhythm(level.id, seededRng(5));
      const m = METERS[level.meter];
      const measures = parseMelody(tokens(ex), m.beats, m.beatType);
      expect(measures).toHaveLength(level.bars);
    }
  });

  it('asks for a tap on every note and none on a rest, counted in beats', () => {
    const ex = makeRhythm(4, seededRng(9));
    const notes = ex.bars.flat().filter((n) => !n.rest);
    expect(onsets(ex)).toEqual(notes.map((n) => n.start / 4));
    expect(onsets(ex)[0]).toBe(0);
    expect(totalBeats(ex)).toBe(8);
    expect(totalBeats(makeRhythm(9, seededRng(1)))).toBe(6);
  });

  it('keeps the level in range and never repeats the piece before', () => {
    expect(makeRhythm(0, seededRng(1)).level.id).toBe(1);
    expect(makeRhythm(99, seededRng(1)).level.id).toBe(10);
    const rng = seededRng(2);
    let previous = makeRhythm(1, rng);
    for (let i = 0; i < 100; i++) {
      const next = nextRhythm(1, rng, previous);
      expect(next.key).not.toBe(previous.key);
      previous = next;
    }
  });
});

describe('scoreTaps', () => {
  const beats = [0, 500, 1000, 1500];

  it('calls taps within 35 ms perfect, within 80 good, and then early or late', () => {
    const s = scoreTaps(beats, [10, 460, 1100, 1400]);
    expect(s.results.map((r) => r.verdict)).toEqual(['perfect', 'good', 'late', 'early']);
    expect(s.results.map((r) => r.deltaMs)).toEqual([10, -40, 100, -100]);
    expect(s).toMatchObject({ perfect: 1, good: 1, late: 1, early: 1, missed: 0, extraTaps: 0, accuracy: 0.5 });
  });

  it('calls a note with no tap near it missed, and a tap near no note extra', () => {
    const s = scoreTaps(beats, [0, 540, 1490, 1800]);
    expect(s.results.map((r) => r.verdict)).toEqual(['perfect', 'good', 'missed', 'perfect']);
    expect(s.extraTaps).toBe(1);
    expect(s.missed).toBe(1);
    expect(s.results[2].tapMs).toBeNull();
  });

  it('gives each tap to one note: a second tap near the same beat is an extra one', () => {
    const s = scoreTaps([0, 500], [0, 20]);
    expect(s.results.map((r) => r.verdict)).toEqual(['perfect', 'missed']);
    expect(s.extraTaps).toBe(1);
  });

  it('takes the delay of the device off every tap', () => {
    const s = scoreTaps(beats, [90, 590, 1090, 1590], 90);
    expect(s.results.every((r) => r.verdict === 'perfect')).toBe(true);
    expect(s.results.every((r) => r.deltaMs === 0)).toBe(true);
  });

  it('takes the taps in any order', () => {
    const s = scoreTaps(beats, [1500, 0, 1000, 500]);
    expect(s.perfect).toBe(4);
  });

  it('has an accuracy of 0 for no notes', () => {
    expect(scoreTaps([], [10, 20]).accuracy).toBe(0);
    expect(scoreTaps([], [10, 20]).extraTaps).toBe(2);
  });
});

describe('didPassRhythm', () => {
  it('passes at 80 per cent perfect or good, with few stray taps', () => {
    const beats = Array.from({ length: 10 }, (_, i) => i * 500);
    expect(didPassRhythm(scoreTaps(beats, beats.map((b) => b + 20)))).toBe(true);
    expect(didPassRhythm(scoreTaps(beats, beats.slice(0, 7).map((b) => b + 20)))).toBe(false);
    expect(didPassRhythm(scoreTaps(beats, [...beats.slice(0, 9), 4700]))).toBe(true);
    expect(didPassRhythm(scoreTaps(beats, [...beats, 4700, 4800, 4900]))).toBe(false);
    expect(didPassRhythm(scoreTaps([], []))).toBe(false);
  });
});

describe('medianOffset', () => {
  it('is the middle of the differences', () => {
    expect(medianOffset([40, 50, 60])).toBe(50);
    expect(medianOffset([40, 60])).toBe(50);
  });

  it('leaves out a stray tap far from the others', () => {
    expect(medianOffset([48, 52, 50, 49, 51, 400, -300])).toBe(50);
    expect(medianOffset([48, 52, 50, 49, 51, 140])).toBe(50);
  });

  it('is zero with nothing to go by', () => {
    expect(medianOffset([])).toBe(0);
    expect(medianOffset([900, -900])).toBe(0);
  });
});
