import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useAppContext } from '../../context/AppContext';
import { createCompleteMultisampleSettings } from '../utils/testHelpers';

// Mock the AppContext
vi.mock('../../context/AppContext');

// Mock the audio utilities
vi.mock('../../utils/audio', () => ({
  parseFilename: vi.fn(),
  midiNoteToString: vi.fn(),
  audioBufferToWav: vi.fn(),
  createAudioBuffer: vi.fn(),
  extractAudioMetadata: vi.fn(),
  readWavMetadata: vi.fn()
}));

// Mock the session storage
vi.mock('../../utils/sessionStorageIndexedDB', () => ({
  sessionStorageIndexedDB: {
    saveSession: vi.fn(),
    loadSession: vi.fn(),
    clearSession: vi.fn(),
    hasSession: vi.fn(),
    getSessionInfo: vi.fn(),
    resetSavedToLibraryFlag: vi.fn()
  }
}));

describe('useFileUpload', () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock the AppContext with complete multisample settings
    (useAppContext as any).mockReturnValue({
      state: {
        currentTab: 'multisample',
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
          presetSettings: {
            playmode: 'poly' as const,
            transpose: 0,
            velocity: 100,
            volume: 100,
            width: 100
          },
          renameFiles: false,
          filenameSeparator: ' ' as const
        },
        multisampleSettings: createCompleteMultisampleSettings()
      },
      dispatch: mockDispatch
    });
  });

  it('should provide expected functions', () => {
    const { result } = renderHook(() => useFileUpload())
    
    expect(typeof result.current.handleDrumSampleUpload).toBe('function')
    expect(typeof result.current.handleMultisampleUpload).toBe('function')
    expect(typeof result.current.clearDrumSample).toBe('function')
    expect(typeof result.current.clearMultisampleFile).toBe('function')
  })

  it('should handle drum sample upload calls', async () => {
    const { result } = renderHook(() => useFileUpload())
    const mockFile = new File(['mock audio data'], 'test.wav', { type: 'audio/wav' })
    
    await act(async () => {
      await result.current.handleDrumSampleUpload(mockFile, 0)
    })
    
    // Should have called dispatch at least once
    expect(mockDispatch).toHaveBeenCalled()
  })

  it('should handle multisample upload calls', async () => {
    const { result } = renderHook(() => useFileUpload())
    const mockFile = new File(['mock audio data'], 'C4.wav', { type: 'audio/wav' })
    
    await act(async () => {
      await result.current.handleMultisampleUpload(mockFile, 60)
    })
    
    // Should have called dispatch at least once
    expect(mockDispatch).toHaveBeenCalled()
  })

  it('should handle errors during upload', async () => {
    // Mock readWavMetadata to throw an error
    const { readWavMetadata } = await import('../../utils/audio');
    vi.mocked(readWavMetadata).mockRejectedValueOnce(new Error('Invalid audio file'))

    const { result } = renderHook(() => useFileUpload())
    const mockFile = new File(['invalid data'], 'test.txt', { type: 'text/plain' })
    
    await act(async () => {
      await result.current.handleDrumSampleUpload(mockFile, 0)
    })
    
    // Should have called dispatch to set error state
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_ERROR'
      })
    )
  })

  it('should provide clear functions that call dispatch', () => {
    const { result } = renderHook(() => useFileUpload())
    
    act(() => {
      result.current.clearDrumSample(0)
      result.current.clearMultisampleFile(0)
    })
    
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CLEAR_DRUM_SAMPLE'
      })
    )
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CLEAR_MULTISAMPLE_FILE'
      })
    )
  })
})