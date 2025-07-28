import { useCallback, useRef, useEffect } from 'react';
import { audioContextManager } from '../utils/audioContext';
import { AUDIO_CONSTANTS } from '../utils/constants';

// Type declaration for global active notes
declare global {
  interface Window {
    opPatchstudioActiveNotes?: string[];
  }
}

// Utility functions for safe global active notes management
const getGlobalActiveNotes = (): string[] => {
  if (typeof window === 'undefined') return [];
  if (!Array.isArray(window.opPatchstudioActiveNotes)) {
    window.opPatchstudioActiveNotes = [];
  }
  return window.opPatchstudioActiveNotes;
};

const addToGlobalActiveNotes = (noteId: string): void => {
  if (typeof window === 'undefined') return;
  const activeNotes = getGlobalActiveNotes();
  if (!activeNotes.includes(noteId)) {
    activeNotes.push(noteId);
  }
};

const removeFromGlobalActiveNotes = (noteId: string): void => {
  if (typeof window === 'undefined') return;
  const activeNotes = getGlobalActiveNotes();
  const idx = activeNotes.indexOf(noteId);
  if (idx !== -1) {
    activeNotes.splice(idx, 1);
  }
};

export interface AudioPlaybackOptions {
  startTime?: number;
  duration?: number;
  playbackRate?: number;
  gain?: number;
  pan?: number;
  reverse?: boolean;
  loopEnabled?: boolean;
  loopOnRelease?: boolean;
  loopStart?: number; // in seconds
  loopEnd?: number; // in seconds
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
  // Loop settings
  loopEnabled: boolean;
  loopOnRelease: boolean;
  loopStart?: number;
  loopEnd?: number;
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
  
  // Track active timers for cleanup
  const activeTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Cleanup function to clear all active timers
  const clearAllTimers = useCallback(() => {
    activeTimersRef.current.forEach(timerId => {
      clearTimeout(timerId);
    });
    activeTimersRef.current.clear();
  }, []);

  // Cleanup function to add a timer to tracking
  const addTimer = useCallback((timerId: ReturnType<typeof setTimeout>) => {
    activeTimersRef.current.add(timerId);
  }, []);

  // Cleanup function to remove a timer from tracking
  const removeTimer = useCallback((timerId: ReturnType<typeof setTimeout>) => {
    activeTimersRef.current.delete(timerId);
  }, []);

  // Centralized cleanup function for note state
  const cleanupNoteState = useCallback((noteId: string, noteState: NoteEnvelopeState) => {
    try {
      // Stop the audio source if it's still playing
      if (noteState.source && noteState.source.buffer) {
        noteState.source.stop();
      }
    } catch (error) {
      // Source might already be stopped - this is expected
    }

    try {
      // Disconnect audio nodes
      noteState.source.disconnect();
      noteState.gainNode.disconnect();
    } catch (error) {
      // Nodes might already be disconnected - this is expected
    }

    // Remove from active notes tracking
    activeNotesRef.current.delete(noteId);
    
    // Remove from global active notes if it's a multisample
    if (noteId.startsWith('multisample-')) {
      removeFromGlobalActiveNotes(noteId);
    }
    
    // Update envelope phase
    noteState.envelopePhase = 'finished';
    
    // Clear last note reference if this was the last note
    if (lastNoteRef.current?.noteId === noteId) {
      lastNoteRef.current = null;
    }
  }, []);

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

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Clear all active timers when component unmounts
      clearAllTimers();
      
      // Stop all active notes
      for (const [noteId, noteState] of activeNotesRef.current) {
        cleanupNoteState(noteId, noteState);
      }
      activeNotesRef.current.clear();
      
      // Stop current playback
      stopCurrentPlayback();
    };
  }, [clearAllTimers, stopCurrentPlayback]);

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
    startTime: number,
    velocityScale: number = 1
  ) => {
    const { attackTime, decayTime, sustainLevel } = convertADSRValues(adsr);
    
    // Scale the envelope by velocity
    const scaledSustainLevel = sustainLevel * velocityScale;
    const scaledAttackPeak = 1 * velocityScale;
    
    // Cancel any existing scheduled operations to prevent overlaps
    gainNode.gain.cancelScheduledValues(startTime);
    
    // Set initial gain to 0
    gainNode.gain.setValueAtTime(0, startTime);
    
    if (attackTime > 0) {
      // Attack: exponential curve (factor 1.5 like the visual envelope)
      const attackCurve = generateExponentialCurve(0, scaledAttackPeak, 1.5);
      gainNode.gain.setValueCurveAtTime(attackCurve, startTime, attackTime);
    } else {
      // Instant attack
      gainNode.gain.setValueAtTime(scaledAttackPeak, startTime);
    }
    
    const attackEndTime = startTime + attackTime;
    
    if (decayTime > 0) {
      // Decay: exponential curve to sustain level
      const decayCurve = generateExponentialCurve(scaledAttackPeak, scaledSustainLevel, 2.0);
      gainNode.gain.setValueCurveAtTime(decayCurve, attackEndTime, decayTime);
    } else {
      // Instant decay to sustain
      gainNode.gain.setValueAtTime(scaledSustainLevel, attackEndTime);
    }
    
    // Sustain level is maintained until note release
    const decayEndTime = attackEndTime + decayTime;
    gainNode.gain.setValueAtTime(scaledSustainLevel, decayEndTime);
    
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
    
    // Ensure we're not scheduling operations in the past
    const currentTime = gainNode.context.currentTime;
    const safeReleaseTime = Math.max(releaseTime, currentTime + AUDIO_CONSTANTS.AUDIO_SCHEDULE_BUFFER);
    
    // Cancel any pending scheduled operations to prevent overlaps
    gainNode.gain.cancelScheduledValues(safeReleaseTime);
    
    if (adsrReleaseTime > 0) {
      // Release: exponential curve to 0
      const releaseCurve = generateExponentialCurve(gainNode.gain.value, 0, 2.0);
      gainNode.gain.setValueCurveAtTime(releaseCurve, safeReleaseTime, adsrReleaseTime);
    } else {
      // Instant release
      gainNode.gain.setValueAtTime(0, safeReleaseTime);
    }
  }, [convertADSRValues, generateExponentialCurve]);

  // Trigger release phase for a note
  const triggerRelease = useCallback((noteId: string) => {
    const noteState = activeNotesRef.current.get(noteId);
    if (!noteState) return;

    // Prevent multiple release calls on the same note
    if (noteState.envelopePhase === 'release' || noteState.envelopePhase === 'finished') {
      return;
    }

    const audioContext = noteState.gainNode.context;
    const currentTime = audioContext.currentTime;

    // Handle loop on release behavior
    if (noteState.loopOnRelease) {
      // Enable looping if not already enabled
      if (!noteState.source.loop) {
        noteState.source.loop = true;
        noteState.source.loopStart = noteState.loopStart || 0;
        noteState.source.loopEnd = noteState.loopEnd || noteState.source.buffer?.duration || 1;
      }
      
      // For loop on release, apply a gentle release envelope but don't stop the note
      // This creates the effect of a sustaining loop that gradually fades
      noteState.envelopePhase = 'release';
      noteState.releaseTime = currentTime;
      
      // Apply the ADSR release curve for looped release
      const { releaseTime: adsrReleaseTime } = convertADSRValues(noteState.adsr);
      
      if (adsrReleaseTime > 0) {
        // Use the exact ADSR release time - respect user's envelope settings
        // Fade to zero like a normal release, but the loop continues playing
        const currentGain = noteState.gainNode.gain.value;
        const releaseCurve = generateExponentialCurve(currentGain, 0, 2.0);
        noteState.gainNode.gain.setValueCurveAtTime(releaseCurve, currentTime, adsrReleaseTime);
        
        // Schedule cleanup after the ADSR release time
        const timerId = setTimeout(() => {
          cleanupNoteState(noteState.noteId, noteState);
          removeTimer(timerId);
        }, adsrReleaseTime * 1000);
        
        // Add timer to tracking
        addTimer(timerId);
      } else {
        // Instant release - stop immediately
        cleanupNoteState(noteState.noteId, noteState);
      }
      
      // Don't clean up automatically - let the note loop indefinitely with reduced volume
      return;
    }

    // Standard release behavior (no loop on release)
    try {
      releaseNoteWithADSR(noteState.gainNode, noteState.adsr, currentTime);
      noteState.envelopePhase = 'release';
      noteState.releaseTime = currentTime;
    } catch (error) {
      console.warn('Error during ADSR release, falling back to instant stop:', error);
      // Fallback: use centralized cleanup
      cleanupNoteState(noteId, noteState);
      return;
    }

    // Get release time for cleanup
    const { releaseTime: adsrReleaseTime } = convertADSRValues(noteState.adsr);

    // For regular looping (loopEnabled), disable the loop when releasing so it can end naturally
    if (noteState.loopEnabled && !noteState.loopOnRelease) {
      noteState.source.loop = false;
    }

    // For instant release (0ms), stop the source and clean up immediately
    if (adsrReleaseTime <= 0) {
      try {
        noteState.source.stop();
      } catch (error) {
        // Source might already be stopped
      }
      // Small delay to ensure the gain change has been applied
      const timerId = setTimeout(() => {
        cleanupNoteState(noteId, noteState);
        removeTimer(timerId);
      }, 10);
      addTimer(timerId);
    } else {
      // Clean up after release phase
      const timerId = setTimeout(() => {
        // For looping notes, stop the source explicitly since it won't end naturally
        if (noteState.loopEnabled || noteState.loopOnRelease) {
          try {
            noteState.source.stop();
          } catch (error) {
            // Source might already be stopped
          }
        }
        cleanupNoteState(noteId, noteState);
        removeTimer(timerId);
      }, adsrReleaseTime * 1000);
      addTimer(timerId);
    }
  }, [releaseNoteWithADSR, convertADSRValues]);

  // Play with ADSR envelope support
  const playWithADSR = useCallback(async (
    audioBuffer: AudioBuffer,
    noteId: string,
    options: ADSRPlaybackOptions = {}
  ) => {
    try {
      const audioContext = await audioContextManager.getAudioContext();
      
      // Ensure audio context is fully ready before proceeding
      if (audioContext.state !== 'running' && typeof audioContext.resume === 'function') {
        console.warn('Audio context not running, attempting to resume...');
        await audioContext.resume();
        
        // Wait for the audio context to be fully running with proper error handling
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds maximum wait time
        const checkInterval = 100; // Check every 100ms
        
        while (attempts < maxAttempts) {
          const currentState = audioContext.state as string;
          if (currentState === 'running') {
            break;
          }
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          attempts++;
        }
        
        const finalState = audioContext.state as string;
        if (finalState !== 'running') {
          throw new Error(`Audio context failed to resume after ${maxAttempts * checkInterval}ms. State: ${finalState}`);
        }
        
        // Additional small delay to ensure context is fully stable
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      const playMode = options.playMode || 'poly';
      const velocity = options.velocity || 127;
      const adsr = options.adsr || { attack: 0, decay: 0, sustain: 32767, release: 0 };

      // Handle play mode logic
      if (playMode === 'mono') {
        // Stop all current notes immediately
        for (const [id, noteState] of activeNotesRef.current) {
          cleanupNoteState(id, noteState);
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
      
      // Configure looping if enabled
      const loopEnabled = options.loopEnabled || false;
      const loopOnRelease = options.loopOnRelease || false;
      const loopStart = options.loopStart || 0;
      const loopEnd = options.loopEnd || audioBuffer.duration;
      

      
      if (loopEnabled) {
        // Validate loop points
        const validLoopStart = Math.max(0, Math.min(loopStart, audioBuffer.duration - 0.1));
        const validLoopEnd = Math.max(validLoopStart + 0.1, Math.min(loopEnd, audioBuffer.duration));
        
        source.loop = true;
        source.loopStart = validLoopStart;
        source.loopEnd = validLoopEnd;
        

      }

      // Configure pan
      const panValue = options.pan !== undefined ? Math.max(-1, Math.min(1, options.pan / 100)) : 0;
      panNode.pan.value = panValue;

      // Connect nodes
      source.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(audioContext.destination);

      // Apply ADSR envelope
      const startTime = audioContext.currentTime;
      const velocityScale = velocity / 127;
      applyADSREnvelope(gainNode, adsr, startTime, velocityScale);

      // Calculate timing
      let bufferStartTime = options.startTime || 0;
      let duration = options.duration || (audioBuffer.duration - bufferStartTime);

      if (options.inFrame !== undefined && options.outFrame !== undefined) {
        bufferStartTime = (options.inFrame / audioBuffer.length) * audioBuffer.duration;
        const endTime = (options.outFrame / audioBuffer.length) * audioBuffer.duration;
        duration = endTime - bufferStartTime;
      }

      // Start playback
      if (loopEnabled) {
        // For looping, don't pass duration to allow infinite loop
        source.start(0, bufferStartTime);
      } else if (duration > 0) {
        // For non-looping, use duration if specified
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
        velocity,
        loopEnabled,
        loopOnRelease,
        loopStart,
        loopEnd
      };

      // Store note state
      activeNotesRef.current.set(noteId, noteState);
      lastNoteRef.current = noteState;

      // Track all active multisample noteIds globally for robust release
      if (noteId.startsWith('multisample-')) {
        addToGlobalActiveNotes(noteId);
      }

      // Set up cleanup when source ends
      source.onended = () => {
        const noteState = activeNotesRef.current.get(noteId);
        // Only clean up if the note is not in release phase (ADSR will handle cleanup)
        if (noteState && noteState.envelopePhase !== 'release') {
          cleanupNoteState(noteId, noteState);
        }
      };

      return noteId;
    } catch (error) {
      console.error('Error playing audio with ADSR:', error);
      return null;
    }
  }, [applyADSREnvelope, triggerRelease]);

  // Release a specific note or notes matching a pattern
  const releaseNote = useCallback((noteId: string, forceStop: boolean = false) => {
    const handleNote = (id: string) => {
      if (forceStop) {
        // Force stop the note even if it's in loop on release mode
        const noteState = activeNotesRef.current.get(id);
        if (noteState) {
          cleanupNoteState(id, noteState);
        }
      } else {
        triggerRelease(id);
      }
    };

    // Check if this is a pattern (contains wildcard or is a base pattern)
    if (noteId.includes('*') || noteId.endsWith('-')) {
      // Pattern matching: find all notes that start with the pattern
      const pattern = noteId.replace('*', '').replace(/-$/, '');
      for (const [id] of activeNotesRef.current) {
        if (id.startsWith(pattern)) {
          handleNote(id);
        }
      }
    } else {
      // Exact match
      handleNote(noteId);
    }
  }, [triggerRelease]);

  // Release all notes
  const releaseAllNotes = useCallback(() => {
    for (const [noteId] of activeNotesRef.current) {
      triggerRelease(noteId);
    }
  }, [triggerRelease]);

  // Force stop all notes (useful for cleaning up looped notes)
  const stopAllNotes = useCallback(() => {
    for (const [noteId] of activeNotesRef.current) {
      releaseNote(noteId, true); // Force stop
    }
  }, [releaseNote]);

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
    stopAllNotes,
    getActiveNotesCount,
  };
} 