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

      if (await sessionStorageIndexedDB.hasPreviousSession()) {
        const currentSessionId = sessionStorageIndexedDB.getCurrentSessionId();
        if (currentSessionId) {
          const sessionData = await sessionStorageIndexedDB.loadSession(currentSessionId);
          if (sessionData) {
            // Don't show restore prompt if session has been saved to library
            if (sessionData.savedToLibrary) {
              return;
            }
            
            // Check if session is within the last 12 hours (12 * 60 * 60 * 1000 ms)
            const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
            const now = Date.now();
            if (now - sessionData.timestamp <= TWELVE_HOURS_MS) {
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
    const currentSessionId = sessionStorageIndexedDB.getCurrentSessionId();
    if (!currentSessionId) return;

    try {
      const sessionData = await sessionStorageIndexedDB.loadSession(currentSessionId);
      if (!sessionData) {
        console.log('No session data available to restore');
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
            file: sampleData.file,
            audioBuffer: sampleData.audioBuffer,
            name: sampleData.file.name,
            isLoaded: true,
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
          
          // Place the sample at its original index
          restoredDrumSamples[storedSample.originalIndex] = restoredSample;
        } catch (error) {
          console.error(`Failed to restore drum sample ${storedSample.sampleId}:`, error);
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
        }
      }

      // Sort multisample files by rootNote descending (to match the original logic)
      restoredMultisampleFiles.sort((a, b) => b.rootNote - a.rootNote);

      // Now restore everything in one go with the complete state
      console.log('Dispatching RESTORE_SESSION with:', {
        drumSettings: sessionData.drumSettings,
        multisampleSettings: sessionData.multisampleSettings,
        drumSamplesCount: restoredDrumSamples.length,
        multisampleFilesCount: restoredMultisampleFiles.length,
        selectedMultisample: sessionData.selectedMultisample,
        isDrumKeyboardPinned: sessionData.isDrumKeyboardPinned,
        isMultisampleKeyboardPinned: sessionData.isMultisampleKeyboardPinned,
      });
      
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

      console.log('Session restoration completed successfully');
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  }, [dispatch]);

  // Start new session (clear current session)
  const startNewSession = useCallback(() => {
    // Mark that user has declined to restore session to prevent future prompts
    hasUserDeclinedSessionRef.current = true;
    sessionStorageIndexedDB.clearCurrentSession();
    dispatch({ type: 'SET_SESSION_RESTORATION_MODAL_OPEN', payload: false });
    dispatch({ type: 'SET_SESSION_INFO', payload: null });
  }, [dispatch]);

  // Auto-save session periodically (as backup)
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      // Don't auto-save if session restoration modal is open
      if (state.isSessionRestorationModalOpen) {
        return;
      }
      
      // Don't auto-save if a preset is being loaded
      if (window.sessionStorage.getItem('loading-preset') === 'true') {
        return;
      }
      
      // Always save session periodically as backup
      if (saveSessionRef.current) {
        saveSessionRef.current();
      }
    }, 30000); // Save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [state.drumSamples, state.multisampleFiles, state.drumSettings, state.multisampleSettings, state.isSessionRestorationModalOpen]);

  return {
    saveSession,
    loadSession,
    startNewSession,
    isSessionRestorationModalOpen: state.isSessionRestorationModalOpen,
    sessionInfo: state.sessionInfo
  };
} 