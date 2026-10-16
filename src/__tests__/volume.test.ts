import { describe, it, expect } from 'vitest';
import { sliderToDb } from '../core/volume';

describe('sliderToDb', () => {
  it('maps 0..100 to -40..0 dB', () => {
    expect(sliderToDb(100)).toBe(0);
    expect(sliderToDb(50)).toBe(-20);
    expect(sliderToDb(80)).toBe(-8);
    expect(sliderToDb(0)).toBe(-40);
  });

  it('can mute at zero', () => {
    expect(sliderToDb(0, true)).toBe(-Infinity);
    expect(sliderToDb(1, true)).toBeCloseTo(-39.6, 5);
  });

  it('keeps out-of-range and unreadable values inside the scale', () => {
    expect(sliderToDb(150)).toBe(0);
    expect(sliderToDb(-10)).toBe(-40);
    expect(sliderToDb(NaN)).toBe(-40);
  });
});
