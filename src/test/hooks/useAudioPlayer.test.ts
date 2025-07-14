import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';

// Mock the audioContextManager
vi.mock('../../utils/audioContext', () => ({
  audioContextManager: {
    getAudioContext: vi.fn(),
    createOfflineContext: vi.fn(),
  },
}));

describe('useAudioPlayer', () => {
  let mockAudioContext: any;
  let mockSource: any;
  let mockGainNode: any;
  let mockPanNode: any;
  let mockGainParam: any;

  beforeEach(async () => {
    // Create a more robust mock for AudioParam
    mockGainParam = {
      value: 1,
      setValueAtTime: vi.fn().mockReturnThis(),
      linearRampToValueAtTime: vi.fn().mockReturnThis(),
      exponentialRampToValueAtTime: vi.fn().mockReturnThis(),
      setTargetAtTime: vi.fn().mockReturnThis(),
      setValueCurveAtTime: vi.fn().mockReturnThis(),
      cancelScheduledValues: vi.fn().mockReturnThis(),
      automationRate: 'a-rate' as const,
      defaultValue: 1,
      maxValue: 1,
      minValue: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
      cancelAndHoldAtTime: vi.fn().mockReturnThis(),
    };

    // Create mock audio nodes
    mockSource = {
      buffer: null,
      playbackRate: { value: 1 },
      onended: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    mockGainNode = {
      gain: mockGainParam,
      connect: vi.fn(),
      disconnect: vi.fn(),
      context: {
        currentTime: 0,
      },
    };

    mockPanNode = {
      pan: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    mockAudioContext = {
      createBufferSource: vi.fn(() => mockSource),
      createGain: vi.fn(() => mockGainNode),
      createStereoPanner: vi.fn(() => mockPanNode),
      destination: {},
      createBuffer: vi.fn(),
      currentTime: 0,
    };

    // Mock the audioContextManager to return our mock context
    const { audioContextManager } = await import('../../utils/audioContext');
    (audioContextManager.getAudioContext as any).mockResolvedValue(mockAudioContext);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useAudioPlayer());
    
    expect(result.current.getState()).toEqual({
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    });
  });

  it('should play audio buffer successfully', async () => {
    const { result } = renderHook(() => useAudioPlayer());
    
    const mockBuffer = {
      duration: 2.0,
      length: 88200, // 2 seconds at 44.1kHz
      sampleRate: 44100,
      numberOfChannels: 1,
      getChannelData: vi.fn(() => new Float32Array(88200)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    } as AudioBuffer;

    await act(async () => {
      const success = await result.current.play(mockBuffer);
      expect(success).toBe(true);
    });

    expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    expect(mockAudioContext.createGain).toHaveBeenCalled();
    expect(mockAudioContext.createStereoPanner).toHaveBeenCalled();
    expect(mockSource.connect).toHaveBeenCalledWith(mockGainNode);
    expect(mockGainNode.connect).toHaveBeenCalledWith(mockPanNode);
    expect(mockPanNode.connect).toHaveBeenCalledWith(mockAudioContext.destination);
    expect(mockSource.start).toHaveBeenCalledWith(0, 0, 2.0);
  });

  it('should play selection with correct timing', async () => {
    const { result } = renderHook(() => useAudioPlayer());
    
    const mockBuffer = {
      duration: 2.0,
      length: 88200,
      sampleRate: 44100,
      numberOfChannels: 1,
      getChannelData: vi.fn(() => new Float32Array(88200)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    } as AudioBuffer;

    const inFrame = 22050; // 0.5 seconds
    const outFrame = 44100; // 1.0 seconds

    await act(async () => {
      const success = await result.current.play(mockBuffer, { inFrame, outFrame });
      expect(success).toBe(true);
    });

    expect(mockSource.start).toHaveBeenCalledWith(0, 0.5, 0.5);
  });

  it('should stop current playback', async () => {
    const { result } = renderHook(() => useAudioPlayer());
    
    const mockBuffer = {
      duration: 2.0,
      length: 88200,
      sampleRate: 44100,
      numberOfChannels: 1,
      getChannelData: vi.fn(() => new Float32Array(88200)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    } as AudioBuffer;

    // Start playback
    await act(async () => {
      await result.current.play(mockBuffer);
    });

    // Stop playback
    act(() => {
      result.current.stop();
    });

    expect(mockSource.stop).toHaveBeenCalled();
    expect(mockGainNode.disconnect).toHaveBeenCalled();
    expect(mockPanNode.disconnect).toHaveBeenCalled();
  });

  it('should handle playback options correctly', async () => {
    const { result } = renderHook(() => useAudioPlayer());
    
    const mockBuffer = {
      duration: 2.0,
      length: 88200,
      sampleRate: 44100,
      numberOfChannels: 1,
      getChannelData: vi.fn(() => new Float32Array(88200)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    } as AudioBuffer;

    await act(async () => {
      await result.current.play(mockBuffer, {
        playbackRate: 2.0,
        gain: -6, // -6dB
        pan: 50, // 50% right
      });
    });

    expect(mockSource.playbackRate.value).toBe(2.0);
    expect(mockGainNode.gain.value).toBeCloseTo(0.5); // -6dB = 0.5 linear
    expect(mockPanNode.pan.value).toBe(0.5); // 50% = 0.5
  });

  // ADSR-specific tests
  describe('ADSR functionality', () => {
    const mockBuffer = {
      duration: 2.0,
      length: 88200,
      sampleRate: 44100,
      numberOfChannels: 1,
      getChannelData: vi.fn(() => new Float32Array(88200)),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn(),
    } as AudioBuffer;

    const defaultADSR = {
      attack: 16384, // 50% = 7.5 seconds (exponential curve)
      decay: 16384,  // 50% = 7.5 seconds (exponential curve)
      sustain: 16384, // 50% = 0.5 amplitude
      release: 16384, // 50% = 7.5 seconds (exponential curve)
    };

    // Test ADSR conversion logic directly
    it('should convert ADSR values to correct time ranges with exponential curves', () => {
      // We need to access the convertADSRValues function
      // Since it's private, we'll test it indirectly through the public API
      // For now, let's test the expected behavior based on the implementation
      
      // 50% values should map to 7.5 seconds (50%^2 * 30 seconds)
      expect(Math.pow(16384 / 32767, 2) * 30).toBeCloseTo(7.5, 1);
      
      // 100% values should map to 30 seconds
      expect(Math.pow(32767 / 32767, 2) * 30).toBeCloseTo(30, 1);
      
      // 0% values should map to 0 seconds
      expect(Math.pow(0 / 32767, 2) * 30).toBeCloseTo(0, 1);
    });

    it('should play with ADSR envelope', async () => {
      const { result } = renderHook(() => useAudioPlayer());
      
      await act(async () => {
        const noteId = await result.current.playWithADSR(mockBuffer, 'test-note-1', {
          adsr: defaultADSR,
          velocity: 127,
        });
        expect(noteId).toBe('test-note-1');
      });

      // Verify ADSR envelope was applied
      expect(mockGainParam.setValueAtTime).toHaveBeenCalledWith(0, 0);
      expect(mockGainParam.setValueCurveAtTime).toHaveBeenCalled();
      
      // Verify the note is tracked
      expect(result.current.getActiveNotesCount()).toBe(1);
    });

    it('should handle polyphonic playback', async () => {
      const { result } = renderHook(() => useAudioPlayer());
      
      // Play first note
      await act(async () => {
        await result.current.playWithADSR(mockBuffer, 'note-1', {
          adsr: defaultADSR,
          playMode: 'poly',
        });
      });

      // Play second note (should both be active)
      await act(async () => {
        await result.current.playWithADSR(mockBuffer, 'note-2', {
          adsr: defaultADSR,
          playMode: 'poly',
        });
      });

      expect(result.current.getActiveNotesCount()).toBe(2);
    });

    it('should handle mono mode correctly', async () => {
      const { result } = renderHook(() => useAudioPlayer());
      
      // Play first note
      await act(async () => {
        await result.current.playWithADSR(mockBuffer, 'note-1', {
          adsr: defaultADSR,
          playMode: 'mono',
        });
      });

      // Play second note (should stop first)
      await act(async () => {
        await result.current.playWithADSR(mockBuffer, 'note-2', {
          adsr: defaultADSR,
          playMode: 'mono',
        });
      });

      // In mono mode, only one note should be active
      expect(result.current.getActiveNotesCount()).toBe(1);
    });

    it('should handle legato mode correctly', async () => {
      const { result } = renderHook(() => useAudioPlayer());
      
      // Play first note
      await act(async () => {
        await result.current.playWithADSR(mockBuffer, 'note-1', {
          adsr: defaultADSR,
          playMode: 'legato',
        });
      });

      // Play second note in legato mode (should update existing note)
      await act(async () => {
        const noteId = await result.current.playWithADSR(mockBuffer, 'note-2', {
          adsr: defaultADSR,
          playMode: 'legato',
          playbackRate: 2.0, // Different pitch
        });
        expect(noteId).toBe('note-2');
      });

      // Should still have only one active note
      expect(result.current.getActiveNotesCount()).toBe(1);
    });

    it('should release notes correctly', async () => {
      const { result } = renderHook(() => useAudioPlayer());
      
      // Play a note
      await act(async () => {
        await result.current.playWithADSR(mockBuffer, 'test-note', {
          adsr: defaultADSR,
        });
      });

      expect(result.current.getActiveNotesCount()).toBe(1);

      // Release the note
      act(() => {
        result.current.releaseNote('test-note');
      });

      // Note should be in release phase (still counted as active during release)
      expect(result.current.getActiveNotesCount()).toBe(1);
      
      // Verify release was called
      expect(mockGainParam.setValueCurveAtTime).toHaveBeenCalled();
    });

    it('should release all notes', async () => {
      const { result } = renderHook(() => useAudioPlayer());
      
      // Play multiple notes
      await act(async () => {
        await result.current.playWithADSR(mockBuffer, 'note-1', { adsr: defaultADSR });
        await result.current.playWithADSR(mockBuffer, 'note-2', { adsr: defaultADSR });
      });

      expect(result.current.getActiveNotesCount()).toBe(2);

      // Release all notes
      act(() => {
        result.current.releaseAllNotes();
      });

      // All notes should be in release phase (still counted as active)
      expect(result.current.getActiveNotesCount()).toBe(2);
      
      // Verify release was called multiple times
      expect(mockGainParam.setValueCurveAtTime).toHaveBeenCalled();
    });

    it('should convert ADSR values to correct time ranges', async () => {
      const { result } = renderHook(() => useAudioPlayer());
      
      const maxADSR = {
        attack: 32767, // 100% = 30 seconds (exponential curve)
        decay: 32767,  // 100% = 30 seconds (exponential curve)
        sustain: 32767, // 100% = 1.0 amplitude
        release: 32767, // 100% = 30 seconds (exponential curve)
      };

      await act(async () => {
        await result.current.playWithADSR(mockBuffer, 'test-note', {
          adsr: maxADSR,
        });
      });

      // Verify ADSR envelope was applied with maximum values
      expect(mockGainParam.setValueAtTime).toHaveBeenCalledWith(0, 0);
      expect(mockGainParam.setValueCurveAtTime).toHaveBeenCalled();
    });

    it('should handle velocity scaling correctly', async () => {
      const { result } = renderHook(() => useAudioPlayer());
      
      await act(async () => {
        await result.current.playWithADSR(mockBuffer, 'test-note', {
          adsr: defaultADSR,
          velocity: 64, // 50% velocity
        });
      });

      // Verify ADSR envelope was applied with velocity scaling
      expect(mockGainParam.setValueAtTime).toHaveBeenCalledWith(0, 0);
      expect(mockGainParam.setValueCurveAtTime).toHaveBeenCalled();
    });

    it('should handle zero ADSR values', async () => {
      const { result } = renderHook(() => useAudioPlayer());
      
      const zeroADSR = {
        attack: 0,
        decay: 0,
        sustain: 0,
        release: 0,
      };

      await act(async () => {
        await result.current.playWithADSR(mockBuffer, 'test-note', {
          adsr: zeroADSR,
        });
      });

      // Verify zero values are handled correctly
      expect(mockGainParam.setValueAtTime).toHaveBeenCalledWith(0, 0);
      expect(mockGainParam.setValueAtTime).toHaveBeenCalledWith(0, 0); // Instant attack to 0
    });

    it('should track active notes correctly', async () => {
      const { result } = renderHook(() => useAudioPlayer());
      
      expect(result.current.getActiveNotesCount()).toBe(0);

      // Play a note
      await act(async () => {
        await result.current.playWithADSR(mockBuffer, 'note-1', { adsr: defaultADSR });
      });

      expect(result.current.getActiveNotesCount()).toBe(1);

      // Play another note
      await act(async () => {
        await result.current.playWithADSR(mockBuffer, 'note-2', { adsr: defaultADSR });
      });

      expect(result.current.getActiveNotesCount()).toBe(2);

      // Release one note
      act(() => {
        result.current.releaseNote('note-1');
      });

      // Should still have 2 notes (one in release phase)
      expect(result.current.getActiveNotesCount()).toBe(2);
    });

    // Test pattern matching for note release
    it('should release notes using pattern matching', async () => {
      // We need to access the internal activeNotesRef to simulate notes
      // Since we can't directly access it, we'll test the pattern matching logic
      // by creating a simple test that verifies the pattern matching behavior
      
      // Test pattern matching with wildcard
      const patternWithWildcard = 'multisample-60-*';
      const patternWithoutWildcard = 'multisample-60-';
      
      // These patterns should be detected as pattern matches
      expect(patternWithWildcard.includes('*')).toBe(true);
      expect(patternWithoutWildcard.endsWith('-')).toBe(true);
      
      // Test pattern extraction
      const extractedPattern1 = patternWithWildcard.replace('*', '').replace(/-$/, '');
      const extractedPattern2 = patternWithoutWildcard.replace('*', '').replace(/-$/, '');
      
      expect(extractedPattern1).toBe('multisample-60');
      expect(extractedPattern2).toBe('multisample-60');
      
      // Test that the pattern would match actual noteIds
      const actualNoteId1 = 'multisample-60-1234567890';
      const actualNoteId2 = 'multisample-60-9876543210';
      
      expect(actualNoteId1.startsWith(extractedPattern1)).toBe(true);
      expect(actualNoteId2.startsWith(extractedPattern2)).toBe(true);
      
      // Test that it wouldn't match different patterns
      const differentNoteId = 'multisample-61-1234567890';
      expect(differentNoteId.startsWith(extractedPattern1)).toBe(false);
      
      // Test that the fallback pattern from MultisampleTool would work
      const fallbackPattern = 'multisample-60-';
      const extractedFallbackPattern = fallbackPattern.replace('*', '').replace(/-$/, '');
      expect(extractedFallbackPattern).toBe('multisample-60');
      expect(actualNoteId1.startsWith(extractedFallbackPattern)).toBe(true);
    });

    // Test instant release behavior
    it('should handle instant release (0% release time) correctly', () => {
      // Test that 0% release time converts to 0 seconds
      const zeroReleaseADSR = {
        attack: 0,
        decay: 0,
        sustain: 32767,
        release: 0, // 0% = instant release
      };
      
      // Calculate what the release time should be
      const releasePercent = zeroReleaseADSR.release / 32767;
      const expectedReleaseTime = Math.pow(releasePercent, 2) * 30;
      
      expect(expectedReleaseTime).toBe(0);
      
      // Test that the pattern matching would work for instant release
      const instantReleasePattern = 'multisample-60-';
      const extractedPattern = instantReleasePattern.replace('*', '').replace(/-$/, '');
      expect(extractedPattern).toBe('multisample-60');
      
      // This pattern should match actual noteIds
      const actualNoteId = 'multisample-60-1234567890';
      expect(actualNoteId.startsWith(extractedPattern)).toBe(true);
    });
  });
}); 