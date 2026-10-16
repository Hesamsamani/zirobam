import { EventEmitter } from '../core/events';

export type NoteSource = 'midi' | 'screen' | 'computer' | 'xylophone' | 'microphone';

export interface NoteInputEvent {
  noteName: string;
  source: NoteSource;
}

/** Every way of playing a note (MIDI, on-screen piano, computer keyboard, microphone) goes through here. */
export class NoteInputHub {
  readonly onNoteOn = new EventEmitter<NoteInputEvent>();
  readonly onNoteOff = new EventEmitter<NoteInputEvent>();

  noteOn(noteName: string, source: NoteSource): void {
    this.onNoteOn.emit({ noteName, source });
  }

  noteOff(noteName: string, source: NoteSource): void {
    this.onNoteOff.emit({ noteName, source });
  }
}

export const noteInput = new NoteInputHub();
