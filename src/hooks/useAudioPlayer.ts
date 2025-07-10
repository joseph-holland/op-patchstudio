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

// ADSR envelope interface
export interface ADSRValues {
  attack: number;   // 0-32767 (time)
  decay: number;    // 0-32767 (time)
  sustain: number;  // 0-32767 (level)
  release: number;  // 0-32767 (time)
}

// ADSR-enabled playback options
export interface ADSRPlaybackOptions extends AudioPlaybackOptions {
  adsr?: ADSRValues;
  playMode?: 'poly' | 'mono' | 'legato';
  velocity?: number; // 0-127
  inFrame?: number;
  outFrame?: number;
}

// Note envelope state tracking
interface NoteEnvelopeState {
  noteId: string;
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  envelopePhase: 'attack' | 'decay' | 'sustain' | 'release' | 'finished';
  startTime: number;
  releaseTime?: number;
  currentGain: number;
  adsr: ADSRValues;
  velocity: number;
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

  // ADSR-specific state
  const activeNotesRef = useRef<Map<string, NoteEnvelopeState>>(new Map());
  const lastNoteRef = useRef<NoteEnvelopeState | null>(null);

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



  // Convert 0-32767 ADSR values to seconds and levels
  const convertADSRValues = useCallback((adsr: ADSRValues) => {
    // Convert 0-32767 to 0-100%
    const attackPercent = adsr.attack / 32767;
    const decayPercent = adsr.decay / 32767;
    const sustainPercent = adsr.sustain / 32767;
    const releasePercent = adsr.release / 32767;

    // Map to time ranges with exponential curves for natural feel (0-30 seconds)
    // Attack: 0-30 seconds (exponential curve for more responsive low values)
    const attackTime = Math.pow(attackPercent, 2) * 30;
    
    // Decay: 0-30 seconds (exponential curve)
    const decayTime = Math.pow(decayPercent, 2) * 30;
    
    // Sustain: 0-1 (linear, this is a level)
    const sustainLevel = sustainPercent;
    
    // Release: 0-30 seconds (exponential curve)
    const releaseTime = Math.pow(releasePercent, 2) * 30;

    return { attackTime, decayTime, sustainLevel, releaseTime };
  }, []);

  // Generate exponential curve points for Web Audio API
  const generateExponentialCurve = useCallback((
    startValue: number,
    endValue: number,
    factor: number,
    numPoints: number = 50
  ): number[] => {
    const points: number[] = [];
    
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      // Exponential curve: fast start, slow finish (convex)
      const exponentialT = Math.exp(-factor * t);
      const value = startValue + (endValue - startValue) * (1 - exponentialT);
      points.push(value);
    }
    
    return points;
  }, []);

  // Apply ADSR envelope to a gain node using exponential curves
  const applyADSREnvelope = useCallback((
    gainNode: GainNode,
    adsr: ADSRValues,
    startTime: number
  ) => {
    const { attackTime, decayTime, sustainLevel } = convertADSRValues(adsr);
    
    // Set initial gain to 0
    gainNode.gain.setValueAtTime(0, startTime);
    
    if (attackTime > 0) {
      // Attack: exponential curve (factor 1.5 like the visual envelope)
      const attackCurve = generateExponentialCurve(0, 1, 1.5);
      gainNode.gain.setValueCurveAtTime(attackCurve, startTime, attackTime);
    } else {
      // Instant attack
      gainNode.gain.setValueAtTime(1, startTime);
    }
    
    const attackEndTime = startTime + attackTime;
    
    if (decayTime > 0) {
      // Decay: exponential curve to sustain level
      const decayCurve = generateExponentialCurve(1, sustainLevel, 2.0);
      gainNode.gain.setValueCurveAtTime(decayCurve, attackEndTime, decayTime);
    } else {
      // Instant decay to sustain
      gainNode.gain.setValueAtTime(sustainLevel, attackEndTime);
    }
    
    // Sustain level is maintained until note release
    const decayEndTime = attackEndTime + decayTime;
    gainNode.gain.setValueAtTime(sustainLevel, decayEndTime);
    
    // Return the sustain end time for release calculation
    return decayEndTime;
  }, [convertADSRValues, generateExponentialCurve]);

  // Release a note with ADSR envelope
  const releaseNoteWithADSR = useCallback((
    gainNode: GainNode,
    adsr: ADSRValues,
    releaseTime: number
  ) => {
    const { releaseTime: adsrReleaseTime } = convertADSRValues(adsr);
    
    if (adsrReleaseTime > 0) {
      // Release: exponential curve to 0
      const releaseCurve = generateExponentialCurve(gainNode.gain.value, 0, 2.0);
      gainNode.gain.setValueCurveAtTime(releaseCurve, releaseTime, adsrReleaseTime);
    } else {
      // Instant release
      gainNode.gain.setValueAtTime(0, releaseTime);
    }
  }, [convertADSRValues, generateExponentialCurve]);

  // Trigger release phase for a note
  const triggerRelease = useCallback((noteId: string) => {
    const noteState = activeNotesRef.current.get(noteId);
    if (!noteState) return;

    const audioContext = noteState.gainNode.context;
    const currentTime = audioContext.currentTime;

    // Use the new ADSR envelope release function
    releaseNoteWithADSR(noteState.gainNode, noteState.adsr, currentTime);
    noteState.envelopePhase = 'release';
    noteState.releaseTime = currentTime;

    // Get release time for cleanup
    const { releaseTime: adsrReleaseTime } = convertADSRValues(noteState.adsr);

    // Clean up after release phase
    setTimeout(() => {
      activeNotesRef.current.delete(noteId);
      noteState.source.disconnect();
      noteState.gainNode.disconnect();
    }, adsrReleaseTime * 1000);
  }, [releaseNoteWithADSR, convertADSRValues]);

  // Play with ADSR envelope support
  const playWithADSR = useCallback(async (
    audioBuffer: AudioBuffer,
    noteId: string,
    options: ADSRPlaybackOptions = {}
  ) => {
    try {
      const audioContext = await audioContextManager.getAudioContext();
      const playMode = options.playMode || 'poly';
      const velocity = options.velocity || 127;
      const adsr = options.adsr || { attack: 0, decay: 0, sustain: 32767, release: 0 };

      // Handle play mode logic
      if (playMode === 'mono') {
        // Stop all current notes immediately
        for (const [id, noteState] of activeNotesRef.current) {
          noteState.source.stop();
          noteState.gainNode.disconnect();
          activeNotesRef.current.delete(id);
        }
        lastNoteRef.current = null;
      } else if (playMode === 'legato' && lastNoteRef.current) {
        // In legato mode, if there's an active note, don't retrigger envelope
        // Just update the pitch/playback rate
        const lastNote = lastNoteRef.current;
        if (lastNote.envelopePhase !== 'finished') {
          // Update the existing note's playback rate instead of creating new one
          lastNote.source.playbackRate.value = options.playbackRate || 1;
          return noteId;
        }
      }

      // Create new audio nodes for this note
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      const panNode = audioContext.createStereoPanner();

      // Configure source
      source.buffer = audioBuffer;
      source.playbackRate.value = options.playbackRate || 1;

      // Configure pan
      const panValue = options.pan !== undefined ? Math.max(-1, Math.min(1, options.pan / 100)) : 0;
      panNode.pan.value = panValue;

      // Connect nodes
      source.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(audioContext.destination);

      // Apply ADSR envelope
      const startTime = audioContext.currentTime;
      applyADSREnvelope(gainNode, adsr, startTime);

      // Calculate timing
      let bufferStartTime = options.startTime || 0;
      let duration = options.duration || (audioBuffer.duration - bufferStartTime);

      if (options.inFrame !== undefined && options.outFrame !== undefined) {
        bufferStartTime = (options.inFrame / audioBuffer.length) * audioBuffer.duration;
        const endTime = (options.outFrame / audioBuffer.length) * audioBuffer.duration;
        duration = endTime - bufferStartTime;
      }

      // Start playback
      if (duration > 0) {
        source.start(0, bufferStartTime, duration);
      } else {
        source.start(0, bufferStartTime);
      }

      // Create note state
      const noteState: NoteEnvelopeState = {
        noteId,
        source,
        gainNode,
        envelopePhase: 'attack',
        startTime,
        currentGain: velocity / 127,
        adsr,
        velocity
      };

      // Store note state
      activeNotesRef.current.set(noteId, noteState);
      lastNoteRef.current = noteState;

      // Track all active multisample noteIds globally for robust release
      if (noteId.startsWith('multisample-')) {
        if (!Array.isArray((window as any).opPatchstudioActiveNotes)) {
          (window as any).opPatchstudioActiveNotes = [];
        }
        (window as any).opPatchstudioActiveNotes.push(noteId);
      }

      // Set up cleanup when source ends
      source.onended = () => {
        activeNotesRef.current.delete(noteId);
        if (lastNoteRef.current?.noteId === noteId) {
          lastNoteRef.current = null;
        }
        // Remove from global active notes
        if (noteId.startsWith('multisample-')) {
          const arr = (window as any).opPatchstudioActiveNotes;
          if (Array.isArray(arr)) {
            const idx = arr.indexOf(noteId);
            if (idx !== -1) arr.splice(idx, 1);
          }
        }
      };

      return noteId;
    } catch (error) {
      console.error('Error playing audio with ADSR:', error);
      return null;
    }
  }, [applyADSREnvelope, triggerRelease]);

  // Release a specific note
  const releaseNote = useCallback((noteId: string) => {
    triggerRelease(noteId);
  }, [triggerRelease]);

  // Release all notes
  const releaseAllNotes = useCallback(() => {
    for (const [noteId] of activeNotesRef.current) {
      triggerRelease(noteId);
    }
  }, [triggerRelease]);

  // Get active notes count
  const getActiveNotesCount = useCallback(() => {
    return activeNotesRef.current.size;
  }, []);

  const play = useCallback(async (
    audioBuffer: AudioBuffer,
    options: AudioPlaybackOptions & {
      inFrame?: number;
      outFrame?: number;
    } = {}
  ) => {
    // Stop any current playback
    stopCurrentPlayback();
    
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
    // ADSR-specific methods
    playWithADSR,
    releaseNote,
    releaseAllNotes,
    getActiveNotesCount,
  };
} 