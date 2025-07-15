import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { AppState } from '../../context/AppContext';

// Mock IndexedDB
vi.mock('../../utils/indexedDB', () => ({
  indexedDB: {
    saveSample: vi.fn(),
    getSample: vi.fn(),
    saveSession: vi.fn(),
    getSession: vi.fn(),
    getAllSamples: vi.fn(),
    deleteSession: vi.fn(),
    deleteSample: vi.fn(),
  },
}));

import { sessionStorageIndexedDB } from '../../utils/sessionStorageIndexedDB';
import { indexedDB } from '../../utils/indexedDB';

describe('SessionStorageIndexedDB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('saveSession', () => {
    it('should save session with proper audio data handling', async () => {
      // Mock File and AudioBuffer
      const mockFile = new File(['mock audio data'], 'test.wav', { type: 'audio/wav' });
      const mockAudioBuffer = {
        sampleRate: 44100,
        numberOfChannels: 2,
        duration: 1.0,
      } as AudioBuffer;

      const mockState: AppState = {
        currentTab: 'drum',
        drumSamples: [{
          file: mockFile,
          audioBuffer: mockAudioBuffer,
          name: 'test.wav',
          isLoaded: true,
          inPoint: 0,
          outPoint: 1.0,
          playmode: 'oneshot' as const,
          reverse: false,
          tune: 0,
          pan: 0,
          gain: 1,
          hasBeenEdited: false,
          originalBitDepth: 16,
          originalSampleRate: 44100,
          originalChannels: 2,
          fileSize: 1024,
          duration: 1.0,
        }],
        multisampleFiles: [],
        drumSettings: {
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          presetName: 'Test',
          normalize: false,
          normalizeLevel: -6.0,
          renameFiles: false,
          filenameSeparator: ' ' as ' ',
          presetSettings: {
            playmode: 'poly',
            transpose: 0,
            velocity: 20,
            volume: 69,
            width: 0,
          },
        },
        multisampleSettings: {
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          presetName: 'Test',
          normalize: false,
          normalizeLevel: -6.0,
          cutAtLoopEnd: false,
          gain: 0,
          loopEnabled: true,
          loopOnRelease: true,
          renameFiles: false,
          filenameSeparator: ' ' as ' ',
        },
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
        midiNoteMapping: 'C3',
      };

      // Mock the arrayBuffer method
      Object.defineProperty(mockFile, 'arrayBuffer', {
        value: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
        writable: true,
      });

      // Mock getAllSamples to return empty array (no existing samples)
      (indexedDB.getAllSamples as any).mockResolvedValue([]);

      const sessionId = await sessionStorageIndexedDB.saveSession(mockState);

      expect(sessionId).toBe('current-session');
      expect(indexedDB.saveSample).toHaveBeenCalled();
      expect(indexedDB.saveSession).toHaveBeenCalled();
      
      // Verify that the sample was saved with proper blob data
      const savedSampleCall = (indexedDB.saveSample as any).mock.calls[0][0];
      expect(savedSampleCall.data).toBeInstanceOf(Blob);
      expect(savedSampleCall.metadata.sampleRate).toBe(44100);
    });
  });

  describe('loadSampleFromSession', () => {
    it('should load sample with proper audio decoding', async () => {
      const mockArrayBuffer = new ArrayBuffer(1024);
      const mockBlob = new Blob([mockArrayBuffer], { type: 'audio/wav' });
      
      // Mock the arrayBuffer method on the Blob
      Object.defineProperty(mockBlob, 'arrayBuffer', {
        value: vi.fn().mockResolvedValue(mockArrayBuffer),
        writable: true,
      });
      
      const mockSampleData = {
        id: 'test-sample',
        name: 'test.wav',
        type: 'audio/wav',
        size: 1024,
        data: mockBlob,
        metadata: {
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          duration: 1.0,
        },
        createdAt: Date.now(),
      };

      (indexedDB.getSample as any).mockResolvedValue(mockSampleData);

      // Mock AudioContext
      const mockAudioContext = {
        decodeAudioData: vi.fn().mockResolvedValue({
          sampleRate: 44100,
          numberOfChannels: 2,
          duration: 1.0,
        }),
      };

      global.AudioContext = vi.fn().mockImplementation(() => mockAudioContext);

      const result = await sessionStorageIndexedDB.loadSampleFromSession('test-sample');

      expect(result).toBeDefined();
      expect(result?.file).toBeInstanceOf(File);
      expect(result?.audioBuffer).toBeDefined();
      expect(result?.metadata.sampleRate).toBe(44100);
    });

    it('should handle corrupted audio data gracefully', async () => {
      const mockBlob = new Blob(['corrupted data'], { type: 'audio/wav' });
      
      // Mock the arrayBuffer method on the Blob to throw an error
      Object.defineProperty(mockBlob, 'arrayBuffer', {
        value: vi.fn().mockRejectedValue(new Error('Audio decoding failed')),
        writable: true,
      });
      
      const mockSampleData = {
        id: 'corrupted-sample',
        name: 'corrupted.wav',
        type: 'audio/wav',
        size: 100,
        data: mockBlob,
        metadata: {
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          duration: 1.0,
        },
        createdAt: Date.now(),
      };

      (indexedDB.getSample as any).mockResolvedValue(mockSampleData);

      // Mock AudioContext to throw error
      const mockAudioContext = {
        decodeAudioData: vi.fn().mockRejectedValue(new Error('Audio decoding failed')),
      };

      global.AudioContext = vi.fn().mockImplementation(() => mockAudioContext);

      const result = await sessionStorageIndexedDB.loadSampleFromSession('corrupted-sample');

      expect(result).toBeNull();
    });
  });

  describe('clearCorruptedData', () => {
    it('should clear corrupted samples from current session', async () => {
      const mockSessionData = {
        id: 'current-session',
        timestamp: Date.now(),
        drumSamples: [{ sampleId: 'sample-1' }],
        multisampleFiles: [],
      };

      (indexedDB.getSession as any).mockResolvedValue(mockSessionData);
      (indexedDB.getSample as any).mockResolvedValue(null); // Corrupted sample

      await sessionStorageIndexedDB.clearCorruptedData();

      // Should update the session data to remove corrupted samples
      expect(indexedDB.saveSession).toHaveBeenCalled();
      // Should delete the corrupted sample
      expect(indexedDB.deleteSample).toHaveBeenCalledWith('sample-1');
    });

    it('should handle case when no session exists', async () => {
      (indexedDB.getSession as any).mockResolvedValue(null);

      await sessionStorageIndexedDB.clearCorruptedData();

      // Should not call any delete operations
      expect(indexedDB.deleteSample).not.toHaveBeenCalled();
      expect(indexedDB.saveSession).not.toHaveBeenCalled();
    });
  });

  describe('hasPreviousSession', () => {
    it('should return true when session has samples', async () => {
      const mockSessionData = {
        id: 'current-session',
        timestamp: Date.now(),
        drumSamples: [{ sampleId: 'sample-1' }],
        multisampleFiles: [],
      };

      (indexedDB.getSession as any).mockResolvedValue(mockSessionData);

      const result = await sessionStorageIndexedDB.hasPreviousSession();

      expect(result).toBe(true);
    });

    it('should return false when session has no samples', async () => {
      const mockSessionData = {
        id: 'current-session',
        timestamp: Date.now(),
        drumSamples: [],
        multisampleFiles: [],
      };

      (indexedDB.getSession as any).mockResolvedValue(mockSessionData);

      const result = await sessionStorageIndexedDB.hasPreviousSession();

      expect(result).toBe(false);
    });

    it('should return false when no session exists', async () => {
      (indexedDB.getSession as any).mockResolvedValue(null);

      const result = await sessionStorageIndexedDB.hasPreviousSession();

      expect(result).toBe(false);
    });
  });

  describe('getCurrentSession', () => {
    it('should return session when it has samples', async () => {
      const mockSessionData = {
        id: 'current-session',
        timestamp: Date.now(),
        drumSamples: [{ sampleId: 'sample-1' }],
        multisampleFiles: [],
      };

      (indexedDB.getSession as any).mockResolvedValue(mockSessionData);

      const result = await sessionStorageIndexedDB.getCurrentSession();

      expect(result).toEqual(mockSessionData);
    });

    it('should return null when session has no samples', async () => {
      const mockSessionData = {
        id: 'current-session',
        timestamp: Date.now(),
        drumSamples: [],
        multisampleFiles: [],
      };

      (indexedDB.getSession as any).mockResolvedValue(mockSessionData);

      const result = await sessionStorageIndexedDB.getCurrentSession();

      expect(result).toBeNull();
    });
  });
}); 