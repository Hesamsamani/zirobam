import type * as ToneNamespace from 'tone';
import type { BandEvent } from './arrange';
import type { BandBackend } from './bandPlayer';
import type { BandPart } from './patterns';

type ToneModule = typeof ToneNamespace;

/** The piano of the band: the app's sampler, played at a time on the audio clock. */
export interface BandPiano {
  ready(): Promise<boolean>;
  /** A note (a frequency in Hz) at `time`, for `seconds`, with a velocity from 0 to 1. */
  trigger(frequency: number, seconds: number, time: number, velocity: number): void;
  releaseAll(): void;
}

interface Voices {
  kick: ToneNamespace.MembraneSynth;
  tom: ToneNamespace.MembraneSynth;
  rim: ToneNamespace.MembraneSynth;
  snare: ToneNamespace.NoiseSynth;
  hat: ToneNamespace.NoiseSynth;
  openHat: ToneNamespace.NoiseSynth;
  ride: ToneNamespace.MetalSynth;
  bass: ToneNamespace.MonoSynth;
}

/**
 * The band on Tone.js: drums and bass are synthesised (no samples, nothing from the network), the chords are the
 * piano. A `Tone.Part` on the transport plays the arrangement and loops it. The band owns the transport only while
 * it plays: `stop()` gives it back.
 */
export function createToneBackend(Tone: ToneModule, piano: BandPiano): BandBackend {
  let voices: Voices | null = null;
  let part: ToneNamespace.Part | null = null;
  let beatEvent: number | null = null;
  let endEvent: number | null = null;
  const muted = new Set<BandPart>();

  const build = (): Voices => {
    const master = new Tone.Volume(-3).toDestination();
    const drumBus = new Tone.Volume(-2).connect(master);
    const highpass = (hz: number) => new Tone.Filter(hz, 'highpass').connect(drumBus);
    const snareFilter = highpass(1500);
    const hatFilter = highpass(7500);
    return {
      kick: new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 5, envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.1 } }).connect(drumBus),
      tom: new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 3, envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.1 } }).connect(drumBus),
      rim: new Tone.MembraneSynth({ pitchDecay: 0.005, octaves: 2, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 } }).connect(drumBus),
      snare: new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 } }).connect(snareFilter),
      hat: new Tone.NoiseSynth({ noise: { type: 'white' }, volume: -10, envelope: { attack: 0.001, decay: 0.04, sustain: 0 } }).connect(hatFilter),
      openHat: new Tone.NoiseSynth({ noise: { type: 'white' }, volume: -10, envelope: { attack: 0.001, decay: 0.25, sustain: 0 } }).connect(hatFilter),
      ride: new Tone.MetalSynth({ volume: -24, envelope: { attack: 0.001, decay: 0.35, release: 0.1 }, harmonicity: 5.1, modulationIndex: 24, resonance: 5000, octaves: 1.2 }).connect(drumBus),
      bass: new Tone.MonoSynth({
        volume: -2,
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.15 },
        filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.2, baseFrequency: 150, octaves: 2.5 },
      }).connect(master),
    };
  };

  const sound = (event: BandEvent, time: number): void => {
    const v = voices;
    if (!v || muted.has(event.part)) return;
    const seconds = (event.length * 60) / Tone.getTransport().bpm.value;
    if (event.part === 'drums') {
      switch (event.drum) {
        case 'kick':
          return void v.kick.triggerAttackRelease('C1', '16n', time, event.velocity);
        case 'tom':
          return void v.tom.triggerAttackRelease('G2', '8n', time, event.velocity);
        case 'rim':
          return void v.rim.triggerAttackRelease('C5', '32n', time, event.velocity);
        case 'snare':
          return void v.snare.triggerAttackRelease('16n', time, event.velocity);
        case 'hat':
          return void v.hat.triggerAttackRelease('32n', time, event.velocity);
        case 'openHat':
          return void v.openHat.triggerAttackRelease('8n', time, event.velocity);
        case 'ride':
          return void v.ride.triggerAttackRelease('C5', '16n', time, event.velocity);
        default:
          return;
      }
    }
    const frequencies = (event.midis ?? []).map((midi) => Tone.Frequency(midi, 'midi').toFrequency());
    if (event.part === 'bass') {
      if (frequencies[0] !== undefined) v.bass.triggerAttackRelease(frequencies[0], Math.max(0.08, seconds * 0.95), time, event.velocity);
      return;
    }
    for (const frequency of frequencies) piano.trigger(frequency, Math.max(0.1, seconds), time, event.velocity);
  };

  const clear = (): void => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    if (beatEvent !== null) transport.clear(beatEvent);
    if (endEvent !== null) transport.clear(endEvent);
    beatEvent = null;
    endEvent = null;
    part?.dispose();
    part = null;
    transport.seconds = 0;
  };

  return {
    async ready() {
      await Tone.start();
      if (!(await piano.ready())) return false;
      voices ??= build();
      return true;
    },

    start(arrangement, options) {
      clear();
      const transport = Tone.getTransport();
      transport.bpm.value = options.bpm;
      const ppq = transport.PPQ;
      const ticks = (beats: number): string => `${Math.round(beats * ppq)}i`;
      // a Part takes [time, value] pairs; its typing only knows plain values, hence the cast
      const pairs = arrangement.events.map((event) => [ticks(event.at), event]) as unknown as BandEvent[];
      part = new Tone.Part<BandEvent>((time, event) => sound(event, time), pairs);
      if (options.loop) {
        part.loop = true;
        part.loopStart = ticks(arrangement.countInBeats);
        part.loopEnd = ticks(arrangement.countInBeats + arrangement.loopBeats);
      }
      part.start(0);
      // the clock of beats for the screen: drawn on the animation frame that is nearest the sound
      beatEvent = transport.scheduleRepeat((time) => {
        const beat = Math.floor(transport.ticks / ppq) - arrangement.countInBeats;
        Tone.getDraw().schedule(() => options.onBeat(beat), time);
      }, '4n');
      if (!options.loop) {
        endEvent = transport.scheduleOnce((time) => {
          Tone.getDraw().schedule(() => {
            clear();
            options.onEnd();
          }, time);
        }, ticks(arrangement.countInBeats + arrangement.loopBeats));
      }
      transport.start();
    },

    stop() {
      clear();
      piano.releaseAll();
      voices?.bass.triggerRelease();
    },

    setBpm(bpm) {
      Tone.getTransport().bpm.value = bpm;
    },

    setMuted(partName, isMuted) {
      if (isMuted) muted.add(partName);
      else muted.delete(partName);
      if (isMuted && partName === 'bass') voices?.bass.triggerRelease();
      if (isMuted && partName === 'chords') piano.releaseAll();
    },
  };
}
