import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { initLocale } from '../i18n';
import { NoteInputHub } from '../input/noteInput';
import { NoteStats } from '../learn/noteStats';
import { NameTheNoteQuiz, type Clef } from '../learn/nameTheNote';
import { LearnView } from '../learn/learnView';

function fakeStorage() {
  const data: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

let hub: NoteInputHub;
let stats: NoteStats;
let view: LearnView;
type RenderNote = (pitch: string, clef: Clef, into: HTMLElement) => void;
let renderNote: Mock<RenderNote>;
let closed: number;

const q = <T extends Element>(sel: string) => view.element.querySelector(sel) as T;
const pitch = () => view.element.dataset.pitch!;
const answerButton = (letter: string) => q<HTMLButtonElement>(`.learn-answer[data-letter="${letter}"]`);
const wrongLetter = () => (pitch()[0] === 'C' ? 'D' : 'C');

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  initLocale();
  localStorage.setItem('learn.seenLessons', '1');
  hub = new NoteInputHub();
  stats = new NoteStats(fakeStorage());
  renderNote = vi.fn<RenderNote>();
  closed = 0;
  view = new LearnView({
    quiz: new NameTheNoteQuiz(stats, seeded(5)),
    hub,
    renderNote,
    formatLetter: (letter) => letter,
    autoAdvanceMs: 500,
    onClose: () => closed++,
  });
  document.body.appendChild(view.element);
});

afterEach(() => {
  view.dispose();
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('quiz panel', () => {
  it('is hidden until opened, then asks a question and draws the note', () => {
    expect(view.element.hidden).toBe(true);
    view.open();
    expect(view.element.hidden).toBe(false);
    expect(view.element.dataset.panel).toBe('quiz');
    expect(pitch()).toMatch(/^[A-G]\d$/);
    expect(renderNote).toHaveBeenCalledWith(pitch(), expect.stringMatching(/treble|bass/), expect.any(HTMLElement));
    expect(view.element.querySelectorAll('.learn-answer')).toHaveLength(7);
  });

  it('a correct answer shows feedback, locks the buttons and moves on by itself', () => {
    view.open();
    const first = pitch();
    answerButton(first[0]).click();
    expect(view.element.dataset.result).toBe('correct');
    expect(answerButton('C').disabled).toBe(true);
    expect(q('.learn-feedback').textContent).toBe('Correct!');
    vi.advanceTimersByTime(500);
    expect(view.element.dataset.result).toBeUndefined();
    expect(renderNote).toHaveBeenCalledTimes(2);
    expect(pitch()).not.toBe(first);
  });

  it('a wrong answer names the right note and waits for Next', () => {
    view.open();
    const expected = pitch()[0];
    answerButton(wrongLetter()).click();
    expect(view.element.dataset.result).toBe('wrong');
    expect(q('.learn-feedback').textContent).toContain(expected);
    expect(q<HTMLButtonElement>('.learn-next').hidden).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(renderNote).toHaveBeenCalledTimes(1);
    q<HTMLButtonElement>('.learn-next').click();
    expect(renderNote).toHaveBeenCalledTimes(2);
    expect(view.element.dataset.result).toBeUndefined();
  });

  it('accepts the note played on any input source', () => {
    view.open();
    hub.noteOn(pitch(), 'screen');
    expect(view.element.dataset.result).toBe('correct');
  });

  it('ignores played notes while closed', () => {
    view.open();
    const p = pitch();
    view.close();
    hub.noteOn(p, 'midi');
    expect(stats.get(p)).toBeUndefined();
    expect(closed).toBe(1);
  });

  it('has a Close button that closes the view itself when the app gave no way to leave', () => {
    view.open();
    q<HTMLButtonElement>('.learn-header .learn-text-btn:last-child').click();
    expect(view.isOpen()).toBe(false);
    expect(closed).toBe(1);
  });

  it('asks the app to leave, instead of closing itself, when an exit is given', () => {
    const onExit = vi.fn();
    const other = new LearnView({
      quiz: new NameTheNoteQuiz(stats, seeded(5)),
      hub,
      renderNote,
      formatLetter: (letter) => letter,
      onClose: () => closed++,
      onExit,
    });
    document.body.appendChild(other.element);
    other.open();
    other.element.querySelector<HTMLButtonElement>('.learn-header .learn-text-btn:last-child')!.click();
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(other.isOpen()).toBe(true);
    other.dispose();
  });

  it('keeps later stages locked until 20 answers at 90%, then unlocks stage 2', () => {
    view.open();
    const stageOption = (n: number) => q<HTMLSelectElement>('.learn-stage-select').options[n - 1];
    expect(stageOption(2).disabled).toBe(true);
    for (let i = 0; i < 20; i++) {
      answerButton(pitch()[0]).click();
      if (i < 19) vi.advanceTimersByTime(500);
    }
    expect(stageOption(2).disabled).toBe(false);
    expect(q('.learn-feedback').textContent).toContain('Stage 2 unlocked!');
  });
});

describe('lessons panel', () => {
  it('opens on the lessons the first time and starts the quiz at the end', () => {
    localStorage.removeItem('learn.seenLessons');
    view.open();
    expect(view.element.dataset.panel).toBe('lessons');
    expect(q('.learn-lesson-count').textContent).toBe('Lesson 1 of 5');
    for (let i = 0; i < 4; i++) q<HTMLButtonElement>('.learn-lesson-next').click();
    expect(q('.learn-lesson-count').textContent).toBe('Lesson 5 of 5');
    q<HTMLButtonElement>('.learn-lesson-start').click();
    expect(view.element.dataset.panel).toBe('quiz');
    expect(localStorage.getItem('learn.seenLessons')).toBe('1');
  });

  it('draws each lesson example', () => {
    localStorage.removeItem('learn.seenLessons');
    view.open();
    expect(renderNote).toHaveBeenCalledWith('E4', 'treble', expect.any(HTMLElement));
  });
});
