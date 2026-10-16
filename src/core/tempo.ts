export const MIN_BPM = 20;
export const MAX_BPM = 200;
export const DEFAULT_BPM = 30;

/** A tempo the app can play: a whole number from MIN_BPM to MAX_BPM. Anything unreadable becomes DEFAULT_BPM. */
export function clampBpm(value: number | string): number {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (!Number.isFinite(n)) return DEFAULT_BPM;
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(n)));
}
