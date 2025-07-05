import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { audioContextManager } from '../../utils/audioContext';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { RecordingModal } from '../common/RecordingModal';
import { AudioProcessingSection } from '../common/AudioProcessingSection';
import { GeneratePresetSection } from '../common/GeneratePresetSection';
import { ErrorDisplay } from '../common/ErrorDisplay';
import { MultisampleSampleTable } from './MultisampleSampleTable';
import { MultisamplePresetSettings } from './MultisamplePresetSettings';
import { VirtualMidiKeyboard } from './VirtualMidiKeyboard';
import { useFileUpload } from '../../hooks/useFileUpload';
import { usePatchGeneration } from '../../hooks/usePatchGeneration';
import { audioBufferToWav } from '../../utils/audio';
import { cookieUtils, COOKIE_KEYS } from '../../utils/cookies';


export function MultisampleTool() {
  const { state, dispatch } = useAppContext();
  const { handleMultisampleUpload, clearMultisampleFile } = useFileUpload();
  const { generateMultisamplePatchFile } = usePatchGeneration();
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const browseFilesRef = useRef<(() => void) | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, message: '', onConfirm: () => {} });
  const [recordingModal, setRecordingModal] = useState<{
    isOpen: boolean;
    targetIndex: number | null;
  }>({ isOpen: false, targetIndex: null });

  const [targetMidiNote, setTargetMidiNote] = useState<number | null>(null);

  // Get pin state from context
  const { isMultisampleKeyboardPinned } = state;

  const handleTogglePin = useCallback(() => {
    dispatch({ type: 'TOGGLE_MULTISAMPLE_KEYBOARD_PIN' });
  }, [dispatch]);
  
  // Effect to save pin state to cookies
  useEffect(() => {
    try {
      cookieUtils.setCookie(COOKIE_KEYS.MULTISAMPLE_KEYBOARD_PINNED, String(isMultisampleKeyboardPinned));
    } catch (error) {
      console.warn('Failed to save multisample keyboard pin state to cookie:', error);
    }
  }, [isMultisampleKeyboardPinned]);

  // Create a zone map for the multisamples
  const zoneMap = useMemo(() => {
    const map = new Map<number, { rootNote: number; pitchOffset: number }>();
    if (state.multisampleFiles.length === 0) {
      return map;
    }

    // Since the files are sorted by rootNote descending, we can iterate through all MIDI notes
    for (let midiNote = 0; midiNote <= 127; midiNote++) {
      // Find the first sample whose rootNote is >= the current midiNote
      const rootSample = state.multisampleFiles.find(sample => sample.rootNote >= midiNote);

      if (rootSample) {
        map.set(midiNote, {
          rootNote: rootSample.rootNote,
          pitchOffset: midiNote - rootSample.rootNote,
        });
      }
    }
    return map;
  }, [state.multisampleFiles]);

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
    dispatch({ type: 'SET_MULTISAMPLE_SAMPLE_RATE', payload: parseInt(value, 10) });
  };

  const handleBitDepthChange = (value: string) => {
    dispatch({ type: 'SET_MULTISAMPLE_BIT_DEPTH', payload: parseInt(value, 10) });
  };

  const handleChannelsChange = (value: string) => {
    dispatch({ type: 'SET_MULTISAMPLE_CHANNELS', payload: parseInt(value, 10) });
  };

  const handlePresetNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_MULTISAMPLE_PRESET_NAME', payload: e.target.value });
  };

  const handleNormalizeChange = (enabled: boolean) => {
    dispatch({ type: 'SET_MULTISAMPLE_NORMALIZE', payload: enabled });
  };

  const handleNormalizeLevelChange = (level: number) => {
    dispatch({ type: 'SET_MULTISAMPLE_NORMALIZE_LEVEL', payload: level });
  };

  const handleCutAtLoopEndChange = (enabled: boolean) => {
    dispatch({ type: 'SET_MULTISAMPLE_CUT_AT_LOOP_END', payload: enabled });
  };

  const handleResetAudioSettingsConfirm = () => {
    setConfirmDialog({
      isOpen: true,
      message: 'are you sure you want to reset all audio processing settings to defaults?',
      onConfirm: () => {
        dispatch({ type: 'SET_MULTISAMPLE_SAMPLE_RATE', payload: 0 });
        dispatch({ type: 'SET_MULTISAMPLE_BIT_DEPTH', payload: 0 });
        dispatch({ type: 'SET_MULTISAMPLE_CHANNELS', payload: 0 });
        dispatch({ type: 'SET_MULTISAMPLE_NORMALIZE', payload: false });
        dispatch({ type: 'SET_MULTISAMPLE_NORMALIZE_LEVEL', payload: 0.0 });
        dispatch({ type: 'SET_MULTISAMPLE_CUT_AT_LOOP_END', payload: false });
        setConfirmDialog({ isOpen: false, message: '', onConfirm: () => {} });
      }
    });
  };

  const handleFilesSelected = async (files: File[]) => {
    // Process files one by one
    for (const file of files) {
      await handleMultisampleUpload(file);
    }
  };

  const handleFileUpload = async (_index: number, file: File) => {
    try {
      await handleMultisampleUpload(file);
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const handleClearSample = (index: number) => {
    setConfirmDialog({
      isOpen: true,
      message: 'are you sure you want to clear this sample?',
      onConfirm: () => {
        clearMultisampleFile(index);
        setConfirmDialog({ isOpen: false, message: '', onConfirm: () => {} });
      }
    });
  };

  const handleGeneratePatch = async () => {
    try {
      const patchName = state.multisampleSettings.presetName.trim() || 'multisample_patch';
      await generateMultisamplePatchFile(patchName);
    } catch (error) {
      console.error('Error generating patch:', error);
    }
  };

  const handleClearAll = () => {
    setConfirmDialog({
      isOpen: true,
      message: 'are you sure you want to clear all loaded samples?',
      onConfirm: () => {
        for (let i = state.multisampleFiles.length - 1; i >= 0; i--) {
          clearMultisampleFile(i);
        }
        setConfirmDialog({ isOpen: false, message: '', onConfirm: () => {} });
      }
    });
  };

  const handleResetAll = () => {
    setConfirmDialog({
      isOpen: true,
      message: 'are you sure you want to reset everything to defaults? this will clear all samples, reset preset name, and audio settings.',
      onConfirm: () => {
        // Clear all samples
        for (let i = state.multisampleFiles.length - 1; i >= 0; i--) {
          clearMultisampleFile(i);
        }
        
        // Reset preset name
        dispatch({ type: 'SET_MULTISAMPLE_PRESET_NAME', payload: '' });
        
        // Reset audio format settings to defaults (0 = original)
        dispatch({ type: 'SET_MULTISAMPLE_SAMPLE_RATE', payload: 0 });
        dispatch({ type: 'SET_MULTISAMPLE_BIT_DEPTH', payload: 0 });
        dispatch({ type: 'SET_MULTISAMPLE_CHANNELS', payload: 0 });
        
        // Reset normalize and cut settings
        dispatch({ type: 'SET_MULTISAMPLE_NORMALIZE', payload: false });
        dispatch({ type: 'SET_MULTISAMPLE_NORMALIZE_LEVEL', payload: 0.0 });
        dispatch({ type: 'SET_MULTISAMPLE_CUT_AT_LOOP_END', payload: false });
        
        setConfirmDialog({ isOpen: false, message: '', onConfirm: () => {} });
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
      // Convert AudioBuffer to WAV blob
      const wavBlob = await audioBufferToWav(audioBuffer);
      
      // Create a File object with the provided filename
      const file = new File([wavBlob], `${filename}.wav`, { type: 'audio/wav' });
      
      // If we have a target MIDI note, use it; otherwise let the system assign one
      if (targetMidiNote !== null) {
        await handleMultisampleUpload(file, targetMidiNote);
      } else {
        await handleMultisampleUpload(file);
      }
      
      // Reset target note
      setTargetMidiNote(null);
    } catch (error) {
      console.error('Error saving recording:', error);
    }
  };

  const handleAudioFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be selected again
    event.target.value = '';

    if (targetMidiNote !== null) {
      try {
        // Here, we manually create the payload for handleMultisampleUpload
        // so we can set the rootNote BEFORE it goes into the context and gets sorted.
        await handleMultisampleUpload(file, targetMidiNote);
        setTargetMidiNote(null);
      } catch (error) {
        console.error('Error uploading file for MIDI note assignment:', error);
        setTargetMidiNote(null);
      }
    }
  };

  // Handler for clicking an assigned key
  const handleKeyClick = useCallback(async (midiNote: number) => {
    const zoneInfo = zoneMap.get(midiNote);
    if (!zoneInfo) return;

    const { rootNote, pitchOffset } = zoneInfo;
    
    // Find the sample that is the root for this zone
    const rootSample = state.multisampleFiles.find(f => f.rootNote === rootNote);

    if (rootSample && rootSample.audioBuffer) {
      try {
        const audioContext = await audioContextManager.getAudioContext();
        const source = audioContext.createBufferSource();
        source.buffer = rootSample.audioBuffer;

        // Apply pitch shifting
        const playbackRate = Math.pow(2, pitchOffset / 12);
        source.playbackRate.value = playbackRate;

        source.connect(audioContext.destination);
        source.start();
      } catch (error) {
        console.error("Error playing pitched sample:", error);
      }
    }
  }, [zoneMap, state.multisampleFiles]);

  // Handler for clicking an unassigned key
  const handleUnassignedKeyClick = useCallback((midiNote: number) => {
    // Store the target MIDI note and open audio file browser
    setTargetMidiNote(midiNote);
    audioFileInputRef.current?.click();
  }, []);

  // Handler for dropping files onto keys
  const handleKeyDrop = useCallback(async (midiNote: number, files: File[]) => {
    // Handle drag and drop onto specific MIDI keys
    if (files.length > 0 && state.multisampleFiles.length < 24) {
      const file = files[0]; // Use first file
      // Pass the target midiNote to the upload function
      await handleMultisampleUpload(file, midiNote);
    }
  }, [state.multisampleFiles.length, handleMultisampleUpload]);

  const hasLoadedSamples = state.multisampleFiles.length > 0;
  const hasPresetName = state.multisampleSettings.presetName.trim().length > 0;
  const canGeneratePatch = hasLoadedSamples && hasPresetName;
  
  // Check if any settings have been changed from defaults
  const hasChangesFromDefaults = (
    hasLoadedSamples || // Any samples loaded
    hasPresetName || // Preset name entered
    state.multisampleSettings.sampleRate !== 0 || // Audio format changed
    state.multisampleSettings.bitDepth !== 0 ||
    state.multisampleSettings.channels !== 0 ||
    state.multisampleSettings.normalize !== false || // Normalize settings changed
    state.multisampleSettings.normalizeLevel !== 0.0 ||
    state.multisampleSettings.cutAtLoopEnd !== false // Cut at loop end changed
    // Note: Multisample preset settings are handled in MultisamplePresetSettings component
  );

  return (
    <div style={{ 
      fontFamily: '"Montserrat", "Arial", sans-serif',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      {/* Header Section */}


      {/* Separate input for audio files from MIDI key clicks */}
      <input
        ref={audioFileInputRef}
        type="file"
        accept="audio/*,.wav"
        onChange={handleAudioFileImport}
        style={{ display: 'none' }}
      />

      {/* Virtual MIDI Keyboard Section */}
      <div style={{
        padding: isMobile ? '1rem 0.5rem' : '2rem 2rem',
      }}>
        <ErrorDisplay message={state.error || ''} />

        <div style={{ position: 'relative' }}>
          <VirtualMidiKeyboard
            assignedNotes={Array.from(zoneMap.keys())}
            onKeyClick={handleKeyClick}
            onUnassignedKeyClick={handleUnassignedKeyClick}
            onKeyDrop={handleKeyDrop}
            loadedSamplesCount={state.multisampleFiles.length}
            isPinned={isMultisampleKeyboardPinned}
            onTogglePin={handleTogglePin}
          />
        </div>
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
            padding: isMobile ? '1rem' : '2rem',
          }}>
            <MultisampleSampleTable 
              onFileUpload={handleFileUpload}
              onClearSample={handleClearSample}
              onRecordSample={handleOpenRecording}
              onFilesSelected={handleFilesSelected}
              onBrowseFilesRef={browseFilesRef}
            />
            
            {/* Action Buttons Below Table */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: isMobile ? 'center' : 'flex-end',
              flexDirection: isMobile ? 'column' : 'row',
              marginTop: '2rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid var(--color-border-light)',
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
                clear all samples
              </button>
              <button
                onClick={() => setRecordingModal({ isOpen: true, targetIndex: null })}
                style={{
                  minHeight: '44px',
                  minWidth: '44px',
                  padding: '0.75rem 1.5rem',
                  border: '1px solid var(--color-interactive-focus-ring)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-interactive-secondary)',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  width: isMobile ? '100%' : 'auto',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                  e.currentTarget.style.borderColor = 'var(--color-border-medium)';
                  e.currentTarget.style.color = 'var(--color-interactive-dark)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                  e.currentTarget.style.borderColor = 'var(--color-interactive-focus-ring)';
                  e.currentTarget.style.color = 'var(--color-interactive-secondary)';
                }}
              >
                <i className="fas fa-microphone" style={{ fontSize: '1rem' }}></i>
                record sample
              </button>
              <button
                onClick={() => {
                  // Trigger the browse files function from MultisampleSampleTable
                  if (browseFilesRef.current) {
                    browseFilesRef.current();
                  }
                }}
                style={{
                  minHeight: '44px',
                  minWidth: '44px',
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-interactive-focus)',
                  color: 'var(--color-white)',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  width: isMobile ? '100%' : 'auto',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-interactive-dark)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-interactive-focus)';
                }}
              >
                <i className="fas fa-folder-open" style={{ fontSize: '1rem' }}></i>
                browse files
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
        <MultisamplePresetSettings />
      </div>

      {/* Audio Processing */}
      <div style={{
        padding: isMobile ? '0 0.5rem' : '0 2rem',
        marginTop: '0.25rem',
      }}>
        <AudioProcessingSection
          type="multisample"
          sampleRate={state.multisampleSettings.sampleRate}
          bitDepth={state.multisampleSettings.bitDepth}
          channels={state.multisampleSettings.channels}
          onSampleRateChange={handleSampleRateChange}
          onBitDepthChange={handleBitDepthChange}
          onChannelsChange={handleChannelsChange}
          samples={state.multisampleFiles}
          normalize={state.multisampleSettings.normalize}
          normalizeLevel={state.multisampleSettings.normalizeLevel}
          onNormalizeChange={handleNormalizeChange}
          onNormalizeLevelChange={handleNormalizeLevelChange}
          cutAtLoopEnd={state.multisampleSettings.cutAtLoopEnd}
          onCutAtLoopEndChange={handleCutAtLoopEndChange}
          onResetAudioSettingsConfirm={handleResetAudioSettingsConfirm}
        />
      </div>

      {/* Footer - Generate Preset */}
      <div style={{
        padding: isMobile ? '0 0.5rem' : '0 2rem',
        marginTop: '0.25rem',
      }}>
        <GeneratePresetSection
          type="multisample"
          hasLoadedSamples={hasLoadedSamples}
          hasPresetName={hasPresetName}
          canGeneratePatch={canGeneratePatch}
          loadedSamplesCount={state.multisampleFiles.length}
          editedSamplesCount={0} // Multisample doesn't have individual sample editing yet
          presetName={state.multisampleSettings.presetName}
          onPresetNameChange={handlePresetNameChange}
          hasChangesFromDefaults={hasChangesFromDefaults}
          onResetAll={handleResetAll}
          onGeneratePatch={handleGeneratePatch}
          inputId="preset-name-multi"
        />
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmDialog.isOpen}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, message: '', onConfirm: () => {} })}
      />

      {/* Recording Modal */}
      <RecordingModal
        isOpen={recordingModal.isOpen}
        onClose={handleCloseRecording}
        onSave={handleSaveRecording}
        maxDuration={20}
      />


    </div>
  );
}