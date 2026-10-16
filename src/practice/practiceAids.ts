import { storageGet, storageSet } from '../core/safeStorage';
import { formatNumber, t, type MessageKey } from '../i18n';
import { SPEED_STEPS, slowedBpm, speedPercent, type PracticeOptionsStore } from './practiceOptions';
import type { HandChoice } from './timingEvents';

export interface PracticeAidsDeps {
  options: PracticeOptionsStore;
  /** The tempo the student set; the quick speeds are shares of it. */
  baseBpm(): number;
  /** The tempo now. */
  currentBpm(): number;
  /** Plays the song at this tempo. */
  setBpm(bpm: number): void;
}

const HANDS: ReadonlyArray<{ value: HandChoice; label: MessageKey }> = [
  { value: 'both', label: 'aids.hand.both' },
  { value: 'right', label: 'aids.hand.right' },
  { value: 'left', label: 'aids.hand.left' },
];

const OPEN_KEY = 'ui.aidsOpen';
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Three sliders: on a narrow screen the button is only this picture and the number of aids that are on. */
function slidersIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('class', 'pa-icon');
  svg.setAttribute('aria-hidden', 'true');
  for (const [y, x] of [[5, 7], [10, 13], [15, 6]]) {
    const line = document.createElementNS(SVG_NS, 'path');
    line.setAttribute('d', `M2 ${y}h16`);
    line.setAttribute('stroke', 'currentColor');
    line.setAttribute('stroke-width', '1.6');
    line.setAttribute('stroke-linecap', 'round');
    const knob = document.createElementNS(SVG_NS, 'circle');
    knob.setAttribute('cx', String(x));
    knob.setAttribute('cy', String(y));
    knob.setAttribute('r', '2.2');
    knob.setAttribute('fill', 'var(--bg-warm)');
    knob.setAttribute('stroke', 'currentColor');
    knob.setAttribute('stroke-width', '1.6');
    svg.append(line, knob);
  }
  return svg;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/** The practice aids under the step panel: wait for me, repeat this step, speed up, quick speeds and the hands. */
export class PracticeAids {
  /** The rows of aids; empty and hidden while they are folded away. */
  readonly element: HTMLElement;
  /** The small button that opens and folds them. It lives apart, so the screen can put it where it takes no room. */
  readonly opener: HTMLButtonElement;
  private readonly deps: PracticeAidsDeps;
  private hands = { right: true, left: true };
  /** The aids are folded away until asked for, so the score keeps its room. */
  private open = storageGet(OPEN_KEY) === '1';

  constructor(deps: PracticeAidsDeps) {
    this.deps = deps;
    this.element = make('div', 'practice-aids');
    this.element.setAttribute('role', 'group');
    this.opener = make('button', 'pa-open');
    this.opener.type = 'button';
    this.opener.addEventListener('click', () => {
      this.open = !this.open;
      storageSet(OPEN_KEY, this.open ? '1' : '0');
      this.refresh();
    });
    deps.options.onChange(() => this.refresh());
    this.refresh();
  }

  /** Which hands have notes in the piece being practised; a hand that only rests cannot be chosen. */
  setHandsAvailable(right: boolean, left: boolean): void {
    this.hands = { right, left };
    this.refresh();
  }

  refresh(): void {
    const { options } = this.deps;
    const current = options.get();
    this.element.setAttribute('aria-label', t('aids.group'));
    this.element.replaceChildren();

    // one small button; the number says how many aids are on, so they are not forgotten when it is folded
    const base = this.deps.baseBpm();
    const speed = speedPercent(this.deps.currentBpm(), base);
    const active =
      Number(current.wait) + Number(current.loop) + Number(current.ladder) + Number(speed !== 100) + Number(current.hand !== 'both');
    this.opener.setAttribute('aria-expanded', String(this.open));
    const text = make('span', 'pa-open-text');
    text.textContent = t('aids.group');
    this.opener.replaceChildren(slidersIcon(), text);
    this.opener.setAttribute('aria-label', active > 0 ? t('aids.openCount', { n: formatNumber(active) }) : t('aids.group'));
    if (active > 0) {
      const badge = make('span', 'pa-count');
      badge.textContent = formatNumber(active);
      this.opener.appendChild(badge);
    }
    this.element.hidden = !this.open;
    if (!this.open) return;

    const toggles = make('div', 'pa-row');
    toggles.append(
      this.toggle('wait', 'aids.wait', 'aids.waitHint', current.wait, () => options.set({ wait: !options.get().wait })),
      this.toggle('loop', 'aids.loop', 'aids.loopHint', current.loop, () => options.set({ loop: !options.get().loop })),
      this.toggle('ladder', 'aids.ladder', 'aids.ladderHint', current.ladder, () => options.set({ ladder: !options.get().ladder })),
    );

    const speedRow = make('div', 'pa-row');
    speedRow.setAttribute('role', 'group');
    speedRow.setAttribute('aria-label', t('aids.speed'));
    speedRow.appendChild(this.label('aids.speed'));
    for (const percent of SPEED_STEPS) {
      const chip = this.chip(t('aids.percent', { n: formatNumber(percent) }), speed === percent, () => this.deps.setBpm(slowedBpm(this.deps.baseBpm(), percent)));
      chip.dataset.speed = String(percent);
      chip.setAttribute('aria-label', t('aids.speedAria', { n: formatNumber(percent), bpm: formatNumber(slowedBpm(base, percent)) }));
      speedRow.appendChild(chip);
    }

    const hands = make('div', 'pa-row');
    hands.setAttribute('role', 'group');
    hands.setAttribute('aria-label', t('aids.hands'));
    hands.appendChild(this.label('aids.hands'));
    for (const hand of HANDS) {
      const chip = this.chip(t(hand.label), current.hand === hand.value, () => options.set({ hand: hand.value }));
      chip.dataset.pick = hand.value;
      chip.disabled = (hand.value === 'right' && !this.hands.right) || (hand.value === 'left' && !this.hands.left);
      hands.appendChild(chip);
    }

    this.element.append(toggles, speedRow, hands);
  }

  private label(key: MessageKey): HTMLElement {
    const label = make('span', 'pa-label');
    label.textContent = t(key);
    return label;
  }

  private chip(text: string, pressed: boolean, onClick: () => void): HTMLButtonElement {
    const chip = make('button', 'pa-chip');
    chip.type = 'button';
    chip.textContent = text;
    chip.setAttribute('aria-pressed', String(pressed));
    chip.addEventListener('click', onClick);
    return chip;
  }

  private toggle(id: string, label: MessageKey, hint: MessageKey, pressed: boolean, onClick: () => void): HTMLButtonElement {
    const chip = this.chip(t(label), pressed, onClick);
    chip.classList.add('pa-toggle');
    chip.dataset.aid = id;
    chip.title = t(hint);
    return chip;
  }
}
