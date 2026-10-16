import type { NoteInputHub } from '../input/noteInput';
import type { XyloBar } from './keyRows';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target.isContentEditable;
}

/**
 * Plays the xylophone bars from one row of the keyboard. Keys are matched by position
 * (KeyboardEvent.code), so a Persian layout works too.
 */
export class XylophoneInput {
  private bars: readonly XyloBar[];
  private readonly held = new Map<string, string>();
  private readonly hub: NoteInputHub;
  private readonly target: Document | HTMLElement;

  constructor(hub: NoteInputHub, bars: readonly XyloBar[], target: Document | HTMLElement = document) {
    this.hub = hub;
    this.bars = bars;
    this.target = target;
  }

  /** Use another row (or octave). Bars still held are let go first. */
  setBars(bars: readonly XyloBar[]): void {
    this.releaseAll();
    this.bars = bars;
  }

  private readonly handleKeyDown = (event: Event): void => {
    const e = event as KeyboardEvent;
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || isTypingTarget(e.target)) return;
    const bar = this.bars.find((b) => b.code === e.code);
    if (!bar || this.held.has(e.code)) return;
    e.preventDefault();
    this.held.set(e.code, bar.noteName);
    this.hub.noteOn(bar.noteName, 'xylophone');
  };

  private readonly handleKeyUp = (event: Event): void => {
    const code = (event as KeyboardEvent).code;
    const noteName = this.held.get(code);
    if (!noteName) return;
    this.held.delete(code);
    this.hub.noteOff(noteName, 'xylophone');
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

  private releaseAll(): void {
    for (const noteName of this.held.values()) this.hub.noteOff(noteName, 'xylophone');
    this.held.clear();
  }
}
