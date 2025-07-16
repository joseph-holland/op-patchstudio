import { useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import type { AppState } from '../context/AppContext';
import { sessionStorageIndexedDB } from '../utils/sessionStorageIndexedDB';

export function useSessionManagement() {
  const { state, dispatch } = useAppContext();
  const saveSessionRef = useRef<(() => Promise<void>) | null>(null);
  const hasUserDeclinedSessionRef = useRef(false);
  const currentStateRef = useRef<AppState>(state);

  // Save current session
  const saveSession = useCallback(async () => {
    try {
      await sessionStorageIndexedDB.saveSession(state);
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }, [state]);

  // Update the refs whenever they change
  saveSessionRef.current = saveSession;
  currentStateRef.current = state;

  // Check for previous session on app startup
  useEffect(() => {
    const checkForPreviousSession = async () => {
      // Don't check if user has already declined to restore a session
      if (hasUserDeclinedSessionRef.current) {
        return;
      }
      
      // Don't check if a preset is being loaded
      if (window.sessionStorage.getItem('loading-preset') === 'true') {
        return;
      }

      try {
        // First, clear any corrupted data
        await sessionStorageIndexedDB.clearCorruptedData();
      } catch (error) {
        console.error('Failed to clear corrupted data:', error);
      }

      const hasPreviousSession = await sessionStorageIndexedDB.hasPreviousSession();
      
      if (hasPreviousSession) {
        // Get the current session
        const sessionData = await sessionStorageIndexedDB.getCurrentSession();
        if (sessionData) {
          // Don't show restore prompt if session has been saved to library
          if (sessionData.savedToLibrary) {
            return;
          }
          
          // Check if session is within the last 12 hours (12 * 60 * 60 * 1000 ms)
          const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
          const now = Date.now();
          const sessionAge = now - sessionData.timestamp;
          
          if (sessionAge <= TWELVE_HOURS_MS) {
            // Count loaded samples
            const drumSamplesCount = sessionData.drumSamples.length;
            const multisampleFilesCount = sessionData.multisampleFiles.length;
            
            // Only show restoration modal if there are samples to restore
            if (drumSamplesCount > 0 || multisampleFilesCount > 0) {
              // Set session info for the modal
              dispatch({
                type: 'SET_SESSION_INFO',
                payload: {
                  timestamp: sessionData.timestamp,
                  drumSamplesCount,
                  multisampleFilesCount
                }
              });
              
              // Show restoration modal
              dispatch({ type: 'SET_SESSION_RESTORATION_MODAL_OPEN', payload: true });
            }
          }
        }
      }
    };

    checkForPreviousSession();
  }, [dispatch]);

  // Auto-save session when samples are loaded or changed
  useEffect(() => {
    // Don't auto-save if session restoration modal is open
    if (state.isSessionRestorationModalOpen) {
      return;
    }
    
    // Don't auto-save if a preset is being loaded
    if (window.sessionStorage.getItem('loading-preset') === 'true') {
      return;
    }
    
    // Always save session when relevant state changes
    // Debounce the save to avoid excessive saves during rapid changes
    const timeoutId = setTimeout(() => {
      if (saveSessionRef.current) {
        saveSessionRef.current();
      }
    }, 1000); // 1 second debounce

    return () => {
      clearTimeout(timeoutId);
    };
  }, [state.drumSamples, state.multisampleFiles, state.drumSettings, state.multisampleSettings, state.isSessionRestorationModalOpen]);

  // Load session
  const loadSession = useCallback(async () => {
    try {
      const sessionData = await sessionStorageIndexedDB.loadSession();
      if (!sessionData) {
        return;
      }

      // First, restore all samples and collect the restored data
      const restoredDrumSamples: any[] = [];
      const restoredMultisampleFiles: any[] = [];

      // Restore drum samples
      for (const storedSample of sessionData.drumSamples) {
        try {
          // Load the sample from IndexedDB
          const sampleData = await sessionStorageIndexedDB.loadSampleFromSession(storedSample.sampleId);
          if (!sampleData) {
            console.error(`Failed to load drum sample ${storedSample.sampleId}`);
            continue;
          }
          
          // Create the restored sample with all settings applied
          const restoredSample = {
            originalIndex: storedSample.originalIndex,
            file: sampleData.file,
            audioBuffer: sampleData.audioBuffer,
            name: sampleData.file.name,
            isLoaded: true,
            isAssigned: storedSample.isAssigned,
            assignedKey: storedSample.assignedKey,
            inPoint: storedSample.settings.inPoint,
            outPoint: storedSample.settings.outPoint,
            playmode: storedSample.settings.playmode,
            reverse: storedSample.settings.reverse,
            tune: storedSample.settings.tune,
            pan: storedSample.settings.pan,
            gain: storedSample.settings.gain,
            hasBeenEdited: storedSample.settings.hasBeenEdited,
            originalBitDepth: sampleData.metadata.bitDepth,
            originalSampleRate: sampleData.metadata.sampleRate,
            originalChannels: sampleData.metadata.channels,
            fileSize: sampleData.metadata.fileSize,
            duration: sampleData.metadata.duration
          };
          
          // Add the sample to the array (not using sparse array)
          restoredDrumSamples.push(restoredSample);
        } catch (error) {
          console.error(`Failed to restore drum sample ${storedSample.sampleId}:`, error);
          // Continue with other samples even if one fails
        }
      }

      // Restore multisample files
      for (const storedFile of sessionData.multisampleFiles) {
        try {
          // Load the sample from IndexedDB
          const sampleData = await sessionStorageIndexedDB.loadSampleFromSession(storedFile.sampleId);
          if (!sampleData) {
            console.error(`Failed to load multisample file ${storedFile.sampleId}`);
            continue;
          }
          
          // Create the restored file with all settings applied
          const restoredFile = {
            file: sampleData.file,
            audioBuffer: sampleData.audioBuffer,
            name: sampleData.file.name,
            isLoaded: true,
            rootNote: storedFile.rootNote,
            note: storedFile.note,
            inPoint: storedFile.inPoint,
            outPoint: storedFile.outPoint,
            loopStart: storedFile.loopStart,
            loopEnd: storedFile.loopEnd,
            originalBitDepth: sampleData.metadata.bitDepth,
            originalSampleRate: sampleData.metadata.sampleRate,
            originalChannels: sampleData.metadata.channels,
            fileSize: sampleData.metadata.fileSize,
            duration: sampleData.metadata.duration
          };
          
          restoredMultisampleFiles.push(restoredFile);
        } catch (error) {
          console.error(`Failed to restore multisample file ${storedFile.sampleId}:`, error);
          // Continue with other files even if one fails
        }
      }

      // Sort multisample files by rootNote descending (to match the original logic)
      restoredMultisampleFiles.sort((a, b) => b.rootNote - a.rootNote);

      // Now restore everything in one go with the complete state
      dispatch({
        type: 'RESTORE_SESSION',
        payload: {
          drumSettings: sessionData.drumSettings,
          multisampleSettings: sessionData.multisampleSettings,
          drumSamples: restoredDrumSamples,
          multisampleFiles: restoredMultisampleFiles,
          selectedMultisample: sessionData.selectedMultisample,
          isDrumKeyboardPinned: sessionData.isDrumKeyboardPinned,
          isMultisampleKeyboardPinned: sessionData.isMultisampleKeyboardPinned,
        }
      });

    } catch (error) {
      console.error('Failed to load session:', error);
    }
  }, [dispatch]);

  // Decline session restoration
  const declineSessionRestoration = useCallback(async () => {
    hasUserDeclinedSessionRef.current = true;
    
    // Clear the stored session data from IndexedDB
    try {
      await sessionStorageIndexedDB.clearCurrentSession();
    } catch (error) {
      console.error('Failed to clear session data when declining restoration:', error);
    }
    
    // Reset sessionInfo in the application state
    dispatch({ type: 'SET_SESSION_INFO', payload: null });
    
    // Close the restoration modal
    dispatch({ type: 'SET_SESSION_RESTORATION_MODAL_OPEN', payload: false });
  }, [dispatch]);

  // Clear current session
  const clearCurrentSession = useCallback(async () => {
    try {
      await sessionStorageIndexedDB.clearCurrentSession();
    } catch (error) {
      console.error('Failed to clear current session:', error);
    }
  }, []);

  // Clear all session data (for migration to new format)
  const clearAllSessionData = useCallback(async () => {
    try {
      await sessionStorageIndexedDB.clearAllSessionData();
    } catch (error) {
      console.error('Failed to clear all session data:', error);
    }
  }, []);

  // Mark session as saved to library
  const markSessionAsSavedToLibrary = useCallback(async () => {
    try {
      await sessionStorageIndexedDB.markSessionAsSavedToLibrary();
    } catch (error) {
      console.error('Failed to mark session as saved to library:', error);
    }
  }, []);

  // Reset saved to library flag
  const resetSavedToLibraryFlag = useCallback(async () => {
    try {
      await sessionStorageIndexedDB.resetSavedToLibraryFlag();
    } catch (error) {
      console.error('Failed to reset saved to library flag:', error);
    }
  }, []);

  return {
    saveSession,
    loadSession,
    declineSessionRestoration,
    clearCurrentSession,
    clearAllSessionData,
    markSessionAsSavedToLibrary,
    resetSavedToLibraryFlag,
  };
} 