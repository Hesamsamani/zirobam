import { SCALES, type ScaleId } from './scaleCatalog';

/** A scale that fits what was typed, and the root that was typed with it, if any. */
export interface ScaleHit {
  id: ScaleId;
  /** The root as written (`Bb`, `Ek`), or null when the query had none. */
  rootName: string | null;
  /** The root as one of the twelve notes (0 is C); null when there was no root or it is a quarter tone. */
  rootPc: number | null;
  /** How well the scale fits: 100 for an exact name, less for a name that starts or contains the words. */
  score: number;
}

/** Words that only say what the thing is. */
const FILLER: ReadonlySet<string> = new Set(['scale', 'mode', 'dastgah', 'avaz', 'گام', 'دستگاه', 'آواز']);

const SEMITONES: Readonly<Record<string, number>> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const SOLFEGE: Readonly<Record<string, string>> = { do: 'c', re: 'd', mi: 'e', fa: 'f', sol: 'g', la: 'a', si: 'b', ti: 'b' };
const PERSIAN_SOLFEGE: Readonly<Record<string, string>> = { دو: 'c', ر: 'd', ره: 'd', می: 'e', فا: 'f', سل: 'g', لا: 'a', سی: 'b' };
/** A sign written as a word, to follow a root: `f sharp`, `فا دیز`. */
const SIGN_WORD: Readonly<Record<string, string>> = { sharp: '#', diez: '#', flat: 'b', bemol: 'b', koron: 'k', sori: 'o', دیز: '#', بمل: 'b', کرن: 'k', سری: 'o' };
const SIGN_OFFSET: Readonly<Record<string, number>> = { '': 0, '#': 1, b: -1 };

/** Lower case, the Persian forms of yeh and kaf, and no half-spaces, tatweel or diacritics, so that typing differences do not matter. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌ـً-ٟ]/g, '')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b');
}

/** A name with the spaces, hyphens and apostrophes taken out: "bayat-e tork" and "bayat e tork" compare equal. */
const collapse = (text: string): string => text.replace(/[\s'\-]+/g, '');

interface Root {
  name: string;
  pc: number | null;
}

function makeRoot(letter: string, sign: string): Root {
  const name = `${letter.toUpperCase()}${sign}`;
  return { name, pc: sign === 'k' || sign === 'o' ? null : (((SEMITONES[letter] + SIGN_OFFSET[sign]) % 12) + 12) % 12 };
}

/** A root at the start of the tokens, and how many tokens it took; null when the first token is not a root. */
function rootAt(tokens: readonly string[], index: number): { root: Root; used: number } | null {
  const token = tokens[index];
  const next = tokens[index + 1];
  let base: string | undefined;
  let sign: string | undefined; // a sign written on the token itself: `d#`, `fa#`, `ek`
  const solfege = /^(do|re|mi|fa|sol|la|si|ti)(#|b)?$/.exec(token); // solfège first: "do" is C, not D sori
  if (solfege) {
    base = SOLFEGE[solfege[1]];
    sign = solfege[2];
  } else {
    const letter = /^([a-g])(#|b|k|o)?$/.exec(token);
    if (letter) {
      base = letter[1];
      sign = letter[2];
    } else {
      base = PERSIAN_SOLFEGE[token];
    }
  }
  if (!base) return null;
  if (sign !== undefined) return { root: makeRoot(base, sign), used: 1 };
  // or a sign written as the next word: `f sharp`, `mi koron`, `فا دیز`
  const word = next !== undefined ? SIGN_WORD[next] : undefined;
  return word ? { root: makeRoot(base, word), used: 2 } : { root: makeRoot(base, ''), used: 1 };
}

const ALIASES = SCALES.map((scale) => ({ id: scale.id, words: [...scale.aliases.en, ...scale.aliases.fa].map((word) => collapse(normalize(word))) }));

/** How well the words fit a scale: 100 for an exact name, 70 for the start of one, 40 for a part of one. */
function fit(words: string, aliases: readonly string[]): number {
  let best = 0;
  for (const alias of aliases) {
    if (alias === words) return 100;
    if (words.length < 2) continue;
    if (alias.startsWith(words)) best = Math.max(best, 70);
    else if (alias.includes(words)) best = Math.max(best, 40);
  }
  return best;
}

/**
 * The scales that fit a query, best first. A root may stand anywhere in it, as a letter with a sign (`bb`, `F#`), a
 * letter and a word (`e flat`), solfège (`sol`) or Persian solfège (`ر`, `فا دیز`), with k or o (or `koron`, `sori`,
 * `کرن`, `سری`) for a quarter tone. A root alone gives every scale on it.
 */
export function searchScales(query: string): ScaleHit[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  let root: Root | null = null;
  const words: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (root === null) {
      const found = rootAt(tokens, i);
      if (found) {
        root = found.root;
        i += found.used - 1;
        continue;
      }
    }
    if (!FILLER.has(tokens[i])) words.push(tokens[i]);
  }

  const rootName = root?.name ?? null;
  const rootPc = root?.pc ?? null;
  if (words.length === 0) return root ? SCALES.map((scale) => ({ id: scale.id, rootName, rootPc, score: 1 })) : [];

  const wanted = collapse(words.join(' '));
  return ALIASES.map((entry, order) => ({ id: entry.id, rootName, rootPc, score: fit(wanted, entry.words), order }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ id, rootName: name, rootPc: pc, score }) => ({ id, rootName: name, rootPc: pc, score }));
}
