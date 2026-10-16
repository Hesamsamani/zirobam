import { NOTES_UNIT } from './unitNotes';
import { PIANO_UNIT } from './unitPiano';
import { RHYTHM_UNIT } from './unitRhythm';
import type { Lesson, Unit } from './types';

export type { Bi, Block, Lesson, LessonAction, Unit, UnitId } from './types';

/** The course, in the order a beginner should take it. */
export const UNITS: readonly Unit[] = [NOTES_UNIT, RHYTHM_UNIT, PIANO_UNIT];

export const ALL_LESSONS: readonly Lesson[] = UNITS.flatMap((unit) => unit.lessons);

export function findLesson(id: string | null | undefined): Lesson | null {
  return ALL_LESSONS.find((lesson) => lesson.id === id) ?? null;
}

export function unitOf(lesson: Lesson): Unit {
  return UNITS.find((unit) => unit.id === lesson.unit) ?? UNITS[0];
}

export function neighbours(id: string): { previous: Lesson | null; next: Lesson | null } {
  const index = ALL_LESSONS.findIndex((lesson) => lesson.id === id);
  if (index < 0) return { previous: null, next: null };
  return { previous: ALL_LESSONS[index - 1] ?? null, next: ALL_LESSONS[index + 1] ?? null };
}
