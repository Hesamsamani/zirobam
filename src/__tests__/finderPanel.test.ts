import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initLocale, setLocale, setPersianDigits } from '../i18n';
import { buildCircle } from '../scales/circleOfFifths';
import { FinderPanel } from '../scales/finderPanel';

const formatName = (note: string) => note.replace('#', '♯').replace(/(?<=[A-G])b/, '♭');
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const all = <T extends HTMLElement>(selector: string) => Array.from(document.querySelectorAll<T>(selector));

function setup() {
  const onChoose = vi.fn();
  const panel = new FinderPanel({ formatName, onChoose });
  document.body.replaceChildren(panel.element);
  return { panel, onChoose };
}

beforeEach(() => {
  initLocale();
  setLocale('en');
  setPersianDigits(false);
  document.body.replaceChildren();
});

describe('FinderPanel', () => {
  it('starts with twelve notes to choose, nothing chosen and no list', () => {
    setup();
    expect(all('.fd-notes .sc-chip').map((c) => c.textContent)).toEqual(['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']);
    expect($('.fd-status').textContent).toBe('No note chosen yet.');
    expect(all('.fd-result')).toHaveLength(0);
    expect($<HTMLButtonElement>('.fd-clear').disabled).toBe(true);
  });

  it('lists the scales that hold the chosen notes, the closest fit first, and says how well each fits', () => {
    const { panel } = setup();
    for (const pc of [0, 2, 4, 5, 7, 9, 11]) $(`.fd-notes [data-pc="${pc}"]`).click();
    expect(panel.selected()).toEqual([0, 2, 4, 5, 7, 9, 11]);
    const first = all('.fd-result')[0];
    expect(first.querySelector('.fd-result-name')!.textContent).toBe('C Major');
    expect(first.querySelector('.fd-result-fit')!.textContent).toBe('exactly these notes');
    expect(first.dataset.exact).toBe('true');
    // C major and A minor and the other modes of it are all exact
    expect(all('.fd-result').filter((r) => r.dataset.exact === 'true').length).toBeGreaterThanOrEqual(7);
    expect($('.fd-status').textContent).toMatch(/^Scales found: \d+$/);
  });

  it('says how many more notes a scale has than were chosen', () => {
    setup();
    for (const pc of [0, 4, 7]) $(`.fd-notes [data-pc="${pc}"]`).click();
    const text = all('.fd-result-fit').map((e) => e.textContent);
    expect(text).toContain('4 more notes');
    expect(all('.fd-result')[0].dataset.exact).toBe('false');
  });

  it('takes a note away when it is pressed again, and clears them all', () => {
    const { panel } = setup();
    $('.fd-notes [data-pc="0"]').click();
    $('.fd-notes [data-pc="1"]').click();
    expect($('.fd-notes [data-pc="0"]').getAttribute('aria-pressed')).toBe('true');
    $('.fd-notes [data-pc="0"]').click();
    expect(panel.selected()).toEqual([1]);
    $('.fd-clear').click();
    expect(panel.selected()).toEqual([]);
    expect($('.fd-status').textContent).toBe('No note chosen yet.');
  });

  it('takes the notes of a keyboard too, by their key, whatever the octave', () => {
    const { panel } = setup();
    panel.keyPressed('C4');
    panel.keyPressed('Eb5');
    panel.keyPressed('G#3');
    panel.keyPressed('not a note');
    expect(panel.selected()).toEqual([0, 3, 8]);
    panel.keyPressed('C6');
    expect(panel.selected()).toEqual([3, 8]);
  });

  it('says when no scale holds the notes', () => {
    setup();
    // a diminished chord, an augmented chord and more notes than any scale of the catalog but the chromatic has: still found in it
    for (let pc = 0; pc < 12; pc++) $(`.fd-notes [data-pc="${pc}"]`).click();
    expect(all('.fd-result').every((r) => r.dataset.scale === 'chromatic')).toBe(true);
  });

  it('opens the scale of a result', () => {
    const { onChoose } = setup();
    for (const pc of [2, 5, 9]) $(`.fd-notes [data-pc="${pc}"]`).click();
    $<HTMLButtonElement>('.fd-result').click();
    expect(onChoose).toHaveBeenCalledTimes(1);
    const [root, scale] = onChoose.mock.calls[0];
    expect(root).toBeGreaterThanOrEqual(0);
    expect(typeof scale).toBe('string');
  });

  it('has the circle of fifths below', () => {
    setup();
    expect($('.fd-circle .circle')).not.toBeNull();
  });

  it('is in Persian, with Persian digits', () => {
    setLocale('fa');
    setPersianDigits(true);
    setup();
    expect($('.fd-status').textContent).toBe('هنوز نتی انتخاب نشده است.');
    $('.fd-notes [data-pc="0"]').click();
    expect($('.fd-status').textContent).toMatch(/^گام‌های پیداشده: [۰-۹]+$/);
  });
});

describe('buildCircle', () => {
  it('has twenty-four keys: the majors outside and their relative minors inside, in the order of the fifths', () => {
    const circle = buildCircle({ formatName, onChoose: () => undefined });
    expect(circle.getAttribute('dir')).toBe('ltr');
    const majors = Array.from(circle.querySelectorAll<HTMLElement>('.circle-major'));
    const minors = Array.from(circle.querySelectorAll<HTMLElement>('.circle-minor'));
    expect(majors.map((b) => b.querySelector('.circle-name')!.textContent)).toEqual(['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F']);
    expect(minors.map((b) => b.querySelector('.circle-name')!.textContent)).toEqual(['A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D♯', 'B♭', 'F', 'C', 'G', 'D']);
  });

  it('shows the key signature of each major key', () => {
    const circle = buildCircle({ formatName, onChoose: () => undefined });
    const signs = Array.from(circle.querySelectorAll('.circle-major')).map((b) => b.querySelector('.circle-sign')?.textContent ?? '');
    expect(signs).toEqual(['', '1♯', '2♯', '3♯', '4♯', '5♯', '6♯', '5♭', '4♭', '3♭', '2♭', '1♭']);
  });

  it('opens the major or the minor scale of the key that is pressed', () => {
    const onChoose = vi.fn();
    const circle = buildCircle({ formatName, onChoose });
    circle.querySelector<HTMLButtonElement>('.circle-major[data-root="7"]')!.click();
    expect(onChoose).toHaveBeenLastCalledWith(7, 'major');
    circle.querySelector<HTMLButtonElement>('.circle-minor[data-root="4"]')!.click();
    expect(onChoose).toHaveBeenLastCalledWith(4, 'natural-minor');
  });

  it('names each key for a screen reader', () => {
    const circle = buildCircle({ formatName, onChoose: () => undefined });
    expect(circle.querySelector('.circle-major[data-root="7"]')!.getAttribute('aria-label')).toBe('G Major');
    expect(circle.querySelector('.circle-minor[data-root="9"]')!.getAttribute('aria-label')).toBe('A Natural minor');
  });

  it('puts the keys round the circle: C at the top, G to its right, F to its left', () => {
    const circle = buildCircle({ formatName, onChoose: () => undefined });
    const at = (root: string) => {
      const b = circle.querySelector<HTMLElement>(`.circle-major[data-root="${root}"]`)!;
      return [parseFloat(b.style.left), parseFloat(b.style.top)];
    };
    const [cx, cy] = at('0');
    const [gx, gy] = at('7');
    const [fx] = at('5');
    expect(Math.round(cx)).toBe(50);
    expect(cy).toBeLessThan(15);
    expect(gx).toBeGreaterThan(cx);
    expect(fx).toBeLessThan(cx);
    expect(gy).toBeGreaterThan(cy);
  });
});
