import { useCallback, useRef } from 'react';
import { audioContextManager } from '../utils/audioContext';

export interface AudioPlaybackOptions {
  startTime?: number;
  duration?: number;
  playbackRate?: number;
  gain?: number;
  pan?: number;
  reverse?: boolean;
}

export interface AudioPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

export function useAudioPlayer() {
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentGainNodeRef = useRef<GainNode | null>(null);
  const currentPanNodeRef = useRef<StereoPannerNode | null>(null);
  const stateRef = useRef<AudioPlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
  });

  const stopCurrentPlayback = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (error) {
        // Source might already be stopped
      }
      currentSourceRef.current = null;
    }
    if (currentGainNodeRef.current) {
      currentGainNodeRef.current.disconnect();
      currentGainNodeRef.current = null;
    }
    if (currentPanNodeRef.current) {
      currentPanNodeRef.current.disconnect();
      currentPanNodeRef.current = null;
    }
    stateRef.current.isPlaying = false;
  }, []);

  const play = useCallback(async (
    audioBuffer: AudioBuffer,
    options: AudioPlaybackOptions & {
      inFrame?: number;
      outFrame?: number;
    } = {}
  ) => {
    try {
      const audioContext = await audioContextManager.getAudioContext();
      let buffer = audioBuffer;

      // Apply reverse if enabled
      if (options.reverse) {
        const revBuffer = audioContext.createBuffer(
          buffer.numberOfChannels,
          buffer.length,
          buffer.sampleRate
        );
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
          const srcData = buffer.getChannelData(ch);
          const dstData = revBuffer.getChannelData(ch);
          for (let i = 0, j = srcData.length - 1; i < srcData.length; i++, j--) {
            dstData[i] = srcData[j];
          }
        }
        buffer = revBuffer;
      }

      // Create audio nodes
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      const panNode = audioContext.createStereoPanner();

      // Store references
      currentSourceRef.current = source;
      currentGainNodeRef.current = gainNode;
      currentPanNodeRef.current = panNode;

      // Configure source
      source.buffer = buffer;
      source.playbackRate.value = options.playbackRate || 1;

      // Configure gain
      const gainValue = options.gain !== undefined ? Math.pow(10, options.gain / 20) : 1;
      gainNode.gain.value = gainValue;

      // Configure pan
      const panValue = options.pan !== undefined ? Math.max(-1, Math.min(1, options.pan / 100)) : 0;
      panNode.pan.value = panValue;

      // Connect nodes
      source.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(audioContext.destination);

      // Set up event handlers
      source.onended = () => {
        stateRef.current.isPlaying = false;
        currentSourceRef.current = null;
        currentGainNodeRef.current = null;
        currentPanNodeRef.current = null;
      };

      // Calculate timing - support both frame-based and time-based selection
      let startTime = options.startTime || 0;
      let duration = options.duration || (buffer.duration - startTime);

      // If frame-based selection is provided, calculate timing from frames
      if (options.inFrame !== undefined && options.outFrame !== undefined) {
        startTime = (options.inFrame / audioBuffer.length) * audioBuffer.duration;
        const endTime = (options.outFrame / audioBuffer.length) * audioBuffer.duration;
        duration = endTime - startTime;
      }

      // Update state
      stateRef.current.isPlaying = true;
      stateRef.current.currentTime = startTime;
      stateRef.current.duration = duration;

      // Start playback
      if (duration > 0) {
        source.start(0, startTime, duration);
      } else {
        source.start(0, startTime);
      }

      return true;
    } catch (error) {
      console.error('Error playing audio:', error);
      stateRef.current.isPlaying = false;
      return false;
    }
  }, [stopCurrentPlayback]);

  const stop = useCallback(() => {
    stopCurrentPlayback();
  }, [stopCurrentPlayback]);

  const getState = useCallback((): AudioPlayerState => {
    return { ...stateRef.current };
  }, []);

  return {
    play,
    stop,
    stopCurrentPlayback,
    getState,
  };
} 