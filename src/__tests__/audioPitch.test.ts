import { describe, expect, it } from 'vitest';
import { seededRng } from '../core/rng';
import { detectPitch } from '../audio/yin';
import { A4_DEFAULT, A4_MAX, A4_MIN, clampA4, readFrequency } from '../audio/tuning';
import { NoteTracker, type TrackerEvent } from '../audio/noteTracker';

const SR = 44100;
const N = 2048;

/** A tone with a few harmonics, like an instrument, `n` samples long. */
function tone(frequency: number, options: { harmonics?: number[]; sampleRate?: number; length?: number; phase?: number } = {}): Float32Array {
  const { harmonics = [1, 0.5, 0.25], sampleRate = SR, length = N, phase = 0 } = options;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let v = 0;
    harmonics.forEach((amp, h) => (v += amp * Math.sin(2 * Math.PI * frequency * (h + 1) * (i / sampleRate) + phase)));
    out[i] = v * 0.3;
  }
  return out;
}

const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

describe('detectPitch', () => {
  it('finds the pitch of a tone to within two cents, from a low string to a high whistle', () => {
    for (const f of [82.41, 110, 196, 261.63, 440, 659.26, 1000, 1760]) {
      const found = detectPitch(tone(f), SR);
      expect(found, `${f}`).not.toBeNull();
      expect(Math.abs(cents(found!.frequency, f)), `${f}`).toBeLessThan(2);
      expect(found!.clarity).toBeGreaterThan(0.9);
    }
  });

  it('finds a pure sine as well as a tone with harmonics, and another phase', () => {
    expect(Math.abs(cents(detectPitch(tone(440, { harmonics: [1] }), SR)!.frequency, 440))).toBeLessThan(2);
    expect(Math.abs(cents(detectPitch(tone(330, { phase: 1.3 }), SR)!.frequency, 330))).toBeLessThan(2);
  });

  it('works at another sample rate', () => {
    const found = detectPitch(tone(440, { sampleRate: 48000 }), 48000)!;
    expect(Math.abs(cents(found.frequency, 440))).toBeLessThan(2);
  });

  it('hears the fundamental when the harmonics are louder than it', () => {
    const found = detectPitch(tone(220, { harmonics: [0.6, 1, 0.8, 0.5] }), SR)!;
    expect(Math.abs(cents(found.frequency, 220))).toBeLessThan(3);
  });

  it('has no pitch in silence', () => {
    expect(detectPitch(new Float32Array(N), SR)).toBeNull();
  });

  it('has no sure pitch in noise', () => {
    const rng = seededRng(4);
    const noise = Float32Array.from({ length: N }, () => (rng() - 0.5) * 0.6);
    const found = detectPitch(noise, SR);
    expect(found === null || found.clarity < 0.8).toBe(true);
  });

  it('ignores what is below or above the range asked for', () => {
    expect(detectPitch(tone(30, { length: 4096 }), SR, { minFrequency: 50 })).toBeNull();
  });
});

describe('clampA4', () => {
  it('keeps the reference between 415 and 466 Hz and rounds to a tenth of a hertz', () => {
    expect(A4_DEFAULT).toBe(440);
    expect(A4_MIN).toBe(415);
    expect(A4_MAX).toBe(466);
    expect(clampA4(300)).toBe(415);
    expect(clampA4(500)).toBe(466);
    expect(clampA4(432.04)).toBe(432);
    expect(clampA4(Number.NaN)).toBe(440);
  });
});

describe('readFrequency: the twelve notes', () => {
  it('names A4 at 440 Hz with no cents, and the notes round it', () => {
    expect(readFrequency(440, 440, 'et')).toMatchObject({ name: 'A4', midi: 69, cents: 0 });
    expect(readFrequency(261.63, 440, 'et')).toMatchObject({ name: 'C4', midi: 60 });
    expect(readFrequency(466.16, 440, 'et')).toMatchObject({ name: 'A#4', midi: 70 });
  });

  it('says how far a note is from the note it is nearest to, in cents', () => {
    const sharp = readFrequency(440 * 2 ** (30 / 1200), 440, 'et');
    expect(sharp.name).toBe('A4');
    expect(sharp.cents).toBeCloseTo(30, 1);
    const flat = readFrequency(440 * 2 ** (-20 / 1200), 440, 'et');
    expect(flat.cents).toBeCloseTo(-20, 1);
    // past the half way mark it is the next note, flat
    const next = readFrequency(440 * 2 ** (60 / 1200), 440, 'et');
    expect(next.name).toBe('A#4');
    expect(next.cents).toBeCloseTo(-40, 1);
  });

  it('follows the reference: 432 Hz is A4 when A4 is 432', () => {
    expect(readFrequency(432, 432, 'et')).toMatchObject({ name: 'A4', cents: 0 });
    const flat = readFrequency(432, 440, 'et');
    expect(flat.name).toBe('A4');
    expect(flat.cents).toBeCloseTo(-31.8, 0);
  });

  it('counts octaves: the A of 110 Hz is A2 and the one of 880 Hz is A5', () => {
    expect(readFrequency(110, 440, 'et').name).toBe('A2');
    expect(readFrequency(880, 440, 'et').name).toBe('A5');
  });
});

describe('readFrequency: the quarter tones', () => {
  it('finds the notes of the piano as in the twelve notes', () => {
    expect(readFrequency(440, 440, 'quarter')).toMatchObject({ name: 'A4', cents: 0 });
  });

  it('writes a note between two keys as a koron or a sori, in the grammar of the app', () => {
    const half = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
    // 63.5: between D sharp and E: E koron
    expect(readFrequency(half(63.5), 440, 'quarter')).toMatchObject({ name: 'Ek4', midi: 63.5 });
    // 62.5: between D and D sharp: D sori
    expect(readFrequency(half(62.5), 440, 'quarter')).toMatchObject({ name: 'Do4', midi: 62.5 });
    // 64.5: between E and F: F koron
    expect(readFrequency(half(64.5), 440, 'quarter')).toMatchObject({ name: 'Fk4', midi: 64.5 });
    // 69.5: between A and A sharp: A sori
    expect(readFrequency(half(69.5), 440, 'quarter')).toMatchObject({ name: 'Ao4', midi: 69.5 });
  });

  it('measures the cents from the nearest quarter tone', () => {
    const f = 440 * 2 ** ((63.5 - 69) / 12) * 2 ** (10 / 1200);
    const r = readFrequency(f, 440, 'quarter');
    expect(r.name).toBe('Ek4');
    expect(r.cents).toBeCloseTo(10, 1);
  });
});

describe('NoteTracker', () => {
  const run = (frames: (number | null)[], options = {}) => {
    const tracker = new NoteTracker(options);
    const events: TrackerEvent[] = [];
    for (const midi of frames) events.push(...tracker.push(midi));
    return events;
  };

  it('starts a note after a few frames of it and stops it after a few frames of nothing', () => {
    const events = run([60, 60, 60, 60, null, null, null, null, null]);
    expect(events).toEqual([
      { type: 'on', midi: 60 },
      { type: 'off', midi: 60 },
    ]);
  });

  it('does not start a note for a frame or two, a blip', () => {
    expect(run([60, 60, null, 62, null, 64, 64, null])).toEqual([]);
  });

  it('keeps a note through a short gap', () => {
    const events = run([60, 60, 60, null, null, 60, 60, 60, 60, null, null, null, null]);
    expect(events).toEqual([
      { type: 'on', midi: 60 },
      { type: 'off', midi: 60 },
    ]);
  });

  it('changes from one note to the next: the old one stops as the new one starts', () => {
    const events = run([60, 60, 60, 60, 62, 62, 62, 62]);
    expect(events).toEqual([
      { type: 'on', midi: 60 },
      { type: 'off', midi: 60 },
      { type: 'on', midi: 62 },
    ]);
  });

  it('lets a single stray frame of another note pass', () => {
    expect(run([60, 60, 60, 61, 60, 60])).toEqual([{ type: 'on', midi: 60 }]);
  });

  it('can be told how many frames to wait', () => {
    const events = run([60, 60, null, null], { minFrames: 2, releaseFrames: 2 });
    expect(events).toEqual([
      { type: 'on', midi: 60 },
      { type: 'off', midi: 60 },
    ]);
  });

  it('lets go of the note when it is reset', () => {
    const tracker = new NoteTracker();
    for (let i = 0; i < 4; i++) tracker.push(60);
    expect(tracker.reset()).toEqual([{ type: 'off', midi: 60 }]);
    expect(tracker.reset()).toEqual([]);
  });
});
