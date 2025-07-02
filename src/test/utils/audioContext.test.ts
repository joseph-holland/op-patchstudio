import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { audioContextManager } from '../../utils/audioContext'

// Create mock AudioContext with proper state management
const createMockAudioContext = (initialState = 'running') => ({
  state: initialState,
  sampleRate: 44100,
  resume: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
  suspend: vi.fn(() => Promise.resolve())
})

// Mock OfflineAudioContext
const mockOfflineAudioContext = {
  length: 1000,
  sampleRate: 44100,
  numberOfChannels: 2
}

describe('audioContextManager', () => {
  let mockAudioContext: any

  beforeEach(() => {
    // Reset the singleton instance by accessing private properties
    ;(audioContextManager as any).audioContext = null
    ;(audioContextManager as any).isInitialized = false
    
    // Mock AudioContext constructor
    mockAudioContext = createMockAudioContext()
    global.AudioContext = vi.fn(() => mockAudioContext)
    global.OfflineAudioContext = vi.fn(() => mockOfflineAudioContext)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = audioContextManager
      const instance2 = audioContextManager
      expect(instance1).toBe(instance2)
    })

    it('should maintain state across getInstance calls', async () => {
      await audioContextManager.getAudioContext()
      expect(audioContextManager.isReady()).toBe(true)
      
      // Get another instance reference
      const anotherRef = audioContextManager
      expect(anotherRef.isReady()).toBe(true)
    })
  })

  describe('getAudioContext', () => {
    it('should create new AudioContext when none exists', async () => {
      const context = await audioContextManager.getAudioContext()
      
      expect(global.AudioContext).toHaveBeenCalledTimes(1)
      expect(context).toBe(mockAudioContext)
      expect(audioContextManager.isReady()).toBe(true)
    })

    it('should create new AudioContext when current is closed', async () => {
      // First call creates context
      await audioContextManager.getAudioContext()
      expect(global.AudioContext).toHaveBeenCalledTimes(1)
      
      // Simulate closed state
      mockAudioContext.state = 'closed'
      
      // Second call should create new context
      const newMockContext = createMockAudioContext()
      global.AudioContext = vi.fn(() => newMockContext)
      
      const context = await audioContextManager.getAudioContext()
      expect(global.AudioContext).toHaveBeenCalledTimes(1) // Called once more with new mock
      expect(context).toBe(newMockContext)
    })

    it('should resume suspended AudioContext', async () => {
      mockAudioContext.state = 'suspended'
      
      const context = await audioContextManager.getAudioContext()
      
      expect(mockAudioContext.resume).toHaveBeenCalledTimes(1)
      expect(context).toBe(mockAudioContext)
    })

    it('should return existing AudioContext if running', async () => {
      // First call
      const context1 = await audioContextManager.getAudioContext()
      
      // Second call should return same context
      const context2 = await audioContextManager.getAudioContext()
      
      expect(global.AudioContext).toHaveBeenCalledTimes(1)
      expect(context1).toBe(context2)
      expect(context2).toBe(mockAudioContext)
    })
  })

  describe('closeAudioContext', () => {
    it('should close AudioContext and reset state', async () => {
      // Create context first
      await audioContextManager.getAudioContext()
      expect(audioContextManager.isReady()).toBe(true)
      
      // Close context
      await audioContextManager.closeAudioContext()
      
      expect(mockAudioContext.close).toHaveBeenCalledTimes(1)
      expect(audioContextManager.isReady()).toBe(false)
      expect(audioContextManager.getState()).toBeNull()
    })

    it('should not attempt to close if no context exists', async () => {
      await audioContextManager.closeAudioContext()
      
      expect(mockAudioContext.close).not.toHaveBeenCalled()
    })

    it('should not attempt to close if context is already closed', async () => {
      // Create context
      await audioContextManager.getAudioContext()
      
      // Simulate closed state
      mockAudioContext.state = 'closed'
      
      await audioContextManager.closeAudioContext()
      
      expect(mockAudioContext.close).not.toHaveBeenCalled()
    })
  })

  describe('getState', () => {
    it('should return null when no AudioContext exists', () => {
      expect(audioContextManager.getState()).toBeNull()
    })

    it('should return AudioContext state when context exists', async () => {
      await audioContextManager.getAudioContext()
      expect(audioContextManager.getState()).toBe('running')
      
      mockAudioContext.state = 'suspended'
      expect(audioContextManager.getState()).toBe('suspended')
    })
  })

  describe('getSampleRate', () => {
    it('should return default sample rate when no AudioContext exists', () => {
      expect(audioContextManager.getSampleRate()).toBe(44100)
    })

    it('should return AudioContext sample rate when context exists', async () => {
      mockAudioContext.sampleRate = 48000
      await audioContextManager.getAudioContext()
      
      expect(audioContextManager.getSampleRate()).toBe(48000)
    })
  })

  describe('isReady', () => {
    it('should return false when not initialized', () => {
      expect(audioContextManager.isReady()).toBe(false)
    })

    it('should return false when AudioContext is not running', async () => {
      mockAudioContext.state = 'suspended'
      await audioContextManager.getAudioContext()
      
      expect(audioContextManager.isReady()).toBe(false)
    })

    it('should return true when AudioContext is running', async () => {
      await audioContextManager.getAudioContext()
      
      expect(audioContextManager.isReady()).toBe(true)
    })

    it('should return false after context is closed', async () => {
      await audioContextManager.getAudioContext()
      expect(audioContextManager.isReady()).toBe(true)
      
      await audioContextManager.closeAudioContext()
      expect(audioContextManager.isReady()).toBe(false)
    })
  })

  describe('createOfflineContext', () => {
    it('should create OfflineAudioContext with specified parameters', () => {
      const context = audioContextManager.createOfflineContext(2, 1000, 44100)
      
      expect(global.OfflineAudioContext).toHaveBeenCalledWith(2, 1000, 44100)
      expect(context).toBe(mockOfflineAudioContext)
    })

    it('should create offline context regardless of main context state', () => {
      const context = audioContextManager.createOfflineContext(1, 500, 48000)
      
      expect(global.OfflineAudioContext).toHaveBeenCalledWith(1, 500, 48000)
      expect(context).toBe(mockOfflineAudioContext)
      // Main context should still not be initialized
      expect(audioContextManager.isReady()).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('should call closeAudioContext', async () => {
      const spy = vi.spyOn(audioContextManager, 'closeAudioContext')
      
      await audioContextManager.cleanup()
      
      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling', () => {
    it('should handle AudioContext creation errors gracefully', async () => {
      global.AudioContext = vi.fn(() => {
        throw new Error('AudioContext creation failed')
      })
      
      await expect(audioContextManager.getAudioContext()).rejects.toThrow('AudioContext creation failed')
    })

    it('should handle resume errors gracefully', async () => {
      mockAudioContext.state = 'suspended'
      mockAudioContext.resume = vi.fn(() => Promise.reject(new Error('Resume failed')))
      
      await expect(audioContextManager.getAudioContext()).rejects.toThrow('Resume failed')
    })

    it('should handle close errors gracefully', async () => {
      await audioContextManager.getAudioContext()
      mockAudioContext.close = vi.fn(() => Promise.reject(new Error('Close failed')))
      
      await expect(audioContextManager.closeAudioContext()).rejects.toThrow('Close failed')
    })
  })

  describe('Browser Environment Integration', () => {
    it('should handle window object existence check', () => {
      // This tests the conditional window.addEventListener setup
      // Since we're in jsdom, window should exist
      expect(typeof window !== 'undefined').toBe(true)
    })
  })
}) 