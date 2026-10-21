import type { tunerEn } from './tuner.en';

// Typed against the English part, so a string missing here fails the build.
export const tunerFa: Record<keyof typeof tunerEn, string> = {
  'menu.tuner.title': 'کوک‌سنج',
  'menu.tuner.desc': 'ببینید چه نتی می‌نوازید یا می‌خوانید و چقدر از کوک دور است.',

  'tuner.title': 'کوک‌سنج',
  'tuner.subtitle': 'نزدیک میکروفون یک نت بنوازید یا بخوانید. صدا روی همین دستگاه می‌ماند.',
  'tuner.start': 'شروع گوش دادن',
  'tuner.stop': 'توقف',
  'tuner.starting': 'منتظر میکروفون…',
  'tuner.listening': 'یک نت بنوازید یا بخوانید.',
  'tuner.denied': 'میکروفون بسته است. در مرورگر برای این صفحه اجازه‌اش را بدهید و دوباره امتحان کنید.',
  'tuner.unavailable': 'اینجا نمی‌شود از میکروفون استفاده کرد.',

  'tuner.a4': 'لا۴ برابر است با',
  'tuner.hz': 'هرتز',
  'tuner.mode': 'نت‌ها',
  'tuner.mode.et': 'دوازده نت',
  'tuner.mode.quarter': 'با ربع‌پرده',
  'tuner.send': 'نواختن در برنامه',
  'tuner.send.hint': 'نت‌هایی که می‌نوازید به آکوردخوان و صفحه‌های دیگر فرستاده می‌شود، مثل کیبورد.',

  'tuner.cents': '{cents} سنت',
  'tuner.flat': 'پایین',
  'tuner.sharp': 'بالا',
  'tuner.inTune': 'کوک است',
  'tuner.meter': 'فاصله از نت، به سنت',
};
