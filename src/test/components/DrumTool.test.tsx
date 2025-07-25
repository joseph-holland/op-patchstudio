import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrumTool } from '../../components/drum/DrumTool';
import { useAppContext } from '../../context/AppContext';
import { vi as vitestVi } from 'vitest';
import { AUDIO_CONSTANTS } from '../../utils/constants';

// Mock dependencies
vi.mock('../../context/AppContext');

// Mock the hooks and components
vi.mock('../../hooks/useFileUpload', () => ({
  useFileUpload: () => ({
    handleDrumSampleUpload: vi.fn(),
    clearDrumSample: vi.fn(),
  }),
}));

const mockGenerateDrumPatchFile = vi.fn();
vi.mock('../../hooks/usePatchGeneration', () => ({
  usePatchGeneration: () => ({
    generateDrumPatchFile: mockGenerateDrumPatchFile,
  }),
}));

vi.mock('../../utils/audio', () => ({
  audioBufferToWav: vi.fn(() => new ArrayBuffer(8)),
  getPatchSizeWarning: vi.fn(() => ({ warning: false, percentage: 0 })),
  formatFileSize: vi.fn((bytes: number) => `${bytes} bytes`),
}));

vi.mock('../../utils/libraryUtils', () => ({
  savePresetToLibrary: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('../../utils/sessionStorageIndexedDB', () => ({
  sessionStorageIndexedDB: {
    resetSavedToLibraryFlag: vi.fn(() => Promise.resolve()),
  },
}));

// Mock common components
vi.mock('../../components/common/ConfirmationModal', () => ({
  ConfirmationModal: ({ isOpen, message, onConfirm, onCancel }: any) => 
    isOpen ? (
      <div data-testid="confirmation-modal">
        <div>{message}</div>
        <button onClick={onConfirm}>confirm</button>
        <button onClick={onCancel}>cancel</button>
      </div>
    ) : null,
}));

vi.mock('../common/RecordingModal', () => ({
  RecordingModal: ({ isOpen, onClose, onSave }: any) => 
    isOpen ? (
      <div data-testid="recording-modal">
        <button onClick={onClose}>close</button>
        <button onClick={() => onSave(new AudioBuffer({ length: 44100, sampleRate: 44100, numberOfChannels: 1 }))}>save</button>
      </div>
    ) : null,
}));

vi.mock('../../components/common/AudioProcessingSection', () => ({
  AudioProcessingSection: ({ onResetAudioSettingsConfirm }: any) => (
    <div data-testid="audio-processing-section">
      <button onClick={onResetAudioSettingsConfirm}>reset audio settings</button>
    </div>
  ),
}));

vi.mock('../../components/common/GeneratePresetSection', () => ({
  GeneratePresetSection: ({
    hasChangesFromDefaults,
    renameFiles,
    onRenameFilesChange,
    filenameSeparator,
    onFilenameSeparatorChange,
    onResetAll,
    onSaveToLibrary,
    onDownloadPreset,
    onSaveSettingsAsDefault,
  }: any) => (
    <div data-testid="generate-preset-section">
      <span data-testid="has-changes-from-defaults">{hasChangesFromDefaults.toString()}</span>
      <button onClick={onResetAll}>reset all</button>
      <button onClick={onSaveSettingsAsDefault}>save as default</button>
      <button onClick={onSaveToLibrary}>save to library</button>
      <button onClick={onDownloadPreset}>download preset</button>
      <input
        data-testid="rename-files-toggle"
        type="checkbox"
        checked={renameFiles}
        onChange={e => onRenameFilesChange(e.target.checked)}
      />
      <select
        data-testid="filename-separator-select"
        value={filenameSeparator}
        onChange={e => onFilenameSeparatorChange(e.target.value)}
      >
        <option value=" ">space</option>
        <option value="-">hyphen</option>
      </select>
    </div>
  ),
}));

vi.mock('../../components/common/PatchSizeIndicator', () => ({
  PatchSizeIndicator: () => <div data-testid="patch-size-indicator" />,
}));
vi.mock('../../components/common/FileDetailsBadges', () => ({
  FileDetailsBadges: () => <div data-testid="file-details-badges" />,
}));

vi.mock('../../components/drum/DrumSampleTable', () => ({
  DrumSampleTable: ({ onFileUpload, onClearSample, onRecordSample }: any) => (
    <div data-testid="drum-sample-table">
      <button onClick={() => onFileUpload(0, new File([''], 'test.wav'))}>upload sample</button>
      <button onClick={() => onClearSample(0)}>clear sample</button>
      <button onClick={() => onRecordSample(0)}>record sample</button>
    </div>
  ),
}));

vi.mock('../../components/drum/DrumPresetSettings', () => ({
  DrumPresetSettings: () => <div data-testid="drum-preset-settings" />,
}));

vi.mock('./DrumBulkEditModal', () => ({
  DrumBulkEditModal: ({ isOpen, onClose }: any) => 
    isOpen ? (
      <div data-testid="bulk-edit-modal">
        <button onClick={onClose}>close</button>
      </div>
    ) : null,
}));

vi.mock('../../components/drum/DrumKeyboardContainer', () => ({
  DrumKeyboardContainer: ({ onFileUpload }: any) => (
    <div data-testid="drum-keyboard-container">
      <button onClick={() => onFileUpload(0, new File([''], 'test.wav'))}>upload test</button>
    </div>
  ),
}));

// Mock window resize
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
});

describe('DrumTool', () => {
  const mockDispatch = vi.fn();
  
  const defaultState = {
    currentTab: 'drum' as const,
    drumSettings: {
      sampleRate: 0,
      bitDepth: 0,
      channels: 0,
      presetName: '',
      normalize: false,
      normalizeLevel: AUDIO_CONSTANTS.DRUM_NORMALIZATION_LEVEL,
      autoZeroCrossing: false,
      renameFiles: false, // always present
      filenameSeparator: ' ', // always present
      audioFormat: 'wav',
      presetSettings: {
        playmode: 'poly' as const,
        transpose: 0,
        velocity: 20,
        volume: 69,
        width: 0,
      },
    },
    drumSamples: Array.from({ length: 24 }, (_, index) => ({
      file: null,
      audioBuffer: null,
      name: '',
      isLoaded: false,
      inPoint: 0,
      outPoint: 0,
      playmode: 'oneshot' as const,
      reverse: false,
      tune: 0,
      pan: 0,
      gain: 0,
      hasBeenEdited: false,
      isAssigned: true,
      assignedKey: index,
      originalBitDepth: 16,
      originalSampleRate: 44100,
      originalChannels: 2,
      fileSize: 0,
      duration: 0,
      isFloat: false
    })),
    multisampleSettings: {
      sampleRate: 0,
      bitDepth: 0,
      channels: 0,
      presetName: '',
      normalize: false,
      normalizeLevel: AUDIO_CONSTANTS.MULTISAMPLE_NORMALIZATION_LEVEL,
      cutAtLoopEnd: false,
      gain: 0,
      loopEnabled: true,
      loopOnRelease: true,
      renameFiles: false,
      filenameSeparator: ' ' as const,
    },
    multisampleFiles: [],
    selectedMultisample: null,
    isLoading: false,
    error: null,
    isDrumKeyboardPinned: false,
    isMultisampleKeyboardPinned: false,
    midiNoteMapping: 'C3' as const,
    notifications: [],
    importedDrumPreset: null,
    importedMultisamplePreset: null,
    isSessionRestorationModalOpen: false,
    sessionInfo: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock useAppContext
    (useAppContext as any).mockReturnValue({
      state: defaultState,
      dispatch: mockDispatch,
    });
  });

  it('should render without crashing', () => {
    render(<DrumTool />);
    
    expect(screen.getByTestId('drum-keyboard-container')).toBeInTheDocument();
    expect(screen.getByTestId('drum-sample-table')).toBeInTheDocument();
    expect(screen.getByTestId('drum-preset-settings')).toBeInTheDocument();
    expect(screen.getByTestId('audio-processing-section')).toBeInTheDocument();
    expect(screen.getByTestId('generate-preset-section')).toBeInTheDocument();
  });

  it('should show hasChangesFromDefaults as false when no changes from defaults', () => {
    render(<DrumTool />);
    
    expect(screen.getByTestId('has-changes-from-defaults')).toHaveTextContent('false');
  });

  it('should show hasChangesFromDefaults as true when samples are loaded', () => {
    const fakeAudioBuffer = {
      getChannelData: vitestVi.fn(() => new Float32Array(10)),
      length: 10,
      sampleRate: 44100,
      numberOfChannels: 1,
    };
    const stateWithSamples = {
      ...defaultState,
      drumSamples: [
        {
          ...defaultState.drumSamples[0],
          file: new File([''], 'test.wav'),
          audioBuffer: fakeAudioBuffer as unknown as AudioBuffer,
          name: 'test.wav',
          isLoaded: true,
        },
        ...defaultState.drumSamples.slice(1)
      ]
    };
    (useAppContext as any).mockReturnValue({
      state: stateWithSamples,
      dispatch: mockDispatch,
    });
    render(<DrumTool />);
    expect(screen.getByTestId('has-changes-from-defaults')).toHaveTextContent('true');
  });

  it('should show hasChangesFromDefaults as true when preset name is entered', () => {
    const stateWithPresetName = {
      ...defaultState,
      drumSettings: {
        ...defaultState.drumSettings,
        presetName: 'Test Preset',
      }
    };

    (useAppContext as any).mockReturnValue({
      state: stateWithPresetName,
      dispatch: mockDispatch,
    });

    render(<DrumTool />);
    
    expect(screen.getByTestId('has-changes-from-defaults')).toHaveTextContent('true');
  });

  it('should show hasChangesFromDefaults as true when renameFiles is changed from default', () => {
    const stateWithRenameFiles = {
      ...defaultState,
      drumSettings: {
        ...defaultState.drumSettings,
        renameFiles: true, // Changed from default false
      }
    };

    (useAppContext as any).mockReturnValue({
      state: stateWithRenameFiles,
      dispatch: mockDispatch,
    });

    render(<DrumTool />);
    
    expect(screen.getByTestId('has-changes-from-defaults')).toHaveTextContent('true');
  });

  it('should show hasChangesFromDefaults as true when filenameSeparator is changed from default', () => {
    const stateWithSeparator = {
      ...defaultState,
      drumSettings: {
        ...defaultState.drumSettings,
        filenameSeparator: '-' as const, // Changed from default ' '
      }
    };

    (useAppContext as any).mockReturnValue({
      state: stateWithSeparator,
      dispatch: mockDispatch,
    });

    render(<DrumTool />);
    
    expect(screen.getByTestId('has-changes-from-defaults')).toHaveTextContent('true');
  });

  it('should handle renameFiles toggle', () => {
    const stateWithRenameFiles = {
      ...defaultState,
      drumSettings: {
        ...defaultState.drumSettings,
        renameFiles: false, // initial state
        filenameSeparator: ' ',
      }
    };
    (useAppContext as any).mockReturnValue({
      state: stateWithRenameFiles,
      dispatch: mockDispatch,
    });
    render(<DrumTool />);
    const renameToggle = screen.getByTestId('rename-files-toggle');
    fireEvent.click(renameToggle);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_DRUM_RENAME_FILES',
      payload: true,
    });
  });

  it('should handle filenameSeparator change', () => {
    const stateWithSeparator = {
      ...defaultState,
      drumSettings: {
        ...defaultState.drumSettings,
        renameFiles: false,
        filenameSeparator: ' ', // initial state
      }
    };
    (useAppContext as any).mockReturnValue({
      state: stateWithSeparator,
      dispatch: mockDispatch,
    });
    render(<DrumTool />);
    const separatorSelect = screen.getByTestId('filename-separator-select');
    fireEvent.change(separatorSelect, { target: { value: '-' } });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_DRUM_FILENAME_SEPARATOR',
      payload: '-',
    });
  });

  it('should handle reset all button click', async () => {
    render(<DrumTool />);
    
    const resetButton = screen.getByText('reset all');
    fireEvent.click(resetButton);
    
    // Should open confirmation modal
    await waitFor(() => {
      expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
    });
    
    // Click confirm
    const confirmButton = screen.getByText('confirm');
    fireEvent.click(confirmButton);
    
    // Should call multiple dispatch actions to reset everything
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_DRUM_PRESET_NAME',
      payload: '',
    });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_DRUM_RENAME_FILES',
      payload: false,
    });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_DRUM_FILENAME_SEPARATOR',
      payload: ' ',
    });
  });

  it('should handle save to library button click', async () => {
    render(<DrumTool />);
    const saveButton = screen.getByText('save to library');
    fireEvent.click(saveButton);
    // Wait for async dispatch
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ADD_NOTIFICATION',
          payload: expect.objectContaining({
            type: 'success',
            title: 'preset saved',
          }),
        })
      );
    });
  });

  it('should handle download preset button click', async () => {
    mockGenerateDrumPatchFile.mockClear();
    render(<DrumTool />);
    const downloadButton = screen.getByText('download preset');
    fireEvent.click(downloadButton);
    await waitFor(() => {
      expect(mockGenerateDrumPatchFile).toHaveBeenCalledWith('drum_patch');
    });
  });
});