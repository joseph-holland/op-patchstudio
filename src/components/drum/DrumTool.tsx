import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { RecordingModal } from '../common/RecordingModal';
import { AudioProcessingSection } from '../common/AudioProcessingSection';
import { GeneratePresetSection } from '../common/GeneratePresetSection';

import { DrumSampleTable } from './DrumSampleTable';
import { DrumPresetSettings } from './DrumPresetSettings';
import { DrumBulkEditModal } from './DrumBulkEditModal';
import { useFileUpload } from '../../hooks/useFileUpload';
import { usePatchGeneration } from '../../hooks/usePatchGeneration';
import { audioBufferToWav } from '../../utils/audio';
import { DrumKeyboardContainer } from './DrumKeyboardContainer';
import { savePresetToLibrary } from '../../utils/libraryUtils';
import { sessionStorageIndexedDB } from '../../utils/sessionStorageIndexedDB';
import { saveDrumSettingsAsDefault } from '../../utils/defaultSettings';

export function DrumTool() {
  const { state, dispatch } = useAppContext();
  const { handleDrumSampleUpload, clearDrumSample } = useFileUpload();
  const { generateDrumPatchFile } = usePatchGeneration();
  const [isMobile, setIsMobile] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({ isOpen: false, message: '', onConfirm: async () => {} });
  const [recordingModal, setRecordingModal] = useState<{
    isOpen: boolean;
    targetIndex: number | null;
  }>({ isOpen: false, targetIndex: null });
  const [bulkEditModal, setBulkEditModal] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSampleRateChange = (value: string) => {
    dispatch({ type: 'SET_DRUM_SAMPLE_RATE', payload: parseInt(value) });
  };

  const handleBitDepthChange = (value: string) => {
    dispatch({ type: 'SET_DRUM_BIT_DEPTH', payload: parseInt(value) });
  };

  const handleChannelsChange = (value: string) => {
    dispatch({ type: 'SET_DRUM_CHANNELS', payload: parseInt(value) });
  };

  const handlePresetNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_DRUM_PRESET_NAME', payload: e.target.value });
  };

  const handleNormalizeChange = (enabled: boolean) => {
    dispatch({ type: 'SET_DRUM_NORMALIZE', payload: enabled });
  };

  const handleNormalizeLevelChange = (level: number) => {
    dispatch({ type: 'SET_DRUM_NORMALIZE_LEVEL', payload: level });
  };

  const handleResetAudioSettingsConfirm = () => {
    setConfirmDialog({
      isOpen: true,
      message: 'are you sure you want to reset all audio processing settings to defaults?',
      onConfirm: () => {
        dispatch({ type: 'SET_DRUM_SAMPLE_RATE', payload: 0 });
        dispatch({ type: 'SET_DRUM_BIT_DEPTH', payload: 0 });
        dispatch({ type: 'SET_DRUM_CHANNELS', payload: 0 });
        dispatch({ type: 'SET_DRUM_NORMALIZE', payload: false });
        dispatch({ type: 'SET_DRUM_NORMALIZE_LEVEL', payload: 0.0 });
        setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} });
      }
    });
  };

  const handleFileUpload = async (index: number, file: File) => {
    try {
      // Validate file before processing
      if (!file || file.size === 0) {
        throw new Error('Invalid file: file is empty or null');
      }
      
      // Check file type
      const isValidAudioFile = file.type.startsWith('audio/') || 
                              file.name.toLowerCase().endsWith('.wav') ||
                              file.name.toLowerCase().endsWith('.aif') ||
                              file.name.toLowerCase().endsWith('.aiff') ||
                              file.name.toLowerCase().endsWith('.mp3') ||
                              file.name.toLowerCase().endsWith('.m4a') ||
                              file.name.toLowerCase().endsWith('.ogg') ||
                              file.name.toLowerCase().endsWith('.flac');
      
      if (!isValidAudioFile) {
        throw new Error(`Unsupported file type: ${file.type}. Please upload a WAV, AIF, AIFF, MP3, M4A, OGG, or FLAC file.`);
      }
      
      // File validation passed, proceed with upload
      await handleDrumSampleUpload(file, index);
    } catch (error) {
      console.error('Error uploading file:', error);
      // You could add user notification here if needed
    }
  };

  const handleClearSample = (index: number) => {
    setConfirmDialog({
      isOpen: true,
      message: 'are you sure you want to clear this sample?',
      onConfirm: async () => {
        clearDrumSample(index);
        setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} });
      }
    });
  };




  const handleSaveToLibrary = async () => {
    try {
      const result = await savePresetToLibrary(state, state.drumSettings.presetName, 'drum');
      if (result.success) {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            id: Date.now().toString(),
            type: 'success',
            title: 'preset saved',
            message: `"${state.drumSettings.presetName}" saved to library`
          }
        });
        // Trigger library refresh event
        window.dispatchEvent(new CustomEvent('library-refresh'));
      } else {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            id: Date.now().toString(),
            type: 'error',
            title: 'save failed',
            message: result.error || 'failed to save preset to library'
          }
        });
      }
    } catch (error) {
      console.error('Error saving to library:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'error',
          title: 'save failed',
          message: 'failed to save preset to library'
        }
      });
    }
  };

  const handleDownloadPreset = async () => {
    try {
      const patchName = state.drumSettings.presetName.trim() || 'drum_patch';
      await generateDrumPatchFile(patchName);
    } catch (error) {
      console.error('Error downloading preset:', error);
    }
  };

  const handleSaveSettingsAsDefault = () => {
    try {
      saveDrumSettingsAsDefault(state.drumSettings, state.importedDrumPreset);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'success',
          title: 'settings saved',
          message: 'drum settings saved as default'
        }
      });
    } catch (error) {
      console.error('Error saving settings as default:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'error',
          title: 'save failed',
          message: 'failed to save settings as default'
        }
      });
    }
  };

  const handleClearAll = async () => {
    setConfirmDialog({
      isOpen: true,
      message: 'are you sure you want to clear all loaded samples?',
      onConfirm: async () => {
        for (let i = 0; i < 24; i++) {
          clearDrumSample(i);
        }
        // Reset saved to library flag since we're starting fresh
        await sessionStorageIndexedDB.resetSavedToLibraryFlag();
        setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} });
      }
    });
  };

  const handleResetAll = async () => {
    setConfirmDialog({
      isOpen: true,
      message: 'are you sure you want to reset everything to defaults? this will clear all samples, reset preset name, audio settings and preset settings.',
      onConfirm: async () => {
        // Clear all samples
        for (let i = 0; i < 24; i++) {
          clearDrumSample(i);
        }
        
        // Reset preset name
        dispatch({ type: 'SET_DRUM_PRESET_NAME', payload: '' });
        
        // Reset audio format settings to defaults (0 = original)
        dispatch({ type: 'SET_DRUM_SAMPLE_RATE', payload: 0 });
        dispatch({ type: 'SET_DRUM_BIT_DEPTH', payload: 0 });
        dispatch({ type: 'SET_DRUM_CHANNELS', payload: 0 });
        
        // Reset normalize settings
        dispatch({ type: 'SET_DRUM_NORMALIZE', payload: false });
        dispatch({ type: 'SET_DRUM_NORMALIZE_LEVEL', payload: 0.0 });
        
        // Reset file renaming settings to defaults
        dispatch({ type: 'SET_DRUM_RENAME_FILES', payload: false });
        dispatch({ type: 'SET_DRUM_FILENAME_SEPARATOR', payload: ' ' });
        
        // Reset preset settings to defaults
        dispatch({ type: 'SET_DRUM_PRESET_PLAYMODE', payload: 'poly' });
        dispatch({ type: 'SET_DRUM_PRESET_TRANSPOSE', payload: 0 });
        dispatch({ type: 'SET_DRUM_PRESET_VELOCITY', payload: 20 });
        dispatch({ type: 'SET_DRUM_PRESET_VOLUME', payload: 69 });
        dispatch({ type: 'SET_DRUM_PRESET_WIDTH', payload: 0 });
        
        // Reset saved to library flag since we're starting fresh
        await sessionStorageIndexedDB.resetSavedToLibraryFlag();
        
        setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} });
      }
    });
  };

  const handleOpenRecording = (targetIndex: number | null = null) => {
    setRecordingModal({ isOpen: true, targetIndex });
  };

  const handleCloseRecording = () => {
    setRecordingModal({ isOpen: false, targetIndex: null });
  };

  const handleSaveRecording = async (audioBuffer: AudioBuffer, filename: string) => {
    try {
      // Convert AudioBuffer to File-like object for processing
      const numberOfChannels = audioBuffer.numberOfChannels;
      const length = audioBuffer.length;
      const sampleRate = audioBuffer.sampleRate;
      
      // Create a new buffer with the same properties
      const offlineContext = new OfflineAudioContext(numberOfChannels, length, sampleRate);
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start();
      
      const renderedBuffer = await offlineContext.startRendering();
      
      // Create a File-like object from the buffer with metadata
      const wavData = audioBufferToWav(renderedBuffer, 16, {
        rootNote: 60, // Default to C4 for recorded samples
        loopStart: 0,
        loopEnd: renderedBuffer.length - 1
      });
      
      // Use the provided filename or fallback to default
      const finalFilename = filename.trim() || 'recorded_sample';
      const recordedFile = new File([wavData], `${finalFilename}.wav`, { type: 'audio/wav' });
      
      // If a specific target index was set, upload to that slot
      if (recordingModal.targetIndex !== null) {
        await handleFileUpload(recordingModal.targetIndex, recordedFile);
      } else {
        // Find first empty slot or ask user to choose
        const emptyIndex = state.drumSamples.findIndex(sample => !sample || !sample.isLoaded);
        if (emptyIndex !== -1) {
          await handleFileUpload(emptyIndex, recordedFile);
        } else {
          // All slots full - could show a selection modal here
          console.warn('All drum slots are full');
        }
      }
    } catch (error) {
      console.error('Error saving recording:', error);
    }
  };

  const hasLoadedSamples = state.drumSamples.some(s => s && s.isLoaded);
  const hasMultipleLoadedSamples = state.drumSamples.filter(s => s && s.isLoaded).length > 1;
  const hasPresetName = state.drumSettings.presetName.trim().length > 0;
  const canGeneratePatch = hasLoadedSamples && hasPresetName;
  
  // Check if any settings have been changed from defaults
  const hasChangesFromDefaults = (
    hasLoadedSamples || // Any samples loaded
    hasPresetName || // Preset name entered
    state.drumSettings.sampleRate !== 0 || // Audio format changed
    state.drumSettings.bitDepth !== 0 ||
    state.drumSettings.channels !== 0 ||
    state.drumSettings.normalize !== false || // Normalize settings changed
    state.drumSettings.normalizeLevel !== 0.0 ||
    state.drumSettings.renameFiles !== false || // File renaming settings changed
    state.drumSettings.filenameSeparator !== ' ' ||
    state.drumSettings.presetSettings.playmode !== 'poly' || // Preset settings changed
    state.drumSettings.presetSettings.transpose !== 0 ||
    state.drumSettings.presetSettings.velocity !== 20 ||
    state.drumSettings.presetSettings.volume !== 69 ||
    state.drumSettings.presetSettings.width !== 0 ||
    state.drumSamples.some(s => s && s.hasBeenEdited) // Any individual sample settings changed
  );

  return (
    <div style={{ 
      fontFamily: '"Montserrat", "Arial", sans-serif',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>

      {/* Always Visible Drum Keyboard Section with pinning */}
      <div style={{
        padding: isMobile ? '1rem 0.5rem' : '2rem 2rem',
      }}>
        <DrumKeyboardContainer onFileUpload={handleFileUpload} />
      </div>

      {/* Tabbed Content Area */}
      <div style={{ 
        flex: 1,
        padding: isMobile ? '0 0.5rem' : '0 2rem',
        marginBottom: '1rem'
      }}>
        {/* Sample Management Section */}
        <div style={{
          background: 'var(--color-bg-primary)',
          borderRadius: '15px',
          boxShadow: '0 2px 8px var(--color-shadow-primary)',
          border: '1px solid var(--color-border-subtle)',
          overflow: 'hidden',
          marginBottom: '1rem',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: isMobile ? '0.5rem 1rem 0.5rem 1rem' : '0.7rem 1rem 0.5rem 1rem',
            borderBottom: '1px solid var(--color-border-medium)',
            backgroundColor: 'var(--color-bg-secondary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <h3 style={{
                margin: 0,
                color: '#222',
                fontSize: '1.25rem',
                fontWeight: 300,
              }}>
                sample management
              </h3>
            </div>
          </div>

          {/* Content */}
          <div style={{ 
            padding: isMobile ? '1rem' : '0',
          }}>
            <DrumSampleTable 
              onFileUpload={handleFileUpload}
              onClearSample={handleClearSample}
              onRecordSample={handleOpenRecording}
            />
            {/* Action Buttons Below Table - RESTORED */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end',
              alignItems: 'center',
              // padding: '1rem 0 0 0',
              padding: '1.75rem',
              flexDirection: isMobile ? 'column' : 'row'
            }}>
              <button
                onClick={handleClearAll}
                disabled={!hasLoadedSamples}
                style={{
                  minHeight: '44px',
                  minWidth: '44px',
                  padding: '0.75rem 1.5rem',
                  border: '1px solid var(--color-interactive-focus-ring)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: hasLoadedSamples ? 'var(--color-interactive-secondary)' : 'var(--color-border-medium)',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  cursor: hasLoadedSamples ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  opacity: hasLoadedSamples ? 1 : 0.6,
                  width: isMobile ? '100%' : 'auto',
                }}
                onMouseEnter={(e) => {
                  if (hasLoadedSamples) {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                    e.currentTarget.style.borderColor = 'var(--color-border-medium)';
                    e.currentTarget.style.color = 'var(--color-interactive-dark)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (hasLoadedSamples) {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                    e.currentTarget.style.borderColor = 'var(--color-interactive-focus-ring)';
                    e.currentTarget.style.color = 'var(--color-interactive-secondary)';
                  }
                }}
              >
                <i className="fas fa-trash" style={{ fontSize: '1rem' }}></i>
                clear all
              </button>
              <button
                onClick={() => setBulkEditModal(true)}
                disabled={!hasMultipleLoadedSamples}
                style={{
                  minHeight: '44px',
                  minWidth: '44px',
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: hasMultipleLoadedSamples ? 'var(--color-interactive-focus)' : 'var(--color-border-medium)',
                  color: 'var(--color-white)',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  cursor: hasMultipleLoadedSamples ? 'pointer' : 'not-allowed',
                  opacity: hasMultipleLoadedSamples ? 1 : 0.6,
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  width: isMobile ? '100%' : 'auto',
                }}
                onMouseEnter={(e) => {
                  if (hasMultipleLoadedSamples) {
                    e.currentTarget.style.backgroundColor = 'var(--color-interactive-dark)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (hasMultipleLoadedSamples) {
                    e.currentTarget.style.backgroundColor = 'var(--color-interactive-focus)';
                  }
                }}
              >
                <i className="fas fa-pencil" style={{ fontSize: '1rem' }}></i>
                bulk edit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preset Settings Panel - Always Visible */}
      <div style={{
        padding: isMobile ? '0 0.5rem' : '0 2rem',
        marginTop: '0.25rem',
      }}>
        <DrumPresetSettings />
      </div>

      {/* Audio Processing */}
      <div style={{
        padding: isMobile ? '0 0.5rem' : '0 2rem',
        marginTop: '0.25rem',
      }}>
        <AudioProcessingSection
          type="drum"
          sampleRate={state.drumSettings.sampleRate}
          bitDepth={state.drumSettings.bitDepth}
          channels={state.drumSettings.channels}
          onSampleRateChange={handleSampleRateChange}
          onBitDepthChange={handleBitDepthChange}
          onChannelsChange={handleChannelsChange}
          samples={state.drumSamples}
          normalize={state.drumSettings.normalize}
          normalizeLevel={state.drumSettings.normalizeLevel}
          onNormalizeChange={handleNormalizeChange}
          onNormalizeLevelChange={handleNormalizeLevelChange}
          onResetAudioSettingsConfirm={handleResetAudioSettingsConfirm}
        />
      </div>

      {/* Footer - Generate Preset */}
      <div style={{
        padding: isMobile ? '0 0.5rem' : '0 2rem',
        marginTop: '0.25rem',
      }}>
        <GeneratePresetSection
          type="drum"
          hasLoadedSamples={hasLoadedSamples}
          hasPresetName={hasPresetName}
          canGeneratePatch={canGeneratePatch}
          loadedSamplesCount={state.drumSamples.filter(s => s && s.isLoaded).length}
          editedSamplesCount={state.drumSamples.filter(s => s && s.hasBeenEdited).length}
          presetName={state.drumSettings.presetName}
          onPresetNameChange={handlePresetNameChange}
          hasChangesFromDefaults={hasChangesFromDefaults}
          onResetAll={handleResetAll}
          onSaveToLibrary={handleSaveToLibrary}
          onDownloadPreset={handleDownloadPreset}
          onSaveSettingsAsDefault={handleSaveSettingsAsDefault}
          inputId="preset-name"
          renameFiles={state.drumSettings.renameFiles}
          onRenameFilesChange={(enabled) => dispatch({ type: 'SET_DRUM_RENAME_FILES', payload: enabled })}
          filenameSeparator={state.drumSettings.filenameSeparator}
          onFilenameSeparatorChange={(separator) => dispatch({ type: 'SET_DRUM_FILENAME_SEPARATOR', payload: separator })}
        />
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmDialog.isOpen}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} })}
      />

      {/* Recording Modal */}
      <RecordingModal
        isOpen={recordingModal.isOpen}
        onClose={handleCloseRecording}
        onSave={handleSaveRecording}
        maxDuration={20}
      />

      {/* Bulk Edit Modal */}
      <DrumBulkEditModal
        isOpen={bulkEditModal}
        onClose={() => setBulkEditModal(false)}
      />
    </div>
  );
}