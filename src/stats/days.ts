/** Calendar days as `YYYY-MM-DD`: what the practice records are filed under. Plain strings, so they sort and compare. */

const MS_PER_DAY = 86_400_000;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The day of a moment, by the clock on the student's wall (not UTC). */
export function dayString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function utcOf(day: string): number {
  const [, y, m, d] = DAY.exec(day) as RegExpExecArray;
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

/** True for a text that is a real calendar day (not 2026-02-29, not 2026-1-1). */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DAY.exec(value);
  if (!match) return false;
  const date = new Date(utcOf(value));
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
}

/** The day `n` days after `day` (before it when `n` is negative). Counted in UTC, so a change of clock cannot shift it. */
export function addDays(day: string, n: number): string {
  return new Date(utcOf(day) + n * MS_PER_DAY).toISOString().slice(0, 10);
}

/** How many days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcOf(to) - utcOf(from)) / MS_PER_DAY);
}
