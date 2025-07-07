import { useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { sessionStorageIndexedDB } from '../utils/sessionStorageIndexedDB';

export function useSessionManagement() {
  const { state, dispatch } = useAppContext();
  const saveSessionRef = useRef<(() => Promise<void>) | null>(null);

  // Save current session
  const saveSession = useCallback(async () => {
    try {
      await sessionStorageIndexedDB.saveSession(state);
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }, [state]);

  // Update the ref whenever saveSession changes
  saveSessionRef.current = saveSession;

  // Check for previous session on app startup
  useEffect(() => {
    const checkForPreviousSession = async () => {
      if (await sessionStorageIndexedDB.hasPreviousSession()) {
        const currentSessionId = sessionStorageIndexedDB.getCurrentSessionId();
        if (currentSessionId) {
          const sessionData = await sessionStorageIndexedDB.loadSession(currentSessionId);
          if (sessionData) {
            // Check if session is within the last 12 hours (12 * 60 * 60 * 1000 ms)
            const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
            const now = Date.now();
            if (now - sessionData.timestamp <= TWELVE_HOURS_MS) {
              // Count loaded samples
              const drumSamplesCount = sessionData.drumSamples.length;
              const multisampleFilesCount = sessionData.multisampleFiles.length;
              
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
    // Only save if there are loaded samples or files
    const hasDrumSamples = state.drumSamples.some(s => s && s.isLoaded);
    const hasMultisampleFiles = state.multisampleFiles.length > 0;
    
    if (hasDrumSamples || hasMultisampleFiles) {
      // Debounce the save to avoid excessive saves during rapid changes
      const timeoutId = setTimeout(() => {
        if (saveSessionRef.current) {
          saveSessionRef.current();
        }
      }, 1000); // 1 second debounce

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [state.drumSamples, state.multisampleFiles]);

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
      for (const storedFile of sessionData.multisampleFiles) {
        try {
          // Load the sample from IndexedDB
          const sampleData = await sessionStorageIndexedDB.loadSampleFromSession(storedFile.sampleId);
          if (!sampleData) {
            console.error(`Failed to load multisample file ${storedFile.sampleId}`);
            continue;
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
          
          // Apply the stored settings (we need to find the file index first)
          // This is a bit tricky since the files are sorted by rootNote
          // We'll need to update this after all files are loaded
        } catch (error) {
          console.error(`Failed to restore multisample file ${storedFile.sampleId}:`, error);
          // Continue with other files instead of failing completely
        }
      }

      // Update multisample files with their stored settings
      // This needs to be done after all files are loaded and sorted
      setTimeout(() => {
        sessionData.multisampleFiles.forEach((storedFile, _originalIndex) => {
          // Find the file in the current state by name and rootNote
          const currentFiles = state.multisampleFiles;
          const fileIndex = currentFiles.findIndex(f => 
            f.name === storedFile.note && f.rootNote === storedFile.rootNote
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
          }
        });
      }, 100);
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  }, [dispatch, state.multisampleFiles]);

  // Start new session (clear current session)
  const startNewSession = useCallback(() => {
    sessionStorageIndexedDB.clearCurrentSession();
    dispatch({ type: 'SET_SESSION_RESTORATION_MODAL_OPEN', payload: false });
    dispatch({ type: 'SET_SESSION_INFO', payload: null });
  }, [dispatch]);

  // Auto-save session periodically (as backup)
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      // Only save if there are loaded samples or files
      const hasDrumSamples = state.drumSamples.some(s => s && s.isLoaded);
      const hasMultisampleFiles = state.multisampleFiles.length > 0;
      
      if (hasDrumSamples || hasMultisampleFiles) {
        if (saveSessionRef.current) {
          saveSessionRef.current();
        }
      }
    }, 30000); // Save every 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [state.drumSamples, state.multisampleFiles]);

  return {
    saveSession,
    loadSession,
    startNewSession,
    isSessionRestorationModalOpen: state.isSessionRestorationModalOpen,
    sessionInfo: state.sessionInfo
  };
} 