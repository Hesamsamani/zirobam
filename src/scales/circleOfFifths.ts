import { formatNumber, t, type MessageKey } from '../i18n';
import { circleKeys } from '../theory/circle';
import type { ScaleId } from '../theory/scaleCatalog';
import { spellScale } from '../theory/spell';

const SVG = 'http://www.w3.org/2000/svg';

export interface CircleDeps {
  /** A note name without octave, as the student has chosen to read it. */
  formatName(note: string): string;
  /** A key was pressed: the root (0 to 11) and the scale of the key. */
  onChoose(root: number, scale: ScaleId): void;
}

/** Where a place of the circle lies, in percent of the circle's box: `step` 0 is at the top, and the steps go clockwise. */
function place(step: number, radius: number): { left: string; top: string } {
  const angle = (step * 30 - 90) * (Math.PI / 180);
  return { left: `${50 + radius * Math.cos(angle)}%`, top: `${50 + radius * Math.sin(angle)}%` };
}

function ring(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'circle-ring');
  svg.setAttribute('aria-hidden', 'true');
  for (const radius of [47, 33, 17]) {
    const circle = document.createElementNS(SVG, 'circle');
    circle.setAttribute('cx', '50');
    circle.setAttribute('cy', '50');
    circle.setAttribute('r', String(radius));
    svg.append(circle);
  }
  return svg;
}

/**
 * The circle of fifths: the twelve major keys round the outside, their relative minors inside, each with a button that
 * opens its scale. The ring behind is only a drawing; the keys are real buttons, in reading order, so the keyboard works.
 */
export function buildCircle(deps: CircleDeps): HTMLElement {
  const box = document.createElement('div');
  box.className = 'circle';
  box.setAttribute('dir', 'ltr');
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', t('circle.aria'));
  box.append(ring());

  const keys = circleKeys();
  const button = (className: string, step: number, radius: number, scale: ScaleId, root: number, label: string, small?: string): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.dataset.root = String(root);
    b.dataset.scale = scale;
    const { left, top } = place(step, radius);
    b.style.left = left;
    b.style.top = top;
    const name = document.createElement('span');
    name.className = 'circle-name';
    name.textContent = label;
    b.append(name);
    if (small) {
      const sign = document.createElement('span');
      sign.className = 'circle-sign';
      sign.textContent = small;
      b.append(sign);
    }
    const title = t('dict.scale.title', { root: label, scale: t(`scale.name.${scale}` as MessageKey) });
    b.setAttribute('aria-label', title);
    b.addEventListener('click', () => deps.onChoose(root, scale));
    return b;
  };

  keys.forEach((key, step) => {
    const major = deps.formatName(spellScale(key.major, 'major').root);
    const minor = deps.formatName(spellScale(key.minor, 'natural-minor').root);
    const signature = key.fifths === 0 ? '' : `${formatNumber(Math.abs(key.fifths))}${key.fifths > 0 ? '♯' : '♭'}`;
    box.append(button('circle-key circle-major', step, 40, 'major', key.major, major, signature));
    box.append(button('circle-key circle-minor', step, 23, 'natural-minor', key.minor, minor));
  });
  return box;
}
