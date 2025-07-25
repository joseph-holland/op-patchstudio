import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
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
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { audioBufferToWav } from '../../utils/wavExport';
import { cookieUtils, COOKIE_KEYS } from '../../utils/cookies';
import { savePresetToLibrary } from '../../utils/libraryUtils';
import { sessionStorageIndexedDB } from '../../utils/sessionStorageIndexedDB';
import { ToggleSwitch } from '../common/ToggleSwitch';
import { saveMultisampleSettingsAsDefault } from '../../utils/defaultSettings';
import { AUDIO_CONSTANTS } from '../../utils/constants';


export function MultisampleTool() {
  const { state, dispatch } = useAppContext();
  const { handleMultisampleUpload, clearMultisampleFile } = useFileUpload();
  const { generateMultisamplePatchFile } = usePatchGeneration();
  const { playWithADSR, releaseNote } = useAudioPlayer();
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const browseFilesRef = useRef<(() => void) | null>(null);
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

  const [targetMidiNote, setTargetMidiNote] = useState<number | null>(null);
  const [selectedMidiChannel, setSelectedMidiChannel] = useState(() => {
    const saved = localStorage.getItem('midi-channel');
    return saved ? parseInt(saved, 10) : 1;
  });

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

    // Sort samples by rootNote ascending for proper zone calculation
    const sortedSamples = [...state.multisampleFiles].sort((a, b) => a.rootNote - b.rootNote);
    
    // Iterate through all MIDI notes
    for (let midiNote = 0; midiNote <= 127; midiNote++) {
      let rootSample = null;
      
      // Find the sample that should handle this MIDI note
      // Rule: Each sample covers from its root note DOWN to just above the next lower sample
      // The topmost sample also covers notes UP from its root note
      
      for (let i = sortedSamples.length - 1; i >= 0; i--) {
        const sample = sortedSamples[i];
        const prevSample = i > 0 ? sortedSamples[i - 1] : null;
        
        if (i === sortedSamples.length - 1) {
          // Topmost sample - covers from its root note UP to 127
          if (midiNote >= sample.rootNote) {
            rootSample = sample;
            break;
          }
        }
        
        // All samples (including topmost) cover DOWN from their root note
        if (prevSample) {
          // Has a lower sample - covers from just above prev sample down to its own root
          if (midiNote > prevSample.rootNote && midiNote <= sample.rootNote) {
            rootSample = sample;
            break;
          }
        } else {
          // Lowest sample - covers from its root note down to MIDI note 0
          if (midiNote <= sample.rootNote) {
            rootSample = sample;
            break;
          }
        }
      }

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

  const handleGainChange = (gain: number) => {
    dispatch({ type: 'SET_MULTISAMPLE_GAIN', payload: gain });
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
        dispatch({ type: 'SET_MULTISAMPLE_NORMALIZE_LEVEL', payload: AUDIO_CONSTANTS.MULTISAMPLE_NORMALIZATION_LEVEL });
        dispatch({ type: 'SET_MULTISAMPLE_CUT_AT_LOOP_END', payload: false });
        dispatch({ type: 'SET_MULTISAMPLE_GAIN', payload: 0 });
        dispatch({ type: 'SET_MULTISAMPLE_LOOP_ENABLED', payload: true });
        dispatch({ type: 'SET_MULTISAMPLE_LOOP_ON_RELEASE', payload: true });
        setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} });
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
      onConfirm: async () => {
        clearMultisampleFile(index);
        setConfirmDialog({ isOpen: false, message: '', onConfirm: async () => {} });
      }
    });
  };



  const handleSaveToLibrary = async () => {
    try {
      const result = await savePresetToLibrary(state, state.multisampleSettings.presetName, 'multisample');
      if (result.success) {
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            id: Date.now().toString(),
            type: 'success',
            title: 'preset saved',
            message: `"${state.multisampleSettings.presetName}" saved to library`
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
      const patchName = state.multisampleSettings.presetName.trim() || 'multisample_patch';
      await generateMultisamplePatchFile(patchName);
    } catch (error) {
      console.error('Error downloading preset:', error);
    }
  };

  const handleSaveSettingsAsDefault = () => {
    try {
      saveMultisampleSettingsAsDefault(state.multisampleSettings, state.importedMultisamplePreset);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'success',
          title: 'settings saved',
          message: 'multisample settings saved as default'
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
        for (let i = state.multisampleFiles.length - 1; i >= 0; i--) {
          clearMultisampleFile(i);
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
      message: 'are you sure you want to reset everything to defaults? this will clear all samples, reset preset name and audio settings.',
      onConfirm: async () => {
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
        dispatch({ type: 'SET_MULTISAMPLE_NORMALIZE_LEVEL', payload: AUDIO_CONSTANTS.MULTISAMPLE_NORMALIZATION_LEVEL });
        dispatch({ type: 'SET_MULTISAMPLE_CUT_AT_LOOP_END', payload: false });
        dispatch({ type: 'SET_MULTISAMPLE_GAIN', payload: 0 });
        dispatch({ type: 'SET_MULTISAMPLE_LOOP_ENABLED', payload: true });
        dispatch({ type: 'SET_MULTISAMPLE_LOOP_ON_RELEASE', payload: true });
        
        // Reset file renaming settings to defaults
        dispatch({ type: 'SET_MULTISAMPLE_RENAME_FILES', payload: false });
        dispatch({ type: 'SET_MULTISAMPLE_FILENAME_SEPARATOR', payload: ' ' });
        
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
      // Convert AudioBuffer to WAV blob with metadata
      const wavBlob = await audioBufferToWav(audioBuffer, 16, {
        rootNote: targetMidiNote ?? 60,
        loopStart: 0,
        loopEnd: audioBuffer.length - 1
      });
      
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
        // Apply pitch shifting
        const playbackRate = Math.pow(2, pitchOffset / 12);
        
        // Get ADSR settings from imported preset or use defaults
        const adsrSettings = state.importedMultisamplePreset?.envelope?.amp || {
          attack: 0,
          decay: 0,
          sustain: 32767,
          release: 0
        };
        
        // Get play mode from imported preset or use poly as default
        const playMode = state.importedMultisamplePreset?.engine?.playmode || 'poly';
        
        // Use the ADSR-enabled audio player
        const noteId = `multisample-${midiNote}-${Date.now()}`;
        await playWithADSR(rootSample.audioBuffer, noteId, {
          playbackRate,
          gain: state.multisampleSettings.gain || 0,
          pan: 0, // No pan control for multisample
          adsr: adsrSettings,
          playMode: playMode as 'poly' | 'mono' | 'legato',
          velocity: 127, // Full velocity for keyboard clicks
        });
      } catch (error) {
        console.error("Error playing pitched sample:", error);
      }
    }
  }, [zoneMap, state.multisampleFiles, playWithADSR, state.multisampleSettings.gain, state.importedMultisamplePreset]);

  // Handler for releasing a key (for ADSR release phase)
  const handleKeyRelease = useCallback((midiNote: number) => {
    // Release all notes that match this MIDI note (could be multiple if same note played multiple times)
    // The audio player will handle finding and releasing the correct note(s)
    // We'll try all possible noteIds for this midiNote
    // (e.g., multisample-60, multisample-60-<timestamp>)
    // For robust release, release all notes that start with `multisample-${midiNote}`
    const activeNotes = (window as any).opPatchstudioActiveNotes || [];
    if (Array.isArray(activeNotes)) {
      activeNotes
        .filter((id: string) => id.startsWith(`multisample-${midiNote}`))
        .forEach((id: string) => releaseNote(id));
    } else {
      // Fallback: try to release any note that starts with the correct pattern
      // Since we can't access the global active notes, we'll use a pattern approach
      // The audio player will find and release all notes starting with this pattern
      releaseNote(`multisample-${midiNote}-`);
    }
  }, [releaseNote]);

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
    state.multisampleSettings.normalizeLevel !== AUDIO_CONSTANTS.MULTISAMPLE_NORMALIZATION_LEVEL ||
    state.multisampleSettings.renameFiles !== false || // File renaming settings changed
    state.multisampleSettings.filenameSeparator !== ' ' ||
    state.multisampleSettings.cutAtLoopEnd !== false // Trim to loop end changed
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
            onKeyClick={handleKeyClick} // Pass the handler directly so source is respected
            onKeyRelease={handleKeyRelease} // Add release handler for ADSR
            onUnassignedKeyClick={handleUnassignedKeyClick}
            onKeyDrop={handleKeyDrop}
            loadedSamplesCount={state.multisampleFiles.length}
            isPinned={isMultisampleKeyboardPinned}
            onTogglePin={handleTogglePin}
            selectedMidiChannel={selectedMidiChannel}
            onMidiChannelChange={(channel) => {
              setSelectedMidiChannel(channel);
              localStorage.setItem('midi-channel', channel.toString());
            }}
            isActive={state.currentTab === 'multisample'}
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
                textTransform: 'lowercase',
                letterSpacing: 0,
              }}>
                sample management
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <ToggleSwitch
                leftLabel="c3=60"
                rightLabel="c4=60"
                isRight={state.midiNoteMapping === 'C4'}
                onToggle={() => {
                  dispatch({
                    type: 'SET_MIDI_NOTE_MAPPING',
                    payload: state.midiNoteMapping === 'C3' ? 'C4' : 'C3'
                  })
                }}
              />
            </div>
          </div>

          {/* Content */}
          <div style={{ 
            padding: 0,
          }}>
            <MultisampleSampleTable 
              onFileUpload={handleFileUpload}
              onClearSample={handleClearSample}
              onRecordSample={handleOpenRecording}
              onFilesSelected={handleFilesSelected}
              onBrowseFilesRef={browseFilesRef}
            />
            {/* Footer Button Group - Drum Tool Style */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                background: 'var(--color-bg-primary)',
                borderTop: '1px solid var(--color-border-light)',
                padding: '1.75rem',
                margin: 0,
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
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
                  marginRight: '1rem',
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
                  marginRight: '1rem',
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
                <i className="fas fa-microphone" style={{ fontSize: '1rem', color: 'var(--color-accent-primary)' }}></i>
                record
              </button>
              <button
                onClick={() => {
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
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-interactive-dark)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-interactive-focus)';
                }}
              >
                <i className="fas fa-folder-open" style={{ fontSize: '1rem' }}></i>
                browse
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
          autoZeroCrossing={state.multisampleSettings.autoZeroCrossing}
          onAutoZeroCrossingChange={() => {
            dispatch({ type: 'APPLY_ZERO_CROSSING_TO_ALL_MULTISAMPLE_FILES' });
          }}
          gain={state.multisampleSettings.gain}
          onGainChange={handleGainChange}
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
          onSaveToLibrary={handleSaveToLibrary}
          onDownloadPreset={handleDownloadPreset}
          onSaveSettingsAsDefault={handleSaveSettingsAsDefault}
          inputId="preset-name-multi"
          renameFiles={state.multisampleSettings.renameFiles}
          onRenameFilesChange={(enabled) => dispatch({ type: 'SET_MULTISAMPLE_RENAME_FILES', payload: enabled })}
          filenameSeparator={state.multisampleSettings.filenameSeparator}
          onFilenameSeparatorChange={(separator) => dispatch({ type: 'SET_MULTISAMPLE_FILENAME_SEPARATOR', payload: separator })}
          audioFormat={state.multisampleSettings.audioFormat}
          onAudioFormatChange={(format) => dispatch({ type: 'SET_MULTISAMPLE_AUDIO_FORMAT', payload: format })}
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


    </div>
  );
}