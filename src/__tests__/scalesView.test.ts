import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initLocale, setLocale } from '../i18n';
import { NoteInputHub } from '../input/noteInput';
import { ScalesView, type ScalesViewDeps } from '../scales/scalesView';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
}

/** A notation toolkit that draws as many notes as the XML it was given has. */
function fakeToolkit() {
  let count = 0;
  return {
    setOptions: vi.fn(),
    loadData: vi.fn((xml: string) => {
      count = (xml.match(/<note>/g) ?? []).length;
    }),
    renderToSVG: vi.fn(() => {
      const notes = Array.from({ length: count }, (_, i) => `<g class="note"><g class="notehead"><use x="${100 + i * 500}" y="300"/></g></g>`).join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" width="640px" height="210px">${notes}</svg>`;
    }),
  };
}

function setup(options: { storage?: ReturnType<typeof memoryStorage>; ready?: boolean } = {}) {
  const toolkit = fakeToolkit();
  const voice = { ready: vi.fn(async () => options.ready ?? true), play: vi.fn(), stopAll: vi.fn() };
  const hub = new NoteInputHub();
  const storage = options.storage ?? memoryStorage();
  const onBack = vi.fn();
  const onPlayed = vi.fn();
  const onAnswer = vi.fn();
  const writeAddress = vi.fn();
  const deps: ScalesViewDeps = { toolkit, voice, hub, formatName: (note) => note, onBack, onPlayed, onAnswer, writeAddress, storage };
  const view = new ScalesView(deps);
  document.body.replaceChildren(view.element);
  view.activate();
  return { view, toolkit, voice, hub, storage, onBack, onPlayed, onAnswer, writeAddress, deps };
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const all = <T extends HTMLElement>(selector: string) => Array.from(document.querySelectorAll<T>(selector));
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const press = (note: string) => $(`.lk-key[data-note="${note}"]`).dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
const savedChoice = (storage: ReturnType<typeof memoryStorage>) => JSON.parse(storage.data.get('scales.v2') ?? 'null');

beforeEach(() => {
  localStorage.clear();
  initLocale();
  setLocale('en');
});

describe('ScalesView: the first look', () => {
  it('starts with the C major scale: the picker, the stairs, the staff and the keys', () => {
    const { view } = setup();
    expect($('#scalesView .view-title').textContent).toBe('Scale and chord dictionary');
    expect(all('.sc-roots .sc-chip').map((c) => c.textContent)).toEqual(['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']);
    expect($('.sc-roots [aria-pressed="true"]').textContent).toBe('C');
    expect(all('.dict-scales .sc-chip')).toHaveLength(3);
    expect($('.dict-scale-title').textContent).toBe('C Major');
    expect(all('.dict-step')).toHaveLength(7);
    expect(view.current().spelled.pitches).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
    expect(view.current()).toMatchObject({ tab: 'scales', along: false });
    expect($('.sc-staff svg')).not.toBeNull();
    expect($('.sc-notes').textContent).toBe('Notes: C D E F G A B C');
  });

  it('has the section the screen shell looks for', () => {
    const { view } = setup();
    expect(view.element.id).toBe('scalesView');
    expect(view.element.dataset.views).toBe('scales');
  });

  it('goes back to the menu', () => {
    const { onBack } = setup();
    $('.back-btn').click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('ScalesView: choosing a scale', () => {
  it('changes the root, and writes the key signature into the staff', () => {
    const { toolkit } = setup();
    $('.sc-roots [data-root="1"]').click();
    expect($('.dict-scale-title').textContent).toBe('Db Major');
    expect(String(toolkit.loadData.mock.calls.at(-1)![0])).toContain('<fifths>-5</fifths>');
  });

  it('changes the scale within a group', () => {
    const { view } = setup();
    $('.dict-categories [data-category="minor"]').click();
    expect(all('.dict-scales .sc-chip').map((c) => c.dataset.type)).toEqual(['natural-minor', 'harmonic-minor', 'melodic-minor', 'hungarian-minor', 'neapolitan-minor']);
    $('.sc-roots [data-root="9"]').click();
    $('.dict-scales [data-type="harmonic-minor"]').click();
    expect(view.current().spelled.pitches).toEqual(['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G#5', 'A5']);
  });

  it('opens a Persian mode on its usual root, with the quarter tones on staff, stairs and keys', () => {
    const { toolkit } = setup();
    $('.dict-categories [data-category="persian"]').click();
    expect(all('.dict-scales .sc-chip')).toHaveLength(12);
    $('.dict-scales [data-type="shur"]').click();
    expect($('.dict-scale-title').textContent).toBe('D Shur');
    expect(String(toolkit.loadData.mock.calls.at(-1)![0])).toContain('<accidental>koron</accidental>');
    expect(all('.dict-step[data-quarter="true"]')).toHaveLength(1);
    expect(all('.sc-keys .lk-key.lk-quarter')).toHaveLength(1);
    expect($('.dict-persian').hidden).toBe(false);
  });

  it('finds a scale by search', () => {
    const { view } = setup();
    const input = $<HTMLInputElement>('.dict-search');
    input.value = 'bb blues';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    $('.dict-scales .sc-chip').click();
    expect($('.dict-scale-title').textContent).toBe('Bb Blues');
    expect(view.current().spelled.names).toEqual(['Bb', 'Db', 'Eb', 'Fb', 'F', 'Ab']); // one letter for each degree: the flat fifth is F flat
  });

  it('moves the root a quarter tone down with the toggle', () => {
    const { view } = setup();
    $('.dict-categories [data-category="persian"]').click();
    $('.dict-scales [data-type="segah"]').click();
    expect(view.current().spelled.root).toBe('Ek'); // Segah opens on E koron
    expect($('.dict-koron').getAttribute('aria-pressed')).toBe('true');
    $('.dict-koron').click();
    expect(view.current().spelled.root).toBe('E');
    expect($('.dict-koron').getAttribute('aria-pressed')).toBe('false');
  });

  it('can always draw the scale, whatever is stored', () => {
    const storage = memoryStorage({ 'scales.v2': JSON.stringify({ root: 'G##', scale: 'major' }) }); // needs a triple sign
    const { view } = setup({ storage });
    expect(view.current().spelled.names).toHaveLength(7);
  });
});

describe('ScalesView: the staff labels', () => {
  it('writes the fingers when asked, and the names again', () => {
    setup();
    $('.sc-labels [data-labels="right"]').click();
    expect(all('.sc-staff .note-label').map((el) => el.textContent)).toEqual(['1', '2', '3', '1', '2', '3', '4', '5']);
    $('.sc-labels [data-labels="names"]').click();
    expect(all('.sc-staff .note-label').map((el) => el.textContent)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']);
  });
});

describe('ScalesView: the chords tab', () => {
  it('shows the chords of the scale and hides the scale itself', () => {
    const { view } = setup();
    $('.sc-tabs [data-tab="chords"]').click();
    expect(view.current().tab).toBe('chords');
    expect($('.dict-chords').hidden).toBe(false);
    expect($('.dict-scale').hidden).toBe(true);
    expect($('.sc-tabs [data-tab="chords"]').getAttribute('aria-pressed')).toBe('true');
    expect(all('.dict-card').length).toBeGreaterThan(20);
  });

  it('filters by family, degree and the main chords, and keeps the filters', () => {
    const { storage } = setup();
    $('.sc-tabs [data-tab="chords"]').click();
    $('.dict-families [data-family="triad"]').click();
    expect(all('.dict-card-symbol').map((c) => c.textContent)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    $('.dict-primary').click();
    expect(all('.dict-card-symbol').map((c) => c.textContent)).toEqual(['C', 'F', 'G']);
    expect(savedChoice(storage)).toMatchObject({ tab: 'chords', family: 'triad', primaryOnly: true });
  });

  it('hears a chord when its card is pressed', async () => {
    const { voice } = setup();
    $('.sc-tabs [data-tab="chords"]').click();
    $('.dict-families [data-family="triad"]').click();
    $('.dict-card').click();
    await flush();
    expect(vi.mocked(voice.play).mock.calls.slice(0, 3).map((c) => c[0])).toEqual(['C4', 'E4', 'G4']);
  });

  it('goes back to the scale', () => {
    const { view } = setup();
    $('.sc-tabs [data-tab="chords"]').click();
    $('.sc-tabs [data-tab="scales"]').click();
    expect(view.current().tab).toBe('scales');
    expect($('.dict-scale').hidden).toBe(false);
    expect($('.dict-chords').hidden).toBe(true);
  });
});

describe('ScalesView: keeping the choice', () => {
  it('saves what was chosen, and a new screen opens with it', () => {
    const storage = memoryStorage();
    setup({ storage });
    $('.dict-categories [data-category="church"]').click();
    $('.dict-scales [data-type="dorian"]').click();
    $('.sc-roots [data-root="2"]').click();
    expect(savedChoice(storage)).toMatchObject({ scale: 'dorian', category: 'church', root: 2 });

    const again = setup({ storage });
    expect($('.dict-scale-title').textContent).toBe('D Dorian');
    expect(again.view.current().spelled.fifths).toBe(0);
  });

  it('takes over what the first version of the screen saved', () => {
    const storage = memoryStorage({ 'scales.v1': JSON.stringify({ tab: 'chords', root: 9, scale: 'harmonic', labels: 'right' }) });
    const { view } = setup({ storage });
    expect(view.current().tab).toBe('chords');
    expect(view.current().spelled.names).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G#']);
  });
});

describe('ScalesView: the address', () => {
  it('writes the root and the scale into the address when the student changes them, but not on arrival', () => {
    const { writeAddress } = setup();
    expect(writeAddress).not.toHaveBeenCalled();
    $('.sc-roots [data-root="1"]').click();
    expect(writeAddress).toHaveBeenLastCalledWith('db-major');
    $('.dict-categories [data-category="persian"]').click();
    $('.dict-scales [data-type="segah"]').click();
    expect(writeAddress).toHaveBeenLastCalledWith('ek-segah');
  });

  it('does not write it for a change of tab or of a filter, which are not part of the address', () => {
    const { writeAddress } = setup();
    $('.sc-tabs [data-tab="chords"]').click();
    $('.dict-families [data-family="seventh"]').click();
    expect(writeAddress).not.toHaveBeenCalled();
  });

  it('opens the scale an address names', () => {
    const storage = memoryStorage();
    const { view } = setup({ storage });
    view.deactivate();
    view.activate('d-shur');
    expect($('.dict-scale-title').textContent).toBe('D Shur');
    expect(view.current().spelled.names).toEqual(['D', 'Ek', 'F', 'G', 'A', 'Bb', 'C']);
    expect(savedChoice(storage)).toMatchObject({ scale: 'shur', root: 'D', category: 'persian' });
  });

  it('follows the address when it changes while the screen is open', () => {
    const { view } = setup();
    view.applyParam('fs-lydian');
    expect($('.dict-scale-title').textContent).toBe('F# Lydian');
    expect($('.dict-categories [aria-pressed="true"]').dataset.category).toBe('church');
  });

  it('leaves the choice as it is for an address that names nothing', () => {
    const { view } = setup();
    for (const bad of ['', 'nonsense', 'x-major', 'd-nonsense', null]) view.applyParam(bad);
    expect($('.dict-scale-title').textContent).toBe('C Major');
  });

  it('does not write the address back when it is the address that changed it', () => {
    const { view, writeAddress } = setup();
    view.applyParam('d-shur');
    expect(writeAddress).not.toHaveBeenCalled();
  });
});

describe('ScalesView: on a phone', () => {
  it('has a button that opens and closes the picker, and shows what is chosen', () => {
    setup();
    const toggle = $('.dict-toggle');
    expect(toggle.textContent).toContain('C Major');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect($('.dict-aside').dataset.open).toBe('true');
    toggle.click();
    expect($('.dict-aside').dataset.open).toBe('false');
  });

  it('closes the picker once a scale is chosen, and keeps it open for a change of root', () => {
    setup();
    $('.dict-toggle').click();
    $('.sc-roots [data-root="2"]').click();
    expect($('.dict-aside').dataset.open).toBe('true');
    $('.dict-scales [data-type="harmonic-major"]').click();
    expect($('.dict-aside').dataset.open).toBe('false');
    expect($('.dict-toggle').textContent).toContain('D Harmonic major');
  });
});

describe('ScalesView: playing along and the practice memory', () => {
  it('tells the practice memory about the keys, and the rewards when the scale is done', () => {
    const { onAnswer, onPlayed } = setup();
    $('.dict-categories [data-category="pentatonic"]').click();
    $('.dict-scales [data-type="pentatonic-major"]').click();
    $('.sc-along').click();
    press('C4');
    press('D4');
    expect(onAnswer).toHaveBeenCalledWith('C4', true);
    expect(onAnswer).toHaveBeenLastCalledWith('D4', true);
    press('F4'); // wrong: E4 was asked
    expect(onAnswer).toHaveBeenLastCalledWith('E4', false);
    for (const note of ['E4', 'G4', 'A4', 'C5']) press(note);
    expect(onPlayed).toHaveBeenCalledTimes(1);
  });

  it('takes a key from the MIDI keyboard while the screen is open, and not when it is left', () => {
    const { view, hub, onAnswer } = setup();
    $('.sc-along').click();
    view.deactivate();
    hub.noteOn('C4', 'midi');
    expect(onAnswer).not.toHaveBeenCalled();
    view.activate();
    $('.sc-along').click();
    hub.noteOn('C4', 'midi');
    expect(onAnswer).toHaveBeenCalledWith('C4', true);
  });

  it('does not take a key for the scale while the chords are shown', () => {
    const { hub, onAnswer } = setup();
    $('.sc-along').click();
    $('.sc-tabs [data-tab="chords"]').click();
    hub.noteOn('C4', 'midi');
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('stops the sound and the playing along when the screen is left', () => {
    const { view, voice } = setup();
    $('.sc-along').click();
    view.deactivate();
    expect(voice.stopAll).toHaveBeenCalled();
    expect(view.current().along).toBe(false);
  });
});

describe('ScalesView: in Persian', () => {
  it('draws again in Persian when the language changes, with the staff and the keys still left to right', () => {
    const { view } = setup();
    setLocale('fa');
    view.refresh();
    expect($('#scalesView .view-title').textContent).toBe('فرهنگ‌نامه گام و آکورد');
    expect($('.dict-scale-title').textContent).toBe('ماژور روی C');
    expect($('.sc-staff').getAttribute('dir')).toBe('ltr');
    expect($('.sc-keys').getAttribute('dir')).toBe('ltr');
    expect($('.dict-stairs').getAttribute('dir')).toBe('ltr');
    expect($('.sc-tabs [data-tab="chords"]').textContent).toBe('آکوردها');
  });
});
