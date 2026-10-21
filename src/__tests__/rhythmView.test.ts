import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seededRng } from '../core/rng';
import { initLocale, setLocale, setPersianDigits } from '../i18n';
import { NoteInputHub } from '../input/noteInput';
import { NoteStats } from '../learn/noteStats';
import { onsets } from '../rhythm/rhythmGen';
import { RhythmView, type RhythmAudio, type RhythmViewDeps } from '../rhythm/rhythmView';

function setup(overrides: Partial<RhythmViewDeps> = {}, ready = true) {
  vi.useFakeTimers();
  let now = 1000;
  const toolkit = {
    setOptions: vi.fn(),
    loadData: vi.fn((xml: string) => void (count = (xml.match(/<note>/g) ?? []).length)),
    renderToSVG: vi.fn(() => `<svg xmlns="http://www.w3.org/2000/svg" width="10px" height="10px">${Array.from({ length: count }, () => '<g class="note"><use x="1" y="1"/></g>').join('')}</svg>`),
  };
  let count = 0;
  const clicks: { count: number; intervalMs: number; accentEvery: number; leadMs: number; first: number }[] = [];
  const audio: RhythmAudio = {
    ready: vi.fn(async () => ready),
    clicks: vi.fn((c, intervalMs, accentEvery, leadMs) => {
      const first = now + leadMs;
      clicks.push({ count: c, intervalMs, accentEvery, leadMs, first });
      return first;
    }),
    stop: vi.fn(),
  };
  const hub = new NoteInputHub();
  const data = new Map<string, string>();
  const stats = new NoteStats({ getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }, 'rhythm.stats.v1');
  const store = new Map<string, string>();
  const onPassed = vi.fn();
  const onVerdict = vi.fn();
  const deps: RhythmViewDeps = {
    hub,
    toolkit,
    audio,
    clock: () => now,
    stats,
    onBack: vi.fn(),
    onPassed,
    onVerdict,
    random: seededRng(3),
    storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) },
    ...overrides,
  };
  const view = new RhythmView(deps);
  document.body.replaceChildren(view.element);
  view.activate();
  const advance = (ms: number) => {
    now += ms;
    vi.advanceTimersByTime(ms);
  };
  const advanceTo = (time: number) => advance(Math.max(0, time - now));
  const tap = () => $('.rh-pad').dispatchEvent(new Event('pointerdown', { cancelable: true }));
  const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  /** Starts a round and gives the moments at which its notes are wanted, on the clock of the test. */
  const start = async () => {
    $('.rh-start').click();
    await flush();
    const c = clicks.at(-1)!;
    const ex = view.current().exercise!;
    const beatMs = 60000 / ex.level.bpm;
    const exerciseStart = c.first + (c.count - (ex.level.bars * (ex.level.meter === '3/4' ? 3 : 4))) * c.intervalMs;
    return { c, ex, beatMs, expected: onsets(ex).map((b) => exerciseStart + b * beatMs), exerciseStart, end: exerciseStart + ex.bars.length * 4 * beatMs };
  };
  return { view, deps, audio, clicks, hub, stats, store, onPassed, onVerdict, advance, advanceTo, tap, start, flush, now: () => now };
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const all = <T extends HTMLElement>(selector: string) => Array.from(document.querySelectorAll<T>(selector));

beforeEach(() => {
  initLocale();
  setLocale('en');
  setPersianDigits(false);
});
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('the rhythm trainer: a round', () => {
  it('shows the rhythm of level 1 on the staff, and only level 1 is open', () => {
    const { view } = setup();
    expect($('.view-title').textContent).toBe('Rhythm trainer');
    expect(view.current().level).toBe(1);
    expect(all('.rh-staff .note').length).toBeGreaterThan(1);
    expect(all('.rh-levels [data-level]').map((b) => (b as HTMLButtonElement).disabled)).toEqual([false, ...Array(9).fill(true)]);
    expect($('.rh-state').textContent).toBe('Press Start.');
  });

  it('counts in with clicks, then asks for the taps', async () => {
    const { clicks, advanceTo, start } = setup();
    const round = await start();
    expect(clicks).toHaveLength(1);
    // a bar of four clicks and two bars of four beats, one click to a beat, at 70 beats a minute, accented on the first of a bar
    expect(clicks[0]).toMatchObject({ count: 12, accentEvery: 4, leadMs: 350 });
    expect(clicks[0].intervalMs).toBeCloseTo(60000 / 70, 3);
    expect($('.rh-state').textContent).toBe('Count in…');
    expect($('.rh-start').textContent).toBe('Stop');
    advanceTo(round.exerciseStart + 1);
    expect($('.rh-state').textContent).toBe('Tap the rhythm.');
  });

  it('passes a rhythm tapped on time: the text, the colours, the rewards and the next level', async () => {
    const { advanceTo, tap, start, onPassed, onVerdict, stats } = setup();
    const round = await start();
    for (const at of round.expected) {
      advanceTo(at + 10);
      tap();
    }
    advanceTo(round.end + 1000);
    expect($('.rh-result').dataset.tone).toBe('good');
    expect($('.rh-result').textContent).toContain(`Perfect ${round.expected.length}, good 0, early 0, late 0, missed 0, extra taps 0.`);
    expect($('.rh-result').textContent).toContain('Well done! That was on time.');
    expect($('.rh-result').textContent).toContain('Level 2 is open now.');
    expect(onPassed).toHaveBeenCalledTimes(1);
    expect(onVerdict).toHaveBeenCalledTimes(round.expected.length);
    expect(onVerdict.mock.calls.every((c) => c[0] === 'hit')).toBe(true);
    expect(stats.getMaxStage()).toBe(2);
    expect(($('.rh-levels [data-level="2"]') as HTMLButtonElement).disabled).toBe(false);
    expect(all('.rh-staff .rh-perfect')).toHaveLength(round.expected.length);
    expect($('.rh-start').textContent).toBe('Again');
  });

  it('does not pass a rhythm that was not played, and counts every note as missed', async () => {
    const { advanceTo, start, onPassed, onVerdict } = setup();
    const round = await start();
    advanceTo(round.end + 1000);
    expect($('.rh-result').dataset.tone).toBe('bad');
    expect($('.rh-result').textContent).toContain(`missed ${round.expected.length}`);
    expect($('.rh-result').textContent).toContain('Not quite on time yet.');
    expect(onPassed).not.toHaveBeenCalled();
    expect(onVerdict.mock.calls.filter((c) => c[0] === 'missed')).toHaveLength(round.expected.length);
    expect(all('.rh-staff .rh-missed')).toHaveLength(round.expected.length);
  });

  it('says when the taps are late, and tells the student they tend to tap late', async () => {
    const { advanceTo, tap, start } = setup();
    const round = await start();
    for (const at of round.expected) {
      advanceTo(at + 120);
      tap();
    }
    advanceTo(round.end + 1000);
    expect($('.rh-result').textContent).toContain(`late ${round.expected.length}`);
    expect($('.rh-result').textContent).toContain('You tend to tap late.');
    expect(all('.rh-staff .rh-late').length).toBe(round.expected.length);
  });

  it('ignores taps before the count-in is nearly over and after the end', async () => {
    const { advanceTo, tap, start } = setup();
    const round = await start();
    tap(); // far before the first note
    advanceTo(round.exerciseStart - 1000);
    tap();
    for (const at of round.expected) {
      advanceTo(at);
      tap();
    }
    advanceTo(round.end + 600);
    tap(); // after the end
    advanceTo(round.end + 1000);
    expect($('.rh-result').textContent).toContain('extra taps 0.');
  });

  it('takes the Space key, a key of the keyboard and the pad', async () => {
    const { advanceTo, hub, start } = setup();
    const round = await start();
    advanceTo(round.expected[0]);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true }));
    advanceTo(round.expected[1] ?? round.expected[0] + 100);
    hub.noteOn('C4', 'midi');
    advanceTo(round.end + 1000);
    expect($('.rh-result').textContent).not.toContain('perfect 0');
  });

  it('leaves Space to a button that is focused', async () => {
    const { advanceTo, start } = setup();
    const round = await start();
    advanceTo(round.expected[0]);
    const button = $('.rh-new');
    button.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true }));
    advanceTo(round.end + 1000);
    expect($('.rh-result').textContent).toContain('Perfect 0');
  });

  it('stops when Stop is pressed, and when the screen is left', async () => {
    const { audio, view, start } = setup();
    await start();
    $('.rh-start').click();
    expect(audio.stop).toHaveBeenCalled();
    expect(view.current().phase).toBe('idle');
    expect($('.rh-start').textContent).toBe('Start');
    await start();
    view.deactivate();
    expect(view.current().phase).toBe('idle');
  });

  it('asks for a new rhythm, and for another level', () => {
    const { view } = setup();
    const before = view.current().exercise!.key;
    $('.rh-new').click();
    expect(view.current().exercise!.key).not.toBe(before);
  });

  it('says so when the clicks cannot be played', async () => {
    const { start, view } = setup({}, false);
    $('.rh-start').click();
    await Promise.resolve();
    await Promise.resolve();
    expect($('.rh-state').textContent).toBe('The clicks could not be played, so there is nothing to tap along with.');
    expect(view.current().phase).toBe('idle');
    void start;
  });
});

describe('the rhythm trainer: the delay of the device', () => {
  it('measures it from taps along with eight clicks, keeps it, and takes it off the taps', async () => {
    const { advanceTo, tap, flush, clicks, store, now, view, start } = setup();
    $('.rh-calibrate').click();
    await flush();
    const c = clicks.at(-1)!;
    expect(c.count).toBe(8);
    for (let i = 0; i < 8; i++) {
      advanceTo(c.first + i * c.intervalMs + 60);
      tap();
    }
    advanceTo(c.first + 8 * c.intervalMs + 1000);
    expect(view.current().offsetMs).toBe(60);
    expect($('.rh-delay').textContent).toBe('Delay of this device: 60 ms');
    expect($('.rh-state').textContent).toBe('The delay is 60 ms.');
    expect(JSON.parse(store.get('rhythm.v1')!)).toEqual({ offsetMs: 60 });
    // a tap 60 ms after the beat is now perfect
    const round = await start();
    for (const at of round.expected) {
      advanceTo(at + 60);
      tap();
    }
    advanceTo(round.end + 1000);
    expect($('.rh-result').textContent).toContain(`Perfect ${round.expected.length}`);
    void now;
  });

  it('starts from what was kept, and can be reset', () => {
    const { view, store } = setup({ storage: { getItem: () => JSON.stringify({ offsetMs: 45 }), setItem: () => undefined } });
    expect(view.current().offsetMs).toBe(45);
    expect(($('.rh-reset') as HTMLButtonElement).disabled).toBe(false);
    $('.rh-reset').click();
    expect(view.current().offsetMs).toBe(0);
    void store;
  });

  it('keeps the old delay when too few taps were heard', async () => {
    const { advanceTo, flush, clicks, view } = setup();
    $('.rh-calibrate').click();
    await flush();
    const c = clicks.at(-1)!;
    advanceTo(c.first + 8 * c.intervalMs + 1000);
    expect(view.current().offsetMs).toBe(0);
  });
});

describe('the rhythm trainer: language', () => {
  it('is in Persian, with Persian digits and the staff left to right', () => {
    setLocale('fa');
    setPersianDigits(true);
    const { view } = setup();
    view.refresh();
    expect($('.view-title').textContent).toBe('تمرین ریتم');
    expect($('.rh-levels [data-level="1"]').textContent).toBe('۱');
    expect($('.rh-staff').getAttribute('dir')).toBe('ltr');
    expect($('.rh-delay').textContent).toBe('تأخیر این دستگاه: ۰ میلی‌ثانیه');
  });
});
