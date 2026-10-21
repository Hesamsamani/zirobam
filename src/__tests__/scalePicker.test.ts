import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initLocale, setLocale } from '../i18n';
import { DEFAULT_CHOICE, type Choice } from '../scales/dictionaryState';
import { ScalePicker } from '../scales/scalePicker';

function setup(choice: Partial<Choice> = {}) {
  const onChange = vi.fn();
  const picker = new ScalePicker({ onChange, formatName: (note) => note });
  document.body.replaceChildren(picker.element);
  const render = (next: Partial<Choice> = {}) => picker.render({ ...DEFAULT_CHOICE, ...choice, ...next });
  render();
  return { picker, onChange, render };
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const all = <T extends HTMLElement>(selector: string) => Array.from(document.querySelectorAll<T>(selector));
const type = (value: string) => {
  const input = $<HTMLInputElement>('.dict-search');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const enter = () => $('.dict-search').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

beforeEach(() => {
  localStorage.clear();
  initLocale();
  setLocale('en');
});

describe('the groups of scales', () => {
  it('has a chip for all scales and one for each group, with the group of the choice pressed', () => {
    setup();
    expect(all('.dict-categories .sc-chip').map((c) => c.dataset.category)).toEqual(['all', 'major', 'minor', 'church', 'persian', 'pentatonic', 'blues', 'chromatic', 'wholetone', 'diminished']);
    expect(all('.dict-categories .sc-chip').map((c) => c.textContent)).toEqual(['All', 'Major', 'Minor', 'Church modes', 'Persian music', 'Pentatonic', 'Blues', 'Chromatic', 'Whole tone', 'Diminished']);
    expect($('.dict-categories [aria-pressed="true"]').dataset.category).toBe('major');
  });

  it('says which group was pressed', () => {
    const { onChange } = setup();
    $('.dict-categories [data-category="persian"]').click();
    expect(onChange).toHaveBeenCalledWith({ category: 'persian' });
  });

  it('lists the scales of the group', () => {
    const { render } = setup();
    expect(all('.dict-scales .sc-chip').map((c) => c.textContent)).toEqual(['Major', 'Harmonic major', 'Double harmonic major']);
    render({ category: 'persian' });
    expect(all('.dict-scales .sc-chip')).toHaveLength(12);
    expect(all('.dict-scales .sc-chip')[0].textContent).toBe('Shur');
    render({ category: 'all' });
    expect(all('.dict-scales .sc-chip')).toHaveLength(32);
  });
});

describe('the scales', () => {
  it('marks the scale of the choice', () => {
    setup({ category: 'minor', scale: 'harmonic-minor' });
    expect($('.dict-scales [aria-pressed="true"]').dataset.type).toBe('harmonic-minor');
    expect(all('.dict-scales [aria-pressed="true"]')).toHaveLength(1);
  });

  it('says which scale was pressed, and leaves the root alone for an ordinary scale', () => {
    const { onChange } = setup({ category: 'minor' });
    $('.dict-scales [data-type="melodic-minor"]').click();
    expect(onChange).toHaveBeenCalledWith({ scale: 'melodic-minor' });
  });

  it('opens a Persian mode on its usual root', () => {
    const { onChange } = setup({ category: 'persian' });
    $('.dict-scales [data-type="shur"]').click();
    expect(onChange).toHaveBeenLastCalledWith({ scale: 'shur', root: 'D' });
    $('.dict-scales [data-type="segah"]').click();
    expect(onChange).toHaveBeenLastCalledWith({ scale: 'segah', root: 'Ek' });
  });

  it('takes a quarter-tone root back to its note when the scale is not a Persian one', () => {
    const { onChange } = setup({ root: 'Ek', scale: 'segah', category: 'major' });
    $('.dict-scales [data-type="major"]').click();
    expect(onChange).toHaveBeenCalledWith({ scale: 'major', root: 4 });
  });

  it('keeps a root that is a note of the piano when the scale is not a Persian one', () => {
    const { onChange } = setup({ root: 'Db', scale: 'shur', category: 'major' });
    $('.dict-scales [data-type="major"]').click();
    expect(onChange).toHaveBeenCalledWith({ scale: 'major' });
  });
});

describe('the root', () => {
  it('has twelve notes, written the way the chosen scale writes them, and marks the root', () => {
    const { render } = setup();
    expect(all('.sc-roots .sc-chip').map((c) => c.textContent)).toEqual(['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']);
    expect($('.sc-roots [aria-pressed="true"]').textContent).toBe('C');
    render({ root: 1 });
    expect($('.sc-roots [aria-pressed="true"]').dataset.root).toBe('1');
    // a minor scale with a raised seventh is easier on A flat than on G sharp
    render({ scale: 'harmonic-minor' });
    expect(all('.sc-roots .sc-chip')[8].textContent).toBe('Ab');
  });

  it('says which note was pressed', () => {
    const { onChange } = setup();
    $('.sc-roots [data-root="7"]').click();
    expect(onChange).toHaveBeenCalledWith({ root: 7 });
  });

  it('marks the chip of a root given by name', () => {
    setup({ root: 'F#' });
    expect($('.sc-roots [aria-pressed="true"]').dataset.root).toBe('6');
  });

  it('marks the chip of the letter for a quarter-tone root', () => {
    setup({ root: 'Ek', scale: 'segah' });
    expect($('.sc-roots [aria-pressed="true"]').dataset.root).toBe('4');
  });

  describe('the quarter-tone toggle', () => {
    it('is pressed for a koron root, and not for any other', () => {
      const { render } = setup({ root: 'Ek', scale: 'segah' });
      expect($('.dict-koron').getAttribute('aria-pressed')).toBe('true');
      render({ root: 4 });
      expect($('.dict-koron').getAttribute('aria-pressed')).toBe('false');
    });

    it('is open for a note without a sign, and closed for one with a sharp or a flat', () => {
      const { render } = setup({ root: 4 });
      expect($<HTMLButtonElement>('.dict-koron').disabled).toBe(false);
      render({ root: 3 });
      expect($<HTMLButtonElement>('.dict-koron').disabled).toBe(true);
      render({ root: 'Db' });
      expect($<HTMLButtonElement>('.dict-koron').disabled).toBe(true);
      render({ root: 'E' });
      expect($<HTMLButtonElement>('.dict-koron').disabled).toBe(false);
    });

    it('lowers the root a quarter tone, and raises it again', () => {
      const { onChange, render } = setup({ root: 4 });
      $('.dict-koron').click();
      expect(onChange).toHaveBeenLastCalledWith({ root: 'Ek' });
      render({ root: 'Ek' });
      $('.dict-koron').click();
      expect(onChange).toHaveBeenLastCalledWith({ root: 4 });
    });

    it('keeps the quarter tone when another note without a sign is pressed, and drops it for a note with one', () => {
      const { onChange } = setup({ root: 'Ek', scale: 'segah' });
      $('.sc-roots [data-root="2"]').click(); // D
      expect(onChange).toHaveBeenLastCalledWith({ root: 'Dk' });
      $('.sc-roots [data-root="3"]').click(); // E flat
      expect(onChange).toHaveBeenLastCalledWith({ root: 3 });
    });
  });
});

describe('the search', () => {
  it('shows the scales that fit instead of the list, and says how many', () => {
    setup();
    type('dorian');
    expect(all('.dict-scales .sc-chip').map((c) => c.dataset.type)).toEqual(['dorian']);
    expect($('.dict-search-status').textContent).toBe('Scales found: 1');
    type('minor');
    expect(all('.dict-scales .sc-chip').length).toBeGreaterThan(3);
    expect(all('.dict-scales .sc-chip')[0].dataset.type).toBe('natural-minor');
  });

  it('shows the root that was typed with the scale', () => {
    setup();
    type('C Dorian');
    expect(all('.dict-scales .sc-chip')[0].textContent).toBe('C Dorian');
    type('ماهور ر');
    expect(all('.dict-scales .sc-chip')[0].textContent).toBe('D Mahur');
  });

  it('chooses the scale, and the root and the group that go with it, when a result is pressed', () => {
    const { onChange } = setup();
    type('bb blues');
    $('.dict-scales .sc-chip').click();
    expect(onChange).toHaveBeenCalledWith({ scale: 'blues', category: 'blues', root: 'Bb' });
  });

  it('chooses the first result on Enter', () => {
    const { onChange } = setup();
    type('F# lydian');
    enter();
    expect(onChange).toHaveBeenCalledWith({ scale: 'lydian', category: 'church', root: 'F#' });
  });

  it('chooses a Persian mode on its usual root when no root was typed', () => {
    const { onChange } = setup();
    type('segah');
    enter();
    expect(onChange).toHaveBeenCalledWith({ scale: 'segah', category: 'persian', root: 'Ek' });
  });

  it('does not touch the root for an ordinary scale typed without one', () => {
    const { onChange } = setup();
    type('dorian');
    enter();
    expect(onChange).toHaveBeenCalledWith({ scale: 'dorian', category: 'church' });
  });

  it('empties the box once a scale is chosen, and shows the list again', () => {
    const { render } = setup();
    type('dorian');
    $('.dict-scales .sc-chip').click();
    expect($<HTMLInputElement>('.dict-search').value).toBe('');
    render({ scale: 'dorian', category: 'church' });
    expect(all('.dict-scales .sc-chip')).toHaveLength(5);
    expect($('.dict-search-status').textContent).toBe('');
  });

  it('says so when nothing fits, and shows no chip', () => {
    setup();
    type('banana');
    expect(all('.dict-scales .sc-chip')).toHaveLength(0);
    expect($('.dict-search-status').textContent).toBe('No scale matches “banana”.');
    enter(); // nothing to choose
  });

  it('shows the list again when the box is emptied', () => {
    setup();
    type('dorian');
    type('');
    expect(all('.dict-scales .sc-chip')).toHaveLength(3);
    expect($('.dict-search-status').textContent).toBe('');
  });

  it('keeps what was typed when the screen is drawn again', () => {
    const { render } = setup();
    type('minor');
    render({ root: 5 });
    expect($<HTMLInputElement>('.dict-search').value).toBe('minor');
    expect(all('.dict-scales .sc-chip')[0].dataset.type).toBe('natural-minor');
  });

  it('has a label for the box and a hint of what to try', () => {
    setup();
    expect($('.dict-search').getAttribute('aria-label')).toBe('Search scales');
    expect($('.dict-search').getAttribute('placeholder')).toBe('Try: C Dorian, A minor, Shur');
    expect($('.dict-search-status').getAttribute('role')).toBe('status');
  });
});

describe('in Persian', () => {
  it('names the groups and the scales in Persian', () => {
    setLocale('fa');
    const { render } = setup();
    expect(all('.dict-categories .sc-chip')[0].textContent).toBe('همه');
    expect(all('.dict-categories .sc-chip')[4].textContent).toBe('موسیقی ایرانی');
    render({ category: 'persian' });
    expect(all('.dict-scales .sc-chip')[0].textContent).toBe('دستگاه شور');
  });
});
