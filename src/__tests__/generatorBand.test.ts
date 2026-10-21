import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Arrangement } from '../band/arrange';
import type { BandBackend } from '../band/bandPlayer';
import { GeneratorView, type GeneratorViewDeps } from '../generator/generatorView';
import { initLocale, setLocale, setPersianDigits } from '../i18n';

function setup(ready = true) {
  const toolkit = {
    setOptions: vi.fn(),
    loadData: vi.fn(),
    renderToSVG: vi.fn(() => '<svg xmlns="http://www.w3.org/2000/svg" width="10px" height="10px"></svg>'),
  };
  let handlers: { onBeat(beat: number): void; onEnd(): void } | null = null;
  const starts: { arrangement: Arrangement; bpm: number; loop: boolean }[] = [];
  const band: BandBackend = {
    ready: vi.fn(async () => ready),
    start: vi.fn((arrangement, options) => {
      starts.push({ arrangement, bpm: options.bpm, loop: options.loop });
      handlers = options;
    }),
    stop: vi.fn(),
    setBpm: vi.fn(),
    setMuted: vi.fn(),
  };
  const deps: GeneratorViewDeps = {
    toolkit,
    voice: { ready: vi.fn(async () => true), play: vi.fn(), stopAll: vi.fn() },
    band,
    formatName: (note) => note,
    onBack: vi.fn(),
    practise: vi.fn(),
    openInMaker: vi.fn(async () => true),
    readAddress: () => '',
    writeAddress: () => undefined,
    storage: { getItem: () => null, setItem: () => undefined },
    newSeed: () => 7,
  };
  const view = new GeneratorView(deps);
  document.body.replaceChildren(view.element);
  return { view, band, starts, beat: (n: number) => handlers!.onBeat(n) };
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const all = <T extends HTMLElement>(selector: string) => Array.from(document.querySelectorAll<T>(selector));
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

beforeEach(() => {
  localStorage.clear();
  initLocale();
  setLocale('en');
  setPersianDigits(false);
});
afterEach(() => document.body.replaceChildren());

describe('the Band tab', () => {
  it('is a third tab that shows the chords and the band\'s controls, and no staff', () => {
    setup();
    expect(all('.gen-tabs .sc-tab').map((b) => b.textContent)).toEqual(['Progression', 'Melody', 'Band']);
    expect($('.gen-band').hasAttribute('hidden')).toBe(true);
    $('.gen-tabs [data-tab="band"]').click();
    expect($('.gen-band').hasAttribute('hidden')).toBe(false);
    expect(all('.gen-bar')).toHaveLength(8);
    expect(all('.gen-line')).toHaveLength(0);
    expect(all('.gen-group-band-parts [data-part]').map((b) => b.textContent)).toEqual(['Drums', 'Bass', 'Chords']);
  });

  it('plays the band with the tempo of the piece, looping, and stops it again', async () => {
    const { band, starts, view } = setup();
    $('.gen-tabs [data-tab="band"]').click();
    $('.gen-play').click();
    await flush();
    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatchObject({ loop: true, bpm: view.current().piece!.bpm });
    expect(starts[0].arrangement.loopBeats).toBe(32);
    expect($('.gen-play').textContent).toBe('Stop');
    $('.gen-play').click();
    expect(band.stop).toHaveBeenCalled();
    expect($('.gen-play').textContent).toBe('Play');
  });

  it('marks the bar and names the chord that sounds', async () => {
    const { beat } = setup();
    $('.gen-tabs [data-tab="band"]').click();
    $('.gen-play').click();
    await flush();
    beat(5);
    expect(all('.gen-bar').map((b) => b.dataset.current)[1]).toBe('true');
    expect($('.band-now').textContent).toMatch(/^Now: /);
  });

  it('mutes a part, starts again with a count-in or a new transposition, and takes the loop off', async () => {
    const { band, starts } = setup();
    $('.gen-tabs [data-tab="band"]').click();
    $('.gen-group-band-parts [data-part="drums"]').click();
    expect(band.setMuted).toHaveBeenCalledWith('drums', true);
    expect($('.gen-group-band-parts [data-part="drums"]').getAttribute('aria-pressed')).toBe('false');
    $('.gen-group-band-parts [data-toggle="countIn"]').click();
    $('.gen-play').click();
    await flush();
    expect(starts[0].arrangement.countInBeats).toBe(4);
    $('.gen-group-band-transpose [data-transpose="up"]').click();
    expect(starts).toHaveLength(2);
    expect($('.band-transpose-value').textContent).toBe('+1');
    $('.gen-group-band-parts [data-toggle="loop"]').click();
    expect(starts.at(-1)!.loop).toBe(false);
  });

  it('says so when the sounds cannot be loaded', async () => {
    const { band } = setup(false);
    $('.gen-tabs [data-tab="band"]').click();
    $('.gen-play').click();
    await flush();
    expect(band.start).not.toHaveBeenCalled();
    expect($('.gen-status').textContent).toBe('The piano sounds could not be loaded, so there is nothing to listen to.');
  });

  it('stops when the screen is left or another tab is chosen', async () => {
    const { band, view } = setup();
    $('.gen-tabs [data-tab="band"]').click();
    $('.gen-play').click();
    await flush();
    vi.mocked(band.stop).mockClear();
    $('.gen-tabs [data-tab="prog"]').click();
    expect(band.stop).toHaveBeenCalled();
    $('.gen-tabs [data-tab="band"]').click();
    $('.gen-play').click();
    await flush();
    vi.mocked(band.stop).mockClear();
    view.deactivate();
    expect(band.stop).toHaveBeenCalled();
  });

  it('is in Persian', () => {
    setLocale('fa');
    setPersianDigits(true);
    const { view } = setup();
    view.refresh();
    expect(all('.gen-tabs .sc-tab').map((b) => b.textContent)).toEqual(['گردش آکورد', 'ملودی', 'گروه']);
    $('.gen-tabs [data-tab="band"]').click();
    expect(all('.gen-group-band-parts [data-part]').map((b) => b.textContent)).toEqual(['درام', 'بیس', 'آکوردها']);
    expect($('.band-transpose-value').textContent).toBe('۰');
  });
});
