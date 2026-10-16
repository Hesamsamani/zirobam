# Bilingual Note Trainer (Milestone 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the sight-reading app usable by a Persian- or English-speaking beginner: language switch with right-to-left Persian, three note-name systems, play without a MIDI keyboard, note names on the staff, and a "Name the note" beginner mode with short lessons.

**Architecture:** New small modules under `src/i18n/`, `src/input/` and `src/learn/` plus a few edits to `index.html`, `main.ts` and `style.css`. All note input (MIDI, on-screen piano, computer keyboard) goes through one hub, so scoring and highlighting stay unchanged. Internal note names stay English letters (`C#4`); naming systems only change what is displayed.

**Tech Stack:** TypeScript, Vite 7, Vitest 4 (jsdom), Playwright, Verovio (notation), Tone.js (audio). No new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-10-16-bilingual-note-trainer-design.md`

## Global Constraints

- Work on branch `bilingual`; one commit per task; commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Never push. The only remote is `upstream` with push URL `DISABLED-local-only`.
- Every new user-visible string needs a key in `src/i18n/locales/en.ts` **and** `fa.ts` (the `fa` object is typed `Record<MessageKey, string>`, so a missing key fails `tsc`).
- Persian text: ZWNJ (U+200C) in می‌شود, کتاب‌ها; Persian letters ی ک only; no em/en dashes; «guillemets»; Persian digits in prose; no letter-spacing or italics on Persian.
- Only text and panels flip for RTL. `#notation`, the staff, the piano and the note-answer buttons stay `dir="ltr"`.
- Keyboard input uses `KeyboardEvent.code`, never `key`.
- No new network dependencies (no CDN, no analytics). The Vazirmatn font is self-hosted from `public/fonts/`.
- Keep upstream behaviour: all 190 existing unit tests and the existing E2E tests must stay green; English remains the default language.
- Run from `C:\AI\Projects\study\music-notes-trainer`. Commands: `npm test`, `npx tsc --noEmit`, `npm run build`, `npx playwright test`.

## File Structure

| File | Responsibility |
|---|---|
| `src/i18n/digits.ts` (new) | `toPersianDigits`, `toLatinDigits` |
| `src/i18n/locales/en.ts`, `fa.ts` (new) | The dictionaries; `en` defines `MessageKey` |
| `src/i18n/index.ts` (new) | `t()`, locale state, `<html lang dir>`, `applyTranslations()`, digit formatting |
| `src/i18n/noteNames.ts` (new) | Note-name systems, formatting, stored choice, `formatKeyName` |
| `src/lessonText.ts` (new) | Translated level descriptions |
| `src/input/noteInput.ts` (new) | The note event hub shared by every input source |
| `src/input/computerKeyboard.ts` (new) | Physical-key to note mapping, octave shift |
| `src/input/onScreenPiano.ts` (new) | Clickable piano |
| `src/rendering/noteLabels.ts` (new) | Note-name labels drawn under noteheads |
| `src/learn/noteStats.ts`, `noteScheduler.ts`, `nameTheNote.ts` (new) | Quiz data and logic (pure) |
| `src/learn/noteCard.ts`, `learnView.ts`, `lessons.ts` (new) | One-note staff renderer, quiz and lesson screens, lesson content |
| `index.html`, `src/main.ts`, `src/style.css` (modify) | Wiring, markup, styles |
| `public/fonts/` (new) | Vazirmatn (OFL) |
| `src/__tests__/*.test.ts`, `e2e/bilingual.spec.ts` (new) | Tests |

---

### Task 1: Translation core and digits

**Files:**
- Create: `src/i18n/digits.ts`, `src/i18n/locales/en.ts`, `src/i18n/locales/fa.ts`, `src/i18n/index.ts`
- Test: `src/__tests__/digits.test.ts`, `src/__tests__/i18n.test.ts`

**Interfaces:**
- Produces: `toPersianDigits(input: string | number): string`; `toLatinDigits(input: string): string`;
  `type Locale = 'en' | 'fa'`; `LOCALES`; `type MessageKey`; `t(key: MessageKey, params?: Record<string, string | number>): string`;
  `getLocale(): Locale`; `setLocale(locale: Locale, doc?: Document): void`; `initLocale(doc?: Document): Locale`;
  `onLocaleChange(fn: (locale: Locale) => void): () => void`; `applyTranslations(root?: ParentNode): void`;
  `dirOf(locale: Locale): 'ltr' | 'rtl'`; `formatNumber(n: number): string`; `usesPersianDigits(): boolean`; `setPersianDigits(enabled: boolean): void`.

- [ ] **Step 1: Write the failing digits test** (`src/__tests__/digits.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { toPersianDigits, toLatinDigits } from '../i18n/digits';

describe('digits', () => {
  it('converts Latin digits to Persian digits', () => {
    expect(toPersianDigits(1405)).toBe('۱۴۰۵');
    expect(toPersianDigits('Level 12')).toBe('Level ۱۲');
  });

  it('leaves other characters alone', () => {
    expect(toPersianDigits('a-b/3')).toBe('a-b/۳');
  });

  it('converts Persian digits back to Latin digits', () => {
    expect(toLatinDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  });
});
```

- [ ] **Step 2: Write the failing i18n test** (`src/__tests__/i18n.test.ts`)

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  t, getLocale, setLocale, initLocale, onLocaleChange, applyTranslations,
  dirOf, formatNumber, setPersianDigits, LOCALES, type MessageKey,
} from '../i18n';
import { en } from '../i18n/locales/en';
import { fa } from '../i18n/locales/fa';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('dir');
  document.body.innerHTML = '';
  initLocale();
});

describe('t()', () => {
  it('defaults to English', () => {
    expect(getLocale()).toBe('en');
    expect(t('app.title')).toBe('Sight Reading');
  });

  it('replaces {placeholders} with params', () => {
    expect(t('progress.moreToAdvance', { n: 3 })).toBe('3 more to advance');
  });

  it('keeps the placeholder when the param is missing', () => {
    expect(t('progress.moreToAdvance')).toBe('{n} more to advance');
  });

  it('returns the key itself for an unknown key', () => {
    expect(t('does.not.exist' as MessageKey)).toBe('does.not.exist');
  });
});

describe('locale state', () => {
  it('setLocale("fa") sets lang, dir and stores the choice', () => {
    setLocale('fa');
    expect(document.documentElement.lang).toBe('fa');
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem('ui.locale')).toBe('fa');
    expect(t('app.title')).toBe('نت‌خوانی');
  });

  it('initLocale restores the stored locale', () => {
    localStorage.setItem('ui.locale', 'fa');
    expect(initLocale()).toBe('fa');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('initLocale ignores an invalid stored value', () => {
    localStorage.setItem('ui.locale', 'xx');
    expect(initLocale()).toBe('en');
  });

  it('notifies listeners and stops after unsubscribe', () => {
    const fn = vi.fn();
    const off = onLocaleChange(fn);
    setLocale('fa');
    expect(fn).toHaveBeenCalledWith('fa');
    off();
    setLocale('en');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('dirOf maps fa to rtl and en to ltr', () => {
    expect(dirOf('fa')).toBe('rtl');
    expect(dirOf('en')).toBe('ltr');
  });
});

describe('applyTranslations()', () => {
  it('fills data-i18n text and data-i18n-attr attributes, and refreshes on locale change', () => {
    document.body.innerHTML =
      '<h1 data-i18n="app.title"></h1>' +
      '<button data-i18n-attr="aria-label:options.title; title:options.language"></button>';
    applyTranslations();
    expect(document.querySelector('h1')!.textContent).toBe('Sight Reading');
    expect(document.querySelector('button')!.getAttribute('aria-label')).toBe('Options');
    expect(document.querySelector('button')!.getAttribute('title')).toBe('Language');

    setLocale('fa');
    expect(document.querySelector('h1')!.textContent).toBe('نت‌خوانی');
    expect(document.querySelector('button')!.getAttribute('aria-label')).toBe('تنظیمات');
  });
});

describe('numbers', () => {
  it('uses Persian digits only in Persian with the option on', () => {
    expect(formatNumber(12)).toBe('12');
    setLocale('fa');
    expect(formatNumber(12)).toBe('۱۲');
    setPersianDigits(false);
    expect(formatNumber(12)).toBe('12');
    setPersianDigits(true);
    setLocale('en');
    expect(formatNumber(12)).toBe('12');
  });

  it('formats numeric params but not string params', () => {
    setLocale('fa');
    expect(t('progress.moreToAdvance', { n: 3 })).toContain('۳');
    expect(t('progress.moreToAdvance', { n: '3' })).toContain('3');
  });
});

describe('dictionaries', () => {
  const keys = Object.keys(en) as MessageKey[];

  it('fa defines exactly the keys of en', () => {
    expect(Object.keys(fa).sort()).toEqual([...keys].sort());
  });

  it('placeholders match between en and fa', () => {
    const tokens = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const k of keys) expect(tokens(fa[k]), k).toEqual(tokens(en[k]));
  });

  it('fa has no Arabic letters, no dashes and no empty strings', () => {
    for (const k of keys) {
      expect(fa[k], k).not.toMatch(/[يك]/);
      expect(fa[k], k).not.toMatch(/[—–]/);
      expect(fa[k].trim().length, k).toBeGreaterThan(0);
    }
  });

  it('LOCALES lists both languages', () => {
    expect([...LOCALES]).toEqual(['en', 'fa']);
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run src/__tests__/digits.test.ts src/__tests__/i18n.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 4: Implement** `src/i18n/digits.ts`

```ts
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

export function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
}
```

`src/i18n/locales/en.ts` (starter keys; later tasks add more to both files):

```ts
export const en = {
  'app.title': 'Sight Reading',
  'app.documentTitle': 'Sight Reading Practice',
  'options.title': 'Options',
  'options.language': 'Language',
  'progress.moreToAdvance': '{n} more to advance',
} as const;

export type MessageKey = keyof typeof en;
```

`src/i18n/locales/fa.ts`:

```ts
import type { MessageKey } from './en';

export const fa: Record<MessageKey, string> = {
  'app.title': 'نت‌خوانی',
  'app.documentTitle': 'تمرین نت‌خوانی',
  'options.title': 'تنظیمات',
  'options.language': 'زبان',
  'progress.moreToAdvance': '{n} تکرار دیگر تا مرحله‌ی بعد',
};
```

`src/i18n/index.ts`:

```ts
import { en, type MessageKey } from './locales/en';
import { fa } from './locales/fa';
import { toPersianDigits } from './digits';

export type { MessageKey };
export type Locale = 'en' | 'fa';
export const LOCALES: readonly Locale[] = ['en', 'fa'];

const LOCALE_KEY = 'ui.locale';
const DIGITS_KEY = 'ui.persianDigits';

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, fa };

let currentLocale: Locale = 'en';
let persianDigits = true;
const listeners = new Set<(locale: Locale) => void>();

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the choice just won't persist
  }
}

function emitChange(): void {
  for (const fn of listeners) fn(currentLocale);
}

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'fa';
}

export function getLocale(): Locale {
  return currentLocale;
}

export function dirOf(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'fa' ? 'rtl' : 'ltr';
}

export function usesPersianDigits(): boolean {
  return currentLocale === 'fa' && persianDigits;
}

export function setPersianDigits(enabled: boolean): void {
  persianDigits = enabled;
  writeStorage(DIGITS_KEY, enabled ? '1' : '0');
  emitChange();
}

export function formatNumber(value: number): string {
  const text = String(value);
  return usesPersianDigits() ? toPersianDigits(text) : text;
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = dictionaries[currentLocale][key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!(name in params)) return match;
    const value = params[name];
    return typeof value === 'number' ? formatNumber(value) : value;
  });
}

export function applyTranslations(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as MessageKey);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
    for (const pair of (el.dataset.i18nAttr ?? '').split(';')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key as MessageKey));
    }
  });
}

function applyDocumentLocale(doc: Document): void {
  doc.documentElement.lang = currentLocale;
  doc.documentElement.dir = dirOf(currentLocale);
  applyTranslations(doc);
}

export function setLocale(locale: Locale, doc: Document = document): void {
  currentLocale = locale;
  writeStorage(LOCALE_KEY, locale);
  applyDocumentLocale(doc);
  emitChange();
}

export function initLocale(doc: Document = document): Locale {
  const stored = readStorage(LOCALE_KEY);
  currentLocale = isLocale(stored) ? stored : 'en';
  persianDigits = readStorage(DIGITS_KEY) !== '0';
  applyDocumentLocale(doc);
  return currentLocale;
}

export function onLocaleChange(fn: (locale: Locale) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/__tests__/digits.test.ts src/__tests__/i18n.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/i18n src/__tests__/digits.test.ts src/__tests__/i18n.test.ts
git commit -m "feat(i18n): translation core with English and Persian dictionaries"
```

---

### Task 2: Note-name systems

**Files:**
- Create: `src/i18n/noteNames.ts`
- Modify: `src/i18n/locales/en.ts`, `fa.ts` (add `key.major`)
- Test: `src/__tests__/noteNames.test.ts`

**Interfaces:**
- Consumes: `getLocale`, `onLocaleChange`, `t`, `Locale` from `src/i18n`.
- Produces: `type NoteNameSystem = 'letters' | 'solfege' | 'solfege-fa'`; `NOTE_NAME_SYSTEMS`; `isNoteNameSystem(v): v is NoteNameSystem`; `defaultSystemFor(locale: Locale): NoteNameSystem`; `formatNoteName(note: string, system: NoteNameSystem, options?: { octave?: boolean }): string`; `formatKeyName(keyId: string, system?: NoteNameSystem): string`; `getNoteNameSystem(): NoteNameSystem`; `setNoteNameSystem(system: NoteNameSystem | null): void`; `loadNoteNameSystem(): void`; `onNoteNamesChange(fn: (system: NoteNameSystem) => void): () => void` (fires when the system is set **or** the locale changes).

- [ ] **Step 1: Write the failing test** (`src/__tests__/noteNames.test.ts`)

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setLocale, initLocale } from '../i18n';
import {
  formatNoteName, formatKeyName, defaultSystemFor, getNoteNameSystem, setNoteNameSystem,
  loadNoteNameSystem, onNoteNamesChange, isNoteNameSystem, NOTE_NAME_SYSTEMS,
} from '../i18n/noteNames';

beforeEach(() => {
  localStorage.clear();
  initLocale();
  setNoteNameSystem(null);
});

describe('formatNoteName', () => {
  it('letters', () => {
    expect(formatNoteName('C4', 'letters')).toBe('C');
    expect(formatNoteName('F#4', 'letters')).toBe('F♯');
    expect(formatNoteName('Bb3', 'letters')).toBe('B♭');
  });

  it('solfège (fixed do)', () => {
    expect(formatNoteName('C4', 'solfege')).toBe('Do');
    expect(formatNoteName('G4', 'solfege')).toBe('Sol');
    expect(formatNoteName('B3', 'solfege')).toBe('Si');
    expect(formatNoteName('Bb3', 'solfege')).toBe('Si♭');
  });

  it('Persian solfège', () => {
    expect(formatNoteName('C4', 'solfege-fa')).toBe('دو');
    expect(formatNoteName('D4', 'solfege-fa')).toBe('ر');
    expect(formatNoteName('E4', 'solfege-fa')).toBe('می');
    expect(formatNoteName('F4', 'solfege-fa')).toBe('فا');
    expect(formatNoteName('G4', 'solfege-fa')).toBe('سل');
    expect(formatNoteName('A4', 'solfege-fa')).toBe('لا');
    expect(formatNoteName('B4', 'solfege-fa')).toBe('سی');
    expect(formatNoteName('F#4', 'solfege-fa')).toBe('فا دیز');
    expect(formatNoteName('Bb3', 'solfege-fa')).toBe('سی بمل');
  });

  it('accepts a bare letter and the ♯ ♭ glyphs', () => {
    expect(formatNoteName('G', 'solfege')).toBe('Sol');
    expect(formatNoteName('A♭', 'letters')).toBe('A♭');
    expect(formatNoteName('c#', 'letters')).toBe('C♯');
  });

  it('adds the octave only when asked', () => {
    expect(formatNoteName('C4', 'letters', { octave: true })).toBe('C4');
    expect(formatNoteName('C4', 'letters')).toBe('C');
  });

  it('returns invalid input unchanged', () => {
    expect(formatNoteName('H9', 'letters')).toBe('H9');
    expect(formatNoteName('', 'solfege')).toBe('');
  });
});

describe('formatKeyName', () => {
  it('names keys in each language and system', () => {
    expect(formatKeyName('G', 'letters')).toBe('G major');
    expect(formatKeyName('Bb', 'letters')).toBe('B♭ major');
    setLocale('fa');
    expect(formatKeyName('G', 'solfege-fa')).toBe('سل ماژور');
    expect(formatKeyName('Bb', 'solfege-fa')).toBe('سی بمل ماژور');
  });
});

describe('selected system', () => {
  it('defaults by locale', () => {
    expect(defaultSystemFor('en')).toBe('letters');
    expect(defaultSystemFor('fa')).toBe('solfege-fa');
    expect(getNoteNameSystem()).toBe('letters');
    setLocale('fa');
    expect(getNoteNameSystem()).toBe('solfege-fa');
  });

  it('an explicit choice wins over the locale default and persists', () => {
    setNoteNameSystem('solfege');
    setLocale('fa');
    expect(getNoteNameSystem()).toBe('solfege');
    expect(localStorage.getItem('ui.noteNames')).toBe('solfege');
    setNoteNameSystem(null);
    expect(getNoteNameSystem()).toBe('solfege-fa');
    expect(localStorage.getItem('ui.noteNames')).toBeNull();
  });

  it('loadNoteNameSystem restores a stored choice and ignores junk', () => {
    localStorage.setItem('ui.noteNames', 'solfege');
    loadNoteNameSystem();
    expect(getNoteNameSystem()).toBe('solfege');
    localStorage.setItem('ui.noteNames', 'nonsense');
    loadNoteNameSystem();
    expect(getNoteNameSystem()).toBe('letters');
  });

  it('notifies on a system change and on a locale change', () => {
    const fn = vi.fn();
    const off = onNoteNamesChange(fn);
    setNoteNameSystem('solfege');
    expect(fn).toHaveBeenLastCalledWith('solfege');
    setNoteNameSystem(null);
    setLocale('fa');
    expect(fn).toHaveBeenLastCalledWith('solfege-fa');
    off();
  });

  it('isNoteNameSystem validates', () => {
    for (const s of NOTE_NAME_SYSTEMS) expect(isNoteNameSystem(s)).toBe(true);
    expect(isNoteNameSystem('x')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run src/__tests__/noteNames.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Add the `key.major` message to both dictionaries**

In `en.ts` add `'key.major': '{tonic} major',` and in `fa.ts` add `'key.major': '{tonic} ماژور',`.

- [ ] **Step 4: Implement** `src/i18n/noteNames.ts`

```ts
import { getLocale, onLocaleChange, t, type Locale } from './index';
import { EventEmitter } from '../core/events';

export type NoteNameSystem = 'letters' | 'solfege' | 'solfege-fa';
export const NOTE_NAME_SYSTEMS: readonly NoteNameSystem[] = ['letters', 'solfege', 'solfege-fa'];

const STORAGE_KEY = 'ui.noteNames';

const STEP_NAMES: Record<NoteNameSystem, Record<string, string>> = {
  letters: { C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', A: 'A', B: 'B' },
  solfege: { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' },
  'solfege-fa': { C: 'دو', D: 'ر', E: 'می', F: 'فا', G: 'سل', A: 'لا', B: 'سی' },
};

const ACCIDENTALS: Record<NoteNameSystem, { sharp: string; flat: string }> = {
  letters: { sharp: '♯', flat: '♭' },
  solfege: { sharp: '♯', flat: '♭' },
  'solfege-fa': { sharp: ' دیز', flat: ' بمل' },
};

let chosen: NoteNameSystem | null = null;
const changes = new EventEmitter<NoteNameSystem>();

export function isNoteNameSystem(value: unknown): value is NoteNameSystem {
  return typeof value === 'string' && (NOTE_NAME_SYSTEMS as readonly string[]).includes(value);
}

export function defaultSystemFor(locale: Locale): NoteNameSystem {
  return locale === 'fa' ? 'solfege-fa' : 'letters';
}

export function getNoteNameSystem(): NoteNameSystem {
  return chosen ?? defaultSystemFor(getLocale());
}

export function setNoteNameSystem(system: NoteNameSystem | null): void {
  chosen = system;
  try {
    if (system) localStorage.setItem(STORAGE_KEY, system);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable
  }
  changes.emit(getNoteNameSystem());
}

export function loadNoteNameSystem(): void {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  chosen = isNoteNameSystem(stored) ? stored : null;
}

export function onNoteNamesChange(fn: (system: NoteNameSystem) => void): () => void {
  return changes.on(fn);
}

onLocaleChange(() => changes.emit(getNoteNameSystem()));

export function formatNoteName(
  note: string,
  system: NoteNameSystem,
  options: { octave?: boolean } = {}
): string {
  const match = /^([A-Ga-g])([#b♯♭]?)(-?\d+)?$/.exec(note.trim());
  if (!match) return note;
  const step = match[1].toUpperCase();
  const accidental = match[2];
  let name = STEP_NAMES[system][step];
  if (accidental === '#' || accidental === '♯') name += ACCIDENTALS[system].sharp;
  else if (accidental === 'b' || accidental === '♭') name += ACCIDENTALS[system].flat;
  if (options.octave && match[3] !== undefined) name += match[3];
  return name;
}

export function formatKeyName(keyId: string, system: NoteNameSystem = getNoteNameSystem()): string {
  return t('key.major', { tonic: formatNoteName(keyId, system) });
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/__tests__/noteNames.test.ts src/__tests__/i18n.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/i18n src/__tests__/noteNames.test.ts
git commit -m "feat(i18n): note-name systems (letters, solfege, Persian solfege)"
```

---

### Task 3: Translate the existing interface and wire language and note-name selectors

**Files:**
- Modify: `src/i18n/locales/en.ts`, `src/i18n/locales/fa.ts`, `index.html`, `src/main.ts`
- Create: `src/lessonText.ts`
- Test: `src/__tests__/lessonText.test.ts`, existing `i18n.test.ts` (parity covers the new keys)

**Interfaces:**
- Consumes: Task 1 and Task 2 APIs.
- Produces: `keyIdForLevel(level: number): string`; `describeLesson(level: number, subLevel: number, system?: NoteNameSystem): string`.

- [ ] **Step 1: Write the failing lesson-text test** (`src/__tests__/lessonText.test.ts`)

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/__tests__/lessonText.test.ts`
Expected: FAIL (module `../lessonText` not found).

- [ ] **Step 3: Replace both dictionaries with the full set**

`src/i18n/locales/en.ts` becomes (keep `as const` and the `MessageKey` export):

```ts
export const en = {
  // App
  'app.title': 'Sight Reading',
  'app.documentTitle': 'Sight Reading Practice',
  'notation.aria': 'Music notation for sight reading practice',
  'celebration.complete': 'Complete!',

  // Control bar
  'control.start': 'Start',
  'control.stop': 'Stop',
  'control.tempo': 'Tempo',
  'control.bpm': 'BPM',
  'control.prevLevel': 'Previous level',
  'control.nextLevel': 'Next level',
  'control.level': 'Level {level}',
  'control.toggleFingering': 'Toggle fingering',
  'control.toggleMetronome': 'Toggle metronome',
  'control.uploadFile': 'Upload MusicXML file',
  'control.options': 'Options',

  // Options panel
  'options.title': 'Options',
  'options.close': 'Close options',
  'options.playback': 'Playback',
  'options.masterVolume': 'Master Volume',
  'options.metronome': 'Metronome',
  'options.metronomeVolume': 'Metronome Volume',
  'options.jumpToLevel': 'Jump to Level',
  'options.jumpToLevelAria': 'Jump to level',
  'options.practiceKey': 'Practice Key',
  'options.practiceKeyAria': 'Select practice key',
  'options.keyDefault': 'Use level default',
  'options.learningAids': 'Learning Aids',
  'options.showFingering': 'Show Fingering',
  'options.showNoteNames': 'Show note names on the staff',
  'options.practiceSongs': 'Practice Songs',
  'options.songAria': 'Select a song to practice',
  'options.chooseSong': 'Choose a song...',
  'options.songsBeginner': 'Beginner',
  'options.songsEasy': 'Easy',
  'options.orUploadFile': 'Or upload file',
  'options.returnToLevels': 'Return to Levels',
  'options.midiInput': 'MIDI Input',
  'options.midiInputAria': 'Select MIDI input device',
  'options.viewOnGithub': 'View on GitHub',
  'options.language': 'Language',
  'options.persianDigits': 'Persian digits',
  'options.noteNames': 'Note names',
  'noteSystem.letters': 'Letters (C D E)',
  'noteSystem.solfege': 'Solfège (Do Re Mi)',
  'noteSystem.solfegeFa': 'Persian solfège (دو ر می)',
  'midi.none': 'No MIDI Device',

  // Level jump list (levels 1 to 10; 11+ are built from key names)
  'levelJump.1': 'Level 1 — Whole notes (RH)',
  'levelJump.2': 'Level 2 — Whole notes (LH)',
  'levelJump.3': 'Level 3 — Whole notes (Both)',
  'levelJump.4': 'Level 4 — Half notes',
  'levelJump.5': 'Level 5 — Quarter notes',
  'levelJump.6': 'Level 6 — Rests & 3/4',
  'levelJump.7': 'Level 7 — Dotted rhythms',
  'levelJump.8': 'Level 8 — Eighth notes',
  'levelJump.9': 'Level 9 — Dotted eighths',
  'levelJump.10': 'Level 10 — Sixteenths',
  'levelJump.key': 'Level {n} — {key}',

  // Songs
  'song.maryLamb': 'Mary Had a Little Lamb',
  'song.twinkle': 'Twinkle Twinkle Little Star',
  'song.odeToJoy': 'Ode to Joy (Beethoven)',
  'song.happyBirthday': 'Happy Birthday',
  'song.minuetG': 'Minuet in G (Bach)',

  // Progress and practice mode
  'progress.moreToAdvance': '{n} more to advance',
  'progress.readyTempo': 'Ready to increase tempo!',
  'progress.atTempo': '{n} at tempo',
  'progress.complete': 'Complete! Use ← to review.',
  'practice.stepType.single': 'Learning',
  'practice.stepType.pair': 'Connecting',
  'practice.stepType.consolidate': 'Consolidating',
  'practice.measure': 'Measure {n}',
  'practice.measures': 'Measures {from}-{to}',
  'practice.stepOf': 'Step {current} of {total}',
  'error.noMeasures': 'No measures found in the uploaded file.',
  'error.parse': 'Error parsing file. Please ensure it is a valid {type} file.',

  // Keys
  'key.major': '{tonic} major',

  // Lesson descriptions (levels 1 to 10). {C} {E} {G} follow the note-name system.
  'lesson.1a': '{C} and {G} — whole notes (RH)',
  'lesson.1b': '{C}, {E}, {G} triad — whole notes (RH)',
  'lesson.1c': '{C} through {G} — whole notes (RH)',
  'lesson.1d': 'Stepwise — whole notes (RH)',
  'lesson.2a': '{C} and {G} — whole notes (LH)',
  'lesson.2b': '{C}, {E}, {G} triad — whole notes (LH)',
  'lesson.2c': '{C} through {G} — whole notes (LH)',
  'lesson.2d': 'Stepwise — whole notes (LH)',
  'lesson.3a': 'Simple coordination — whole notes',
  'lesson.3b': 'Triad patterns — whole notes',
  'lesson.3c': 'Stepwise — whole notes',
  'lesson.3d': 'Full patterns — whole notes',
  'lesson.4a': 'Half notes (RH)',
  'lesson.4b': 'Half notes (LH)',
  'lesson.4c': 'Whole and half notes (RH)',
  'lesson.4d': 'Whole and half notes — both hands',
  'lesson.5a': 'Quarter notes — stepwise (RH)',
  'lesson.5b': 'Quarter notes — stepwise (LH)',
  'lesson.5c': 'Quarter and half notes (RH)',
  'lesson.5d': 'Quarter notes — both hands',
  'lesson.6a': 'Quarter rests (RH)',
  'lesson.6b': 'Quarter rests (LH)',
  'lesson.6c': '3/4 time signature (RH)',
  'lesson.6d': '3/4 time — both hands',
  'lesson.7a': 'Dotted half notes (RH)',
  'lesson.7b': 'Dotted half notes (LH)',
  'lesson.7c': 'Wider intervals — 6ths (RH)',
  'lesson.7d': 'Full range — both hands',
  'lesson.8a': 'Eighth notes — stepwise (RH)',
  'lesson.8b': 'Eighth notes — stepwise (LH)',
  'lesson.8c': 'Eighth and quarter notes (RH)',
  'lesson.8d': 'Eighth notes — both hands',
  'lesson.9a': 'Dotted eighth rhythms (RH)',
  'lesson.9b': 'Dotted eighth rhythms (LH)',
  'lesson.9c': 'Syncopated patterns (RH)',
  'lesson.9d': 'Dotted eighths — both hands',
  'lesson.10a': 'Sixteenth notes — stepwise (RH)',
  'lesson.10b': 'Sixteenth notes — stepwise (LH)',
  'lesson.10c': 'Mixed rhythms (RH)',
  'lesson.10d': 'Sixteenth notes — both hands',
  // Levels 11+: one template per sub-level
  'lesson.key.0': '{key} — whole notes (RH)',
  'lesson.key.1': '{key} — whole notes (LH)',
  'lesson.key.2': '{key} — quarter notes (RH)',
  'lesson.key.3': '{key} — both hands',
} as const;

export type MessageKey = keyof typeof en;
```

`src/i18n/locales/fa.ts`:

```ts
import type { MessageKey } from './en';

export const fa: Record<MessageKey, string> = {
  // App
  'app.title': 'نت‌خوانی',
  'app.documentTitle': 'تمرین نت‌خوانی',
  'notation.aria': 'نت‌نویسی موسیقی برای تمرین نت‌خوانی',
  'celebration.complete': 'تمام شد!',

  // Control bar
  'control.start': 'شروع',
  'control.stop': 'توقف',
  'control.tempo': 'سرعت',
  'control.bpm': 'BPM',
  'control.prevLevel': 'سطح قبلی',
  'control.nextLevel': 'سطح بعدی',
  'control.level': 'سطح {level}',
  'control.toggleFingering': 'نمایش یا پنهان‌کردن انگشت‌گذاری',
  'control.toggleMetronome': 'روشن یا خاموش‌کردن مترونوم',
  'control.uploadFile': 'بارگذاری فایل MusicXML',
  'control.options': 'تنظیمات',

  // Options panel
  'options.title': 'تنظیمات',
  'options.close': 'بستن تنظیمات',
  'options.playback': 'پخش',
  'options.masterVolume': 'صدای کل',
  'options.metronome': 'مترونوم',
  'options.metronomeVolume': 'صدای مترونوم',
  'options.jumpToLevel': 'رفتن به سطح',
  'options.jumpToLevelAria': 'رفتن به سطح',
  'options.practiceKey': 'گام تمرین',
  'options.practiceKeyAria': 'انتخاب گام تمرین',
  'options.keyDefault': 'پیش‌فرض سطح',
  'options.learningAids': 'کمک‌های یادگیری',
  'options.showFingering': 'نمایش انگشت‌گذاری',
  'options.showNoteNames': 'نمایش نام نت‌ها روی حامل',
  'options.practiceSongs': 'آهنگ‌های تمرینی',
  'options.songAria': 'انتخاب آهنگ برای تمرین',
  'options.chooseSong': 'یک آهنگ انتخاب کنید…',
  'options.songsBeginner': 'مبتدی',
  'options.songsEasy': 'آسان',
  'options.orUploadFile': 'یا فایل بارگذاری کنید',
  'options.returnToLevels': 'بازگشت به سطح‌ها',
  'options.midiInput': 'ورودی MIDI',
  'options.midiInputAria': 'انتخاب دستگاه ورودی MIDI',
  'options.viewOnGithub': 'مشاهده در GitHub',
  'options.language': 'زبان',
  'options.persianDigits': 'ارقام فارسی',
  'options.noteNames': 'نام نت‌ها',
  'noteSystem.letters': 'حرفی (C D E)',
  'noteSystem.solfege': 'سولفژ لاتین (Do Re Mi)',
  'noteSystem.solfegeFa': 'سولفژ فارسی (دو ر می)',
  'midi.none': 'دستگاه MIDI وصل نیست',

  // Level jump list
  'levelJump.1': 'سطح ۱: نت گرد (دست راست)',
  'levelJump.2': 'سطح ۲: نت گرد (دست چپ)',
  'levelJump.3': 'سطح ۳: نت گرد (هر دو دست)',
  'levelJump.4': 'سطح ۴: نت سفید',
  'levelJump.5': 'سطح ۵: نت سیاه',
  'levelJump.6': 'سطح ۶: سکوت و میزان ۳/۴',
  'levelJump.7': 'سطح ۷: ریتم‌های نقطه‌دار',
  'levelJump.8': 'سطح ۸: نت چنگ',
  'levelJump.9': 'سطح ۹: چنگ نقطه‌دار',
  'levelJump.10': 'سطح ۱۰: نت دولا چنگ',
  'levelJump.key': 'سطح {n}: {key}',

  // Songs
  'song.maryLamb': 'مری یک بره‌ی کوچک داشت',
  'song.twinkle': 'ستاره‌ی کوچک بدرخش',
  'song.odeToJoy': 'سرود شادی (بتهوون)',
  'song.happyBirthday': 'تولدت مبارک',
  'song.minuetG': 'مینوئت در سل (باخ)',

  // Progress and practice mode
  'progress.moreToAdvance': '{n} تکرار دیگر تا مرحله‌ی بعد',
  'progress.readyTempo': 'آماده‌ی افزایش سرعت!',
  'progress.atTempo': '{n} بار در این سرعت',
  'progress.complete': 'تمام شد! برای مرور از کلید ← استفاده کنید.',
  'practice.stepType.single': 'یادگیری',
  'practice.stepType.pair': 'اتصال',
  'practice.stepType.consolidate': 'تثبیت',
  'practice.measure': 'میزان {n}',
  'practice.measures': 'میزان‌های {from} تا {to}',
  'practice.stepOf': 'مرحله‌ی {current} از {total}',
  'error.noMeasures': 'در فایل بارگذاری‌شده هیچ میزانی پیدا نشد.',
  'error.parse': 'خطا در خواندن فایل. مطمئن شوید فایل {type} معتبر است.',

  // Keys
  'key.major': '{tonic} ماژور',

  // Lesson descriptions
  'lesson.1a': '{C} و {G}: نت گرد (دست راست)',
  'lesson.1b': 'سه‌گانه‌ی {C}، {E}، {G}: نت گرد (دست راست)',
  'lesson.1c': 'از {C} تا {G}: نت گرد (دست راست)',
  'lesson.1d': 'حرکت پله‌ای: نت گرد (دست راست)',
  'lesson.2a': '{C} و {G}: نت گرد (دست چپ)',
  'lesson.2b': 'سه‌گانه‌ی {C}، {E}، {G}: نت گرد (دست چپ)',
  'lesson.2c': 'از {C} تا {G}: نت گرد (دست چپ)',
  'lesson.2d': 'حرکت پله‌ای: نت گرد (دست چپ)',
  'lesson.3a': 'هماهنگی ساده: نت گرد',
  'lesson.3b': 'الگوهای سه‌گانه: نت گرد',
  'lesson.3c': 'حرکت پله‌ای: نت گرد',
  'lesson.3d': 'الگوهای کامل: نت گرد',
  'lesson.4a': 'نت سفید (دست راست)',
  'lesson.4b': 'نت سفید (دست چپ)',
  'lesson.4c': 'نت گرد و سفید (دست راست)',
  'lesson.4d': 'نت گرد و سفید: هر دو دست',
  'lesson.5a': 'نت سیاه، حرکت پله‌ای (دست راست)',
  'lesson.5b': 'نت سیاه، حرکت پله‌ای (دست چپ)',
  'lesson.5c': 'نت سیاه و سفید (دست راست)',
  'lesson.5d': 'نت سیاه: هر دو دست',
  'lesson.6a': 'سکوت سیاه (دست راست)',
  'lesson.6b': 'سکوت سیاه (دست چپ)',
  'lesson.6c': 'میزان ۳/۴ (دست راست)',
  'lesson.6d': 'میزان ۳/۴: هر دو دست',
  'lesson.7a': 'نت سفید نقطه‌دار (دست راست)',
  'lesson.7b': 'نت سفید نقطه‌دار (دست چپ)',
  'lesson.7c': 'فاصله‌های بزرگ‌تر: ششم (دست راست)',
  'lesson.7d': 'گستره‌ی کامل: هر دو دست',
  'lesson.8a': 'نت چنگ، حرکت پله‌ای (دست راست)',
  'lesson.8b': 'نت چنگ، حرکت پله‌ای (دست چپ)',
  'lesson.8c': 'نت چنگ و سیاه (دست راست)',
  'lesson.8d': 'نت چنگ: هر دو دست',
  'lesson.9a': 'ریتم چنگ نقطه‌دار (دست راست)',
  'lesson.9b': 'ریتم چنگ نقطه‌دار (دست چپ)',
  'lesson.9c': 'الگوهای سنکوپ (دست راست)',
  'lesson.9d': 'چنگ نقطه‌دار: هر دو دست',
  'lesson.10a': 'نت دولا چنگ، حرکت پله‌ای (دست راست)',
  'lesson.10b': 'نت دولا چنگ، حرکت پله‌ای (دست چپ)',
  'lesson.10c': 'ریتم‌های ترکیبی (دست راست)',
  'lesson.10d': 'نت دولا چنگ: هر دو دست',
  'lesson.key.0': '{key}: نت گرد (دست راست)',
  'lesson.key.1': '{key}: نت گرد (دست چپ)',
  'lesson.key.2': '{key}: نت سیاه (دست راست)',
  'lesson.key.3': '{key}: هر دو دست',
};
```

- [ ] **Step 4: Implement** `src/lessonText.ts`

```ts
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
```

- [ ] **Step 5: Run the unit tests**

Run: `npm test`
Expected: PASS (190 upstream tests plus the new ones). If `lessonText.test.ts` fails on the generator agreement check, read `getKeyForLevel` in `src/musicGenerator.ts` and align `KEY_PROGRESSION`.

- [ ] **Step 6: Mark up `index.html`**

Make these replacements (every Persian-visible string gets `data-i18n` or `data-i18n-attr`; the English text stays as the fallback):

1. `<title>Sight Reading Practice</title>` becomes `<title data-i18n="app.documentTitle">Sight Reading Practice</title>`.
2. Leave `<h1>Sight Reading</h1>` without `data-i18n`: in practice mode the heading shows the song title, so `main.ts` sets it only in levels mode (Step 7f).
3. `<div class="celebration-text">Complete!</div>` becomes `<div class="celebration-text" data-i18n="celebration.complete">Complete!</div>`.
4. `aria-label="Music notation for sight reading practice"` on `#notation` becomes `data-i18n-attr="aria-label:notation.aria"` added next to the existing attribute.
5. Control bar: add `data-i18n-attr="aria-label:control.start"` to `#playPause`; `data-i18n="control.tempo"` on the Tempo `<label>`; `data-i18n="control.bpm"` on `.tempo-unit`; `data-i18n-attr="aria-label:control.prevLevel"` on `#levelDown`; `data-i18n-attr="aria-label:control.nextLevel"` on `#levelUp`; `data-i18n-attr="aria-label:control.toggleFingering"` on `#fingeringToggle`; `data-i18n-attr="aria-label:control.toggleMetronome"` on `#metronomeToggle`; `data-i18n-attr="aria-label:control.uploadFile"` on the upload `<label>`; `data-i18n-attr="aria-label:control.options"` on `#optionsToggle`.
6. Replace the whole options panel (`<div id="optionsPanel" ...>` through its closing `</div>`) with:

```html
      <div id="optionsPanel" class="options-panel" hidden>
        <div class="options-header">
          <h2 data-i18n="options.title">Options</h2>
          <button id="optionsClose" class="close-btn" aria-label="Close options" data-i18n-attr="aria-label:options.close">×</button>
        </div>

        <div class="options-group">
          <h3 data-i18n="options.language">Language</h3>
          <div class="option-row">
            <select id="languageSelect" aria-label="Language" data-i18n-attr="aria-label:options.language">
              <option value="en">English</option>
              <option value="fa">فارسی</option>
            </select>
          </div>
          <label class="option-row" id="persianDigitsRow">
            <span data-i18n="options.persianDigits">Persian digits</span>
            <input type="checkbox" id="persianDigits" checked />
          </label>
        </div>

        <div class="options-group">
          <h3 data-i18n="options.noteNames">Note names</h3>
          <div class="option-row">
            <select id="noteNameSystem" aria-label="Note names" data-i18n-attr="aria-label:options.noteNames">
              <option value="letters" data-i18n="noteSystem.letters">Letters (C D E)</option>
              <option value="solfege" data-i18n="noteSystem.solfege">Solfège (Do Re Mi)</option>
              <option value="solfege-fa" data-i18n="noteSystem.solfegeFa">Persian solfège (دو ر می)</option>
            </select>
          </div>
        </div>

        <div class="options-group">
          <h3 data-i18n="options.playback">Playback</h3>
          <label class="option-row">
            <span data-i18n="options.masterVolume">Master Volume</span>
            <input type="range" id="masterVolume" min="0" max="100" value="80" />
          </label>
          <label class="option-row">
            <span data-i18n="options.metronome">Metronome</span>
            <input type="checkbox" id="metronome" checked />
          </label>
          <label class="option-row">
            <span data-i18n="options.metronomeVolume">Metronome Volume</span>
            <input type="range" id="metronomeVolume" min="0" max="100" value="50" />
          </label>
        </div>

        <div class="options-group">
          <h3 data-i18n="options.jumpToLevel">Jump to Level</h3>
          <div class="option-row level-jump">
            <select id="levelJump" aria-label="Jump to level" data-i18n-attr="aria-label:options.jumpToLevelAria"></select>
          </div>
        </div>

        <div class="options-group">
          <h3 data-i18n="options.practiceKey">Practice Key</h3>
          <div class="option-row">
            <select id="keySelect" aria-label="Select practice key" data-i18n-attr="aria-label:options.practiceKeyAria"></select>
          </div>
        </div>

        <div class="options-group">
          <h3 data-i18n="options.learningAids">Learning Aids</h3>
          <label class="option-row">
            <span data-i18n="options.showFingering">Show Fingering</span>
            <input type="checkbox" id="showFingering" />
          </label>
          <label class="option-row">
            <span data-i18n="options.showNoteNames">Show note names on the staff</span>
            <input type="checkbox" id="showNoteNames" />
          </label>
        </div>

        <div class="options-group">
          <h3 data-i18n="options.practiceSongs">Practice Songs</h3>
          <div class="option-row">
            <select id="songSelect" aria-label="Select a song to practice" data-i18n-attr="aria-label:options.songAria">
              <option value="" data-i18n="options.chooseSong">Choose a song...</option>
              <optgroup label="Beginner" data-i18n-attr="label:options.songsBeginner">
                <option value="mary-lamb" data-i18n="song.maryLamb">Mary Had a Little Lamb</option>
                <option value="twinkle" data-i18n="song.twinkle">Twinkle Twinkle Little Star</option>
                <option value="ode-to-joy" data-i18n="song.odeToJoy">Ode to Joy (Beethoven)</option>
              </optgroup>
              <optgroup label="Easy" data-i18n-attr="label:options.songsEasy">
                <option value="happy-birthday" data-i18n="song.happyBirthday">Happy Birthday</option>
                <option value="minuet-g" data-i18n="song.minuetG">Minuet in G (Bach)</option>
              </optgroup>
            </select>
          </div>
          <div class="option-row">
            <label class="file-upload-label" for="xmlUploadOptions">
              <span data-i18n="options.orUploadFile">Or upload file</span>
              <span class="upload-hint">.xml, .musicxml, .mxl, .mid</span>
            </label>
            <input type="file" id="xmlUploadOptions" accept=".xml,.musicxml,.mxl,.mid,.midi" />
          </div>
          <button id="exitPracticeMode" class="exit-practice-btn" data-i18n="options.returnToLevels" hidden>
            Return to Levels
          </button>
        </div>

        <div class="options-group midi-options">
          <h3 data-i18n="options.midiInput">MIDI Input</h3>
          <select id="midiInput" aria-label="Select MIDI input device" data-i18n-attr="aria-label:options.midiInputAria">
            <option value="" data-i18n="midi.none">No MIDI Device</option>
          </select>
        </div>

        <div class="options-footer">
          <a href="https://github.com/ftrain/sightreading" target="_blank" rel="noopener" class="github-link">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            <span data-i18n="options.viewOnGithub">View on GitHub</span>
          </a>
        </div>
      </div>
```

The level-jump and practice-key selects are now filled in code (Step 7) so their labels can follow the note-name system.

- [ ] **Step 7: Wire `src/main.ts`**

7a. Add imports after `import { getSongById } from './songs';`:

```ts
import {
  t, initLocale, setLocale, getLocale, onLocaleChange, applyTranslations,
  formatNumber, setPersianDigits, usesPersianDigits, isLocale,
} from './i18n';
import {
  getNoteNameSystem, setNoteNameSystem, loadNoteNameSystem, onNoteNamesChange,
  formatKeyName, isNoteNameSystem,
} from './i18n/noteNames';
import { describeLesson, keyIdForLevel } from './lessonText';
import type { MessageKey } from './i18n';
```

7b. First lines of `async function init()`:

```ts
  initLocale();
  loadNoteNameSystem();
```

7c. Add these helpers above `function updateLevelDisplay()`:

```ts
function localizeLevel(levelString: string): string {
  return levelString.replace(/^\d+/, (n) => formatNumber(Number(n)));
}

function describeCurrentLesson(): string {
  const match = /^(\d+)([a-d])$/.exec(getFullLevelString());
  if (!match) return currentLessonDescription;
  return describeLesson(Number(match[1]), 'abcd'.indexOf(match[2]));
}

const KEY_IDS = ['C', 'G', 'F', 'D', 'Bb', 'A', 'Eb', 'E', 'Ab'];

function populateLevelJump() {
  const select = document.getElementById('levelJump') as HTMLSelectElement | null;
  if (!select) return;
  const previous = select.value || String(getLevel());
  select.innerHTML = '';
  for (let level = 1; level <= 18; level++) {
    const option = document.createElement('option');
    option.value = String(level);
    option.textContent =
      level <= 10
        ? t(`levelJump.${level}` as MessageKey)
        : t('levelJump.key', { n: level, key: formatKeyName(keyIdForLevel(level)) });
    select.appendChild(option);
  }
  select.value = previous;
}

function populateKeySelect() {
  const select = document.getElementById('keySelect') as HTMLSelectElement | null;
  if (!select) return;
  const previous = select.value;
  select.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = t('options.keyDefault');
  select.appendChild(defaultOption);
  for (const id of KEY_IDS) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = formatKeyName(id);
    select.appendChild(option);
  }
  select.value = previous;
}

function stepTypeLabel(type: 'single' | 'pair' | 'consolidate'): string {
  return t(`practice.stepType.${type}` as MessageKey);
}

function describeMeasures(measures: number[]): string {
  if (measures.length === 1) return t('practice.measure', { n: measures[0] });
  return t('practice.measures', { from: measures[0], to: measures[measures.length - 1] });
}
```

7d. In `updateLevelDisplay()` replace `const levelText = \`Level ${levelString}\`;` with `const levelText = t('control.level', { level: localizeLevel(levelString) });`, replace `levelDisplay.textContent = levelString;` with `levelDisplay.textContent = localizeLevel(levelString);`, replace `lessonInfo.textContent = currentLessonDescription;` with `lessonInfo.textContent = describeCurrentLesson();`, and replace the progress text block with:

```ts
    let progressText = '';
    if (remaining > 0) {
      progressText = t('progress.moreToAdvance', { n: remaining });
    }

    if (shouldIncreaseTempo()) {
      progressText += progressText ? ' | ' : '';
      progressText += t('progress.readyTempo');
    } else if (tempoMasteryRemaining > 0 && remaining === 0) {
      progressText += progressText ? ' | ' : '';
      progressText += t('progress.atTempo', { n: tempoMasteryRemaining });
    }
```

7e. Other literals (use `Grep` for each, then `Edit`):
- `midiSelect.innerHTML = '<option value="">No MIDI Device</option>';` becomes (DOM methods, no `innerHTML`):

```ts
    const noneOption = document.createElement('option');
    noneOption.value = '';
    noneOption.dataset.i18n = 'midi.none';
    noneOption.textContent = t('midi.none');
    midiSelect.replaceChildren(noneOption);
```
- `playPauseBtn.setAttribute('aria-label', 'Stop')` becomes `... t('control.stop')`; `'Start'` becomes `t('control.start')`.
- `progressInfo.textContent = 'Complete! Use ← to review.';` becomes `progressInfo.textContent = t('progress.complete');`
- `alert('No measures found in the uploaded file.');` becomes `alert(t('error.noMeasures'));`
- ``alert(`Error parsing file. Please ensure it is a valid ${fileTypes} file.`);`` becomes `alert(t('error.parse', { type: fileTypes }));`
- `scoreTitle.textContent = 'Sight Reading';` becomes `scoreTitle.textContent = t('app.title');`
- At the practice-mode label sites (search `getStepTypeLabel(` and `Step ${`): `getStepTypeLabel(x)` becomes `stepTypeLabel(x)`, ``\`Step ${a} of ${b}\` `` becomes `t('practice.stepOf', { current: a, total: b })`, and `segment.description` / `getStepDescription(step)` become `describeMeasures(<the step's measures array>)`. Keep `getStepTypeLabel`/`getStepDescription` exported from `upload/` unchanged (their tests stay valid).

7f. At the end of `setupControls()` (before its closing brace) add:

```ts
  // Language, digits and note-name selectors
  const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement;
  const persianDigitsInput = document.getElementById('persianDigits') as HTMLInputElement;
  const persianDigitsRow = document.getElementById('persianDigitsRow') as HTMLElement;
  const noteSystemSelect = document.getElementById('noteNameSystem') as HTMLSelectElement;

  persianDigitsInput.checked = localStorage.getItem('ui.persianDigits') !== '0';

  const syncLanguageControls = () => {
    languageSelect.value = getLocale();
    persianDigitsRow.hidden = getLocale() !== 'fa';
    noteSystemSelect.value = getNoteNameSystem();
  };

  languageSelect.addEventListener('change', () => {
    if (isLocale(languageSelect.value)) setLocale(languageSelect.value);
  });
  persianDigitsInput.addEventListener('change', () => setPersianDigits(persianDigitsInput.checked));
  noteSystemSelect.addEventListener('change', () => {
    if (isNoteNameSystem(noteSystemSelect.value)) setNoteNameSystem(noteSystemSelect.value);
  });

  const refreshTexts = () => {
    applyTranslations();
    populateLevelJump();
    populateKeySelect();
    // Practice mode shows the song's own title and key; only levels mode uses translated headings
    if (currentMode === 'levels') {
      const scoreTitle = document.querySelector('.score-title h1');
      if (scoreTitle) scoreTitle.textContent = t('app.title');
      updateLevelDisplay();
    }
    syncLanguageControls();
  };
  onLocaleChange(refreshTexts);
  onNoteNamesChange(refreshTexts);
  refreshTexts();
```

`usesPersianDigits` is not needed in `main.ts`; drop it from the Step 7a import list if `tsc` reports it unused.

- [ ] **Step 8: Run unit tests, typecheck and build**

```bash
npm test
npx tsc --noEmit
npm run build
```
Expected: all PASS.

- [ ] **Step 9: Check in the browser**

Start `npm run dev`, open `http://localhost:5173/sightreading/`, open Options, and verify: the page is unchanged in English; choosing فارسی switches every label to Persian, sets `dir="rtl"`, changes the level subtitle (e.g. «دو و سل: نت گرد (دست راست)»); choosing "Solfège" in English changes the subtitle to «Do and Sol — whole notes (RH)»; reload keeps both choices.

- [ ] **Step 10: Run the Persian text through the editor tools, then commit**

Extract the Persian values to a temporary markdown file and lint it (do not run the cleanup tool on `fa.ts` itself):

```bash
node -e "const s=require('fs').readFileSync('src/i18n/locales/fa.ts','utf8');const v=[...s.matchAll(/: '(.*)',?\r?\n/g)].map(m=>m[1]);require('fs').writeFileSync(process.env.TEMP+'/fa-values.md',v.join('\n\n'))"
python C:\Users\hesam\.claude\skills\persian-writing\scripts\fa_lint.py --check %TEMP%\fa-values.md
```
Fix every reported issue by hand in `fa.ts`, then:

```bash
npm test
git add -A
git commit -m "feat(i18n): translate the interface, add language and note-name selectors"
```

---

### Task 4: Persian font and right-to-left styling

**Files:**
- Create: `public/fonts/Vazirmatn-Regular.ttf`, `Vazirmatn-Medium.ttf`, `Vazirmatn-SemiBold.ttf`, `public/fonts/README.md`
- Modify: `src/style.css` (append)

**Interfaces:** none (CSS only). Consumes `html[lang]` and `html[dir]` set by `setLocale()`.

- [ ] **Step 1: Copy the fonts and add the license note**

```powershell
New-Item -ItemType Directory -Force public/fonts | Out-Null
foreach ($w in 'Regular','Medium','SemiBold') { Copy-Item "C:\Users\hesam\.claude\skills\persian-writing\assets\fonts\Vazirmatn-$w.ttf" public/fonts/ }
```

`public/fonts/README.md`:

```markdown
# Fonts

Vazirmatn (Regular, Medium, SemiBold), by Saber Rastikerdar, licensed under the SIL Open Font License 1.1.
Source: https://github.com/rastikerdar/vazirmatn. Self-hosted so the app makes no font requests for Persian.
```

- [ ] **Step 2: Append the Persian and RTL rules to `src/style.css`**

```css
/* ============================================
   PERSIAN / RIGHT-TO-LEFT
   Only text and panels flip. The score and the keyboards stay left to right.
   ============================================ */
@font-face {
  font-family: 'Vazirmatn';
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  src: url('/fonts/Vazirmatn-Regular.ttf') format('truetype');
}

@font-face {
  font-family: 'Vazirmatn';
  font-weight: 500;
  font-style: normal;
  font-display: swap;
  src: url('/fonts/Vazirmatn-Medium.ttf') format('truetype');
}

@font-face {
  font-family: 'Vazirmatn';
  font-weight: 600;
  font-style: normal;
  font-display: swap;
  src: url('/fonts/Vazirmatn-SemiBold.ttf') format('truetype');
}

html[lang='fa'] {
  --font-sans: 'Vazirmatn', system-ui, sans-serif;
  --font-serif: 'Vazirmatn', system-ui, sans-serif;
}

/* Persian letters must stay joined: no letter-spacing, no forced capitals, no italics */
html[lang='fa'] *,
html[lang='fa'] *::before,
html[lang='fa'] *::after {
  letter-spacing: normal !important;
  text-transform: none !important;
}

html[lang='fa'] .lesson-subtitle,
html[lang='fa'] .theory-hint {
  font-style: normal;
}

/* Notation and keyboards always run left to right, in every language */
#notation,
#pianoDock,
.piano,
.learn-note,
.learn-answers {
  direction: ltr;
}

/* Arrows point the way the text reads */
html[dir='rtl'] .level-btn svg {
  transform: scaleX(-1);
}

/* Panels open on the side of the control bar button that opens them */
html[dir='rtl'] .options-panel {
  right: auto;
  left: var(--space-lg);
}

html[dir='rtl'] .fingering-panel {
  left: auto;
  right: var(--space-lg);
}
```

- [ ] **Step 3: Check in the browser**

With `npm run dev` running, open the app, switch to فارسی in Options. Verify with screenshots: (a) text is in Vazirmatn (run `document.fonts.check('16px Vazirmatn')` in the console, expect `true`); (b) the staff is not mirrored and notes still read left to right; (c) no spaced-out letters in the Options headings; (d) the options panel opens on the left; (e) switching back to English restores the original look exactly. If the font returns 404, change the URLs to `url('/sightreading/fonts/...')`.

- [ ] **Step 4: Build and commit**

```bash
npm run build
git add public/fonts src/style.css
git commit -m "feat(rtl): Vazirmatn font and right-to-left styling for Persian"
```

---

### Task 5: One input hub and the computer keyboard

**Files:**
- Create: `src/input/noteInput.ts`, `src/input/computerKeyboard.ts`
- Modify: `src/main.ts`
- Test: `src/__tests__/noteInput.test.ts`, `src/__tests__/computerKeyboard.test.ts`

**Interfaces:**
- Produces: `type NoteSource = 'midi' | 'screen' | 'computer' | 'microphone'`; `interface NoteInputEvent { noteName: string; source: NoteSource }`;
  `class NoteInputHub { onNoteOn: EventEmitter<NoteInputEvent>; onNoteOff: EventEmitter<NoteInputEvent>; noteOn(name: string, source: NoteSource): void; noteOff(name: string, source: NoteSource): void }`; `const noteInput: NoteInputHub`;
  `KEY_SEMITONES`, `DEFAULT_OCTAVE = 4`, `MIN_OCTAVE = 1`, `MAX_OCTAVE = 6`, `codeToNoteName(code: string, baseOctave: number): string | null`, `keyHints(baseOctave: number): Record<string, string>`;
  `class ComputerKeyboard { constructor(hub: NoteInputHub, target?: Document | HTMLElement, onOctaveChange?: (octave: number) => void); attach(): void; detach(): void; getOctave(): number; setOctave(octave: number): void }`.

- [ ] **Step 1: Write the failing tests**

`src/__tests__/noteInput.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { NoteInputHub } from '../input/noteInput';

describe('NoteInputHub', () => {
  it('delivers note on and off events with their source', () => {
    const hub = new NoteInputHub();
    const on = vi.fn();
    const off = vi.fn();
    hub.onNoteOn.on(on);
    hub.onNoteOff.on(off);
    hub.noteOn('C4', 'screen');
    hub.noteOff('C4', 'midi');
    expect(on).toHaveBeenCalledWith({ noteName: 'C4', source: 'screen' });
    expect(off).toHaveBeenCalledWith({ noteName: 'C4', source: 'midi' });
  });

  it('stops delivering after unsubscribe', () => {
    const hub = new NoteInputHub();
    const fn = vi.fn();
    const unsubscribe = hub.onNoteOn.on(fn);
    unsubscribe();
    hub.noteOn('D4', 'computer');
    expect(fn).not.toHaveBeenCalled();
  });
});
```

`src/__tests__/computerKeyboard.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NoteInputHub } from '../input/noteInput';
import {
  ComputerKeyboard, codeToNoteName, keyHints, DEFAULT_OCTAVE, MAX_OCTAVE, MIN_OCTAVE,
} from '../input/computerKeyboard';

function press(type: 'keydown' | 'keyup', code: string, init: KeyboardEventInit = {}, target: EventTarget = document) {
  target.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...init }));
}

describe('codeToNoteName', () => {
  it('maps the home row to white keys and the row above to black keys', () => {
    expect(codeToNoteName('KeyA', 4)).toBe('C4');
    expect(codeToNoteName('KeyW', 4)).toBe('C#4');
    expect(codeToNoteName('KeyS', 4)).toBe('D4');
    expect(codeToNoteName('KeyJ', 4)).toBe('B4');
    expect(codeToNoteName('KeyK', 4)).toBe('C5');
    expect(codeToNoteName('Quote', 4)).toBe('F5');
  });

  it('follows the base octave and ignores other keys', () => {
    expect(codeToNoteName('KeyA', 3)).toBe('C3');
    expect(codeToNoteName('KeyQ', 4)).toBeNull();
    expect(codeToNoteName('Space', 4)).toBeNull();
  });
});

describe('keyHints', () => {
  it('labels each note with the key that plays it', () => {
    const hints = keyHints(4);
    expect(hints['C4']).toBe('A');
    expect(hints['C#4']).toBe('W');
    expect(hints['E5']).toBe(';');
    expect(hints['F5']).toBe("'");
    expect(keyHints(5)['C5']).toBe('A');
  });
});

describe('ComputerKeyboard', () => {
  let hub: NoteInputHub;
  let keyboard: ComputerKeyboard;
  let octaves: number[];
  let events: string[];

  beforeEach(() => {
    hub = new NoteInputHub();
    events = [];
    octaves = [];
    hub.onNoteOn.on((e) => events.push(`on ${e.noteName} ${e.source}`));
    hub.onNoteOff.on((e) => events.push(`off ${e.noteName} ${e.source}`));
    keyboard = new ComputerKeyboard(hub, document, (o) => octaves.push(o));
    keyboard.attach();
  });

  afterEach(() => {
    keyboard.detach();
    document.body.innerHTML = '';
  });

  it('plays and releases a note', () => {
    press('keydown', 'KeyA');
    press('keyup', 'KeyA');
    expect(events).toEqual(['on C4 computer', 'off C4 computer']);
  });

  it('ignores key repeat', () => {
    press('keydown', 'KeyA');
    press('keydown', 'KeyA', { repeat: true });
    expect(events).toEqual(['on C4 computer']);
  });

  it('ignores shortcuts with Ctrl, Alt or Meta', () => {
    press('keydown', 'KeyA', { ctrlKey: true });
    press('keydown', 'KeyA', { metaKey: true });
    expect(events).toEqual([]);
  });

  it('ignores typing in form fields', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    press('keydown', 'KeyA', {}, input);
    expect(events).toEqual([]);
  });

  it('shifts the octave with Z and X and reports it', () => {
    press('keydown', 'KeyX');
    press('keydown', 'KeyA');
    expect(octaves).toEqual([DEFAULT_OCTAVE + 1]);
    expect(events).toEqual(['on C5 computer']);
    press('keydown', 'KeyZ');
    press('keydown', 'KeyZ');
    expect(keyboard.getOctave()).toBe(DEFAULT_OCTAVE - 1);
  });

  it('releases the note that was started even after an octave shift', () => {
    press('keydown', 'KeyA');
    press('keydown', 'KeyX');
    press('keyup', 'KeyA');
    expect(events).toEqual(['on C4 computer', 'off C4 computer']);
  });

  it('clamps the octave', () => {
    for (let i = 0; i < 10; i++) press('keydown', 'KeyX');
    expect(keyboard.getOctave()).toBe(MAX_OCTAVE);
    for (let i = 0; i < 10; i++) press('keydown', 'KeyZ');
    expect(keyboard.getOctave()).toBe(MIN_OCTAVE);
  });

  it('releases every held note when the window loses focus', () => {
    press('keydown', 'KeyA');
    press('keydown', 'KeyD');
    window.dispatchEvent(new Event('blur'));
    expect(events).toContain('off C4 computer');
    expect(events).toContain('off E4 computer');
  });

  it('stops listening after detach', () => {
    keyboard.detach();
    press('keydown', 'KeyA');
    expect(events).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/noteInput.test.ts src/__tests__/computerKeyboard.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement** `src/input/noteInput.ts`

```ts
import { EventEmitter } from '../core/events';

export type NoteSource = 'midi' | 'screen' | 'computer' | 'microphone';

export interface NoteInputEvent {
  noteName: string;
  source: NoteSource;
}

/** Every way of playing a note (MIDI, on-screen piano, computer keyboard, microphone) goes through here. */
export class NoteInputHub {
  readonly onNoteOn = new EventEmitter<NoteInputEvent>();
  readonly onNoteOff = new EventEmitter<NoteInputEvent>();

  noteOn(noteName: string, source: NoteSource): void {
    this.onNoteOn.emit({ noteName, source });
  }

  noteOff(noteName: string, source: NoteSource): void {
    this.onNoteOff.emit({ noteName, source });
  }
}

export const noteInput = new NoteInputHub();
```

`src/input/computerKeyboard.ts`:

```ts
import { midiToNoteName } from '../core/noteUtils';
import type { NoteInputHub } from './noteInput';

/** Semitones above C of the base octave, by physical key: white keys on the home row, black keys above. */
export const KEY_SEMITONES: Readonly<Record<string, number>> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7,
  KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15,
  Semicolon: 16, Quote: 17,
};

export const DEFAULT_OCTAVE = 4;
export const MIN_OCTAVE = 1;
export const MAX_OCTAVE = 6;

export function codeToNoteName(code: string, baseOctave: number): string | null {
  const semitone = KEY_SEMITONES[code];
  if (semitone === undefined) return null;
  return midiToNoteName((baseOctave + 1) * 12 + semitone);
}

const HINT_LABELS: Record<string, string> = { Semicolon: ';', Quote: "'" };

/** Note name to the printed key that plays it, for labelling the on-screen piano. */
export function keyHints(baseOctave: number): Record<string, string> {
  const hints: Record<string, string> = {};
  for (const code of Object.keys(KEY_SEMITONES)) {
    const name = codeToNoteName(code, baseOctave);
    if (name) hints[name] = HINT_LABELS[code] ?? code.replace('Key', '');
  }
  return hints;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target.isContentEditable;
}

/**
 * Plays notes from the computer keyboard. Uses the physical key (KeyboardEvent.code), so it works
 * with any layout, including a Persian one. Z and X move the octave down and up.
 */
export class ComputerKeyboard {
  private octave = DEFAULT_OCTAVE;
  private readonly held = new Map<string, string>();

  constructor(
    private readonly hub: NoteInputHub,
    private readonly target: Document | HTMLElement = document,
    private readonly onOctaveChange: (octave: number) => void = () => {}
  ) {}

  private readonly handleKeyDown = (event: Event): void => {
    const e = event as KeyboardEvent;
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || isTypingTarget(e.target)) return;
    if (e.code === 'KeyZ') {
      this.setOctave(this.octave - 1);
      return;
    }
    if (e.code === 'KeyX') {
      this.setOctave(this.octave + 1);
      return;
    }
    const noteName = codeToNoteName(e.code, this.octave);
    if (!noteName || this.held.has(e.code)) return;
    e.preventDefault();
    this.held.set(e.code, noteName);
    this.hub.noteOn(noteName, 'computer');
  };

  private readonly handleKeyUp = (event: Event): void => {
    const e = event as KeyboardEvent;
    const noteName = this.held.get(e.code);
    if (!noteName) return;
    this.held.delete(e.code);
    this.hub.noteOff(noteName, 'computer');
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

  getOctave(): number {
    return this.octave;
  }

  setOctave(octave: number): void {
    const clamped = Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, octave));
    if (clamped === this.octave) return;
    this.octave = clamped;
    this.onOctaveChange(clamped);
  }

  private releaseAll(): void {
    for (const noteName of this.held.values()) this.hub.noteOff(noteName, 'computer');
    this.held.clear();
  }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/__tests__/noteInput.test.ts src/__tests__/computerKeyboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Route MIDI through the hub and add sound for non-MIDI sources in `src/main.ts`**

5a. Imports: add

```ts
import { noteInput, type NoteSource } from './input/noteInput';
import { ComputerKeyboard } from './input/computerKeyboard';
```

5b. Replace `handleMIDIMessage` (the function at about line 731) with:

```ts
function handleMIDIMessage(event: MIDIMessageEvent) {
  const [status, noteNum, velocity] = event.data!;
  const command = status & 0xf0;

  if (command === 0x90 && velocity > 0) {
    noteInput.noteOn(midiNoteToName(noteNum), 'midi');
  } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
    noteInput.noteOff(midiNoteToName(noteNum), 'midi');
  }
}

// What used to happen inside handleMIDIMessage, now shared by every input source
function handleNoteOn(noteName: string) {
  activeNotes.add(noteName);
  checkNoteMatch(noteName);
}

function handleNoteOff(noteName: string) {
  activeNotes.delete(noteName);
}

// A MIDI keyboard makes its own sound; the on-screen piano and the computer keyboard use the app's piano.
function playUserNote(noteName: string, source: NoteSource) {
  if (source === 'midi') return;
  if (!sampler) {
    void initAudio();
    return;
  }
  if (sampler.loaded) sampler.triggerAttack(noteName);
}

function stopUserNote(noteName: string, source: NoteSource) {
  if (source === 'midi' || !sampler || !sampler.loaded) return;
  sampler.triggerRelease(noteName);
}
```

5c. Guard against loading the piano samples twice when two notes are pressed quickly. Rename the existing `async function initAudio()` to `async function loadAudio()` and add above it:

```ts
let audioInit: Promise<void> | null = null;
function initAudio(): Promise<void> {
  if (!audioInit) audioInit = loadAudio();
  return audioInit;
}
```

5d. In `init()`, right after `setupMIDI();` add:

```ts
  noteInput.onNoteOn.on(({ noteName, source }) => {
    handleNoteOn(noteName);
    playUserNote(noteName, source);
  });
  noteInput.onNoteOff.on(({ noteName, source }) => {
    handleNoteOff(noteName);
    stopUserNote(noteName, source);
  });
  new ComputerKeyboard(noteInput, document).attach();
```

5e. Check for key conflicts: `Grep` `ArrowLeft|ArrowRight|'KeyZ'|'KeyX'|e.key ===` in `src/main.ts`; if any other handler uses letter keys, restrict it or pick other keys.

- [ ] **Step 6: Verify, then commit**

```bash
npm test
npx tsc --noEmit
```
In the browser: press `A`, `S`, `D` with the metronome playing a level 1 exercise (Start); a correct note turns green exactly as it does with a MIDI keyboard, and you hear the piano after the first press (the samples load once). `Z`/`X` shift the octave.

```bash
git add src
git commit -m "feat(input): shared note-input hub and computer keyboard"
```

---

### Task 6: On-screen piano

**Files:**
- Create: `src/input/onScreenPiano.ts`
- Modify: `index.html`, `src/main.ts`, `src/style.css`, `src/i18n/locales/en.ts`, `fa.ts`
- Test: `src/__tests__/onScreenPiano.test.ts`

**Interfaces:**
- Consumes: `NoteInputHub`, `keyHints`, `ComputerKeyboard`, `formatNoteName`, `getNoteNameSystem`, `onNoteNamesChange`, `t`.
- Produces: `interface PianoKey { midi: number; noteName: string; isBlack: boolean; whiteIndex: number }`; `buildKeyLayout(startMidi: number, endMidi: number): PianoKey[]`;
  `class OnScreenPiano { readonly element: HTMLElement; constructor(hub: NoteInputHub, options?: { startMidi?: number; endMidi?: number; ariaLabel?: string }); setLabelFormatter(fn: (noteName: string) => string): void; setAriaLabel(text: string): void; setHints(hints: Record<string, string>): void; dispose(): void }`.

- [ ] **Step 1: Write the failing test** (`src/__tests__/onScreenPiano.test.ts`)

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { NoteInputHub } from '../input/noteInput';
import { OnScreenPiano, buildKeyLayout } from '../input/onScreenPiano';
import { formatNoteName } from '../i18n/noteNames';

function pointer(el: Element, type: 'pointerdown' | 'pointerup' | 'pointerleave') {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
}

describe('buildKeyLayout', () => {
  const layout = buildKeyLayout(48, 84);

  it('covers C3 to C6: 37 keys, 22 white', () => {
    expect(layout).toHaveLength(37);
    expect(layout.filter((k) => !k.isBlack)).toHaveLength(22);
  });

  it('indexes white keys and places black keys after the white key on their left', () => {
    const byName = Object.fromEntries(layout.map((k) => [k.noteName, k]));
    expect(byName['C3']).toMatchObject({ isBlack: false, whiteIndex: 0 });
    expect(byName['C#3']).toMatchObject({ isBlack: true, whiteIndex: 0 });
    expect(byName['D3']).toMatchObject({ isBlack: false, whiteIndex: 1 });
    expect(byName['B3']).toMatchObject({ isBlack: false, whiteIndex: 6 });
    expect(byName['C4']).toMatchObject({ isBlack: false, whiteIndex: 7 });
    expect(byName['C6']).toMatchObject({ isBlack: false, whiteIndex: 21 });
  });
});

describe('OnScreenPiano', () => {
  let hub: NoteInputHub;
  let piano: OnScreenPiano;
  let events: string[];

  const keyEl = (name: string) => piano.element.querySelector(`[data-note="${name}"]`) as HTMLElement;

  beforeEach(() => {
    hub = new NoteInputHub();
    events = [];
    hub.onNoteOn.on((e) => events.push(`on ${e.noteName} ${e.source}`));
    hub.onNoteOff.on((e) => events.push(`off ${e.noteName} ${e.source}`));
    piano = new OnScreenPiano(hub);
  });

  it('renders every key', () => {
    expect(piano.element.querySelectorAll('.piano-key')).toHaveLength(37);
    expect(piano.element.querySelectorAll('.piano-key.white')).toHaveLength(22);
  });

  it('emits note on and off from the pointer and marks the key pressed', () => {
    pointer(keyEl('E4'), 'pointerdown');
    expect(events).toEqual(['on E4 screen']);
    expect(keyEl('E4').classList.contains('pressed')).toBe(true);
    pointer(keyEl('E4'), 'pointerup');
    expect(events).toEqual(['on E4 screen', 'off E4 screen']);
    expect(keyEl('E4').classList.contains('pressed')).toBe(false);
  });

  it('releases the note when the pointer slides off the key', () => {
    pointer(keyEl('G4'), 'pointerdown');
    pointer(keyEl('G4'), 'pointerleave');
    expect(events).toEqual(['on G4 screen', 'off G4 screen']);
  });

  it('shows notes played from other sources', () => {
    hub.noteOn('F#3', 'midi');
    expect(keyEl('F#3').classList.contains('pressed')).toBe(true);
    hub.noteOff('F#3', 'midi');
    expect(keyEl('F#3').classList.contains('pressed')).toBe(false);
  });

  it('labels white keys with the formatter and marks the octave on every C', () => {
    piano.setLabelFormatter((n) => formatNoteName(n, 'solfege-fa'));
    expect(keyEl('C4').querySelector('.piano-key-label')!.textContent).toBe('دو');
    expect(keyEl('C4').querySelector('.piano-key-octave')!.textContent).toBe('4');
    expect(keyEl('D4').querySelector('.piano-key-octave')).toBeNull();
    expect(keyEl('C#4').querySelector('.piano-key-label')).toBeNull();
  });

  it('shows and clears computer-key hints', () => {
    piano.setHints({ C4: 'A', 'C#4': 'W' });
    expect(keyEl('C4').dataset.hint).toBe('A');
    expect(keyEl('C#4').dataset.hint).toBe('W');
    piano.setHints({});
    expect(keyEl('C4').dataset.hint).toBeUndefined();
  });

  it('stops reacting to the hub after dispose', () => {
    piano.dispose();
    hub.noteOn('C4', 'midi');
    expect(keyEl('C4').classList.contains('pressed')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/__tests__/onScreenPiano.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/input/onScreenPiano.ts`

```ts
import { midiToNoteName } from '../core/noteUtils';
import type { NoteInputHub } from './noteInput';

export interface PianoKey {
  midi: number;
  noteName: string;
  isBlack: boolean;
  /** White keys: their own index among white keys. Black keys: the white key on their left. */
  whiteIndex: number;
}

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

export function buildKeyLayout(startMidi: number, endMidi: number): PianoKey[] {
  const keys: PianoKey[] = [];
  let whiteCount = 0;
  for (let midi = startMidi; midi <= endMidi; midi++) {
    const isBlack = BLACK_PITCH_CLASSES.has(midi % 12);
    keys.push({
      midi,
      noteName: midiToNoteName(midi),
      isBlack,
      whiteIndex: isBlack ? whiteCount - 1 : whiteCount,
    });
    if (!isBlack) whiteCount++;
  }
  return keys;
}

export interface OnScreenPianoOptions {
  startMidi?: number;
  endMidi?: number;
  ariaLabel?: string;
}

export class OnScreenPiano {
  readonly element: HTMLElement;
  private readonly keyEls = new Map<string, HTMLElement>();
  private readonly labelEls = new Map<string, HTMLElement>();
  private readonly pointerNotes = new Map<number, string>();
  private readonly unsubscribe: Array<() => void>;

  constructor(private readonly hub: NoteInputHub, options: OnScreenPianoOptions = {}) {
    const layout = buildKeyLayout(options.startMidi ?? 48, options.endMidi ?? 84);
    const whiteCount = layout.filter((k) => !k.isBlack).length;

    this.element = document.createElement('div');
    this.element.className = 'piano';
    this.element.setAttribute('dir', 'ltr');
    this.element.setAttribute('role', 'group');
    this.element.style.setProperty('--white-keys', String(whiteCount));
    if (options.ariaLabel) this.element.setAttribute('aria-label', options.ariaLabel);

    for (const key of layout) this.element.appendChild(this.buildKey(key, whiteCount));

    this.unsubscribe = [
      hub.onNoteOn.on(({ noteName }) => this.setPressed(noteName, true)),
      hub.onNoteOff.on(({ noteName }) => this.setPressed(noteName, false)),
    ];
  }

  private buildKey(key: PianoKey, whiteCount: number): HTMLElement {
    const el = document.createElement('button');
    el.type = 'button';
    el.tabIndex = -1;
    el.className = `piano-key ${key.isBlack ? 'black' : 'white'}`;
    el.dataset.note = key.noteName;

    if (key.isBlack) {
      const width = (0.6 / whiteCount) * 100;
      el.style.width = `${width}%`;
      el.style.left = `${((key.whiteIndex + 1) / whiteCount) * 100 - width / 2}%`;
    } else {
      const label = document.createElement('span');
      label.className = 'piano-key-label';
      label.textContent = key.noteName.replace(/-?\d+$/, '');
      el.appendChild(label);
      this.labelEls.set(key.noteName, label);
      if (key.noteName.startsWith('C') && !key.noteName.startsWith('C#')) {
        const octave = document.createElement('span');
        octave.className = 'piano-key-octave';
        octave.textContent = key.noteName.replace(/^[A-G]#?/, '');
        el.appendChild(octave);
      }
    }

    el.addEventListener('pointerdown', (e) => this.handleDown(e as PointerEvent, key.noteName));
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
      el.addEventListener(type, (e) => this.handleUp(e as PointerEvent, key.noteName));
    }
    this.keyEls.set(key.noteName, el);
    return el;
  }

  private handleDown(event: PointerEvent, noteName: string): void {
    event.preventDefault();
    const id = event.pointerId ?? 0;
    this.pointerNotes.set(id, noteName);
    this.hub.noteOn(noteName, 'screen');
  }

  private handleUp(event: PointerEvent, noteName: string): void {
    const id = event.pointerId ?? 0;
    if (this.pointerNotes.get(id) !== noteName) return;
    this.pointerNotes.delete(id);
    this.hub.noteOff(noteName, 'screen');
  }

  private setPressed(noteName: string, pressed: boolean): void {
    this.keyEls.get(noteName)?.classList.toggle('pressed', pressed);
  }

  setLabelFormatter(fn: (noteName: string) => string): void {
    for (const [noteName, label] of this.labelEls) label.textContent = fn(noteName);
  }

  setAriaLabel(text: string): void {
    this.element.setAttribute('aria-label', text);
  }

  setHints(hints: Record<string, string>): void {
    for (const [noteName, el] of this.keyEls) {
      if (hints[noteName]) el.dataset.hint = hints[noteName];
      else delete el.dataset.hint;
    }
  }

  dispose(): void {
    for (const off of this.unsubscribe) off();
  }
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run src/__tests__/onScreenPiano.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the two messages to both dictionaries**

`en.ts`: `'control.togglePiano': 'Show or hide the piano keyboard',` and `'piano.label': 'Piano keyboard',`.
`fa.ts`: `'control.togglePiano': 'نمایش یا پنهان‌کردن پیانوی روی صفحه',` and `'piano.label': 'صفحه‌کلید پیانو',`.

- [ ] **Step 6: Markup, styles and wiring**

`index.html`: add this control section just before `<div class="control-section fingering">`:

```html
        <div class="control-section piano">
          <button id="pianoToggle" class="piano-btn" aria-label="Show or hide the piano keyboard" data-i18n-attr="aria-label:control.togglePiano" aria-pressed="false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M8 5v14M12 5v14M16 5v14"/></svg>
          </button>
        </div>
```

and, just before the `</div>` that closes `<div id="app">`:

```html
      <div id="pianoDock" class="piano-dock" hidden></div>
```

`src/style.css` (append):

```css
/* ============================================
   ON-SCREEN PIANO
   ============================================ */
.piano-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.piano-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
  border-color: rgba(255, 255, 255, 0.25);
}

.piano-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.piano-btn svg {
  width: 20px;
  height: 20px;
}

.piano-dock {
  position: fixed;
  left: 50%;
  bottom: 96px;
  transform: translateX(-50%);
  width: min(96vw, 980px);
  padding: var(--space-sm);
  background: var(--surface);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 45;
  overflow-x: auto;
}

.piano-dock[hidden] {
  display: none;
}

body.piano-open #musicStand {
  padding-bottom: 270px;
}

.piano {
  position: relative;
  display: flex;
  min-width: calc(var(--white-keys) * 34px);
  height: 130px;
  user-select: none;
  touch-action: none;
}

.piano-key {
  position: relative;
  padding: 0;
  border: 1px solid #222;
  cursor: pointer;
  font-family: var(--font-sans);
}

.piano-key.white {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  padding-bottom: 6px;
  background: #f6f3ee;
  border-radius: 0 0 5px 5px;
  color: #555;
}

.piano-key.black {
  position: absolute;
  top: 0;
  height: 62%;
  background: #1d1b19;
  border-radius: 0 0 4px 4px;
  z-index: 2;
}

.piano-key.white.pressed {
  background: var(--current);
}

.piano-key.black.pressed {
  background: var(--accent-light);
}

.piano-key-label {
  font-size: 0.7rem;
  pointer-events: none;
}

.piano-key-octave {
  font-size: 0.6rem;
  opacity: 0.6;
  pointer-events: none;
}

.piano-key[data-hint]::after {
  content: attr(data-hint);
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--accent);
  pointer-events: none;
}

.piano-key.black[data-hint]::after {
  color: var(--current);
}
```

`src/main.ts`: add imports and the setup function, and call it from `init()` right after the `ComputerKeyboard` line from Task 5. Replace that line with `setupPiano();`.

```ts
import { OnScreenPiano } from './input/onScreenPiano';
import { ComputerKeyboard, keyHints } from './input/computerKeyboard';
import { formatNoteName } from './i18n/noteNames';
```
(merge with the existing `ComputerKeyboard` import and the existing `noteNames` import).

```ts
function setupPiano() {
  const dock = document.getElementById('pianoDock')!;
  const toggle = document.getElementById('pianoToggle')!;
  const piano = new OnScreenPiano(noteInput, { ariaLabel: t('piano.label') });
  dock.appendChild(piano.element);

  const refresh = () => {
    piano.setLabelFormatter((name) => formatNoteName(name, getNoteNameSystem()));
    piano.setAriaLabel(t('piano.label'));
    piano.setHints(keyHints(keyboard.getOctave()));
  };
  const keyboard = new ComputerKeyboard(noteInput, document, refresh);
  keyboard.attach();
  onNoteNamesChange(refresh);
  refresh();

  const setOpen = (open: boolean) => {
    dock.hidden = !open;
    toggle.classList.toggle('active', open);
    toggle.setAttribute('aria-pressed', String(open));
    document.body.classList.toggle('piano-open', open);
    try {
      localStorage.setItem('ui.pianoOpen', open ? '1' : '0');
    } catch {
      // storage unavailable
    }
  };
  toggle.addEventListener('click', () => setOpen(dock.hidden));
  setOpen(localStorage.getItem('ui.pianoOpen') === '1');
}
```

- [ ] **Step 7: Verify in the browser, then commit**

```bash
npm test
npx tsc --noEmit
npm run build
```
In the browser: the piano button opens a dock above the control bar; clicking a key plays a note (after the first-press sample load) and, while an exercise runs, a correct key turns the notehead green. Letters (A, S, D…) show on keys and move when `Z`/`X` shift the octave. In Persian the keys are labelled دو ر می… and the keyboard itself is not mirrored. Resize to phone width: the dock scrolls sideways.

```bash
git add -A
git commit -m "feat(input): on-screen piano with key labels and computer-key hints"
```

---

### Task 7: Note names on the staff

**Files:**
- Create: `src/rendering/noteLabels.ts`
- Modify: `src/main.ts`, `src/style.css`
- Test: `src/__tests__/noteLabels.test.ts`

**Interfaces:**
- Consumes: `formatNoteName`, `getNoteNameSystem`, `onNoteNamesChange`; Verovio's `toolkit.getElementAttr(id)` (already used by `checkNoteMatch`).
- Produces: `readGlyphPosition(use: Element): { x: number; y: number } | null`; `addNoteLabels(root: ParentNode, resolveName: (noteEl: Element) => string | null, options?: { fontSize?: number; offsetX?: number; offsetY?: number }): number` (returns how many labels were added; always clears old labels first); `removeNoteLabels(root: ParentNode): void`.

- [ ] **Step 1: Write the failing test** (`src/__tests__/noteLabels.test.ts`)

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { addNoteLabels, removeNoteLabels, readGlyphPosition } from '../rendering/noteLabels';

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg">' +
  '<g class="note" id="n1"><g class="notehead"><use x="1000" y="2000"/></g></g>' +
  '<g class="note" id="n2"><g class="notehead"><use transform="translate(1500, 2500) scale(0.72, 0.72)"/></g></g>' +
  '<g class="note" id="n3"><g class="notehead"></g></g>' +
  '</svg>';

const names: Record<string, string> = { n1: 'Do', n2: 'Re♯', n3: 'Mi' };
const resolve = (el: Element) => names[el.id] ?? null;

let root: HTMLElement;

beforeEach(() => {
  root = document.createElement('div');
  root.innerHTML = SVG;
});

describe('readGlyphPosition', () => {
  it('reads x and y attributes', () => {
    const use = root.querySelector('#n1 use')!;
    expect(readGlyphPosition(use)).toEqual({ x: 1000, y: 2000 });
  });

  it('reads a translate() transform', () => {
    const use = root.querySelector('#n2 use')!;
    expect(readGlyphPosition(use)).toEqual({ x: 1500, y: 2500 });
  });

  it('returns null when there is no position', () => {
    expect(readGlyphPosition(document.createElementNS('http://www.w3.org/2000/svg', 'use'))).toBeNull();
  });
});

describe('addNoteLabels', () => {
  it('adds one label per note that has a name and a notehead', () => {
    const added = addNoteLabels(root, resolve);
    expect(added).toBe(2);
    const labels = root.querySelectorAll('text.note-label');
    expect(labels).toHaveLength(2);
    expect(labels[0].textContent).toBe('Do');
    expect(labels[0].getAttribute('x')).toBe('1135');
    expect(labels[0].getAttribute('y')).toBe('2420');
    expect(labels[1].textContent).toBe('Re♯');
  });

  it('does not duplicate labels when called again', () => {
    addNoteLabels(root, resolve);
    addNoteLabels(root, resolve);
    expect(root.querySelectorAll('text.note-label')).toHaveLength(2);
  });

  it('skips notes the resolver cannot name', () => {
    expect(addNoteLabels(root, () => null)).toBe(0);
  });

  it('removeNoteLabels clears them', () => {
    addNoteLabels(root, resolve);
    removeNoteLabels(root);
    expect(root.querySelectorAll('text.note-label')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/__tests__/noteLabels.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `src/rendering/noteLabels.ts`

```ts
const SVG_NS = 'http://www.w3.org/2000/svg';
const LABEL_CLASS = 'note-label';

export interface GlyphPosition {
  x: number;
  y: number;
}

/** Verovio writes a glyph position either as x/y attributes or as transform="translate(x, y)". */
export function readGlyphPosition(use: Element): GlyphPosition | null {
  const x = parseFloat(use.getAttribute('x') ?? '');
  const y = parseFloat(use.getAttribute('y') ?? '');
  if (!Number.isNaN(x) && !Number.isNaN(y)) return { x, y };
  const match = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/.exec(use.getAttribute('transform') ?? '');
  return match ? { x: parseFloat(match[1]), y: parseFloat(match[2]) } : null;
}

export function removeNoteLabels(root: ParentNode): void {
  root.querySelectorAll(`.${LABEL_CLASS}`).forEach((el) => el.remove());
}

export interface NoteLabelOptions {
  fontSize?: number;
  offsetX?: number;
  offsetY?: number;
}

/**
 * Writes a name under every notehead. Coordinates are in Verovio's SVG units
 * (a staff space is about 180 units), so the defaults sit just below the note.
 */
export function addNoteLabels(
  root: ParentNode,
  resolveName: (noteEl: Element) => string | null,
  options: NoteLabelOptions = {}
): number {
  const { fontSize = 280, offsetX = 135, offsetY = 420 } = options;
  removeNoteLabels(root);
  let added = 0;
  root.querySelectorAll('g.note').forEach((noteEl) => {
    const name = resolveName(noteEl);
    const glyph = noteEl.querySelector('.notehead use');
    if (!name || !glyph) return;
    const position = readGlyphPosition(glyph);
    if (!position) return;
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('class', LABEL_CLASS);
    text.setAttribute('x', String(position.x + offsetX));
    text.setAttribute('y', String(position.y + offsetY));
    text.setAttribute('font-size', String(fontSize));
    text.setAttribute('text-anchor', 'middle');
    text.textContent = name;
    noteEl.appendChild(text);
    added++;
  });
  return added;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/__tests__/noteLabels.test.ts`
Expected: PASS.

- [ ] **Step 5: Style and wire**

Append to `src/style.css`:

```css
.note-label {
  fill: var(--ink);
  font-family: var(--font-sans);
  font-weight: 600;
  paint-order: stroke;
  stroke: var(--paper);
  stroke-width: 60px;
  stroke-linejoin: round;
  pointer-events: none;
}
```

In `src/main.ts` add imports `import { addNoteLabels, removeNoteLabels } from './rendering/noteLabels';` (and `formatNoteName` is already imported from Task 6), then add:

```ts
let showNoteNames = localStorage.getItem('ui.showNoteNames') === '1';

function noteNameForElement(el: Element): string | null {
  const id = el.getAttribute('id');
  if (!id) return null;
  const attrs = toolkit.getElementAttr(id) as {
    pname?: string;
    accid?: string;
    'accid.ges'?: string;
  } | null;
  if (!attrs?.pname) return null;
  const accidental = attrs.accid ?? attrs['accid.ges'] ?? '';
  const sign = accidental === 's' ? '#' : accidental === 'f' ? 'b' : '';
  return formatNoteName(`${attrs.pname.toUpperCase()}${sign}`, getNoteNameSystem());
}

function refreshNoteLabels() {
  const notation = document.getElementById('notation');
  if (!notation) return;
  if (showNoteNames) addNoteLabels(notation, noteNameForElement);
  else removeNoteLabels(notation);
}
```

Call `refreshNoteLabels();` at the end of `renderCurrentMusic()` and `rerenderCurrentMusic()`, and after every other `notation.innerHTML = ...` render (run `Grep` for `renderToSVG` and `innerHTML = svg` to find them, including the practice-mode and scrolling paths). In `setupControls()` extend the Task 3 `refreshTexts` with `refreshNoteLabels();` and add:

```ts
  const showNoteNamesInput = document.getElementById('showNoteNames') as HTMLInputElement;
  showNoteNamesInput.checked = showNoteNames;
  showNoteNamesInput.addEventListener('change', () => {
    showNoteNames = showNoteNamesInput.checked;
    try {
      localStorage.setItem('ui.showNoteNames', showNoteNames ? '1' : '0');
    } catch {
      // storage unavailable
    }
    refreshNoteLabels();
  });
```

- [ ] **Step 6: Check in the browser**

Tick "Show note names on the staff" in Options. Labels appear under every notehead on level 1a (C and G). If they overlap staff lines badly, tune `offsetY`/`fontSize` (try 480 and 260). Go to level 11 (G major) and confirm the F's are named F♯ (if the sharp is missing, `accid.ges` is not provided: fall back to the key signature using the `keys` table in `musicGenerator.ts`). Switch to Persian and Solfège and check the labels change; reload keeps the setting. Highlighting (yellow current, green correct) still works with labels on.

- [ ] **Step 7: Commit**

```bash
npm test
npx tsc --noEmit
git add -A
git commit -m "feat(rendering): note names under noteheads, following the note-name system"
```

---

### Task 8: Quiz data and logic (pure)

**Files:**
- Create: `src/learn/noteStats.ts`, `src/learn/noteScheduler.ts`, `src/learn/nameTheNote.ts`
- Test: `src/__tests__/noteStats.test.ts`, `noteScheduler.test.ts`, `nameTheNote.test.ts`

**Interfaces:**
- Produces from `noteStats.ts`: `interface PitchStat { seen: number; correct: number; lastSeen: number }`; `RECENT_LIMIT = 20`; `MAX_STAGE = 5`;
  `class NoteStats { constructor(storage?: Pick<Storage,'getItem'|'setItem'> | null); record(pitch: string, stage: number, correct: boolean, now?: number): void; get(pitch: string): PitchStat | undefined; recent(stage: number): { answered: number; accuracy: number }; getMaxStage(): number; unlock(stage: number): boolean; reset(): void }`.
- From `noteScheduler.ts`: `pitchWeight(stat?: PitchStat): number`; `pickNextPitch(pool: readonly string[], statFor: (pitch: string) => PitchStat | undefined, last: string | null, rng?: () => number): string`.
- From `nameTheNote.ts`: `type Clef = 'treble' | 'bass'`; `interface Question { pitch: string; clef: Clef; stage: number }`; `interface AnswerResult { correct: boolean; expectedPitch: string; expectedLetter: string; unlockedStage: number | null }`; `STAGE_POOLS`; `UNLOCK_ACCURACY = 0.9`; `clefForPitch(pitch: string): Clef`;
  `class NameTheNoteQuiz { constructor(stats: NoteStats, rng?: () => number); getStage(): number; getMaxStage(): number; setStage(stage: number): boolean; next(): Question; current(): Question | null; recentAccuracy(): { answered: number; accuracy: number }; answerLetter(letter: string): AnswerResult; answerPitch(pitch: string): AnswerResult }`.

- [ ] **Step 1: Write the failing tests**

`src/__tests__/noteStats.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { NoteStats, RECENT_LIMIT } from '../learn/noteStats';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe('NoteStats', () => {
  it('counts answers per pitch', () => {
    const stats = new NoteStats(fakeStorage());
    stats.record('C4', 1, true, 100);
    stats.record('C4', 1, false, 200);
    expect(stats.get('C4')).toEqual({ seen: 2, correct: 1, lastSeen: 200 });
    expect(stats.get('D4')).toBeUndefined();
  });

  it('keeps only the last 20 answers per stage', () => {
    const stats = new NoteStats(fakeStorage());
    for (let i = 0; i < 25; i++) stats.record('C4', 1, i >= 5);
    expect(stats.recent(1)).toEqual({ answered: RECENT_LIMIT, accuracy: 1 });
    expect(stats.recent(2)).toEqual({ answered: 0, accuracy: 0 });
  });

  it('saves and reloads', () => {
    const storage = fakeStorage();
    new NoteStats(storage).record('E4', 1, true);
    expect(new NoteStats(storage).get('E4')?.seen).toBe(1);
  });

  it('starts empty on corrupt or unknown data', () => {
    expect(new NoteStats(fakeStorage({ 'noteStats.v1': '{not json' })).get('C4')).toBeUndefined();
    expect(new NoteStats(fakeStorage({ 'noteStats.v1': JSON.stringify({ version: 9 }) })).getMaxStage()).toBe(1);
  });

  it('works without storage', () => {
    const stats = new NoteStats(null);
    stats.record('C4', 1, true);
    expect(stats.get('C4')?.seen).toBe(1);
  });

  it('only ever raises the unlocked stage, up to 5', () => {
    const stats = new NoteStats(fakeStorage());
    expect(stats.unlock(2)).toBe(true);
    expect(stats.unlock(2)).toBe(false);
    expect(stats.unlock(1)).toBe(false);
    expect(stats.unlock(6)).toBe(false);
    expect(stats.getMaxStage()).toBe(2);
  });

  it('reset clears everything', () => {
    const stats = new NoteStats(fakeStorage());
    stats.record('C4', 1, true);
    stats.unlock(3);
    stats.reset();
    expect(stats.get('C4')).toBeUndefined();
    expect(stats.getMaxStage()).toBe(1);
  });
});
```

`src/__tests__/noteScheduler.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pitchWeight, pickNextPitch } from '../learn/noteScheduler';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('pitchWeight', () => {
  it('weights unseen notes in the middle and weak notes highest', () => {
    expect(pitchWeight(undefined)).toBe(3);
    expect(pitchWeight({ seen: 4, correct: 4, lastSeen: 0 })).toBe(1);
    expect(pitchWeight({ seen: 4, correct: 0, lastSeen: 0 })).toBe(5);
    expect(pitchWeight({ seen: 2, correct: 1, lastSeen: 0 })).toBe(3);
  });
});

describe('pickNextPitch', () => {
  const pool = ['C4', 'D4', 'E4'];

  it('never repeats the last pitch when there is a choice', () => {
    const rng = seeded(7);
    for (let i = 0; i < 200; i++) expect(pickNextPitch(pool, () => undefined, 'D4', rng)).not.toBe('D4');
  });

  it('can repeat when the pool has a single pitch', () => {
    expect(pickNextPitch(['C4'], () => undefined, 'C4')).toBe('C4');
  });

  it('follows the random roll across the weights', () => {
    expect(pickNextPitch(pool, () => undefined, null, () => 0)).toBe('C4');
    expect(pickNextPitch(pool, () => undefined, null, () => 0.999)).toBe('E4');
  });

  it('asks weak notes more often', () => {
    const stats: Record<string, { seen: number; correct: number; lastSeen: number }> = {
      C4: { seen: 10, correct: 10, lastSeen: 0 },
      D4: { seen: 10, correct: 0, lastSeen: 0 },
      E4: { seen: 10, correct: 10, lastSeen: 0 },
    };
    const rng = seeded(42);
    let weak = 0;
    for (let i = 0; i < 2000; i++) if (pickNextPitch(pool, (p) => stats[p], null, rng) === 'D4') weak++;
    expect(weak / 2000).toBeGreaterThan(0.6);
  });

  it('throws on an empty pool', () => {
    expect(() => pickNextPitch([], () => undefined, null)).toThrow();
  });
});
```

`src/__tests__/nameTheNote.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { NoteStats } from '../learn/noteStats';
import { NameTheNoteQuiz, STAGE_POOLS, clefForPitch } from '../learn/nameTheNote';

function fakeStorage() {
  const data: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeQuiz() {
  const stats = new NoteStats(fakeStorage());
  return { stats, quiz: new NameTheNoteQuiz(stats, seeded(3)) };
}

describe('stages', () => {
  it('stage 1 is five natural notes C4 to G4', () => {
    expect([...STAGE_POOLS[1]]).toEqual(['C4', 'D4', 'E4', 'F4', 'G4']);
  });

  it('every pool pitch is a natural note with an octave', () => {
    for (const pool of Object.values(STAGE_POOLS)) {
      for (const pitch of pool) expect(pitch).toMatch(/^[A-G]\d$/);
    }
  });

  it('chooses the clef by pitch: C4 and above treble, below bass', () => {
    expect(clefForPitch('C4')).toBe('treble');
    expect(clefForPitch('A5')).toBe('treble');
    expect(clefForPitch('B3')).toBe('bass');
    expect(clefForPitch('F2')).toBe('bass');
  });
});

describe('NameTheNoteQuiz', () => {
  it('asks from the current stage and never repeats the previous pitch', () => {
    const { quiz } = makeQuiz();
    let last = '';
    for (let i = 0; i < 50; i++) {
      const q = quiz.next();
      expect(STAGE_POOLS[1]).toContain(q.pitch);
      expect(q.stage).toBe(1);
      expect(q.pitch).not.toBe(last);
      last = q.pitch;
    }
  });

  it('answerLetter is correct for the right letter in any octave and records stats', () => {
    const { quiz, stats } = makeQuiz();
    const q = quiz.next();
    const result = quiz.answerLetter(q.pitch[0].toLowerCase());
    expect(result).toMatchObject({ correct: true, expectedPitch: q.pitch, expectedLetter: q.pitch[0] });
    expect(stats.get(q.pitch)).toMatchObject({ seen: 1, correct: 1 });
  });

  it('answerPitch needs the exact octave', () => {
    const { quiz } = makeQuiz();
    const q = quiz.next();
    const wrongOctave = `${q.pitch[0]}${Number(q.pitch.slice(1)) + 1}`;
    expect(quiz.answerPitch(wrongOctave).correct).toBe(false);
  });

  it('a wrong answer is recorded as wrong', () => {
    const { quiz, stats } = makeQuiz();
    const q = quiz.next();
    const wrongLetter = q.pitch[0] === 'C' ? 'D' : 'C';
    expect(quiz.answerLetter(wrongLetter).correct).toBe(false);
    expect(stats.get(q.pitch)).toMatchObject({ seen: 1, correct: 0 });
  });

  it('answering the same question twice returns the first result and counts once', () => {
    const { quiz, stats } = makeQuiz();
    const q = quiz.next();
    const first = quiz.answerLetter(q.pitch[0]);
    const second = quiz.answerLetter('Z');
    expect(second).toEqual(first);
    expect(stats.get(q.pitch)?.seen).toBe(1);
  });

  it('throws when answering before asking', () => {
    const { quiz } = makeQuiz();
    expect(() => quiz.answerLetter('C')).toThrow();
  });

  it('unlocks the next stage after 20 answers at 90% or better', () => {
    const { quiz } = makeQuiz();
    let unlocked: number | null = null;
    for (let i = 0; i < 20; i++) {
      const q = quiz.next();
      const letter = i < 2 ? (q.pitch[0] === 'C' ? 'D' : 'C') : q.pitch[0];
      unlocked = quiz.answerLetter(letter).unlockedStage;
    }
    expect(unlocked).toBe(2);
    expect(quiz.getMaxStage()).toBe(2);
    expect(quiz.setStage(2)).toBe(true);
    expect(quiz.next().stage).toBe(2);
    expect(quiz.setStage(3)).toBe(false);
  });

  it('does not unlock below 90% accuracy', () => {
    const { quiz } = makeQuiz();
    for (let i = 0; i < 20; i++) {
      const q = quiz.next();
      const letter = i < 3 ? (q.pitch[0] === 'C' ? 'D' : 'C') : q.pitch[0];
      quiz.answerLetter(letter);
    }
    expect(quiz.getMaxStage()).toBe(1);
  });

  it('rejects stages that are not unlocked', () => {
    const { quiz } = makeQuiz();
    expect(quiz.setStage(2)).toBe(false);
    expect(quiz.setStage(0)).toBe(false);
    expect(quiz.getStage()).toBe(1);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/__tests__/noteStats.test.ts src/__tests__/noteScheduler.test.ts src/__tests__/nameTheNote.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement** `src/learn/noteStats.ts`

```ts
export interface PitchStat {
  seen: number;
  correct: number;
  lastSeen: number;
}

interface StatsData {
  version: 1;
  pitches: Record<string, PitchStat>;
  recent: Record<string, boolean[]>;
  maxStage: number;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'noteStats.v1';
export const RECENT_LIMIT = 20;
export const MAX_STAGE = 5;

function emptyData(): StatsData {
  return { version: 1, pitches: {}, recent: {}, maxStage: 1 };
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isValid(data: unknown): data is StatsData {
  if (!data || typeof data !== 'object') return false;
  const d = data as StatsData;
  return (
    d.version === 1 &&
    typeof d.pitches === 'object' && d.pitches !== null &&
    typeof d.recent === 'object' && d.recent !== null &&
    Number.isInteger(d.maxStage) && d.maxStage >= 1 && d.maxStage <= MAX_STAGE
  );
}

export class NoteStats {
  private data: StatsData;

  constructor(private readonly storage: StorageLike | null = defaultStorage()) {
    this.data = this.load();
  }

  private load(): StatsData {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return emptyData();
      const parsed: unknown = JSON.parse(raw);
      return isValid(parsed) ? parsed : emptyData();
    } catch {
      return emptyData();
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // storage full or unavailable: progress just isn't kept
    }
  }

  record(pitch: string, stage: number, correct: boolean, now: number = Date.now()): void {
    const stat = this.data.pitches[pitch] ?? { seen: 0, correct: 0, lastSeen: 0 };
    stat.seen += 1;
    if (correct) stat.correct += 1;
    stat.lastSeen = now;
    this.data.pitches[pitch] = stat;

    const key = String(stage);
    const recent = this.data.recent[key] ?? [];
    recent.push(correct);
    this.data.recent[key] = recent.slice(-RECENT_LIMIT);
    this.save();
  }

  get(pitch: string): PitchStat | undefined {
    return this.data.pitches[pitch];
  }

  recent(stage: number): { answered: number; accuracy: number } {
    const answers = this.data.recent[String(stage)] ?? [];
    const correct = answers.filter(Boolean).length;
    return { answered: answers.length, accuracy: answers.length ? correct / answers.length : 0 };
  }

  getMaxStage(): number {
    return this.data.maxStage;
  }

  unlock(stage: number): boolean {
    if (stage <= this.data.maxStage || stage > MAX_STAGE) return false;
    this.data.maxStage = stage;
    this.save();
    return true;
  }

  reset(): void {
    this.data = emptyData();
    this.save();
  }
}
```

`src/learn/noteScheduler.ts`:

```ts
import type { PitchStat } from './noteStats';

/** 1 for a note always right, 5 for a note always wrong, 3 for a note not seen yet. */
export function pitchWeight(stat: PitchStat | undefined): number {
  const accuracy = stat && stat.seen > 0 ? stat.correct / stat.seen : 0.5;
  return 1 + 4 * (1 - accuracy);
}

export function pickNextPitch(
  pool: readonly string[],
  statFor: (pitch: string) => PitchStat | undefined,
  last: string | null,
  rng: () => number = Math.random
): string {
  if (pool.length === 0) throw new Error('Empty pitch pool');
  const candidates = pool.length > 1 ? pool.filter((p) => p !== last) : [...pool];
  const weights = candidates.map((p) => pitchWeight(statFor(p)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll < 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}
```

`src/learn/nameTheNote.ts`:

```ts
import { MAX_STAGE, RECENT_LIMIT, type NoteStats } from './noteStats';
import { pickNextPitch } from './noteScheduler';

export type Clef = 'treble' | 'bass';

export interface Question {
  pitch: string;
  clef: Clef;
  stage: number;
}

export interface AnswerResult {
  correct: boolean;
  expectedPitch: string;
  expectedLetter: string;
  unlockedStage: number | null;
}

const STAGE_1 = ['C4', 'D4', 'E4', 'F4', 'G4'];
const STAGE_2 = ['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'];
const STAGE_3 = ['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3'];
const STAGE_4 = [...new Set([...STAGE_1, ...STAGE_2, ...STAGE_3])];
const STAGE_5 = ['B3', 'C4', 'D4', 'A5', 'B5', 'C6', 'D2', 'E2', 'F2'];

export const STAGE_POOLS: Readonly<Record<number, readonly string[]>> = {
  1: STAGE_1,
  2: STAGE_2,
  3: STAGE_3,
  4: STAGE_4,
  5: STAGE_5,
};

export const UNLOCK_ACCURACY = 0.9;

/** C4 (middle C) and above are written in treble clef, everything lower in bass clef. */
export function clefForPitch(pitch: string): Clef {
  const octave = parseInt(pitch.replace(/^[A-G][#b]?/, ''), 10);
  return octave >= 4 ? 'treble' : 'bass';
}

export class NameTheNoteQuiz {
  private stage = 1;
  private currentQuestion: Question | null = null;
  private lastPitch: string | null = null;
  private lastResult: AnswerResult | null = null;

  constructor(
    private readonly stats: NoteStats,
    private readonly rng: () => number = Math.random
  ) {}

  getStage(): number {
    return this.stage;
  }

  getMaxStage(): number {
    return this.stats.getMaxStage();
  }

  setStage(stage: number): boolean {
    if (!Number.isInteger(stage) || stage < 1 || stage > this.stats.getMaxStage()) return false;
    this.stage = stage;
    this.lastPitch = null;
    return true;
  }

  next(): Question {
    const pitch = pickNextPitch(STAGE_POOLS[this.stage], (p) => this.stats.get(p), this.lastPitch, this.rng);
    this.lastPitch = pitch;
    this.lastResult = null;
    this.currentQuestion = { pitch, clef: clefForPitch(pitch), stage: this.stage };
    return this.currentQuestion;
  }

  current(): Question | null {
    return this.currentQuestion;
  }

  recentAccuracy(): { answered: number; accuracy: number } {
    return this.stats.recent(this.stage);
  }

  /** The letter alone is enough: C in any octave. */
  answerLetter(letter: string): AnswerResult {
    const question = this.requireQuestion();
    return this.lastResult ?? this.finish(question, letter.toUpperCase() === question.pitch[0]);
  }

  /** A played note must be the exact pitch, octave included. */
  answerPitch(pitch: string): AnswerResult {
    const question = this.requireQuestion();
    return this.lastResult ?? this.finish(question, pitch === question.pitch);
  }

  private requireQuestion(): Question {
    if (!this.currentQuestion) throw new Error('No question has been asked');
    return this.currentQuestion;
  }

  private finish(question: Question, correct: boolean): AnswerResult {
    this.stats.record(question.pitch, question.stage, correct);
    let unlockedStage: number | null = null;
    if (question.stage === this.stats.getMaxStage() && question.stage < MAX_STAGE) {
      const recent = this.stats.recent(question.stage);
      if (recent.answered >= RECENT_LIMIT && recent.accuracy >= UNLOCK_ACCURACY && this.stats.unlock(question.stage + 1)) {
        unlockedStage = question.stage + 1;
      }
    }
    this.lastResult = {
      correct,
      expectedPitch: question.pitch,
      expectedLetter: question.pitch[0],
      unlockedStage,
    };
    return this.lastResult;
  }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/__tests__/noteStats.test.ts src/__tests__/noteScheduler.test.ts src/__tests__/nameTheNote.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/learn src/__tests__
git commit -m "feat(learn): note statistics, weak-note scheduling and quiz logic"
```

---

### Task 9: "Name the note" screen and short lessons

**Files:**
- Create: `src/learn/noteCard.ts`, `src/learn/lessons.ts`, `src/learn/learnView.ts`
- Modify: `index.html`, `src/main.ts`, `src/style.css`, `src/i18n/locales/en.ts`, `fa.ts`
- Test: `src/__tests__/noteCard.test.ts`, `lessons.test.ts`, `learnView.test.ts`

**Interfaces:**
- Consumes: `NameTheNoteQuiz`, `NoteStats`, `Clef`, `NoteInputHub`, `noteInput`, `formatNoteName`, `getNoteNameSystem`, `t`, `applyTranslations`, `RECENT_LIMIT`.
- Produces: `buildSingleNoteXml(pitch: string, clef: Clef): string`; `interface NotationToolkit { setOptions(o: Record<string, unknown>): void; loadData(d: string): unknown; renderToSVG(page: number): string }`; `createNoteCardRenderer(toolkit: NotationToolkit, options?: { scale?: number; pageWidth?: number }): (pitch: string, clef: Clef, into: HTMLElement) => void`;
  `interface Lesson { id: string; titleKey: MessageKey; bodyKey: MessageKey; examples: { pitch: string; clef: Clef }[] }`; `LESSONS: readonly Lesson[]`;
  `class LearnView { readonly element: HTMLElement; constructor(deps: { quiz: NameTheNoteQuiz; hub: NoteInputHub; renderNote: (pitch: string, clef: Clef, into: HTMLElement) => void; formatLetter: (letter: string) => string; autoAdvanceMs?: number; onClose?: () => void }); open(): void; close(): void; isOpen(): boolean; refresh(): void; dispose(): void }`.
  The root element carries `data-panel="quiz|lessons"`, `data-pitch="<current pitch>"` and `data-result="correct|wrong"` (absent between questions) for tests.

- [ ] **Step 1: Add the messages**

Append to `src/i18n/locales/en.ts` (inside the object):

```ts
  // Learn mode
  'control.learn': 'Learn the notes',
  'learn.title': 'Name the note',
  'learn.stageLabel': 'Stage',
  'learn.stage': 'Stage {n}: {name}',
  'learn.stageLocked': 'Stage {n}: {name} (locked)',
  'learn.stageName.1': 'Treble clef: five notes',
  'learn.stageName.2': 'Treble clef: the whole staff',
  'learn.stageName.3': 'Bass clef: the whole staff',
  'learn.stageName.4': 'Both clefs',
  'learn.stageName.5': 'Ledger lines',
  'learn.prompt': 'Which note is this?',
  'learn.hint': 'You can also play the note on the piano.',
  'learn.correct': 'Correct!',
  'learn.wrong': 'Not quite. This note is {name}.',
  'learn.next': 'Next note',
  'learn.stats': '{pct}% correct over the last {n} answers',
  'learn.noStats': 'Answer 20 notes to see your accuracy.',
  'learn.unlocked': 'Stage {n} unlocked!',
  'learn.lessons': 'Lessons',
  'learn.close': 'Back to practice',
  'lessons.count': 'Lesson {n} of {total}',
  'lessons.prev': 'Previous',
  'lessons.next': 'Next',
  'lessons.start': 'Start practising',
  'lessons.staff.title': 'The staff',
  'lessons.staff.body':
    'Music is written on a staff: five horizontal lines and the four spaces between them. Notes sit on the lines or in the spaces. The higher a note sits, the higher it sounds.',
  'lessons.clefs.title': 'Treble and bass clef',
  'lessons.clefs.body':
    'The treble clef (the curly sign) is for higher notes, usually played by the right hand. The bass clef is for lower notes, usually played by the left hand. Piano music uses both together.',
  'lessons.middleC.title': 'Middle C',
  'lessons.middleC.body':
    'Middle C is the note in the middle of the piano, between the two hands. In treble clef it sits on a short line below the staff; in bass clef, on a short line above it. Every other note can be found by counting up or down from it.',
  'lessons.ledger.title': 'Ledger lines',
  'lessons.ledger.body':
    'When a note is too high or too low for the staff, short extra lines called ledger lines are added above or below it. Count them just like the lines of the staff.',
  'lessons.names.title': 'Note names and the keyboard',
  'lessons.names.body':
    'There are seven note names, repeating up the keyboard: C D E F G A B, or in solfège Do Re Mi Fa Sol La Si. In Persian they are دو ر می فا سل لا سی. The white keys are these seven notes; the black keys are sharps (♯) and flats (♭).',
```

Append to `src/i18n/locales/fa.ts`:

```ts
  // Learn mode
  'control.learn': 'یادگیری نت‌ها',
  'learn.title': 'نام نت را پیدا کنید',
  'learn.stageLabel': 'مرحله',
  'learn.stage': 'مرحله‌ی {n}: {name}',
  'learn.stageLocked': 'مرحله‌ی {n}: {name} (قفل)',
  'learn.stageName.1': 'کلید سل: پنج نت',
  'learn.stageName.2': 'کلید سل: کل حامل',
  'learn.stageName.3': 'کلید فا: کل حامل',
  'learn.stageName.4': 'هر دو کلید',
  'learn.stageName.5': 'خط‌های کمکی',
  'learn.prompt': 'این کدام نت است؟',
  'learn.hint': 'می‌توانید نت را روی پیانو هم بنوازید.',
  'learn.correct': 'درست است!',
  'learn.wrong': 'نه، این نت {name} است.',
  'learn.next': 'نت بعدی',
  'learn.stats': '{pct}٪ درست در {n} پاسخ آخر',
  'learn.noStats': 'برای دیدن دقت خود به ۲۰ نت پاسخ دهید.',
  'learn.unlocked': 'مرحله‌ی {n} باز شد!',
  'learn.lessons': 'درس‌ها',
  'learn.close': 'بازگشت به تمرین',
  'lessons.count': 'درس {n} از {total}',
  'lessons.prev': 'قبلی',
  'lessons.next': 'بعدی',
  'lessons.start': 'شروع تمرین',
  'lessons.staff.title': 'حامل',
  'lessons.staff.body':
    'نت‌ها روی حامل نوشته می‌شوند. حامل پنج خط افقی دارد و چهار فاصله‌ی میان آن‌ها. هر نت روی یک خط یا در یک فاصله قرار می‌گیرد. هرچه نت بالاتر باشد، صدایش زیرتر است.',
  'lessons.clefs.title': 'کلید سل و کلید فا',
  'lessons.clefs.body':
    'کلید سل (نشانه‌ی خمیده‌ی ابتدای حامل) برای صداهای بالاتر است و معمولاً با دست راست نواخته می‌شود. کلید فا برای صداهای پایین‌تر است و معمولاً با دست چپ نواخته می‌شود. موسیقی پیانو هر دو را کنار هم به کار می‌برد.',
  'lessons.middleC.title': 'دوی میانی',
  'lessons.middleC.body':
    'دوی میانی نتی است که وسط پیانو قرار دارد، میان دو دست. در کلید سل روی یک خط کوتاه زیر حامل می‌نشیند و در کلید فا روی یک خط کوتاه بالای آن. بقیه‌ی نت‌ها را می‌شود با شمردن از همین نت به بالا یا پایین پیدا کرد.',
  'lessons.ledger.title': 'خط‌های کمکی',
  'lessons.ledger.body':
    'وقتی نتی از حامل بالاتر یا پایین‌تر می‌رود، خط‌های کوتاهی به نام خط‌های کمکی بالا یا پایین آن اضافه می‌شود. آن‌ها را مثل خط‌های خود حامل بشمارید.',
  'lessons.names.title': 'نام نت‌ها و صفحه‌کلید',
  'lessons.names.body':
    'هفت نام برای نت‌ها وجود دارد که روی صفحه‌کلید پیانو تکرار می‌شوند: دو ر می فا سل لا سی (در نام‌گذاری حرفی C D E F G A B). کلیدهای سفید همین هفت نت‌اند و کلیدهای سیاه دیزها (♯) و بمل‌ها (♭) هستند.',
```

Run `npx vitest run src/__tests__/i18n.test.ts`: the parity test must pass.

- [ ] **Step 2: Write the failing tests**

`src/__tests__/noteCard.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { buildSingleNoteXml, createNoteCardRenderer } from '../learn/noteCard';

function parse(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

describe('buildSingleNoteXml', () => {
  it('writes one whole note in treble clef', () => {
    const doc = parse(buildSingleNoteXml('C4', 'treble'));
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelector('pitch step')!.textContent).toBe('C');
    expect(doc.querySelector('pitch octave')!.textContent).toBe('4');
    expect(doc.querySelector('clef sign')!.textContent).toBe('G');
    expect(doc.querySelector('clef line')!.textContent).toBe('2');
    expect(doc.querySelector('alter')).toBeNull();
  });

  it('writes bass clef and accidentals', () => {
    const sharp = parse(buildSingleNoteXml('F#3', 'bass'));
    expect(sharp.querySelector('clef sign')!.textContent).toBe('F');
    expect(sharp.querySelector('clef line')!.textContent).toBe('4');
    expect(sharp.querySelector('alter')!.textContent).toBe('1');
    expect(parse(buildSingleNoteXml('Bb2', 'bass')).querySelector('alter')!.textContent).toBe('-1');
  });

  it('rejects an invalid pitch', () => {
    expect(() => buildSingleNoteXml('H4', 'treble')).toThrow();
  });
});

describe('createNoteCardRenderer', () => {
  it('loads the note into the toolkit and puts the SVG in the container', () => {
    const toolkit = {
      setOptions: vi.fn(),
      loadData: vi.fn(),
      renderToSVG: vi.fn(() => '<svg xmlns="http://www.w3.org/2000/svg"><g class="x"/></svg>'),
    };
    const render = createNoteCardRenderer(toolkit);
    const holder = document.createElement('div');
    render('E4', 'treble', holder);
    expect(toolkit.setOptions).toHaveBeenCalled();
    expect(toolkit.loadData).toHaveBeenCalledWith(expect.stringContaining('<step>E</step>'));
    expect(holder.querySelector('svg g.x')).not.toBeNull();
  });
});
```

`src/__tests__/lessons.test.ts`:

```ts
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
        expect(en[key].length, key).toBeGreaterThan(10);
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
```

`src/__tests__/learnView.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initLocale } from '../i18n';
import { NoteInputHub } from '../input/noteInput';
import { NoteStats } from '../learn/noteStats';
import { NameTheNoteQuiz } from '../learn/nameTheNote';
import { LearnView } from '../learn/learnView';

function fakeStorage() {
  const data: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

let hub: NoteInputHub;
let stats: NoteStats;
let view: LearnView;
let renderNote: ReturnType<typeof vi.fn>;
let closed: number;

const q = <T extends Element>(sel: string) => view.element.querySelector(sel) as T;
const pitch = () => view.element.dataset.pitch!;
const answerButton = (letter: string) => q<HTMLButtonElement>(`.learn-answer[data-letter="${letter}"]`);
const wrongLetter = () => (pitch()[0] === 'C' ? 'D' : 'C');

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  initLocale();
  localStorage.setItem('learn.seenLessons', '1');
  hub = new NoteInputHub();
  stats = new NoteStats(fakeStorage());
  renderNote = vi.fn();
  closed = 0;
  view = new LearnView({
    quiz: new NameTheNoteQuiz(stats, seeded(5)),
    hub,
    renderNote,
    formatLetter: (letter) => letter,
    autoAdvanceMs: 500,
    onClose: () => closed++,
  });
  document.body.appendChild(view.element);
});

afterEach(() => {
  view.dispose();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('quiz panel', () => {
  it('is hidden until opened, then asks a question and draws the note', () => {
    expect(view.element.hidden).toBe(true);
    view.open();
    expect(view.element.hidden).toBe(false);
    expect(view.element.dataset.panel).toBe('quiz');
    expect(pitch()).toMatch(/^[A-G]\d$/);
    expect(renderNote).toHaveBeenCalledWith(pitch(), expect.stringMatching(/treble|bass/), expect.any(HTMLElement));
    expect(view.element.querySelectorAll('.learn-answer')).toHaveLength(7);
  });

  it('a correct answer shows feedback, locks the buttons and moves on by itself', () => {
    view.open();
    const first = pitch();
    answerButton(first[0]).click();
    expect(view.element.dataset.result).toBe('correct');
    expect(answerButton('C').disabled).toBe(true);
    expect(q('.learn-feedback').textContent).toBe('Correct!');
    vi.advanceTimersByTime(500);
    expect(view.element.dataset.result).toBeUndefined();
    expect(renderNote).toHaveBeenCalledTimes(2);
    expect(pitch()).not.toBe(first);
  });

  it('a wrong answer names the right note and waits for Next', () => {
    view.open();
    const expected = pitch()[0];
    answerButton(wrongLetter()).click();
    expect(view.element.dataset.result).toBe('wrong');
    expect(q('.learn-feedback').textContent).toContain(expected);
    expect(q<HTMLButtonElement>('.learn-next').hidden).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(renderNote).toHaveBeenCalledTimes(1);
    q<HTMLButtonElement>('.learn-next').click();
    expect(renderNote).toHaveBeenCalledTimes(2);
    expect(view.element.dataset.result).toBeUndefined();
  });

  it('accepts the note played on any input source', () => {
    view.open();
    hub.noteOn(pitch(), 'screen');
    expect(view.element.dataset.result).toBe('correct');
  });

  it('ignores played notes while closed', () => {
    view.open();
    const p = pitch();
    view.close();
    hub.noteOn(p, 'midi');
    expect(stats.get(p)).toBeUndefined();
    expect(closed).toBe(1);
  });

  it('keeps later stages locked until 20 answers at 90%, then unlocks stage 2', () => {
    view.open();
    const stageOption = (n: number) => q<HTMLSelectElement>('.learn-stage-select').options[n - 1];
    expect(stageOption(2).disabled).toBe(true);
    for (let i = 0; i < 20; i++) {
      answerButton(pitch()[0]).click();
      if (i < 19) vi.advanceTimersByTime(500);
    }
    expect(stageOption(2).disabled).toBe(false);
    expect(q('.learn-feedback').textContent).toContain('Stage 2 unlocked!');
  });
});

describe('lessons panel', () => {
  it('opens on the lessons the first time and starts the quiz at the end', () => {
    localStorage.removeItem('learn.seenLessons');
    view.open();
    expect(view.element.dataset.panel).toBe('lessons');
    expect(q('.learn-lesson-count').textContent).toBe('Lesson 1 of 5');
    for (let i = 0; i < 4; i++) q<HTMLButtonElement>('.learn-lesson-next').click();
    expect(q('.learn-lesson-count').textContent).toBe('Lesson 5 of 5');
    q<HTMLButtonElement>('.learn-lesson-start').click();
    expect(view.element.dataset.panel).toBe('quiz');
    expect(localStorage.getItem('learn.seenLessons')).toBe('1');
  });

  it('draws each lesson example', () => {
    localStorage.removeItem('learn.seenLessons');
    view.open();
    expect(renderNote).toHaveBeenCalledWith('E4', 'treble', expect.any(HTMLElement));
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/__tests__/noteCard.test.ts src/__tests__/lessons.test.ts src/__tests__/learnView.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 4: Implement** `src/learn/noteCard.ts`

```ts
import type { Clef } from './nameTheNote';

export function buildSingleNoteXml(pitch: string, clef: Clef): string {
  const match = /^([A-G])(#|b)?(-?\d+)$/.exec(pitch);
  if (!match) throw new Error(`Invalid pitch: ${pitch}`);
  const alter = match[2] === '#' ? '<alter>1</alter>' : match[2] === 'b' ? '<alter>-1</alter>' : '';
  const clefXml = clef === 'treble' ? '<sign>G</sign><line>2</line>' : '<sign>F</sign><line>4</line>';
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name print-object="no">Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time print-object="no"><beats>4</beats><beat-type>4</beat-type></time>
        <clef>${clefXml}</clef>
      </attributes>
      <note><pitch><step>${match[1]}</step>${alter}<octave>${match[3]}</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>`;
}

/** The few Verovio calls the note card needs, so it can be tested without loading the engine. */
export interface NotationToolkit {
  setOptions(options: Record<string, unknown>): void;
  loadData(data: string): unknown;
  renderToSVG(page: number): string;
}

export function createNoteCardRenderer(
  toolkit: NotationToolkit,
  options: { scale?: number; pageWidth?: number } = {}
): (pitch: string, clef: Clef, into: HTMLElement) => void {
  toolkit.setOptions({
    pageWidth: options.pageWidth ?? 420,
    pageHeight: 600,
    scale: options.scale ?? 70,
    adjustPageHeight: true,
    footer: 'none',
    header: 'none',
    breaks: 'none',
  });
  return (pitch, clef, into) => {
    toolkit.loadData(buildSingleNoteXml(pitch, clef));
    const svg = new DOMParser().parseFromString(toolkit.renderToSVG(1), 'image/svg+xml');
    into.replaceChildren(document.importNode(svg.documentElement, true));
  };
}
```

`src/learn/lessons.ts`:

```ts
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
```

`src/learn/learnView.ts`:

```ts
import { t, applyTranslations, type MessageKey } from '../i18n';
import type { NoteInputHub } from '../input/noteInput';
import { LESSONS } from './lessons';
import { MAX_STAGE, RECENT_LIMIT } from './noteStats';
import type { AnswerResult, Clef, NameTheNoteQuiz } from './nameTheNote';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SEEN_KEY = 'learn.seenLessons';

export interface LearnViewDeps {
  quiz: NameTheNoteQuiz;
  hub: NoteInputHub;
  renderNote: (pitch: string, clef: Clef, into: HTMLElement) => void;
  formatLetter: (letter: string) => string;
  autoAdvanceMs?: number;
  onClose?: () => void;
}

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  i18nKey?: MessageKey
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  if (i18nKey) {
    el.dataset.i18n = i18nKey;
    el.textContent = t(i18nKey);
  }
  return el;
}

export class LearnView {
  readonly element: HTMLElement;
  private readonly quizPanel: HTMLElement;
  private readonly lessonsPanel: HTMLElement;
  private readonly noteHolder: HTMLElement;
  private readonly answerButtons = new Map<string, HTMLButtonElement>();
  private readonly feedback: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly stageSelect: HTMLSelectElement;
  private readonly lessonTitle: HTMLElement;
  private readonly lessonBody: HTMLElement;
  private readonly lessonExamples: HTMLElement;
  private readonly lessonCount: HTMLElement;
  private readonly lessonPrev: HTMLButtonElement;
  private readonly lessonNext: HTMLButtonElement;
  private readonly lessonStart: HTMLButtonElement;
  private readonly unsubscribe: Array<() => void>;
  private lessonIndex = 0;
  private locked = false;
  private opened = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly deps: LearnViewDeps) {
    this.element = make('section', 'learn-view');
    this.element.id = 'learnView';
    this.element.hidden = true;

    // Header
    const header = make('div', 'learn-header');
    header.appendChild(make('h2', 'learn-title', 'learn.title'));
    const controls = make('div', 'learn-controls');
    this.stageSelect = make('select', 'learn-stage-select');
    this.stageSelect.id = 'learnStage';
    this.stageSelect.addEventListener('change', () => this.changeStage());
    const lessonsButton = make('button', 'learn-text-btn', 'learn.lessons');
    lessonsButton.type = 'button';
    lessonsButton.addEventListener('click', () => this.showLessons(0));
    const closeButton = make('button', 'learn-text-btn', 'learn.close');
    closeButton.type = 'button';
    closeButton.addEventListener('click', () => this.close());
    controls.append(this.stageSelect, lessonsButton, closeButton);
    header.appendChild(controls);

    // Quiz panel
    this.quizPanel = make('div', 'learn-quiz');
    this.stats = make('p', 'learn-stats');
    const card = make('div', 'learn-card');
    card.setAttribute('dir', 'ltr');
    this.noteHolder = make('div', 'learn-note');
    card.appendChild(this.noteHolder);
    const answers = make('div', 'learn-answers');
    answers.setAttribute('dir', 'ltr');
    for (const letter of LETTERS) {
      const button = make('button', 'learn-answer');
      button.type = 'button';
      button.dataset.letter = letter;
      button.addEventListener('click', () => this.answerWithLetter(letter));
      this.answerButtons.set(letter, button);
      answers.appendChild(button);
    }
    this.feedback = make('p', 'learn-feedback');
    this.feedback.setAttribute('aria-live', 'polite');
    this.nextButton = make('button', 'learn-next learn-text-btn', 'learn.next');
    this.nextButton.type = 'button';
    this.nextButton.hidden = true;
    this.nextButton.addEventListener('click', () => this.askNext());
    this.quizPanel.append(
      this.stats, card, make('p', 'learn-prompt', 'learn.prompt'), answers,
      this.feedback, this.nextButton, make('p', 'learn-hint', 'learn.hint')
    );

    // Lessons panel
    this.lessonsPanel = make('div', 'learn-lessons');
    this.lessonTitle = make('h3', 'learn-lesson-title');
    this.lessonExamples = make('div', 'learn-examples');
    this.lessonBody = make('p', 'learn-lesson-body');
    this.lessonCount = make('p', 'learn-lesson-count');
    const nav = make('div', 'learn-lesson-nav');
    this.lessonPrev = make('button', 'learn-lesson-prev learn-text-btn', 'lessons.prev');
    this.lessonNext = make('button', 'learn-lesson-next learn-text-btn', 'lessons.next');
    this.lessonStart = make('button', 'learn-lesson-start learn-text-btn', 'lessons.start');
    for (const b of [this.lessonPrev, this.lessonNext, this.lessonStart]) b.type = 'button';
    this.lessonPrev.addEventListener('click', () => this.showLessons(this.lessonIndex - 1));
    this.lessonNext.addEventListener('click', () => this.showLessons(this.lessonIndex + 1));
    this.lessonStart.addEventListener('click', () => this.finishLessons());
    nav.append(this.lessonPrev, this.lessonCount, this.lessonNext, this.lessonStart);
    this.lessonsPanel.append(this.lessonTitle, this.lessonExamples, this.lessonBody, nav);

    this.element.append(header, this.quizPanel, this.lessonsPanel);

    this.unsubscribe = [deps.hub.onNoteOn.on(({ noteName }) => this.handlePlayed(noteName))];
    this.refresh();
  }

  isOpen(): boolean {
    return this.opened;
  }

  open(): void {
    this.opened = true;
    this.element.hidden = false;
    if (this.hasSeenLessons()) this.showQuiz();
    else this.showLessons(0);
  }

  close(): void {
    this.opened = false;
    this.element.hidden = true;
    this.clearTimer();
    this.deps.onClose?.();
  }

  dispose(): void {
    this.clearTimer();
    for (const off of this.unsubscribe) off();
  }

  /** Re-apply translations and labels after the language or the note-name system changes. */
  refresh(): void {
    applyTranslations(this.element);
    for (const [letter, button] of this.answerButtons) button.textContent = this.deps.formatLetter(letter);
    this.refreshStageSelect();
    this.refreshStats();
    if (this.element.dataset.panel === 'lessons') this.showLessons(this.lessonIndex);
  }

  // ----- quiz -----

  private showQuiz(): void {
    this.element.dataset.panel = 'quiz';
    this.quizPanel.hidden = false;
    this.lessonsPanel.hidden = true;
    this.askNext();
  }

  private askNext(): void {
    this.clearTimer();
    const question = this.deps.quiz.next();
    this.locked = false;
    this.element.dataset.pitch = question.pitch;
    delete this.element.dataset.result;
    this.feedback.textContent = '';
    this.nextButton.hidden = true;
    for (const button of this.answerButtons.values()) {
      button.disabled = false;
      button.classList.remove('correct', 'wrong');
    }
    this.deps.renderNote(question.pitch, question.clef, this.noteHolder);
    this.refreshStageSelect();
    this.refreshStats();
  }

  private answerWithLetter(letter: string): void {
    if (!this.canAnswer()) return;
    this.showResult(this.deps.quiz.answerLetter(letter), letter);
  }

  private handlePlayed(noteName: string): void {
    if (!this.canAnswer()) return;
    const result = this.deps.quiz.answerPitch(noteName);
    this.showResult(result, noteName[0]);
  }

  private canAnswer(): boolean {
    return this.opened && !this.locked && this.element.dataset.panel === 'quiz' && this.deps.quiz.current() !== null;
  }

  private showResult(result: AnswerResult, chosenLetter: string): void {
    this.locked = true;
    for (const button of this.answerButtons.values()) button.disabled = true;
    this.answerButtons.get(result.expectedLetter)?.classList.add('correct');
    if (!result.correct) this.answerButtons.get(chosenLetter)?.classList.add('wrong');

    let message = result.correct
      ? t('learn.correct')
      : t('learn.wrong', { name: this.deps.formatLetter(result.expectedLetter) });
    if (result.unlockedStage) message += ` ${t('learn.unlocked', { n: result.unlockedStage })}`;
    this.feedback.textContent = message;
    this.element.dataset.result = result.correct ? 'correct' : 'wrong';
    this.refreshStageSelect();
    this.refreshStats();

    if (result.correct) {
      this.timer = setTimeout(() => this.askNext(), this.deps.autoAdvanceMs ?? 900);
    } else {
      this.nextButton.hidden = false;
      this.nextButton.focus();
    }
  }

  private changeStage(): void {
    if (this.deps.quiz.setStage(Number(this.stageSelect.value))) this.askNext();
    else this.refreshStageSelect();
  }

  private refreshStageSelect(): void {
    const max = this.deps.quiz.getMaxStage();
    this.stageSelect.replaceChildren();
    for (let stage = 1; stage <= MAX_STAGE; stage++) {
      const option = document.createElement('option');
      option.value = String(stage);
      const name = t(`learn.stageName.${stage}` as MessageKey);
      option.textContent = stage <= max ? t('learn.stage', { n: stage, name }) : t('learn.stageLocked', { n: stage, name });
      option.disabled = stage > max;
      this.stageSelect.appendChild(option);
    }
    this.stageSelect.value = String(this.deps.quiz.getStage());
  }

  private refreshStats(): void {
    const recent = this.deps.quiz.recentAccuracy();
    this.stats.textContent =
      recent.answered >= RECENT_LIMIT
        ? t('learn.stats', { pct: Math.round(recent.accuracy * 100), n: recent.answered })
        : t('learn.noStats');
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // ----- lessons -----

  private hasSeenLessons(): boolean {
    try {
      return localStorage.getItem(SEEN_KEY) === '1';
    } catch {
      return false;
    }
  }

  private showLessons(index: number): void {
    this.clearTimer();
    this.lessonIndex = Math.max(0, Math.min(LESSONS.length - 1, index));
    const lesson = LESSONS[this.lessonIndex];
    this.element.dataset.panel = 'lessons';
    this.quizPanel.hidden = true;
    this.lessonsPanel.hidden = false;
    this.lessonTitle.textContent = t(lesson.titleKey);
    this.lessonBody.textContent = t(lesson.bodyKey);
    this.lessonCount.textContent = t('lessons.count', { n: this.lessonIndex + 1, total: LESSONS.length });
    this.lessonExamples.replaceChildren();
    for (const example of lesson.examples) {
      const holder = make('div', 'learn-example');
      holder.setAttribute('dir', 'ltr');
      this.deps.renderNote(example.pitch, example.clef, holder);
      this.lessonExamples.appendChild(holder);
    }
    const last = this.lessonIndex === LESSONS.length - 1;
    this.lessonPrev.disabled = this.lessonIndex === 0;
    this.lessonNext.hidden = last;
    this.lessonStart.hidden = !last;
  }

  private finishLessons(): void {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // storage unavailable: the lessons will show again next time
    }
    this.showQuiz();
  }
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/__tests__/noteCard.test.ts src/__tests__/lessons.test.ts src/__tests__/learnView.test.ts src/__tests__/i18n.test.ts`
Expected: PASS. If the "20 answers" test fails because the seeded rng happens to repeat a pitch, it cannot (the quiz never repeats the last pitch); if it fails on the unlock message, check that `showResult` appends `learn.unlocked`.

- [ ] **Step 6: Markup, styles and wiring**

`index.html`: add a control section just before `<div class="control-section piano">`:

```html
        <div class="control-section learn">
          <button id="learnToggle" class="learn-btn" aria-label="Learn the notes" data-i18n-attr="aria-label:control.learn" aria-pressed="false">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/></svg>
          </button>
        </div>
```

`src/style.css`: change the Task 6 selectors `.piano-btn` to `.piano-btn,\n.learn-btn` in the three button rules (base, `:hover`, `.active`, `svg`), then append:

```css
/* ============================================
   LEARN THE NOTES
   ============================================ */
.learn-view {
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.learn-view[hidden] {
  display: none;
}

body.learn-open #scoreHeader,
body.learn-open #scoreContainer,
body.learn-open .practice-info {
  display: none;
}

.learn-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.learn-title {
  font-family: var(--font-serif);
  font-weight: 500;
  margin: 0;
}

.learn-controls {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.learn-stage-select,
.learn-text-btn {
  padding: var(--space-xs) var(--space-md);
  background: var(--surface);
  color: var(--text);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  font-family: inherit;
  font-size: 0.875rem;
  cursor: pointer;
}

.learn-text-btn:hover:not(:disabled),
.learn-stage-select:hover {
  border-color: var(--accent);
}

.learn-text-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.learn-card {
  display: flex;
  justify-content: center;
  padding: var(--space-md);
  background: var(--paper);
  border-radius: 4px;
  box-shadow: 0 4px 12px var(--paper-shadow);
}

.learn-note svg {
  display: block;
  width: 100%;
  max-width: 360px;
  height: auto;
}

.learn-stats,
.learn-hint,
.learn-prompt,
.learn-feedback {
  margin: 0;
  text-align: center;
}

.learn-stats,
.learn-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.learn-prompt {
  font-size: 1.1rem;
}

.learn-answers {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-sm);
}

.learn-answer {
  padding: var(--space-md) 0;
  background: var(--surface);
  color: var(--text);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  font-family: inherit;
  font-size: 1.1rem;
  cursor: pointer;
}

.learn-answer:hover:not(:disabled) {
  border-color: var(--accent);
}

.learn-answer.correct {
  background: var(--correct);
  border-color: var(--correct);
  color: white;
}

.learn-answer.wrong {
  background: var(--wrong);
  border-color: var(--wrong);
  color: white;
}

.learn-feedback {
  min-height: 1.5em;
}

.learn-view[data-result='correct'] .learn-feedback {
  color: var(--correct);
}

.learn-view[data-result='wrong'] .learn-feedback {
  color: var(--wrong);
}

.learn-next {
  align-self: center;
}

.learn-lessons[hidden],
.learn-quiz[hidden] {
  display: none;
}

.learn-examples {
  display: flex;
  justify-content: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.learn-example {
  background: var(--paper);
  border-radius: 4px;
  padding: var(--space-sm);
}

.learn-example svg {
  display: block;
  width: 220px;
  height: auto;
}

.learn-lesson-title {
  font-family: var(--font-serif);
  font-weight: 500;
  text-align: center;
}

.learn-lesson-body {
  line-height: 1.8;
}

.learn-lesson-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
}

.learn-lesson-count {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.8rem;
}

@media (max-width: 520px) {
  .learn-answer {
    font-size: 0.95rem;
  }
}
```

`src/main.ts`: add imports

```ts
import { LearnView } from './learn/learnView';
import { NameTheNoteQuiz } from './learn/nameTheNote';
import { NoteStats } from './learn/noteStats';
import { createNoteCardRenderer, type NotationToolkit } from './learn/noteCard';
```

Keep the Verovio module so a second toolkit can be created: add `let verovioModule: Awaited<ReturnType<typeof createVerovioModule>>;` next to `let toolkit: VerovioToolkit;` and, in `init()`, change `const VerovioModule = await createVerovioModule();` to `const VerovioModule = await createVerovioModule(); verovioModule = VerovioModule;`. Then add and call `setupLearnMode();` in `init()` right after `setupPiano();`:

```ts
function setupLearnMode() {
  const quizToolkit = new VerovioToolkit(verovioModule) as unknown as NotationToolkit;
  const view = new LearnView({
    quiz: new NameTheNoteQuiz(new NoteStats()),
    hub: noteInput,
    renderNote: createNoteCardRenderer(quizToolkit),
    formatLetter: (letter) => formatNoteName(letter, getNoteNameSystem()),
    onClose: () => setLearnOpen(false),
  });
  document.getElementById('musicStand')!.appendChild(view.element);

  const toggle = document.getElementById('learnToggle')!;
  function setLearnOpen(open: boolean) {
    document.body.classList.toggle('learn-open', open);
    toggle.classList.toggle('active', open);
    toggle.setAttribute('aria-pressed', String(open));
  }
  toggle.addEventListener('click', () => {
    if (view.isOpen()) {
      view.close();
      return;
    }
    if (isPlaying) stop();
    setLearnOpen(true);
    view.open();
  });

  onLocaleChange(() => view.refresh());
  onNoteNamesChange(() => view.refresh());
}
```

- [ ] **Step 7: Verify in the browser**

```bash
npm test
npx tsc --noEmit
npm run build
```
In the browser (English, then Persian): the book button opens the lessons the first time (five screens with small staves, last screen has "Start practising"); then the quiz shows one note on a staff; clicking the right letter turns the button green and moves on; a wrong letter shows the correct name in red and a "Next note" button; with the piano open, pressing the right key also answers. Check Persian: buttons read دو ر می فا سل لا سی, text is right-to-left, the staff and the button row are not mirrored. If the time signature appears on the card, Verovio ignored `print-object="no"`; remove the `<time>` element from `buildSingleNoteXml` instead and update the test only if it asserted it.

- [ ] **Step 8: Persian text check and commit**

Lint the new Persian strings the same way as in Task 3 Step 10, then:

```bash
git add -A
git commit -m "feat(learn): Name the note quiz and short bilingual lessons"
```

---

### Task 10: End-to-end tests, documentation, project index and final verification

**Files:**
- Create: `e2e/bilingual.spec.ts`
- Modify: `README.md`, `README.fa.md`, `CLAUDE.md`, `docs/superpowers/specs/2026-10-16-bilingual-note-trainer-design.md`
- Modify (outside the repo): `C:\AI\Projects\README.md`; memory files `ai-projects-hub.md`, new `music-notes-trainer.md`, `MEMORY.md` in `C:\Users\hesam\.claude\projects\C--Windows-System32\memory\`

- [ ] **Step 1: Write the end-to-end spec** (`e2e/bilingual.spec.ts`)

```ts
import { test, expect } from '@playwright/test';

test.describe('Bilingual interface and practice without MIDI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('#notation svg', { timeout: 15000 });
  });

  test('switches to Persian: right-to-left text, left-to-right notation', async ({ page }) => {
    await page.locator('#optionsToggle').click();
    await page.selectOption('#languageSelect', 'fa');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('.score-title h1')).toHaveText('نت‌خوانی');
    await expect(page.locator('#lessonInfo')).toContainText('نت گرد');
    const direction = await page.locator('#notation').evaluate((el) => getComputedStyle(el).direction);
    expect(direction).toBe('ltr');
  });

  test('remembers the language after a reload', async ({ page }) => {
    await page.locator('#optionsToggle').click();
    await page.selectOption('#languageSelect', 'fa');
    await page.reload();
    await page.waitForSelector('#notation svg', { timeout: 15000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('note names follow the chosen system', async ({ page }) => {
    await page.locator('#optionsToggle').click();
    await page.selectOption('#noteNameSystem', 'solfege');
    await expect(page.locator('#lessonInfo')).toContainText('Do and Sol');
  });

  test('on-screen piano and computer keyboard light the keys', async ({ page }) => {
    await page.locator('#pianoToggle').click();
    await expect(page.locator('#pianoDock')).toBeVisible();

    const e4 = page.locator('.piano-key[data-note="E4"]');
    await e4.dispatchEvent('pointerdown');
    await expect(e4).toHaveClass(/pressed/);
    await e4.dispatchEvent('pointerup');
    await expect(e4).not.toHaveClass(/pressed/);

    await page.keyboard.down('a');
    await expect(page.locator('.piano-key[data-note="C4"]')).toHaveClass(/pressed/);
    await page.keyboard.up('a');
  });

  test('shows note names under the notes', async ({ page }) => {
    await page.locator('#optionsToggle').click();
    await page.locator('#showNoteNames').evaluate((el: HTMLInputElement) => el.click());
    await expect(page.locator('#notation text.note-label').first()).toBeVisible();
  });

  test('Name the note: lessons first, then a question answered by clicking', async ({ page }) => {
    await page.locator('#learnToggle').click();
    const view = page.locator('#learnView');
    await expect(view).toHaveAttribute('data-panel', 'lessons');
    for (let i = 0; i < 4; i++) await page.locator('.learn-lesson-next').click();
    await page.locator('.learn-lesson-start').click();
    await expect(view).toHaveAttribute('data-panel', 'quiz');

    const pitch = await view.getAttribute('data-pitch');
    await page.locator(`.learn-answer[data-letter="${pitch![0]}"]`).click();
    await expect(view).toHaveAttribute('data-result', 'correct');
  });
});
```

- [ ] **Step 2: Run the end-to-end tests**

Run: `npx playwright test e2e/bilingual.spec.ts --project=chromium`
Expected: PASS. If Playwright says the browser build is missing, run `npx playwright install chromium` once (downloads a browser to the Playwright cache).

Then the whole suite, including the upstream tests and the two mobile projects:

Run: `npx playwright test`
Expected: all PASS. Fix any failure by correcting the code, not the upstream test (English is still the default, so upstream expectations should hold).

- [ ] **Step 3: Update the documentation**

- `README.md` and `README.fa.md`: change "What this fork adds (work in progress)" to present tense and add a short "How to use" section with: the language and note-name selectors in Options; the computer-keyboard map (`A S D F G H J K L ; '` white keys, `W E T Y U O P` black keys, `Z`/`X` octave down/up); the piano button; the book button for "Name the note" and the lessons. In the Persian README follow the persian-writing rules (every line starts with a Persian word; Latin terms such as `Z` and `X` stay inside backticks). Keep "Planned: microphone input".
- `CLAUDE.md`: add the module map from the **File Structure** table above and the test hooks (`data-panel`, `data-pitch`, `data-result` on `#learnView`).
- Spec: update the module list so it matches what was built (`formatNumber` lives in `i18n/index.ts`; `learn/noteCard.ts` and `learn/learnView.ts` exist; `rendering/noteLabels.ts` exists) and add under "Starting point" a line "Milestone 1 implemented 2026-10-16 (see the plan)".
- Open items to record in the README under "Known limitations": piano samples are fetched from `tonejs.github.io` (needs internet, one external request); Persian music terms await the owner's review; dev-tooling audit findings (Vite, Vitest, gh-pages) are not fixed yet.

- [ ] **Step 4: Update the project index and memory**

- `C:\AI\Projects\README.md` (edited by hand): read it, then add a `music-notes-trainer` entry in the `study` group in the same style as its neighbours: one line with the purpose (bilingual note-reading trainer, fork of `ftrain/sightreading`), the path `study\music-notes-trainer`, status (local only, milestone 1 done), and the run command `npm run dev`.
- Memory: in `ai-projects-hub.md` add `music-notes-trainer` to the `study\` list. Create `music-notes-trainer.md` (frontmatter `name: music-notes-trainer`, `type: project`) recording: what it is, the base and why, the owner's decisions (solfège plus letters, local only, inputs), where the plan and spec are, what milestone 2 is (microphone), and the open items. Add one line to `MEMORY.md`.

- [ ] **Step 5: Final verification (all of it, with the output in front of you)**

```bash
npm test
npx tsc --noEmit
npm run build
npm audit --omit=dev
npx playwright test
git status --short
git remote -v
git log --oneline -15
```
Expected: all unit and end-to-end tests pass; `tsc` and the build succeed; `found 0 vulnerabilities` for production dependencies; `git status` clean; the only remote is `upstream` with push URL `DISABLED-local-only`.

Then a manual pass in the browser with screenshots in English and in Persian: level 1a with note names on; the piano open with key hints; the quiz with a right and a wrong answer; the lessons; the language switch back and forth; a reload. Confirm the Persian text has joined letters and correct punctuation, and that nothing is mirrored that should not be (staff, piano, answer buttons).

- [ ] **Step 6: Clean up and commit**

Stop the dev server, close the browser tab used for checking, then:

```bash
git add -A
git commit -m "test(e2e): bilingual and no-MIDI flows; update docs and notes"
```

---

## Self-Review

**Spec coverage.** Language switch and RTL (Tasks 1, 3, 4); Persian digits (1, 3); note-name systems and key names (2, 3); computer keyboard by physical key (5); on-screen piano with key labels and hints (6); note names on the staff (7); weak-note scheduling, stats and stages (8); "Name the note" and the five lessons (9); persistence keys `ui.locale`, `ui.persianDigits`, `ui.noteNames`, `ui.showNoteNames`, `ui.pianoOpen`, `learn.seenLessons`, `noteStats.v1` (1, 2, 6, 7, 8, 9); error handling for missing keys, storage and MIDI (1, 8, 5); tests (every task, plus Task 10); docs and index (10). Microphone input is milestone 2 and gets its own short design and plan. No spec requirement lacks a task.

**Placeholder scan.** Every code step contains the code. The only "inspect then adjust" steps are visual tuning (label offsets, font URL, `print-object`), each with a concrete fallback.

**Type consistency.** `NoteSource`, `NoteInputHub`, `ComputerKeyboard(hub, target, onOctaveChange)`, `OnScreenPiano.setHints/setLabelFormatter`, `NoteStats.record(pitch, stage, correct, now)` / `recent(stage)` / `getMaxStage()` / `unlock()`, `NameTheNoteQuiz.next/current/answerLetter/answerPitch/recentAccuracy/setStage`, `LearnView` dependencies and `data-*` hooks, and `formatNoteName(note, system, options)` are used with the same names and signatures in every task that mentions them. `MAX_STAGE` and `RECENT_LIMIT` are exported from `noteStats.ts` and imported by `nameTheNote.ts` and `learnView.ts`.

