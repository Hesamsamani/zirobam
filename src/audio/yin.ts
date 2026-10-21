export interface PitchFound {
  /** The fundamental in hertz. */
  frequency: number;
  /** 0 to 1: how sure the pitch is (1 minus the YIN dip). */
  clarity: number;
}

export interface PitchOptions {
  /** The dip below which a period is taken as the pitch: 0.15 is the usual. */
  threshold?: number;
  minFrequency?: number;
  maxFrequency?: number;
}

/**
 * The pitch of a stretch of sound, by the YIN method: the difference of the sound with itself shifted by each lag,
 * normalised by the running mean, and the first dip under the threshold is the period. The dip is refined by a
 * parabola through its neighbours, which is good for a cent or two. Silence and noise have no pitch (null).
 */
export function detectPitch(buffer: Float32Array, sampleRate: number, options: PitchOptions = {}): PitchFound | null {
  const { threshold = 0.15, minFrequency = 50, maxFrequency = 2000 } = options;
  const half = Math.floor(buffer.length / 2);
  const minLag = Math.max(2, Math.floor(sampleRate / maxFrequency));
  const maxLag = Math.min(half - 1, Math.floor(sampleRate / minFrequency));
  if (maxLag <= minLag + 2) return null;

  // silence: nothing to find
  let energy = 0;
  for (let i = 0; i < buffer.length; i++) energy += buffer[i] * buffer[i];
  if (energy / buffer.length < 1e-8) return null;

  // difference function and its cumulative mean normalisation
  const diff = new Float32Array(maxLag + 2);
  for (let lag = 1; lag <= maxLag + 1; lag++) {
    let sum = 0;
    for (let i = 0; i < half; i++) {
      const delta = buffer[i] - buffer[i + lag];
      sum += delta * delta;
    }
    diff[lag] = sum;
  }
  const normalised = new Float32Array(maxLag + 2);
  normalised[0] = 1;
  let running = 0;
  for (let lag = 1; lag <= maxLag + 1; lag++) {
    running += diff[lag];
    normalised[lag] = running === 0 ? 1 : (diff[lag] * lag) / running;
  }

  // the first lag under the threshold, followed down to the bottom of its dip
  let lag = -1;
  for (let l = minLag; l <= maxLag; l++) {
    if (normalised[l] < threshold) {
      while (l + 1 <= maxLag && normalised[l + 1] < normalised[l]) l++;
      lag = l;
      break;
    }
  }
  if (lag < 0) return null;

  // a parabola through the dip and its two neighbours
  const a = normalised[lag - 1];
  const b = normalised[lag];
  const c = normalised[lag + 1];
  const denominator = a - 2 * b + c;
  const better = denominator === 0 ? lag : lag + (a - c) / (2 * denominator);
  return { frequency: sampleRate / better, clarity: Math.max(0, Math.min(1, 1 - b)) };
}
