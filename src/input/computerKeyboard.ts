import { midiToNoteName } from '../core/noteUtils';
import type { NoteInputHub } from './noteInput';

/** Semitones above C of the base octave, by physical key: white keys on the home row, black keys above. */
export const KEY_SEMITONES: Readonly<Record<string, number>> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7,
  KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15,
  Semicolon: 16, Quote: 17,
};

export const DEFAULT_OCTAVE = 4;
export const MIN_OCTAVE = 1;
export const MAX_OCTAVE = 6;

export function codeToNoteName(code: string, baseOctave: number): string | null {
  const semitone = KEY_SEMITONES[code];
  if (semitone === undefined) return null;
  return midiToNoteName((baseOctave + 1) * 12 + semitone);
}

const HINT_LABELS: Record<string, string> = { Semicolon: ';', Quote: "'" };

/** Note name to the printed key that plays it, for labelling the on-screen piano. */
export function keyHints(baseOctave: number): Record<string, string> {
  const hints: Record<string, string> = {};
  for (const code of Object.keys(KEY_SEMITONES)) {
    const name = codeToNoteName(code, baseOctave);
    if (name) hints[name] = HINT_LABELS[code] ?? code.replace('Key', '');
  }
  return hints;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target.isContentEditable;
}

/**
 * Plays notes from the computer keyboard. Uses the physical key (KeyboardEvent.code), so it works
 * with any layout, including a Persian one. Z and X move the octave down and up.
 */
export class ComputerKeyboard {
  private octave = DEFAULT_OCTAVE;
  private readonly held = new Map<string, string>();
  private readonly hub: NoteInputHub;
  private readonly target: Document | HTMLElement;
  private readonly onOctaveChange: (octave: number) => void;

  constructor(
    hub: NoteInputHub,
    target: Document | HTMLElement = document,
    onOctaveChange: (octave: number) => void = () => {}
  ) {
    this.hub = hub;
    this.target = target;
    this.onOctaveChange = onOctaveChange;
  }

  private readonly handleKeyDown = (event: Event): void => {
    const e = event as KeyboardEvent;
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || isTypingTarget(e.target)) return;
    if (e.code === 'KeyZ') {
      this.setOctave(this.octave - 1);
      return;
    }
    if (e.code === 'KeyX') {
      this.setOctave(this.octave + 1);
      return;
    }
    const noteName = codeToNoteName(e.code, this.octave);
    if (!noteName || this.held.has(e.code)) return;
    e.preventDefault();
    this.held.set(e.code, noteName);
    this.hub.noteOn(noteName, 'computer');
  };

  private readonly handleKeyUp = (event: Event): void => {
    const e = event as KeyboardEvent;
    const noteName = this.held.get(e.code);
    if (!noteName) return;
    this.held.delete(e.code);
    this.hub.noteOff(noteName, 'computer');
  };

  private readonly handleBlur = (): void => this.releaseAll();

  attach(): void {
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  detach(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.releaseAll();
  }

  getOctave(): number {
    return this.octave;
  }

  setOctave(octave: number): void {
    const clamped = Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, octave));
    if (clamped === this.octave) return;
    this.octave = clamped;
    this.onOctaveChange(clamped);
  }

  private releaseAll(): void {
    for (const noteName of this.held.values()) this.hub.noteOff(noteName, 'computer');
    this.held.clear();
  }
}
