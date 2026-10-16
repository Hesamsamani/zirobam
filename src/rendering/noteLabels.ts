const SVG_NS = 'http://www.w3.org/2000/svg';
const LABEL_CLASS = 'note-label';

export interface GlyphPosition {
  x: number;
  y: number;
}

/** Verovio writes a glyph position either as x/y attributes or as transform="translate(x, y)". */
export function readGlyphPosition(use: Element): GlyphPosition | null {
  const x = parseFloat(use.getAttribute('x') ?? '');
  const y = parseFloat(use.getAttribute('y') ?? '');
  if (!Number.isNaN(x) && !Number.isNaN(y)) return { x, y };
  const match = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/.exec(use.getAttribute('transform') ?? '');
  return match ? { x: parseFloat(match[1]), y: parseFloat(match[2]) } : null;
}

export function removeNoteLabels(root: ParentNode): void {
  root.querySelectorAll(`.${LABEL_CLASS}`).forEach((el) => el.remove());
}

export interface NoteLabelOptions {
  fontSize?: number;
  offsetX?: number;
  offsetY?: number;
}

/**
 * Writes a name under every notehead. Coordinates are in Verovio's SVG units
 * (a staff space is about 180 units), so the defaults sit just below the note.
 */
export function addNoteLabels(
  root: ParentNode,
  resolveName: (noteEl: Element) => string | null,
  options: NoteLabelOptions = {}
): number {
  const { fontSize = 280, offsetX = 135, offsetY = 420 } = options;
  removeNoteLabels(root);
  let added = 0;
  root.querySelectorAll('g.note').forEach((noteEl) => {
    const name = resolveName(noteEl);
    const glyph = noteEl.querySelector('.notehead use');
    if (!name || !glyph) return;
    const position = readGlyphPosition(glyph);
    if (!position) return;
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('class', LABEL_CLASS);
    text.setAttribute('x', String(position.x + offsetX));
    text.setAttribute('y', String(position.y + offsetY));
    text.setAttribute('font-size', String(fontSize));
    text.setAttribute('text-anchor', 'middle');
    text.textContent = name;
    noteEl.appendChild(text);
    added++;
  });
  return added;
}
