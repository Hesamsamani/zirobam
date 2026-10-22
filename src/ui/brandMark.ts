const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The mark of ZiroBam: a heavy Z (the top bar is the high line, zir; the bottom bar the low line, bam) with a notehead
 * where the diagonal lands. The colours are in `src/styles/brand.css`, so it follows the accent. It is the same drawing as
 * `public/favicon.svg`, cropped to the letter.
 */
export function makeBrandMark(doc: Document, className = ''): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '8 8 48 48');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', `brand-mark ${className}`.trim());
  const z = doc.createElementNS(SVG_NS, 'polygon');
  z.setAttribute('points', '12,14 52,14 52,23 28,41 52,41 52,50 12,50 12,41 36,23 12,23');
  z.setAttribute('class', 'mark-z');
  const note = doc.createElementNS(SVG_NS, 'ellipse');
  note.setAttribute('cx', '19.5');
  note.setAttribute('cy', '45.5');
  note.setAttribute('rx', '7.4');
  note.setAttribute('ry', '5.4');
  note.setAttribute('transform', 'rotate(-22 19.5 45.5)');
  note.setAttribute('class', 'mark-note');
  svg.append(z, note);
  return svg;
}
