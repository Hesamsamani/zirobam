import { normalizeNote } from './timingEvents';

/** What the wait mode needs to know about a moment of the piece. */
export interface WaitEvent {
  pitches: readonly string[];
  /** Pitches that are only held over a tie: no key has to be pressed for them. */
  tiedPitches?: readonly string[];
}

export type WaitPress =
  /** A note of a chord that is right; the rest of the chord is still missing. */
  | { result: 'partial'; index: number; matched: string }
  /** The moment is complete; `index` is the next moment to wait at. */
  | { result: 'advance'; index: number }
  /** The last moment is complete. */
  | { result: 'done'; index: number }
  | { result: 'wrong'; index: number }
  /** A note that was already played at this moment, or a note after the end. */
  | { result: 'ignored'; index: number };

/** The keys that have to be pressed at a moment: its notes without the ones held over a tie. */
function required(event: WaitEvent): string[] {
  const tied = new Set((event.tiedPitches ?? []).map(normalizeNote));
  return event.pitches.filter((pitch) => !tied.has(normalizeNote(pitch)));
}

/** How many key presses the whole piece asks for. */
export function countWaitNotes(events: readonly WaitEvent[]): number {
  return events.reduce((sum, event) => sum + required(event).length, 0);
}

/**
 * Wait mode: the piece does not move on its own. It stops at a moment and waits until the student plays
 * the notes of that moment (any order for a chord), then goes to the next one that has a note to play.
 * Pure state: the screen asks it what a key press meant.
 */
export class WaitSession {
  private readonly needs: string[][];
  private current = 0;
  /** The moment that was completed last, so a finished session can still say where it ended. */
  private completed = 0;
  /** The pitches (normalised) of the current moment that were played already. */
  private played = new Set<string>();

  constructor(events: readonly WaitEvent[]) {
    this.needs = events.map(required);
    this.current = this.firstFrom(0);
  }

  private firstFrom(from: number): number {
    let i = from;
    while (i < this.needs.length && this.needs[i].length === 0) i++;
    return i;
  }

  /** The index of the moment the piece waits at (past the end when finished). */
  index(): number {
    return this.current;
  }

  finished(): boolean {
    return this.current >= this.needs.length;
  }

  /** The notes of the current moment that are still to be played. */
  expected(): string[] {
    if (this.finished()) return [];
    return this.needs[this.current].filter((pitch) => !this.played.has(normalizeNote(pitch)));
  }

  restart(): void {
    this.played = new Set();
    this.completed = 0;
    this.current = this.firstFrom(0);
  }

  /** What playing this key means at the current moment. */
  press(note: string): WaitPress {
    if (this.finished()) return { result: 'ignored', index: this.completed };
    const key = normalizeNote(note);
    const wanted = this.needs[this.current].map(normalizeNote);
    if (!wanted.includes(key)) return { result: 'wrong', index: this.current };
    if (this.played.has(key)) return { result: 'ignored', index: this.current };
    this.played.add(key);
    if (wanted.some((pitch) => !this.played.has(pitch))) return { result: 'partial', index: this.current, matched: note };
    this.played = new Set();
    this.completed = this.current;
    this.current = this.firstFrom(this.current + 1);
    return this.finished() ? { result: 'done', index: this.completed } : { result: 'advance', index: this.current };
  }
}
