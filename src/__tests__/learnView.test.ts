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

  it('reports every answer, so the app can reward it', () => {
    const answers: boolean[] = [];
    const other = new LearnView({
      quiz: new NameTheNoteQuiz(stats, seeded(5)),
      hub,
      renderNote,
      formatLetter: (letter) => letter,
      onAnswer: (result) => answers.push(result.correct),
    });
    document.body.appendChild(other.element);
    other.open();
    const asked = other.element.dataset.pitch!;
    hub.noteOn(asked, 'screen');
    expect(answers).toEqual([true]);
    other.dispose();
  });

  it('shows the number of right answers in a row from two up', () => {
    view.open();
    const combo = q<HTMLElement>('.learn-combo');
    expect(combo.hidden).toBe(true);
    view.setCombo(1);
    expect(combo.hidden).toBe(true);
    view.setCombo(5);
    expect(combo.hidden).toBe(false);
    expect(combo.textContent).toBe('In a row: 5');
    view.setCombo(0);
    expect(combo.hidden).toBe(true);
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

describe('the quiz without lessons', () => {
  it('opens straight on the quiz, whatever was read before', () => {
    view.open();
    expect(view.element.dataset.panel).toBe('quiz');
    expect(q('.learn-card')).not.toBeNull();
    expect(view.element.querySelector('.learn-lessons')).toBeNull();
    expect(view.element.querySelector('.learn-lesson-next')).toBeNull();
  });

  it('has a Lessons button only when the app can open the lessons', () => {
    expect(view.element.querySelector('.learn-open-lessons')).toBeNull();
    const onOpenLessons = vi.fn();
    const other = new LearnView({
      quiz: new NameTheNoteQuiz(stats, seeded(5)),
      hub,
      renderNote,
      formatLetter: (letter) => letter,
      onOpenLessons,
    });
    document.body.appendChild(other.element);
    other.open();
    const button = other.element.querySelector<HTMLButtonElement>('.learn-open-lessons')!;
    expect(button.textContent).toBe('Lessons');
    button.click();
    expect(onOpenLessons).toHaveBeenCalledOnce();
    other.dispose();
  });
});
