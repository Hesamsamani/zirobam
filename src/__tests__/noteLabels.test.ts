import { describe, it, expect, beforeEach } from 'vitest';
import { addNoteLabels, removeNoteLabels, readGlyphPosition } from '../rendering/noteLabels';

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg">' +
  '<g class="note" id="n1"><g class="notehead"><use x="1000" y="2000"/></g></g>' +
  '<g class="note" id="n2"><g class="notehead"><use transform="translate(1500, 2500) scale(0.72, 0.72)"/></g></g>' +
  '<g class="note" id="n3"><g class="notehead"></g></g>' +
  '</svg>';

const names: Record<string, string> = { n1: 'Do', n2: 'Re♯', n3: 'Mi' };
const resolve = (el: Element) => names[el.id] ?? null;

let root: HTMLElement;

beforeEach(() => {
  root = document.createElement('div');
  const parsed = new DOMParser().parseFromString(SVG, 'image/svg+xml');
  root.replaceChildren(document.importNode(parsed.documentElement, true));
});

describe('readGlyphPosition', () => {
  it('reads x and y attributes', () => {
    const use = root.querySelector('#n1 use')!;
    expect(readGlyphPosition(use)).toEqual({ x: 1000, y: 2000 });
  });

  it('reads a translate() transform', () => {
    const use = root.querySelector('#n2 use')!;
    expect(readGlyphPosition(use)).toEqual({ x: 1500, y: 2500 });
  });

  it('returns null when there is no position', () => {
    expect(readGlyphPosition(document.createElementNS('http://www.w3.org/2000/svg', 'use'))).toBeNull();
  });
});

describe('addNoteLabels', () => {
  it('adds one label per note that has a name and a notehead', () => {
    const added = addNoteLabels(root, resolve);
    expect(added).toBe(2);
    const labels = root.querySelectorAll('text.note-label');
    expect(labels).toHaveLength(2);
    expect(labels[0].textContent).toBe('Do');
    expect(labels[0].getAttribute('x')).toBe('1135');
    expect(labels[0].getAttribute('y')).toBe('2420');
    expect(labels[1].textContent).toBe('Re♯');
  });

  it('does not duplicate labels when called again', () => {
    addNoteLabels(root, resolve);
    addNoteLabels(root, resolve);
    expect(root.querySelectorAll('text.note-label')).toHaveLength(2);
  });

  it('skips notes the resolver cannot name', () => {
    expect(addNoteLabels(root, () => null)).toBe(0);
  });

  it('removeNoteLabels clears them', () => {
    addNoteLabels(root, resolve);
    removeNoteLabels(root);
    expect(root.querySelectorAll('text.note-label')).toHaveLength(0);
  });
});
