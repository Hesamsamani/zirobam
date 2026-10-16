const SVG_NS = 'http://www.w3.org/2000/svg';

export interface FingersPictureOptions {
  ariaLabel: string;
  left: string;
  right: string;
  formatNumber(n: number): string;
}

/** Finger length and how far down it starts, thumb to little finger. The thumb sits lower and shorter. */
const FINGERS: ReadonlyArray<{ number: number; height: number; top: number }> = [
  { number: 1, height: 58, top: 82 },
  { number: 2, height: 82, top: 38 },
  { number: 3, height: 92, top: 28 },
  { number: 4, height: 82, top: 38 },
  { number: 5, height: 64, top: 56 },
];

const FINGER_WIDTH = 24;
const GAP = 7;
const PALM_TOP = 112;
const PALM_HEIGHT = 56;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  return node;
}

/** Thumb numbers in the middle: the left hand reads 5 4 3 2 1 and the right hand 1 2 3 4 5. */
function buildHand(side: 'left' | 'right', x: number, label: string, formatNumber: (n: number) => string): SVGGElement {
  const hand = el('g', { class: 'fp-hand', 'data-hand': side });
  const order = side === 'left' ? [...FINGERS].reverse() : FINGERS;
  const width = order.length * FINGER_WIDTH + (order.length - 1) * GAP;

  hand.appendChild(el('rect', { class: 'fp-palm', x: x - 6, y: PALM_TOP, width: width + 12, height: PALM_HEIGHT, rx: 18 }));
  order.forEach((finger, index) => {
    const fx = x + index * (FINGER_WIDTH + GAP);
    const group = el('g', { class: 'fp-finger', 'data-finger': finger.number });
    // every finger ends below the top of the palm, so finger and palm read as one shape
    group.appendChild(el('rect', { x: fx, y: finger.top, width: FINGER_WIDTH, height: finger.height, rx: FINGER_WIDTH / 2 }));
    const badge = el('text', { class: 'fp-badge', x: fx + FINGER_WIDTH / 2, y: finger.top + 20, 'text-anchor': 'middle' });
    badge.textContent = formatNumber(finger.number);
    group.appendChild(badge);
    hand.appendChild(group);
  });

  const caption = el('text', { class: 'fp-label', x: x + width / 2, y: PALM_TOP + PALM_HEIGHT + 22, 'text-anchor': 'middle' });
  caption.textContent = label;
  hand.appendChild(caption);
  return hand;
}

/** Both hands from above with the finger numbers, for the lesson on fingering. */
export function buildFingersPicture(options: FingersPictureOptions): SVGSVGElement {
  const svg = el('svg', {
    class: 'fingers-picture',
    viewBox: '0 0 400 210',
    role: 'img',
    'aria-label': options.ariaLabel,
    direction: 'ltr',
  });
  svg.style.direction = 'ltr';
  svg.appendChild(buildHand('left', 22, options.left, options.formatNumber));
  svg.appendChild(buildHand('right', 214, options.right, options.formatNumber));
  return svg;
}
