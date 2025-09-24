import { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { AudioMetadata } from '../utils/audioFormats';
import { midiNoteToString, parseFilename } from '../utils/audio';
import type { Notification } from '../components/common/NotificationSystem';
import { cookieUtils, COOKIE_KEYS } from '../utils/cookies';
import type { FilenameSeparator } from '../utils/constants';
import { loadDrumDefaultSettings, loadMultisampleDefaultSettings, loadDrumImportedPreset, loadMultisampleImportedPreset } from '../utils/defaultSettings';
import { applyZeroCrossingToMarkers } from '../utils/audio';

// Define enhanced types for the application state
export interface DrumSample {
  file: File | null;
  audioBuffer: AudioBuffer | null;
  name: string;
  isLoaded: boolean;
  inPoint: number;
  outPoint: number;
  // WAV metadata from header parsing
  originalBitDepth?: number;
  originalSampleRate?: number;
  originalChannels?: number;
  fileSize?: number;
  duration?: number;
  isFloat?: boolean; // Whether sample is 32-bit float format
  // Sample settings
  playmode: 'oneshot' | 'group' | 'loop' | 'gate';
  reverse: boolean;
  transpose: number; // -48 to +48 semitones
  pan: number; // -100 to +100
  gain: number; // -30 to +20 dB
  
  // Editing status
  hasBeenEdited: boolean;
  
  // Assignment status - for unassigned samples beyond the 24 drum keys
  isAssigned: boolean; // true if assigned to a drum key (0-23), false if unassigned
  assignedKey?: number; // the drum key index this sample is assigned to (0-23)
}

export interface MultisampleFile {
  file: File | null;
  audioBuffer: AudioBuffer | null;
  name: string;
  isLoaded: boolean;
  rootNote: number;
  note?: string; // Detected or assigned note (e.g., "C4", "F#3")
  inPoint: number;
  outPoint: number;
  loopStart: number;
  loopEnd: number;
  // WAV metadata from header parsing
  originalBitDepth?: number;
  originalSampleRate?: number;
  originalChannels?: number;
  fileSize?: number;
  duration?: number;
  isFloat?: boolean; // Whether sample is 32-bit float format
}

export interface AppState {
  // Current tab
  currentTab: 'drum' | 'multisample' | 'feedback' | 'library' | 'donate';
  
  // Drum tool settings
  drumSettings: {
    sampleRate: number;
    bitDepth: number;
    channels: number;
    presetName: string;
    normalize: boolean;
    normalizeLevel: number; // -6.0 to 0.0 dB
    autoZeroCrossing: boolean; // Enable automatic zero-crossing detection
    renameFiles: boolean; // Whether to rename files with preset name
    filenameSeparator: FilenameSeparator; // Separator for filename parts
    audioFormat: 'wav' | 'aiff'; // Audio export format
    presetSettings: {
      playmode: 'poly' | 'mono' | 'legato';
      transpose: number; // -36 to +36
      velocity: number; // 0-100%
      volume: number; // 0-100%
      width: number; // 0-100%
    };
  };
  
  // Multisample tool settings
  multisampleSettings: {
    sampleRate: number;
    bitDepth: number;
    channels: number;
    presetName: string;
    normalize: boolean;
    normalizeLevel: number; // -6.0 to 0.0 dB
    autoZeroCrossing: boolean; // Enable automatic zero-crossing detection
    cutAtLoopEnd: boolean;
    gain: number; // -30 to +20 dB
    loopEnabled: boolean;
    loopOnRelease: boolean;
    renameFiles: boolean; // Whether to rename files with preset name
    filenameSeparator: FilenameSeparator; // Separator for filename parts
    audioFormat: 'wav' | 'aiff'; // Audio export format
    // Advanced settings
    playmode: 'poly' | 'mono' | 'legato';
    transpose: number; // -36 to +36
    velocitySensitivity: number; // 0-100%
    volume: number; // 0-100%
    width: number; // 0-100%
    highpass: number; // 0-100%
    portamentoType: 'linear' | 'exponential';
    portamentoAmount: number; // 0-100%
    tuningRoot: number; // 0-11 (C to B)
    ampEnvelope: {
      attack: number; // 0-32767
      decay: number; // 0-32767
      sustain: number; // 0-32767
      release: number; // 0-32767
    };
    filterEnvelope: {
      attack: number; // 0-32767
      decay: number; // 0-32767
      sustain: number; // 0-32767
      release: number; // 0-32767
    };
  };
  
  // Drum samples (24 samples for full OP-XY compatibility)
  drumSamples: DrumSample[];
  
  // Multisample files
  multisampleFiles: MultisampleFile[];
  selectedMultisample: number | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  isDrumKeyboardPinned: boolean;
  isMultisampleKeyboardPinned: boolean;
  
  // Notifications
  notifications: Notification[];
  
  // Imported preset settings (for patch generation)
  importedDrumPreset: any | null;
  importedMultisamplePreset: any | null;
  
  // Session management
  isSessionRestorationModalOpen: boolean;
  sessionInfo: { timestamp: number; drumSamplesCount: number; multisampleFilesCount: number } | null;
  
  // MIDI note mapping convention
  midiNoteMapping: 'C3' | 'C4';
}

// Define enhanced action types
export type AppAction = 
  | { type: 'SET_TAB'; payload: 'drum' | 'multisample' | 'feedback' | 'library' | 'donate' }
  | { type: 'SET_DRUM_SAMPLE_RATE'; payload: number }
  | { type: 'SET_DRUM_BIT_DEPTH'; payload: number }
  | { type: 'SET_DRUM_CHANNELS'; payload: number }
  | { type: 'SET_DRUM_PRESET_NAME'; payload: string }
  | { type: 'SET_DRUM_NORMALIZE'; payload: boolean }
  | { type: 'SET_DRUM_NORMALIZE_LEVEL'; payload: number }
  | { type: 'SET_DRUM_AUTO_ZERO_CROSSING'; payload: boolean }
  | { type: 'SET_DRUM_RENAME_FILES'; payload: boolean }
  | { type: 'SET_DRUM_FILENAME_SEPARATOR'; payload: FilenameSeparator }
  | { type: 'SET_DRUM_AUDIO_FORMAT'; payload: 'wav' | 'aiff' }
  | { type: 'SET_DRUM_PRESET_PLAYMODE'; payload: 'poly' | 'mono' | 'legato' }
  | { type: 'SET_DRUM_PRESET_TRANSPOSE'; payload: number }
  | { type: 'SET_DRUM_PRESET_VELOCITY'; payload: number }
  | { type: 'SET_DRUM_PRESET_VOLUME'; payload: number }
  | { type: 'SET_DRUM_PRESET_WIDTH'; payload: number }
  | { type: 'SET_MULTISAMPLE_SAMPLE_RATE'; payload: number }
  | { type: 'SET_MULTISAMPLE_BIT_DEPTH'; payload: number }
  | { type: 'SET_MULTISAMPLE_CHANNELS'; payload: number }
  | { type: 'SET_MULTISAMPLE_PRESET_NAME'; payload: string }
  | { type: 'SET_MULTISAMPLE_NORMALIZE'; payload: boolean }
  | { type: 'SET_MULTISAMPLE_NORMALIZE_LEVEL'; payload: number }
  | { type: 'SET_MULTISAMPLE_AUTO_ZERO_CROSSING'; payload: boolean }
  | { type: 'SET_MULTISAMPLE_RENAME_FILES'; payload: boolean }
  | { type: 'SET_MULTISAMPLE_FILENAME_SEPARATOR'; payload: FilenameSeparator }
  | { type: 'SET_MULTISAMPLE_AUDIO_FORMAT'; payload: 'wav' | 'aiff' }
  | { type: 'SET_MULTISAMPLE_CUT_AT_LOOP_END'; payload: boolean }
  | { type: 'SET_MULTISAMPLE_GAIN'; payload: number }
  | { type: 'SET_MULTISAMPLE_LOOP_ENABLED'; payload: boolean }
  | { type: 'SET_MULTISAMPLE_LOOP_ON_RELEASE'; payload: boolean }
  | { type: 'SET_MULTISAMPLE_PLAYMODE'; payload: 'poly' | 'mono' | 'legato' }
  | { type: 'SET_MULTISAMPLE_TRANSPOSE'; payload: number }
  | { type: 'SET_MULTISAMPLE_VELOCITY_SENSITIVITY'; payload: number }
  | { type: 'SET_MULTISAMPLE_VOLUME'; payload: number }
  | { type: 'SET_MULTISAMPLE_WIDTH'; payload: number }
  | { type: 'SET_MULTISAMPLE_HIGHPASS'; payload: number }
  | { type: 'SET_MULTISAMPLE_PORTAMENTO_TYPE'; payload: 'linear' | 'exponential' }
  | { type: 'SET_MULTISAMPLE_PORTAMENTO_AMOUNT'; payload: number }
  | { type: 'SET_MULTISAMPLE_TUNING_ROOT'; payload: number }
  | { type: 'SET_MULTISAMPLE_AMP_ENVELOPE'; payload: { attack: number; decay: number; sustain: number; release: number } }
  | { type: 'SET_MULTISAMPLE_FILTER_ENVELOPE'; payload: { attack: number; decay: number; sustain: number; release: number } }
  | { type: 'APPLY_ZERO_CROSSING_TO_DRUM_SAMPLE'; payload: number }
  | { type: 'APPLY_ZERO_CROSSING_TO_MULTISAMPLE_FILE'; payload: number }
  | { type: 'APPLY_ZERO_CROSSING_TO_ALL_DRUM_SAMPLES' }
  | { type: 'APPLY_ZERO_CROSSING_TO_ALL_MULTISAMPLE_FILES' }
  | { type: 'LOAD_DRUM_SAMPLE'; payload: { index: number; file: File; audioBuffer: AudioBuffer; metadata: AudioMetadata } }
  | { type: 'CLEAR_DRUM_SAMPLE'; payload: number }
  | { type: 'UPDATE_DRUM_SAMPLE'; payload: { index: number; updates: Partial<DrumSample> } }
  | { type: 'REORDER_DRUM_SAMPLES'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'SWAP_DRUM_SAMPLES'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'ADD_UNASSIGNED_DRUM_SAMPLE'; payload: { file: File; audioBuffer: AudioBuffer; metadata: AudioMetadata } }
  | { type: 'ASSIGN_DRUM_SAMPLE'; payload: { sampleIndex: number; targetKeyIndex: number } }
  | { type: 'UNASSIGN_DRUM_SAMPLE'; payload: number }
  | { type: 'IMPORT_OP1_DRUM_PRESET'; payload: { samples: Array<{ keyIndex: number; file: File; audioBuffer: AudioBuffer; metadata: AudioMetadata; name: string }>; presetName: string } }
  | { type: 'LOAD_MULTISAMPLE_FILE'; payload: { file: File; audioBuffer: AudioBuffer | null; metadata: AudioMetadata; rootNoteOverride?: number; } }
  | { type: 'CLEAR_MULTISAMPLE_FILE'; payload: number }
  | { type: 'UPDATE_MULTISAMPLE_FILE'; payload: { index: number; updates: Partial<MultisampleFile> } }
  | { type: 'REORDER_MULTISAMPLE_FILES'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'SET_SELECTED_MULTISAMPLE'; payload: number | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'SET_IMPORTED_DRUM_PRESET'; payload: any | null }
  | { type: 'SET_IMPORTED_MULTISAMPLE_PRESET'; payload: any | null }
  | { type: 'TOGGLE_DRUM_KEYBOARD_PIN' }
  | { type: 'TOGGLE_MULTISAMPLE_KEYBOARD_PIN' }
  | { type: 'RESTORE_SESSION'; payload: { drumSettings: AppState['drumSettings']; multisampleSettings: AppState['multisampleSettings']; drumSamples: Array<{ originalIndex: number; isAssigned: boolean; assignedKey?: number; file: File; audioBuffer: AudioBuffer; name: string; isLoaded: boolean; inPoint: number; outPoint: number; playmode: 'oneshot' | 'group' | 'loop' | 'gate'; reverse: boolean; transpose: number; pan: number; gain: number; hasBeenEdited: boolean; originalBitDepth: number; originalSampleRate: number; originalChannels: number; fileSize: number; duration: number; isFloat?: boolean }>; multisampleFiles: MultisampleFile[]; selectedMultisample: number | null; isDrumKeyboardPinned: boolean; isMultisampleKeyboardPinned: boolean } }
  | { type: 'SET_SESSION_RESTORATION_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_SESSION_INFO'; payload: { timestamp: number; drumSamplesCount: number; multisampleFilesCount: number } | null }
  | { type: 'SET_MIDI_NOTE_MAPPING'; payload: 'C3' | 'C4' }
  | { type: 'UPDATE_ALL_MULTI_SAMPLES'; payload: Partial<MultisampleFile> }
  | { type: 'UPDATE_ALL_DRUM_SAMPLES'; payload: Partial<DrumSample> }
  | { type: 'CLEAR_ALL_DRUM_SAMPLES' };

// Initial state for drum samples
const initialDrumSample: DrumSample = {
  file: null,
  audioBuffer: null,
  name: '',
  isLoaded: false,
  inPoint: 0,
  outPoint: 0,
  playmode: 'oneshot',
  reverse: false,
      transpose: 0,
  pan: 0,
  gain: 0,
  hasBeenEdited: false,
  isAssigned: false, // Default to unassigned - will be set appropriately based on context
  assignedKey: undefined
};

// Helper function to create a drum sample with proper assignment state
const createDrumSample = (index: number, isAssigned: boolean = false): DrumSample => ({
  ...initialDrumSample,
  isAssigned,
  assignedKey: isAssigned ? index : undefined
});

const initialMultisampleFile: MultisampleFile = {
  file: null,
  audioBuffer: null,
  name: '',
  isLoaded: false,
  rootNote: 60, // Middle C
  inPoint: 0,
  outPoint: 0,
  loopStart: 0,
  loopEnd: 0,
  // Metadata fields with default values
  originalBitDepth: 16,
  originalSampleRate: 44100,
  originalChannels: 2,
  fileSize: 0,
  duration: 0,
  isFloat: false
};

// Function to get initial tab from cookie
const getInitialTab = (): 'drum' | 'multisample' | 'feedback' | 'library' | 'donate' => {
  try {
    const savedTab = cookieUtils.getCookie(COOKIE_KEYS.LAST_TAB);
    if (savedTab === 'multisample') return 'multisample';
    if (savedTab === 'feedback') return 'feedback';
    if (savedTab === 'library') return 'library';
    if (savedTab === 'donate') return 'donate';
    return 'drum';
  } catch (error) {
    console.warn('Failed to load saved tab from cookie, defaulting to drum tab:', error);
    return 'drum';
  }
};

// Function to get initial pin state from cookie
const getInitialPinState = (key: string): boolean => {
  try {
    const savedPinState = cookieUtils.getCookie(key);
    return savedPinState === 'true';
  } catch (error) {
    console.warn(`Failed to load pin state from cookie for key: ${key}`, error);
    return false;
  }
}

// Function to get initial MIDI note mapping from cookie
const getInitialMidiMapping = (): 'C3' | 'C4' => {
  try {
    const savedMapping = cookieUtils.getCookie(COOKIE_KEYS.MIDI_NOTE_MAPPING);
    return savedMapping === 'C4' ? 'C4' : 'C3';
  } catch (error) {
    console.warn('Failed to load MIDI note mapping from cookie, defaulting to C3', error);
    return 'C3';
  }
}

const initialState: AppState = {
  currentTab: getInitialTab(),
  drumSettings: loadDrumDefaultSettings(),
  multisampleSettings: loadMultisampleDefaultSettings(),
  drumSamples: Array.from({ length: 24 }, (_, index) => createDrumSample(index, true)), // First 24 slots are assigned to their respective keys
  multisampleFiles: [], // Dynamic array, 1-24 samples max
  selectedMultisample: null,
  isLoading: false,
  error: null,
  isDrumKeyboardPinned: getInitialPinState(COOKIE_KEYS.DRUM_KEYBOARD_PINNED),
  isMultisampleKeyboardPinned: getInitialPinState(COOKIE_KEYS.MULTISAMPLE_KEYBOARD_PINNED),
  notifications: [],
  importedDrumPreset: loadDrumImportedPreset(),
  importedMultisamplePreset: loadMultisampleImportedPreset(),
  isSessionRestorationModalOpen: false,
  sessionInfo: null,
  midiNoteMapping: getInitialMidiMapping()
};

// Enhanced reducer function
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_TAB':
      // Save tab to cookie for persistence
      try {
        cookieUtils.setCookie(COOKIE_KEYS.LAST_TAB, action.payload, 30);
      } catch (error) {
        console.warn('Failed to save tab to cookie:', error);
      }
      return { ...state, currentTab: action.payload };
      
    case 'SET_DRUM_SAMPLE_RATE':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, sampleRate: action.payload }
      };
      
    case 'SET_DRUM_BIT_DEPTH':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, bitDepth: action.payload }
      };
      
    case 'SET_DRUM_CHANNELS':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, channels: action.payload }
      };
      
    case 'SET_DRUM_PRESET_NAME':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, presetName: action.payload }
      };
      
    case 'SET_DRUM_NORMALIZE':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, normalize: action.payload }
      };
      
    case 'SET_DRUM_NORMALIZE_LEVEL':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, normalizeLevel: action.payload }
      };
      
    case 'SET_DRUM_AUTO_ZERO_CROSSING':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, autoZeroCrossing: action.payload }
      };
      
    case 'SET_DRUM_RENAME_FILES':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, renameFiles: action.payload }
      };
      
    case 'SET_DRUM_FILENAME_SEPARATOR':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, filenameSeparator: action.payload }
      };
      
    case 'SET_DRUM_AUDIO_FORMAT':
      return { 
        ...state, 
        drumSettings: { ...state.drumSettings, audioFormat: action.payload }
      };
      
    case 'SET_DRUM_PRESET_PLAYMODE':
      return { 
        ...state, 
        drumSettings: { 
          ...state.drumSettings, 
          presetSettings: { ...state.drumSettings.presetSettings, playmode: action.payload }
        }
      };
      
    case 'SET_DRUM_PRESET_TRANSPOSE':
      return { 
        ...state, 
        drumSettings: { 
          ...state.drumSettings, 
          presetSettings: { ...state.drumSettings.presetSettings, transpose: action.payload }
        }
      };
      
    case 'SET_DRUM_PRESET_VELOCITY':
      return { 
        ...state, 
        drumSettings: { 
          ...state.drumSettings, 
          presetSettings: { ...state.drumSettings.presetSettings, velocity: action.payload }
        }
      };
      
    case 'SET_DRUM_PRESET_VOLUME':
      return { 
        ...state, 
        drumSettings: { 
          ...state.drumSettings, 
          presetSettings: { ...state.drumSettings.presetSettings, volume: action.payload }
        }
      };
      
    case 'SET_DRUM_PRESET_WIDTH':
      return { 
        ...state, 
        drumSettings: { 
          ...state.drumSettings, 
          presetSettings: { ...state.drumSettings.presetSettings, width: action.payload }
        }
      };
      
    case 'SET_MULTISAMPLE_SAMPLE_RATE':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, sampleRate: action.payload }
      };
      
    case 'SET_MULTISAMPLE_BIT_DEPTH':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, bitDepth: action.payload }
      };
      
    case 'SET_MULTISAMPLE_CHANNELS':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, channels: action.payload }
      };
      
    case 'SET_MULTISAMPLE_PRESET_NAME':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, presetName: action.payload }
      };
      
    case 'SET_MULTISAMPLE_NORMALIZE':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, normalize: action.payload }
      };
      
    case 'SET_MULTISAMPLE_NORMALIZE_LEVEL':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, normalizeLevel: action.payload }
      };
      
    case 'SET_MULTISAMPLE_AUTO_ZERO_CROSSING':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, autoZeroCrossing: action.payload }
      };
      
    case 'SET_MULTISAMPLE_RENAME_FILES':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, renameFiles: action.payload }
      };
      
    case 'SET_MULTISAMPLE_FILENAME_SEPARATOR':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, filenameSeparator: action.payload }
      };
      
    case 'SET_MULTISAMPLE_AUDIO_FORMAT':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, audioFormat: action.payload }
      };
      
    case 'SET_MULTISAMPLE_CUT_AT_LOOP_END':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, cutAtLoopEnd: action.payload }
      };
      
    case 'SET_MULTISAMPLE_GAIN':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, gain: action.payload }
      };
      
    case 'SET_MULTISAMPLE_LOOP_ENABLED':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, loopEnabled: action.payload }
      };
      
    case 'SET_MULTISAMPLE_LOOP_ON_RELEASE':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, loopOnRelease: action.payload }
      };
      
    case 'SET_MULTISAMPLE_PLAYMODE':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          playmode: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_TRANSPOSE':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          transpose: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_VELOCITY_SENSITIVITY':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          velocitySensitivity: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_VOLUME':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          volume: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_WIDTH':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          width: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_HIGHPASS':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          highpass: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_PORTAMENTO_TYPE':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          portamentoType: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_PORTAMENTO_AMOUNT':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          portamentoAmount: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_TUNING_ROOT':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          tuningRoot: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_AMP_ENVELOPE':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          ampEnvelope: action.payload
        }
      };
      
    case 'SET_MULTISAMPLE_FILTER_ENVELOPE':
      return { 
        ...state, 
        multisampleSettings: { 
          ...state.multisampleSettings, 
          filterEnvelope: action.payload
        }
      };
      
    case 'APPLY_ZERO_CROSSING_TO_DRUM_SAMPLE': {
      const sampleIndex = action.payload;
      const updatedDrumSamples = [...state.drumSamples];
      const sampleToApply = updatedDrumSamples[sampleIndex];

      if (!sampleToApply?.isLoaded) {
        console.error('Cannot apply zero-crossing to unloaded sample');
        return state;
      }

      // Calculate initial marker positions
      const initialInPoint = 0;
      const initialOutPoint = sampleToApply.audioBuffer!.duration;
      
      // Apply zero-crossing detection if enabled
      let finalInPoint = initialInPoint;
      let finalOutPoint = initialOutPoint;
      
      if (state.drumSettings.autoZeroCrossing) {
        const result = applyZeroCrossingToMarkers(
          sampleToApply.audioBuffer!,
          initialInPoint,
          initialOutPoint
        );
        finalInPoint = result.inPoint;
        finalOutPoint = result.outPoint;
        

      }
      
      updatedDrumSamples[sampleIndex] = {
        ...sampleToApply,
        inPoint: finalInPoint,
        outPoint: finalOutPoint,
        hasBeenEdited: true
      };
      
      return { ...state, drumSamples: updatedDrumSamples };
    }

    case 'APPLY_ZERO_CROSSING_TO_MULTISAMPLE_FILE': {
      const fileIndex = action.payload;
      const updatedMultisampleFiles = [...state.multisampleFiles];
      const fileToApply = updatedMultisampleFiles[fileIndex];

      if (!fileToApply?.isLoaded) {
        console.error('Cannot apply zero-crossing to unloaded multisample file');
        return state;
      }

      // Calculate initial marker positions
      const initialInPoint = 0;
      const initialOutPoint = fileToApply.audioBuffer!.duration;
      const initialLoopStart = fileToApply.loopStart;
      const initialLoopEnd = fileToApply.loopEnd;
      
      // Apply zero-crossing detection if enabled
      let finalInPoint = initialInPoint;
      let finalOutPoint = initialOutPoint;
      let finalLoopStart = initialLoopStart;
      let finalLoopEnd = initialLoopEnd;
      
      if (state.multisampleSettings.autoZeroCrossing && fileToApply.audioBuffer) {
        const result = applyZeroCrossingToMarkers(
          fileToApply.audioBuffer,
          initialInPoint,
          initialOutPoint,
          initialLoopStart,
          initialLoopEnd
        );
        finalInPoint = result.inPoint;
        finalOutPoint = result.outPoint;
        finalLoopStart = result.loopStart || initialLoopStart;
        finalLoopEnd = result.loopEnd || initialLoopEnd;
        

      }
      
             updatedMultisampleFiles[fileIndex] = {
         ...fileToApply,
         inPoint: finalInPoint,
         outPoint: finalOutPoint,
         loopStart: finalLoopStart,
         loopEnd: finalLoopEnd
       };
      
      return { ...state, multisampleFiles: updatedMultisampleFiles };
    }

    case 'APPLY_ZERO_CROSSING_TO_ALL_DRUM_SAMPLES': {
      const updatedDrumSamples = state.drumSamples.map((sample) => {
        if (!sample.isLoaded || !sample.audioBuffer) return sample;
        const initialInPoint = 0;
        const initialOutPoint = sample.audioBuffer.duration;
        const result = applyZeroCrossingToMarkers(
          sample.audioBuffer,
          initialInPoint,
          initialOutPoint
        );
        return {
          ...sample,
          inPoint: result.inPoint,
          outPoint: result.outPoint,
          hasBeenEdited: true
        };
      });
      return { ...state, drumSamples: updatedDrumSamples };
    }
    case 'APPLY_ZERO_CROSSING_TO_ALL_MULTISAMPLE_FILES': {
      const updatedMultisampleFiles = state.multisampleFiles.map((file) => {
        if (!file.isLoaded || !file.audioBuffer) return file;
        const initialInPoint = 0;
        const initialOutPoint = file.audioBuffer.duration;
        const initialLoopStart = file.loopStart;
        const initialLoopEnd = file.loopEnd;
        const result = applyZeroCrossingToMarkers(
          file.audioBuffer,
          initialInPoint,
          initialOutPoint,
          initialLoopStart,
          initialLoopEnd
        );
        return {
          ...file,
          inPoint: result.inPoint,
          outPoint: result.outPoint,
          loopStart: result.loopStart ?? initialLoopStart,
          loopEnd: result.loopEnd ?? initialLoopEnd
        };
      });
      return { ...state, multisampleFiles: updatedMultisampleFiles };
    }
      
    case 'LOAD_DRUM_SAMPLE': {
      // Validate that audioBuffer exists and has required properties
      if (!action.payload.audioBuffer || typeof action.payload.audioBuffer.duration !== 'number') {
        console.error('Invalid audioBuffer provided to LOAD_DRUM_SAMPLE:', action.payload.audioBuffer);
        return state; // Return current state without changes
      }
      
      // Validate that metadata exists and has required properties
      if (!action.payload.metadata || typeof action.payload.metadata.duration !== 'number') {
        console.error('Invalid metadata provided to LOAD_DRUM_SAMPLE:', action.payload.metadata);
        return state; // Return current state without changes
      }
      
      // Validate index is within bounds (0-23 for 24 slots)
      if (action.payload.index < 0 || action.payload.index >= 24) {
        console.error('Invalid drum sample index:', action.payload.index);
        return state; // Return current state without changes
      }
      
      const newDrumSamples = [...state.drumSamples];
      
      // Calculate initial marker positions
      const initialInPoint = 0;
      const initialOutPoint = action.payload.audioBuffer.duration;
      
      // Use initial marker positions (no automatic zero-crossing)
      const finalInPoint = initialInPoint;
      const finalOutPoint = initialOutPoint;
      
      newDrumSamples[action.payload.index] = {
        ...initialDrumSample,
        file: action.payload.file,
        audioBuffer: action.payload.audioBuffer,
        name: action.payload.file.name,
        isLoaded: true,
        inPoint: finalInPoint,
        outPoint: finalOutPoint,
        originalBitDepth: action.payload.metadata.bitDepth,
        originalSampleRate: action.payload.metadata.sampleRate,
        originalChannels: action.payload.metadata.channels,
        fileSize: action.payload.file.size,
        duration: action.payload.audioBuffer.duration,
        isFloat: action.payload.metadata.isFloat,
        hasBeenEdited: false,
        isAssigned: true, // Assigned to the specific drum key (0-23)
        assignedKey: action.payload.index
      };
      
      return { ...state, drumSamples: newDrumSamples };
    }
      
    case 'CLEAR_DRUM_SAMPLE': {
      const clearedDrumSamples = [...state.drumSamples];
      // Reset to initial state but maintain proper assignment for the first 24 slots
      const isInFirst24Slots = action.payload < 24;
      clearedDrumSamples[action.payload] = createDrumSample(action.payload, isInFirst24Slots);
      return { ...state, drumSamples: clearedDrumSamples };
    }
      
    case 'UPDATE_DRUM_SAMPLE': {
      const updatedDrumSamples = [...state.drumSamples];
      updatedDrumSamples[action.payload.index] = {
        ...updatedDrumSamples[action.payload.index],
        ...action.payload.updates
      };
      return { ...state, drumSamples: updatedDrumSamples };
    }
    
    case 'REORDER_DRUM_SAMPLES': {
      const reorderedSamples = [...state.drumSamples];
      const [movedSample] = reorderedSamples.splice(action.payload.fromIndex, 1);
      reorderedSamples.splice(action.payload.toIndex, 0, movedSample);
      return { ...state, drumSamples: reorderedSamples };
    }
    
    case 'SWAP_DRUM_SAMPLES': {
      const { fromIndex, toIndex } = action.payload;
      const swappedSamples = [...state.drumSamples];
      
      // Swap the samples
      [swappedSamples[fromIndex], swappedSamples[toIndex]] = [swappedSamples[toIndex], swappedSamples[fromIndex]];
      
      // Update the assignedKey properties to reflect the new positions
      if (swappedSamples[fromIndex]?.isAssigned) {
        swappedSamples[fromIndex] = {
          ...swappedSamples[fromIndex],
          assignedKey: fromIndex
        };
      }
      if (swappedSamples[toIndex]?.isAssigned) {
        swappedSamples[toIndex] = {
          ...swappedSamples[toIndex],
          assignedKey: toIndex
        };
      }
      
      return { ...state, drumSamples: swappedSamples };
    }
    
    case 'ADD_UNASSIGNED_DRUM_SAMPLE': {
      // Validate that audioBuffer exists and has required properties
      if (!action.payload.audioBuffer || typeof action.payload.audioBuffer.duration !== 'number') {
        console.error('Invalid audioBuffer provided to ADD_UNASSIGNED_DRUM_SAMPLE:', action.payload.audioBuffer);
        return state;
      }
      
      // Validate that metadata exists and has required properties
      if (!action.payload.metadata || typeof action.payload.metadata.duration !== 'number') {
        console.error('Invalid metadata provided to ADD_UNASSIGNED_DRUM_SAMPLE:', action.payload.metadata);
        return state;
      }
      
      // Calculate initial marker positions
      const initialInPoint = 0;
      const initialOutPoint = action.payload.audioBuffer.duration;
      
      // Use initial marker positions (no automatic zero-crossing)
      const finalInPoint = initialInPoint;
      const finalOutPoint = initialOutPoint;
      
      const newUnassignedSample: DrumSample = {
        ...createDrumSample(state.drumSamples.length, false), // Create as unassigned sample
        file: action.payload.file,
        audioBuffer: action.payload.audioBuffer,
        name: action.payload.file.name,
        isLoaded: true,
        inPoint: finalInPoint,
        outPoint: finalOutPoint,
        originalBitDepth: action.payload.metadata.bitDepth,
        originalSampleRate: action.payload.metadata.sampleRate,
        originalChannels: action.payload.metadata.channels,
        fileSize: action.payload.file.size,
        duration: action.payload.audioBuffer.duration,
        isFloat: action.payload.metadata.isFloat,
        hasBeenEdited: false
      };
      
      return { ...state, drumSamples: [...state.drumSamples, newUnassignedSample] };
    }
    
    case 'ASSIGN_DRUM_SAMPLE': {
      const { sampleIndex, targetKeyIndex } = action.payload;
      
      // Validate indices
      if (sampleIndex < 0 || sampleIndex >= state.drumSamples.length) {
        console.error('Invalid sample index:', sampleIndex);
        return state;
      }
      
      if (targetKeyIndex < 0 || targetKeyIndex >= 24) {
        console.error('Invalid target key index:', targetKeyIndex);
        return state;
      }
      
      const updatedDrumSamples = [...state.drumSamples];
      const sampleToAssign = updatedDrumSamples[sampleIndex];
      
      if (!sampleToAssign?.isLoaded) {
        console.error('Cannot assign unloaded sample');
        return state;
      }
      
      // If target key already has a sample, unassign it first
      const existingSampleIndex = updatedDrumSamples.findIndex(s => s.isAssigned && s.assignedKey === targetKeyIndex);
      if (existingSampleIndex !== -1) {
        updatedDrumSamples[existingSampleIndex] = {
          ...updatedDrumSamples[existingSampleIndex],
          isAssigned: false,
          assignedKey: undefined
        };
      }
      
      // Assign the sample to the target key
      updatedDrumSamples[sampleIndex] = {
        ...sampleToAssign,
        isAssigned: true,
        assignedKey: targetKeyIndex
      };
      
      return { ...state, drumSamples: updatedDrumSamples };
    }
    
    case 'UNASSIGN_DRUM_SAMPLE': {
      const sampleIndex = action.payload;
      
      if (sampleIndex < 0 || sampleIndex >= state.drumSamples.length) {
        console.error('Invalid sample index:', sampleIndex);
        return state;
      }
      
      const updatedDrumSamples = [...state.drumSamples];
      updatedDrumSamples[sampleIndex] = {
        ...updatedDrumSamples[sampleIndex],
        isAssigned: false,
        assignedKey: undefined
      };
      
      return { ...state, drumSamples: updatedDrumSamples };
    }
    
    case 'CLEAR_ALL_DRUM_SAMPLES': {
      // Reset drum samples array to just the first 24 slots with proper assignment
      const resetDrumSamples = Array.from({ length: 24 }, (_, index) => createDrumSample(index, true));
      return { ...state, drumSamples: resetDrumSamples };
    }
    
    case 'IMPORT_OP1_DRUM_PRESET': {
      // Start with existing drum samples
      const newDrumSamples = [...state.drumSamples];
      let samplesAddedAsUnassigned = 0;
      
      // Find the first available empty slot in the 0-23 range
      const findFirstEmptySlot = (samples: DrumSample[]): number | null => {
        for (let i = 0; i < 24; i++) {
          const sample = samples[i];
          // Only consider slot empty if no sample exists or sample is not loaded
          // Preserve unassigned samples (they should not be overwritten)
          if (!sample || !sample.isLoaded) {
            return i;
          }
        }
        return null; // No empty slots found
      };

      // Load samples from OP-1 preset
      for (const sample of action.payload.samples) {
        // Calculate initial marker positions
        const initialInPoint = 0;
        const initialOutPoint = sample.audioBuffer.duration;
        
        // Use initial marker positions (no automatic zero-crossing)
        const finalInPoint = initialInPoint;
        const finalOutPoint = initialOutPoint;
        
        // Try to find an empty slot in the 0-23 range
        const emptySlotIndex = findFirstEmptySlot(newDrumSamples);
        
        if (emptySlotIndex !== null) {
          // Found an empty slot, assign the sample there
          newDrumSamples[emptySlotIndex] = {
            ...createDrumSample(emptySlotIndex, true),
            file: sample.file,
            audioBuffer: sample.audioBuffer,
            name: sample.name,
            isLoaded: true,
            inPoint: finalInPoint,
            outPoint: finalOutPoint,
            originalBitDepth: sample.metadata.bitDepth,
            originalSampleRate: sample.metadata.sampleRate,
            originalChannels: sample.metadata.channels,
            fileSize: sample.file.size,
            duration: sample.audioBuffer.duration,
            isFloat: sample.metadata.isFloat,
            hasBeenEdited: false
          };
        } else {
          // No empty slots in 0-23, add as unassigned sample
          const unassignedSample = {
            ...createDrumSample(newDrumSamples.length, false),
            file: sample.file,
            audioBuffer: sample.audioBuffer,
            name: sample.name,
            isLoaded: true,
            inPoint: finalInPoint,
            outPoint: finalOutPoint,
            originalBitDepth: sample.metadata.bitDepth,
            originalSampleRate: sample.metadata.sampleRate,
            originalChannels: sample.metadata.channels,
            fileSize: sample.file.size,
            duration: sample.audioBuffer.duration,
            hasBeenEdited: false
          };
          newDrumSamples.push(unassignedSample);
          samplesAddedAsUnassigned++;
        }
      }
      
      // Update preset name
      const updatedDrumSettings = {
        ...state.drumSettings,
        presetName: action.payload.presetName
      };
      
      return { 
        ...state, 
        drumSamples: newDrumSamples,
        drumSettings: updatedDrumSettings
      };
    }
      
    case 'LOAD_MULTISAMPLE_FILE': {
      // Validate that metadata exists and has required properties
      if (!action.payload.metadata || typeof action.payload.metadata.duration !== 'number') {
        console.error('Invalid metadata provided to LOAD_MULTISAMPLE_FILE:', action.payload.metadata);
        return state; // Return current state without changes
      }
      
      // Check max limit of 24 samples
      if (state.multisampleFiles.length >= 24) {
        return state;
      }
      
      // Auto-detect MIDI note from metadata or filename
      let detectedMidiNote = 60; // Default to middle C
      let detectedNote = 'C4'; // Default note name
      
      if (action.payload.rootNoteOverride !== undefined) {
        // Prioritize the override from user interaction (e.g., clicking a specific key)
        detectedMidiNote = action.payload.rootNoteOverride;
        detectedNote = midiNoteToString(detectedMidiNote, state.midiNoteMapping);
      } else if (action.payload.metadata.midiNote >= 0) {
        // Use MIDI note from metadata
        detectedMidiNote = action.payload.metadata.midiNote;
        detectedNote = midiNoteToString(action.payload.metadata.midiNote, state.midiNoteMapping);
      } else {
        // Try to extract from filename - look for note pattern at the end
        try {
          const [_, midiFromParse] = parseFilename(action.payload.file.name, state.midiNoteMapping);
          if (midiFromParse >= 0 && midiFromParse <= 127) {
            detectedMidiNote = midiFromParse;
            detectedNote = midiNoteToString(midiFromParse, state.midiNoteMapping);
          }
        } catch {
          // Use default if can't detect - derive note string from detectedMidiNote
          detectedNote = midiNoteToString(detectedMidiNote, state.midiNoteMapping);
        }
      }
      
      // Calculate initial marker positions
      const initialInPoint = 0;
      const initialOutPoint = action.payload.metadata.duration;
      const initialLoopStart = action.payload.metadata.hasLoopData ? action.payload.metadata.loopStart : action.payload.metadata.duration * 0.2;
      const initialLoopEnd = action.payload.metadata.hasLoopData ? action.payload.metadata.loopEnd : action.payload.metadata.duration * 0.8;
      
      // Apply zero-crossing detection if enabled and audioBuffer is available
      let finalInPoint = initialInPoint;
      let finalOutPoint = initialOutPoint;
      let finalLoopStart = initialLoopStart;
      let finalLoopEnd = initialLoopEnd;
      
      if (state.multisampleSettings.autoZeroCrossing && action.payload.audioBuffer) {
        const result = applyZeroCrossingToMarkers(
          action.payload.audioBuffer,
          initialInPoint,
          initialOutPoint,
          initialLoopStart,
          initialLoopEnd
        );
        finalInPoint = result.inPoint;
        finalOutPoint = result.outPoint;
        finalLoopStart = result.loopStart || initialLoopStart;
        finalLoopEnd = result.loopEnd || initialLoopEnd;
        

      }
      
      const newMultisampleFile: MultisampleFile = {
        ...initialMultisampleFile,
        file: action.payload.file,
        audioBuffer: action.payload.audioBuffer, // Can be null for AIF files that can't be decoded
        name: action.payload.file.name,
        isLoaded: action.payload.audioBuffer !== null, // Only mark as loaded if we have an audioBuffer
        rootNote: detectedMidiNote, // Set the actual MIDI note number
        note: detectedNote,
        inPoint: finalInPoint,
        outPoint: finalOutPoint,
        // Use adjusted loop points
        loopStart: finalLoopStart,
        loopEnd: finalLoopEnd,
        // Store metadata
        originalBitDepth: action.payload.metadata.bitDepth,
        originalSampleRate: action.payload.metadata.sampleRate,
        originalChannels: action.payload.metadata.channels,
        fileSize: action.payload.metadata.fileSize,
        duration: action.payload.metadata.duration, // Use calculated duration from metadata
        isFloat: action.payload.metadata.isFloat
      };
      
      const updatedFiles = [...state.multisampleFiles, newMultisampleFile];
      
      // Sort by rootNote descending to make zone calculation easier
      updatedFiles.sort((a, b) => b.rootNote - a.rootNote);
      
      return { 
        ...state, 
        multisampleFiles: updatedFiles
      };
    }
      
    case 'CLEAR_MULTISAMPLE_FILE': {
      const filteredMultisampleFiles = state.multisampleFiles.filter((_, index) => index !== action.payload);
      return { ...state, multisampleFiles: filteredMultisampleFiles };
    }
      
    case 'UPDATE_MULTISAMPLE_FILE': {
      const updatedMultisampleFiles = [...state.multisampleFiles];
      updatedMultisampleFiles[action.payload.index] = {
        ...updatedMultisampleFiles[action.payload.index],
        ...action.payload.updates
      };
      
      // If rootNote was updated, sort the array to maintain proper order
      if ('rootNote' in action.payload.updates) {
        updatedMultisampleFiles.sort((a, b) => b.rootNote - a.rootNote);
      }
      
      return { ...state, multisampleFiles: updatedMultisampleFiles };
    }
      
    case 'REORDER_MULTISAMPLE_FILES': {
      const reorderedFiles = [...state.multisampleFiles];
      const [movedFile] = reorderedFiles.splice(action.payload.fromIndex, 1);
      reorderedFiles.splice(action.payload.toIndex, 0, movedFile);
      return { ...state, multisampleFiles: reorderedFiles };
    }
      
    case 'SET_SELECTED_MULTISAMPLE':
      return { ...state, selectedMultisample: action.payload };
      
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
      
    case 'SET_ERROR':
      return { ...state, error: action.payload };
      
    case 'ADD_NOTIFICATION':
      return { 
        ...state, 
        notifications: [...state.notifications, action.payload] 
      };
      
    case 'REMOVE_NOTIFICATION':
      return { 
        ...state, 
        notifications: state.notifications.filter(n => n.id !== action.payload) 
      };
      
    case 'SET_IMPORTED_DRUM_PRESET':
      return { ...state, importedDrumPreset: action.payload };
      
    case 'SET_IMPORTED_MULTISAMPLE_PRESET':
      return { ...state, importedMultisamplePreset: action.payload };
      
    case 'TOGGLE_DRUM_KEYBOARD_PIN':
      return { ...state, isDrumKeyboardPinned: !state.isDrumKeyboardPinned };
      
    case 'TOGGLE_MULTISAMPLE_KEYBOARD_PIN':
      return { ...state, isMultisampleKeyboardPinned: !state.isMultisampleKeyboardPinned };
      
    case 'RESTORE_SESSION': {
      // Create a properly sized drum samples array that can accommodate all samples
      // Find the highest originalIndex to determine the array size
      const maxIndex = Math.max(...action.payload.drumSamples.map(s => s.originalIndex), 23); // At least 24 slots
      const restoredDrumSamples = Array.from({ length: maxIndex + 1 }, (_, index) => {
        // If there's a restored sample at this index, use it; otherwise create proper initial state
        const restoredSample = action.payload.drumSamples.find(s => s.originalIndex === index);
        if (restoredSample) {
          return {
            file: restoredSample.file,
            audioBuffer: restoredSample.audioBuffer,
            name: restoredSample.name,
            isLoaded: restoredSample.isLoaded,
            isAssigned: restoredSample.isAssigned,
            assignedKey: restoredSample.assignedKey,
            inPoint: restoredSample.inPoint,
            outPoint: restoredSample.outPoint,
            playmode: restoredSample.playmode,
            reverse: restoredSample.reverse,
            transpose: restoredSample.transpose,
            pan: restoredSample.pan,
            gain: restoredSample.gain,
            hasBeenEdited: restoredSample.hasBeenEdited,
            originalBitDepth: restoredSample.originalBitDepth,
            originalSampleRate: restoredSample.originalSampleRate,
            originalChannels: restoredSample.originalChannels,
            fileSize: restoredSample.fileSize,
            duration: restoredSample.duration,
            isFloat: restoredSample.isFloat
          };
        }
        // For empty slots, create proper initial state with correct assignment
        // Slots 0-23 should be assigned to their respective keys by default
        const isInFirst24Slots = index < 24;
        return createDrumSample(index, isInFirst24Slots);
      });
      


      const newState = {
        ...state,
        drumSettings: action.payload.drumSettings,
        multisampleSettings: action.payload.multisampleSettings,
        drumSamples: restoredDrumSamples,
        multisampleFiles: action.payload.multisampleFiles,
        selectedMultisample: action.payload.selectedMultisample,
        isDrumKeyboardPinned: action.payload.isDrumKeyboardPinned,
        isMultisampleKeyboardPinned: action.payload.isMultisampleKeyboardPinned,
        isSessionRestorationModalOpen: false,
        sessionInfo: null
      };


      
      return newState;
    }
      
    case 'SET_SESSION_RESTORATION_MODAL_OPEN':
      return { ...state, isSessionRestorationModalOpen: action.payload };
      
    case 'SET_SESSION_INFO':
      return { ...state, sessionInfo: action.payload };
      
    case 'SET_MIDI_NOTE_MAPPING': {
      // Save to cookie for persistence
      try {
        cookieUtils.setCookie(COOKIE_KEYS.MIDI_NOTE_MAPPING, action.payload, 30);
      } catch (error) {
        console.error('Failed to save MIDI note mapping to cookie:', error);
      }
      
      // Update note strings for all existing multisample files to reflect the new mapping
      const updatedMultisampleFiles = state.multisampleFiles.map(file => ({
        ...file,
        note: midiNoteToString(file.rootNote, action.payload)
      }));
      
      return { 
        ...state, 
        midiNoteMapping: action.payload,
        multisampleFiles: updatedMultisampleFiles
      };
    }

    case 'UPDATE_ALL_MULTI_SAMPLES': {
      return {
        ...state,
        multisampleFiles: state.multisampleFiles.map(file => {
          // Only update loaded files with valid audio data
          if (file.isLoaded && file.audioBuffer) {
            return { ...file, ...action.payload };
          }
          return file;
        })
      };
    }

    case 'UPDATE_ALL_DRUM_SAMPLES': {
      return {
        ...state,
        drumSamples: state.drumSamples.map(sample => {
          // Only update loaded samples with valid audio data
          if (sample.isLoaded && sample.audioBuffer) {
            return { ...sample, ...action.payload };
          }
          return sample;
        }),
      };
    }

    default: {
      return state;
    }
  }
}

// Export for testing
export { appReducer, initialState };

// Create context
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

// Provider component
export function AppContextProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Custom hook to use the context
export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppContextProvider');
  }
  return context;
}