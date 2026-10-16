import { describe, it, expect } from 'vitest';
import { LESSONS } from '../learn/lessons';
import { en } from '../i18n/locales/en';
import { fa } from '../i18n/locales/fa';

describe('LESSONS', () => {
  it('has five lessons with unique ids', () => {
    expect(LESSONS).toHaveLength(5);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(5);
  });

  it('has text in both languages and at least one valid example each', () => {
    for (const lesson of LESSONS) {
      for (const key of [lesson.titleKey, lesson.bodyKey]) {
        expect(en[key].length, key).toBeGreaterThan(5);
        expect(fa[key].length, key).toBeGreaterThan(3);
      }
      expect(lesson.examples.length).toBeGreaterThan(0);
      for (const example of lesson.examples) {
        expect(example.pitch).toMatch(/^[A-G][#b]?\d$/);
        expect(['treble', 'bass']).toContain(example.clef);
      }
    }
  });
});
