import type { StaffExample } from './exampleXml';

/** A text in both languages. Writing them side by side keeps the two in step. */
export interface Bi {
  en: string;
  fa: string;
}

export type UnitId = 'notes' | 'rhythm' | 'piano' | 'persian';

/** Where a lesson can send the student to try what they just read. */
export type LessonAction = 'quiz' | 'levels' | 'songs' | 'metronome' | 'xylophone';

export type Block =
  | { type: 'text'; text: Bi }
  | { type: 'heading'; text: Bi }
  | { type: 'list'; items: Bi[] }
  | { type: 'tip'; text: Bi }
  /** A picture of music. `names` writes the note names under the notes; `listen` adds a Play button. */
  | { type: 'staff'; spec: StaffExample; names?: boolean | 'octave'; listen?: boolean; caption?: Bi }
  /** A small keyboard picture. `marks` puts a short label (a finger number, a letter) on keys. */
  | { type: 'keys'; from: string; to: string; names?: 'none' | 'white' | 'all'; marks?: Record<string, string>; caption?: Bi }
  /** Both hands with the finger numbers. */
  | { type: 'fingers'; caption?: Bi }
  /** Symbols or Italian terms with what they mean. */
  | { type: 'terms'; items: Array<{ symbol: string; text: Bi }> };

export interface Lesson {
  id: string;
  unit: UnitId;
  title: Bi;
  /** One line shown on the lesson list. */
  summary: Bi;
  /** About how long it takes to read, for the list. */
  minutes: number;
  blocks: Block[];
  actions?: LessonAction[];
}

export interface Unit {
  id: UnitId;
  title: Bi;
  summary: Bi;
  lessons: Lesson[];
}
