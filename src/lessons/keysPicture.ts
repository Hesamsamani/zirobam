import { buildKeyLayout, type PianoKey } from '../input/onScreenPiano';

export interface KeysPictureOptions {
  from: string;
  to: string;
  names: 'none' | 'white' | 'all';
  /** A short label per key (a finger number, a computer key). An empty text only highlights the key. */
  marks?: Record<string, string>;
  /** A note with its octave ("C#4") to the name shown on the key ("C♯"). */
  formatName(note: string): string;
  /** Fills in note tokens and digits of a mark. */
  formatMark(text: string): string;
  onPlay?(note: string): void;
  ariaLabel: string;
}

const SEMITONE: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const FLAT_NAME: Readonly<Record<string, string>> = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };

function midiOf(note: string): number {
  const match = /^([A-G])(#?)(\d)$/.exec(note);
  if (!match) throw new Error(`Cannot read the note "${note}"`);
  return (Number(match[3]) + 1) * 12 + SEMITONE[match[1]] + (match[2] ? 1 : 0);
}

function nameSpan(text: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'lk-name';
  span.textContent = text;
  return span;
}

function flatOf(note: string): string {
  const match = /^([A-G]#)(\d)$/.exec(note);
  return match ? `${FLAT_NAME[match[1]]}${match[2]}` : note;
}

/**
 * A small keyboard for a lesson: the keys between two notes, with names or marks on them.
 * The keys can be pressed with the pointer, or with Enter and Space after moving to them with the arrow keys.
 */
export function buildKeysPicture(options: KeysPictureOptions): HTMLElement {
  const layout = buildKeyLayout(midiOf(options.from), midiOf(options.to));
  const whiteCount = layout.filter((key) => !key.isBlack).length;

  const root = document.createElement('div');
  root.className = 'lk';
  root.setAttribute('dir', 'ltr');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', options.ariaLabel);
  root.style.setProperty('--white-keys', String(whiteCount));

  const buttons: HTMLButtonElement[] = [];
  const play = (note: string, button: HTMLButtonElement) => {
    options.onPlay?.(note);
    button.classList.add('pressed');
    setTimeout(() => button.classList.remove('pressed'), 220);
  };

  const build = (key: PianoKey): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `lk-key ${key.isBlack ? 'black' : 'white'}`;
    button.dataset.note = key.noteName;
    button.tabIndex = buttons.length === 0 ? 0 : -1;
    button.setAttribute('aria-label', options.formatName(key.noteName));

    if (key.isBlack) {
      const width = (0.6 / whiteCount) * 100;
      button.style.width = `${width}%`;
      button.style.left = `${Math.max(0, ((key.whiteIndex + 1) / whiteCount) * 100 - width / 2)}%`;
    }

    const marks = options.marks ?? {};
    const marked = Object.prototype.hasOwnProperty.call(marks, key.noteName);
    if (marked) button.classList.add('marked');

    if (options.names === 'all' && key.isBlack) {
      button.append(nameSpan(options.formatName(key.noteName)), nameSpan(options.formatName(flatOf(key.noteName))));
    } else if (options.names !== 'none' && !key.isBlack) {
      button.append(nameSpan(options.formatName(key.noteName)));
    }
    if (marked && marks[key.noteName] !== '') {
      const mark = document.createElement('span');
      mark.className = 'lk-mark';
      mark.textContent = options.formatMark(marks[key.noteName]);
      button.append(mark);
    }

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      play(key.noteName, button);
    });
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        play(key.noteName, button);
        return;
      }
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      const target = buttons[buttons.indexOf(button) + step];
      if (!target) return;
      for (const other of buttons) other.tabIndex = other === target ? 0 : -1;
      target.focus();
    });
    buttons.push(button);
    return button;
  };

  for (const key of layout) root.appendChild(build(key));
  return root;
}
