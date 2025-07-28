import { useCallback, useRef, useEffect } from 'react';
import { audioContextManager } from '../utils/audioContext';
import { AUDIO_CONSTANTS } from '../utils/constants';

// Firefox fallback constants
const FIREFOX_FALLBACK_CONSTANTS = {
  MAX_FADE_DURATION: 30000, // 30 seconds protection timeout
  FADE_STEPS: 20, // Number of steps for manual fade
  MIN_GAIN_THRESHOLD: 0.001, // Minimum gain value for fade
  CLEANUP_DELAY: 100, // Small delay after fade completes
} as const;

// Timer tracking for memory leak prevention
interface TimerTracker {
  fadeInterval?: NodeJS.Timeout;
  fadeTimeoutProtection?: NodeJS.Timeout;
  cleanupTimer?: NodeJS.Timeout;
  noteId: string;
  gainNode: GainNode;
}

// Global timer registry to prevent memory leaks
const activeTimersRegistry = new Map<string, TimerTracker>();

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

// TypeScript interface extension for GainNode with Firefox fallback properties
interface ExtendedGainNode extends GainNode {
  __cleanupCompleted?: boolean; // Flag to prevent double cleanup
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

// Browser detection for Web Audio API compatibility
const isFirefox = (): boolean => {
  if (typeof window === 'undefined') return false;
  return navigator.userAgent.includes('Firefox');
};

// Shared Firefox fallback fade function
const createFirefoxFade = (
  gainNode: GainNode,
  startGain: number,
  fadeDuration: number,
  noteId: string,
  onComplete?: () => void
): void => {
  const extendedGainNode = gainNode as ExtendedGainNode;
  const fadeSteps = FIREFOX_FALLBACK_CONSTANTS.FADE_STEPS;
  const stepDuration = (fadeDuration * 1000) / fadeSteps;
  const maxFadeDuration = FIREFOX_FALLBACK_CONSTANTS.MAX_FADE_DURATION;
  const minGain = FIREFOX_FALLBACK_CONSTANTS.MIN_GAIN_THRESHOLD;
  
  // Create timer tracker for this fade operation
  const timerTracker: TimerTracker = {
    noteId,
    gainNode
  };
  
  // Add timeout protection to prevent runaway intervals
  timerTracker.fadeTimeoutProtection = setTimeout(() => {
    if (timerTracker.fadeInterval) {
      clearInterval(timerTracker.fadeInterval);
      delete timerTracker.fadeInterval;
    }
    gainNode.gain.value = minGain; // Emergency stop
    
    // Only cleanup if not already completed
    if (!extendedGainNode.__cleanupCompleted) {
      extendedGainNode.__cleanupCompleted = true;
      onComplete?.();
    }
    
    // Remove from registry
    activeTimersRegistry.delete(noteId);
  }, maxFadeDuration);
  
  let currentStep = 0;
  timerTracker.fadeInterval = setInterval(() => {
    currentStep++;
    const progress = currentStep / fadeSteps;
    
    // Handle edge cases for exponential fade
    let newGain: number;
    if (startGain <= 0) {
      // If startGain is 0 or negative, fade directly to minGain
      newGain = minGain;
    } else if (startGain <= minGain) {
      // If startGain is already at or below minGain, stay at minGain
      newGain = minGain;
    } else {
      // Proper exponential fade: y = startGain * e^(-progress * fadeFactor)
      // fadeFactor controls the curve steepness (higher = steeper fade)
      const fadeFactor = 3.0; // Adjust this for different fade characteristics
      newGain = startGain * Math.exp(-progress * fadeFactor);
      // Ensure we don't go below minGain
      newGain = Math.max(newGain, minGain);
    }
    
    gainNode.gain.value = newGain;
    
    if (currentStep >= fadeSteps) {
      if (timerTracker.fadeInterval) {
        clearInterval(timerTracker.fadeInterval);
        delete timerTracker.fadeInterval;
      }
      if (timerTracker.fadeTimeoutProtection) {
        clearTimeout(timerTracker.fadeTimeoutProtection);
        delete timerTracker.fadeTimeoutProtection;
      }
      gainNode.gain.value = minGain; // Final fade to near-zero
      
      // Schedule completion callback, but only if not already completed
      if (!extendedGainNode.__cleanupCompleted) {
        extendedGainNode.__cleanupCompleted = true;
        if (onComplete) {
          timerTracker.cleanupTimer = setTimeout(() => {
            onComplete();
            // Remove from registry after cleanup
            activeTimersRegistry.delete(noteId);
          }, FIREFOX_FALLBACK_CONSTANTS.CLEANUP_DELAY);
        } else {
          // Remove from registry immediately if no cleanup needed
          activeTimersRegistry.delete(noteId);
        }
      } else {
        // Remove from registry if already completed
        activeTimersRegistry.delete(noteId);
      }
    }
  }, stepDuration);
  
  // Register the timer tracker
  activeTimersRegistry.set(noteId, timerTracker);
};

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
  
  // Browser detection for cross-browser compatibility
  const isFirefoxBrowser = isFirefox();

  // Standardized error handling utility
  const handleAudioError = useCallback((error: unknown, context: string, fallbackAction?: () => void) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Audio error in ${context}:`, errorMessage);
    
    if (fallbackAction) {
      try {
        fallbackAction();
      } catch (fallbackError) {
        console.warn(`Fallback action failed in ${context}:`, fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
      }
    }
  }, []);

  // Cleanup verification utility to prevent memory leaks
  const verifyCleanup = useCallback((noteId: string, noteState: NoteEnvelopeState) => {
    const extendedGainNode = noteState.gainNode as ExtendedGainNode;
    
    // Verify all intervals and timeouts are cleared
    if (extendedGainNode.__cleanupCompleted) {
      return true;
    }
    
    // Check if there are any active timers for this note
    const timerTracker = activeTimersRegistry.get(noteId);
    if (timerTracker) {
      // Clean up any remaining timers
      if (timerTracker.fadeInterval) {
        clearInterval(timerTracker.fadeInterval);
        delete timerTracker.fadeInterval;
      }
      if (timerTracker.fadeTimeoutProtection) {
        clearTimeout(timerTracker.fadeTimeoutProtection);
        delete timerTracker.fadeTimeoutProtection;
      }
      if (timerTracker.cleanupTimer) {
        clearTimeout(timerTracker.cleanupTimer);
        delete timerTracker.cleanupTimer;
      }
      // Remove from registry
      activeTimersRegistry.delete(noteId);
    }
    
    return true;
  }, []);

  // Cleanup function for timer registry
  const cleanupTimerRegistry = useCallback((noteId?: string) => {
    if (noteId) {
      // Clean up specific note
      const timerTracker = activeTimersRegistry.get(noteId);
      if (timerTracker) {
        if (timerTracker.fadeInterval) {
          clearInterval(timerTracker.fadeInterval);
        }
        if (timerTracker.fadeTimeoutProtection) {
          clearTimeout(timerTracker.fadeTimeoutProtection);
        }
        if (timerTracker.cleanupTimer) {
          clearTimeout(timerTracker.cleanupTimer);
        }
        activeTimersRegistry.delete(noteId);
      }
    } else {
      // Clean up all timers (component unmount)
      for (const [, timerTracker] of activeTimersRegistry.entries()) {
        if (timerTracker.fadeInterval) {
          clearInterval(timerTracker.fadeInterval);
        }
        if (timerTracker.fadeTimeoutProtection) {
          clearTimeout(timerTracker.fadeTimeoutProtection);
        }
        if (timerTracker.cleanupTimer) {
          clearTimeout(timerTracker.cleanupTimer);
        }
      }
      activeTimersRegistry.clear();
    }
  }, []);

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
      // Only ignore "already stopped" errors, log others
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('already started') && !errorMessage.includes('already stopped')) {
        console.warn(`Unexpected error stopping audio source for note ${noteId}:`, errorMessage);
      }
    }

    // Clean up any fade intervals and timeout protection
    cleanupTimerRegistry(noteId);

    try {
      // Disconnect audio nodes
      noteState.source.disconnect();
      noteState.gainNode.disconnect();
    } catch (error) {
      // Only ignore "already disconnected" errors, log others
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('already disconnected')) {
        console.warn(`Unexpected error disconnecting audio nodes for note ${noteId}:`, errorMessage);
      }
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

    // Verify cleanup completed successfully
    verifyCleanup(noteId, noteState);
  }, [verifyCleanup, cleanupTimerRegistry]);

  const stopCurrentPlayback = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (error) {
        // Only ignore "already stopped" errors, log others
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('already started') && !errorMessage.includes('already stopped')) {
          console.warn('Unexpected error stopping current playback:', errorMessage);
        }
      }
      currentSourceRef.current = null;
    }
    if (currentGainNodeRef.current) {
      try {
        currentGainNodeRef.current.disconnect();
      } catch (error) {
        // Only ignore "already disconnected" errors, log others
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('already disconnected')) {
          console.warn('Unexpected error disconnecting current gain node:', errorMessage);
        }
      }
      currentGainNodeRef.current = null;
    }
    if (currentPanNodeRef.current) {
      try {
        currentPanNodeRef.current.disconnect();
      } catch (error) {
        // Only ignore "already disconnected" errors, log others
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('already disconnected')) {
          console.warn('Unexpected error disconnecting current pan node:', errorMessage);
        }
      }
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
      
      // Clean up timer registry to prevent memory leaks
      cleanupTimerRegistry();
      
      // Stop all active notes
      for (const [noteId, noteState] of activeNotesRef.current) {
        cleanupNoteState(noteId, noteState);
      }
      activeNotesRef.current.clear();
      
      // Stop current playback
      stopCurrentPlayback();
    };
  }, [clearAllTimers, stopCurrentPlayback, cleanupNoteState, cleanupTimerRegistry]);

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
    releaseTime: number,
    noteId?: string,
    noteState?: NoteEnvelopeState
  ) => {
    const { releaseTime: adsrReleaseTime } = convertADSRValues(adsr);
    
    // Ensure we're not scheduling operations in the past
    const currentTime = gainNode.context.currentTime;
    const safeReleaseTime = Math.max(releaseTime, currentTime + AUDIO_CONSTANTS.AUDIO_SCHEDULE_BUFFER);
    
    try {
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
    } catch (error) {
      // Standardized error handling with fallback
      handleAudioError(error, 'releaseNoteWithADSR setValueCurveAtTime');
      
      // Fallback for Firefox browser
      if (isFirefoxBrowser) {
        if (adsrReleaseTime > 0) {
          // Use shared Firefox fallback function
          if (noteId && noteState) {
            createFirefoxFade(gainNode, gainNode.gain.value, adsrReleaseTime, noteId, () => cleanupNoteState(noteId, noteState));
          } else {
            createFirefoxFade(gainNode, gainNode.gain.value, adsrReleaseTime, 'unknown', () => {
              // No cleanup callback for unknown notes
            });
          }
        } else {
          // Instant release for fallback
          gainNode.gain.value = 0;
        }
      } else {
        // For other browsers, fall back to direct value assignment
        gainNode.gain.value = 0;
      }
    }
  }, [convertADSRValues, generateExponentialCurve]);

  // Trigger release phase for a note
  const triggerRelease = useCallback((noteId: string) => {
    const noteState = activeNotesRef.current.get(noteId);
    if (!noteState) {
      return;
    }

    // Prevent multiple release calls on the same note
    if (noteState.envelopePhase === 'release' || noteState.envelopePhase === 'finished') {
      return;
    }

    const audioContext = noteState.gainNode.context;
    const currentTime = audioContext.currentTime;
    const { releaseTime: adsrReleaseTime } = convertADSRValues(noteState.adsr);

    // Handle loop on release behavior
    if (noteState.loopOnRelease) {
      // For loop on release, enable looping but continue from current position
      noteState.source.loop = true;
      noteState.source.loopStart = noteState.loopStart || 0;
      noteState.source.loopEnd = noteState.loopEnd || noteState.source.buffer?.duration || 1;
      
      // For loop on release, apply a gentle release envelope but don't stop the note
      noteState.envelopePhase = 'release';
      noteState.releaseTime = currentTime;
      
      if (adsrReleaseTime > 0) {
        // Use Firefox-compatible release logic for loop on release
        if (isFirefoxBrowser) {
          // Use shared Firefox fallback function with cleanup callback
          createFirefoxFade(
            noteState.gainNode,
            noteState.gainNode.gain.value,
            adsrReleaseTime,
            noteId,
            () => cleanupNoteState(noteId, noteState)
          );
        } else {
          // Chrome/other browsers: use the original Web Audio API approach
          try {
            const currentGain = noteState.gainNode.gain.value;
            
            // Cancel any existing scheduled values to prevent overlap
            noteState.gainNode.gain.cancelScheduledValues(currentTime);
            
            const releaseCurve = generateExponentialCurve(currentGain, 0, 2.0);
            noteState.gainNode.gain.setValueCurveAtTime(releaseCurve, currentTime, adsrReleaseTime);
            
            // Schedule cleanup after the release phase completes
            const timerId = setTimeout(() => {
              cleanupNoteState(noteId, noteState);
              removeTimer(timerId);
            }, adsrReleaseTime * 1000);
            
            addTimer(timerId);
          } catch (error) {
            handleAudioError(error, 'loop on release Web Audio API', () => {
              cleanupNoteState(noteId, noteState);
            });
          }
        }
      } else {
        cleanupNoteState(noteId, noteState);
      }
      return;
    }

    // Standard release behavior (no loop on release)
    try {
      releaseNoteWithADSR(noteState.gainNode, noteState.adsr, currentTime, noteId, noteState);
      noteState.envelopePhase = 'release';
      noteState.releaseTime = currentTime;
    } catch (error) {
      console.warn('Error during ADSR release, falling back to instant stop:', error);
      // Fallback: use centralized cleanup
      cleanupNoteState(noteId, noteState);
      return;
    }

    // For regular looping (loopEnabled), disable the loop when releasing so it can end naturally
    if (noteState.loopEnabled && !noteState.loopOnRelease) {
      noteState.source.loop = false;
    }

    // For instant release (0ms), stop the source and clean up immediately
    if (adsrReleaseTime <= 0) {
      try {
        noteState.source.stop();
      } catch (error) {
        // Only ignore "already stopped" errors, log others
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('already started') && !errorMessage.includes('already stopped')) {
          console.warn(`Unexpected error stopping source for instant release (note ${noteId}):`, errorMessage);
        }
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
        // For regular looping notes, stop the source explicitly since it won't end naturally
        // But for loop on release notes, don't stop the source - let it continue looping
        if (noteState.loopEnabled && !noteState.loopOnRelease) {
          try {
            noteState.source.stop();
          } catch (error) {
            // Only ignore "already stopped" errors, log others
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (!errorMessage.includes('already started') && !errorMessage.includes('already stopped')) {
              console.warn(`Unexpected error stopping source for release phase (note ${noteId}):`, errorMessage);
            }
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
          
          // Track the timeout for proper cleanup
          const resumeTimer = setTimeout(() => {
            // This is just a delay, no action needed
          }, checkInterval);
          addTimer(resumeTimer);
          
          await new Promise(resolve => {
            const resolveTimer = setTimeout(resolve, checkInterval);
            addTimer(resolveTimer);
          });
          removeTimer(resumeTimer);
          attempts++;
        }
        
        const finalState = audioContext.state as string;
        if (finalState !== 'running') {
          throw new Error(`Audio context failed to resume after ${maxAttempts * checkInterval}ms. State: ${finalState}`);
        }
        
        // Additional small delay to ensure context is fully stable
        const stabilityTimer = setTimeout(() => {
          // This is just a delay, no action needed
        }, 50);
        addTimer(stabilityTimer);
        
        await new Promise(resolve => {
          const resolveTimer = setTimeout(resolve, 50);
          addTimer(resolveTimer);
        });
        removeTimer(stabilityTimer);
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
      } else if (loopOnRelease) {
        // For loop on release, start without looping but don't pass duration
        // This allows the sample to play to the end, then loop on release
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