// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

/**
 * Every theme and every accent must be readable. This reads src/styles/tokens.css, imitates the cascade of
 * `:root`, `:root[data-theme]`, `:root[data-accent]` and the two together, and checks the contrast of the colours
 * the app puts on each other (WCAG 2: 4.5 for small text, 7 for the main text), and that no accent can be mistaken
 * for the colours that carry a meaning: quarter tone (teal), wrong (red) and right (green).
 */

const tokens = postcss.parse(readFileSync(path.resolve(__dirname, '..', 'src', 'styles', 'tokens.css'), 'utf8'));

interface Block {
  attrs: Record<string, string>;
  order: number;
  decls: Map<string, string>;
}
const blocks: Block[] = [];
tokens.walkRules((rule) => {
  const m = /^:root((?:\[data-(?:theme|accent)='[a-z]+'\])*)$/.exec(rule.selector.trim());
  if (!m) return;
  const attrs: Record<string, string> = {};
  for (const a of m[1].matchAll(/\[data-(theme|accent)='([a-z]+)'\]/g)) attrs[a[1]] = a[2];
  const decls = new Map<string, string>();
  rule.walkDecls((d) => void (d.prop.startsWith('--') || d.prop === 'color-scheme' ? decls.set(d.prop, d.value.trim()) : undefined));
  blocks.push({ attrs, order: blocks.length, decls });
});

const THEMES = ['dark', 'light'] as const;
const ACCENTS = ['brass', 'violet', 'blue', 'rose', 'copper', 'silver'] as const;

/** The custom properties on <html> for a theme and an accent: the later and the more specific rule wins. */
function cascade(theme: string, accent: string): Map<string, string> {
  const applicable = blocks
    .filter((b) => (b.attrs.theme === undefined || b.attrs.theme === theme) && (b.attrs.accent === undefined || b.attrs.accent === accent))
    .sort((a, b) => Object.keys(a.attrs).length - Object.keys(b.attrs).length || a.order - b.order);
  const all = new Map<string, string>();
  for (const block of applicable) for (const [k, v] of block.decls) all.set(k, v);
  return all;
}

function colour(all: Map<string, string>, name: string): [number, number, number] {
  let value = all.get(name);
  for (let i = 0; i < 6 && value !== undefined && value.startsWith('var('); i++) value = all.get(/var\((--[\w-]+)\)/.exec(value)![1]);
  if (value === undefined) throw new Error(`${name} is not defined`);
  let hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)?.[1];
  if (!hex) throw new Error(`${name} is ${value}, not a hex colour`);
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(hex!.slice(i, i + 2), 16)) as [number, number, number];
}

const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
function ratio(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function oklch(rgb: number[]) {
  const [r, g, b] = rgb.map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { chroma: Math.hypot(a, bb), hue: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 };
}
const hueGap = (a: number[], b: number[]) => {
  const d = Math.abs(oklch(a).hue - oklch(b).hue) % 360;
  return d > 180 ? 360 - d : d;
};

const SURFACES = ['--bg', '--surface-1', '--surface-2', '--surface-3'];

describe.each(THEMES.flatMap((theme) => ACCENTS.map((accent) => [theme, accent] as const)))('%s theme, %s accent', (theme, accent) => {
  const all = cascade(theme, accent);
  const c = (name: string) => colour(all, name);

  it('keeps the text readable on every surface', () => {
    for (const surface of SURFACES) {
      expect(ratio(c('--text'), c(surface)), `--text on ${surface}`).toBeGreaterThanOrEqual(7);
      expect(ratio(c('--text-soft'), c(surface)), `--text-soft on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('reads the "now and selected" colour on the page, and white on a filled accent control', () => {
    for (const surface of ['--bg', '--surface-3']) expect(ratio(c('--current'), c(surface)), `--current on ${surface}`).toBeGreaterThanOrEqual(4.5);
    expect(ratio(c('--on-accent'), c('--accent')), '--on-accent on --accent').toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the hover fill readable: as text on the page, and with white text when it is deep (light theme)', () => {
    expect(ratio(c('--accent-light'), c('--bg')), '--accent-light on --bg').toBeGreaterThanOrEqual(4.5);
    if (theme === 'light') {
      for (const surface of SURFACES) expect(ratio(c('--accent-light'), c(surface)), `--accent-light on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c('--on-accent'), c('--accent-light')), '--on-accent on --accent-light').toBeGreaterThanOrEqual(4.5);
    }
  });

  it('reads the colours that carry a meaning: quarter tone, error and success', () => {
    for (const surface of ['--bg', '--surface-3']) {
      for (const name of ['--quarter', '--error-text', '--error-text-2', '--success-text']) expect(ratio(c(name), c(surface)), `${name} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(ratio(c('--quarter-ink'), c('--paper')), '--quarter-ink on --paper').toBeGreaterThanOrEqual(4.5);
  });

  it('keeps music on paper: the ink is readable on it, and the paper is the same in every theme', () => {
    expect(ratio(c('--ink'), c('--paper'))).toBeGreaterThanOrEqual(7);
    expect(c('--paper')).toEqual([248, 245, 240]);
    expect(c('--current-paper')).toEqual([201, 162, 39]);
  });

  it('is not mistaken for quarter tone, wrong or right', () => {
    const current = c('--current');
    if (oklch(current).chroma < 0.03) return; // silver has no hue to confuse
    for (const meaning of ['--quarter', '--correct', '--wrong']) {
      expect(hueGap(current, c(meaning)), `--current against ${meaning}`).toBeGreaterThanOrEqual(30);
    }
  });
});

describe('the accents', () => {
  it('are the six of the Appearance module, each with a swatch for the picker', () => {
    const dark = cascade('dark', 'brass');
    for (const accent of ACCENTS) expect(dark.has(`--swatch-${accent}`), `--swatch-${accent}`).toBe(true);
  });

  it('give the light theme a colour scheme of its own, and leave the dark one to the page', () => {
    expect(cascade('light', 'brass').get('color-scheme')).toBe('light');
    expect(cascade('dark', 'brass').has('color-scheme')).toBe(false);
  });
});
