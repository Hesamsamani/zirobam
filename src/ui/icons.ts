const SVG_NS = 'http://www.w3.org/2000/svg';

/** Line icons, 24 by 24, each one path, drawn with the colour of the text around them. The tiles of the home screen and the side rail share them. */
export const ICON_PATHS = {
  lessons: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H12v15H5.5A1.5 1.5 0 0 0 4 20.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H12v15h6.5a1.5 1.5 0 0 1 1.5 1.5z',
  learn: 'M12 3a9 9 0 1 0 .01 0M12 7.5a4.5 4.5 0 1 0 .01 0M12 12h.01',
  ear: 'M6 15.5V10a6 6 0 1 1 12 0c0 2.6-1.4 3.6-2.4 4.6-.9.9-1.1 1.6-1.1 2.9a2.5 2.5 0 0 1-4.9.6M12 10a2 2 0 0 1 4 0',
  scales: 'M3 19h3v-3h3v-3h3v-3h3V7h3V4M3 19h18',
  levels: 'M3 6h18M3 9.5h18M3 13h18M3 16.5h18M3 20h18M12.2 16.2a2.2 1.6 -20 1 0 .01 0M14.3 15.6V5',
  songs: 'M9 17.5V6l10-2v11.5M9 17.5a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0zM19 15.5a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0z',
  chords: 'M8 6a2 2 0 1 0 .01 0M8 12a2 2 0 1 0 .01 0M8 18a2 2 0 1 0 .01 0M10 6V3h9M10 12V9h9M10 18v-3h9',
  persian: 'M4 18c2-6 4-9 8-9s6 3 8 9M12 9V4M9 6.5l3-2.5 3 2.5',
  rhythm: 'M12 3l1.5 3.5M9 21h6l-2-15h-2zM12 14l5-6',
  tuner: 'M4 17a8 8 0 1 1 16 0M12 17l4-5M4 17h16',
  generator: 'M5 5h14v14H5zM9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01',
  catalog: 'M4 6h10M4 11h10M4 16h6M18.2 17.2a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM18.2 17.2V8l3 1',
  xylophone: 'M3.2 4h3.2v16H3.2zM8.6 4h3.2v13H8.6zM14 4h3.2v10H14zM19.4 4h1.8v7h-1.8z',
  metronome: 'M8 22h8l-2-16h-4zM12 6l4-3M12 14.5h.01',
  progress: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  settings: 'M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1M15 7a2 2 0 1 0 .01 0M9 12a2 2 0 1 0 .01 0M17 17a2 2 0 1 0 .01 0',
  // the side rail
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  today: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4',
  sun: 'M12 8a4 4 0 1 0 .01 0M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  language: 'M12 3a9 9 0 1 0 .01 0M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  chevron: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
} as const;

export type IconId = keyof typeof ICON_PATHS;

export function makeIcon(id: IconId): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICON_PATHS[id]);
  svg.appendChild(path);
  return svg;
}
