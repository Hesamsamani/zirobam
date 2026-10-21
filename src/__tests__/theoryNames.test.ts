import { describe, it, expect } from 'vitest';
import { en } from '../i18n/locales/en';
import { fa } from '../i18n/locales/fa';
import { CHORD_DEFS, CHORD_FAMILIES } from '../theory/chordCatalog';
import { SCALES, SCALE_CATEGORIES } from '../theory/scaleCatalog';

// Every scale, chord and family of the catalogs is named in both languages, under `scale.cat.`, `scale.name.`,
// `chord.family.` and `chord.name.`.

const keysFor = (): string[] => [
  ...SCALE_CATEGORIES.map((c) => `scale.cat.${c}`),
  ...SCALES.map((s) => `scale.name.${s.id}`),
  ...CHORD_FAMILIES.map((f) => `chord.family.${f}`),
  ...CHORD_DEFS.map((d) => `chord.name.${d.id}`),
];

describe('the names of the scales and chords', () => {
  it('are there in English and in Persian for every catalog entry', () => {
    const missing = keysFor().filter((key) => !(key in en) || !(key in fa));
    expect(missing).toEqual([]);
  });

  it('are not there for anything the catalogs do not have', () => {
    const wanted = new Set(keysFor());
    const extra = Object.keys(en).filter((key) => /^(scale\.(cat|name)|chord\.(family|name))\./.test(key) && !wanted.has(key));
    expect(extra).toEqual([]);
  });

  it('are different from one entry to the next within a list, so two scales are never shown under one name', () => {
    for (const prefix of ['scale.name.', 'chord.name.']) {
      for (const dictionary of [en, fa] as Array<Record<string, string>>) {
        const names = Object.entries(dictionary).filter(([key]) => key.startsWith(prefix));
        // two chords may share a name in different families (the power chord is both a family and a chord), but not within a list
        expect(new Set(names.map(([, value]) => value)).size, `${prefix} in ${dictionary === en ? 'en' : 'fa'}`).toBe(names.length);
      }
    }
  });

  it('are written in Persian with Persian letters: a letter first, the half-space for compounds, no hyphens', () => {
    for (const key of keysFor()) {
      const text = (fa as Record<string, string>)[key];
      expect(text, key).toMatch(/^[؀-ۿ]/); // starts with a Persian letter
      expect(text, key).not.toMatch(/[A-Za-z0-9]/); // no Latin letters or digits left in
      expect(text, key).not.toMatch(/-/); // no hyphen: a compound takes the half-space
      expect(text, key).not.toMatch(/[يك]/); // the Persian yeh and kaf, not the Arabic ones
    }
  });
});
