import { describe, expect, it } from 'vitest';
import { buildFretboardPicture } from '../scales/fretboardPicture';
import type { GuitarShape } from '../theory/guitar';

const shape = (frets: number[], overrides: Partial<GuitarShape> = {}): GuitarShape => ({
  frets,
  baseFret: 1,
  kind: 'open',
  barre: null,
  ...overrides,
});

describe('buildFretboardPicture', () => {
  it('draws six strings and the frets, and is a picture with a name', () => {
    const svg = buildFretboardPicture(shape([-1, 3, 2, 0, 1, 0]), { ariaLabel: 'C major, open position' });
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('C major, open position');
    expect(svg.querySelectorAll('.fb-string')).toHaveLength(6);
    // the nut is the top line of the first position, so four fret lines are left
    expect(svg.querySelectorAll('.fb-nut, .fb-fret')).toHaveLength(5);
  });

  it('puts a dot on every fretted string, a cross on a muted one and a ring on an open one', () => {
    const svg = buildFretboardPicture(shape([-1, 3, 2, 0, 1, 0]), { ariaLabel: 'x' });
    const dots = [...svg.querySelectorAll('.fb-dot')].map((d) => `${d.getAttribute('data-string')}:${d.getAttribute('data-fret')}`);
    expect(dots).toEqual(['1:3', '2:2', '4:1']);
    expect(svg.querySelectorAll('.fb-muted')).toHaveLength(1);
    expect(svg.querySelectorAll('.fb-open')).toHaveLength(2);
  });

  it('shows the nut for the first position and the number of the fret for a higher one', () => {
    const low = buildFretboardPicture(shape([-1, 3, 2, 0, 1, 0]), { ariaLabel: 'x' });
    expect(low.querySelector('.fb-nut')).not.toBeNull();
    expect(low.querySelector('.fb-base')).toBeNull();
    const high = buildFretboardPicture(shape([8, 10, 10, 9, 8, 8], { baseFret: 8, kind: 'barre', barre: { fret: 8, from: 0, to: 5 } }), { ariaLabel: 'x' });
    expect(high.querySelector('.fb-nut')).toBeNull();
    expect(high.querySelector('.fb-base')?.textContent).toBe('8');
  });

  it('places a dot in the row of its fret, counted from the base fret', () => {
    const svg = buildFretboardPicture(shape([8, 10, 10, 9, 8, 8], { baseFret: 8, kind: 'barre', barre: { fret: 8, from: 0, to: 5 } }), { ariaLabel: 'x' });
    const rowOf = (string: number) => Number(svg.querySelector(`.fb-dot[data-string="${string}"]`)?.getAttribute('data-row'));
    // the barre fret is the first row: its bar lies above the dots of the next rows
    const bar = Number(svg.querySelector('.fb-barre')!.getAttribute('y'));
    expect(bar).toBeLessThan(Number(svg.querySelector('.fb-dot[data-string="3"]')!.getAttribute('cy')));
    expect(rowOf(3)).toBe(1);
    expect(rowOf(1)).toBe(2);
  });

  it('draws a barre as one bar across its strings, and no dot is left under it', () => {
    const svg = buildFretboardPicture(shape([1, 3, 3, 2, 1, 1], { kind: 'barre', barre: { fret: 1, from: 0, to: 5 } }), { ariaLabel: 'x' });
    expect(svg.querySelectorAll('.fb-barre')).toHaveLength(1);
    const dots = [...svg.querySelectorAll('.fb-dot')].map((d) => d.getAttribute('data-string'));
    expect(dots).toEqual(['1', '2', '3']);
  });

  it('marks the root, by the note on the string', () => {
    // C major in the open position: the roots are the C on the A string (fret 3) and the C on the B string (fret 1)
    const svg = buildFretboardPicture(shape([-1, 3, 2, 0, 1, 0]), { ariaLabel: 'x', rootPc: 0 });
    const roots = [...svg.querySelectorAll('.fb-dot.fb-root')].map((d) => d.getAttribute('data-string'));
    expect(roots).toEqual(['1', '4']);
  });

  it('stays left to right in Persian', () => {
    const svg = buildFretboardPicture(shape([0, 2, 2, 1, 0, 0]), { ariaLabel: 'x' });
    expect(svg.getAttribute('direction') ?? svg.style.direction).toBe('ltr');
  });
});
