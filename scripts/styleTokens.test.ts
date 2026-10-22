// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

/**
 * The style sheets use colour tokens, not colour literals, so a theme can change them all (src/styles/tokens.css).
 * Colours that are music stay as they are in every theme and are listed here: keys, staves and the paper cards that
 * hold them, and the inks on that paper. A new literal anywhere else fails this test: use a token, or add a token.
 */

const ROOT = path.resolve(__dirname, '..');
const STYLES = path.join(ROOT, 'src', 'styles');
const SHEETS = ['src/style.css', ...readdirSync(STYLES).filter((f) => f.endsWith('.css') && f !== 'tokens.css').map((f) => `src/styles/${f}`)];
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

const COLOUR = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|(?<![\w-])(?:white|black)(?![\w-])/g;

/** Selectors of things that are music or sit on paper: their colours are the same in every theme. */
const PAPER = [
  /\.piano(-key)?\b/,
  /\.lk-/,
  /\.sc-keys/,
  /\.fp-/,
  /\.fretboard/,
  /\.cd-/,
  /\.dict-card/,
  /\.gen-chord/,
  /\.hm-/,
  /\.rh-staff/,
  /\.menu-resume/,
  /\.menu-header::before/,
  /\.xylo-bar/,
  /\.lesson-(caption|play)\b/,
  /\.(catalog|score)-confirm-yes/,
  /\.backup-yes/,
  /\.menu-path:hover/,
  /\.pips/,
];

describe('colour literals', () => {
  it('are only in tokens.css, or on paper and keys, or in a mask or the print styles', () => {
    const offenders: string[] = [];
    for (const file of SHEETS) {
      postcss.parse(read(file), { from: file }).walkDecls((decl) => {
        const found = (decl.value.match(COLOUR) ?? []).filter((c) => !c.includes('var('));
        if (found.length === 0 || /mask/.test(decl.prop)) return;
        for (let p = decl.parent; p; p = p.parent) if (p.type === 'atrule' && (p as postcss.AtRule).name === 'media' && /print/.test((p as postcss.AtRule).params)) return;
        const rule = decl.parent;
        const selector = rule && rule.type === 'rule' ? (rule as postcss.Rule).selector : '';
        if (PAPER.some((pattern) => pattern.test(selector))) return;
        offenders.push(`${file}:${decl.source?.start?.line} ${selector.replace(/\s+/g, ' ').slice(0, 50)} { ${decl.prop}: ${found.join(' ')} }`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('are defined for the dark theme in the :root of tokens.css, and a theme or an accent only overrides them', () => {
    const tokens = postcss.parse(read('src/styles/tokens.css'));
    const names = new Set<string>();
    tokens.walkRules((rule) => {
      if (rule.selector === ':root') rule.walkDecls((d) => names.add(d.prop));
    });
    for (const name of ['--tint', '--shade', '--shade-k', '--scrim-rgb', '--current-rgb', '--accent-rgb', '--correct-rgb', '--wrong-rgb', '--quarter-rgb', '--on-accent', '--error-text', '--success-text', '--current-paper', '--note-past']) {
      expect(names.has(name), name).toBe(true);
    }
  });
});
