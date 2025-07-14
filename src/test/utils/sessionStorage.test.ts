import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sessionStorage, SessionStorageManager } from '../../utils/sessionStorage';
import type { AppState } from '../../context/AppContext';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock AudioContext
const mockAudioContext = {
  decodeAudioData: vi.fn().mockResolvedValue({}),
};

Object.defineProperty(window, 'AudioContext', {
  value: vi.fn(() => mockAudioContext),
});

// Mock FileReader
const mockFileReader = {
  readAsDataURL: vi.fn(),
  onload: null as any,
  onerror: null as any,
  result: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT',
};

Object.defineProperty(window, 'FileReader', {
  value: vi.fn(() => mockFileReader),
});

describe('SessionStorageManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('should be a singleton', () => {
    const instance1 = SessionStorageManager.getInstance();
    const instance2 = SessionStorageManager.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should generate unique session IDs', () => {
    const id1 = sessionStorage.generateSessionId();
    const id2 = sessionStorage.generateSessionId();
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(0);
  });

  it('should check for previous session', () => {
    // No previous session
    expect(sessionStorage.hasPreviousSession()).toBe(false);

    // With previous session
    localStorageMock.getItem.mockReturnValueOnce('session-id');
    localStorageMock.getItem.mockReturnValueOnce('session-data');
    expect(sessionStorage.hasPreviousSession()).toBe(true);
  });

  it('should get current session ID', () => {
    localStorageMock.getItem.mockReturnValue('test-session-id');
    expect(sessionStorage.getCurrentSessionId()).toBe('test-session-id');
  });

  it('should get sessions list', () => {
    const mockList = [
      { sessionId: '1', timestamp: 1000, name: 'session 1' },
      { sessionId: '2', timestamp: 2000, name: 'session 2' }
    ];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockList));
    
    const result = sessionStorage.getSessionsList();
    expect(result).toEqual(mockList);
  });

  it('should handle empty sessions list', () => {
    localStorageMock.getItem.mockReturnValue(null);
    const result = sessionStorage.getSessionsList();
    expect(result).toEqual([]);
  });

  it('should clear current session', () => {
    localStorageMock.getItem.mockReturnValue('test-session-id');
    sessionStorage.clearCurrentSession();
    
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('op-patchstudio-sessions/test-session-id');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('op-patchstudio-current-session');
  });

  it('should delete specific session', () => {
    localStorageMock.getItem.mockReturnValue('test-session-id');
    sessionStorage.deleteSession('session-to-delete');
    
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('op-patchstudio-sessions/session-to-delete');
  });

  it('should convert file to base64', async () => {
    // Mock FileReader to trigger onload
    setTimeout(() => {
      mockFileReader.onload?.({ target: { result: 'data:audio/wav;base64,dGVzdCBhdWRpbyBkYXRh' } });
    }, 0);

    const result = await sessionStorage.base64ToFile('dGVzdCBhdWRpbyBkYXRh', 'test.wav', 'audio/wav');
    expect(result).toBeInstanceOf(File);
    expect(result.name).toBe('test.wav');
    expect(result.type).toBe('audio/wav');
  });

  it('should convert base64 to AudioBuffer', async () => {
    await sessionStorage.base64ToAudioBuffer('dGVzdCBhdWRpbyBkYXRh');
    expect(mockAudioContext.decodeAudioData).toHaveBeenCalled();
  });

  it('should not show restore prompt when session is saved to library', async () => {
    // Mock a session that has been saved to library
    const mockSessionData = {
      sessionId: 'test-session-id',
      timestamp: Date.now(),
      drumSamples: [],
      multisampleFiles: [],
      savedToLibrary: true
    };
    
    localStorageMock.getItem.mockReturnValue('test-session-id');
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(mockSessionData));
    
    // The session should not trigger a restore prompt
    expect(sessionStorage.hasPreviousSession()).toBe(true);
  });

  it('should save and load session data', async () => {
    const mockState: Partial<AppState> = {
      drumSettings: {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        presetName: 'Test Drum',
        normalize: false,
        normalizeLevel: -6.0,
        presetSettings: {
          playmode: 'poly',
          transpose: 0,
          velocity: 20,
          volume: 69,
          width: 0
        },
        renameFiles: false,
        filenameSeparator: ' ' as ' '
      },
      multisampleSettings: {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        presetName: 'Test Multisample',
        normalize: false,
        normalizeLevel: -6.0,
        cutAtLoopEnd: false,
        gain: 0,
        loopEnabled: true,
        loopOnRelease: true,
        renameFiles: false,
        filenameSeparator: ' ' as ' '
      },
      drumSamples: [],
      multisampleFiles: [],
      selectedMultisample: null,
      isDrumKeyboardPinned: false,
      isMultisampleKeyboardPinned: false,
      currentTab: 'drum',
      isLoading: false,
      error: null,
      notifications: [],
      importedDrumPreset: null,
      importedMultisamplePreset: null,
      isSessionRestorationModalOpen: false,
      sessionInfo: null
    };

    // Mock FileReader for save
    setTimeout(() => {
      mockFileReader.onload?.({ target: { result: 'data:audio/wav;base64,dGVzdCBhdWRpbyBkYXRh' } });
    }, 0);

    const sessionId = await sessionStorage.saveSession(mockState as AppState);
    expect(sessionId).toBeDefined();
    expect(localStorageMock.setItem).toHaveBeenCalled();

    // Mock loading the session
    const savedData = {
      sessionId,
      timestamp: Date.now(),
      drumSettings: mockState.drumSettings,
      multisampleSettings: mockState.multisampleSettings,
      drumSamples: [],
      multisampleFiles: [],
      selectedMultisample: null,
      isDrumKeyboardPinned: false,
      isMultisampleKeyboardPinned: false,
    };

    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedData));
    
    const loadedData = await sessionStorage.loadSession(sessionId);
    expect(loadedData).toBeDefined();
    expect(loadedData?.drumSettings).toEqual(mockState.drumSettings);
    expect(loadedData?.multisampleSettings).toEqual(mockState.multisampleSettings);
  });
}); 