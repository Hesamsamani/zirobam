import type { heatmapEn } from './heatmap.en';

// Typed against the English part, so a string missing here fails the build.
export const heatmapFa: Record<keyof typeof heatmapEn, string> = {
  'heat.title': 'کجا اشتباه می‌کنید',
  'heat.period': 'هشت هفته‌ی گذشته.',
  'heat.empty': 'هنوز چیزی برای نشان دادن نیست. آزمون نت، تمرین گوش، آکوردخوان، یک گام یا یک قطعه را بزنید تا نت‌هایی که اشتباه می‌کنید اینجا پیدا شوند.',

  'heat.keys': 'کلیدها، هرچه تیره‌تر بیشتر اشتباه شده',
  'heat.keys.aria': 'یک صفحه‌کلید: کلیدهایی که بیشتر اشتباه می‌کنید رنگ دارند',
  'heat.notes': 'نت‌هایی که بیشتر اشتباه می‌کنید',
  'heat.chords': 'آکوردهایی که بیشتر اشتباه می‌کنید',
  'heat.slip': '{name}: {missed} اشتباه از {asked} ({percent})',
  'heat.none': 'نتی را زیاد اشتباه نمی‌کنید.',

  'heat.rhythm': 'ریتم',
  'heat.rhythm.line': 'سر وقت {hits}، زود {early}، دیر {late}، نزده {missed}.',
  'heat.rhythm.early': 'تمایل دارید زودتر بزنید.',
  'heat.rhythm.late': 'تمایل دارید دیرتر بزنید.',

  'heat.trend': 'هفته به هفته',
  'heat.trend.aria': 'سهم پاسخ‌های درست در هر یک از هشت هفته‌ی گذشته: {values}',
  'heat.trend.noData': 'بدون داده',
};
