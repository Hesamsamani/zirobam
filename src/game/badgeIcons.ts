import type { BadgeIcon } from './achievements';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Line icons for the badges and the home screen, 24 by 24. */
export const ICON_PATHS: Readonly<Record<BadgeIcon | 'flame', string>> = {
  note: 'M9 17.5V6l10-2v11.5M9 17.5a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0zM19 15.5a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0z',
  flame: 'M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 .5 2 1.5 2.5 2 2.5C11 8 10 6 12 3z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  book: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H12v15H5.5A1.5 1.5 0 0 0 4 20.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H12v15h6.5a1.5 1.5 0 0 1 1.5 1.5z',
  bars: 'M3.2 4h3.2v16H3.2zM8.6 4h3.2v13H8.6zM14 4h3.2v10H14zM19.4 4h1.8v7h-1.8z',
  target: 'M12 3a9 9 0 1 0 .01 0M12 8a4 4 0 1 0 .01 0M12 12h.01',
  crown: 'M4 18h16M5 18L3 7l5 4 4-6 4 6 5-4-2 11z',
  clef: 'M3 6h18M3 9.5h18M3 13h18M3 16.5h18M3 20h18M12.2 16.2a2.2 1.6 -20 1 0 .01 0M14.3 15.6V5',
};

export function svgIcon(name: BadgeIcon | 'flame', className = ''): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (className) svg.setAttribute('class', className);
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICON_PATHS[name]);
  svg.appendChild(path);
  return svg;
}
