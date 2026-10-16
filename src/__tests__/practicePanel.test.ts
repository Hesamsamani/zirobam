import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initLocale, setLocale } from '../i18n';
import { generateSteps } from '../upload/steps';
import { PracticePanel, type PracticeView } from '../practice/practicePanel';

function viewOf(measureCount: number, currentIndex: number, attempt = 1): PracticeView {
  return { steps: generateSteps(measureCount), currentIndex, measureCount, attempt };
}

let onJump: ReturnType<typeof vi.fn<(index: number) => void>>;
let onPrevious: ReturnType<typeof vi.fn<() => void>>;
let onNext: ReturnType<typeof vi.fn<() => void>>;
let panel: PracticePanel;

const q = <T extends Element>(sel: string) => panel.element.querySelector(sel) as T;
const qa = <T extends Element>(sel: string) => Array.from(panel.element.querySelectorAll(sel)) as T[];
const measure = (n: number) => q<HTMLButtonElement>(`.pp-measure[data-measure="${n}"]`);
const states = () => qa<HTMLElement>('.pp-measure').map((m) => m.dataset.state);

beforeEach(() => {
  localStorage.clear();
  initLocale();
  onJump = vi.fn<(index: number) => void>();
  onPrevious = vi.fn<() => void>();
  onNext = vi.fn<() => void>();
  panel = new PracticePanel({ onJump, onPrevious, onNext });
  document.body.replaceChildren(panel.element);
});

describe('measure map', () => {
  it('has one button per measure, numbered', () => {
    panel.update(viewOf(8, 0));
    expect(qa('.pp-measure')).toHaveLength(8);
    expect(qa('.pp-measure').map((m) => m.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });

  it('stays left-to-right, like the score', () => {
    panel.update(viewOf(8, 0));
    expect(q('.pp-map').getAttribute('dir')).toBe('ltr');
  });

  it('breaks long pieces into rows of eight, like the systems of a score', () => {
    panel.update(viewOf(20, 0));
    expect(qa('.pp-system')).toHaveLength(3);
    expect(qa('.pp-system')[0].querySelectorAll('.pp-measure')).toHaveLength(8);
    expect(qa('.pp-system')[2].querySelectorAll('.pp-measure')).toHaveLength(4);
  });

  it('uses fewer columns for a short piece', () => {
    panel.update(viewOf(4, 0));
    expect(qa('.pp-system')).toHaveLength(1);
    expect((q('.pp-measures') as HTMLElement).style.getPropertyValue('--columns')).toBe('4');
  });

  it('marks measures already played through as done, the current ones, and the rest', () => {
    // steps for 8 measures: [1] [1,2] [2] [2,3] [3] ... index 4 is the single measure 3
    panel.update(viewOf(8, 4));
    expect(states()).toEqual(['done', 'done', 'current', 'todo', 'todo', 'todo', 'todo', 'todo']);
  });

  it('shows every measure of a pair or a phrase as current', () => {
    panel.update(viewOf(8, 1)); // pair 1-2
    expect(states().slice(0, 3)).toEqual(['current', 'current', 'todo']);
    const last = generateSteps(8).length - 1; // the whole piece
    panel.update(viewOf(8, last));
    expect(new Set(states())).toEqual(new Set(['current']));
  });

  it('gives each measure a spoken name that says its state', () => {
    panel.update(viewOf(8, 4));
    expect(measure(1).getAttribute('aria-label')).toBe('Measure 1, done');
    expect(measure(3).getAttribute('aria-label')).toBe('Measure 3, in this step');
    expect(measure(6).getAttribute('aria-label')).toBe('Measure 6');
    expect(measure(3).getAttribute('aria-current')).toBe('true');
    expect(measure(6).hasAttribute('aria-current')).toBe(false);
  });

  it('jumps to the step that teaches a measure when it is pressed', () => {
    const steps = generateSteps(8);
    panel.update(viewOf(8, 0));
    measure(3).click();
    expect(onJump).toHaveBeenCalledWith(steps.findIndex((s) => s.type === 'single' && s.measures[0] === 3));
    measure(1).click();
    expect(onJump).toHaveBeenLastCalledWith(0);
  });

  it('can be walked with the arrow keys, one tab stop for the whole map', () => {
    panel.update(viewOf(8, 4));
    expect(qa<HTMLButtonElement>('.pp-measure').filter((m) => m.tabIndex === 0)).toHaveLength(1);
    expect(measure(3).tabIndex).toBe(0);
    measure(3).focus();
    measure(3).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(measure(4));
    measure(4).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    measure(3).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(measure(2));
    measure(2).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(measure(8));
    measure(8).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(measure(1));
  });
});

describe('bracket under the current step', () => {
  it('spans the measures of the step and tells the step type', () => {
    panel.update(viewOf(8, 0)); // single 1
    let bracket = q<HTMLElement>('.pp-bracket');
    expect(bracket.dataset.type).toBe('single');
    expect([bracket.style.getPropertyValue('--from'), bracket.style.getPropertyValue('--to')]).toEqual(['1', '2']);

    panel.update(viewOf(8, 3)); // pair 2-3
    bracket = q<HTMLElement>('.pp-bracket');
    expect(bracket.dataset.type).toBe('pair');
    expect([bracket.style.getPropertyValue('--from'), bracket.style.getPropertyValue('--to')]).toEqual(['2', '4']);
  });

  it('spans a whole phrase', () => {
    const steps = generateSteps(8);
    const index = steps.findIndex((s) => s.type === 'consolidate' && s.measures.length === 4);
    panel.update(viewOf(8, index));
    const bracket = q<HTMLElement>('.pp-bracket');
    expect(bracket.dataset.type).toBe('consolidate');
    expect([bracket.style.getPropertyValue('--from'), bracket.style.getPropertyValue('--to')]).toEqual(['1', '5']);
  });

  it('continues onto the next row when a step runs across rows', () => {
    const steps = generateSteps(20);
    const index = steps.findIndex((s) => s.type === 'consolidate' && s.measures.length === 20);
    panel.update({ steps, currentIndex: index, measureCount: 20, attempt: 1 });
    const brackets = qa<HTMLElement>('.pp-bracket');
    expect(brackets).toHaveLength(3);
    expect(brackets[0].classList.contains('open-end')).toBe(true);
    expect(brackets[0].classList.contains('open-start')).toBe(false);
    expect(brackets[1].classList.contains('open-start')).toBe(true);
    expect(brackets[1].classList.contains('open-end')).toBe(true);
    expect(brackets[2].classList.contains('open-end')).toBe(false);
  });

  it('is drawn only on the rows the step touches', () => {
    panel.update(viewOf(20, 0));
    expect(qa('.pp-bracket')).toHaveLength(1);
  });
});

describe('heading', () => {
  it('names the step, where it is and how far along', () => {
    panel.update(viewOf(8, 3));
    expect(q('.pp-type').textContent).toBe('Connecting');
    expect(q('.pp-where').textContent).toBe('Measures 2-3');
    expect(q('.pp-count').textContent).toBe(`Step 4 of ${generateSteps(8).length}`);
    expect(panel.element.dataset.type).toBe('pair');
  });

  it('has a different drawing for each kind of step', () => {
    const drawings = new Set<string>();
    const steps = generateSteps(8);
    for (const type of ['single', 'pair', 'consolidate'] as const) {
      panel.update({ steps, currentIndex: steps.findIndex((s) => s.type === type), measureCount: 8, attempt: 1 });
      drawings.add(q('.pp-glyph path').getAttribute('d')!);
    }
    expect(drawings.size).toBe(3);
  });

  it('counts attempts only from the second one', () => {
    panel.update(viewOf(8, 0, 1));
    expect(q('.pp-attempt').hasAttribute('hidden')).toBe(true);
    panel.update(viewOf(8, 0, 3));
    expect(q('.pp-attempt').hasAttribute('hidden')).toBe(false);
    expect(q('.pp-attempt').textContent).toBe('Attempt 3');
  });

  it('shows a hint for the kind of step', () => {
    panel.update(viewOf(8, 0));
    expect(q('.pp-status').textContent).toBe('Play this measure on its own, without a mistake.');
    expect(q<HTMLElement>('.pp-status').dataset.tone).toBe('hint');
  });
});

describe('moving between steps', () => {
  it('has previous and next buttons that call the app', () => {
    panel.update(viewOf(8, 5));
    q<HTMLButtonElement>('.pp-prev').click();
    q<HTMLButtonElement>('.pp-next').click();
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('disables previous on the first step and next on the last', () => {
    panel.update(viewOf(8, 0));
    expect(q<HTMLButtonElement>('.pp-prev').disabled).toBe(true);
    expect(q<HTMLButtonElement>('.pp-next').disabled).toBe(false);
    panel.update(viewOf(8, generateSteps(8).length - 1));
    expect(q<HTMLButtonElement>('.pp-prev').disabled).toBe(false);
    expect(q<HTMLButtonElement>('.pp-next').disabled).toBe(true);
  });

  it('names the buttons', () => {
    panel.update(viewOf(8, 2));
    expect(q('.pp-prev').getAttribute('aria-label')).toBe('Previous step');
    expect(q('.pp-next').getAttribute('aria-label')).toBe('Next step');
  });
});

describe('status line', () => {
  it('shows a message with its tone, and announces it', () => {
    panel.update(viewOf(8, 0));
    panel.setStatus('Not yet. Wrong notes: 2. Playing it again.', 'retry');
    expect(q('.pp-status').textContent).toBe('Not yet. Wrong notes: 2. Playing it again.');
    expect(q<HTMLElement>('.pp-status').dataset.tone).toBe('retry');
    expect(q('.pp-status').getAttribute('aria-live')).toBe('polite');
  });

  it('goes back to the hint when the step changes', () => {
    panel.update(viewOf(8, 0));
    panel.setStatus('Clean run.', 'good');
    panel.update(viewOf(8, 1));
    expect(q('.pp-status').textContent).toBe('Now join it to the measure after it.');
    expect(q<HTMLElement>('.pp-status').dataset.tone).toBe('hint');
  });
});

describe('language', () => {
  it('writes everything again in Persian, with Persian digits', () => {
    panel.update(viewOf(8, 3));
    setLocale('fa');
    panel.refresh();
    expect(q('.pp-type').textContent).toBe('اتصال');
    expect(q('.pp-where').textContent).toBe('میزان‌های ۲ تا ۳');
    expect(measure(5).textContent).toBe('۵');
    expect(q('.pp-count').textContent).toContain('۴');
    expect(q('.pp-map').getAttribute('dir')).toBe('ltr');
  });
});

describe('before any step is shown', () => {
  it('is empty and does not break on refresh', () => {
    expect(() => panel.refresh()).not.toThrow();
    expect(qa('.pp-measure')).toHaveLength(0);
  });
});
