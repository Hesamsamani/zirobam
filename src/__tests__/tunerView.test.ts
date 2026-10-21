import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MicFrame, MicState } from '../audio/micInput';
import { EventEmitter } from '../core/events';
import { initLocale, setLocale, setPersianDigits } from '../i18n';
import { NoteInputHub } from '../input/noteInput';
import { TunerView, type MicSource, type TunerViewDeps } from '../tuner/tunerView';

function fakeMic(result: MicState = 'on') {
  const onFrame = new EventEmitter<MicFrame>();
  const onState = new EventEmitter<MicState>();
  const mic = {
    state: 'off' as MicState,
    start: vi.fn(async () => {
      mic.state = result === 'on' ? 'on' : result;
      onState.emit(mic.state);
      return mic.state;
    }),
    stop: vi.fn(() => {
      mic.state = 'off';
      onState.emit('off');
    }),
    onFrame,
    onState,
  };
  return { mic: mic as unknown as MicSource & { state: MicState; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }, frame: (f: Partial<MicFrame> & { frequency: number | null }) => onFrame.emit({ clarity: 0.95, level: 0.2, ...f }) };
}

function setup(result: MicState = 'on', overrides: Partial<TunerViewDeps> = {}) {
  const { mic, frame } = fakeMic(result);
  const hub = new NoteInputHub();
  const on: string[] = [];
  const off: string[] = [];
  hub.onNoteOn.on((e) => on.push(`${e.noteName}:${e.source}`));
  hub.onNoteOff.on((e) => off.push(e.noteName));
  const data = new Map<string, string>();
  const view = new TunerView({
    mic,
    hub,
    formatName: (note) => note.replace('#', '♯'),
    onBack: vi.fn(),
    storage: { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) },
    ...overrides,
  });
  document.body.replaceChildren(view.element);
  view.activate();
  return { view, mic, frame, hub, on, off, data };
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const hz = (cents: number, base = 440) => base * 2 ** (cents / 1200);

beforeEach(() => {
  initLocale();
  setLocale('en');
  setPersianDigits(false);
  document.body.replaceChildren();
});

describe('the tuner', () => {
  it('has a start button, a dash for the note and the settings', () => {
    setup();
    expect($('.view-title').textContent).toBe('Tuner');
    expect($('.tn-toggle').textContent).toBe('Start listening');
    expect($('.tn-note').textContent).toBe('–');
    expect($<HTMLInputElement>('.tn-a4').value).toBe('440');
    expect($('.tn-mode[data-mode="et"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('starts the microphone and says it listens', async () => {
    const { mic } = setup();
    $('.tn-toggle').click();
    await Promise.resolve();
    expect(mic.start).toHaveBeenCalled();
    expect($('.tn-toggle').textContent).toBe('Stop');
    expect($('.tn-status').textContent).toBe('Play or sing a note.');
  });

  it('says so when the microphone is blocked, and when there is none', async () => {
    const denied = setup('denied');
    $('.tn-toggle').click();
    await Promise.resolve();
    await Promise.resolve();
    expect($('.tn-status').textContent).toMatch(/blocked/);
    document.body.replaceChildren();
    setup('unavailable');
    $('.tn-toggle').click();
    await Promise.resolve();
    await Promise.resolve();
    expect($('.tn-status').textContent).toBe('A microphone cannot be used here.');
    expect(denied.mic.start).toHaveBeenCalled();
  });

  it('shows the note, the cents and the frequency of what it hears, with the needle in the middle when in tune', async () => {
    const { frame } = setup();
    for (let i = 0; i < 5; i++) frame({ frequency: 440 });
    expect($('.tn-note').textContent).toBe('A4');
    expect($('.tn-cents').textContent).toBe('In tune');
    expect($('.tn-hz').textContent).toBe('440 Hz');
    expect($('.tn-needle').style.insetInlineStart).toBe('50%');
    expect($('.tn-meter').dataset.tune).toBe('in');
    expect(document.querySelector('.tuner-view')!.getAttribute('data-live')).toBe('true');
  });

  it('puts the needle to the right and says sharp when the note is sharp, left and flat when flat', () => {
    const { frame } = setup();
    for (let i = 0; i < 5; i++) frame({ frequency: hz(25) });
    expect($('.tn-cents').textContent).toBe('+25 cents sharp');
    expect(parseFloat($('.tn-needle').style.insetInlineStart)).toBeCloseTo(75, 0);
    expect($('.tn-meter').dataset.tune).toBe('sharp');
    for (let i = 0; i < 5; i++) frame({ frequency: hz(-40) });
    expect($('.tn-cents').textContent).toBe('-40 cents flat');
    expect(parseFloat($('.tn-needle').style.insetInlineStart)).toBeCloseTo(10, 0);
    expect($('.tn-meter').dataset.tune).toBe('flat');
  });

  it('does not tremble: a stray reading is ignored by the median of the last few', () => {
    const { frame } = setup();
    for (let i = 0; i < 4; i++) frame({ frequency: 440 });
    frame({ frequency: 466 });
    expect($('.tn-note').textContent).toBe('A4');
  });

  it('dims the note when nothing has been heard for a while, and keeps it on the screen', () => {
    const { frame } = setup();
    for (let i = 0; i < 3; i++) frame({ frequency: 440 });
    for (let i = 0; i < 12; i++) frame({ frequency: null });
    expect(document.querySelector('.tuner-view')!.getAttribute('data-live')).toBe('false');
    expect($('.tn-note').textContent).toBe('A4');
  });

  it('follows the reference pitch: at 432 Hz the A of 432 is in tune', () => {
    const { frame, data } = setup();
    const a4 = $<HTMLInputElement>('.tn-a4');
    a4.value = '432';
    a4.dispatchEvent(new Event('change'));
    for (let i = 0; i < 5; i++) frame({ frequency: 432 });
    expect($('.tn-cents').textContent).toBe('In tune');
    expect(JSON.parse(data.get('mic.v1')!).a4).toBe(432);
    // out of range is brought back into it
    a4.value = '900';
    a4.dispatchEvent(new Event('change'));
    expect($<HTMLInputElement>('.tn-a4').value).toBe('466');
  });

  it('writes a quarter tone with its koron or sori in the mode with quarter tones', () => {
    const { frame } = setup();
    $('.tn-mode[data-mode="quarter"]').click();
    const quarter = 440 * 2 ** ((63.5 - 69) / 12);
    for (let i = 0; i < 5; i++) frame({ frequency: quarter });
    expect($('.tn-note').textContent).toBe('Ek4');
    expect($('.tn-cents').textContent).toBe('In tune');
  });

  it('keeps the settings between visits', () => {
    const first = setup();
    $('.tn-mode[data-mode="quarter"]').click();
    $('.tn-send').click();
    const kept = first.data;
    document.body.replaceChildren();
    const second = setup('on', { storage: { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => void kept.set(k, v) } });
    expect(second.view.current().settings).toMatchObject({ mode: 'quarter', send: true, a4: 440 });
  });

  it('sends the notes it hears into the app as the microphone, when asked', () => {
    const { frame, on, off } = setup();
    $('.tn-send').click();
    for (let i = 0; i < 6; i++) frame({ frequency: 440 });
    expect(on).toEqual(['A4:microphone']);
    for (let i = 0; i < 5; i++) frame({ frequency: null });
    expect(off).toEqual(['A4']);
  });

  it('sends nothing when it is not asked to', () => {
    const { frame, on } = setup();
    for (let i = 0; i < 6; i++) frame({ frequency: 440 });
    expect(on).toEqual([]);
  });

  it('lets the microphone go when the screen is left, and lets go of the note', () => {
    const { view, mic, frame, off } = setup();
    $('.tn-send').click();
    for (let i = 0; i < 6; i++) frame({ frequency: 440 });
    view.deactivate();
    expect(mic.stop).toHaveBeenCalled();
    expect(off).toContain('A4');
    expect($('.tn-note').textContent).toBe('A4');
  });

  it('is in Persian, with the meter left to right', () => {
    setLocale('fa');
    setPersianDigits(true);
    const { view, frame } = setup();
    view.refresh();
    expect($('.view-title').textContent).toBe('کوک‌سنج');
    for (let i = 0; i < 5; i++) frame({ frequency: hz(20) });
    expect($('.tn-cents').textContent).toBe('+۲۰ سنت بالا');
    expect($('.tn-meter').getAttribute('dir')).toBe('ltr');
  });
});
