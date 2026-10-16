import { midiToNoteName } from '../core/noteUtils';
import type { NoteInputHub } from './noteInput';

export interface PianoKey {
  midi: number;
  noteName: string;
  isBlack: boolean;
  /** White keys: their own index among white keys. Black keys: the white key on their left. */
  whiteIndex: number;
}

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

export function buildKeyLayout(startMidi: number, endMidi: number): PianoKey[] {
  const keys: PianoKey[] = [];
  let whiteCount = 0;
  for (let midi = startMidi; midi <= endMidi; midi++) {
    const isBlack = BLACK_PITCH_CLASSES.has(midi % 12);
    keys.push({
      midi,
      noteName: midiToNoteName(midi),
      isBlack,
      whiteIndex: isBlack ? whiteCount - 1 : whiteCount,
    });
    if (!isBlack) whiteCount++;
  }
  return keys;
}

export interface OnScreenPianoOptions {
  startMidi?: number;
  endMidi?: number;
  ariaLabel?: string;
}

export class OnScreenPiano {
  readonly element: HTMLElement;
  private readonly hub: NoteInputHub;
  private readonly keyEls = new Map<string, HTMLElement>();
  private readonly labelEls = new Map<string, HTMLElement>();
  private readonly pointerNotes = new Map<number, string>();
  private readonly unsubscribe: Array<() => void>;

  constructor(hub: NoteInputHub, options: OnScreenPianoOptions = {}) {
    this.hub = hub;
    const layout = buildKeyLayout(options.startMidi ?? 48, options.endMidi ?? 84);
    const whiteCount = layout.filter((k) => !k.isBlack).length;

    this.element = document.createElement('div');
    this.element.className = 'piano';
    this.element.setAttribute('dir', 'ltr');
    this.element.setAttribute('role', 'group');
    this.element.style.setProperty('--white-keys', String(whiteCount));
    if (options.ariaLabel) this.element.setAttribute('aria-label', options.ariaLabel);

    for (const key of layout) this.element.appendChild(this.buildKey(key, whiteCount));

    this.unsubscribe = [
      hub.onNoteOn.on(({ noteName }) => this.setPressed(noteName, true)),
      hub.onNoteOff.on(({ noteName }) => this.setPressed(noteName, false)),
    ];
  }

  private buildKey(key: PianoKey, whiteCount: number): HTMLElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.tabIndex = -1;
    el.className = `piano-key ${key.isBlack ? 'black' : 'white'}`;
    el.dataset.note = key.noteName;
    el.setAttribute('aria-label', key.noteName); // every key needs a name, the black ones have no visible label

    if (key.isBlack) {
      const width = (0.6 / whiteCount) * 100;
      el.style.width = `${width}%`;
      el.style.left = `${((key.whiteIndex + 1) / whiteCount) * 100 - width / 2}%`;
    } else {
      const label = document.createElement('span');
      label.className = 'piano-key-label';
      label.textContent = key.noteName.replace(/-?\d+$/, '');
      el.appendChild(label);
      this.labelEls.set(key.noteName, label);
      if (key.noteName.startsWith('C') && !key.noteName.startsWith('C#')) {
        const octave = document.createElement('span');
        octave.className = 'piano-key-octave';
        octave.textContent = key.noteName.replace(/^[A-G]#?/, '');
        el.appendChild(octave);
      }
    }

    el.addEventListener('pointerdown', (e) => this.handleDown(e as PointerEvent, key.noteName));
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
      el.addEventListener(type, (e) => this.handleUp(e as PointerEvent, key.noteName));
    }
    this.keyEls.set(key.noteName, el);
    return el;
  }

  private handleDown(event: PointerEvent, noteName: string): void {
    event.preventDefault();
    const id = event.pointerId ?? 0;
    this.pointerNotes.set(id, noteName);
    this.hub.noteOn(noteName, 'screen');
  }

  private handleUp(event: PointerEvent, noteName: string): void {
    const id = event.pointerId ?? 0;
    if (this.pointerNotes.get(id) !== noteName) return;
    this.pointerNotes.delete(id);
    this.hub.noteOff(noteName, 'screen');
  }

  private setPressed(noteName: string, pressed: boolean): void {
    this.keyEls.get(noteName)?.classList.toggle('pressed', pressed);
  }

  setLabelFormatter(fn: (noteName: string) => string): void {
    for (const [noteName, label] of this.labelEls) label.textContent = fn(noteName);
    for (const [noteName, el] of this.keyEls) {
      const octave = /-?\d+$/.exec(noteName)?.[0] ?? '';
      el.setAttribute('aria-label', `${fn(noteName)} ${octave}`.trim());
    }
  }

  setAriaLabel(text: string): void {
    this.element.setAttribute('aria-label', text);
  }

  setHints(hints: Record<string, string>): void {
    for (const [noteName, el] of this.keyEls) {
      if (hints[noteName]) el.dataset.hint = hints[noteName];
      else delete el.dataset.hint;
    }
  }

  dispose(): void {
    for (const off of this.unsubscribe) off();
  }
}
