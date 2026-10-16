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
