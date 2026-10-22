// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { Appearance, THEME_COLOR } from '../src/ui/appearance';

/**
 * The small script in the <head> of index.html puts the stored theme, accent and language on the page before the first
 * paint. It must agree with the Appearance module, which takes over when the app starts, or the page would flash.
 */

const html = readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
const script = /<script>([\s\S]*?)<\/script>/.exec(head)![1];

function page() {
  const doc = document.implementation.createHTMLDocument('t');
  const meta = doc.createElement('meta');
  meta.name = 'theme-color';
  meta.content = '#1a1a1a';
  doc.head.append(meta);
  return doc;
}

function runScript(doc: Document, stored: Record<string, string>, prefersLight: boolean, storageThrows = false): void {
  const fakeWindow = {
    get localStorage(): Storage {
      if (storageThrows) throw new Error('no storage');
      return { getItem: (k: string) => stored[k] ?? null } as Storage;
    },
    matchMedia: () => ({ matches: prefersLight }),
  };
  // the script of the page itself, run against a page and a window made here
  vm.runInNewContext(script, { document: doc, window: fakeWindow });
}

const themeColor = (doc: Document) => doc.querySelector('meta[name="theme-color"]')!.getAttribute('content');

describe('the boot script in index.html', () => {
  it('is the first script of the head, and sits after the theme-color meta it updates', () => {
    expect(head.indexOf('name="theme-color"')).toBeGreaterThan(-1);
    expect(head.indexOf('name="theme-color"')).toBeLessThan(head.indexOf('<script>'));
    expect(script).toContain("'ui.theme'");
    expect(script).toContain("'ui.accent'");
    expect(script).toContain("'ui.locale'");
  });

  const themes = [undefined, 'dark', 'light', 'system', 'sepia'];
  const accents = [undefined, 'brass', 'rose', 'silver', 'teal'];
  for (const theme of themes) {
    for (const prefersLight of [false, true]) {
      it(`sets what Appearance sets: theme ${theme ?? 'none'}, device ${prefersLight ? 'light' : 'dark'}`, () => {
        for (const accent of accents) {
          const stored: Record<string, string> = {};
          if (theme) stored['ui.theme'] = theme;
          if (accent) stored['ui.accent'] = accent;
          const booted = page();
          runScript(booted, stored, prefersLight);
          const app = page();
          new Appearance({ doc: app, get: (k) => stored[k] ?? null, set: () => undefined, matchMedia: () => ({ matches: prefersLight, addEventListener: () => undefined, removeEventListener: () => undefined }) as unknown as MediaQueryList });
          const label = `${theme}/${accent}`;
          expect(booted.documentElement.dataset.theme, label).toBe(app.documentElement.dataset.theme);
          expect(booted.documentElement.dataset.accent, label).toBe(app.documentElement.dataset.accent);
          expect(themeColor(booted), label).toBe(themeColor(app));
        }
      });
    }
  }

  it('makes the page right-to-left for Persian before it is drawn, and leaves English alone', () => {
    const fa = page();
    runScript(fa, { 'ui.locale': 'fa' }, false);
    expect(fa.documentElement.getAttribute('lang')).toBe('fa');
    expect(fa.documentElement.getAttribute('dir')).toBe('rtl');
    for (const locale of [undefined, 'en', 'de']) {
      const other = page();
      runScript(other, locale ? { 'ui.locale': locale } : {}, false);
      expect(other.documentElement.hasAttribute('dir'), String(locale)).toBe(false);
    }
  });

  it('gives the light page colour to the browser bar, and no more', () => {
    const light = page();
    runScript(light, { 'ui.theme': 'light' }, false);
    expect(themeColor(light)).toBe(THEME_COLOR.light);
    const dark = page();
    runScript(dark, {}, false);
    expect(themeColor(dark)).toBe('#1a1a1a');
  });

  it('does nothing, and does not throw, where storage is not allowed', () => {
    const doc = page();
    expect(() => runScript(doc, {}, true, true)).not.toThrow();
    expect(doc.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(themeColor(doc)).toBe('#1a1a1a');
  });
});
