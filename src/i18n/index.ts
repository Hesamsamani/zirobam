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
