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

  beforeEach(async () => {
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
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
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
}); 