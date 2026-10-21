import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initLocale, setLocale } from '../i18n';
import { DEFAULT_CHOICE, type Choice } from '../scales/dictionaryState';
import { ChordSection, type ChordSectionDeps } from '../scales/chordSection';
import type { ScaleChord } from '../theory/diatonic';
import type { ScaleId } from '../theory/scaleCatalog';
import { spellScale } from '../theory/spell';

function setup(overrides: Partial<ChordSectionDeps> = {}) {
  const voice = { ready: vi.fn(async () => true), play: vi.fn(), stopAll: vi.fn() };
  const onChange = vi.fn();
  const deps: ChordSectionDeps = { voice, formatName: (note) => note, onChange, ...overrides };
  const section = new ChordSection(deps);
  document.body.replaceChildren(section.element);
  const show = (root: number | string, id: ScaleId, choice: Partial<Choice> = {}) =>
    section.show(spellScale(root, id), { ...DEFAULT_CHOICE, tab: 'chords', scale: id, root, ...choice });
  return { section, voice, onChange, show };
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const all = <T extends HTMLElement>(selector: string) => Array.from(document.querySelectorAll<T>(selector));
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const symbols = () => all('.dict-card-symbol').map((el) => el.textContent);

beforeEach(() => {
  localStorage.clear();
  initLocale();
  setLocale('en');
});

describe('ChordSection: the cards', () => {
  it('shows a card for each chord of the family, with its degree, numeral, notes and name', () => {
    const { show } = setup();
    show(0, 'major', { family: 'triad' });
    expect(symbols()).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    const second = all('.dict-card')[1];
    expect(second.querySelector('.dict-card-degree')!.textContent).toBe('Degree 2');
    expect(second.querySelector('.dict-card-roman')!.textContent).toBe('ii');
    expect(second.querySelector('.dict-card-count')!.textContent).toBe('Notes: 3');
    expect(second.querySelector('.dict-card-name')!.textContent).toBe('Minor');
    expect(second.querySelector('.dict-card-notes')!.textContent).toBe('D · F · A');
  });

  it('counts the chords it shows', () => {
    const { show } = setup();
    show(0, 'major', { family: 'triad' });
    expect($('.dict-chords-count').textContent).toBe('Chords: 7');
    show(0, 'major', { family: 'all' });
    expect(Number($('.dict-chords-count').textContent!.replace('Chords: ', ''))).toBeGreaterThan(40);
  });

  it('marks the main chords', () => {
    const { show } = setup();
    show(0, 'major', { family: 'triad' });
    expect(all('.dict-card').map((c) => c.dataset.primary)).toEqual(['true', 'false', 'false', 'true', 'true', 'false', 'false']);
    expect(all('.dict-card')[0].querySelector('.dict-card-main')!.textContent).toBe('Main chord');
  });

  it('shows only the main chords when asked', () => {
    const { show } = setup();
    show(0, 'major', { family: 'triad', primaryOnly: true });
    expect(symbols()).toEqual(['C', 'F', 'G']);
  });

  it('shows only the chords on one degree', () => {
    const { show } = setup();
    show(0, 'major', { family: 'triad', degree: 5 });
    expect(symbols()).toEqual(['G']);
  });

  it('writes the notes with the names the student has chosen', () => {
    const { show } = setup({ formatName: (note) => note.replace('b', '♭') });
    show('Bb', 'major', { family: 'triad', degree: 1 });
    expect($('.dict-card-symbol').textContent).toBe('B♭');
    expect($('.dict-card-notes').textContent).toBe('B♭ · D · F');
  });

  it('says so when no chord of the kind fits the scale', () => {
    const { show } = setup();
    show(0, 'major', { family: 'altered' });
    expect(all('.dict-card')).toHaveLength(0);
    expect($('.dict-chords-empty').hidden).toBe(false);
    expect($('.dict-chords-empty').textContent).toBe('No chord of this kind fits the scale.');
    show(0, 'major', { family: 'triad' });
    expect($('.dict-chords-empty').hidden).toBe(true);
  });
});

describe('ChordSection: the filters', () => {
  it('has a chip for all chords and for each family that has a chord in the scale, with the family of the choice pressed', () => {
    const { show } = setup();
    show(0, 'major', { family: 'seventh' });
    const families = all('.dict-families .sc-chip').map((c) => c.dataset.family);
    expect(families.slice(0, 3)).toEqual(['all', 'triad', 'sixth']);
    expect(families).not.toContain('altered'); // no altered chord fits C major
    expect($('.dict-families [aria-pressed="true"]').dataset.family).toBe('seventh');
    expect(all('.dict-families .sc-chip')[1].textContent).toBe('Triad');
  });

  it('says which family was pressed', () => {
    const { show, onChange } = setup();
    show(0, 'major');
    $('.dict-families [data-family="ninth"]').click();
    expect(onChange).toHaveBeenCalledWith({ family: 'ninth' });
    $('.dict-families [data-family="all"]').click();
    expect(onChange).toHaveBeenLastCalledWith({ family: 'all' });
  });

  it('has a choice of degree, with the note of each, and says which was chosen', () => {
    const { show, onChange } = setup();
    show(0, 'major');
    const select = $<HTMLSelectElement>('.dict-degree');
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Every degree', 'Degree 1 (C)', 'Degree 2 (D)', 'Degree 3 (E)', 'Degree 4 (F)', 'Degree 5 (G)', 'Degree 6 (A)', 'Degree 7 (B)']);
    expect(select.value).toBe('');
    select.value = '5';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith({ degree: 5 });
    select.value = '';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith({ degree: null });
  });

  it('marks the degree of the choice', () => {
    const { show } = setup();
    show(0, 'major', { degree: 4 });
    expect($<HTMLSelectElement>('.dict-degree').value).toBe('4');
  });

  it('has a button for the main chords only, which says it is pressed', () => {
    const { show, onChange } = setup();
    show(0, 'major');
    expect($('.dict-primary').getAttribute('aria-pressed')).toBe('false');
    $('.dict-primary').click();
    expect(onChange).toHaveBeenCalledWith({ primaryOnly: true });
    show(0, 'major', { primaryOnly: true });
    expect($('.dict-primary').getAttribute('aria-pressed')).toBe('true');
    $('.dict-primary').click();
    expect(onChange).toHaveBeenLastCalledWith({ primaryOnly: false });
  });

  it('has labels for each of them', () => {
    const { show } = setup();
    show(0, 'major');
    expect($('.dict-families').getAttribute('aria-label')).toBe('Kind of chord');
    expect($('.dict-degree').getAttribute('aria-label')).toBe('Chords on');
    expect($('.dict-primary').textContent).toBe('Main chords only (degrees 1, 4 and 5)');
    expect($('.dict-chords-title').textContent).toBe('Chords of this scale');
  });
});

describe('ChordSection: inversions', () => {
  it('shows each turn of a chord after the chord, with the lowest note after a slash', () => {
    const { show } = setup();
    show(0, 'major', { family: 'triad', degree: 1 });
    $('.dict-inversions').click();
    expect(symbols()).toEqual(['C', 'C/E', 'C/G']);
    expect(all('.dict-card').map((c) => c.dataset.inversion)).toEqual(['0', '1', '2']);
    expect(all('.dict-card-notes').map((n) => n.textContent)).toEqual(['C · E · G', 'E · G · C', 'G · C · E']);
    expect($('.dict-inversions').getAttribute('aria-pressed')).toBe('true');
  });

  it('is off again with a second press', () => {
    const { show } = setup();
    show(0, 'major', { family: 'triad', degree: 1 });
    $('.dict-inversions').click();
    $('.dict-inversions').click();
    expect(symbols()).toEqual(['C']);
    expect($('.dict-inversions').getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps the setting when the scale changes', () => {
    const { show } = setup();
    show(0, 'major', { family: 'triad', degree: 1 });
    $('.dict-inversions').click();
    show(7, 'major', { family: 'triad', degree: 1 });
    expect(symbols()).toEqual(['G', 'G/B', 'G/D']);
  });
});

describe('ChordSection: hearing a chord', () => {
  it('plays the notes one after the other and then all together when a card is pressed', async () => {
    const { show, voice } = setup();
    show(0, 'major', { family: 'triad', degree: 1 });
    $('.dict-card').click();
    await flush();
    const calls = vi.mocked(voice.play).mock.calls;
    expect(calls.slice(0, 3).map((c) => c[0])).toEqual(['C4', 'E4', 'G4']);
    expect(calls.slice(3).map((c) => c[0])).toEqual(['C4', 'E4', 'G4']);
    const starts = calls.map((c) => c[2]);
    expect(starts[1]).toBeGreaterThan(starts[0]);
    expect(starts[2]).toBeGreaterThan(starts[1]);
    expect(starts[3]).toBeGreaterThan(starts[2]);
    expect(starts[4]).toBe(starts[3]); // together
    expect(starts[5]).toBe(starts[3]);
  });

  it('plays an inversion with its lowest note first', async () => {
    const { show, voice } = setup();
    show(0, 'major', { family: 'triad', degree: 1 });
    $('.dict-inversions').click();
    all('.dict-card')[1].click(); // C over E
    await flush();
    expect(vi.mocked(voice.play).mock.calls.slice(0, 3).map((c) => c[0])).toEqual(['E4', 'G4', 'C5']);
  });

  it('gives the chord to whatever opens it, instead of playing it, when there is one', async () => {
    const onOpen = vi.fn();
    const { show, voice } = setup({ onOpen });
    show(0, 'major', { family: 'triad', degree: 1 });
    $('.dict-card').click();
    await flush();
    expect(onOpen).toHaveBeenCalledTimes(1);
    const chord = onOpen.mock.calls[0][0] as ScaleChord;
    expect(chord).toMatchObject({ symbol: 'C', degree: 1, inversion: 0 });
    expect(voice.play).not.toHaveBeenCalled();
  });

  it('says so when the sound cannot be loaded', async () => {
    const { show, voice } = setup();
    vi.mocked(voice.ready).mockResolvedValue(false);
    show(0, 'major', { family: 'triad', degree: 1 });
    $('.dict-card').click();
    await flush();
    expect(voice.play).not.toHaveBeenCalled();
    expect($('.dict-chords-status').textContent).toMatch(/could not be loaded/);
  });

  it('names the button for a screen reader', () => {
    const { show } = setup();
    show(0, 'major', { family: 'triad', degree: 2 });
    expect($('.dict-card').getAttribute('aria-label')).toBe('Hear Dm');
  });

  it('stops the sound when the section is left', () => {
    const { section, voice } = setup();
    section.deactivate();
    expect(voice.stopAll).toHaveBeenCalled();
  });
});

describe('ChordSection: the Persian modes', () => {
  it('has no card for a quarter tone, and says how many there are and why', () => {
    const { show } = setup();
    show('D', 'shur', { family: 'triad' });
    expect(symbols()).toEqual(['Dm', 'F', 'Gm', 'Bb']);
    expect($('.dict-chords-quarter').hidden).toBe(false);
    expect($('.dict-chords-quarter').textContent).toMatch(/^Quarter tones in this mode: 1\./);
  });

  it('says nothing about quarter tones for a mode that has none, or for any other scale', () => {
    const { show } = setup();
    show('C', 'mahur', { family: 'triad' });
    expect($('.dict-chords-quarter').hidden).toBe(true);
    show(0, 'major', { family: 'triad' });
    expect($('.dict-chords-quarter').hidden).toBe(true);
  });

  it('counts a quarter-tone root among them', () => {
    const { show } = setup();
    show('Ek', 'segah', { family: 'triad' }); // Ek F G Ak Bb C D
    expect($('.dict-chords-quarter').textContent).toMatch(/^Quarter tones in this mode: 2\./);
    expect(symbols()).toEqual(['Gm', 'Bb']);
  });

  it('offers only the degrees that can have a chord', () => {
    const { show } = setup();
    show('D', 'shur'); // D Ek F G A Bb C: the second degree is a quarter tone
    expect(Array.from($<HTMLSelectElement>('.dict-degree').options).map((o) => o.value)).toEqual(['', '1', '3', '4', '5', '6', '7']);
  });
});

describe('ChordSection: in Persian', () => {
  it('names the families and the chords in Persian', () => {
    setLocale('fa');
    const { show } = setup();
    show(0, 'major', { family: 'triad' });
    expect(all('.dict-families .sc-chip')[0].textContent).toBe('همه');
    expect(all('.dict-families .sc-chip')[1].textContent).toBe('سه‌صدایی');
    expect($('.dict-card-name').textContent).toBe('ماژور');
    expect($('.dict-chords-title').textContent).toBe('آکوردهای این گام');
  });
});
