import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NoteInputHub } from '../input/noteInput';
import {
  ComputerKeyboard, codeToNoteName, keyHints, DEFAULT_OCTAVE, MAX_OCTAVE, MIN_OCTAVE,
} from '../input/computerKeyboard';

function press(type: 'keydown' | 'keyup', code: string, init: KeyboardEventInit = {}, target: EventTarget = document) {
  target.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...init }));
}

describe('codeToNoteName', () => {
  it('maps the home row to white keys and the row above to black keys', () => {
    expect(codeToNoteName('KeyA', 4)).toBe('C4');
    expect(codeToNoteName('KeyW', 4)).toBe('C#4');
    expect(codeToNoteName('KeyS', 4)).toBe('D4');
    expect(codeToNoteName('KeyJ', 4)).toBe('B4');
    expect(codeToNoteName('KeyK', 4)).toBe('C5');
    expect(codeToNoteName('Quote', 4)).toBe('F5');
  });

  it('follows the base octave and ignores other keys', () => {
    expect(codeToNoteName('KeyA', 3)).toBe('C3');
    expect(codeToNoteName('KeyQ', 4)).toBeNull();
    expect(codeToNoteName('Space', 4)).toBeNull();
  });
});

describe('keyHints', () => {
  it('labels each note with the key that plays it', () => {
    const hints = keyHints(4);
    expect(hints['C4']).toBe('A');
    expect(hints['C#4']).toBe('W');
    expect(hints['E5']).toBe(';');
    expect(hints['F5']).toBe("'");
    expect(keyHints(5)['C5']).toBe('A');
  });
});

describe('ComputerKeyboard', () => {
  let hub: NoteInputHub;
  let keyboard: ComputerKeyboard;
  let octaves: number[];
  let events: string[];

  beforeEach(() => {
    hub = new NoteInputHub();
    events = [];
    octaves = [];
    hub.onNoteOn.on((e) => events.push(`on ${e.noteName} ${e.source}`));
    hub.onNoteOff.on((e) => events.push(`off ${e.noteName} ${e.source}`));
    keyboard = new ComputerKeyboard(hub, document, (o) => octaves.push(o));
    keyboard.attach();
  });

  afterEach(() => {
    keyboard.detach();
    document.body.replaceChildren();
  });

  it('plays and releases a note', () => {
    press('keydown', 'KeyA');
    press('keyup', 'KeyA');
    expect(events).toEqual(['on C4 computer', 'off C4 computer']);
  });

  it('ignores key repeat', () => {
    press('keydown', 'KeyA');
    press('keydown', 'KeyA', { repeat: true });
    expect(events).toEqual(['on C4 computer']);
  });

  it('ignores shortcuts with Ctrl, Alt or Meta', () => {
    press('keydown', 'KeyA', { ctrlKey: true });
    press('keydown', 'KeyA', { metaKey: true });
    expect(events).toEqual([]);
  });

  it('ignores typing in form fields', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    press('keydown', 'KeyA', {}, input);
    expect(events).toEqual([]);
  });

  it('shifts the octave with Z and X and reports it', () => {
    press('keydown', 'KeyX');
    press('keydown', 'KeyA');
    expect(octaves).toEqual([DEFAULT_OCTAVE + 1]);
    expect(events).toEqual(['on C5 computer']);
    press('keydown', 'KeyZ');
    press('keydown', 'KeyZ');
    expect(keyboard.getOctave()).toBe(DEFAULT_OCTAVE - 1);
  });

  it('releases the note that was started even after an octave shift', () => {
    press('keydown', 'KeyA');
    press('keydown', 'KeyX');
    press('keyup', 'KeyA');
    expect(events).toEqual(['on C4 computer', 'off C4 computer']);
  });

  it('clamps the octave', () => {
    for (let i = 0; i < 10; i++) press('keydown', 'KeyX');
    expect(keyboard.getOctave()).toBe(MAX_OCTAVE);
    for (let i = 0; i < 10; i++) press('keydown', 'KeyZ');
    expect(keyboard.getOctave()).toBe(MIN_OCTAVE);
  });

  it('releases every held note when the window loses focus', () => {
    press('keydown', 'KeyA');
    press('keydown', 'KeyD');
    window.dispatchEvent(new Event('blur'));
    expect(events).toContain('off C4 computer');
    expect(events).toContain('off E4 computer');
  });

  it('stops listening after detach', () => {
    keyboard.detach();
    press('keydown', 'KeyA');
    expect(events).toEqual([]);
  });
});
