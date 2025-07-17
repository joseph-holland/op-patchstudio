import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionStorageManager } from '../../utils/sessionStorage';
import { createCompleteMultisampleSettings } from './testHelpers';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

describe('sessionStorage', () => {
  let sessionStorage: SessionStorageManager;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage = SessionStorageManager.getInstance();
  });

  describe('saveSession', () => {
    it('should save session data to localStorage', async () => {
      const mockState = {
        currentTab: 'drum' as const,
        drumSamples: [],
        multisampleFiles: [],
        selectedMultisample: null,
        isLoading: false,
        error: null,
        isDrumKeyboardPinned: false,
        isMultisampleKeyboardPinned: false,
        notifications: [],
        importedDrumPreset: null,
        importedMultisamplePreset: null,
        isSessionRestorationModalOpen: false,
        sessionInfo: null,
        midiNoteMapping: 'C3' as const,
        drumSettings: {
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          presetName: '',
          normalize: false,
          normalizeLevel: 0,
          autoZeroCrossing: true,
          presetSettings: {
            playmode: 'poly' as const,
            transpose: 0,
            velocity: 100,
            volume: 100,
            width: 100
          },
          renameFiles: false,
          filenameSeparator: ' ' as const,
        audioFormat: 'wav' as const
        },
        multisampleSettings: createCompleteMultisampleSettings()
      };

      await sessionStorage.saveSession(mockState);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });
}); 