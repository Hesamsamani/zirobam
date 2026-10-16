import type { Bi, Block } from './types';
import type { StaffExample } from './exampleXml';

/** Short ways to write the blocks of a lesson. */
export const p = (en: string, fa: string): Block => ({ type: 'text', text: { en, fa } });
export const h = (en: string, fa: string): Block => ({ type: 'heading', text: { en, fa } });
export const tip = (en: string, fa: string): Block => ({ type: 'tip', text: { en, fa } });
export const list = (...items: Array<[string, string]>): Block => ({
  type: 'list',
  items: items.map(([en, fa]) => ({ en, fa })),
});
export const terms = (...items: Array<[string, string, string]>): Block => ({
  type: 'terms',
  items: items.map(([symbol, en, fa]) => ({ symbol, text: { en, fa } })),
});

interface StaffOptions {
  names?: boolean | 'octave';
  listen?: boolean;
}

const caption = (en?: string, fa?: string): Bi | undefined => (en !== undefined && fa !== undefined ? { en, fa } : undefined);

export const staff = (spec: StaffExample, en?: string, fa?: string, options: StaffOptions = {}): Block => ({
  type: 'staff',
  spec,
  caption: caption(en, fa),
  ...options,
});

export const keys = (
  from: string,
  to: string,
  options: { names?: 'none' | 'white' | 'all'; marks?: Record<string, string> },
  en?: string,
  fa?: string
): Block => ({ type: 'keys', from, to, caption: caption(en, fa), ...options });

export const fingers = (en?: string, fa?: string): Block => ({ type: 'fingers', caption: caption(en, fa) });
