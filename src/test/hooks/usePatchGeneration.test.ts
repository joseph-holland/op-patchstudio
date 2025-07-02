import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePatchGeneration } from '../../hooks/usePatchGeneration'

// Mock the context hook to avoid needing the provider
vi.mock('../../context/AppContext', () => ({
  useAppContext: vi.fn()
}))

// Mock dependencies
vi.mock('../../utils/patchGeneration', () => ({
  generateDrumPatch: vi.fn(() => Promise.resolve(new Blob(['mock patch'], { type: 'application/zip' }))),
  generateMultisamplePatch: vi.fn(() => Promise.resolve(new Blob(['mock patch'], { type: 'application/zip' }))),
  downloadBlob: vi.fn()
}))

// Get access to mocked functions
const mockDispatch = vi.fn()

// Import after mocking
import { useAppContext } from '../../context/AppContext'
import * as patchModule from '../../utils/patchGeneration'

// Default mock implementation
const defaultMockState = {
  state: {
    currentTab: 'drum' as const,
    drumSamples: [{ isLoaded: true, name: 'test' }] as any,
    multisampleFiles: [{ fileName: 'test.wav' }] as any,
    selectedMultisample: null,
    isLoading: false,
    error: null,
    isDrumKeyboardPinned: false,
    isMultisampleKeyboardPinned: false,
    drumSettings: {
      sampleRate: 44100,
      bitDepth: 16,
      channels: 2,
      presetName: 'Test Kit',
      normalize: false,
      normalizeLevel: 0,
      presetSettings: {
        playmode: 'poly' as const,
        transpose: 0,
        velocity: 100,
        volume: 100,
        width: 100
      }
    },
    multisampleSettings: {
      sampleRate: 44100,
      bitDepth: 16,
      channels: 2,
      presetName: 'Test Multisample',
      normalize: false,
      normalizeLevel: 0,
      cutAtLoopEnd: false
    },
    notifications: [],
    importedDrumPreset: null,
    importedMultisamplePreset: null
  },
  dispatch: mockDispatch
}

describe('usePatchGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAppContext).mockReturnValue(defaultMockState)
  })

  it('should provide expected functions', () => {
    const { result } = renderHook(() => usePatchGeneration())
    
    expect(typeof result.current.generateDrumPatchFile).toBe('function')
    expect(typeof result.current.generateMultisamplePatchFile).toBe('function')
  })

  it('should handle drum patch generation', async () => {
    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateDrumPatchFile('Test Drum Kit')
    })
    
    expect(vi.mocked(patchModule.generateDrumPatch)).toHaveBeenCalled()
    expect(vi.mocked(patchModule.downloadBlob)).toHaveBeenCalled()
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_LOADING'
      })
    )
  })

  it('should handle multisample patch generation', async () => {
    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateMultisamplePatchFile('Test Multisample')
    })
    
    expect(vi.mocked(patchModule.generateMultisamplePatch)).toHaveBeenCalled()
    expect(vi.mocked(patchModule.downloadBlob)).toHaveBeenCalled()
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_LOADING'
      })
    )
  })

  it('should handle generation errors', async () => {
    vi.mocked(patchModule.generateDrumPatch).mockRejectedValueOnce(new Error('Generation failed'))
    
    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateDrumPatchFile('Test')
    })
    
    // Should have called dispatch to set error state
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_ERROR'
      })
    )
  })

  it('should use default names when none provided', async () => {
    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateDrumPatchFile()
      await result.current.generateMultisamplePatchFile()
    })
    
    expect(vi.mocked(patchModule.generateDrumPatch)).toHaveBeenCalled()
    expect(vi.mocked(patchModule.generateMultisamplePatch)).toHaveBeenCalled()
  })

  it('should handle no samples loaded error', async () => {
    // Override mock for this test
    vi.mocked(useAppContext).mockReturnValue({
      state: {
        currentTab: 'drum' as const,
        drumSamples: [], // No loaded samples
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
          presetName: 'Test',
          normalize: false,
          normalizeLevel: 0,
          presetSettings: {
            playmode: 'poly' as const,
            transpose: 0,
            velocity: 100,
            volume: 100,
            width: 100
          }
        },
        multisampleSettings: {
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          presetName: 'Test',
          normalize: false,
          normalizeLevel: 0,
          cutAtLoopEnd: false
        },
        notifications: [],
        importedDrumPreset: null,
        importedMultisamplePreset: null
      },
      dispatch: mockDispatch
    })

    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateDrumPatchFile()
      await result.current.generateMultisamplePatchFile()
    })
    
    // Should have called dispatch to set error state for both
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_ERROR',
        payload: 'No samples loaded'
      })
    )
  })
})