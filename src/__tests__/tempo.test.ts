import { describe, it, expect } from 'vitest';
import { clampBpm, MIN_BPM, MAX_BPM, DEFAULT_BPM } from '../core/tempo';

describe('clampBpm', () => {
  it('keeps a value inside the range unchanged', () => {
    expect(clampBpm(90)).toBe(90);
    expect(clampBpm(MIN_BPM)).toBe(MIN_BPM);
    expect(clampBpm(MAX_BPM)).toBe(MAX_BPM);
  });

  it('raises values that are too slow and lowers values that are too fast', () => {
    expect(clampBpm(3)).toBe(MIN_BPM);
    expect(clampBpm(-50)).toBe(MIN_BPM);
    expect(clampBpm(5000)).toBe(MAX_BPM);
  });

  it('rounds to a whole number', () => {
    expect(clampBpm(72.6)).toBe(73);
  });

  it('falls back to the default for values that are not numbers', () => {
    expect(clampBpm(NaN)).toBe(DEFAULT_BPM);
    expect(clampBpm(Infinity)).toBe(DEFAULT_BPM);
  });

  it('reads numbers from text, as typed in the tempo field', () => {
    expect(clampBpm('120')).toBe(120);
    expect(clampBpm('')).toBe(DEFAULT_BPM);
    expect(clampBpm('abc')).toBe(DEFAULT_BPM);
  });
});
