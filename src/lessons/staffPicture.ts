import type { NotationToolkit } from '../learn/noteCard';
import { addNoteLabels } from '../rendering/noteLabels';
import { buildExampleXml, exampleNoteNames, type StaffExample } from './exampleXml';

export interface StaffPictureOptions {
  toolkit: NotationToolkit;
  spec: StaffExample;
  /** Write the name under every note; 'octave' adds the octave number. */
  names: boolean | 'octave';
  /** A note ("C#4") to the text shown under it. */
  formatName(note: string, withOctave: boolean): string;
  /** What a screen reader says about the picture. */
  description?: string;
}

/** How big Verovio draws the staff before the page makes it fit. */
const SCALE = 135;
const PAGE_WIDTH = 2400;

/** Draws a lesson example with Verovio into `into`, replacing what was there. */
export function renderStaffPicture(into: HTMLElement, options: StaffPictureOptions): void {
  const { toolkit, spec } = options;
  try {
    toolkit.setOptions({
      pageWidth: PAGE_WIDTH,
      pageHeight: 900,
      scale: SCALE,
      adjustPageHeight: true,
      adjustPageWidth: true,
      footer: 'none',
      header: 'none',
      breaks: 'none',
      spacingStaff: 12,
      spacingSystem: 12,
    });
    toolkit.loadData(buildExampleXml(spec));
    const doc = new DOMParser().parseFromString(toolkit.renderToSVG(1), 'image/svg+xml');
    const svg = document.importNode(doc.documentElement, true) as unknown as SVGSVGElement;

    if (options.names) {
      const names = exampleNoteNames(spec);
      let index = 0;
      addNoteLabels(svg, () => {
        const note = names[index++];
        return note ? options.formatName(note, options.names === 'octave') : null;
      });
    }

    // The picture shrinks with its container but is never drawn bigger than Verovio made it.
    const natural = parseFloat(svg.getAttribute('width') ?? '');
    const naturalHeight = parseFloat(svg.getAttribute('height') ?? '');
    svg.removeAttribute('height');
    svg.removeAttribute('width');
    if (!Number.isNaN(natural) && !Number.isNaN(naturalHeight)) {
      // without a viewBox the picture could not scale down with its container
      svg.setAttribute('viewBox', `0 0 ${natural} ${naturalHeight}`);
      svg.style.maxWidth = `${Math.min(Math.round(natural), 560)}px`;
    }
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.setAttribute('role', 'img');
    if (options.description) svg.setAttribute('aria-label', options.description);
    into.replaceChildren(svg);
  } catch {
    into.replaceChildren();
  }
}
