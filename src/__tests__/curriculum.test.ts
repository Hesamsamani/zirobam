import { describe, it, expect } from 'vitest';
import { ALL_LESSONS, UNITS, findLesson, neighbours, unitOf } from '../lessons/curriculum';
import { buildExampleXml, exampleNoteNames } from '../lessons/exampleXml';
import { courseText, resolveNoteTokens } from '../lessons/courseText';
import type { Bi, Block, Lesson } from '../lessons/types';

const ACTIONS = ['quiz', 'levels', 'songs', 'metronome', 'xylophone'];

/** Every Bi in a lesson, with a label for the failure message. */
function texts(lesson: Lesson): Array<{ where: string; bi: Bi }> {
  const found: Array<{ where: string; bi: Bi }> = [
    { where: `${lesson.id} title`, bi: lesson.title },
    { where: `${lesson.id} summary`, bi: lesson.summary },
  ];
  lesson.blocks.forEach((block, index) => {
    const where = `${lesson.id} block ${index + 1} (${block.type})`;
    if (block.type === 'text' || block.type === 'heading' || block.type === 'tip') found.push({ where, bi: block.text });
    if (block.type === 'list') block.items.forEach((bi, i) => found.push({ where: `${where} item ${i + 1}`, bi }));
    if (block.type === 'terms') block.items.forEach((item, i) => found.push({ where: `${where} term ${i + 1}`, bi: item.text }));
    if ((block.type === 'staff' || block.type === 'keys' || block.type === 'fingers') && block.caption) {
      found.push({ where: `${where} caption`, bi: block.caption });
    }
  });
  return found;
}

const everyText = ALL_LESSONS.flatMap(texts);

describe('the course', () => {
  it('has four units and plenty of lessons', () => {
    expect(UNITS.map((u) => u.id)).toEqual(['notes', 'rhythm', 'piano', 'persian']);
    for (const unit of UNITS) expect(unit.lessons.length).toBeGreaterThanOrEqual(10);
    expect(ALL_LESSONS.length).toBeGreaterThanOrEqual(30);
  });

  it('gives every lesson a unique address-friendly id and the unit it sits in', () => {
    const ids = ALL_LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const unit of UNITS) {
      for (const lesson of unit.lessons) {
        expect(lesson.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
        expect(lesson.unit).toBe(unit.id);
        expect(unitOf(lesson)).toBe(unit);
      }
    }
  });

  it('finds lessons and their neighbours across the unit borders', () => {
    expect(findLesson('staff')?.unit).toBe('notes');
    expect(findLesson('nope')).toBeNull();
    expect(findLesson(null)).toBeNull();
    expect(neighbours(ALL_LESSONS[0].id).previous).toBeNull();
    expect(neighbours(ALL_LESSONS[0].id).next).toBe(ALL_LESSONS[1]);
    const last = ALL_LESSONS[ALL_LESSONS.length - 1];
    expect(neighbours(last.id).next).toBeNull();
    const firstRhythm = UNITS[1].lessons[0];
    expect(neighbours(firstRhythm.id).previous).toBe(UNITS[0].lessons[UNITS[0].lessons.length - 1]);
    expect(neighbours('nope')).toEqual({ previous: null, next: null });
  });

  it('has enough to read in every lesson, and a time estimate', () => {
    for (const lesson of ALL_LESSONS) {
      expect(lesson.blocks.filter((b) => b.type === 'text').length, lesson.id).toBeGreaterThanOrEqual(1);
      expect(lesson.blocks.length, lesson.id).toBeGreaterThanOrEqual(3);
      expect(lesson.minutes, lesson.id).toBeGreaterThanOrEqual(2);
      for (const action of lesson.actions ?? []) expect(ACTIONS).toContain(action);
    }
  });
});

describe('the words', () => {
  it('has both languages for every text, and they are not copies', () => {
    for (const { where, bi } of everyText) {
      expect(bi.en.trim().length, `${where} en`).toBeGreaterThan(0);
      expect(bi.fa.trim().length, `${where} fa`).toBeGreaterThan(0);
      expect(bi.fa, where).not.toBe(bi.en);
    }
  });

  it('writes the Persian with Persian letters', () => {
    for (const { where, bi } of everyText) {
      expect(bi.fa, `${where}: Arabic yeh or kaf`).not.toMatch(/[يك]/);
      expect(bi.fa, `${where}: a dash`).not.toMatch(/[–—]/);
      expect(bi.fa, `${where}: a double space`).not.toMatch(/ {2}/);
      // digits belong to Persian text as Persian digits; a note name followed by an octave number is the exception
      expect(bi.fa.replace(/\{[A-G](?:##|bb|[#bko])?\d\}/g, ''), `${where}: Latin digits`).not.toMatch(/[0-9]/);
    }
  });

  it('starts every Persian text with a Persian letter, not a Latin word', () => {
    for (const { where, bi } of everyText) expect(bi.fa, where).toMatch(/^…?[؀-ۿ«]/);
  });

  it('uses only note tokens the app can fill in, and every brace pairs up', () => {
    for (const { where, bi } of everyText) {
      for (const text of [bi.en, bi.fa]) {
        const stripped = text.replace(/\{[A-G](?:##|bb|[#bko])?\d?\}/g, '');
        expect(stripped, `${where}: stray brace`).not.toMatch(/[{}]/);
      }
    }
  });

  it('fills the note names in the chosen system', () => {
    expect(resolveNoteTokens('{C} {D} {F#}', 'letters')).toBe('C D F♯');
    expect(resolveNoteTokens('{C} {Bb}', 'solfege')).toBe('Do Si♭');
    expect(resolveNoteTokens('{E} و {G}', 'solfege-fa')).toBe('می و سل');
    expect(resolveNoteTokens('{C4}', 'letters')).toBe('C4');
    expect(resolveNoteTokens('{F#3}', 'solfege')).toBe('Fa♯3');
    // double signs and the Persian quarter tones
    expect(resolveNoteTokens('{F##} {Bbb} {Ek} {Co}', 'letters')).toBe('F♯♯ B♭♭ E koron C sori');
    expect(resolveNoteTokens('{Ek} {Co}', 'solfege-fa')).toBe('می کرن دو سری');
    expect(courseText({ en: 'a {C}', fa: 'ب {C}' }, 'fa', 'solfege-fa')).toBe('ب دو');
  });
});

describe('the pictures', () => {
  const staffBlocks = ALL_LESSONS.flatMap((lesson) =>
    lesson.blocks.flatMap((block, index) => (block.type === 'staff' ? [{ where: `${lesson.id} block ${index + 1}`, block }] : []))
  );
  const keyBlocks = ALL_LESSONS.flatMap((lesson) =>
    lesson.blocks.flatMap((block, index) => (block.type === 'keys' ? [{ where: `${lesson.id} block ${index + 1}`, block }] : []))
  );

  const midi = (name: string): number => {
    const match = /^([A-G])(#?)(\d)$/.exec(name);
    expect(match, name).not.toBeNull();
    const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    return (Number(match![3]) + 1) * 12 + base[match![1]] + (match![2] ? 1 : 0);
  };

  it('has pictures in most lessons', () => {
    expect(staffBlocks.length).toBeGreaterThanOrEqual(40);
    expect(keyBlocks.length).toBeGreaterThanOrEqual(8);
  });

  it('builds every staff picture, with every measure the right length', () => {
    for (const { where, block } of staffBlocks) {
      if (block.type !== 'staff') continue;
      expect(() => buildExampleXml(block.spec), where).not.toThrow();
      expect(exampleNoteNames(block.spec).length, where).toBeGreaterThan(0);
    }
  });

  it('keeps every note in a range that stays readable', () => {
    for (const { where, block } of staffBlocks) {
      if (block.type !== 'staff') continue;
      for (const name of exampleNoteNames(block.spec)) {
        const octave = Number(name.slice(-1));
        expect(octave, `${where}: ${name}`).toBeGreaterThanOrEqual(2);
        expect(octave, `${where}: ${name}`).toBeLessThanOrEqual(6);
      }
    }
  });

  it('keeps every keyboard picture small and its marks on its keys', () => {
    for (const { where, block } of keyBlocks) {
      if (block.type !== 'keys') continue;
      const from = midi(block.from);
      const to = midi(block.to);
      expect(from, where).toBeLessThan(to);
      expect(to - from, `${where}: too wide to draw`).toBeLessThanOrEqual(24);
      for (const key of Object.keys(block.marks ?? {})) {
        const value = midi(key);
        expect(value, `${where}: mark ${key}`).toBeGreaterThanOrEqual(from);
        expect(value, `${where}: mark ${key}`).toBeLessThanOrEqual(to);
      }
    }
  });
});

describe('the course as a whole', () => {
  it('uses every kind of block', () => {
    const used = new Set<Block['type']>();
    for (const lesson of ALL_LESSONS) for (const block of lesson.blocks) used.add(block.type);
    expect([...used].sort()).toEqual(['fingers', 'heading', 'keys', 'list', 'staff', 'terms', 'text', 'tip']);
  });
});
