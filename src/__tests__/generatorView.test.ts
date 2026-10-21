import { Midi } from '@tonejs/midi';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initLocale, setLocale, setPersianDigits } from '../i18n';
import { GeneratorView, type GeneratorViewDeps } from '../generator/generatorView';
import { DEFAULT_STATE } from '../generator/generatorState';

/** A notation toolkit that draws as many notes as the XML it was given has. */
function setup(overrides: Partial<GeneratorViewDeps> = {}) {
  let count = 0;
  const toolkit = {
    setOptions: vi.fn(),
    loadData: vi.fn((xml: string) => {
      count = (xml.match(/<note>/g) ?? []).length;
    }),
    renderToSVG: vi.fn(() => {
      const notes = Array.from({ length: count }, (_, i) => `<g class="note"><g class="notehead"><use x="${100 + i * 20}" y="300"/></g></g>`).join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" width="640px" height="210px">${notes}</svg>`;
    }),
  };
  const voice = { ready: vi.fn(async () => true), play: vi.fn(), stopAll: vi.fn() };
  const storage = new Map<string, string>();
  const query = { value: '' };
  const writes: string[] = [];
  const deps: GeneratorViewDeps = {
    toolkit,
    voice,
    formatName: (note) => note.replace('#', '♯').replace(/(?<=[A-G])b/, '♭'),
    onBack: vi.fn(),
    practise: vi.fn(),
    openInMaker: vi.fn(async () => true),
    readAddress: () => query.value,
    writeAddress: (q) => void writes.push(q),
    storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => void storage.set(k, v) },
    download: vi.fn(),
    notify: vi.fn(),
    newSeed: () => 4242,
    ...overrides,
  };
  const view = new GeneratorView(deps);
  document.body.replaceChildren(view.element);
  return { view, deps, toolkit, voice, storage, query, writes };
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
afterEach(() => {
  document.body.replaceChildren();
});

describe('the music maker: what it shows', () => {
  it('has a title, a picker for the scale, two tabs and the thirteen styles', () => {
    setup();
    expect($('.view-title').textContent).toBe('Music maker');
    expect(all('.gen-tabs .sc-tab').map((b) => b.textContent)).toEqual(['Progression', 'Melody']);
    expect(all('.gen-group-style .sc-chip')).toHaveLength(13);
    expect(all('.gen-group-bars .sc-chip').map((b) => b.textContent)).toEqual(['4', '8', '12', '16']);
    expect(all('.dict-picker .sc-roots .sc-chip')).toHaveLength(12);
    expect($('.dict-toggle').textContent).toBe('C Major');
  });

  it('starts with a pop progression of eight bars, and says which', () => {
    setup();
    expect($('.gen-style-pop, .gen-group-style [aria-pressed="true"]').textContent).toBe('Pop');
    expect($('.gen-summary').textContent).toMatch(/^C Major, Pop, 8 bars, \d+ beats a minute$/);
    expect(all('.gen-bar')).toHaveLength(8);
    expect(all('.gen-chord').length).toBeGreaterThanOrEqual(8);
  });

  it('shows each chord with its name and its Roman numeral, and ends on the first degree', () => {
    setup();
    const last = all('.gen-bar').at(-1)!.querySelector('.gen-chord')!;
    expect(last.querySelector('.gen-chord-symbol')!.textContent).toBe('C');
    expect(last.querySelector('.gen-chord-roman')!.textContent).toBe('I');
    expect(last.getAttribute('aria-label')).toBe('Bar 8: C. Hear it.');
    expect(last.querySelector('.gen-chord-symbol')!.getAttribute('dir')).toBe('ltr');
  });

  it('draws the piece on the grand staff, four bars to a line', () => {
    const { toolkit } = setup();
    expect(all('.gen-line')).toHaveLength(2);
    expect(all('.gen-line').every((line) => line.getAttribute('dir') === 'ltr')).toBe(true);
    const xml = toolkit.loadData.mock.calls.at(-1)![0] as string;
    expect(xml).toContain('<staves>2</staves>');
    expect(xml.match(/<measure /g)).toHaveLength(4);
  });
});

describe('the music maker: the choices', () => {
  it('makes another piece when the style changes, and keeps the choice and the address', () => {
    const { storage, writes } = setup();
    $('.gen-group-style [data-style="jazz"]').click();
    expect($('.gen-summary').textContent).toMatch(/^C Major, Jazz, 8 bars/);
    expect(all('.gen-chord-symbol').some((s) => /7/.test(s.textContent!))).toBe(true);
    expect(JSON.parse(storage.get('generator.v1')!)).toMatchObject({ style: 'jazz' });
    expect('seed' in JSON.parse(storage.get('generator.v1')!)).toBe(false);
    // the address is only written once the screen is shown
    expect(writes).toEqual([]);
  });

  it('changes the number of bars', () => {
    setup();
    $('.gen-group-bars [data-bars="16"]').click();
    expect(all('.gen-bar')).toHaveLength(16);
    expect(all('.gen-line')).toHaveLength(4);
    $('.gen-group-bars [data-bars="4"]').click();
    expect(all('.gen-bar')).toHaveLength(4);
    expect(all('.gen-line')).toHaveLength(1);
  });

  it('takes the scale from the picker: D Dorian', () => {
    setup();
    $('.dict-categories [data-category="church"]').click();
    $('.dict-scales [data-type="dorian"]').click();
    $('.dict-picker .sc-roots [data-root="2"]').click();
    expect($('.gen-summary').textContent).toMatch(/^D Dorian, Pop/);
    expect(all('.gen-bar').at(-1)!.querySelector('.gen-chord-symbol')!.textContent).toBe('Dm');
  });

  it('gives the same piece for the same seed and another when the button is pressed', () => {
    const { view } = setup();
    const symbols = () => all('.gen-chord-symbol').map((s) => s.textContent).join(' ');
    const first = symbols();
    expect(view.current().state.seed).toBe(4242);
    $('.gen-new').click();
    expect(view.current().state.seed).toBe(4242); // the fake source always gives the same number
    expect(symbols()).toBe(first);
    const seed = $<HTMLInputElement>('.gen-seed');
    seed.value = '777';
    seed.dispatchEvent(new Event('change'));
    expect(view.current().state.seed).toBe(777);
    seed.value = 'abc';
    seed.dispatchEvent(new Event('change'));
    expect(view.current().state.seed).toBe(777);
    expect($<HTMLInputElement>('.gen-seed').value).toBe('777');
  });

  it('takes a tempo, and goes back to the style\'s own when it is cleared', () => {
    const { view } = setup();
    const bpm = $<HTMLInputElement>('.gen-bpm');
    bpm.value = '90';
    bpm.dispatchEvent(new Event('change'));
    expect($('.gen-summary').textContent).toContain('90 beats a minute');
    const again = $<HTMLInputElement>('.gen-bpm');
    again.value = '';
    again.dispatchEvent(new Event('change'));
    expect(view.current().state.bpm).toBeNull();
    const outside = $<HTMLInputElement>('.gen-bpm');
    outside.value = '500';
    outside.dispatchEvent(new Event('change'));
    expect(view.current().state.bpm).toBeNull();
    expect($<HTMLInputElement>('.gen-bpm').value).toBe('');
  });
});

describe('the music maker: the melody', () => {
  it('shows the settings of a melody on its tab, and a staff with the tune over rests', () => {
    const { toolkit } = setup();
    expect(document.querySelector('.gen-group-meter')).toBeNull();
    $('.gen-tabs [data-tab="melody"]').click();
    for (const name of ['over', 'meter', 'density', 'feel', 'contour', 'range', 'octave']) expect(document.querySelector(`.gen-group-${name}`), name).not.toBeNull();
    expect(document.querySelector('.gen-ribbon')!.hasAttribute('hidden')).toBe(true);
    expect(all('.gen-line')).toHaveLength(2);
    expect(toolkit.loadData.mock.calls.at(-1)![0]).toContain('<rest');
  });

  it('puts the melody over the progression in 4/4, and shows the chords', () => {
    const { view } = setup();
    $('.gen-tabs [data-tab="melody"]').click();
    $('.gen-group-meter [data-meter="34"]').click();
    expect(view.current().state.meter).toBe('3/4');
    $('.gen-group-over [data-over="progression"]').click();
    expect(view.current().state).toMatchObject({ over: 'progression', meter: '4/4' });
    expect(all('.gen-bar')).toHaveLength(8);
    // another meter takes the melody off the progression
    $('.gen-group-meter [data-meter="68"]').click();
    expect(view.current().state).toMatchObject({ over: 'scale', meter: '6/8' });
    expect(document.querySelector('.gen-ribbon')!.hasAttribute('hidden')).toBe(true);
  });

  it('lets the student edit the tune in Write a song, and says when that failed', async () => {
    const { deps } = setup();
    expect($<HTMLButtonElement>('.gen-maker').disabled).toBe(true);
    $('.gen-tabs [data-tab="melody"]').click();
    expect($<HTMLButtonElement>('.gen-maker').disabled).toBe(false);
    $('.gen-maker').click();
    await flush();
    expect(deps.openInMaker).toHaveBeenCalledTimes(1);
    const draft = vi.mocked(deps.openInMaker).mock.calls[0][0];
    expect(draft).toMatchObject({ fifths: 0, beats: 4 });
    expect(draft.melody.split(' | ')).toHaveLength(8);
    vi.mocked(deps.openInMaker).mockResolvedValueOnce(false);
    $('.gen-maker').click();
    await flush();
    expect(deps.notify).toHaveBeenCalledWith('The tune could not be opened in Write a song.');
  });
});

describe('the music maker: listening, practising and saving', () => {
  it('plays every note of the piece, then lets it be stopped', async () => {
    const { voice } = setup();
    $('.gen-play').click();
    await flush();
    expect(voice.ready).toHaveBeenCalled();
    expect(voice.play.mock.calls.length).toBeGreaterThan(20);
    expect($('.gen-play').textContent).toBe('Stop');
    $('.gen-play').click();
    expect(voice.stopAll).toHaveBeenCalled();
    expect($('.gen-play').textContent).toBe('Play');
  });

  it('marks the bar that is sounding', async () => {
    vi.useFakeTimers();
    try {
      const { view } = setup();
      $('.gen-play').click();
      await flush();
      vi.advanceTimersByTime(200);
      expect(all('.gen-bar').map((b) => b.dataset.current)).toEqual(['true', ...Array(7).fill('false')]);
      const beat = 60 / view.current().piece!.bpm;
      vi.advanceTimersByTime(beat * 4 * 1000);
      expect(all('.gen-bar').map((b) => b.dataset.current)[1]).toBe('true');
      vi.advanceTimersByTime(60_000);
      expect(all('.gen-bar').every((b) => b.dataset.current === 'false')).toBe(true);
      expect($('.gen-play').textContent).toBe('Play');
    } finally {
      vi.useRealTimers();
    }
  });

  it('hears one chord when its button is pressed', async () => {
    const { voice } = setup();
    all<HTMLButtonElement>('.gen-chord')[0].click();
    await flush();
    expect(voice.play.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('says so when the piano cannot be loaded', async () => {
    const { voice } = setup();
    voice.ready.mockResolvedValue(false);
    $('.gen-play').click();
    await flush();
    expect(voice.play).not.toHaveBeenCalled();
    expect($('.gen-status').textContent).toBe('The piano sounds could not be loaded, so there is nothing to listen to.');
    expect($('.gen-play').textContent).toBe('Play');
  });

  it('downloads a MIDI file with the chords, a bass and (on the melody tab) the tune', () => {
    const { deps } = setup();
    $('.gen-midi').click();
    const [fileName, bytes] = vi.mocked(deps.download!).mock.calls[0] as [string, Uint8Array];
    expect(fileName).toMatch(/^C-Major-Pop\.mid$/);
    expect(new Midi(bytes).tracks.map((t) => t.name)).toEqual(['Chords', 'Bass']);
    expect(deps.notify).toHaveBeenCalledWith('Saved C-Major-Pop.mid.');
    $('.gen-tabs [data-tab="melody"]').click();
    $('.gen-midi').click();
    expect(new Midi(vi.mocked(deps.download!).mock.calls[1][1] as Uint8Array).tracks.map((t) => t.name)).toEqual(['Melody']);
  });

  it('opens the piece on the practice stand as MusicXML', () => {
    const { deps } = setup();
    $('.gen-practise').click();
    expect(deps.practise).toHaveBeenCalledTimes(1);
    const [xml, title] = vi.mocked(deps.practise).mock.calls[0];
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(title).toBe('C Major Pop');
  });

  it('goes back when the back button is pressed', () => {
    const { deps } = setup();
    $('.view-header button').click();
    expect(deps.onBack).toHaveBeenCalled();
  });
});

describe('the music maker: the address', () => {
  it('takes what the address says when the screen is shown, and then writes the address of what is shown', () => {
    const { view, query, writes } = setup();
    query.value = 't=melody&s=d-dorian&style=jazz&bars=4&seed=99&bpm=100&meter=34';
    view.activate();
    expect(view.current().state).toMatchObject({ tab: 'melody', scale: 'dorian', style: 'jazz', bars: 4, seed: 99, bpm: 100, meter: '3/4' });
    expect($('.gen-summary').textContent).toBe('D Dorian, Jazz, 4 bars, 100 beats a minute');
    expect(writes.at(-1)).toBe('t=melody&s=d-dorian&style=jazz&bars=4&seed=99&bpm=100&meter=34&density=medium&feel=straight&contour=arch&range=medium&oct=4&over=scale');
  });

  it('writes the address after every change while it is shown', () => {
    const { view, writes } = setup();
    view.activate();
    $('.gen-group-style [data-style="blues"]').click();
    expect(writes.at(-1)).toBe('t=prog&s=c-major&style=blues&bars=8&seed=4242');
  });

  it('follows an address that changed while it was open', () => {
    const { view, query } = setup();
    view.activate();
    query.value = 'style=rock&seed=5';
    view.change();
    expect(view.current().state).toMatchObject({ style: 'rock', seed: 5 });
    expect($('.gen-summary').textContent).toContain('Rock');
  });

  it('does not take an address while it is not shown', () => {
    const { view, query } = setup();
    query.value = 'style=rock';
    view.change();
    expect(view.current().state.style).toBe(DEFAULT_STATE.style);
  });

  it('starts from what was kept the last time, with a new seed', () => {
    const first = setup();
    $('.gen-group-style [data-style="funk"]').click();
    $('.gen-group-bars [data-bars="12"]').click();
    const kept = first.storage;
    document.body.replaceChildren();
    const second = setup({ storage: { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => void kept.set(k, v) }, newSeed: () => 31 });
    expect(second.view.current().state).toMatchObject({ style: 'funk', bars: 12, seed: 31 });
  });
});

describe('the music maker: the cost of the staff', () => {
  it('does not draw the staff while the screen is hidden, and draws it when it is shown', () => {
    const { view, toolkit } = setup();
    view.element.classList.add('view-hidden');
    toolkit.loadData.mockClear();
    view.refresh();
    expect(all('.gen-line')).toHaveLength(0);
    expect(toolkit.loadData).not.toHaveBeenCalled();
    // the chords are cheap and are there
    expect(all('.gen-bar')).toHaveLength(8);
    view.element.classList.remove('view-hidden');
    view.activate();
    expect(all('.gen-line')).toHaveLength(2);
  });
});

describe('the music maker: leaving, language', () => {
  it('stops the sound when the screen is left', async () => {
    const { view, voice } = setup();
    $('.gen-play').click();
    await flush();
    voice.stopAll.mockClear();
    view.deactivate();
    expect(voice.stopAll).toHaveBeenCalled();
    expect($('.gen-play').textContent).toBe('Play');
  });

  it('is in Persian, with Persian digits, and keeps the chords and the staff left to right', () => {
    setLocale('fa');
    setPersianDigits(true);
    const { view } = setup();
    view.refresh();
    expect($('.view-title').textContent).toBe('سازنده‌ی موسیقی');
    expect(all('.gen-tabs .sc-tab').map((b) => b.textContent)).toEqual(['گردش آکورد', 'ملودی']);
    expect(all('.gen-group-bars .sc-chip').map((b) => b.textContent)).toEqual(['۴', '۸', '۱۲', '۱۶']);
    expect($('.gen-summary').textContent).toMatch(/۸ میزان/);
    expect($('.gen-chord-symbol').getAttribute('dir')).toBe('ltr');
    expect($('.gen-line').getAttribute('dir')).toBe('ltr');
  });
});
