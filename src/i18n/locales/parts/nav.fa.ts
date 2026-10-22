import type { navEn } from './nav.en';

// Typed against the English part, so a string missing here fails the build.
export const navFa: Record<keyof typeof navEn, string> = {
  'nav.label': 'پیمایش اصلی',
  'nav.skip': 'رفتن به محتوا',
  'nav.homeLabel': 'خانه',
  'nav.group.start': 'شروع',
  'nav.group.learn': 'یادگیری',
  'nav.group.play': 'نواختن',
  'nav.group.tools': 'ابزارها',
  'nav.open': 'باز کردن منو',
  'nav.close': 'بستن منو',
  'nav.expand': 'نمایش نام‌ها',
  'nav.collapse': 'پنهان کردن نام‌ها',
  'nav.language.toFa': 'تغییر زبان به فارسی',
  'nav.language.toEn': 'تغییر زبان به انگلیسی',
  'nav.theme.toLight': 'حالت روشن',
  'nav.theme.toDark': 'حالت تیره',
};
