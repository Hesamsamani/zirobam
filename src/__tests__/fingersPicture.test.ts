import { describe, it, expect } from 'vitest';
import { buildFingersPicture } from '../lessons/fingersPicture';

const options = { ariaLabel: 'Hands', left: 'Left hand', right: 'Right hand', formatNumber: (n: number) => `#${n}` };

describe('buildFingersPicture', () => {
  it('draws two hands, five fingers each, numbered', () => {
    const svg = buildFingersPicture(options);
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Hands');
    expect(svg.querySelectorAll('.fp-hand')).toHaveLength(2);
    expect(svg.querySelectorAll('.fp-finger')).toHaveLength(10);
  });

  it('puts the thumbs next to each other, in the middle', () => {
    const svg = buildFingersPicture(options);
    const left = Array.from(svg.querySelectorAll('[data-hand="left"] .fp-badge')).map((el) => el.textContent);
    const right = Array.from(svg.querySelectorAll('[data-hand="right"] .fp-badge')).map((el) => el.textContent);
    expect(left).toEqual(['#5', '#4', '#3', '#2', '#1']);
    expect(right).toEqual(['#1', '#2', '#3', '#4', '#5']);
  });

  it('labels the hands', () => {
    const svg = buildFingersPicture(options);
    expect(Array.from(svg.querySelectorAll('.fp-label')).map((el) => el.textContent)).toEqual(['Left hand', 'Right hand']);
  });

  it('is drawn left to right whatever the language', () => {
    const svg = buildFingersPicture(options);
    expect(svg.getAttribute('direction') ?? svg.style.direction).toBeTruthy();
  });

  it('makes the thumb shorter than the middle finger', () => {
    const svg = buildFingersPicture(options);
    const height = (n: number) =>
      Number(svg.querySelector(`[data-hand="right"] [data-finger="${n}"] rect`)!.getAttribute('height'));
    expect(height(1)).toBeLessThan(height(3));
    expect(height(5)).toBeLessThan(height(3));
  });
});
