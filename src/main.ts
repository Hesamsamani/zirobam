import './styles/tokens.css';
import './style.css';
import './styles/dialog.css';
import createVerovioModule from 'verovio/wasm';
import { VerovioToolkit } from 'verovio/esm';
import * as Tone from 'tone';
import {
  generateMusicXML,
  regenerateXMLFromNotes,
  getLevel,
  setLevel,
  setSubLevel,
  incrementLevel,
  getFullLevelString,
  getRepetitionsRemaining,
  setMobileMode,
  isMobileMode,
  getCurrentBpm,
  shouldIncreaseTempo,
  increaseTempo,
  setBpm,
  getBpmMasteryRemaining,
  setIncludeFingering,
  setKeyOverride,
  MAX_LEVEL,
} from './musicGenerator';
import type { NoteData } from './musicGenerator';
import {
  shouldAllowMetronomeClick,
  beatsToSeconds,
} from './scheduler';
import {
  parseMusicXML,
  isMidiFile,
  ProgressivePracticeSession,
  type ParsedMusicXML,
} from './upload';
import { buildMusicXML, type NoteIdMapping } from './music/xml/builder';
import { BUILT_IN_SONGS, getSongById } from './songs';
import { hashQuery, Router, VIEWS, type View } from './app/router';
import { AppShell } from './app/shell';
import { MainMenu } from './menu/mainMenu';
import { SongsView } from './menu/songsView';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/crimson-pro/latin-400.css';
import '@fontsource/crimson-pro/latin-500.css';
import '@fontsource/crimson-pro/latin-600.css';
import { InstallPrompt } from './pwa/installPrompt';
import { PwaPanel } from './pwa/pwaPanel';
import { SongMakerView } from './songs/songMakerView';
import { EarView } from './ear/earView';
import { ScalesView } from './scales/scalesView';
import { buildTimingEventList, effectiveHand, normalizeNote, type TimingEvent } from './practice/timingEvents';
import { soundOf } from './theory/pitch';
import { beatsPerMeasure, countInBeats } from './core/timeSignature';
import { WaitSession, countWaitNotes } from './practice/waitMode';
import { PracticeOptionsStore, nextLadderBpm } from './practice/practiceOptions';
import { PracticeAids } from './practice/practiceAids';
import { applyBackup, backupFileName, browserStorage, createBackup } from './backup/backup';
import { BackupPanel, type BackupPanelDeps } from './backup/backupView';
import { downloadTextFile } from './backup/download';
import { newMakerId } from './songs/songMaker';
import { XylophoneView } from './xylophone/xylophoneView';
import { PracticePanel } from './practice/practicePanel';
import { songTitle } from './songs/songText';
import { groupSongs } from './songs/songGroups';
import { XyloSound } from './xylophone/xyloSound';
import { TempoStore } from './metronome/tempoStore';
import { MetronomeEngine } from './metronome/metronomeEngine';
import { MetronomePanel } from './metronome/metronomePanel';
import { FloatingWindow } from './metronome/floatingWindow';
import { GameStore, practiceStars } from './game/gameStore';
import { GameController } from './game/gameController';
import { ToastCenter } from './game/toastCenter';
import { GameHud } from './game/gameHud';
import { ProgressView } from './game/progressView';
import {
  t, initLocale, setLocale, getLocale, onLocaleChange, applyTranslations,
  formatNumber, setPersianDigits, isLocale,
} from './i18n';
import type { MessageKey } from './i18n';
import {
  getNoteNameSystem, setNoteNameSystem, loadNoteNameSystem, onNoteNamesChange,
  formatKeyName, formatNoteName, isNoteNameSystem,
} from './i18n/noteNames';
import { describeLesson, keyIdForLevel } from './lessonText';
import { noteInput, type NoteSource } from './input/noteInput';
import { ComputerKeyboard, keyHints } from './input/computerKeyboard';
import { OnScreenPiano } from './input/onScreenPiano';
import { ClickVoice } from './metronome/clickVoice';
import { storageGet, storageRemove, storageSet } from './core/safeStorage';
import { clampBpm } from './core/tempo';
import { didPassPiece } from './core/passRules';
import { sliderToDb } from './core/volume';
import { isSpaceReserved } from './input/shortcuts';
import { showNotice } from './ui/notice';
import { addNoteLabels, removeNoteLabels } from './rendering/noteLabels';
import { spellFromMidi } from './core/noteUtils';
import { LearnView } from './learn/learnView';
import { NameTheNoteQuiz } from './learn/nameTheNote';
import { NoteStats } from './learn/noteStats';
import { createNoteCardRenderer, type NotationToolkit } from './learn/noteCard';
import { CatalogView } from './catalog/catalogView';
import { loadCatalog } from './catalog';
import { ScoreStore } from './scores/scoreStore';
import { parseStoredScore, readScoreFile, scoreIdForData } from './scores/scoreImport';
import { ALL_LESSONS } from './lessons/curriculum';
import { LessonPlayer } from './lessons/lessonPlayer';
import { LessonProgress } from './lessons/lessonProgress';
import { LessonsView } from './lessons/lessonsView';
import type { LessonAction } from './lessons/types';

// State
let toolkit: VerovioToolkit;
let verovioModule: Awaited<ReturnType<typeof createVerovioModule>>;
let isPlaying = false;
let currentBeatIndex = 0;
let sampler: Tone.Sampler | null = null;
let scheduledEvents: number[] = [];

// Timing data from music generator (source of truth for durations and playback)
let timingEvents: TimingEvent[] = [];

// Practice aids: wait for me, repeat a step, speed up as I improve, one hand at a time
const practiceOptions = new PracticeOptionsStore();
let practiceAids: PracticeAids | null = null;
/** Set while the piece waits at a note for the student (wait mode). */
let waitSession: WaitSession | null = null;
/** The tempo the student set; the quick speeds (50, 75, 100 percent) are shares of it. */
let practiceBaseBpm = 60;
/** The step was already counted as passed, so repeating it does not pay again. */
let stepAwarded = false;
/** The waiting hint is shown when the student presses Start; later rounds keep the message about the last one. */
let waitHintPending = false;

// Current time signature
let currentTimeSig = { beats: 4, beatType: 4 };

// Countoff state
let countoffBeats = 0;
let isCountingOff = false;

// Metronome debounce to prevent double clicks
let lastMetronomeTime = 0;

// Current notes being played (for MIDI matching)
let activeNotes: Set<string> = new Set();

// MIDI devices
let midiInputs: Map<string, MIDIInput> = new Map();
let selectedMidiInput: string | null = storageGet('midiDeviceId');

// Settings
let bpm = 30;
let metronomeEnabled = true;
let metronomeVolume = sliderToDb(50); // dB base for metronome; the slider starts at 50
/** Tempo, click on/off and volume are shared with the floating metronome window through this store. */
const tempoStore = new TempoStore();
let masterVolume = sliderToDb(80, true); // dB for master output; the slider starts at 80

// Store the current piece's XML
let currentPieceXml: string = '';

// Performance tracking
let hadMistake = false;
let notesPlayed = 0;       // Count of notes correctly played by user
let notesRequired = 0;     // Count of notes that need to be played

// Current lesson info
let currentLessonDescription = '';

// Current piece notes for playback timing (source of truth)
let currentRightHandNotes: NoteData[] = [];
let currentLeftHandNotes: NoteData[] = [];

// Number of measures in the current piece (for display and countoff decisions)
let currentMeasureCount = 4;

// App mode: 'levels' for generated exercises, 'practice' for uploaded files
type AppMode = 'levels' | 'practice';
let currentMode: AppMode = 'levels';

// Screens (see setupNavigation)
let shell: AppShell | null = null;
let mainMenu: MainMenu | null = null;
let songsView: SongsView | null = null;
let xylophoneView: XylophoneView | null = null;
let practicePanel: PracticePanel | null = null;
/** 1 shows the score at the full width of its area; below 1 it is narrower (and so shorter) so the whole piece fits the window. */
let fitFactor = 1;
const MIN_FIT = 0.55;
/** Rewards: XP, rank, the daily goal, badges and song stars. */
const gameStore = new GameStore({
  beginnerSongIds: BUILT_IN_SONGS.filter((s) => s.difficulty === 'beginner' && s.category !== 'exercise').map((s) => s.id),
});
const game = new GameController({ store: gameStore, toasts: new ToastCenter() });
let gameHud: GameHud | null = null;
let progressView: ProgressView | null = null;
const scoreStore = new ScoreStore();
/** The stored score being practised, and the name it is shown with (a library song's name, or the file's). */
let currentScoreId: string | null = null;
let currentScoreTitle: string | null = null;
const lessonProgress = new LessonProgress(ALL_LESSONS.map((lesson) => lesson.id));
/** Steps repeated since the song was started, for its stars. */
let practiceRetries = 0;
/** Tries at the current practice step (1 for the first), and wrong notes in the current try. */
let practiceAttempt = 1;
let mistakeCount = 0;
let pianoKeyboard: ComputerKeyboard | null = null;
let learnReturnView: View = 'home';
/** The screens that show the music stand, the control bar and the exercise. */
const STAND_VIEWS: readonly View[] = ['levels', 'practice', 'learn'];
let practiceSession: ProgressivePracticeSession | null = null;

// Scrolling state for consolidation mode
let isScrollingMode = false; // True during consolidation steps with many measures
let currentScrollMeasure = 0; // Current measure being displayed (0-indexed)


// Detect mobile device and orientation
function detectMobile(): boolean {
  // Check for touch device OR narrow viewport in landscape
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isNarrowViewport = window.innerWidth < 1024;
  const isLandscape = window.innerWidth > window.innerHeight;

  // Mobile mode: touch device, or narrow landscape viewport
  return isTouchDevice || (isNarrowViewport && isLandscape);
}

function updateMobileMode() {
  const wasMobile = isMobileMode();
  const nowMobile = detectMobile();

  if (wasMobile !== nowMobile) {
    setMobileMode(nowMobile);
    // Update UI to reflect mobile mode
    document.body.classList.toggle('mobile-mode', nowMobile);
  }
}

async function init() {
  initLocale();
  loadNoteNameSystem();

  // Initialize Verovio
  const VerovioModule = await createVerovioModule();
  verovioModule = VerovioModule;
  toolkit = new VerovioToolkit(VerovioModule);

  // Detect initial mobile state
  updateMobileMode();

  updateVerovioOptions();

  // Try to restore previous practice session, or generate new music
  await Promise.race([scoreStore.ready(), new Promise((resolve) => setTimeout(resolve, 2000))]);
  if (!(await loadPracticeState())) {
    generateAndRender();
  }

  // Setup UI
  setupControls();

  // Setup MIDI
  setupMIDI();

  // Every input source (MIDI, computer keyboard, on-screen piano) arrives here
  noteInput.onNoteOn.on(({ noteName, source }) => {
    handleNoteOn(noteName);
    playUserNote(noteName, source);
  });
  noteInput.onNoteOff.on(({ noteName, source }) => {
    handleNoteOff(noteName);
    stopUserNote(noteName, source);
  });
  setupPiano();
  const learn = setupLearnMode();
  setupNavigation(learn);

  // Handle window resize - re-render existing music, don't generate new
  window.addEventListener('resize', () => {
    const wasMobile = isMobileMode();
    updateMobileMode();
    updateVerovioOptions();
    if (!isPlaying) {
      // Only regenerate if mobile mode changed (different measure count)
      // Otherwise just re-render the existing piece
      if (wasMobile !== isMobileMode()) {
        generateAndRender();
      } else {
        rerenderCurrentMusic();
      }
    }
  });

  // Handle orientation change on mobile
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      const wasMobile = isMobileMode();
      updateMobileMode();
      updateVerovioOptions();
      if (!isPlaying) {
        if (wasMobile !== isMobileMode()) {
          generateAndRender();
        } else {
          rerenderCurrentMusic();
        }
      }
    }, 100);
  });
}

function updateVerovioOptions(forScrolling = false) {
  const container = document.getElementById('notation')!;
  const containerWidth = Math.max(800, container.clientWidth - 20);

  // Smaller scale gives more horizontal room for note spacing
  const scale = isMobileMode() ? 35 : 42;

  // Break every 4 bars if more than 4 measures (using encoded breaks in MusicXML)
  // Otherwise fit all on one line
  const breaks = currentMeasureCount > 4 ? 'encoded' : 'none';

  // Estimate page height needed: ~180px per system at scale 42
  // Each system is 4 measures, so number of systems = ceil(measureCount / 4)
  const systemCount = Math.ceil(currentMeasureCount / 4);
  const estimatedHeight = Math.max(800, systemCount * 180 * (scale / 42));

  toolkit.setOptions({
    pageWidth: containerWidth,
    pageHeight: estimatedHeight,
    scale: scale,
    adjustPageHeight: true,
    footer: 'none',
    header: 'none',
    breaks: breaks,
    // Spacing for eighth notes
    spacingNonLinear: 0.55,
    spacingLinear: 0.3,
    spacingStaff: 6,
    spacingSystem: 4,
    // For scrolling mode, don't justify - let measures have natural width
    justifyVertically: forScrolling ? false : true,
  });
}

// Re-render the current piece without generating new music
/**
 * On a computer the whole piece should be visible without scrolling. The score is drawn as wide as its
 * container (the height follows), so when it is taller than the room above the piano and the control
 * bar, it is shown narrower (down to 55 percent). Phones scroll instead. Nothing is drawn again, so the
 * highlighting of the playing notes is not disturbed.
 */
function fitScoreToScreen() {
  const notation = document.getElementById('notation');
  const svg = notation?.querySelector<SVGSVGElement>('svg');
  if (!notation || !svg) return;
  if (isMobileMode() || isScrollingMode || notation.offsetParent === null) {
    svg.style.width = '';
    return;
  }
  svg.style.display = 'block';
  svg.style.margin = '0 auto';
  svg.style.alignSelf = 'flex-start'; // the score box has a minimum height; do not stretch the page to it

  const bar = document.getElementById('controlBar');
  const dock = document.getElementById('pianoDock');
  const reserve = (bar?.offsetHeight ?? 0) + (dock && !dock.hidden ? dock.offsetHeight : 0) + 32;
  const available = window.innerHeight - reserve - (svg.getBoundingClientRect().top + window.scrollY);
  if (available <= 120) return;

  // The height is not simply proportional to the width (the score has margins), so measure it at two
  // widths and solve for the width that leaves exactly the room that is available.
  const heightAt = (factor: number) => {
    svg.style.width = `${factor * 100}%`;
    return svg.getBoundingClientRect().height;
  };
  const first = fitFactor;
  const firstHeight = heightAt(first);
  const second = first > 0.75 ? first - 0.2 : first + 0.2;
  const secondHeight = heightAt(second);
  const slope = (firstHeight - secondHeight) / (first - second);
  if (!(slope > 0)) {
    svg.style.width = `${first * 100}%`;
    return;
  }
  fitFactor = Math.max(MIN_FIT, Math.min(1, first + (available - firstHeight) / slope));
  svg.style.width = `${fitFactor * 100}%`;
}

function rerenderCurrentMusic() {
  if (!currentPieceXml) return;
  toolkit.loadData(currentPieceXml);

  // Rebuild MEI ID mapping (Verovio generates new IDs each time it loads)
  const mei = (toolkit as unknown as { getMEI: () => string }).getMEI();
  buildMeiIdMapping(mei);

  const svg = toolkit.renderToSVG(1);
  const notation = document.getElementById('notation')!;
  notation.innerHTML = svg;

  // Rebuild timing events to ensure they match the new IDs
  buildTimingEvents();
  refreshNoteLabels();
  fitScoreToScreen();
}

// Regenerate XML from current notes (for fingering toggle)
function regenerateCurrentMusicXML() {
  if (currentRightHandNotes.length === 0 && currentLeftHandNotes.length === 0) return;
  const result = regenerateXMLFromNotes(
    currentRightHandNotes,
    currentLeftHandNotes,
    currentTimeSig
  );
  currentPieceXml = result.xml;
  currentNoteIdMapping = result.noteIdMapping;
}

// Pressing two keys quickly must not load the piano samples twice
let audioInit: Promise<void> | null = null;
function initAudio(): Promise<void> {
  if (!audioInit) {
    audioInit = loadAudio().catch((error) => {
      // Offline or blocked: the exercise still works without the piano, and the next press tries again
      console.warn('The piano sounds could not be loaded', error);
      sampler?.dispose();
      sampler = null;
      audioInit = null;
      showNotice(t('audio.loadFailed'));
    });
  }
  return audioInit;
}

async function loadAudio() {
  if (sampler) return;

  await Tone.start();

  sampler = new Tone.Sampler({
    urls: {
      A0: 'A0.mp3',
      C1: 'C1.mp3',
      'D#1': 'Ds1.mp3',
      'F#1': 'Fs1.mp3',
      A1: 'A1.mp3',
      C2: 'C2.mp3',
      'D#2': 'Ds2.mp3',
      'F#2': 'Fs2.mp3',
      A2: 'A2.mp3',
      C3: 'C3.mp3',
      'D#3': 'Ds3.mp3',
      'F#3': 'Fs3.mp3',
      A3: 'A3.mp3',
      C4: 'C4.mp3',
      'D#4': 'Ds4.mp3',
      'F#4': 'Fs4.mp3',
      A4: 'A4.mp3',
      C5: 'C5.mp3',
      'D#5': 'Ds5.mp3',
      'F#5': 'Fs5.mp3',
      A5: 'A5.mp3',
      C6: 'C6.mp3',
      'D#6': 'Ds6.mp3',
      'F#6': 'Fs6.mp3',
      A6: 'A6.mp3',
      C7: 'C7.mp3',
      'D#7': 'Ds7.mp3',
      'F#7': 'Fs7.mp3',
      A7: 'A7.mp3',
      C8: 'C8.mp3',
    },
    release: 2, // Longer release for sustain
    baseUrl: `${import.meta.env.BASE_URL}samples/salamander/`, // the app's own copy, so it plays without internet
  }).toDestination();

  await Tone.loaded();

  // Set initial master volume
  Tone.getDestination().volume.value = masterVolume;
}

const clickVoice = new ClickVoice();
const metronomeEngine = new MetronomeEngine(tempoStore, clickVoice);
let metronomePanel: MetronomePanel | null = null;
let metronomeWindow: FloatingWindow | null = null;

/** The one way to change the exercise tempo: keeps the field, the exercise and the metronome window in step. */
function setExerciseBpm(value: number | string, quickSpeed = false) {
  bpm = clampBpm(value);
  const input = document.getElementById('bpm') as HTMLInputElement | null;
  if (input) input.value = String(bpm);
  tempoStore.setBpm(bpm);
  // a quick speed (or the ladder) is a share of the tempo the student chose; any other change is a new choice
  if (!quickSpeed) practiceBaseBpm = bpm;
  practiceAids?.refresh();
}

/** `time` is the audio time Tone.js passes to the Transport callback. */
function playMetronomeClick(subdivisionInBeat: number, time: number) {
  if (!metronomeEnabled) return;

  // Debounce to prevent double clicks from overlapping schedules
  const now = performance.now();
  if (!shouldAllowMetronomeClick(now, lastMetronomeTime, bpm)) {
    return;
  }
  lastMetronomeTime = now;

  clickVoice.play(subdivisionInBeat, metronomeVolume, time);
}

function generateAndRender() {
  updateVerovioOptions();
  const {
    xml,
    timeSignature,
    lessonDescription,
    suggestedBpm,
    rightHandNotes,
    leftHandNotes,
    noteIdMapping,
  } = generateMusicXML();

  currentTimeSig = timeSignature;
  currentPieceXml = xml;
  currentLessonDescription = lessonDescription;
  currentRightHandNotes = rightHandNotes;
  currentLeftHandNotes = leftHandNotes;
  currentNoteIdMapping = noteIdMapping;

  // Sync BPM with lesson suggestion on level change
  const bpmInput = document.getElementById('bpm') as HTMLInputElement;
  if (bpmInput && suggestedBpm) {
    const currentBpm = getCurrentBpm();
    // Only update if this is a new level (BPM resets)
    if (currentBpm === suggestedBpm) {
      setExerciseBpm(suggestedBpm);
      setBpm(suggestedBpm);
    }
  }

  renderCurrentMusic();

  // Update level display
  updateLevelDisplay();
}

function renderCurrentMusic() {
  toolkit.loadData(currentPieceXml);

  // Get MEI to extract Verovio's generated IDs
  // Verovio preserves IDs from MEI → SVG, but generates new IDs when converting MusicXML → MEI
  const mei = (toolkit as unknown as { getMEI: () => string }).getMEI();
  buildMeiIdMapping(mei);

  const svg = toolkit.renderToSVG(1);
  const notation = document.getElementById('notation')!;
  notation.innerHTML = svg;

  // Build timing events from the source note data (not from SVG)
  buildTimingEvents();
  refreshNoteLabels();
  fitScoreToScreen();
}

// Note ID mapping: maps time (in beats) to SVG element IDs
// Built by parsing MEI after Verovio converts our MusicXML
let currentNoteIdMapping: NoteIdMapping = { timeToIds: new Map() };

/**
 * Parse MEI XML to extract note IDs and their timing.
 * Verovio generates IDs when converting MusicXML → MEI, and preserves them in SVG.
 */
function buildMeiIdMapping(meiString: string) {
  const timeToIds = new Map<number, string[]>();
  const roundTime = (t: number) => Math.round(t * 1000) / 1000;

  const parser = new DOMParser();
  const doc = parser.parseFromString(meiString, 'text/xml');

  // MEI uses namespaces
  const ns = 'http://www.music-encoding.org/ns/mei';

  // Helper to calculate duration in beats from MEI @dur attribute
  // MEI dur: 1=whole, 2=half, 4=quarter, 8=eighth, etc.
  // Also handles dotted notes with @dots attribute
  const getDurationInBeats = (el: Element): number => {
    const dur = el.getAttribute('dur');
    if (!dur) return 0;
    const durNum = parseInt(dur, 10);
    let duration = 4 / durNum; // 4/1 = 4 beats (whole), 4/4 = 1 beat (quarter), etc.

    // Handle dotted notes
    const dots = el.getAttribute('dots');
    if (dots) {
      const numDots = parseInt(dots, 10);
      let dotValue = duration / 2;
      for (let i = 0; i < numDots; i++) {
        duration += dotValue;
        dotValue /= 2;
      }
    }
    return duration;
  };

  // Helper to process a note/rest/chord element and add to mapping
  // Returns the duration consumed by this element
  const processElement = (el: Element, time: number): number => {
    if (el.localName === 'note' || el.localName === 'rest') {
      const id = el.getAttribute('xml:id');
      if (id) {
        const key = roundTime(time);
        const existing = timeToIds.get(key) || [];
        existing.push(id);
        timeToIds.set(key, existing);
      }
      return getDurationInBeats(el);
    } else if (el.localName === 'chord') {
      // Chord: all notes share same time
      const chordNotes = el.getElementsByTagNameNS(ns, 'note');
      for (const note of chordNotes) {
        const noteId = note.getAttribute('xml:id');
        if (noteId) {
          const key = roundTime(time);
          const existing = timeToIds.get(key) || [];
          existing.push(noteId);
          timeToIds.set(key, existing);
        }
      }
      return getDurationInBeats(el);
    } else if (el.localName === 'beam') {
      // Beam: process all children (notes/chords) sequentially
      let beamTime = 0;
      for (const child of el.children) {
        const duration = processElement(child, time + beamTime);
        beamTime += duration;
      }
      return beamTime;
    } else if (el.localName === 'tuplet') {
      // Tuplet: process children, but timing is adjusted
      // For now, just process children sequentially
      let tupletTime = 0;
      for (const child of el.children) {
        const duration = processElement(child, time + tupletTime);
        tupletTime += duration;
      }
      return tupletTime;
    }
    return 0;
  };

  // MEI structure: <section> → <measure> → <staff> → <layer> → notes
  // We need to iterate through measures to track time across the piece
  const measures = doc.getElementsByTagNameNS(ns, 'measure');

  // Track cumulative time for each staff (1 = treble/RH, 2 = bass/LH)
  const staffTimeOffsets = new Map<string, number>();

  for (const measure of measures) {
    // Process each staff within this measure
    const staves = measure.getElementsByTagNameNS(ns, 'staff');

    for (const staff of staves) {
      const staffN = staff.getAttribute('n') || '1';

      // Get the starting time for this staff in this measure
      const measureStartTime = staffTimeOffsets.get(staffN) || 0;
      let maxTimeInMeasure = 0;

      // Process each layer within the staff
      const layers = staff.getElementsByTagNameNS(ns, 'layer');
      for (const layer of layers) {
        let layerTime = 0; // Time within this layer (relative to measure start)

        for (const el of layer.children) {
          const duration = processElement(el, measureStartTime + layerTime);
          layerTime += duration;
        }

        // Track the maximum time used in any layer
        maxTimeInMeasure = Math.max(maxTimeInMeasure, layerTime);
      }

      // Update the staff's time offset for the next measure
      staffTimeOffsets.set(staffN, measureStartTime + maxTimeInMeasure);
    }
  }

  currentNoteIdMapping = { timeToIds };
}

// Build timing events from the generated note data
// This is the source of truth for durations (see practice/timingEvents.ts)
function buildTimingEvents() {
  timingEvents = buildTimingEventList(currentRightHandNotes, currentLeftHandNotes, practisedHand());

  // Expose for E2E testing (used by tie continuation tests)
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__timingEvents = timingEvents;
    (window as unknown as Record<string, unknown>).__currentRightHandNotes = currentRightHandNotes;
  }
  tagHands();
}

/** The hand the student practises now: only a song in practice mode is practised one hand at a time. */
function practisedHand() {
  if (currentMode !== 'practice') return 'both' as const;
  return effectiveHand(currentRightHandNotes, currentLeftHandNotes, practiceOptions.get().hand);
}

/**
 * Marks the staves of the score as the right and the left hand and says which hand is practised, so the other
 * one can be drawn faintly (the app plays it).
 */
function tagHands() {
  const notation = document.getElementById('notation');
  if (!notation) return;
  notation.querySelectorAll('.measure').forEach((measure) => {
    const staves = Array.from(measure.children).filter((child) => child.classList.contains('staff'));
    staves.forEach((staff, i) => staff.setAttribute('data-hand', i === 0 ? 'right' : 'left'));
  });
  notation.dataset.hand = practisedHand();
}

let showNoteNames = storageGet('ui.showNoteNames') === '1';

function noteNameForElement(el: Element): string | null {
  const id = el.getAttribute('id');
  if (!id) return null;
  const attrs = toolkit.getElementAttr(id);
  if (!attrs?.pname) return null;
  const letter = String(attrs.pname).toUpperCase();
  // The sounding pitch already includes the key signature, so F in D major is spelled F#
  const midi = toolkit.getMIDIValuesForElement(id)?.pitch;
  const spelled =
    typeof midi === 'number' && attrs.oct !== undefined
      ? spellFromMidi(letter, Number(attrs.oct), midi)
      : letter;
  return formatNoteName(spelled, getNoteNameSystem());
}

function refreshNoteLabels() {
  const notation = document.getElementById('notation');
  if (!notation) return;
  if (showNoteNames) addNoteLabels(notation, noteNameForElement);
  else removeNoteLabels(notation);
}

function localizeLevel(levelString: string): string {
  return levelString.replace(/^\d+/, (n) => formatNumber(Number(n)));
}

function describeCurrentLesson(): string {
  const match = /^(\d+)([a-d])$/.exec(getFullLevelString());
  if (!match) return currentLessonDescription;
  return describeLesson(Number(match[1]), 'abcd'.indexOf(match[2]));
}

/** Fills the song list in the options panel (grouped, in the current language). */
function populateSongSelect() {
  const select = document.getElementById('songSelect') as HTMLSelectElement | null;
  if (!select) return;
  select.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = t('options.chooseSong');
  select.appendChild(placeholder);
  for (const group of groupSongs(BUILT_IN_SONGS)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = t(group.label);
    for (const song of group.songs) {
      const option = document.createElement('option');
      option.value = song.id;
      option.textContent = songTitle(song);
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }
  select.value = '';
}

const KEY_IDS = ['C', 'G', 'F', 'D', 'Bb', 'A', 'Eb', 'E', 'Ab', 'B', 'Db'];

function populateLevelJump() {
  const select = document.getElementById('levelJump') as HTMLSelectElement | null;
  if (!select) return;
  const previous = select.value || String(getLevel());
  select.replaceChildren();
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const option = document.createElement('option');
    option.value = String(level);
    option.textContent =
      level <= 10
        ? t(`levelJump.${level}` as MessageKey)
        : t('levelJump.key', { n: level, key: formatKeyName(keyIdForLevel(level)) });
    select.appendChild(option);
  }
  select.value = previous;
}

function populateKeySelect() {
  const select = document.getElementById('keySelect') as HTMLSelectElement | null;
  if (!select) return;
  const previous = select.value;
  select.replaceChildren();
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = t('options.keyDefault');
  select.appendChild(defaultOption);
  for (const id of KEY_IDS) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = formatKeyName(id);
    select.appendChild(option);
  }
  select.value = previous;
}

function describeMeasures(measures: number[]): string {
  if (measures.length === 1) return t('practice.measure', { n: measures[0] });
  return t('practice.measures', { from: measures[0], to: measures[measures.length - 1] });
}

/** "Not yet. Wrong notes: 2. Playing it again." (or the missed notes when none were wrong) */
function retryMessage(wrong: number, missed: number): string {
  const details = wrong > 0 ? t('practice.wrongNotes', { n: formatNumber(wrong) }) : missed > 0 ? t('practice.missedNotes', { n: formatNumber(missed) }) : '';
  return details ? t('practice.status.retry', { details }) : t('practice.status.retryPlain');
}

function updateLevelDisplay() {
  const levelDisplay = document.getElementById('levelDisplay');
  const levelIndicator = document.getElementById('levelIndicator');
  const lessonInfo = document.getElementById('lessonInfo');
  const progressInfo = document.getElementById('progressInfo');
  const levelJump = document.getElementById('levelJump') as HTMLSelectElement;

  const levelString = getFullLevelString();
  const levelText = t('control.level', { level: localizeLevel(levelString) });

  // Update the badge in the score header
  if (levelDisplay) {
    levelDisplay.textContent = localizeLevel(levelString);
  }

  // Update the control bar indicator
  if (levelIndicator) {
    levelIndicator.textContent = levelText;
  }

  // Sync level jump selector
  if (levelJump) {
    levelJump.value = String(getLevel());
  }

  if (lessonInfo) {
    lessonInfo.textContent = describeCurrentLesson();
  }

  if (progressInfo) {
    const remaining = getRepetitionsRemaining();
    const tempoMasteryRemaining = getBpmMasteryRemaining();

    // Show both note mastery and tempo mastery progress
    let progressText = '';
    if (remaining > 0) {
      progressText = t('progress.moreToAdvance', { n: remaining });
    }

    // Show tempo increase suggestion if mastered at current tempo
    if (shouldIncreaseTempo()) {
      progressText += progressText ? ' | ' : '';
      progressText += t('progress.readyTempo');
    } else if (tempoMasteryRemaining > 0 && remaining === 0) {
      progressText += progressText ? ' | ' : '';
      progressText += t('progress.atTempo', { n: tempoMasteryRemaining });
    }

    progressInfo.textContent = progressText;
  }
}


function setupMIDI() {
  if (!navigator.requestMIDIAccess) {
    console.log('Web MIDI not supported');
    return;
  }

  navigator.requestMIDIAccess().then(
    (midiAccess) => {
      updateMidiDevices(midiAccess);

      midiAccess.onstatechange = () => {
        updateMidiDevices(midiAccess);
      };
    },
    (err) => console.log('MIDI access denied:', err)
  );
}

function updateMidiDevices(midiAccess: MIDIAccess) {
  midiInputs.clear();

  for (const input of midiAccess.inputs.values()) {
    midiInputs.set(input.id, input);
    input.onmidimessage = handleMIDIMessage;
  }

  const midiSelect = document.getElementById('midiInput') as HTMLSelectElement;
  if (midiSelect) {
    const currentValue = midiSelect.value;
    const noneOption = document.createElement('option');
    noneOption.value = '';
    noneOption.dataset.i18n = 'midi.none';
    noneOption.textContent = t('midi.none');
    midiSelect.replaceChildren(noneOption);

    for (const [id, input] of midiInputs) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = input.name || id;
      midiSelect.appendChild(option);
    }

    // Prefer saved device, then current selection, then first available
    const savedDevice = storageGet('midiDeviceId');
    if (savedDevice && midiInputs.has(savedDevice)) {
      midiSelect.value = savedDevice;
    } else if (currentValue && midiInputs.has(currentValue)) {
      midiSelect.value = currentValue;
    } else if (midiInputs.size > 0) {
      const firstDevice = midiInputs.keys().next().value;
      if (firstDevice) midiSelect.value = firstDevice;
    }

    selectedMidiInput = midiSelect.value || null;
  }
}

function midiNoteToName(noteNum: number): string {
  const notes = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ];
  const octave = Math.floor(noteNum / 12) - 1;
  const note = notes[noteNum % 12];
  return `${note}${octave}`;
}

function handleMIDIMessage(event: MIDIMessageEvent) {
  const [status, noteNum, velocity] = event.data!;
  const command = status & 0xf0;

  if (command === 0x90 && velocity > 0) {
    noteInput.noteOn(midiNoteToName(noteNum), 'midi');
  } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
    noteInput.noteOff(midiNoteToName(noteNum), 'midi');
  }
}

// What used to happen inside handleMIDIMessage, now shared by every input source
function handleNoteOn(noteName: string) {
  activeNotes.add(noteName);
  checkNoteMatch(noteName);
}

function handleNoteOff(noteName: string) {
  activeNotes.delete(noteName);
}

interface LearnHandle {
  open(): void;
  close(): void;
}

function setupLearnMode(): LearnHandle {
  // The quiz draws single notes with its own Verovio toolkit so the main score's options stay untouched
  const quizToolkit = new VerovioToolkit(verovioModule) as unknown as NotationToolkit;
  const toggle = document.getElementById('learnToggle')!;

  const setLearnOpen = (open: boolean) => {
    document.body.classList.toggle('learn-open', open);
    toggle.classList.toggle('active', open);
    toggle.setAttribute('aria-pressed', String(open));
  };

  const view = new LearnView({
    quiz: new NameTheNoteQuiz(new NoteStats()),
    hub: noteInput,
    renderNote: createNoteCardRenderer(quizToolkit, { scale: 100, pageWidth: 340 }),
    formatLetter: (letter) => formatNoteName(letter, getNoteNameSystem()),
    onClose: () => setLearnOpen(false),
    onExit: () => shell?.navigate(learnReturnView),
    onAnswer: (result) => {
      game.answer(result.correct);
      view.setCombo(gameStore.combo());
      if (result.unlockedStage) game.stage(result.unlockedStage);
    },
    onOpenLessons: () => shell?.navigate('lessons'),
  });
  document.getElementById('musicStand')!.appendChild(view.element);

  // The book button switches between the exercise and the note quiz
  toggle.addEventListener('click', () => {
    shell?.navigate(shell.current() === 'learn' ? learnReturnView : 'learn');
  });

  onLocaleChange(() => view.refresh());
  onNoteNamesChange(() => view.refresh());

  return {
    open: () => {
      setLearnOpen(true);
      view.open();
    },
    close: () => view.close(),
  };
}

/** The browser's offer to install the app is kept from the first moment, because it comes only once, early. */
const installPrompt = new InstallPrompt();

/**
 * Keeps the app in the browser so it opens without internet. Only the production build has a worker to register;
 * the development server must always show the newest files.
 */
function registerServiceWorker(onReady: () => void) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const register = () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(() => navigator.serviceWorker.ready)
      .then(onReady)
      .catch((error) => console.warn('The app could not be saved for offline use:', error));
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

function openOptionsPanel() {
  const panel = document.getElementById('optionsPanel');
  if (panel) panel.hidden = false;
  document.getElementById('optionsToggle')?.setAttribute('aria-expanded', 'true');
}

/** Builds the home and song screens and decides what each screen needs when it opens or closes. */
/** The floating metronome: its panel, the window it lives in, and the link to the exercise tempo. */
function setupMetronomeWindow() {
  const panel = new MetronomePanel({
    store: tempoStore,
    engine: metronomeEngine,
    prepareAudio: () => void Tone.start(),
  });
  const floating = new FloatingWindow({
    content: panel.element,
    title: () => t('metro.title'),
    closeLabel: () => t('metro.close'),
    dragLabel: () => t('metro.drag'),
  });
  metronomePanel = panel;
  metronomeWindow = floating;

  // The window changes the tempo and volume; the exercise follows
  tempoStore.onChange((state, key) => {
    if (key === 'bpm' && state.bpm !== bpm) {
      bpm = state.bpm;
      practiceBaseBpm = bpm;
      const input = document.getElementById('bpm') as HTMLInputElement | null;
      if (input) input.value = String(bpm);
      setBpm(bpm);
      practiceAids?.refresh();
    }
    if (key === 'volume') {
      metronomeVolume = sliderToDb(state.volume);
      const slider = document.getElementById('metronomeVolume') as HTMLInputElement | null;
      if (slider) slider.value = String(state.volume);
    }
  });
  tempoStore.setBpm(bpm); // the exercise tempo is the starting point

  const popout = document.getElementById('metronomePopout');
  popout?.addEventListener('click', () => {
    void Tone.start();
    void floating.toggle();
  });
  floating.onChange((open) => {
    popout?.classList.toggle('active', open);
    popout?.setAttribute('aria-pressed', String(open));
  });
  onLocaleChange(() => {
    panel.refresh();
    floating.refresh();
  });
  onNoteNamesChange(() => panel.refresh());
}

/** What the "Try it" buttons of a lesson do. The metronome button is a click, so it may start audio. */
function openLessonAction(action: LessonAction, appShell: AppShell) {
  switch (action) {
    case 'quiz':
      appShell.navigate('learn');
      break;
    case 'levels':
      appShell.navigate('levels');
      break;
    case 'songs':
      appShell.navigate('songs');
      break;
    case 'xylophone':
      appShell.navigate('xylophone');
      break;
    case 'metronome':
      void Tone.start();
      void metronomeWindow?.open();
      break;
  }
}

function setupNavigation(learn: LearnHandle) {
  setupMetronomeWindow();
  const router = new Router();
  const appShell = new AppShell(router, document, () => window.scrollTo(0, 0));
  shell = appShell;

  const hud = new GameHud(gameStore);
  gameHud = hud;
  const menu = new MainMenu({
    navigate: (view) => appShell.navigate(view),
    extra: hud.element,
    openSettings: openOptionsPanel,
    openMetronome: () => {
      void Tone.start(); // unlock audio now, while the click is fresh
      void metronomeWindow?.open();
    },
    levelLabel: () => localizeLevel(getFullLevelString()),
    lessonsProgress: () => ({ read: lessonProgress.count(), total: lessonProgress.total() }),
    resume: () => {
      if (currentMode === 'practice' && practiceSession) {
        const { currentStep, totalSteps } = practiceSession.getProgress();
        const step = t('practice.stepOf', { current: formatNumber(currentStep), total: formatNumber(totalSteps) });
        return {
          view: 'practice',
          title: practiceTitle(),
          detail: `${step}: ${describeMeasures(practiceSession.getCurrentStep().measures)}`,
        };
      }
      return {
        view: 'levels',
        title: t('control.level', { level: localizeLevel(getFullLevelString()) }),
        detail: describeCurrentLesson(),
      };
    },
  });
  const scoreShelf = {
    has: (songId: string) => scoreStore.has(songId),
    count: () => scoreStore.count(),
    add: (target: ScoreTarget) => pickScoreFile(target),
    practise: (scoreId: string) => void practiseStoredScore(scoreId),
    remove: (scoreId: string) => scoreStore.remove(scoreId),
    onChange: (listener: () => void) => scoreStore.onChange(listener),
  };
  const songs = new SongsView({
    scores: { ...scoreShelf, list: () => scoreStore.list(), persistent: () => scoreStore.persistent() },
    songs: BUILT_IN_SONGS,
    onChoose: (songId) => {
      loadBuiltInSong(songId);
      if (currentMode === 'practice') appShell.navigate('practice');
    },
    onBack: () => appShell.navigate('home'),
    starsFor: (songId) => gameStore.songStars(songId),
    makeSong: () => appShell.navigate('maker'),
    editSong: (scoreId) => appShell.navigate('maker', scoreId),
  });
  gameStore.onChange(() => songs.refresh()); // new stars show on the cards
  const maker = new SongMakerView({
    toolkit: new VerovioToolkit(verovioModule) as unknown as NotationToolkit,
    onBack: () => appShell.navigate('songs'),
    open: async (id) => {
      const stored = await scoreStore.get(id);
      return stored && stored.kind === 'maker' && typeof stored.data === 'string' ? stored.data : null;
    },
    save: async (id, title, xml) => {
      const result = await scoreStore.put({ id, title, kind: 'maker', data: xml });
      if (!result.ok) return result.reason === 'full' ? 'full' : 'failed';
      return scoreStore.persistent() ? 'saved' : 'memory';
    },
    practise: (id) => void practiseStoredScore(id),
    newId: () => newMakerId(),
    formatName: (letter) => formatNoteName(letter, getNoteNameSystem()),
    // the address names the song, so a reload opens it again; no new step for the Back button
    onSaved: (id) => history.replaceState(null, '', `#/maker/${id}`),
  });
  onLocaleChange(() => maker.refresh());
  onNoteNamesChange(() => maker.refresh());
  // Saving and restoring the progress, the settings and the scores: in the options and under the progress
  const backupDeps: BackupPanelDeps = {
    create: () => createBackup(browserStorage, scoreStore),
    restore: (backup) => applyBackup(backup, browserStorage, scoreStore),
    download: downloadTextFile,
    fileName: () => backupFileName(),
    // a moment to read the message; the page then starts again with the restored data
    reload: () => void setTimeout(() => window.location.reload(), 900),
  };
  const optionsBackup = new BackupPanel(backupDeps, true);
  const pwaPanel = new PwaPanel({ prompt: installPrompt });
  document.querySelector('#optionsPanel .options-footer')?.before(pwaPanel.element, optionsBackup.element);
  registerServiceWorker(() => pwaPanel.markOfflineReady());
  const progressBackup = new BackupPanel(backupDeps);
  progressBackup.element.classList.add('pv-backup');
  onLocaleChange(() => {
    optionsBackup.refresh();
    progressBackup.refresh();
    pwaPanel.refresh();
  });
  const progress = new ProgressView({ store: gameStore, onBack: () => appShell.navigate('home'), footer: progressBackup.element });
  // The xylophone draws its staff notes with its own notation engine, so the quiz keeps its settings
  const xylophone = new XylophoneView({
    hub: noteInput,
    sound: new XyloSound(),
    stats: new NoteStats(undefined, 'xyloStats.v1'),
    songs: BUILT_IN_SONGS,
    renderNote: createNoteCardRenderer(new VerovioToolkit(verovioModule) as unknown as NotationToolkit, {
      scale: 90,
      pageWidth: 300,
    }),
    formatName: (name) => formatNoteName(name, getNoteNameSystem()),
    onBack: () => appShell.navigate('home'),
    onReadAnswer: (correct) => game.answer(correct),
    onSongFinished: (songId, stars) => game.xyloSong(songId, stars),
  });
  // the piano the exercises, ear training and scales listen with; it loads on first use
  const pianoVoice = {
    ready: async () => {
      await initAudio();
      return Boolean(sampler?.loaded);
    },
    play: (note: string | number, seconds: number, startsIn: number) =>
      void sampler?.triggerAttackRelease(typeof note === 'number' ? note : soundOf(note), seconds, Tone.now() + 0.05 + startsIn),
    stopAll: () => sampler?.releaseAll(),
  };
  const lessonPlayer = new LessonPlayer(pianoVoice);
  const earStats = new NoteStats(undefined, 'earStats.v1');
  const ear = new EarView({
    stats: earStats,
    voice: { ...pianoVoice, ready: async () => (await Tone.start(), pianoVoice.ready()) },
    hub: noteInput,
    formatName: (note) => formatNoteName(note, getNoteNameSystem()),
    onBack: () => appShell.navigate('home'),
    onAnswer: (correct) => game.earAnswer(correct),
  });
  const scales = new ScalesView({
    toolkit: new VerovioToolkit(verovioModule) as unknown as NotationToolkit,
    voice: { ...pianoVoice, ready: async () => (await Tone.start(), pianoVoice.ready()) },
    hub: noteInput,
    formatName: (note) => formatNoteName(note, getNoteNameSystem()),
    onBack: () => appShell.navigate('home'),
    onPlayed: () => game.scalePlayed(),
  });
  onLocaleChange(() => {
    ear.refresh();
    scales.refresh();
  });
  onNoteNamesChange(() => {
    ear.refresh();
    scales.refresh();
  });
  const lessons = new LessonsView({
    toolkit: new VerovioToolkit(verovioModule) as unknown as NotationToolkit,
    progress: lessonProgress,
    onBack: () => appShell.navigate('home'),
    open: (lessonId) => appShell.navigate('lessons', lessonId),
    onAction: (action) => openLessonAction(action, appShell),
    onRead: (_lessonId, firstTime) => {
      if (firstTime) game.lessonRead(lessonProgress.count(), lessonProgress.total());
    },
    playNote: (note) => {
      void Tone.start();
      lessonPlayer.playNote(note);
    },
    playExample: (spec, onDone) => {
      void Tone.start();
      return lessonPlayer.playExample(spec, onDone);
    },
  });
  onLocaleChange(() => lessons.refresh());
  onNoteNamesChange(() => lessons.refresh());

  const catalog = new CatalogView({
    load: loadCatalog,
    getQuery: () => hashQuery(window.location.hash),
    // the filter lives in the address so it can be shared, but it does not add a step to the Back button
    setQuery: (query) => history.replaceState(null, '', query ? `#/catalog?${query}` : '#/catalog'),
    onBack: () => appShell.navigate('home'),
    playBuiltIn: (songId) => {
      loadBuiltInSong(songId);
      if (currentMode === 'practice') appShell.navigate('practice');
    },
    chooseFile: () => pickScoreFile(),
    scores: scoreShelf,
  });
  onLocaleChange(() => catalog.refresh());
  mainMenu = menu;
  songsView = songs;
  xylophoneView = xylophone;
  progressView = progress;
  document.getElementById('app')!.prepend(menu.element, lessons.element, songs.element, maker.element, ear.element, scales.element, catalog.element, xylophone.element, progress.element);

  document.getElementById('homeButton')!.addEventListener('click', () => appShell.navigate('home'));

  // The score was measured while it was hidden, so draw it again at its real size
  const showStand = () => {
    updateVerovioOptions();
    rerenderCurrentMusic();
  };

  appShell.register(VIEWS, {
    leave: (view) => {
      if (STAND_VIEWS.includes(view) && (isPlaying || isStarting)) stop();
      if (view === 'learn') learn.close();
      if (view === 'xylophone') xylophone.deactivate();
      if (view === 'ear') ear.deactivate();
      if (view === 'scales') scales.deactivate();
      if (view === 'lessons') lessons.stop();
    },
    change: (view, param) => {
      if (view === 'lessons') lessons.show(param);
      if (view === 'maker') void maker.show(param);
    },
    enter: (view, previous, param) => {
      if (STAND_VIEWS.includes(view)) pianoKeyboard?.attach();
      else pianoKeyboard?.detach();

      switch (view) {
        case 'home':
          menu.refresh();
          break;
        case 'lessons':
          lessons.show(param);
          break;
        case 'songs':
          songs.refresh();
          break;
        case 'maker':
          void maker.show(param);
          break;
        case 'catalog':
          void catalog.activate();
          break;
        case 'levels':
          if (currentMode === 'practice') exitPracticeMode();
          showStand();
          break;
        case 'practice':
          if (currentMode !== 'practice') appShell.navigate('songs'); // nothing to practise yet
          else showStand();
          break;
        case 'learn':
          learnReturnView = previous && previous !== 'learn' ? previous : 'home';
          showStand();
          learn.open();
          break;
        case 'xylophone':
          xylophone.activate();
          break;
        case 'ear':
          ear.activate();
          break;
        case 'scales':
          scales.activate();
          break;
        case 'progress':
          progress.refresh();
          break;
      }
    },
  });

  appShell.start();
}

function setupPiano() {
  const dock = document.getElementById('pianoDock')!;
  const toggle = document.getElementById('pianoToggle')!;
  const piano = new OnScreenPiano(noteInput, { ariaLabel: t('piano.label') });
  dock.appendChild(piano.element);

  const refresh = () => {
    piano.setLabelFormatter((name) => formatNoteName(name, getNoteNameSystem()));
    piano.setAriaLabel(t('piano.label'));
    piano.setHints(keyHints(keyboard.getOctave()));
  };
  const keyboard = new ComputerKeyboard(noteInput, document, refresh);
  pianoKeyboard = keyboard;
  keyboard.attach();
  onNoteNamesChange(refresh);
  refresh();

  const setOpen = (open: boolean) => {
    dock.hidden = !open;
    toggle.classList.toggle('active', open);
    toggle.setAttribute('aria-pressed', String(open));
    document.body.classList.toggle('piano-open', open);
    try {
      storageSet('ui.pianoOpen', open ? '1' : '0');
    } catch {
      // storage unavailable
    }
    fitScoreToScreen();
  };
  toggle.addEventListener('click', () => setOpen(dock.hidden));
  setOpen(storageGet('ui.pianoOpen') === '1');
}

// A MIDI keyboard makes its own sound; the on-screen piano and the computer keyboard use the app's piano.
function playUserNote(noteName: string, source: NoteSource) {
  if (source === 'midi' || source === 'xylophone') return;
  if (!sampler) {
    void initAudio();
    return;
  }
  if (sampler.loaded) sampler.triggerAttack(noteName);
}

function stopUserNote(noteName: string, source: NoteSource) {
  if (source === 'midi' || source === 'xylophone' || !sampler || !sampler.loaded) return;
  sampler.triggerRelease(noteName);
}

/**
 * Wait mode: starts a round of the piece that does not move on its own. The notes of the first moment are marked
 * and the piece waits until they are played; there is no count-in and no tempo.
 */
function beginWaiting() {
  isCountingOff = false;
  updateCountoffDisplay(0);
  Tone.getTransport().stop();
  Tone.getTransport().cancel();
  scheduledEvents = [];
  hadMistake = false;
  mistakeCount = 0;
  notesPlayed = 0;
  currentBeatIndex = 0;
  resetVisualHighlighting();
  const session = new WaitSession(timingEvents);
  waitSession = session;
  notesRequired = countWaitNotes(timingEvents);
  if (session.finished()) {
    waitSession = null;
    onPieceComplete();
    return;
  }
  showWaitTarget(true);
}

/** Marks the notes of the moment the piece waits at, plays what the other hand has there, and says what to do. */
function showWaitTarget(first = false) {
  const session = waitSession;
  if (!session) return;
  const index = session.index();
  const event = timingEvents[index];
  const notation = document.getElementById('notation')!;
  notation.querySelectorAll('.note.current, .rest.current').forEach((el) => {
    el.classList.remove('current');
    el.classList.add('past');
  });
  const roundTime = (t: number) => Math.round(t * 1000) / 1000;
  const noteIds = currentNoteIdMapping.timeToIds.get(roundTime(event.time)) || [];
  for (const id of noteIds) document.getElementById(id)?.classList.add('current');

  if (sampler && sampler.loaded) {
    for (const pitch of event.accompaniment ?? []) sampler.triggerAttackRelease(soundOf(pitch), '2n');
  }
  const needed = session.expected();
  if (first && waitHintPending) {
    waitHintPending = false;
    practicePanel?.setStatus(t(needed.length > 1 ? 'practice.wait.chord' : 'practice.wait.hint'), 'hint');
  }
  updateScrollPosition(event.time);
  currentBeatIndex = index + 1; // like a timed round: the moment that is current is currentBeatIndex - 1
  document.dispatchEvent(new CustomEvent('trainer:beat', {
    detail: { beatIndex: index, time: event.time, pitches: event.pitches, noteIds, audioTime: 0, waiting: true },
  }));
}

/** A key was played while the piece waits: right ones move it on, wrong ones are marked and counted. */
function handleWaitPress(playedNote: string) {
  const session = waitSession;
  if (!session) return;
  const press = session.press(playedNote);
  if (press.result === 'ignored') return;

  const notation = document.getElementById('notation')!;
  const current = Array.from(notation.querySelectorAll('.note.current'));
  if (press.result === 'wrong') {
    hadMistake = true;
    mistakeCount++;
    current.filter((el) => !el.classList.contains('correct')).forEach((el) => el.classList.add('wrong'));
    return;
  }

  // a right note: mark the note on the staff that has this pitch, or else the first one not marked yet
  const played = normalizeNote(playedNote);
  const unmarked = current.filter((el) => !el.classList.contains('correct') && !el.classList.contains('rest'));
  const target =
    unmarked.find((el) => {
      const data = el.getAttribute('id') ? toolkit.getElementAttr(el.getAttribute('id')!) : null;
      return data && data.pname && data.oct && String(data.pname).toUpperCase() === played.charAt(0) && String(data.oct) === played.slice(-1);
    }) ?? unmarked[0];
  target?.classList.add('correct');
  target?.classList.remove('wrong');
  notesPlayed++;

  if (press.result === 'advance') {
    showWaitTarget();
  } else if (press.result === 'done') {
    // a moment to see the last note marked, then the same ending as a timed round
    setTimeout(() => {
      if (!isPlaying || waitSession !== session) return;
      waitSession = null;
      onPieceComplete();
    }, 250);
  }
}

/** Starts a round of the piece: waiting at the first note, or counting in and playing in time. */
function beginRound(countoffTotal: number) {
  if (practiceOptions.get().wait && currentMode === 'practice') {
    beginWaiting();
    return;
  }
  Tone.getTransport().bpm.value = bpm; // the tempo may have changed since the last round
  scheduleMusic(countoffTotal);
  Tone.getTransport().start();
}

function checkNoteMatch(playedNote: string) {
  if (!isPlaying || isCountingOff) return;
  if (waitSession) {
    handleWaitPress(playedNote);
    return;
  }

  const notation = document.getElementById('notation')!;
  const normalizedPlayed = normalizeNote(playedNote);

  // Get expected pitches from source data (not from Verovio)
  // currentBeatIndex points to the NEXT beat, so current beat is currentBeatIndex - 1
  const currentBeatIdx = currentBeatIndex - 1;
  const currentTimingEvent = currentBeatIdx >= 0 ? timingEvents[currentBeatIdx] : null;
  const expectedPitches = currentTimingEvent?.pitches ?? [];

  // Check if played note matches any expected pitch
  const matchedAny = expectedPitches.some(p => normalizeNote(p) === normalizedPlayed);

  // Get current note elements
  const currentElements = Array.from(notation.querySelectorAll('.note.current'));

  if (matchedAny && currentElements.length > 0) {
    // Find which element to mark by matching pitch via Verovio's pname/oct
    // We use Verovio for the base pitch (pname) but use source data for accidentals
    for (const el of currentElements) {
      if (el.classList.contains('correct')) continue;

      const id = el.getAttribute('id');
      if (!id) continue;

      const elemData = toolkit.getElementAttr(id);
      if (!elemData || !elemData.pname || !elemData.oct) continue;

      // Get base note from Verovio (e.g., 'g', '4')
      const basePitch = (elemData.pname as string).toUpperCase();
      const octave = elemData.oct;

      // Check if played note matches this element's base pitch
      // The played note is already normalized (e.g., 'G#4')
      // We need to check if the base letter and octave match
      const playedBase = normalizedPlayed.charAt(0);
      const playedOctave = normalizedPlayed.slice(-1);

      if (basePitch === playedBase && octave === playedOctave) {
        el.classList.add('correct');
        el.classList.remove('wrong');
        notesPlayed++; // Track that user played this note correctly
        break; // Only mark one element per played note
      }
    }
  }

  // Also check upcoming notes (be forgiving of early plays)
  let matchedUpcoming = false;
  if (!matchedAny && currentBeatIndex < timingEvents.length) {
    const upcomingEvent = timingEvents[currentBeatIndex];
    const upcomingMatched = upcomingEvent.pitches.some(p => normalizeNote(p) === normalizedPlayed);

    if (upcomingMatched) {
      // Find the upcoming note elements using our embedded ID mapping
      const roundTime = (t: number) => Math.round(t * 1000) / 1000;
      const upcomingNoteIds = currentNoteIdMapping.timeToIds.get(roundTime(upcomingEvent.time)) || [];

      for (const noteId of upcomingNoteIds) {
        const el = document.getElementById(noteId);
        if (!el || !el.classList.contains('note')) continue;

        const elemData = toolkit.getElementAttr(noteId);
        if (!elemData || !elemData.pname || !elemData.oct) continue;

        const basePitch = (elemData.pname as string).toUpperCase();
        const octave = elemData.oct;
        const playedBase = normalizedPlayed.charAt(0);
        const playedOctave = normalizedPlayed.slice(-1);

        if (basePitch === playedBase && octave === playedOctave) {
          el.setAttribute('data-early-correct', 'true');
          matchedUpcoming = true;
          break;
        }
      }
    }
  }

  if (!matchedAny && !matchedUpcoming && currentElements.length > 0) {
    const unmarked = currentElements.filter((el) => !el.classList.contains('correct'));
    if (unmarked.length > 0) {
      hadMistake = true;
      mistakeCount++;
      unmarked.forEach((el) => el.classList.add('wrong'));
    }
  }
}

function setupControls() {
  const playPauseBtn = document.getElementById('playPause')!;
  const bpmInput = document.getElementById('bpm') as HTMLInputElement;
  const metronomeCheckbox = document.getElementById(
    'metronome'
  ) as HTMLInputElement;
  const midiSelect = document.getElementById('midiInput') as HTMLSelectElement;
  const levelUpBtn = document.getElementById('levelUp');
  const levelDownBtn = document.getElementById('levelDown');

  // Options panel toggle
  const optionsToggle = document.getElementById('optionsToggle');
  const optionsPanel = document.getElementById('optionsPanel');
  const optionsClose = document.getElementById('optionsClose');

  if (optionsToggle && optionsPanel) {
    optionsToggle.addEventListener('click', () => {
      const isHidden = optionsPanel.hidden;
      optionsPanel.hidden = !isHidden;
      optionsToggle.setAttribute('aria-expanded', String(!isHidden));
    });

    if (optionsClose) {
      optionsClose.addEventListener('click', () => {
        optionsPanel.hidden = true;
        optionsToggle.setAttribute('aria-expanded', 'false');
      });
    }

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (
        !optionsPanel.hidden &&
        !optionsPanel.contains(e.target as Node) &&
        !optionsToggle.contains(e.target as Node)
      ) {
        optionsPanel.hidden = true;
        optionsToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  bpmInput.addEventListener('change', () => {
    setExerciseBpm(bpmInput.value); // also shows the tempo that is actually used
    setBpm(bpm); // Sync with musicGenerator's tempo tracking
  });

  metronomeCheckbox.addEventListener('change', () => {
    metronomeEnabled = metronomeCheckbox.checked;
    tempoStore.setEnabled(metronomeEnabled);
    // Sync the toolbar button state
    const metronomeBtn = document.getElementById('metronomeToggle');
    if (metronomeBtn) {
      metronomeBtn.classList.toggle('active', metronomeCheckbox.checked);
      metronomeBtn.setAttribute('aria-pressed', String(metronomeCheckbox.checked));
    }
  });

  // Metronome toggle button in control bar
  const metronomeToggle = document.getElementById('metronomeToggle');
  if (metronomeToggle) {
    metronomeToggle.addEventListener('click', () => {
      const isActive = metronomeToggle.classList.toggle('active');
      metronomeToggle.setAttribute('aria-pressed', String(isActive));
      metronomeEnabled = isActive;
      tempoStore.setEnabled(isActive);
      // Sync the options panel checkbox
      if (metronomeCheckbox) {
        metronomeCheckbox.checked = isActive;
      }
    });
  }

  const metronomeVolumeSlider = document.getElementById(
    'metronomeVolume'
  ) as HTMLInputElement;
  if (metronomeVolumeSlider) {
    metronomeVolumeSlider.addEventListener('input', () => {
      // Slider is 0-100, map to -40dB to 0dB
      const sliderValue = parseInt(metronomeVolumeSlider.value);
      metronomeVolume = sliderToDb(sliderValue);
      tempoStore.setVolume(sliderValue);
    });
  }

  // Master volume slider - controls Tone.js destination volume
  const masterVolumeSlider = document.getElementById(
    'masterVolume'
  ) as HTMLInputElement;
  if (masterVolumeSlider) {
    // Set initial value to match default
    masterVolumeSlider.value = '80';
    masterVolumeSlider.addEventListener('input', () => {
      // Slider is 0-100, map to -60dB to 0dB (0 = mute, 100 = full)
      const sliderValue = parseInt(masterVolumeSlider.value);
      masterVolume = sliderToDb(sliderValue, true);
      // Apply to Tone.js destination
      Tone.getDestination().volume.value = masterVolume;
    });
  }

  // Level jump selector
  const levelJumpSelect = document.getElementById('levelJump') as HTMLSelectElement;
  if (levelJumpSelect) {
    levelJumpSelect.addEventListener('change', () => {
      const newLevel = parseInt(levelJumpSelect.value);
      if (newLevel >= 1) {
        if (isPlaying) stop();
        // Exit practice mode if we're in it
        if (currentMode === 'practice') {
          exitPracticeMode();
        }
        setLevel(newLevel);
        setSubLevel(0);
        generateAndRender();
        updateLevelDisplay();
      }
    });
  }

  // Key override selector
  const keySelect = document.getElementById('keySelect') as HTMLSelectElement;
  if (keySelect) {
    keySelect.addEventListener('change', () => {
      if (isPlaying) stop();
      const selectedKey = keySelect.value || null;
      setKeyOverride(selectedKey);
      generateAndRender();
    });
  }

  const showFingeringCheckbox = document.getElementById(
    'showFingering'
  ) as HTMLInputElement;
  if (showFingeringCheckbox) {
    showFingeringCheckbox.addEventListener('change', () => {
      setIncludeFingering(showFingeringCheckbox.checked);
      // Sync the toolbar button state
      const fingeringBtn = document.getElementById('fingeringToggle');
      if (fingeringBtn) {
        fingeringBtn.classList.toggle('active', showFingeringCheckbox.checked);
        fingeringBtn.setAttribute('aria-pressed', String(showFingeringCheckbox.checked));
      }
      // Re-render current music with fingering (don't regenerate new music)
      regenerateCurrentMusicXML();
      rerenderCurrentMusic();
    });
  }

  // Fingering toggle button in control bar
  const fingeringToggle = document.getElementById('fingeringToggle');
  if (fingeringToggle) {
    fingeringToggle.addEventListener('click', () => {
      const isActive = fingeringToggle.classList.toggle('active');
      fingeringToggle.setAttribute('aria-pressed', String(isActive));
      setIncludeFingering(isActive);
      // Sync the options panel checkbox
      if (showFingeringCheckbox) {
        showFingeringCheckbox.checked = isActive;
      }
      // Re-render current music with fingering (don't regenerate new music)
      regenerateCurrentMusicXML();
      rerenderCurrentMusic();
    });
  }

  midiSelect.addEventListener('change', () => {
    selectedMidiInput = midiSelect.value || null;
    if (selectedMidiInput) {
      storageSet('midiDeviceId', selectedMidiInput);
    } else {
      storageRemove('midiDeviceId');
    }
  });

  // File upload handlers (both in control bar and options panel)
  const xmlUpload = document.getElementById('xmlUpload') as HTMLInputElement;
  const xmlUploadOptions = document.getElementById('xmlUploadOptions') as HTMLInputElement;

  const handleUpload = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      if (isPlaying) stop();
      handleFileUpload(file);
      // Clear the input so the same file can be uploaded again
      input.value = '';
    }
  };

  xmlUpload?.addEventListener('change', handleUpload);
  xmlUploadOptions?.addEventListener('change', handleUpload);

  // Exit practice mode button
  const exitPracticeModeBtn = document.getElementById('exitPracticeMode');
  exitPracticeModeBtn?.addEventListener('click', () => {
    if (isPlaying) stop();
    exitPracticeMode();
  });

  // Practice progress bar drag
  setupPracticePanel();

  // Click celebration overlay to dismiss
  const celebrationOverlay = document.getElementById('celebrationOverlay');
  celebrationOverlay?.addEventListener('click', () => {
    hideCelebration();
  });

  // Built-in song selector
  const songSelect = document.getElementById('songSelect') as HTMLSelectElement;
  songSelect?.addEventListener('change', () => {
    const songId = songSelect.value;
    if (songId) {
      if (isPlaying) stop();
      loadBuiltInSong(songId);
      // Reset the dropdown after loading
      songSelect.value = '';
    }
  });

  levelUpBtn?.addEventListener('click', () => {
    if (currentMode === 'practice' && practiceSession) {
      // Practice mode: advance to next step
      if (isPlaying) stop();
      if (practiceSession.nextStep()) {
        renderPracticeStep();
      }
    } else {
      // Level mode: If tempo mastery achieved, increase tempo instead of level
      if (shouldIncreaseTempo()) {
        increaseTempo();
        const newBpm = getCurrentBpm();
        setExerciseBpm(newBpm);
        updateLevelDisplay();
      } else {
        if (isPlaying) stop();
        incrementLevel();
        generateAndRender();
        updateLevelDisplay();
      }
    }
  });

  levelDownBtn?.addEventListener('click', () => {
    if (currentMode === 'practice' && practiceSession) {
      // Practice mode: go to previous step
      if (isPlaying) stop();
      if (practiceSession.previousStep()) {
        renderPracticeStep();
      }
    } else {
      // Level mode
      const current = getLevel();
      if (current > 1) {
        if (isPlaying) stop();
        setLevel(current - 1);
        generateAndRender();
        updateLevelDisplay();
      }
    }
  });

  playPauseBtn.addEventListener('click', async () => {
    if (isPlaying || isStarting) {
      stop();
    } else {
      await start();
    }
  });

  // Spacebar to toggle play/pause, except where Space already means something (buttons, fields) or
  // while another screen such as Learn is open
  document.addEventListener('keydown', async (e) => {
    if (e.code !== 'Space' || e.repeat) return;
    if (isSpaceReserved(e.target) || !['levels', 'practice'].includes(document.body.dataset.view ?? '')) return;
    e.preventDefault();
    if (isPlaying || isStarting) {
      stop();
    } else {
      await start();
    }
  });

  // Language, digits and note-name selectors
  const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement;
  const persianDigitsInput = document.getElementById('persianDigits') as HTMLInputElement;
  const persianDigitsRow = document.getElementById('persianDigitsRow') as HTMLElement;
  const noteSystemSelect = document.getElementById('noteNameSystem') as HTMLSelectElement;

  persianDigitsInput.checked = storageGet('ui.persianDigits') !== '0';

  const syncLanguageControls = () => {
    languageSelect.value = getLocale();
    persianDigitsRow.hidden = getLocale() !== 'fa';
    noteSystemSelect.value = getNoteNameSystem();
  };

  languageSelect.addEventListener('change', () => {
    if (isLocale(languageSelect.value)) setLocale(languageSelect.value);
  });
  persianDigitsInput.addEventListener('change', () => setPersianDigits(persianDigitsInput.checked));
  noteSystemSelect.addEventListener('change', () => {
    if (isNoteNameSystem(noteSystemSelect.value)) setNoteNameSystem(noteSystemSelect.value);
  });

  const refreshTexts = () => {
    applyTranslations();
    mainMenu?.refresh();
    songsView?.refresh();
    xylophoneView?.refresh();
    practicePanel?.refresh();
    practiceAids?.refresh();
    gameHud?.refresh();
    progressView?.refresh();
    populateLevelJump();
    populateKeySelect();
    populateSongSelect();
    // Practice
    const scoreTitle = document.querySelector('.score-title h1');
    if (currentMode === 'levels') {
      if (scoreTitle) scoreTitle.textContent = t('app.title');
      updateLevelDisplay();
    } else if (practiceSession) {
      if (scoreTitle) scoreTitle.textContent = practiceTitle();
      const lessonInfo = document.getElementById('lessonInfo');
      if (lessonInfo) lessonInfo.textContent = practiceKeyLine();
    }
    syncLanguageControls();
    refreshNoteLabels();
  };

  const showNoteNamesInput = document.getElementById('showNoteNames') as HTMLInputElement;
  showNoteNamesInput.checked = showNoteNames;
  showNoteNamesInput.addEventListener('change', () => {
    showNoteNames = showNoteNamesInput.checked;
    try {
      storageSet('ui.showNoteNames', showNoteNames ? '1' : '0');
    } catch {
      // storage unavailable
    }
    refreshNoteLabels();
  });

  onLocaleChange(refreshTexts);
  onNoteNamesChange(refreshTexts);
  refreshTexts();
}

/** Number of notes the player has to play in the current piece (rests have no pitches). */
function countRequiredNotes(): number {
  return timingEvents.reduce((sum, evt) => sum + evt.pitches.length, 0);
}

/** Bumped by every start and by stop(), so a start that is still waiting for the sounds can be cancelled. */
let startToken = 0;
let isStarting = false;

function setStarting(starting: boolean) {
  isStarting = starting;
  const playPauseBtn = document.getElementById('playPause');
  playPauseBtn?.setAttribute('aria-busy', String(starting));
  playPauseBtn?.classList.toggle('loading', starting);
}

async function start() {
  const token = ++startToken;
  setStarting(true);
  await initAudio();
  if (token !== startToken) return; // Stop was pressed while the sounds were loading
  setStarting(false);

  isPlaying = true;
  metronomeEngine.stop(); // the exercise has its own metronome
  metronomePanel?.setExerciseRunning(true);
  const playPauseBtn = document.getElementById('playPause')!;
  playPauseBtn.classList.add('playing');
  playPauseBtn.setAttribute('aria-label', t('control.stop'));

  currentBeatIndex = 0;
  hadMistake = false;
  mistakeCount = 0;
  notesPlayed = 0;
  notesRequired = countRequiredNotes();

  // Fully reset Tone.js Transport before scheduling
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  scheduledEvents = [];

  // Force position reset - must happen after stop/cancel
  transport.position = 0;
  transport.bpm.value = bpm;

  // Reset debounce timers
  lastMetronomeTime = 0;
  lastAdvanceBeatTime = 0;

  const countoffTotal = countInBeats(currentTimeSig);
  isCountingOff = true;
  countoffBeats = 0;
  // Don't show initial number - it will appear on first beat

  waitHintPending = true;
  beginRound(countoffTotal);
}

function scheduleMusic(countoffTotal: number) {
  // Use timing events from music generator (source of truth for all timing)
  const events = timingEvents;

  // Calculate total duration of the piece
  let totalDuration = 0;
  if (events.length > 0) {
    const lastEvent = events[events.length - 1];
    totalDuration = lastEvent.time + lastEvent.duration;
  }

  const totalBeats = countoffTotal + totalDuration;
  const totalSubdivisions = Math.ceil(totalBeats * 4);

  // Schedule all metronome clicks and countoff updates using bars:beats:sixteenths
  // (safe for metronome since it's always on integer subdivisions)
  for (let sub = 0; sub < totalSubdivisions; sub++) {
    const beatNumber = Math.floor(sub / 4);
    const subInBeat = sub % 4;
    const time = `0:${beatNumber}:${subInBeat}`;

    const eventId = Tone.getTransport().schedule((time) => {
      playMetronomeClick(subInBeat, time);
      if (subInBeat === 0) {
        metronomePanel?.pulse(beatNumber % countInBeats(currentTimeSig), countInBeats(currentTimeSig));
      }

      // Handle countoff display updates
      // Show 4, 3, 2, 1 on each beat (beatNumber 0, 1, 2, 3)
      if (subInBeat === 0 && beatNumber < countoffTotal) {
        const displayNumber = countoffTotal - beatNumber;
        updateCountoffDisplay(displayNumber);
        countoffBeats = beatNumber + 1;
        if (countoffBeats >= countoffTotal) {
          isCountingOff = false;
          // Hide after a short delay so "1" is visible
          setTimeout(() => updateCountoffDisplay(0), 200);
        }
      }
    }, time);
    scheduledEvents.push(eventId);
  }

  // Schedule note events using timing from music generator
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const timeInBeats = countoffTotal + event.time;
    const timeInSeconds = beatsToSeconds(timeInBeats, bpm);

    // Schedule the note/rest to become current
    const noteEventId = Tone.getTransport().schedule((time) => {
      advanceBeat(time);
    }, timeInSeconds);
    scheduledEvents.push(noteEventId);
  }

  // Schedule end of piece using seconds
  const endTimeInSeconds = beatsToSeconds(countoffTotal + totalDuration, bpm);
  const endEventId = Tone.getTransport().schedule(() => {
    onPieceComplete();
  }, endTimeInSeconds);
  scheduledEvents.push(endEventId);
}

/**
 * Reset visual highlighting on notes (clear current/past/correct/wrong classes).
 */
function resetVisualHighlighting() {
  const notation = document.getElementById('notation')!;
  notation.querySelectorAll('.note, .rest').forEach((el) => {
    el.classList.remove('current', 'past', 'correct', 'wrong');
    el.removeAttribute('data-early-correct');
  });
}

function onPieceComplete() {
  if (!isPlaying) return;

  // Mark last notes as past
  const notation = document.getElementById('notation')!;
  notation.querySelectorAll('.note.current, .rest.current').forEach((el) => {
    el.classList.remove('current');
    el.classList.add('past');
  });

  // Handle differently based on mode
  if (currentMode === 'practice' && practiceSession) {
    // Reset visual highlighting
    resetVisualHighlighting();

    // Reset transport
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    scheduledEvents = [];
    Tone.getTransport().seconds = 0;
    lastMetronomeTime = 0;
    lastAdvanceBeatTime = 0;

    // Auto-advance only if the segment was played (see didPassPiece), not merely allowed to run out
    if (didPassPiece({ hadMistake, notesPlayed, notesRequired })) {
      // A clean pass: the step is mastered (and pays once, even when it is repeated)
      practiceSession.markMastered();
      if (!stepAwarded) {
        game.stepPassed();
        stepAwarded = true;
      }
      practiceAttempt = 1;
      mistakeCount = 0;
      const options = practiceOptions.get();
      const faster = options.ladder ? nextLadderBpm(bpm, practiceBaseBpm) : bpm;
      if (faster !== bpm) setExerciseBpm(faster, true);

      if (options.loop) {
        // repeat this step instead of moving on
        updatePracticeDisplay();
        practicePanel?.setStatus(faster !== bpm || options.ladder ? t('practice.status.faster', { bpm: formatNumber(bpm) }) : t('practice.status.loop'), 'good');
        hadMistake = false;
        notesPlayed = 0;
        notesRequired = countRequiredNotes();
        currentBeatIndex = 0;
        isCountingOff = true;
        countoffBeats = 0;
        beginRound(countInBeats(currentTimeSig));
        return;
      }
      const hasMore = practiceSession.nextStep();

      if (hasMore) {
        renderPracticeStep();
        practicePanel?.setStatus(
          t('practice.status.passed', { next: describeMeasures(practiceSession.getCurrentStep().measures) }),
          'good'
        );

        // Save progress
        savePracticeState();

        // Continue playing with countoff for new segment
        hadMistake = false;
        notesPlayed = 0;
        // Recalculate required notes for the new segment
        notesRequired = countRequiredNotes();
        currentBeatIndex = 0;
        isCountingOff = true;
        countoffBeats = 0;
        beginRound(countInBeats(currentTimeSig));
      } else {
        // Practice complete - show celebration!
        stop();
        updatePracticeDisplay();
        practicePanel?.setStatus(t('practice.status.finished'), 'good');
        const finishedId = currentPracticeSongId ?? currentScoreId;
        if (finishedId) {
          game.songFinished(finishedId, practiceStars(practiceSession.getAllSteps().length, practiceRetries));
        }
        showCelebration();
        const progressInfo = document.getElementById('progressInfo');
        if (progressInfo) {
          progressInfo.textContent = t('progress.complete');
        }
      }
    } else {
      // Had mistakes or didn't play enough - loop the current segment
      // Give countoff for 4+ bars to help re-orient
      practiceAttempt++;
      practiceRetries++;
      updatePracticeDisplay();
      practicePanel?.setStatus(retryMessage(mistakeCount, Math.max(0, notesRequired - notesPlayed)), 'retry');
      hadMistake = false;
      mistakeCount = 0;
      notesPlayed = 0; // Reset for retry
      currentBeatIndex = 0;
      const needsCountoff = currentMeasureCount >= 4;
      isCountingOff = needsCountoff;
      countoffBeats = 0;
      beginRound(needsCountoff ? countInBeats(currentTimeSig) : 0);
    }
  } else {
    // Level mode: the piece must have been played, not merely allowed to run to the end
    if (didPassPiece({ hadMistake, notesPlayed, notesRequired })) {
      incrementLevel();
      game.levelPassed(getLevel());
    }

    // Reset tracking for next round
    hadMistake = false;
    currentBeatIndex = 0;

    // Generate new piece
    generateAndRender();
    notesPlayed = 0;
    notesRequired = countRequiredNotes();

    // Fully reset Tone.js Transport before scheduling new piece
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    scheduledEvents = [];
    // Use seconds property for more reliable reset
    Tone.getTransport().seconds = 0;

    // Reset debounce timers to allow first events of new piece
    lastMetronomeTime = 0;
    lastAdvanceBeatTime = 0;

    isCountingOff = true;
    countoffBeats = 0;
    const countoffTotal = countInBeats(currentTimeSig);
    // Don't show initial number - it will appear on first beat

    scheduleMusic(countoffTotal);
    Tone.getTransport().start();
  }
}

function updateCountoffDisplay(remaining: number) {
  const countoffEl = document.getElementById('countoff')!;
  if (remaining > 0) {
    countoffEl.textContent = String(remaining);
    countoffEl.classList.add('visible');
  } else {
    countoffEl.textContent = '';
    countoffEl.classList.remove('visible');
  }
}

function stop() {
  startToken++;
  setStarting(false);
  isPlaying = false;
  waitSession = null;
  metronomePanel?.setExerciseRunning(false);
  isCountingOff = false;
  const playPauseBtn = document.getElementById('playPause')!;
  playPauseBtn.classList.remove('playing');
  playPauseBtn.setAttribute('aria-label', t('control.start'));

  updateCountoffDisplay(0);

  Tone.getTransport().stop();
  Tone.getTransport().cancel();
  scheduledEvents = [];
  Tone.getTransport().seconds = 0;

  // Reset metronome debounce
  lastMetronomeTime = 0;

  const notation = document.getElementById('notation')!;
  notation.querySelectorAll('.note, .rest').forEach((el) => {
    el.classList.remove('current', 'correct', 'wrong', 'past');
  });
}

// Track last beat advance time to prevent double-firing
let lastAdvanceBeatTime = 0;

/** `time` is the audio time Tone.js passes to the Transport callback. */
function advanceBeat(time: number) {
  // Debounce to prevent double-firing from Tone.js lookahead
  const now = performance.now();
  if (now - lastAdvanceBeatTime < 50) {
    return;
  }
  lastAdvanceBeatTime = now;

  const notation = document.getElementById('notation')!;

  // Mark previous notes as past
  notation.querySelectorAll('.note.current, .rest.current').forEach((el) => {
    el.classList.remove('current');
    el.classList.add('past');
  });

  if (currentBeatIndex >= timingEvents.length) {
    return; // onPieceComplete handles the end
  }

  const timingEvent = timingEvents[currentBeatIndex];

  // Look up note IDs from the mapping built when generating MusicXML
  // This uses embedded xml:id attributes, which is more reliable than position-based or time-based lookups
  const roundTime = (t: number) => Math.round(t * 1000) / 1000;
  const noteIds = currentNoteIdMapping.timeToIds.get(roundTime(timingEvent.time)) || [];

  // Highlight notes from our embedded ID mapping
  for (const noteId of noteIds) {
    const noteEl = document.getElementById(noteId);
    if (noteEl) {
      noteEl.classList.add('current');

      // Check if this note was played early
      if (noteEl.getAttribute('data-early-correct') === 'true') {
        noteEl.classList.add('correct');
        noteEl.removeAttribute('data-early-correct');
      }
    }
  }

  // For tie continuations, check if user is still holding the tied notes
  // If so, auto-mark as correct (they held through the tie)
  // But still play any NEW pitches at this time (e.g., LH new attack while RH is tied)
  const tiedPitches = timingEvent.tiedPitches || [];

  if (tiedPitches.length > 0) {
    // Check if all TIED pitches are currently held
    const allTiedHeld = tiedPitches.every(pitch => {
      const normalized = normalizeNote(pitch);
      // Check if any active note matches (account for enharmonic equivalents)
      return Array.from(activeNotes).some(active => normalizeNote(active) === normalized);
    });

    if (allTiedHeld) {
      // Mark all current note elements as correct
      for (const noteId of noteIds) {
        const noteEl = document.getElementById(noteId);
        if (noteEl && !noteEl.classList.contains('correct')) {
          noteEl.classList.add('correct');
          notesPlayed++; // Track that user held this note correctly
        }
      }
    }
  }

  // Play pitches from source data (timingEvents), NOT from Verovio SVG
  // But skip tied pitches - they're still ringing from the previous attack
  const allPitches = timingEvent?.pitches ?? [];
  // the notes to play, and (when one hand is practised) the other hand's notes, played by the app
  const pitchesToPlay = [...allPitches.filter(p => !tiedPitches.includes(p)), ...(timingEvent?.accompaniment ?? [])];

  if (sampler && sampler.loaded && pitchesToPlay.length > 0) {
    for (const pitch of pitchesToPlay) {
      sampler.triggerAttackRelease(soundOf(pitch), '2n', time);
    }
  }

  // Update scroll position if in scrolling mode
  updateScrollPosition(timingEvent.time);

  // Test hook (see CLAUDE.md): lets the end-to-end tests see which notes were played and highlighted
  document.dispatchEvent(new CustomEvent('trainer:beat', {
    detail: { beatIndex: currentBeatIndex, time: timingEvent.time, pitches: allPitches, noteIds, audioTime: time },
  }));

  currentBeatIndex++;
}

// ============================================
// SCROLLING FOR CONSOLIDATION MODE
// ============================================

/**
 * Calculate which measure we're currently in based on beat time.
 * Returns 0-indexed measure number.
 */
function getMeasureFromTime(time: number): number {
  return Math.floor(time / beatsPerMeasure(currentTimeSig));
}

/**
 * Set up scrolling mode for consolidation steps.
 * Enables vertical scrolling through the piece, showing one system at a time.
 */
function setupScrollingMode() {
  const notation = document.getElementById('notation');
  if (!notation) return;

  const svg = notation.querySelector('svg') as SVGSVGElement | null;
  if (!svg) return;

  // Get the SVG's intrinsic dimensions
  const widthAttr = svg.getAttribute('width');
  const heightAttr = svg.getAttribute('height');
  if (widthAttr && heightAttr) {
    const intrinsicWidth = parseInt(widthAttr, 10);
    const intrinsicHeight = parseInt(heightAttr, 10);

    // Add viewBox for proper scaling
    if (!svg.getAttribute('viewBox')) {
      svg.setAttribute('viewBox', `0 0 ${intrinsicWidth} ${intrinsicHeight}`);
    }

    // Calculate the scaled height based on container width
    const containerWidth = notation.clientWidth;
    const scaledHeight = (containerWidth / intrinsicWidth) * intrinsicHeight;

    // Set explicit height on SVG so it overflows the container (enabling scroll)
    svg.style.height = `${scaledHeight}px`;
  }

  // Add scrolling container class
  notation.classList.add('scrolling-mode');
  isScrollingMode = true;
  currentScrollMeasure = 0;

  // Initial scroll position - show from the top
  scrollToMeasure(0, false);
}

/**
 * Exit scrolling mode and reset scroll position.
 */
function exitScrollingMode() {
  const notation = document.getElementById('notation');
  if (!notation) return;

  notation.classList.remove('scrolling-mode');
  notation.scrollTop = 0;
  isScrollingMode = false;
  currentScrollMeasure = 0;
}

/**
 * Scroll to show a specific measure.
 * Scrolls vertically so the system containing the measure is visible.
 * @param measureIndex - 0-indexed measure to scroll to
 * @param smooth - Whether to animate the scroll
 */
function scrollToMeasure(measureIndex: number, smooth = true) {
  if (!isScrollingMode) return;

  const notation = document.getElementById('notation');
  const svg = notation?.querySelector('svg') as SVGSVGElement | null;
  if (!notation || !svg) return;

  // Find all measure elements in the SVG
  const measures = svg.querySelectorAll('.measure');
  if (measures.length === 0) return;

  // Clamp measure index
  const targetMeasure = Math.min(Math.max(0, measureIndex), measures.length - 1);

  // Don't scroll if we're on the same measure (unless initial)
  if (targetMeasure === currentScrollMeasure && smooth) return;
  currentScrollMeasure = targetMeasure;

  // Get the target measure element
  const targetEl = measures[targetMeasure] as SVGGElement;
  if (!targetEl) return;

  // Get the measure's bounding rect relative to the notation container
  const measureRect = targetEl.getBoundingClientRect();
  const notationRect = notation.getBoundingClientRect();

  // Calculate where we need to scroll to show this measure
  // We want the measure to be near the top of the visible area with some padding
  const padding = 20; // pixels from top
  const targetScrollTop = notation.scrollTop + (measureRect.top - notationRect.top) - padding;

  // Scroll smoothly
  notation.scrollTo({
    top: Math.max(0, targetScrollTop),
    behavior: smooth ? 'smooth' : 'instant',
  });
}

/**
 * Update scroll position based on current playback time.
 * Called from advanceBeat when in scrolling mode.
 */
function updateScrollPosition(time: number) {
  if (!isScrollingMode) return;

  const currentMeasure = getMeasureFromTime(time);

  // Scroll when we move to a new measure
  if (currentMeasure !== currentScrollMeasure) {
    scrollToMeasure(currentMeasure);
  }
}

// ============================================
// PRACTICE MODE (UPLOADED FILES)
// ============================================

/** A library song the student attaches a file to. */
interface ScoreTarget {
  id: string;
  title: string;
  artist?: string;
}

/**
 * Opens a file picker of its own, so a cancelled choice leaves nothing behind, and practises the chosen
 * file. With a target the file is kept under that library song; without one it is kept under its own id.
 */
function pickScoreFile(target?: ScoreTarget) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xml,.musicxml,.mxl,.mid,.midi';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    if (isPlaying) stop();
    void handleFileUpload(file, target);
  });
  input.click();
}

/**
 * Reads a MusicXML, MXL or MIDI file, keeps it in the student's scores and starts practising it.
 */
async function handleFileUpload(file: File, target?: ScoreTarget) {
  try {
    const score = await readScoreFile(file);
    const id = target?.id ?? scoreIdForData(score.data);
    const title = target?.title ?? score.title;
    const saved = await scoreStore.put({ id, title, artist: target?.artist, kind: score.kind, data: score.data });
    if (!saved.ok) showNotice(t(saved.reason === 'full' ? 'scores.full' : 'scores.notSaved'), 8000);
    else if (!scoreStore.persistent()) showNotice(t('scores.memoryOnly'), 8000);
    startScore(score.parsed, { scoreId: saved.ok ? id : null, title });
  } catch (error) {
    console.error('Error parsing file:', error);
    showNotice(t('error.parse', { type: isMidiFile(file.name) ? 'MIDI' : 'MusicXML or MXL' }), 8000);
  }
}

/** Practises a score that was kept earlier. */
async function practiseStoredScore(scoreId: string) {
  const stored = await scoreStore.get(scoreId);
  if (!stored) {
    showNotice(t('scores.notFound'), 6000);
    return;
  }
  try {
    const parsed = parseStoredScore(stored);
    if (isPlaying) stop();
    startScore(parsed, { scoreId, title: stored.title });
  } catch (error) {
    console.error('Error reading a stored score:', error);
    showNotice(t('error.parse', { type: stored.kind === 'midi' ? 'MIDI' : 'MusicXML or MXL' }), 8000);
  }
}

/** Starts the step-by-step practice of a score the student supplied. */
function startScore(parsed: ParsedMusicXML, meta: { scoreId: string | null; title: string }) {
  practiceSession = new ProgressivePracticeSession(parsed);
  currentMode = 'practice';
  currentPracticeSongId = null; // not a built-in song
  currentScoreId = meta.scoreId;
  currentScoreTitle = meta.title;
  setExerciseBpm(60);
  enterPracticeMode();
  renderPracticeStep();
  savePracticeState();
  // from the library or the song list the music stand opens; the exercise screens are already there
  const view = shell?.current();
  if (shell && view !== 'practice' && view !== 'levels') shell.navigate('practice');
}

/**
 * Load a built-in song by ID and enter practice mode.
 */
function loadBuiltInSong(songId: string) {
  const song = getSongById(songId);
  if (!song) {
    console.error('Song not found:', songId);
    return;
  }

  try {
    const parsed = parseMusicXML(song.xml);

    if (parsed.measures.length === 0) {
      console.error('No measures found in song:', songId);
      return;
    }

    // Create practice session
    practiceSession = new ProgressivePracticeSession(parsed);
    currentMode = 'practice';
    currentPracticeSongId = songId; // Track which song for persistence
    currentScoreId = null;
    currentScoreTitle = null;

    // Set appropriate BPM based on difficulty
    const difficultyBpm = {
      beginner: 60,
      easy: 70,
      intermediate: 80,
    };
    setExerciseBpm(difficultyBpm[song.difficulty] || 60);

    // Update UI for practice mode
    enterPracticeMode();

    // Render first step
    renderPracticeStep();

    // Save practice state
    savePracticeState();

    // Close options panel if open
    const optionsPanel = document.getElementById('optionsPanel');
    if (optionsPanel && !optionsPanel.hidden) {
      optionsPanel.hidden = true;
      const optionsToggle = document.getElementById('optionsToggle');
      optionsToggle?.setAttribute('aria-expanded', 'false');
    }
  } catch (error) {
    console.error('Error loading song:', error);
  }
}

/**
 * Enter practice mode UI.
 */
/** The piece's name in the current language (built-in songs are translated; uploads keep their own title). */
function practiceTitle(): string {
  const song = currentPracticeSongId ? getSongById(currentPracticeSongId) : undefined;
  return song ? songTitle(song) : currentScoreTitle ?? practiceSession?.getTitle() ?? '';
}

/** "G major" in the chosen note-name system and language. */
function practiceKeyLine(): string {
  const name = practiceSession?.getKeySignature().name ?? '';
  const match = /^([A-G][#b]?) major$/.exec(name);
  return match ? formatKeyName(match[1]) : name;
}

function enterPracticeMode() {
  if (!practiceSession) return;
  practiceAttempt = 1;
  practiceRetries = 0;
  mistakeCount = 0;
  document.body.classList.add('practice-mode');

  // Update header
  const scoreTitle = document.querySelector('.score-title h1');
  if (scoreTitle) {
    scoreTitle.textContent = practiceTitle();
  }

  // Show practice info bar
  const practiceInfo = document.getElementById('practiceInfo');
  if (practiceInfo) practiceInfo.hidden = false;

  // Hide level-specific UI
  const levelDisplay = document.getElementById('levelDisplay');
  const progressInfo = document.getElementById('progressInfo');
  const lessonInfo = document.getElementById('lessonInfo');
  if (levelDisplay) levelDisplay.style.display = 'none';
  if (progressInfo) progressInfo.style.display = 'none';
  if (lessonInfo) lessonInfo.textContent = practiceKeyLine();

  // Hide level controls in control bar
  const levelSection = document.querySelector('.control-section.level');
  if (levelSection) (levelSection as HTMLElement).style.display = 'none';

  // Show exit button in options
  const exitBtn = document.getElementById('exitPracticeMode');
  if (exitBtn) exitBtn.hidden = false;

  // Update practice info display
  updatePracticeDisplay();

  if (shell?.current() === 'levels') shell.navigate('practice');
}

/**
 * Exit practice mode and return to levels.
 */
function exitPracticeMode() {
  document.body.classList.remove('practice-mode');
  currentMode = 'levels';
  practiceSession = null;
  currentPracticeSongId = null;
  currentScoreId = null;
  currentScoreTitle = null;

  // Clear saved practice state
  clearPracticeState();

  // Restore header
  const scoreTitle = document.querySelector('.score-title h1');
  if (scoreTitle) {
    scoreTitle.textContent = t('app.title');
  }

  // Hide practice info bar
  const practiceInfo = document.getElementById('practiceInfo');
  if (practiceInfo) practiceInfo.hidden = true;

  // Show level-specific UI
  const levelDisplay = document.getElementById('levelDisplay');
  const progressInfo = document.getElementById('progressInfo');
  if (levelDisplay) levelDisplay.style.display = '';
  if (progressInfo) progressInfo.style.display = '';

  // Show level controls
  const levelSection = document.querySelector('.control-section.level');
  if (levelSection) (levelSection as HTMLElement).style.display = '';

  // Hide exit button
  const exitBtn = document.getElementById('exitPracticeMode');
  if (exitBtn) exitBtn.hidden = true;

  // Generate fresh level content
  generateAndRender();

  if (shell?.current() === 'practice') shell.navigate('levels');
}

/**
 * Update the practice step panel: which step, the measure map, the attempt count.
 */
function updatePracticeDisplay() {
  if (!practiceSession) return;
  practicePanel?.update({
    steps: practiceSession.getAllSteps(),
    currentIndex: practiceSession.getCurrentStepIndex(),
    measureCount: practiceSession.getMeasureCount(),
    attempt: practiceAttempt,
    title: practiceTitle(),
    subtitle: practiceKeyLine(),
  });
}

/** Moves to another practice step (from the map or the step buttons). */
function jumpToPracticeStep(index: number) {
  if (!practiceSession) return;
  if (isPlaying) stop();
  if (!practiceSession.goToStep(index)) return;
  practiceAttempt = 1;
  mistakeCount = 0;
  renderPracticeStep();
  savePracticeState();
}

function setupPracticePanel() {
  const panel = new PracticePanel({
    onJump: jumpToPracticeStep,
    onPrevious: () => practiceSession && jumpToPracticeStep(practiceSession.getCurrentStepIndex() - 1),
    onNext: () => practiceSession && jumpToPracticeStep(practiceSession.getCurrentStepIndex() + 1),
  });
  practicePanel = panel;
  const info = document.getElementById('practiceInfo')!;
  info.appendChild(panel.element);
  const aids = new PracticeAids({
    options: practiceOptions,
    baseBpm: () => practiceBaseBpm,
    currentBpm: () => bpm,
    setBpm: (value) => setExerciseBpm(value, true),
  });
  practiceAids = aids;
  panel.addTool(aids.opener);
  info.appendChild(aids.element);
  aids.setHandsAvailable(
    currentRightHandNotes.some((n) => !n.isRest),
    currentLeftHandNotes.some((n) => !n.isRest),
  );
  // a change of hand or of wait mode starts the step again: what is playing was set up for the old choice
  let lastOptions = practiceOptions.get();
  practiceOptions.onChange(() => {
    const next = practiceOptions.get();
    const changed = next.hand !== lastOptions.hand || next.wait !== lastOptions.wait;
    lastOptions = next;
    if (!changed || currentMode !== 'practice') return;
    if (isPlaying) stop();
    if (practiceSession) renderPracticeStep();
  });
  updatePracticeDisplay(); // a session restored at start-up was set up before the panel existed

  // The panel, the piano and the control bar take room from the score; refit it whenever one of them changes size
  if (typeof ResizeObserver !== 'undefined') {
    const refit = new ResizeObserver(() => fitScoreToScreen());
    for (const el of [info, document.getElementById('pianoDock'), document.getElementById('controlBar')]) {
      if (el) refit.observe(el);
    }
  }
}

/**
 * Render the current practice step.
 */
function renderPracticeStep() {
  if (!practiceSession) return;

  // Exit any previous scrolling mode
  exitScrollingMode();

  const step = practiceSession.getCurrentStep();
  const segment = practiceSession.getCurrentSegment();
  const timeSig = practiceSession.getTimeSignature();
  const keySig = practiceSession.getKeySignature();

  // Update current notes and measure count
  currentRightHandNotes = segment.rightHand;
  currentLeftHandNotes = segment.leftHand;
  stepAwarded = false;
  practiceAids?.setHandsAvailable(
    segment.rightHand.some((n) => !n.isRest),
    segment.leftHand.some((n) => !n.isRest),
  );
  currentTimeSig = timeSig;
  currentMeasureCount = step.measures.length;

  // Check if this is a consolidation step with many measures - enable scrolling
  const shouldScroll = step.type === 'consolidate' && step.measures.length > 4;

  // Build MusicXML for this segment
  // For scrolling mode: break every 2 measures for better readability
  // Otherwise: break every 4 measures for pieces with more than 4 measures
  const result = buildMusicXML(
    segment.rightHand,
    segment.leftHand,
    {
      timeSignature: timeSig,
      key: keySig,
      systemBreakEvery: shouldScroll ? 2 : (currentMeasureCount > 4 ? 4 : 0),
    }
  );
  currentPieceXml = result.xml;
  currentNoteIdMapping = result.noteIdMapping;

  // Update Verovio options based on measure count (for line breaks)
  updateVerovioOptions(shouldScroll);

  // Render
  renderCurrentMusic();
  updatePracticeDisplay();

  // Set up scrolling mode for consolidation steps with many measures
  if (shouldScroll) {
    // Use requestAnimationFrame to ensure SVG is rendered first
    requestAnimationFrame(() => {
      setupScrollingMode();
    });
  }
}

// ============================================
// CELEBRATION
// ============================================

/**
 * Show the celebration overlay with sparkles.
 */
function showCelebration() {
  const overlay = document.getElementById('celebrationOverlay');
  if (!overlay) return;

  // Add dynamic sparkles
  const sparkles = overlay.querySelector('.celebration-sparkles');
  if (sparkles) {
    // Clear any existing particles
    sparkles.querySelectorAll('.particle').forEach(p => p.remove());

    // Add random sparkle particles
    for (let i = 0; i < 12; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.cssText = `
        top: ${Math.random() * 100}%;
        left: ${Math.random() * 100}%;
        animation-delay: ${Math.random() * 1.5}s;
        background: ${Math.random() > 0.5 ? 'var(--current)' : 'var(--accent-light)'};
      `;
      sparkles.appendChild(particle);
    }
  }

  overlay.hidden = false;

  // Auto-hide after a few seconds
  setTimeout(() => {
    hideCelebration();
  }, 3000);
}

/**
 * Hide the celebration overlay.
 */
function hideCelebration() {
  const overlay = document.getElementById('celebrationOverlay');
  if (overlay) {
    overlay.hidden = true;
  }
}

// ============================================
// PRACTICE STATE PERSISTENCE
// ============================================

const PRACTICE_STATE_KEY = 'practiceState';
const PRACTICE_MUSIC_KEY = 'practiceMusic';

interface PracticeStateData {
  /** `upload` is what older versions saved; the music itself was kept in `practiceMusic`. */
  type: 'song' | 'score' | 'upload';
  songId?: string;
  scoreId?: string;
  stepIndex: number;
  bpm: number;
}

/**
 * Save current practice state to localStorage.
 */
function savePracticeState() {
  if (!practiceSession || currentMode !== 'practice' || (!currentPracticeSongId && !currentScoreId)) {
    storageRemove(PRACTICE_STATE_KEY);
    return;
  }

  const state: PracticeStateData = {
    type: currentPracticeSongId ? 'song' : 'score',
    songId: currentPracticeSongId || undefined,
    scoreId: currentScoreId || undefined,
    stepIndex: practiceSession.getCurrentStepIndex(),
    bpm: bpm,
  };

  storageSet(PRACTICE_STATE_KEY, JSON.stringify(state));
}

/**
 * Load saved practice state on startup.
 */
async function loadPracticeState(): Promise<boolean> {
  const stateJson = storageGet(PRACTICE_STATE_KEY);
  if (!stateJson) return false;

  try {
    const state: PracticeStateData = JSON.parse(stateJson);

    if (state.type === 'song' && state.songId) {
      // Load built-in song
      const song = getSongById(state.songId);
      if (!song) return false;

      const parsed = parseMusicXML(song.xml);
      if (parsed.measures.length === 0) return false;

      practiceSession = new ProgressivePracticeSession(parsed);
      currentPracticeSongId = state.songId;
      currentScoreId = null;
      currentScoreTitle = null;
    } else if (state.type === 'score' && state.scoreId) {
      // The student's own score, kept in the browser
      const stored = await scoreStore.get(state.scoreId);
      if (!stored) return false;

      const parsed = parseStoredScore(stored);
      practiceSession = new ProgressivePracticeSession(parsed);
      currentPracticeSongId = null;
      currentScoreId = state.scoreId;
      currentScoreTitle = stored.title;
    } else if (state.type === 'upload') {
      // Load cached uploaded music
      const cachedXml = storageGet(PRACTICE_MUSIC_KEY);
      if (!cachedXml) return false;

      const parsed = parseMusicXML(cachedXml);
      if (parsed.measures.length === 0) return false;

      practiceSession = new ProgressivePracticeSession(parsed);
      currentPracticeSongId = null;
      currentScoreId = null;
      currentScoreTitle = null;
    } else {
      return false;
    }

    // Restore step position
    practiceSession.goToStep(state.stepIndex);

    // Restore BPM
    setExerciseBpm(state.bpm);

    // Enter practice mode
    currentMode = 'practice';
    enterPracticeMode();
    renderPracticeStep();

    return true;
  } catch (e) {
    console.error('Error loading practice state:', e);
    storageRemove(PRACTICE_STATE_KEY);
    return false;
  }
}

/**
 * Clear saved practice state.
 */
function clearPracticeState() {
  storageRemove(PRACTICE_STATE_KEY);
  storageRemove(PRACTICE_MUSIC_KEY);
}

// Track current song ID for persistence
let currentPracticeSongId: string | null = null;


// Start the app
init().catch(console.error);
