import { describe, it, expect, vi } from 'vitest';
import { NoteInputHub } from '../input/noteInput';

describe('NoteInputHub', () => {
  it('delivers note on and off events with their source', () => {
    const hub = new NoteInputHub();
    const on = vi.fn();
    const off = vi.fn();
    hub.onNoteOn.on(on);
    hub.onNoteOff.on(off);
    hub.noteOn('C4', 'screen');
    hub.noteOff('C4', 'midi');
    expect(on).toHaveBeenCalledWith({ noteName: 'C4', source: 'screen' });
    expect(off).toHaveBeenCalledWith({ noteName: 'C4', source: 'midi' });
  });

  it('stops delivering after unsubscribe', () => {
    const hub = new NoteInputHub();
    const fn = vi.fn();
    const unsubscribe = hub.onNoteOn.on(fn);
    unsubscribe();
    hub.noteOn('D4', 'computer');
    expect(fn).not.toHaveBeenCalled();
  });
});
