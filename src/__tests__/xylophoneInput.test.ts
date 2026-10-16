import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NoteInputHub } from '../input/noteInput';
import { XylophoneInput } from '../xylophone/xylophoneInput';
import { barsForRow } from '../xylophone/keyRows';

function press(type: 'keydown' | 'keyup', code: string, init: KeyboardEventInit = {}, target: EventTarget = document) {
  const event = new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('XylophoneInput', () => {
  let hub: NoteInputHub;
  let input: XylophoneInput;
  let events: string[];

  beforeEach(() => {
    hub = new NoteInputHub();
    events = [];
    hub.onNoteOn.on((e) => events.push(`on ${e.noteName} ${e.source}`));
    hub.onNoteOff.on((e) => events.push(`off ${e.noteName} ${e.source}`));
    input = new XylophoneInput(hub, barsForRow('home', 4));
    input.attach();
  });

  afterEach(() => {
    input.detach();
    document.body.replaceChildren();
  });

  it('plays the bars of the row from left to right', () => {
    for (const code of ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG']) press('keydown', code);
    expect(events).toEqual(['on C4 xylophone', 'on D4 xylophone', 'on E4 xylophone', 'on F4 xylophone', 'on G4 xylophone']);
  });

  it('reaches the last bars with the keys at the right end of the row', () => {
    press('keydown', 'Semicolon');
    press('keydown', 'Quote');
    expect(events).toEqual(['on E5 xylophone', 'on F5 xylophone']);
  });

  it('releases a bar when its key comes up', () => {
    press('keydown', 'KeyA');
    press('keyup', 'KeyA');
    expect(events).toEqual(['on C4 xylophone', 'off C4 xylophone']);
  });

  it('ignores keys that are not on the chosen row', () => {
    press('keydown', 'KeyQ');
    press('keydown', 'Digit1');
    press('keydown', 'KeyZ');
    press('keydown', 'Space');
    expect(events).toEqual([]);
  });

  it('takes over the keys it uses so the browser does not search or scroll', () => {
    expect(press('keydown', 'Quote').defaultPrevented).toBe(true);
    expect(press('keydown', 'KeyQ').defaultPrevented).toBe(false);
  });

  it('ignores key repeat', () => {
    press('keydown', 'KeyA');
    press('keydown', 'KeyA', { repeat: true });
    expect(events).toEqual(['on C4 xylophone']);
  });

  it('ignores shortcuts with Ctrl, Alt or Meta', () => {
    press('keydown', 'KeyA', { ctrlKey: true });
    press('keydown', 'KeyA', { altKey: true });
    press('keydown', 'KeyA', { metaKey: true });
    expect(events).toEqual([]);
  });

  it('allows Shift, which only changes the typed letter', () => {
    press('keydown', 'KeyA', { shiftKey: true });
    expect(events).toEqual(['on C4 xylophone']);
  });

  it('ignores typing in form fields', () => {
    const field = document.createElement('input');
    document.body.appendChild(field);
    press('keydown', 'KeyA', {}, field);
    expect(events).toEqual([]);
  });

  it('plays while a button has the focus', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    press('keydown', 'KeyA', {}, button);
    expect(events).toEqual(['on C4 xylophone']);
  });

  it('follows a new row of bars and lets go of notes still held', () => {
    press('keydown', 'KeyA');
    input.setBars(barsForRow('top', 5));
    expect(events).toEqual(['on C4 xylophone', 'off C4 xylophone']);
    press('keydown', 'KeyA');
    expect(events).toHaveLength(2); // the home row is no longer used
    press('keydown', 'KeyQ');
    expect(events[2]).toBe('on C5 xylophone');
  });

  it('releases every held bar when the window loses focus', () => {
    press('keydown', 'KeyA');
    press('keydown', 'KeyD');
    window.dispatchEvent(new Event('blur'));
    expect(events).toContain('off C4 xylophone');
    expect(events).toContain('off E4 xylophone');
  });

  it('stops listening after detach and lets go of held bars', () => {
    press('keydown', 'KeyA');
    input.detach();
    expect(events).toEqual(['on C4 xylophone', 'off C4 xylophone']);
    press('keydown', 'KeyS');
    expect(events).toHaveLength(2);
  });
});
