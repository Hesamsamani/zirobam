import type { dictionaryEn } from './dictionary.en';

// Typed against the English part, so a string missing here fails the build.
export const dictionaryFa: Record<keyof typeof dictionaryEn, string> = {
  'dict.title': 'فرهنگ‌نامه گام و آکورد',
  'dict.subtitle': 'گامی را انتخاب کنید، آن را روی حامل و کلیدها ببینید، بشنوید و آکوردهای آن را پیدا کنید.',
  'dict.tab.scales': 'گام‌ها',
  'dict.tab.chords': 'آکوردها',
  'dict.all': 'همه',

  'dict.search': 'جست‌وجوی گام',
  'dict.search.placeholder': 'مثلاً: دو دورین، لا مینور، شور',
  'dict.search.found': 'گام‌های پیداشده: {count}',
  'dict.search.none': 'گامی با «{query}» جور درنیامد.',
  'dict.categories': 'گروه‌های گام',
  'dict.scalesList': 'گام‌های این گروه',
  'dict.root': 'نت آغازین',
  'dict.root.koron': 'یک ربع‌پرده پایین‌تر (کرن)',
  'dict.root.koronHint': 'فقط برای نتی که دیز یا بمل ندارد',

  'dict.koron': 'کرن',
  'dict.sori': 'سری',

  'dict.scale.title': '{scale} روی {root}',
  'dict.steps': 'پله‌های گام، بر حسب پرده',
  'dict.step.aria': '{note}، درجه {degree}، فاصله {tones} پرده',

  'dict.persian.note':
    'دستگاه‌ها و آوازها این‌جا با یک الگوی آموزشی نشان داده می‌شوند: کرن یک ربع‌پرده پایین‌تر و سری یک ربع‌پرده بالاتر از نت نوشته‌شده است. صدای واقعی با دستگاه، شیوه اجرا و نوازنده فرق می‌کند.',
  'dict.persian.unreviewed': 'این نت‌ها هنوز توسط متخصص بررسی نشده‌اند.',
  'dict.persian.piano': 'روی پیانو، نت کرن یا سری روی کلید هم‌نام آن نواخته می‌شود.',

  'dict.chords.heading': 'آکوردهای این گام',
  'dict.chords.count': 'آکوردها: {count}',
  'dict.chords.family': 'نوع آکورد',
  'dict.chords.degree': 'آکوردهای روی',
  'dict.chords.allDegrees': 'همه درجه‌ها',
  'dict.chords.degreeOption': 'درجه {degree} ({note})',
  'dict.chords.primary': 'فقط آکوردهای اصلی (درجه ۱، ۴ و ۵)',
  'dict.chords.inversions': 'نمایش حالت‌های معکوس',
  'dict.chords.empty': 'آکوردی از این نوع در این گام جا نمی‌گیرد.',
  'dict.chords.quarter':
    'ربع‌پرده‌ها در این دستگاه: {count}. هیچ آکوردی از ربع‌پرده ساخته نمی‌شود و ربع‌پرده ریشه آکورد هم نیست، چون آکوردها روی پیانو نواخته می‌شوند.',
  'dict.card.degree': 'درجه {degree}',
  'dict.card.notes': 'نت‌ها: {count}',
  'dict.card.main': 'آکورد اصلی',
  'dict.card.listen': 'شنیدن {chord}',
};
