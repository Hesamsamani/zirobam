import type { MessageKey } from '../i18n';
import type { Clef } from './nameTheNote';

export interface LessonExample {
  pitch: string;
  clef: Clef;
}

export interface Lesson {
  id: string;
  titleKey: MessageKey;
  bodyKey: MessageKey;
  examples: LessonExample[];
}

export const LESSONS: readonly Lesson[] = [
  {
    id: 'staff',
    titleKey: 'lessons.staff.title',
    bodyKey: 'lessons.staff.body',
    examples: [{ pitch: 'E4', clef: 'treble' }],
  },
  {
    id: 'clefs',
    titleKey: 'lessons.clefs.title',
    bodyKey: 'lessons.clefs.body',
    examples: [{ pitch: 'G4', clef: 'treble' }, { pitch: 'F3', clef: 'bass' }],
  },
  {
    id: 'middle-c',
    titleKey: 'lessons.middleC.title',
    bodyKey: 'lessons.middleC.body',
    examples: [{ pitch: 'C4', clef: 'treble' }, { pitch: 'C4', clef: 'bass' }],
  },
  {
    id: 'ledger',
    titleKey: 'lessons.ledger.title',
    bodyKey: 'lessons.ledger.body',
    examples: [{ pitch: 'A5', clef: 'treble' }, { pitch: 'E2', clef: 'bass' }],
  },
  {
    id: 'names',
    titleKey: 'lessons.names.title',
    bodyKey: 'lessons.names.body',
    examples: [{ pitch: 'C4', clef: 'treble' }],
  },
];
