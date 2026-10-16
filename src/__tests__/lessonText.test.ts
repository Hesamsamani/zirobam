import { describe, it, expect, beforeEach } from 'vitest';
import { setLocale, initLocale } from '../i18n';
import { setNoteNameSystem } from '../i18n/noteNames';
import { describeLesson, keyIdForLevel } from '../lessonText';
import { setLevel, setSubLevel, generateMusicXML } from '../musicGenerator';

beforeEach(() => {
  localStorage.clear();
  initLocale();
  setNoteNameSystem(null);
});

describe('describeLesson', () => {
  it('matches the upstream English wording for C major levels', () => {
    expect(describeLesson(1, 0)).toBe('C and G — whole notes (RH)');
    expect(describeLesson(1, 1)).toBe('C, E, G triad — whole notes (RH)');
    expect(describeLesson(4, 3)).toBe('Whole and half notes — both hands');
    expect(describeLesson(10, 3)).toBe('Sixteenth notes — both hands');
  });

  it('names the key for levels 11 and up', () => {
    expect(describeLesson(11, 0)).toBe('G major — whole notes (RH)');
    expect(describeLesson(12, 3)).toBe('F major — both hands');
  });

  it('is Persian in Persian, using Persian solfège names', () => {
    setLocale('fa');
    expect(describeLesson(1, 0)).toBe('دو و سل: نت گرد (دست راست)');
    expect(describeLesson(11, 0)).toBe('سل ماژور: نت گرد (دست راست)');
  });

  it('follows the chosen note-name system', () => {
    setNoteNameSystem('solfege');
    expect(describeLesson(1, 0)).toBe('Do and Sol — whole notes (RH)');
  });
});

describe('keyIdForLevel', () => {
  it('uses C for levels 1 to 10 and walks the circle of fifths after', () => {
    expect(keyIdForLevel(1)).toBe('C');
    expect(keyIdForLevel(10)).toBe('C');
    expect(keyIdForLevel(11)).toBe('G');
    expect(keyIdForLevel(12)).toBe('F');
    expect(keyIdForLevel(13)).toBe('D');
  });

  it('agrees with the generator for levels 11 to 14', () => {
    const names: Record<string, string> = { G: 'G major', F: 'F major', D: 'D major', Bb: 'Bb major' };
    for (const level of [11, 12, 13, 14]) {
      setLevel(level);
      setSubLevel(0);
      const description = generateMusicXML().lessonDescription;
      expect(description.startsWith(names[keyIdForLevel(level)])).toBe(true);
    }
  });
});
