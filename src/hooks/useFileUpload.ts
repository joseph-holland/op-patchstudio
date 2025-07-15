import { useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { readAudioMetadata } from '../utils/audioFormats';

export function useFileUpload() {
  const { state, dispatch } = useAppContext();

  const handleDrumSampleUpload = useCallback(async (file: File, index: number) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      // Enhanced audio processing with metadata extraction
      const metadata = await readAudioMetadata(file, state.midiNoteMapping);

      dispatch({
        type: 'LOAD_DRUM_SAMPLE',
        payload: { 
          index, 
          file, 
          audioBuffer: metadata.audioBuffer,
          metadata 
        }
      });

    } catch (error) {
      console.error('Error loading drum sample:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to load audio file' 
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch, state.midiNoteMapping]);

  const handleMultisampleUpload = useCallback(async (file: File, rootNoteOverride?: number) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      // Enhanced audio processing with metadata extraction
      const metadata = await readAudioMetadata(file, state.midiNoteMapping);

      dispatch({
        type: 'LOAD_MULTISAMPLE_FILE',
        payload: { 
          file, 
          audioBuffer: metadata.audioBuffer,
          metadata,
          rootNoteOverride 
        }
      });

    } catch (error) {
      console.error('Error loading multisample file:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to load audio file' 
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch, state.midiNoteMapping]);

  const clearDrumSample = useCallback((index: number) => {
    dispatch({ type: 'CLEAR_DRUM_SAMPLE', payload: index });
  }, [dispatch]);

  const clearMultisampleFile = useCallback((index: number) => {
    dispatch({ type: 'CLEAR_MULTISAMPLE_FILE', payload: index });
  }, [dispatch]);

  return {
    handleDrumSampleUpload,
    handleMultisampleUpload,
    clearDrumSample,
    clearMultisampleFile,
  };
}