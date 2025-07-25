import type { AppState } from '../../context/AppContext';
import { AUDIO_CONSTANTS } from '../../utils/constants';

// Helper function to create complete multisample settings for tests
export function createCompleteMultisampleSettings(overrides: Partial<AppState['multisampleSettings']> = {}): AppState['multisampleSettings'] {
  return {
    sampleRate: 44100,
    bitDepth: 16,
    channels: 2,
    presetName: '',
    normalize: false,
    normalizeLevel: AUDIO_CONSTANTS.MULTISAMPLE_NORMALIZATION_LEVEL, // Use constant for multisample normalization level
    autoZeroCrossing: true,
    cutAtLoopEnd: false,
    gain: 0,
    loopEnabled: true,
    loopOnRelease: true,
    renameFiles: false,
    filenameSeparator: ' ',
    audioFormat: 'wav' as const,
    // Advanced settings
    playmode: 'poly',
    transpose: 0,
    velocitySensitivity: 20,
    volume: 69,
    width: 0,
    highpass: 0,
    portamentoType: 'linear',
    portamentoAmount: 0,
    tuningRoot: 0,
    ampEnvelope: {
      attack: 500,
      decay: 6000,
      sustain: 22000,
      release: 12000
    },
    filterEnvelope: {
      attack: 0,
      decay: 5000,
      sustain: 18000,
      release: 10000
    },
    ...overrides
  };
} 