import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PracticeAids } from '../practice/practiceAids';
import { PracticeOptionsStore } from '../practice/practiceOptions';
import { initLocale, setLocale } from '../i18n';

function setup(bpm = 80, open = true) {
  const options = new PracticeOptionsStore();
  const state = { base: bpm, current: bpm };
  const setBpm = vi.fn((value: number) => {
    state.current = value;
    aids.refresh();
  });
  const aids = new PracticeAids({ options, baseBpm: () => state.base, currentBpm: () => state.current, setBpm });
  document.body.replaceChildren(aids.opener, aids.element);
  if (open) aids.opener.click();
  return { aids, options, state, setBpm };
}
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const pressed = (selector: string) => $(selector).getAttribute('aria-pressed');

beforeEach(() => {
  localStorage.clear();
  initLocale();
  setLocale('en');
});

describe('PracticeAids: folded away', () => {
  it('shows only a small button until it is opened', () => {
    setup(80, false);
    expect($('.pa-open').textContent).toBe('Practice aids');
    expect($('.pa-open').getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('.pa-row')).toBeNull();
    expect($('.practice-aids').hidden).toBe(true);
  });

  it('opens and folds again, and remembers which it was', () => {
    setup(80, false);
    $('.pa-open').click();
    expect($('.pa-open').getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelectorAll('.pa-row')).toHaveLength(3);
    setup(80, false); // the next visit
    expect($('.pa-open').getAttribute('aria-expanded')).toBe('true');
    $('.pa-open').click();
    expect(document.querySelector('.pa-row')).toBeNull();
    setup(80, false);
    expect($('.pa-open').getAttribute('aria-expanded')).toBe('false');
  });

  it('says how many aids are on, even when it is folded', () => {
    const { options, state, aids } = setup(80, false);
    expect(document.querySelector('.pa-count')).toBeNull();
    options.set({ wait: true });
    expect($('.pa-count').textContent).toBe('1');
    options.set({ hand: 'right', loop: true });
    state.current = 40;
    aids.refresh();
    expect($('.pa-count').textContent).toBe('4'); // wait, repeat, speed and hand
  });

  it('counts in Persian digits', () => {
    setLocale('fa');
    const { options } = setup(80, false);
    options.set({ wait: true });
    expect($('.pa-count').textContent).toBe('۱');
    expect($('.pa-open').textContent).toContain('کمک‌های تمرین');
  });
});

describe('PracticeAids', () => {
  it('shows the three aids, the speeds and the hands, all off or at their start', () => {
    setup();
    expect($('[data-aid="wait"]').textContent).toBe('Wait for me');
    expect($('[data-aid="loop"]').textContent).toBe('Repeat this step');
    expect($('[data-aid="ladder"]').textContent).toBe('Speed up as I improve');
    for (const aid of ['wait', 'loop', 'ladder']) expect(pressed(`[data-aid="${aid}"]`)).toBe('false');
    expect(pressed('[data-pick="both"]')).toBe('true');
    expect(pressed('[data-speed="100"]')).toBe('true');
  });

  it('turns an aid on and off, and remembers it', () => {
    const { options } = setup();
    $('[data-aid="wait"]').click();
    expect(options.get().wait).toBe(true);
    expect(pressed('[data-aid="wait"]')).toBe('true');
    $('[data-aid="wait"]').click();
    expect(options.get().wait).toBe(false);
  });

  it('slows the song down to a share of the tempo the student set', () => {
    const { setBpm, state } = setup(80);
    $('[data-speed="50"]').click();
    expect(setBpm).toHaveBeenCalledWith(40);
    expect(state.current).toBe(40);
    expect(pressed('[data-speed="50"]')).toBe('true');
    expect(pressed('[data-speed="100"]')).toBe('false');
    $('[data-speed="100"]').click();
    expect(setBpm).toHaveBeenLastCalledWith(80);
  });

  it('shows no speed as chosen when the tempo is somewhere else', () => {
    const { aids, state } = setup(80);
    state.current = 66;
    aids.refresh();
    for (const percent of [50, 75, 100]) expect(pressed(`[data-speed="${percent}"]`)).toBe('false');
  });

  it('says what each speed means in beats per minute, for a screen reader', () => {
    setup(80);
    expect($('[data-speed="75"]').getAttribute('aria-label')).toBe('75% of the tempo, 60 BPM');
  });

  it('chooses the hand', () => {
    const { options } = setup();
    $('[data-pick="left"]').click();
    expect(options.get().hand).toBe('left');
    expect(pressed('[data-pick="left"]')).toBe('true');
    expect(pressed('[data-pick="both"]')).toBe('false');
  });

  it('does not offer a hand that only rests', () => {
    const { aids } = setup();
    aids.setHandsAvailable(true, false);
    expect($<HTMLButtonElement>('[data-pick="left"]').disabled).toBe(true);
    expect($<HTMLButtonElement>('[data-pick="right"]').disabled).toBe(false);
    expect($<HTMLButtonElement>('[data-pick="both"]').disabled).toBe(false);
  });

  it('follows a change made somewhere else', () => {
    const { options } = setup();
    options.set({ loop: true });
    expect(pressed('[data-aid="loop"]')).toBe('true');
  });

  it('speaks Persian, with Persian digits and the Persian percent sign', () => {
    setLocale('fa');
    setup(80);
    expect($('[data-aid="wait"]').textContent).toBe('منتظر من بمان');
    expect($('[data-speed="75"]').textContent).toBe('۷۵٪');
    expect($('[data-pick="right"]').textContent).toBe('راست');
  });
});
