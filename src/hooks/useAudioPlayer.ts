import { useCallback, useRef } from 'react';
import { audioContextManager } from '../utils/audioContext';
import { AUDIO_CONSTANTS } from '../utils/constants';

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
        setTimeout(() => {
          try {
            noteState.source.stop();
          } catch (error) {
            // Source might already be stopped
          }
          activeNotesRef.current.delete(noteState.noteId);
          noteState.source.disconnect();
          noteState.gainNode.disconnect();
          noteState.envelopePhase = 'finished';
          
          // Remove from global active notes
          if (noteState.noteId.startsWith('multisample-')) {
            const arr = (window as any).opPatchstudioActiveNotes;
            if (Array.isArray(arr)) {
              const idx = arr.indexOf(noteState.noteId);
              if (idx !== -1) arr.splice(idx, 1);
            }
          }
        }, adsrReleaseTime * 1000);
      } else {
        // Instant release - stop immediately
        try {
          noteState.source.stop();
        } catch (error) {
          // Source might already be stopped
        }
        activeNotesRef.current.delete(noteState.noteId);
        noteState.source.disconnect();
        noteState.gainNode.disconnect();
        noteState.envelopePhase = 'finished';
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
      // Fallback: stop the source immediately
      try {
        noteState.source.stop();
      } catch (stopError) {
        // Source might already be stopped
      }
      // Clean up immediately
      activeNotesRef.current.delete(noteId);
      noteState.source.disconnect();
      noteState.gainNode.disconnect();
      noteState.envelopePhase = 'finished';
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
      setTimeout(() => {
        activeNotesRef.current.delete(noteId);
        noteState.source.disconnect();
        noteState.gainNode.disconnect();
        noteState.envelopePhase = 'finished';
      }, 10);
    } else {
      // Clean up after release phase
      setTimeout(() => {
        // For looping notes, stop the source explicitly since it won't end naturally
        if (noteState.loopEnabled || noteState.loopOnRelease) {
          try {
            noteState.source.stop();
          } catch (error) {
            // Source might already be stopped
          }
        }
        activeNotesRef.current.delete(noteId);
        noteState.source.disconnect();
        noteState.gainNode.disconnect();
        noteState.envelopePhase = 'finished';
      }, adsrReleaseTime * 1000);
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
        if (!Array.isArray((window as any).opPatchstudioActiveNotes)) {
          (window as any).opPatchstudioActiveNotes = [];
        }
        (window as any).opPatchstudioActiveNotes.push(noteId);
      }

      // Set up cleanup when source ends
      source.onended = () => {
        const noteState = activeNotesRef.current.get(noteId);
        // Only clean up if the note is not in release phase (ADSR will handle cleanup)
        if (noteState && noteState.envelopePhase !== 'release') {
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
          try {
            noteState.source.stop();
          } catch (error) {
            // Source might already be stopped
          }
          activeNotesRef.current.delete(id);
          noteState.source.disconnect();
          noteState.gainNode.disconnect();
          noteState.envelopePhase = 'finished';
          
          // Remove from global active notes
          if (id.startsWith('multisample-')) {
            const arr = (window as any).opPatchstudioActiveNotes;
            if (Array.isArray(arr)) {
              const idx = arr.indexOf(id);
              if (idx !== -1) arr.splice(idx, 1);
            }
          }
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