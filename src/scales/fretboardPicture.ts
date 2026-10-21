import { OPEN_STRINGS, type GuitarShape } from '../theory/guitar';

const SVG = 'http://www.w3.org/2000/svg';

// the picture is 5 units wide between the outer strings and 4 rows high; the numbers are in these units times SIZE
const SIZE = 22;
const LEFT = 26; // room for the number of the fret
const TOP = 28; // room for the crosses and rings
const STRINGS = OPEN_STRINGS.length;
const ROWS = 4;
const WIDTH = LEFT + (STRINGS - 1) * SIZE + 14;
const HEIGHT = TOP + ROWS * SIZE + 10;

export interface FretboardOptions {
  /** What a screen reader says about the diagram. */
  ariaLabel: string;
  /** The pitch class of the root (0 to 11): its dots are marked. */
  rootPc?: number;
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, className?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (className) node.setAttribute('class', className);
  return node;
}

const stringX = (string: number): number => LEFT + string * SIZE;
const rowY = (row: number): number => TOP + row * SIZE + SIZE / 2;

/**
 * A chord diagram of a guitar shape, as it is printed in a chord book: the low E string on the left, the nut at the top
 * (or the number of the first fret for a high position), a cross over a muted string, a ring over an open one, a dot for each
 * fretted note and one bar for a barre. Colours come from the style sheet. It stays left to right in every language.
 */
export function buildFretboardPicture(shape: GuitarShape, options: FretboardOptions): SVGSVGElement {
  const svg = el('svg', { viewBox: `0 0 ${WIDTH} ${HEIGHT}`, role: 'img', 'aria-label': options.ariaLabel, direction: 'ltr' }, 'fretboard');
  svg.setAttribute('dir', 'ltr');
  svg.style.direction = 'ltr';

  const left = stringX(0);
  const right = stringX(STRINGS - 1);
  // the frets: one line above each row, and one under the last
  for (let line = 0; line <= ROWS; line++) {
    const y = TOP + line * SIZE;
    if (line === 0 && shape.baseFret === 1) svg.append(el('line', { x1: left, x2: right, y1: y, y2: y, 'stroke-width': 4 }, 'fb-nut'));
    else svg.append(el('line', { x1: left, x2: right, y1: y, y2: y }, 'fb-fret'));
  }
  for (let string = 0; string < STRINGS; string++) svg.append(el('line', { x1: stringX(string), x2: stringX(string), y1: TOP, y2: TOP + ROWS * SIZE }, 'fb-string'));

  if (shape.baseFret > 1) {
    const label = el('text', { x: left - 12, y: rowY(0) + 4, 'text-anchor': 'end' }, 'fb-base');
    label.textContent = String(shape.baseFret);
    svg.append(label);
  }

  const rowOf = (fret: number): number => fret - shape.baseFret;
  const underBarre = (string: number, fret: number): boolean => !!shape.barre && fret === shape.barre.fret && string >= shape.barre.from && string <= shape.barre.to;

  if (shape.barre) {
    const y = rowY(rowOf(shape.barre.fret));
    svg.append(el('rect', { x: stringX(shape.barre.from) - 7, y: y - 7, width: (shape.barre.to - shape.barre.from) * SIZE + 14, height: 14, rx: 7 }, 'fb-barre'));
  }

  shape.frets.forEach((fret, string) => {
    if (fret < 0) {
      const cross = el('path', { d: `M${stringX(string) - 5} ${TOP - 18} l10 10 m0 -10 l-10 10` }, 'fb-muted');
      svg.append(cross);
    } else if (fret === 0) {
      svg.append(el('circle', { cx: stringX(string), cy: TOP - 13, r: 5 }, 'fb-open'));
    } else if (!underBarre(string, fret)) {
      const isRoot = options.rootPc !== undefined && (OPEN_STRINGS[string] + fret) % 12 === options.rootPc;
      const dot = el('circle', { cx: stringX(string), cy: rowY(rowOf(fret)), r: 8, 'data-string': string, 'data-fret': fret, 'data-row': rowOf(fret) }, isRoot ? 'fb-dot fb-root' : 'fb-dot');
      svg.append(dot);
    }
  });

  // a barre dot of the root is marked on the bar itself: keep one invisible marker so that tests and styles can find it
  if (shape.barre && options.rootPc !== undefined) {
    for (let string = shape.barre.from; string <= shape.barre.to; string++) {
      if (shape.frets[string] === shape.barre.fret && (OPEN_STRINGS[string] + shape.barre.fret) % 12 === options.rootPc) {
        svg.append(el('circle', { cx: stringX(string), cy: rowY(rowOf(shape.barre.fret)), r: 3 }, 'fb-barre-root'));
      }
    }
  }
  return svg;
}
