import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFileUpload } from '../../hooks/useFileUpload'

// Mock the context hook to avoid needing the provider
vi.mock('../../context/AppContext', () => ({
  useAppContext: vi.fn(() => ({
    state: {
      currentTab: 'drum',
      drumSamples: [],
      multisampleFiles: [],
      selectedMultisample: null,
      isLoading: false,
      error: null,
      isDrumKeyboardPinned: false,
      isMultisampleKeyboardPinned: false,
      drumSettings: {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        presetName: '',
        normalize: false,
        normalizeLevel: 0,
        presetSettings: {
          playmode: 'poly',
          transpose: 0,
          velocity: 100,
          volume: 100,
          width: 100
        }
      },
              multisampleSettings: {
          sampleRate: 0,
          bitDepth: 0,
          channels: 0,
          presetName: '',
          normalize: false,
          normalizeLevel: -6.0,
          cutAtLoopEnd: false,
          gain: 0,
          loopEnabled: true,
          loopOnRelease: true
        },
      notifications: [],
      importedDrumPreset: null,
      importedMultisamplePreset: null
    },
    dispatch: vi.fn()
  }))
}))

// Mock the audio utilities
vi.mock('../../utils/audio', () => ({
  readWavMetadata: vi.fn(() => Promise.resolve({
    sampleRate: 44100,
    numberOfChannels: 1,
    length: 44100,
    duration: 1.0,
    fileSize: 1024,
    audioBuffer: {
      sampleRate: 44100,
      numberOfChannels: 1,
      length: 44100,
      duration: 1.0,
      getChannelData: vi.fn(() => new Float32Array(44100))
    }
  }))
}))

// Get access to the mocked functions
const mockDispatch = vi.fn()

// Import after mocking
import { useAppContext } from '../../context/AppContext'
import * as audioModule from '../../utils/audio'

describe('useFileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mocks to default implementations
    vi.mocked(useAppContext).mockReturnValue({ 
      state: {
        currentTab: 'drum',
        drumSamples: [],
        multisampleFiles: [],
        selectedMultisample: null,
        isLoading: false,
        error: null,
        isDrumKeyboardPinned: false,
        isMultisampleKeyboardPinned: false,
        drumSettings: {
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          presetName: '',
          normalize: false,
          normalizeLevel: 0,
          presetSettings: {
            playmode: 'poly',
            transpose: 0,
            velocity: 100,
            volume: 100,
            width: 100
          }
        },
        multisampleSettings: {
          sampleRate: 0,
          bitDepth: 0,
          channels: 0,
          presetName: '',
          normalize: false,
          normalizeLevel: -6.0,
          cutAtLoopEnd: false,
          gain: 0,
          loopEnabled: true,
          loopOnRelease: true
        },
        notifications: [],
        importedDrumPreset: null,
        importedMultisamplePreset: null
      },
      dispatch: mockDispatch 
    })
    vi.mocked(audioModule.readWavMetadata).mockResolvedValue({
      sampleRate: 44100,
      numberOfChannels: 1,
      length: 44100,
      duration: 1.0,
      fileSize: 1024,
      audioBuffer: {
        sampleRate: 44100,
        numberOfChannels: 1,
        length: 44100,
        duration: 1.0,
        getChannelData: vi.fn(() => new Float32Array(44100))
      } as any
    } as any)
  })

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
    vi.mocked(audioModule.readWavMetadata).mockRejectedValueOnce(new Error('Invalid audio file'))

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