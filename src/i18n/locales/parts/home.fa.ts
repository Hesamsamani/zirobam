import type { homeEn } from './home.en';

// Typed against the English part, so a string missing here fails the build.
export const homeFa: Record<keyof typeof homeEn, string> = {
  'menu.tagline': 'زیر و بم موسیقی: بخوانید، بشنوید، بنوازید.',
  'menu.credits.source': 'کد برنامه',
  'menu.credits.piano': 'صدای پیانو: پیانوی بزرگ سالامندر (CC BY 3.0)',
};
