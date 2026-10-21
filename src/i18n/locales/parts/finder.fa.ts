import type { finderEn } from './finder.en';

// Typed against the English part, so a string missing here fails the build.
export const finderFa: Record<keyof typeof finderEn, string> = {
  'dict.tab.find': 'یافتن',

  'find.title': 'یافتن گام',
  'find.hint': 'نت‌هایی را که دارید انتخاب کنید یا روی کیبورد میدی بزنید. گام‌هایی که همه‌ی آن نت‌ها را دارند فهرست می‌شوند و نزدیک‌ترین‌ها اول می‌آیند.',
  'find.notes': 'نت‌ها',
  'find.clear': 'پاک کردن',
  'find.none': 'هنوز نتی انتخاب نشده است.',
  'find.empty': 'هیچ گامی همه‌ی این نت‌ها را ندارد.',
  'find.found': 'گام‌های پیداشده: {count}',
  'find.exact': 'دقیقاً همین نت‌ها',
  'find.more': '{count} نت بیشتر',

  'circle.title': 'دایره‌ی پنجم‌ها',
  'circle.hint': 'روی یک کلید بزنید تا گامش باز شود. بیرون: کلیدهای ماژور. درون: مینورهای هم‌نشانه‌ی آن‌ها. عدد کوچک تعداد علامت‌های کلید است.',
  'circle.aria': 'دایره‌ی پنجم‌ها',
};
