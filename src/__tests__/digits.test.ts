import { describe, it, expect } from 'vitest';
import { toPersianDigits, toLatinDigits } from '../i18n/digits';

describe('digits', () => {
  it('converts Latin digits to Persian digits', () => {
    expect(toPersianDigits(1405)).toBe('۱۴۰۵');
    expect(toPersianDigits('Level 12')).toBe('Level ۱۲');
  });

  it('leaves other characters alone', () => {
    expect(toPersianDigits('a-b/3')).toBe('a-b/۳');
  });

  it('converts Persian digits back to Latin digits', () => {
    expect(toLatinDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  });
});
