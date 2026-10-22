import { describe, expect, it } from 'vitest';
import { makeBrandMark } from '../ui/brandMark';

describe('the ZiroBam mark', () => {
  it('is a heavy Z with a notehead, drawn as an SVG that screen readers leave alone', () => {
    const mark = makeBrandMark(document);
    expect(mark.tagName.toLowerCase()).toBe('svg');
    expect(mark.classList.contains('brand-mark')).toBe(true);
    expect(mark.getAttribute('aria-hidden')).toBe('true');
    expect(mark.getAttribute('focusable')).toBe('false');
    expect(mark.getAttribute('viewBox')).toBe('8 8 48 48');
    expect(mark.querySelectorAll('polygon.mark-z')).toHaveLength(1);
    expect(mark.querySelectorAll('ellipse.mark-note')).toHaveLength(1);
  });

  it('is a new element each time, and takes extra classes', () => {
    const a = makeBrandMark(document, 'nav-mark');
    expect(a).not.toBe(makeBrandMark(document));
    expect(a.classList.contains('nav-mark')).toBe(true);
    expect(a.classList.contains('brand-mark')).toBe(true);
  });
});
