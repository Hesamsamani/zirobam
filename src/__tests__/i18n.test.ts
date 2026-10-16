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
