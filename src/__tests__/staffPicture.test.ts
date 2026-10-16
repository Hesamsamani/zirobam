import { describe, it, expect, vi } from 'vitest';
import { renderStaffPicture } from '../lessons/staffPicture';
import type { NotationToolkit } from '../learn/noteCard';

function svgWithNotes(count: number): string {
  const notes = Array.from({ length: count }, (_, i) =>
    `<g class="note" id="n${i}"><g class="notehead"><use x="${100 + i * 500}" y="300"/></g></g>`
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640px" height="210px" viewBox="0 0 6400 2100"><g class="page-margin">${notes}</g></svg>`;
}

function fakeToolkit(noteCount: number) {
  return {
    setOptions: vi.fn(),
    loadData: vi.fn(),
    renderToSVG: vi.fn(() => svgWithNotes(noteCount)),
  } satisfies NotationToolkit;
}

describe('renderStaffPicture', () => {
  it('draws the example into the element', () => {
    const toolkit = fakeToolkit(3);
    const holder = document.createElement('div');
    renderStaffPicture(holder, { toolkit, spec: { clef: 'treble', notes: 'C4q D4q E4h' }, names: false, formatName: (n) => n });
    expect(holder.querySelector('svg')).not.toBeNull();
    expect(toolkit.loadData).toHaveBeenCalledOnce();
    expect(String(toolkit.loadData.mock.calls[0][0])).toContain('<step>E</step>');
    expect(holder.querySelectorAll('.note-label')).toHaveLength(0);
  });

  it('replaces what was there before', () => {
    const toolkit = fakeToolkit(1);
    const holder = document.createElement('div');
    holder.textContent = 'old';
    renderStaffPicture(holder, { toolkit, spec: { clef: 'treble', notes: 'C4w' }, names: false, formatName: (n) => n });
    expect(holder.textContent).toBe('');
    expect(holder.children).toHaveLength(1);
  });

  it('writes the note names under the notes, without the octave', () => {
    const toolkit = fakeToolkit(3);
    const holder = document.createElement('div');
    renderStaffPicture(holder, {
      toolkit,
      spec: { clef: 'treble', notes: 'C4q rq E4q G4q' },
      names: true,
      formatName: (note, withOctave) => (withOctave ? `${note}!` : note.replace(/\d+$/, '')),
    });
    expect(Array.from(holder.querySelectorAll('.note-label')).map((l) => l.textContent)).toEqual(['C', 'E', 'G']);
  });

  it('can write the octave number too', () => {
    const toolkit = fakeToolkit(2);
    const holder = document.createElement('div');
    renderStaffPicture(holder, {
      toolkit,
      spec: { clef: 'treble', notes: 'C4h C5h' },
      names: 'octave',
      formatName: (note, withOctave) => (withOctave ? note : note.replace(/\d+$/, '')),
    });
    expect(Array.from(holder.querySelectorAll('.note-label')).map((l) => l.textContent)).toEqual(['C4', 'C5']);
  });

  it('lets the picture shrink with its container but not grow past its natural size', () => {
    const toolkit = fakeToolkit(1);
    const holder = document.createElement('div');
    renderStaffPicture(holder, { toolkit, spec: { clef: 'treble', notes: 'C4w' }, names: false, formatName: (n) => n });
    const svg = holder.querySelector('svg')!;
    expect(svg.style.maxWidth).toMatch(/^\d+px$/);
    expect(svg.style.width).toBe('100%');
    expect(svg.hasAttribute('height')).toBe(false);
    expect(svg.getAttribute('viewBox')).toBe('0 0 640 210');
  });

  it('marks the picture as an image with a description', () => {
    const toolkit = fakeToolkit(1);
    const holder = document.createElement('div');
    renderStaffPicture(holder, { toolkit, spec: { clef: 'treble', notes: 'C4w' }, names: false, formatName: (n) => n, description: 'A whole note' });
    const svg = holder.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('A whole note');
  });

  it('shows nothing and does not throw when the notation cannot be built', () => {
    const toolkit = fakeToolkit(1);
    toolkit.loadData.mockImplementation(() => {
      throw new Error('bad');
    });
    const holder = document.createElement('div');
    expect(() =>
      renderStaffPicture(holder, { toolkit, spec: { clef: 'treble', notes: 'C4w' }, names: false, formatName: (n) => n })
    ).not.toThrow();
    expect(holder.querySelector('svg')).toBeNull();
  });
});
