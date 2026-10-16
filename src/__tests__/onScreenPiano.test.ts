import { describe, it, expect, beforeEach } from 'vitest';
import { NoteInputHub } from '../input/noteInput';
import { OnScreenPiano, buildKeyLayout } from '../input/onScreenPiano';
import { formatNoteName } from '../i18n/noteNames';

function pointer(el: Element, type: 'pointerdown' | 'pointerup' | 'pointerleave') {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
}

describe('buildKeyLayout', () => {
  const layout = buildKeyLayout(48, 84);

  it('covers C3 to C6: 37 keys, 22 white', () => {
    expect(layout).toHaveLength(37);
    expect(layout.filter((k) => !k.isBlack)).toHaveLength(22);
  });

  it('indexes white keys and places black keys after the white key on their left', () => {
    const byName = Object.fromEntries(layout.map((k) => [k.noteName, k]));
    expect(byName['C3']).toMatchObject({ isBlack: false, whiteIndex: 0 });
    expect(byName['C#3']).toMatchObject({ isBlack: true, whiteIndex: 0 });
    expect(byName['D3']).toMatchObject({ isBlack: false, whiteIndex: 1 });
    expect(byName['B3']).toMatchObject({ isBlack: false, whiteIndex: 6 });
    expect(byName['C4']).toMatchObject({ isBlack: false, whiteIndex: 7 });
    expect(byName['C6']).toMatchObject({ isBlack: false, whiteIndex: 21 });
  });
});

describe('OnScreenPiano', () => {
  let hub: NoteInputHub;
  let piano: OnScreenPiano;
  let events: string[];

  const keyEl = (name: string) => piano.element.querySelector(`[data-note="${name}"]`) as HTMLElement;

  beforeEach(() => {
    hub = new NoteInputHub();
    events = [];
    hub.onNoteOn.on((e) => events.push(`on ${e.noteName} ${e.source}`));
    hub.onNoteOff.on((e) => events.push(`off ${e.noteName} ${e.source}`));
    piano = new OnScreenPiano(hub);
  });

  it('renders every key', () => {
    expect(piano.element.querySelectorAll('.piano-key')).toHaveLength(37);
    expect(piano.element.querySelectorAll('.piano-key.white')).toHaveLength(22);
  });

  it('emits note on and off from the pointer and marks the key pressed', () => {
    pointer(keyEl('E4'), 'pointerdown');
    expect(events).toEqual(['on E4 screen']);
    expect(keyEl('E4').classList.contains('pressed')).toBe(true);
    pointer(keyEl('E4'), 'pointerup');
    expect(events).toEqual(['on E4 screen', 'off E4 screen']);
    expect(keyEl('E4').classList.contains('pressed')).toBe(false);
  });

  it('releases the note when the pointer slides off the key', () => {
    pointer(keyEl('G4'), 'pointerdown');
    pointer(keyEl('G4'), 'pointerleave');
    expect(events).toEqual(['on G4 screen', 'off G4 screen']);
  });

  it('shows notes played from other sources', () => {
    hub.noteOn('F#3', 'midi');
    expect(keyEl('F#3').classList.contains('pressed')).toBe(true);
    hub.noteOff('F#3', 'midi');
    expect(keyEl('F#3').classList.contains('pressed')).toBe(false);
  });

  it('labels white keys with the formatter and marks the octave on every C', () => {
    piano.setLabelFormatter((n) => formatNoteName(n, 'solfege-fa'));
    expect(keyEl('C4').querySelector('.piano-key-label')!.textContent).toBe('دو');
    expect(keyEl('C4').querySelector('.piano-key-octave')!.textContent).toBe('4');
    expect(keyEl('D4').querySelector('.piano-key-octave')).toBeNull();
    expect(keyEl('C#4').querySelector('.piano-key-label')).toBeNull();
  });

  it('gives every key, black ones included, an accessible name with its octave', () => {
    for (const key of piano.element.querySelectorAll<HTMLElement>('.piano-key')) {
      expect(key.getAttribute('aria-label'), key.dataset.note).toBeTruthy();
    }
    expect(keyEl('C#4').getAttribute('aria-label')).toBe('C#4');
  });

  it('names the keys in the chosen note-name system', () => {
    piano.setLabelFormatter((n) => formatNoteName(n, 'solfege-fa'));
    expect(keyEl('C4').getAttribute('aria-label')).toBe('دو 4');
    expect(keyEl('C#4').getAttribute('aria-label')).toBe('دو دیز 4');
    expect(keyEl('E3').getAttribute('aria-label')).toBe('می 3');
  });

  it('shows and clears computer-key hints', () => {
    piano.setHints({ C4: 'A', 'C#4': 'W' });
    expect(keyEl('C4').dataset.hint).toBe('A');
    expect(keyEl('C#4').dataset.hint).toBe('W');
    piano.setHints({});
    expect(keyEl('C4').dataset.hint).toBeUndefined();
  });

  it('stops reacting to the hub after dispose', () => {
    piano.dispose();
    hub.noteOn('C4', 'midi');
    expect(keyEl('C4').classList.contains('pressed')).toBe(false);
  });
});
