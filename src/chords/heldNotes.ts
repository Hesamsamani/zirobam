/** The keys that are down now, and whether they have stayed the same long enough to be read as a chord. */
export class HeldNotes {
  private readonly keys = new Set<number>();
  private changedAt = 0;
  private readonly clock: () => number;
  private readonly settleMs: number;

  /** `settleMs`: how long the keys must stay as they are before they count as one chord (80 ms by default: a hand never lands all at once). */
  constructor(clock: () => number = () => performance.now(), settleMs = 80) {
    this.clock = clock;
    this.settleMs = settleMs;
  }

  press(midi: number): void {
    if (this.keys.has(midi)) return;
    this.keys.add(midi);
    this.changedAt = this.clock();
  }

  release(midi: number): void {
    if (this.keys.delete(midi)) this.changedAt = this.clock();
  }

  clear(): void {
    this.keys.clear();
    this.changedAt = this.clock();
  }

  /** The keys that are down, lowest first. */
  down(): number[] {
    return [...this.keys].sort((a, z) => a - z);
  }

  /** The keys that are down when they have been the same for the settling time, otherwise null. */
  settled(): number[] | null {
    if (this.keys.size === 0) return null;
    return this.clock() - this.changedAt >= this.settleMs ? this.down() : null;
  }
}
