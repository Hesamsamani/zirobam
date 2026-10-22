import { describe, expect, it, vi } from 'vitest';
import { ACCENTS, Appearance, THEME_COLOR, isAccent, isThemeChoice, resolveTheme } from '../ui/appearance';
import { isBackupKey } from '../backup/backup';

/** A page of its own for each test, and a store in memory that can be told to throw. */
function setup({ stored = {}, prefersLight = false, withMeta = true }: { stored?: Record<string, string>; prefersLight?: boolean; withMeta?: boolean } = {}) {
  const doc = document.implementation.createHTMLDocument('t');
  if (withMeta) {
    const meta = doc.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#1a1a1a';
    doc.head.append(meta);
  }
  const data = new Map(Object.entries(stored));
  const listeners = new Set<(event: { matches: boolean }) => void>();
  const query = {
    matches: prefersLight,
    addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => listeners.delete(listener),
  } as unknown as MediaQueryList;
  const media = vi.fn((q: string) => {
    void q;
    return query;
  });
  const appearance = new Appearance({ doc, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), matchMedia: media });
  return {
    appearance,
    data,
    doc,
    media,
    html: doc.documentElement,
    themeColor: () => doc.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    /** The device switches between light and dark. */
    device(light: boolean) {
      (query as unknown as { matches: boolean }).matches = light;
      for (const listener of [...listeners]) listener({ matches: light });
    },
    listenerCount: () => listeners.size,
  };
}

describe('resolveTheme', () => {
  it('is dark or light as chosen, and follows the device only for "system"', () => {
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('system', true)).toBe('light');
    expect(resolveTheme('system', false)).toBe('dark');
  });

  it('knows which stored words are themes and accents', () => {
    expect(isThemeChoice('system')).toBe(true);
    expect(isThemeChoice('sepia')).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
    expect(ACCENTS).toEqual(['brass', 'violet', 'blue', 'rose', 'copper', 'silver']);
    expect(isAccent('rose')).toBe(true);
    expect(isAccent('teal')).toBe(false); // teal means quarter tone, red wrong and green right: not offered
  });
});

describe('Appearance', () => {
  it('starts dark with the brass accent, and puts both on the page', () => {
    const t = setup();
    expect(t.appearance.choice()).toBe('dark');
    expect(t.appearance.theme()).toBe('dark');
    expect(t.appearance.accent()).toBe('brass');
    expect(t.html.dataset.theme).toBe('dark');
    expect(t.html.dataset.accent).toBe('brass');
    expect(t.themeColor()).toBe(THEME_COLOR.dark);
  });

  it('reads what was kept, and an unknown word is the default', () => {
    const kept = setup({ stored: { 'ui.theme': 'light', 'ui.accent': 'violet' } });
    expect(kept.html.dataset.theme).toBe('light');
    expect(kept.html.dataset.accent).toBe('violet');
    expect(kept.themeColor()).toBe(THEME_COLOR.light);
    const odd = setup({ stored: { 'ui.theme': 'sepia', 'ui.accent': 'teal' } });
    expect(odd.appearance.choice()).toBe('dark');
    expect(odd.appearance.accent()).toBe('brass');
  });

  it('puts the resolved theme on the page, so the style sheet only ever needs dark and light', () => {
    const t = setup({ stored: { 'ui.theme': 'system' }, prefersLight: true });
    expect(t.appearance.choice()).toBe('system');
    expect(t.html.dataset.theme).toBe('light');
  });

  it('follows the device while the choice is "system", and not otherwise', () => {
    const t = setup({ stored: { 'ui.theme': 'system' }, prefersLight: false });
    expect(t.html.dataset.theme).toBe('dark');
    t.device(true);
    expect(t.html.dataset.theme).toBe('light');
    expect(t.themeColor()).toBe(THEME_COLOR.light);
    t.appearance.setTheme('dark');
    t.device(false);
    t.device(true);
    expect(t.html.dataset.theme).toBe('dark'); // an explicit choice is not moved by the device
    expect(t.listenerCount()).toBe(0);
  });

  it('keeps the choice and the accent, and says so to those who listen', () => {
    const t = setup();
    const seen = vi.fn();
    const stop = t.appearance.onChange(seen);
    t.appearance.setTheme('light');
    expect(t.data.get('ui.theme')).toBe('light');
    expect(seen).toHaveBeenLastCalledWith({ choice: 'light', theme: 'light', accent: 'brass' });
    t.appearance.setAccent('copper');
    expect(t.data.get('ui.accent')).toBe('copper');
    expect(t.html.dataset.accent).toBe('copper');
    expect(seen).toHaveBeenLastCalledWith({ choice: 'light', theme: 'light', accent: 'copper' });
    expect(seen).toHaveBeenCalledTimes(2);
    // nothing changed: nothing is said
    t.appearance.setTheme('light');
    t.appearance.setAccent('copper');
    expect(seen).toHaveBeenCalledTimes(2);
    stop();
    t.appearance.setAccent('rose');
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it('refuses a theme or an accent it does not know', () => {
    const t = setup();
    t.appearance.setTheme('sepia' as never);
    t.appearance.setAccent('teal' as never);
    expect(t.appearance.choice()).toBe('dark');
    expect(t.appearance.accent()).toBe('brass');
    expect(t.data.size).toBe(0);
  });

  it('toggles between dark and light, and the toggle is an explicit choice from then on', () => {
    const t = setup();
    expect(t.appearance.toggleTheme()).toBe('light');
    expect(t.data.get('ui.theme')).toBe('light');
    expect(t.appearance.toggleTheme()).toBe('dark');
    expect(t.data.get('ui.theme')).toBe('dark');
  });

  it('toggles from what is on the screen when the choice is "system"', () => {
    const t = setup({ stored: { 'ui.theme': 'system' }, prefersLight: true });
    expect(t.html.dataset.theme).toBe('light');
    expect(t.appearance.toggleTheme()).toBe('dark');
    expect(t.appearance.choice()).toBe('dark');
  });

  it('works on a page without a theme-color tag, and with a store that throws', () => {
    const t = setup({ withMeta: false });
    expect(() => t.appearance.setTheme('light')).not.toThrow();
    expect(t.html.dataset.theme).toBe('light');
    const doc = document.implementation.createHTMLDocument('t');
    const broken = new Appearance({
      doc,
      get: () => {
        throw new Error('no storage');
      },
      set: () => {
        throw new Error('no storage');
      },
    });
    expect(broken.theme()).toBe('dark');
    expect(() => broken.setAccent('blue')).not.toThrow();
    expect(doc.documentElement.dataset.accent).toBe('blue');
  });

  it('works where the browser has no matchMedia', () => {
    const doc = document.implementation.createHTMLDocument('t');
    const appearance = new Appearance({ doc, get: () => 'system', set: () => undefined });
    expect(appearance.theme()).toBe('dark');
  });
});

describe('what is kept', () => {
  it('goes into a backup with the other settings', () => {
    expect(isBackupKey('ui.theme')).toBe(true);
    expect(isBackupKey('ui.accent')).toBe(true);
  });
});
