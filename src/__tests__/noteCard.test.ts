import { describe, it, expect, vi } from 'vitest';
import { buildSingleNoteXml, createNoteCardRenderer } from '../learn/noteCard';

function parse(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

describe('buildSingleNoteXml', () => {
  it('writes one whole note in treble clef', () => {
    const doc = parse(buildSingleNoteXml('C4', 'treble'));
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelector('pitch step')!.textContent).toBe('C');
    expect(doc.querySelector('pitch octave')!.textContent).toBe('4');
    expect(doc.querySelector('clef sign')!.textContent).toBe('G');
    expect(doc.querySelector('clef line')!.textContent).toBe('2');
    expect(doc.querySelector('alter')).toBeNull();
  });

  it('writes bass clef and accidentals', () => {
    const sharp = parse(buildSingleNoteXml('F#3', 'bass'));
    expect(sharp.querySelector('clef sign')!.textContent).toBe('F');
    expect(sharp.querySelector('clef line')!.textContent).toBe('4');
    expect(sharp.querySelector('alter')!.textContent).toBe('1');
    expect(parse(buildSingleNoteXml('Bb2', 'bass')).querySelector('alter')!.textContent).toBe('-1');
  });

  it('rejects an invalid pitch', () => {
    expect(() => buildSingleNoteXml('H4', 'treble')).toThrow();
  });
});

describe('createNoteCardRenderer', () => {
  it('loads the note into the toolkit and puts the SVG in the container', () => {
    const toolkit = {
      setOptions: vi.fn(),
      loadData: vi.fn(),
      renderToSVG: vi.fn(() => '<svg xmlns="http://www.w3.org/2000/svg"><g class="x"/></svg>'),
    };
    const render = createNoteCardRenderer(toolkit);
    const holder = document.createElement('div');
    render('E4', 'treble', holder);
    expect(toolkit.setOptions).toHaveBeenCalled();
    expect(toolkit.loadData).toHaveBeenCalledWith(expect.stringContaining('<step>E</step>'));
    expect(holder.querySelector('svg g.x')).not.toBeNull();
  });
});
