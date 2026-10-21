import { describe, it, expect, vi } from 'vitest';
import { buildKeysPicture, type KeysPictureOptions } from '../lessons/keysPicture';

function make(overrides: Partial<KeysPictureOptions> = {}): HTMLElement {
  return buildKeysPicture({
    from: 'C4',
    to: 'B4',
    names: 'none',
    formatName: (note) => note.replace(/\d+$/, ''),
    formatMark: (text) => text,
    ariaLabel: 'Keyboard',
    ...overrides,
  });
}

const keyOf = (root: HTMLElement, note: string) => root.querySelector<HTMLButtonElement>(`[data-note="${note}"]`)!;

describe('buildKeysPicture: the root and the quarter tones', () => {
  it('marks the key of the root of a scale', () => {
    const root = make({ marks: { C4: '', E4: '', G4: '' }, rootNotes: ['C4'] });
    expect(keyOf(root, 'C4').classList.contains('lk-root')).toBe(true);
    expect(keyOf(root, 'E4').classList.contains('lk-root')).toBe(false);
    expect(root.querySelectorAll('.lk-root')).toHaveLength(1);
  });

  it('marks the root in every octave it is given', () => {
    const root = make({ from: 'C4', to: 'C6', rootNotes: ['C4', 'C5', 'C6'] });
    expect(root.querySelectorAll('.lk-root')).toHaveLength(3);
  });

  it('flags a key that stands for a quarter tone, says which, and names it for a screen reader', () => {
    const root = make({ marks: { E4: '' }, quarter: { E4: { kind: 'koron', label: 'koron' } } });
    const key = keyOf(root, 'E4');
    expect(key.classList.contains('lk-quarter')).toBe(true);
    expect(key.dataset.quarter).toBe('koron');
    expect(key.querySelector('.lk-quarter-label')!.textContent).toBe('koron');
    expect(key.getAttribute('aria-label')).toBe('E koron');
    expect(keyOf(root, 'F4').classList.contains('lk-quarter')).toBe(false);
  });

  it('can flag a sori too, on a black key', () => {
    const root = make({ quarter: { 'C#4': { kind: 'sori', label: 'sori' } } });
    expect(keyOf(root, 'C#4').dataset.quarter).toBe('sori');
    expect(keyOf(root, 'C#4').getAttribute('aria-label')).toBe('C# sori');
  });

  it('changes nothing for a picture without these options', () => {
    const root = make({ marks: { C4: '' } });
    expect(root.querySelectorAll('.lk-root, .lk-quarter, .lk-quarter-label')).toHaveLength(0);
    expect(keyOf(root, 'C4').getAttribute('aria-label')).toBe('C');
  });
});

describe('buildKeysPicture', () => {
  it('takes the range in any spelling: B sharp is C, and D double flat is C', () => {
    const root = make({ from: 'B#3', to: 'Dbb5' });
    const keys = Array.from(root.querySelectorAll<HTMLElement>('.lk-key'));
    expect(keys).toHaveLength(13);
    expect(keys[0].dataset.note).toBe('C4');
    expect(keys[12].dataset.note).toBe('C5');
  });

  it('draws one octave as seven white and five black keys, left to right', () => {
    const root = make();
    expect(root.querySelectorAll('.lk-key.white')).toHaveLength(7);
    expect(root.querySelectorAll('.lk-key.black')).toHaveLength(5);
    expect(root.getAttribute('dir')).toBe('ltr');
    expect(root.getAttribute('role')).toBe('group');
    expect(root.getAttribute('aria-label')).toBe('Keyboard');
    expect(root.style.getPropertyValue('--white-keys')).toBe('7');
  });

  it('puts each black key between the white keys it belongs to', () => {
    const root = make();
    const left = (note: string) => parseFloat(keyOf(root, note).style.left);
    expect(left('C#4')).toBeLessThan(left('D#4'));
    expect(left('D#4')).toBeLessThan(left('F#4'));
    // C# sits on the border between the first and second white key (1/7 of the width)
    expect(left('C#4') + parseFloat(keyOf(root, 'C#4').style.width) / 2).toBeCloseTo(100 / 7, 3);
  });

  it('shows no names by default', () => {
    const root = make();
    expect(root.querySelectorAll('.lk-name')).toHaveLength(0);
  });

  it('names the white keys', () => {
    const root = make({ names: 'white' });
    const names = Array.from(root.querySelectorAll('.lk-key.white .lk-name')).map((el) => el.textContent);
    expect(names).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(root.querySelectorAll('.lk-key.black .lk-name')).toHaveLength(0);
  });

  it('names the black keys with both their names', () => {
    const root = make({ names: 'all', formatName: (note) => note.replace('#', '♯').replace(/b/, '♭').replace(/\d+$/, '') });
    const sharp = keyOf(root, 'C#4').querySelectorAll('.lk-name');
    expect(Array.from(sharp).map((el) => el.textContent)).toEqual(['C♯', 'D♭']);
    const last = keyOf(root, 'A#4').querySelectorAll('.lk-name');
    expect(Array.from(last).map((el) => el.textContent)).toEqual(['A♯', 'B♭']);
  });

  it('puts a mark on a key, or only highlights it when the mark is empty', () => {
    const root = make({ marks: { C4: '1', E4: '', 'F#4': 'T' }, formatMark: (text) => `[${text}]` });
    expect(keyOf(root, 'C4').querySelector('.lk-mark')?.textContent).toBe('[1]');
    expect(keyOf(root, 'C4').classList.contains('marked')).toBe(true);
    expect(keyOf(root, 'E4').classList.contains('marked')).toBe(true);
    expect(keyOf(root, 'E4').querySelector('.lk-mark')).toBeNull();
    expect(keyOf(root, 'F#4').querySelector('.lk-mark')?.textContent).toBe('[T]');
    expect(keyOf(root, 'D4').classList.contains('marked')).toBe(false);
  });

  it('gives every key a name for screen readers, with the octave', () => {
    const root = make({ formatName: (note) => `n:${note}` });
    expect(keyOf(root, 'C4').getAttribute('aria-label')).toBe('n:C4');
    expect(keyOf(root, 'C#4').getAttribute('aria-label')).toBe('n:C#4');
  });

  it('plays a key when it is pressed', () => {
    const onPlay = vi.fn();
    const root = make({ onPlay });
    keyOf(root, 'E4').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(onPlay).toHaveBeenCalledWith('E4');
  });

  it('plays the focused key with Enter or Space, and moves with the arrow keys', () => {
    const onPlay = vi.fn();
    const root = make({ onPlay });
    document.body.appendChild(root);
    const first = keyOf(root, 'C4');
    expect(first.tabIndex).toBe(0);
    expect(keyOf(root, 'D4').tabIndex).toBe(-1);

    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(keyOf(root, 'C#4')); // pitch order, black keys included
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onPlay).toHaveBeenLastCalledWith('C#4');
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(onPlay).toHaveBeenCalledTimes(2);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(first);
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(first); // stops at the end
    root.remove();
  });

  it('works for a range that starts on a black key or covers several octaves', () => {
    const root = make({ from: 'A#3', to: 'D5' });
    expect(keyOf(root, 'A#3')).not.toBeNull();
    expect(root.querySelectorAll('.lk-key.white').length).toBe(1 + 7 + 2); // B3, C4..B4, C5 D5
    expect(parseFloat(keyOf(root, 'A#3').style.left)).toBeGreaterThanOrEqual(0);
  });
});

describe('buildKeysPicture: heat', () => {
  it('gives the keys that are missed a heat class and number, and leaves the others alone', () => {
    const picture = buildKeysPicture({ from: 'C4', to: 'C5', names: 'none', heat: { C4: 2, 'F#4': 5 }, formatName: (n) => n, formatMark: (m) => m, ariaLabel: 'keys' });
    const c4 = picture.querySelector<HTMLElement>('.lk-key[data-note="C4"]')!;
    expect(c4.classList.contains('lk-heat')).toBe(true);
    expect(c4.classList.contains('heat-2')).toBe(true);
    expect(c4.dataset.heat).toBe('2');
    expect(picture.querySelector<HTMLElement>('.lk-key[data-note="F#4"]')!.dataset.heat).toBe('5');
    expect(picture.querySelectorAll('.lk-heat')).toHaveLength(2);
    expect(picture.querySelector('.lk-key[data-note="D4"]')!.classList.contains('lk-heat')).toBe(false);
  });
});
