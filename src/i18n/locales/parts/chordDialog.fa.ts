import type { chordDialogEn } from './chordDialog.en';

// Typed against the English part, so a string missing here fails the build.
export const chordDialogFa: Record<keyof typeof chordDialogEn, string> = {
  'cd.sub': 'درجه‌ی {degree} گام، {roman}',
  'cd.notes': 'نت‌ها',

  'cd.turns': 'برگردان‌های آکورد',
  'cd.turn.0': 'وضع اصلی',
  'cd.turn.1': 'برگردان اول',
  'cd.turn.2': 'برگردان دوم',
  'cd.turn.3': 'برگردان سوم',
  'cd.turn.4': 'برگردان چهارم',
  'cd.turn.5': 'برگردان پنجم',

  'cd.staff': 'آکورد روی حامل',
  'cd.keys': 'آکورد روی کلیدها',

  'cd.play': 'آکورد را بنوازید',
  'cd.arpeggio': 'آرپژ',
  'cd.midi': 'دریافت فایل میدی',
  'cd.midi.saved': '«{file}» ذخیره شد.',

  'cd.guitar': 'روی گیتار',
  'cd.guitar.tuning': 'کوک استاندارد، سیم بم سمت چپ: {notes}.',
  'cd.guitar.none': 'برای این آکورد شکل گیتاری پیدا نشد.',
  'cd.shape.open': 'باز',
  'cd.shape.barre': 'بار',
  'cd.shape.movable': 'قابل جابه‌جایی',
  'cd.shape.fromFret': 'از فرت {fret}',
  'cd.shape.hear': 'بشنوید',
  'cd.shape.hearAria': 'شنیدن شکل {kind} برای {chord}',
  'cd.shape.aria': 'شکل گیتار برای {chord}: {kind}، فرت‌ها از سیم بم: {frets}.',
  'cd.shape.muted': 'بی‌صدا',
};
