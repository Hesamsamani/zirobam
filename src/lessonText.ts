import { t, type MessageKey } from './i18n';
import { formatKeyName, formatNoteName, getNoteNameSystem, type NoteNameSystem } from './i18n/noteNames';

const KEY_PROGRESSION = ['C', 'G', 'F', 'D', 'Bb', 'A', 'Eb', 'E', 'Ab', 'B', 'Db'];
const SUB_LEVEL_LETTERS = 'abcd';

/** Same walk as the generator: C for levels 1-10, then the circle of fifths. */
export function keyIdForLevel(level: number): string {
  if (level <= 10) return 'C';
  return KEY_PROGRESSION[Math.min(level - 10, KEY_PROGRESSION.length - 1)];
}

export function describeLesson(
  level: number,
  subLevel: number,
  system: NoteNameSystem = getNoteNameSystem()
): string {
  if (level <= 10) {
    const key = `lesson.${level}${SUB_LEVEL_LETTERS[subLevel]}` as MessageKey;
    return t(key, {
      C: formatNoteName('C', system),
      E: formatNoteName('E', system),
      G: formatNoteName('G', system),
    });
  }
  return t(`lesson.key.${subLevel}` as MessageKey, {
    key: formatKeyName(keyIdForLevel(level), system),
  });
}
