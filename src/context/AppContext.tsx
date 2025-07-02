import { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { WavMetadata } from '../utils/audio';
import { midiNoteToString } from '../utils/audio';
import type { Notification } from '../components/common/NotificationSystem';
import { cookieUtils, COOKIE_KEYS } from '../utils/cookies';

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
  // Sample settings
  playmode: 'oneshot' | 'group' | 'loop' | 'gate';
  reverse: boolean;
  tune: number; // -48 to +48 semitones
  pan: number; // -100 to +100
  gain: number; // -30 to +20 dB
  
  // Editing status
  hasBeenEdited: boolean;
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
  // WAV metadata from header parsing
  originalBitDepth?: number;
  originalSampleRate?: number;
  originalChannels?: number;
  fileSize?: number;
  duration?: number;
}

export interface AppState {
  // Current tab
  currentTab: 'drum' | 'multisample';
  
  // Drum tool settings
  drumSettings: {
    sampleRate: number;
    bitDepth: number;
    channels: number;
    presetName: string;
    normalize: boolean;
    normalizeLevel: number; // -6.0 to 0.0 dB
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
    cutAtLoopEnd: boolean;
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
}

// Define enhanced action types
export type AppAction = 
  | { type: 'SET_TAB'; payload: 'drum' | 'multisample' }
  | { type: 'SET_DRUM_SAMPLE_RATE'; payload: number }
  | { type: 'SET_DRUM_BIT_DEPTH'; payload: number }
  | { type: 'SET_DRUM_CHANNELS'; payload: number }
  | { type: 'SET_DRUM_PRESET_NAME'; payload: string }
  | { type: 'SET_DRUM_NORMALIZE'; payload: boolean }
  | { type: 'SET_DRUM_NORMALIZE_LEVEL'; payload: number }
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
  | { type: 'SET_MULTISAMPLE_CUT_AT_LOOP_END'; payload: boolean }
  | { type: 'LOAD_DRUM_SAMPLE'; payload: { index: number; file: File; audioBuffer: AudioBuffer; metadata: WavMetadata } }
  | { type: 'CLEAR_DRUM_SAMPLE'; payload: number }
  | { type: 'UPDATE_DRUM_SAMPLE'; payload: { index: number; updates: Partial<DrumSample> } }
  | { type: 'LOAD_MULTISAMPLE_FILE'; payload: { file: File; audioBuffer: AudioBuffer; metadata: WavMetadata; rootNoteOverride?: number; } }
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
  | { type: 'TOGGLE_MULTISAMPLE_KEYBOARD_PIN' };

// Initial state
const initialDrumSample: DrumSample = {
  file: null,
  audioBuffer: null,
  name: '',
  isLoaded: false,
  inPoint: 0,
  outPoint: 0,
  playmode: 'oneshot',
  reverse: false,
  tune: 0,
  pan: 0,
  gain: 0,
  hasBeenEdited: false
};

const initialMultisampleFile: MultisampleFile = {
  file: null,
  audioBuffer: null,
  name: '',
  isLoaded: false,
  rootNote: 60, // Middle C
  inPoint: 0,
  outPoint: 0
};

// Function to get initial tab from cookie
const getInitialTab = (): 'drum' | 'multisample' => {
  try {
    const savedTab = cookieUtils.getCookie(COOKIE_KEYS.LAST_TAB);
    return (savedTab === 'multisample') ? 'multisample' : 'drum';
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

const initialState: AppState = {
  currentTab: getInitialTab(),
  drumSettings: {
    sampleRate: 0,
    bitDepth: 0,
    channels: 0,
    presetName: '',
    normalize: false,
    normalizeLevel: 0.0,
    presetSettings: {
      playmode: 'poly',
      transpose: 0,
      velocity: 20,
      volume: 69,
      width: 0
    }
  },
  multisampleSettings: {
    sampleRate: 0,
    bitDepth: 0,
    channels: 0,
    presetName: '',
    normalize: false,
    normalizeLevel: 0.0,
    cutAtLoopEnd: false
  },
  drumSamples: Array(24).fill(null).map(() => ({ ...initialDrumSample })),
  multisampleFiles: [], // Dynamic array, 1-24 samples max
  selectedMultisample: null,
  isLoading: false,
  error: null,
  isDrumKeyboardPinned: getInitialPinState(COOKIE_KEYS.DRUM_KEYBOARD_PINNED),
  isMultisampleKeyboardPinned: getInitialPinState(COOKIE_KEYS.MULTISAMPLE_KEYBOARD_PINNED),
  notifications: [],
  importedDrumPreset: null,
  importedMultisamplePreset: null
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
      
    case 'SET_MULTISAMPLE_CUT_AT_LOOP_END':
      return { 
        ...state, 
        multisampleSettings: { ...state.multisampleSettings, cutAtLoopEnd: action.payload }
      };
      
    case 'LOAD_DRUM_SAMPLE':
      const newDrumSamples = [...state.drumSamples];
      newDrumSamples[action.payload.index] = {
        ...newDrumSamples[action.payload.index],
        file: action.payload.file,
        audioBuffer: action.payload.audioBuffer,
        name: action.payload.file.name,
        isLoaded: true,
        inPoint: 0,
        outPoint: action.payload.audioBuffer.length - 1,
        // Store WAV metadata
        originalBitDepth: action.payload.metadata.bitDepth,
        originalSampleRate: action.payload.metadata.sampleRate,
        originalChannels: action.payload.metadata.channels,
        fileSize: action.payload.metadata.fileSize,
        duration: action.payload.metadata.duration
      };
      return { ...state, drumSamples: newDrumSamples };
      
    case 'CLEAR_DRUM_SAMPLE':
      const clearedDrumSamples = [...state.drumSamples];
      clearedDrumSamples[action.payload] = { ...initialDrumSample };
      return { ...state, drumSamples: clearedDrumSamples };
      
    case 'UPDATE_DRUM_SAMPLE':
      const updatedDrumSamples = [...state.drumSamples];
      updatedDrumSamples[action.payload.index] = {
        ...updatedDrumSamples[action.payload.index],
        ...action.payload.updates
      };
      return { ...state, drumSamples: updatedDrumSamples };
      
    case 'LOAD_MULTISAMPLE_FILE':
      // Check max limit of 24 samples
      if (state.multisampleFiles.length >= 24) {
        return state;
      }
      
      // Helper function to convert note name to MIDI number (corrected)
      const noteNameToMidi = (noteName: string): number => {
        const match = noteName.match(/^([A-G])(#|b)?(\d+)$/i);
        if (!match) return -1;
        
        const noteMap: { [key: string]: number } = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
        const [, note, accidental, octaveStr] = match;
        const baseNote = noteMap[note.toUpperCase()];
        if (baseNote === undefined) return -1;
        
        const octave = parseInt(octaveStr);
        let midiNote = (octave + 1) * 12 + baseNote;
        
        if (accidental === '#') midiNote += 1;
        else if (accidental === 'b') midiNote -= 1;
        
        return (midiNote >= 0 && midiNote <= 127) ? midiNote : -1;
      };

      // Auto-detect MIDI note from WAV metadata or filename
      let detectedMidiNote = 60; // Default to middle C
      let detectedNote = 'C4'; // Default note name
      
      if (action.payload.rootNoteOverride !== undefined) {
        // Prioritize the override from user interaction (e.g., clicking a specific key)
        detectedMidiNote = action.payload.rootNoteOverride;
        detectedNote = midiNoteToString(detectedMidiNote);
      } else if (action.payload.metadata.midiNote !== -1) {
        // Use MIDI note from WAV metadata
        detectedMidiNote = action.payload.metadata.midiNote;
        detectedNote = midiNoteToString(action.payload.metadata.midiNote);
      } else {
        // Try to extract from filename - look for note pattern at the end
        try {
          const nameWithoutExt = action.payload.file.name.replace(/\.[^/.]+$/, "");
          const match = nameWithoutExt.match(/([A-G](?:#|b)?\d+)$/i);
          if (match) {
            const noteStr = match[1];
            const midiFromNote = noteNameToMidi(noteStr);
            if (midiFromNote >= 0 && midiFromNote <= 127) {
              detectedMidiNote = midiFromNote;
              detectedNote = noteStr.toUpperCase();
            }
          }
        } catch {
          // Use default if can't detect
          detectedNote = 'C4';
        }
      }
      
      const newMultisampleFile: MultisampleFile = {
        ...initialMultisampleFile,
        file: action.payload.file,
        audioBuffer: action.payload.audioBuffer,
        name: action.payload.file.name,
        isLoaded: true,
        rootNote: detectedMidiNote, // Set the actual MIDI note number
        note: detectedNote,
        inPoint: 0,
        outPoint: action.payload.audioBuffer.length - 1,
        // Store WAV metadata
        originalBitDepth: action.payload.metadata.bitDepth,
        originalSampleRate: action.payload.metadata.sampleRate,
        originalChannels: action.payload.metadata.channels,
        fileSize: action.payload.metadata.fileSize,
        duration: action.payload.metadata.duration
      };
      
      const updatedFiles = [...state.multisampleFiles, newMultisampleFile];
      
      // Sort by rootNote descending to make zone calculation easier
      updatedFiles.sort((a, b) => b.rootNote - a.rootNote);
      
      return { 
        ...state, 
        multisampleFiles: updatedFiles
      };
      
    case 'CLEAR_MULTISAMPLE_FILE':
      const filteredMultisampleFiles = state.multisampleFiles.filter((_, index) => index !== action.payload);
      return { ...state, multisampleFiles: filteredMultisampleFiles };
      
    case 'UPDATE_MULTISAMPLE_FILE':
      const updatedMultisampleFiles = [...state.multisampleFiles];
      updatedMultisampleFiles[action.payload.index] = {
        ...updatedMultisampleFiles[action.payload.index],
        ...action.payload.updates
      };
      return { ...state, multisampleFiles: updatedMultisampleFiles };
      
    case 'REORDER_MULTISAMPLE_FILES':
      const reorderedFiles = [...state.multisampleFiles];
      const [movedFile] = reorderedFiles.splice(action.payload.fromIndex, 1);
      reorderedFiles.splice(action.payload.toIndex, 0, movedFile);
      return { ...state, multisampleFiles: reorderedFiles };
      
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
      
    default:
      return state;
  }
}

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