import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderBlock, type BlockContext } from '../lessons/lessonBlocks';
import { setLocale } from '../i18n';
import { h, keys, list, p, staff, terms, tip, fingers } from '../lessons/build';

function context(overrides: Partial<BlockContext> = {}): BlockContext {
  return { locale: 'en', system: 'letters', toolkit: null, ...overrides };
}

describe('renderBlock', () => {
  beforeEach(() => setLocale('en'));

  it('writes a paragraph, a heading and a tip', () => {
    expect(renderBlock(p('Hello {C}', 'سلام'), context()).outerHTML).toContain('<p class="lesson-p">Hello C</p>');
    expect(renderBlock(h('Title', 'عنوان'), context()).tagName).toBe('H3');
    const tipEl = renderBlock(tip('Be calm', 'آرام باشید'), context());
    expect(tipEl.getAttribute('role')).toBe('note');
    expect(tipEl.textContent).toContain('Be calm');
    expect(tipEl.textContent).toContain('Tip');
  });

  it('fills the note names in the chosen system and language', () => {
    const en = renderBlock(p('Play {C} then {F#}', 'بنوازید {C}'), context({ system: 'solfege' }));
    expect(en.textContent).toBe('Play Do then Fa♯');
    const fa = renderBlock(p('Play', 'نت {E} را بنوازید'), context({ locale: 'fa', system: 'solfege-fa' }));
    expect(fa.textContent).toBe('نت می را بنوازید');
  });

  it('writes a list', () => {
    const el = renderBlock(list(['One', 'یک'], ['Two', 'دو']), context());
    expect(el.tagName).toBe('UL');
    expect(Array.from(el.querySelectorAll('li')).map((li) => li.textContent)).toEqual(['One', 'Two']);
  });

  it('writes terms with their symbols', () => {
    const el = renderBlock(terms(['p', 'soft', 'آرام'], ['1 ♯', 'one sharp', 'یک دیز']), context());
    expect(Array.from(el.querySelectorAll('dt')).map((dt) => dt.textContent)).toEqual(['p', '1 ♯']);
    expect(Array.from(el.querySelectorAll('dd')).map((dd) => dd.textContent)).toEqual(['soft', 'one sharp']);
  });

  it('turns the digits of a symbol into Persian digits when the language asks for it', () => {
    setLocale('fa');
    const el = renderBlock(terms(['2 ♯', 'x', 'دو دیز']), context({ locale: 'fa' }));
    expect(el.querySelector('dt')!.textContent).toBe('۲ ♯');
  });

  describe('a staff example', () => {
    const toolkit = {
      setOptions: vi.fn(),
      loadData: vi.fn(),
      renderToSVG: vi.fn(
        () => '<svg xmlns="http://www.w3.org/2000/svg" width="400px" height="100px"><g class="note"><g class="notehead"><use x="1" y="2"/></g></g></svg>'
      ),
    };

    it('draws the notes and the caption', () => {
      const figure = renderBlock(staff({ clef: 'treble', notes: 'C4w' }, 'A caption', 'شرح'), context({ toolkit }));
      expect(figure.tagName).toBe('FIGURE');
      expect(figure.querySelector('svg')).not.toBeNull();
      expect(figure.querySelector('figcaption')!.textContent).toBe('A caption');
      expect(figure.querySelector('.lesson-staff')!.getAttribute('dir')).toBe('ltr');
    });

    it('writes the note names under the notes in the chosen system', () => {
      const figure = renderBlock(staff({ clef: 'treble', notes: 'C4w' }, undefined, undefined, { names: true }), context({ toolkit, system: 'solfege' }));
      expect(figure.querySelector('.note-label')!.textContent).toBe('Do');
    });

    it('has a Play button only when the example can be listened to', () => {
      const listen = renderBlock(staff({ clef: 'treble', notes: 'C4w' }, undefined, undefined, { listen: true }), context({ toolkit, playExample: vi.fn(() => () => {}) }));
      expect(listen.querySelector('.lesson-play')).not.toBeNull();
      const silent = renderBlock(staff({ clef: 'treble', notes: 'C4w' }), context({ toolkit, playExample: vi.fn(() => () => {}) }));
      expect(silent.querySelector('.lesson-play')).toBeNull();
      const noPlayer = renderBlock(staff({ clef: 'treble', notes: 'C4w' }, undefined, undefined, { listen: true }), context({ toolkit }));
      expect(noPlayer.querySelector('.lesson-play')).toBeNull();
    });

    it('plays on a press and turns into a Stop button until it ends', () => {
      let finish = () => {};
      const stop = vi.fn();
      const playExample = vi.fn((_spec, onDone: () => void) => {
        finish = onDone;
        return stop;
      });
      const figure = renderBlock(staff({ clef: 'treble', notes: 'C4w' }, undefined, undefined, { listen: true }), context({ toolkit, playExample }));
      const button = figure.querySelector<HTMLButtonElement>('.lesson-play')!;
      expect(button.textContent).toBe('Play');
      button.click();
      expect(playExample).toHaveBeenCalledOnce();
      expect(button.textContent).toBe('Stop');
      expect(button.getAttribute('aria-pressed')).toBe('true');
      finish();
      expect(button.textContent).toBe('Play');
      expect(button.getAttribute('aria-pressed')).toBe('false');
    });

    it('stops the sound when Stop is pressed', () => {
      const stop = vi.fn();
      const playExample = vi.fn(() => stop);
      const figure = renderBlock(staff({ clef: 'treble', notes: 'C4w' }, undefined, undefined, { listen: true }), context({ toolkit, playExample }));
      const button = figure.querySelector<HTMLButtonElement>('.lesson-play')!;
      button.click();
      button.click();
      expect(stop).toHaveBeenCalledOnce();
      expect(button.textContent).toBe('Play');
    });
  });

  describe('a keyboard', () => {
    it('draws the keys with names and marks, and plays a key', () => {
      const playNote = vi.fn();
      const figure = renderBlock(
        keys('C4', 'B4', { names: 'white', marks: { C4: '1', E4: '' } }, 'Keys', 'کلیدها'),
        context({ playNote, system: 'solfege' })
      );
      expect(figure.querySelectorAll('.lk-key.white')).toHaveLength(7);
      expect(Array.from(figure.querySelectorAll('.lk-key.white .lk-name')).map((n) => n.textContent).slice(0, 3)).toEqual(['Do', 'Re', 'Mi']);
      expect(figure.querySelector('[data-note="C4"] .lk-mark')!.textContent).toBe('1');
      expect(figure.querySelector('figcaption')!.textContent).toBe('Keys');
      figure.querySelector('[data-note="G4"]')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      expect(playNote).toHaveBeenCalledWith('G4');
    });

    it('fills in note tokens that are used as marks', () => {
      const figure = renderBlock(keys('C4', 'B4', { names: 'none', marks: { C4: '{C}' } }), context({ system: 'solfege' }));
      expect(figure.querySelector('[data-note="C4"] .lk-mark')!.textContent).toBe('Do');
    });
  });

  it('draws the hands with the finger numbers', () => {
    const figure = renderBlock(fingers('Hands', 'دست‌ها'), context());
    expect(figure.querySelectorAll('.fp-finger')).toHaveLength(10);
    expect(figure.querySelector('figcaption')!.textContent).toBe('Hands');
  });
});
