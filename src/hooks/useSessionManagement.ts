import { useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import type { AppState, MultisampleFile } from '../context/AppContext';
import { sessionStorageIndexedDB } from '../utils/sessionStorageIndexedDB';

export function useSessionManagement() {
  const { state, dispatch } = useAppContext();
  const saveSessionRef = useRef<(() => Promise<void>) | null>(null);
  const hasUserDeclinedSessionRef = useRef(false);
  const currentStateRef = useRef<AppState>(state);

  // Save current session
  const saveSession = useCallback(async () => {
    try {
      // Debug: Log what we're about to save
      console.log('Saving session with settings:', {
        drumSettings: state.drumSettings,
        multisampleSettings: state.multisampleSettings
      });
      
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
  }, [state.drumSamples, state.multisampleFiles, state.drumSettings, state.multisampleSettings]);

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

      // Debug: Log what we're about to restore
      console.log('Restoring session settings:', {
        drumSettings: sessionData.drumSettings,
        multisampleSettings: sessionData.multisampleSettings
      });

      // Restore settings
      dispatch({
        type: 'RESTORE_SESSION',
        payload: {
          drumSettings: sessionData.drumSettings,
          multisampleSettings: sessionData.multisampleSettings,
          drumSamples: [], // Will be populated below
          multisampleFiles: [], // Will be populated below
          selectedMultisample: sessionData.selectedMultisample,
          isDrumKeyboardPinned: sessionData.isDrumKeyboardPinned,
          isMultisampleKeyboardPinned: sessionData.isMultisampleKeyboardPinned,
        }
      });

      // Restore drum samples
      for (const storedSample of sessionData.drumSamples) {
        try {
          // Load the sample from IndexedDB
          const sampleData = await sessionStorageIndexedDB.loadSampleFromSession(storedSample.sampleId);
          if (!sampleData) {
            console.error(`Failed to load drum sample ${storedSample.sampleId}`);
            continue;
          }
          
          // Load the sample into the state at its original index
          const targetIndex = storedSample.originalIndex;
          
          dispatch({
            type: 'LOAD_DRUM_SAMPLE',
            payload: {
              index: targetIndex,
              file: sampleData.file,
              audioBuffer: sampleData.audioBuffer,
              metadata: sampleData.metadata
            }
          });
          
          // Apply the stored settings
          dispatch({
            type: 'UPDATE_DRUM_SAMPLE',
            payload: {
              index: targetIndex,
              updates: {
                inPoint: storedSample.settings.inPoint,
                outPoint: storedSample.settings.outPoint,
                playmode: storedSample.settings.playmode,
                reverse: storedSample.settings.reverse,
                tune: storedSample.settings.tune,
                pan: storedSample.settings.pan,
                gain: storedSample.settings.gain,
                hasBeenEdited: storedSample.settings.hasBeenEdited,
              }
            }
          });
        } catch (error) {
          console.error(`Failed to restore drum sample ${storedSample.sampleId}:`, error);
          // Continue with other samples instead of failing completely
        }
      }

      // Restore multisample files
      const multisampleLoadPromises = sessionData.multisampleFiles.map(async (storedFile) => {
        try {
          // Load the sample from IndexedDB
          const sampleData = await sessionStorageIndexedDB.loadSampleFromSession(storedFile.sampleId);
          if (!sampleData) {
            console.error(`Failed to load multisample file ${storedFile.sampleId}`);
            return null;
          }
          
          // Load the file into the state
          dispatch({
            type: 'LOAD_MULTISAMPLE_FILE',
            payload: {
              file: sampleData.file,
              audioBuffer: sampleData.audioBuffer,
              metadata: sampleData.metadata,
              rootNoteOverride: storedFile.rootNote
            }
          });
          
          // Return the stored file data for later processing
          return storedFile;
        } catch (error) {
          console.error(`Failed to restore multisample file ${storedFile.sampleId}:`, error);
          return null;
        }
      });

      // Wait for all multisample files to be loaded
      const loadedMultisampleFiles = await Promise.all(multisampleLoadPromises);
      const validLoadedFiles = loadedMultisampleFiles.filter(file => file !== null);

      // Now apply the stored settings to all loaded files
      // Use a longer delay to ensure React state updates have completed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get the current state from the ref to avoid stale closure issues
      const currentState = currentStateRef.current;
      
      validLoadedFiles.forEach((storedFile) => {
        if (!storedFile) return;
        
        // Find the file in the current state by file name and rootNote
        const fileIndex = currentState.multisampleFiles.findIndex((f: MultisampleFile | null) => 
          f && f.name === storedFile.fileName && f.rootNote === storedFile.rootNote
        );
        
        if (fileIndex !== -1) {
          dispatch({
            type: 'UPDATE_MULTISAMPLE_FILE',
            payload: {
              index: fileIndex,
              updates: {
                inPoint: storedFile.inPoint,
                outPoint: storedFile.outPoint,
                loopStart: storedFile.loopStart,
                loopEnd: storedFile.loopEnd,
              }
            }
          });
        } else {
          // Only log warning if we actually have files loaded but can't find this specific one
          if (currentState.multisampleFiles.length > 0) {
            console.warn(`Could not find multisample file to update settings for file ${storedFile.fileName} with rootNote ${storedFile.rootNote}`);
          }
        }
      });
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
      // Always save session periodically as backup
      if (saveSessionRef.current) {
        saveSessionRef.current();
      }
    }, 30000); // Save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [state.drumSamples, state.multisampleFiles, state.drumSettings, state.multisampleSettings]);

  return {
    saveSession,
    loadSession,
    startNewSession,
    isSessionRestorationModalOpen: state.isSessionRestorationModalOpen,
    sessionInfo: state.sessionInfo
  };
} 