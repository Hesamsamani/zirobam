/** Volume sliders run 0..100 and map to -40..0 dB. With `muteAtZero`, 0 is silent instead of -40 dB. */
export function sliderToDb(value: number, muteAtZero = false): number {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  if (muteAtZero && v === 0) return -Infinity;
  return (v / 100) * 40 - 40;
}
