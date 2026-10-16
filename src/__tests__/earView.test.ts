import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EarView, type EarVoice } from '../ear/earView';
import { seededRng } from '../ear/questions';
import { NoteInputHub } from '../input/noteInput';
import { NoteStats, RECENT_LIMIT } from '../learn/noteStats';
import { initLocale, setLocale } from '../i18n';

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

function setup(options: { ready?: boolean; unlocked?: number } = {}) {
  const stats = new NoteStats(memoryStorage(), 'earStats.v1');
  for (let stage = 2; stage <= (options.unlocked ?? 1); stage++) stats.unlock(stage);
  const voice: EarVoice = {
    ready: vi.fn(async () => options.ready ?? true),
    play: vi.fn(),
    stopAll: vi.fn(),
  };
  const hub = new NoteInputHub();
  const onAnswer = vi.fn();
  const onBack = vi.fn();
  const view = new EarView({ stats, voice, hub, formatName: (n) => n, onBack, onAnswer, random: seededRng(3) });
  document.body.replaceChildren(view.element);
  view.activate();
  return { view, stats, voice, hub, onAnswer, onBack };
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const all = <T extends HTMLElement>(selector: string) => Array.from(document.querySelectorAll<T>(selector));
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

/** Clicks the button with the right answer (or a wrong one) of the current question. */
function answer(view: EarView, right: boolean) {
  const q = view.currentQuestion()!;
  if (!('answer' in q)) throw new Error('not a choice question');
  const choices = all<HTMLButtonElement>('.ear-choice');
  const pick = choices.find((b) => (b.dataset.choice === q.answer) === right)!;
  pick.click();
}

beforeEach(() => {
  localStorage.clear();
  initLocale();
  setLocale('en');
});

describe('EarView: stages', () => {
  it('opens stage 1, with the later stages locked', () => {
    setup();
    const chips = all<HTMLButtonElement>('.ear-stage');
    expect(chips).toHaveLength(5);
    expect(chips[0].disabled).toBe(false);
    expect(chips[0].getAttribute('aria-pressed')).toBe('true');
    expect(chips.slice(1).every((c) => c.disabled)).toBe(true);
    expect(chips[1].getAttribute('aria-label')).toBe('Stage 2, still locked');
    expect(chips[0].getAttribute('aria-label')).toBe('Stage 1: Higher or lower');
  });

  it('lets an unlocked stage be chosen, and remembers it', () => {
    const { view, stats } = setup({ unlocked: 3 });
    $('[data-stage="3"]').click();
    expect(view.currentQuestion()!.stage).toBe(3);
    expect(all('.ear-stage[aria-pressed="true"]')).toHaveLength(1);
    expect(localStorage.getItem('ear.stage')).toBe('3');
    const again = new EarView({
      stats,
      voice: { ready: async () => true, play: vi.fn(), stopAll: vi.fn() },
      hub: new NoteInputHub(),
      formatName: (n) => n,
      onBack: vi.fn(),
      onAnswer: vi.fn(),
      random: seededRng(1),
    });
    document.body.replaceChildren(again.element);
    again.activate();
    expect(again.currentQuestion()!.stage).toBe(3);
  });

  it('does not open a stage that is locked, even if it was saved', () => {
    localStorage.setItem('ear.stage', '4');
    const { view } = setup();
    expect(view.currentQuestion()!.stage).toBe(1);
  });
});

describe('EarView: a question with buttons', () => {
  it('asks, with a Hear it button and the answers', () => {
    setup();
    expect($('.ear-prompt').textContent).toBe('Which note is higher?');
    expect($('.ear-hear').textContent).toBe('Hear it');
    expect(all('.ear-choice').map((b) => b.textContent)).toEqual(['The first', 'The second']);
    expect($('.ear-next').hidden).toBe(true);
  });

  it('plays the notes of the question, and then offers to hear them again', async () => {
    const { view, voice } = setup();
    $('.ear-hear').click();
    await flush();
    const q = view.currentQuestion()!;
    const played = vi.mocked(voice.play).mock.calls.map((c) => c[0]);
    expect(played).toEqual(q.notes);
    expect($('.ear-hear').textContent).toBe('Hear it again');
  });

  it('says it cannot play when the piano sounds are not there', async () => {
    const { voice } = setup({ ready: false });
    $('.ear-hear').click();
    await flush();
    expect(voice.play).not.toHaveBeenCalled();
    expect($('.ear-feedback').textContent).toMatch(/could not be loaded/);
  });

  it('counts a right answer, and shows Next', () => {
    const { view, stats, onAnswer } = setup();
    answer(view, true);
    expect($('.ear-feedback').textContent).toBe('Right!');
    expect($('.ear-feedback').dataset.tone).toBe('good');
    expect(onAnswer).toHaveBeenCalledWith(true);
    expect(stats.recent(1)).toEqual({ answered: 1, accuracy: 1 });
    expect($('.ear-next').hidden).toBe(false);
    expect(all<HTMLButtonElement>('.ear-choice').every((b) => b.disabled)).toBe(true);
    expect($('.ear-choice[data-state="right"]')).not.toBeNull();
  });

  it('says what the right answer was after a wrong one', () => {
    const { view, onAnswer, stats } = setup();
    answer(view, false);
    expect($('.ear-feedback').textContent).toMatch(/^Not quite\. It was: (The first|The second)\.$/);
    expect(onAnswer).toHaveBeenCalledWith(false);
    expect(stats.recent(1).accuracy).toBe(0);
    expect($('.ear-choice[data-state="wrong"]')).not.toBeNull();
  });

  it('takes only the first answer of a question', () => {
    const { view, onAnswer } = setup();
    answer(view, true);
    all<HTMLButtonElement>('.ear-choice')[0].click();
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('goes on to a new question, and plays it, when Next is pressed', async () => {
    const { view, voice } = setup();
    const first = view.currentQuestion();
    answer(view, true);
    $('.ear-next').click();
    await flush();
    expect(view.currentQuestion()).not.toBe(first);
    expect(vi.mocked(voice.play).mock.calls.length).toBeGreaterThan(0);
    expect($('.ear-next').hidden).toBe(true);
    expect($('.ear-feedback').textContent).toBe('');
  });

  it('tells the end-to-end tests what is asked', () => {
    const seen: Array<{ stage: number; answer: string | null }> = [];
    document.addEventListener('trainer:ear', (e) => seen.push((e as CustomEvent).detail));
    const { view } = setup();
    const q = view.currentQuestion()!;
    expect(seen.at(-1)).toMatchObject({ stage: 1, answer: 'answer' in q ? q.answer : null });
  });
});

describe('EarView: opening the next stage', () => {
  it('opens stage 2 when 90 percent of the last 20 answers are right', () => {
    const { view, stats } = setup();
    for (let i = 0; i < RECENT_LIMIT - 1; i++) stats.record('higher', 1, true);
    expect($<HTMLButtonElement>('[data-stage="2"]').disabled).toBe(true);
    answer(view, true);
    expect($<HTMLButtonElement>('[data-stage="2"]').disabled).toBe(false);
    expect($('.ear-progress').textContent).toContain('Stage 2 is open!');
  });

  it('keeps the next stage locked when too many were wrong', () => {
    const { view, stats } = setup();
    for (let i = 0; i < RECENT_LIMIT - 1; i++) stats.record('higher', 1, i % 4 !== 0);
    answer(view, true);
    expect($<HTMLButtonElement>('[data-stage="2"]').disabled).toBe(true);
  });

  it('shows how the last answers went', () => {
    const { view } = setup();
    expect($('.ear-progress').textContent).toBe('Your last answers: 0 of 20, 0% right.');
    answer(view, true);
    expect($('.ear-progress').textContent).toBe('Your last answers: 1 of 20, 100% right.');
  });
});

describe('EarView: play it back (stage 5)', () => {
  function stage5() {
    const ctx = setup({ unlocked: 5 });
    $('[data-stage="5"]').click();
    return ctx;
  }
  const askUntil = (view: EarView, kind: string) => {
    for (let i = 0; i < 40 && view.currentQuestion()!.kind !== kind; i++) {
      // answer it right, then go on
      const q = view.currentQuestion()!;
      for (const note of q.notes) $(`.lk-key[data-note="${note}"]`).dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
      $('.ear-next').click();
    }
    expect(view.currentQuestion()!.kind).toBe(kind);
  };

  it('shows a keyboard to answer with, instead of buttons', () => {
    stage5();
    expect($('.ear-keyboard .lk')).not.toBeNull();
    expect(all('.ear-choice')).toHaveLength(0);
  });

  it('counts a note played back right as a right answer', async () => {
    const { view, stats, onAnswer } = stage5();
    askUntil(view, 'playNote');
    const note = view.currentQuestion()!.notes[0];
    $(`.lk-key[data-note="${note}"]`).dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    await flush();
    expect($('.ear-feedback').textContent).toBe('Right!');
    expect(onAnswer).toHaveBeenLastCalledWith(true);
    expect(stats.recent(5).accuracy).toBeGreaterThan(0);
  });

  it('says which note was played when it was wrong, lets the student try again, and counts the question as missed', async () => {
    const { view, onAnswer } = stage5();
    askUntil(view, 'playNote');
    const q = view.currentQuestion()!;
    const wrong = ['C4', 'D4', 'E4'].find((n) => n !== q.notes[0])!;
    const calls = onAnswer.mock.calls.length;
    $(`.lk-key[data-note="${wrong}"]`).dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    await flush();
    expect($('.ear-feedback').textContent).toBe(`That was ${wrong}. Listen again and try once more.`);
    expect(onAnswer.mock.calls.length).toBe(calls); // not over yet
    $(`.lk-key[data-note="${q.notes[0]}"]`).dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    await flush();
    expect(onAnswer).toHaveBeenLastCalledWith(false);
  });

  it('follows a melody note by note', async () => {
    const { view, onAnswer } = stage5();
    askUntil(view, 'playMelody');
    const q = view.currentQuestion()!;
    expect($('.ear-melody').textContent).toBe('Note 1 of 3');
    $(`.lk-key[data-note="${q.notes[0]}"]`).dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    expect($('.ear-melody').textContent).toBe('Note 2 of 3');
    for (const note of q.notes.slice(1)) $(`.lk-key[data-note="${note}"]`).dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    expect(onAnswer).toHaveBeenLastCalledWith(true);
    expect($('.ear-next').hidden).toBe(false);
  });

  it('takes notes from a MIDI keyboard too, but only while the screen is open', async () => {
    const { view, hub, onAnswer } = stage5();
    const q = view.currentQuestion()!;
    view.deactivate();
    hub.noteOn(q.notes[0], 'midi');
    expect(onAnswer).not.toHaveBeenCalled();
    view.activate();
    for (const note of q.notes) hub.noteOn(note, 'midi');
    expect(onAnswer).toHaveBeenCalledWith(true);
  });
});

describe('EarView: other things', () => {
  it('stops the sound when the screen is left', () => {
    const { view, voice } = setup();
    view.deactivate();
    expect(voice.stopAll).toHaveBeenCalled();
  });

  it('goes back', () => {
    const { onBack } = setup();
    $('.back-btn').click();
    expect(onBack).toHaveBeenCalled();
  });

  it('speaks Persian, with Persian digits', () => {
    setLocale('fa');
    setup();
    expect($('.ear-prompt').textContent).toBe('کدام نت بالاتر است؟');
    expect($('.ear-hear').textContent).toBe('بشنوید');
    expect($('.ear-progress').textContent).toContain('۲۰');
    expect($('[data-stage="1"] .ear-stage-n').textContent).toBe('۱');
  });
});
