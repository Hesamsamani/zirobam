import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LessonsView, type LessonsViewDeps } from '../lessons/lessonsView';
import { LessonProgress } from '../lessons/lessonProgress';
import { ALL_LESSONS, UNITS } from '../lessons/curriculum';
import { setLocale } from '../i18n';

function setup(overrides: Partial<LessonsViewDeps> = {}) {
  const progress = new LessonProgress(ALL_LESSONS.map((l) => l.id));
  const deps: LessonsViewDeps = {
    toolkit: null,
    progress,
    onBack: vi.fn(),
    open: vi.fn(),
    onAction: vi.fn(),
    onRead: vi.fn(),
    ...overrides,
  };
  const view = new LessonsView(deps);
  document.body.appendChild(view.element);
  return { view, deps, progress };
}

const cards = (view: LessonsView) => Array.from(view.element.querySelectorAll<HTMLElement>('.lesson-card'));

describe('LessonsView: the lesson list', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
    setLocale('en');
  });

  it('belongs to the lessons screen and has a title', () => {
    const { view } = setup();
    expect(view.element.dataset.views).toBe('lessons');
    view.show(null);
    expect(view.element.querySelector('h2')!.textContent).toBe('Lessons');
  });

  it('lists every lesson under its unit', () => {
    const { view } = setup();
    view.show(null);
    expect(cards(view)).toHaveLength(ALL_LESSONS.length);
    expect(view.element.querySelectorAll('.course-unit')).toHaveLength(UNITS.length);
    expect(cards(view)[0].dataset.lesson).toBe(ALL_LESSONS[0].id);
    expect(cards(view)[0].textContent).toContain('The staff');
  });

  it('opens a lesson when its card is pressed', () => {
    const { view, deps } = setup();
    view.show(null);
    cards(view)[2].click();
    expect(deps.open).toHaveBeenCalledWith(ALL_LESSONS[2].id);
  });

  it('goes back to the menu', () => {
    const { view, deps } = setup();
    view.show(null);
    view.element.querySelector<HTMLButtonElement>('.back-btn')!.click();
    expect(deps.onBack).toHaveBeenCalledOnce();
  });

  it('offers to start the first lesson, then to continue where the student stopped', () => {
    const { view, deps, progress } = setup();
    view.show(null);
    const go = () => view.element.querySelector<HTMLButtonElement>('.course-continue')!;
    expect(go().textContent).toBe('Start the first lesson');
    go().click();
    expect(deps.open).toHaveBeenLastCalledWith(ALL_LESSONS[0].id);

    progress.markRead(ALL_LESSONS[0].id);
    progress.markRead(ALL_LESSONS[1].id);
    view.show(null);
    expect(go().textContent).toContain('Continue');
    expect(go().textContent).toContain(ALL_LESSONS[2].title.en);
    go().click();
    expect(deps.open).toHaveBeenLastCalledWith(ALL_LESSONS[2].id);
  });

  it('shows how many lessons were read, and marks them in the list', () => {
    const { view, progress } = setup();
    progress.markRead(ALL_LESSONS[0].id);
    view.show(null);
    expect(view.element.querySelector('.course-progress-text')!.textContent).toBe(`1 of ${ALL_LESSONS.length} lessons read`);
    const bar = view.element.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('1');
    expect(bar.getAttribute('aria-valuemax')).toBe(String(ALL_LESSONS.length));
    expect(cards(view)[0].dataset.read).toBe('true');
    expect(cards(view)[1].dataset.read).toBeUndefined();
  });

  it('says so when the whole course was read', () => {
    const { view, progress } = setup();
    for (const lesson of ALL_LESSONS) progress.markRead(lesson.id);
    view.show(null);
    expect(view.element.querySelector('.course-continue')).toBeNull();
    expect(view.element.querySelector('.course-done')!.textContent).toContain('whole course');
  });

  it('shows the list in Persian, with Persian digits', () => {
    setLocale('fa');
    const { view, progress } = setup();
    progress.markRead(ALL_LESSONS[0].id);
    view.show(null);
    expect(view.element.querySelector('h2')!.textContent).toBe('درس‌ها');
    expect(view.element.querySelector('.course-progress-text')!.textContent).toBe(`۱ درس از ${ALL_LESSONS.length.toString().replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])} درس خوانده شده است`);
    expect(cards(view)[0].textContent).toContain('حامل');
  });
});

describe('LessonsView: a lesson', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
    setLocale('en');
  });

  const first = ALL_LESSONS[0];
  const last = ALL_LESSONS[ALL_LESSONS.length - 1];

  it('shows the title, where it is in the course, and its text', () => {
    const { view } = setup();
    view.show(first.id);
    expect(view.element.querySelector('.lesson-title')!.textContent).toBe(first.title.en);
    expect(view.element.querySelector('.lesson-where')!.textContent).toContain('Reading notes');
    expect(view.element.querySelector('.lesson-where')!.textContent).toContain(`Lesson 1 of ${UNITS[0].lessons.length}`);
    expect(view.element.querySelectorAll('.lesson-p').length).toBeGreaterThan(0);
    expect(view.element.querySelector('.course-list')).toBeNull();
  });

  it('moves the focus to the title so a screen reader starts reading there', () => {
    const { view } = setup();
    view.show(first.id);
    expect(document.activeElement).toBe(view.element.querySelector('.lesson-title'));
  });

  it('goes back to the list', () => {
    const { view, deps } = setup();
    view.show(first.id);
    view.element.querySelector<HTMLButtonElement>('.lesson-all')!.click();
    expect(deps.open).toHaveBeenCalledWith(null);
  });

  it('has no previous lesson at the start', () => {
    const { view } = setup();
    view.show(first.id);
    expect(view.element.querySelector<HTMLButtonElement>('.lesson-prev')!.disabled).toBe(true);
    view.show(ALL_LESSONS[1].id);
    const prev = view.element.querySelector<HTMLButtonElement>('.lesson-prev')!;
    expect(prev.disabled).toBe(false);
    prev.click();
    // the address changes; the screen follows through show()
  });

  it('marks the lesson read and opens the next one', () => {
    const { view, deps, progress } = setup();
    view.show(first.id);
    view.element.querySelector<HTMLButtonElement>('.lesson-next')!.click();
    expect(progress.isRead(first.id)).toBe(true);
    expect(deps.onRead).toHaveBeenCalledWith(first.id, true);
    expect(deps.open).toHaveBeenCalledWith(ALL_LESSONS[1].id);
  });

  it('does not reward a lesson twice', () => {
    const { view, deps } = setup();
    view.show(first.id);
    view.element.querySelector<HTMLButtonElement>('.lesson-next')!.click();
    view.show(first.id);
    view.element.querySelector<HTMLButtonElement>('.lesson-next')!.click();
    expect(deps.onRead).toHaveBeenNthCalledWith(1, first.id, true);
    expect(deps.onRead).toHaveBeenNthCalledWith(2, first.id, false);
  });

  it('finishes the course on the last lesson', () => {
    const { view, deps, progress } = setup();
    view.show(last.id);
    const next = view.element.querySelector<HTMLButtonElement>('.lesson-next')!;
    expect(next.textContent).toBe('Finish the course');
    next.click();
    expect(progress.isRead(last.id)).toBe(true);
    expect(deps.open).toHaveBeenCalledWith(null);
  });

  it('shows that a lesson was already read', () => {
    const { view, progress } = setup();
    progress.markRead(first.id);
    view.show(first.id);
    expect(view.element.querySelector('.lesson-read-mark')).not.toBeNull();
    view.show(ALL_LESSONS[1].id);
    expect(view.element.querySelector('.lesson-read-mark')).toBeNull();
  });

  it('sends the student to try what they learned', () => {
    const { view, deps } = setup();
    view.show(first.id);
    const buttons = Array.from(view.element.querySelectorAll<HTMLButtonElement>('.lesson-try-btn'));
    expect(buttons.map((b) => b.dataset.action)).toEqual(first.actions);
    buttons[0].click();
    expect(deps.onAction).toHaveBeenCalledWith('quiz');
  });

  it('has no try-it section when a lesson sends nowhere', () => {
    const { view } = setup();
    const quiet = ALL_LESSONS.find((l) => !l.actions || l.actions.length === 0)!;
    view.show(quiet.id);
    expect(view.element.querySelector('.lesson-try')).toBeNull();
  });

  it('falls back to the list, with a message, for a lesson that does not exist', () => {
    const { view } = setup();
    view.show('no-such-lesson');
    expect(view.element.querySelector('.course-notice')!.textContent).toContain('does not exist');
    expect(cards(view)).toHaveLength(ALL_LESSONS.length);
  });

  it('writes the lesson again in the new language', () => {
    const { view } = setup();
    view.show(first.id);
    setLocale('fa');
    view.refresh();
    expect(view.element.querySelector('.lesson-title')!.textContent).toBe(first.title.fa);
  });

  it('stops a playing example when the lesson changes', () => {
    const stop = vi.fn();
    const playExample = vi.fn(() => stop);
    const { view } = setup({ playExample, toolkit: { setOptions: vi.fn(), loadData: vi.fn(), renderToSVG: () => '<svg xmlns="http://www.w3.org/2000/svg"/>' } });
    view.show(first.id);
    view.element.querySelector<HTMLButtonElement>('.lesson-play')!.click();
    expect(playExample).toHaveBeenCalledOnce();
    view.show(ALL_LESSONS[1].id);
    expect(stop).toHaveBeenCalledOnce();
  });

  it('plays only one example at a time', () => {
    const stops: Array<ReturnType<typeof vi.fn>> = [];
    const playExample = vi.fn(() => {
      const stop = vi.fn();
      stops.push(stop);
      return stop;
    });
    const { view } = setup({ playExample, toolkit: { setOptions: vi.fn(), loadData: vi.fn(), renderToSVG: () => '<svg xmlns="http://www.w3.org/2000/svg"/>' } });
    view.show('steps-skips');
    const buttons = view.element.querySelectorAll<HTMLButtonElement>('.lesson-play');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    buttons[0].click();
    buttons[1].click();
    expect(stops[0]).toHaveBeenCalledOnce();
    expect(stops[1]).not.toHaveBeenCalled();
  });

  it('can be told to stop, for when the screen is left', () => {
    const stop = vi.fn();
    const { view } = setup({
      playExample: vi.fn(() => stop),
      toolkit: { setOptions: vi.fn(), loadData: vi.fn(), renderToSVG: () => '<svg xmlns="http://www.w3.org/2000/svg"/>' },
    });
    view.show(first.id);
    view.element.querySelector<HTMLButtonElement>('.lesson-play')!.click();
    view.stop();
    expect(stop).toHaveBeenCalledOnce();
  });
});
