// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ACCENTS, Appearance } from '../src/ui/appearance';
import { bindAppearance } from '../src/ui/appearancePanel';
import { en } from '../src/i18n/locales/en';
import { fa } from '../src/i18n/locales/fa';

/** The group is written in index.html next to the other settings; the test takes the real markup. */
const html = readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const groupMarkup = new DOMParser().parseFromString(html, 'text/html').getElementById('appearanceGroup')!;

let data: Map<string, string>;
let appearance: Appearance;
let group: HTMLElement;

const select = () => group.querySelector<HTMLSelectElement>('#themeSelect')!;
const swatch = (accent: string) => group.querySelector<HTMLButtonElement>(`[data-accent="${accent}"]`)!;
const swatches = () => [...group.querySelectorAll<HTMLButtonElement>('[data-accent]')];
const press = (el: HTMLElement, key: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

beforeEach(() => {
  data = new Map();
  document.documentElement.removeAttribute('dir');
  document.body.replaceChildren();
  group = groupMarkup.cloneNode(true) as HTMLElement;
  document.body.append(group);
  appearance = new Appearance({ doc: document, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as MediaQueryList });
  bindAppearance(appearance, group);
});

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-accent');
});

describe('the markup in index.html', () => {
  it('has a swatch for each accent, in the order of the module, each named for a screen reader', () => {
    expect(swatches().map((s) => s.dataset.accent)).toEqual([...ACCENTS]);
    for (const s of swatches()) {
      expect(s.getAttribute('role')).toBe('radio');
      expect(s.getAttribute('aria-label'), s.dataset.accent).toBeTruthy();
    }
    expect(group.querySelector('[role="radiogroup"]')!.getAttribute('aria-labelledby')).toBe('accentLabel');
  });

  it('uses only texts that exist in English and in Persian', () => {
    const keys = new Set<string>();
    for (const el of group.querySelectorAll<HTMLElement>('[data-i18n]')) keys.add(el.dataset.i18n!);
    for (const el of group.querySelectorAll<HTMLElement>('[data-i18n-attr]')) for (const pair of el.dataset.i18nAttr!.split(';')) keys.add(pair.split(':')[1].trim());
    expect(keys.size).toBe(12); // the title, the list and its three choices, the accent label and six colours
    for (const key of keys) {
      expect(key in en, `${key} in English`).toBe(true);
      expect(key in fa, `${key} in Persian`).toBe(true);
    }
  });
});

describe('bindAppearance', () => {
  it('shows what is chosen', () => {
    expect(select().value).toBe('dark');
    expect(swatch('brass').getAttribute('aria-checked')).toBe('true');
    expect(swatch('brass').tabIndex).toBe(0);
    expect(swatch('violet').getAttribute('aria-checked')).toBe('false');
    expect(swatch('violet').tabIndex).toBe(-1);
  });

  it('changes the theme from the list', () => {
    select().value = 'light';
    select().dispatchEvent(new Event('change', { bubbles: true }));
    expect(appearance.choice()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    select().value = 'system';
    select().dispatchEvent(new Event('change', { bubbles: true }));
    expect(appearance.choice()).toBe('system');
  });

  it('changes the accent from a swatch, and shows it', () => {
    swatch('violet').click();
    expect(appearance.accent()).toBe('violet');
    expect(document.documentElement.dataset.accent).toBe('violet');
    expect(swatch('violet').getAttribute('aria-checked')).toBe('true');
    expect(swatch('brass').getAttribute('aria-checked')).toBe('false');
    expect(swatch('violet').tabIndex).toBe(0);
    expect(swatch('brass').tabIndex).toBe(-1);
  });

  it('follows a change made somewhere else (the quick button)', () => {
    appearance.toggleTheme();
    expect(select().value).toBe('light');
    appearance.setAccent('copper');
    expect(swatch('copper').getAttribute('aria-checked')).toBe('true');
  });

  it('moves with the arrow keys like a group of radio buttons: it chooses and takes the focus along, and wraps', () => {
    swatch('brass').focus();
    press(swatch('brass'), 'ArrowRight');
    expect(appearance.accent()).toBe('violet');
    expect(document.activeElement).toBe(swatch('violet'));
    press(swatch('violet'), 'ArrowDown');
    expect(appearance.accent()).toBe('blue');
    press(swatch('blue'), 'ArrowUp');
    expect(appearance.accent()).toBe('violet');
    press(swatch('violet'), 'ArrowLeft');
    expect(appearance.accent()).toBe('brass');
    press(swatch('brass'), 'ArrowLeft');
    expect(appearance.accent()).toBe('silver'); // wraps round
    press(swatch('silver'), 'Home');
    expect(appearance.accent()).toBe('brass');
    press(swatch('brass'), 'End');
    expect(appearance.accent()).toBe('silver');
  });

  it('turns the left and right arrows round for a right-to-left language', () => {
    document.documentElement.dir = 'rtl';
    swatch('brass').focus();
    press(swatch('brass'), 'ArrowLeft');
    expect(appearance.accent()).toBe('violet');
    press(swatch('violet'), 'ArrowRight');
    expect(appearance.accent()).toBe('brass');
  });

  it('ignores other keys', () => {
    swatch('brass').focus();
    press(swatch('brass'), 'a');
    expect(appearance.accent()).toBe('brass');
  });
});
