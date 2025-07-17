import { useState, useEffect, useCallback, useRef } from 'react';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { LibraryTable } from './LibraryTable';
import { LibraryFilters } from './LibraryFilters';
import { LibraryTableContent } from './LibraryTableContent';
import { LibraryPagination } from './LibraryPagination';
import { useAppContext } from '../../context/AppContext';
import { indexedDB, STORES } from '../../utils/indexedDB';
import { generateDrumPatch, generateMultisamplePatch, downloadBlob } from '../../utils/patchGeneration';
import type { LibraryPreset } from '../../utils/libraryUtils';
import { blobToAudioBuffer } from '../../utils/libraryUtils';
import { sessionStorageIndexedDB } from '../../utils/sessionStorageIndexedDB';

// Default values for clean state restoration
const defaultDrumSettings = {
  sampleRate: 44100,
  bitDepth: 16,
  channels: 2,
  presetName: '',
  normalize: false,
  normalizeLevel: -0.1, // Default to -0.1 dBFS for safety
  presetSettings: {
    playmode: 'poly' as const,
    transpose: 0,
    velocity: 20,
    volume: 69,
    width: 0
  }
};

const defaultMultisampleSettings = {
  sampleRate: 44100,
  bitDepth: 16,
  channels: 2,
  presetName: '',
  normalize: false,
  normalizeLevel: -0.1, // Default to -0.1 dBFS for safety
  cutAtLoopEnd: false,
  gain: 0,
  loopEnabled: true,
  loopOnRelease: true
};

// Initial drum sample for array reconstruction
const initialDrumSample = {
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
  hasBeenEdited: false
};

// Helper to restore audioBuffers from blobs for drum samples (with index preservation)
async function restoreDrumSamples(drumSamples: any[], audioContext: AudioContext) {
  const restoredSamples: any[] = [];
  
  for (const sample of drumSamples) {
    if (sample && sample.audioBlob && typeof sample.originalIndex === 'number') {
      try {
        const audioBuffer = await blobToAudioBuffer(sample.audioBlob, audioContext);
        const { audioBlob, originalIndex, ...rest } = sample;
        
        // Validate metadata
        if (!rest.metadata || typeof rest.metadata.duration !== 'number') {
          console.error('Missing or invalid metadata for drum sample:', sample.name, rest.metadata);
          continue;
        }
        
        restoredSamples.push({
          ...rest,
          audioBuffer,
          originalIndex,
          file: new File([sample.audioBlob], sample.name, { type: 'audio/wav' }),
          isAssigned: true,
          assignedKey: sample.originalIndex
        });
      } catch (error) {
        console.error('Failed to restore audio buffer for drum sample:', sample.name, error);
      }
    }
  }
  
  return restoredSamples;
}

// Helper to restore audioBuffers from blobs for multisample files
async function restoreMultisampleFiles(multisampleFiles: any[], audioContext: AudioContext) {
  return Promise.all(multisampleFiles.map(async (file) => {
    if (file && file.audioBlob) {
      try {
        const audioBuffer = await blobToAudioBuffer(file.audioBlob, audioContext);
        const { audioBlob, ...rest } = file;
        
        // Validate metadata
        if (!rest.metadata || typeof rest.metadata.duration !== 'number') {
          console.error('Missing or invalid metadata for multisample file:', file.name, rest.metadata);
          return null;
        }
        
        return {
          ...rest,
          audioBuffer,
          file: new File([file.audioBlob], file.name, { type: 'audio/wav' })
        };
      } catch (error) {
        console.error('Failed to restore audio buffer for multisample file:', file.name, error);
        return null;
      }
    }
    return null;
  })).then(files => files.filter(file => file !== null));
}

export function LibraryPage() {
  const { state, dispatch } = useAppContext();
  const [presets, setPresets] = useState<LibraryPreset[]>([]);
  const [filteredPresets, setFilteredPresets] = useState<LibraryPreset[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'drum' | 'multisample'>('all');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [presetToDelete, setPresetToDelete] = useState<LibraryPreset | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const isMobile = window.innerWidth < 768;
  const pageSize = isMobile ? 10 : 15;
  const [isLoadConfirmOpen, setIsLoadConfirmOpen] = useState(false);
  const [pendingPresetToLoad, setPendingPresetToLoad] = useState<LibraryPreset | null>(null);
  
  // Ref to track current state for async operations
  const currentStateRef = useRef(state);
  currentStateRef.current = state;
  
  // Ref to track files that need updates after loading
  const pendingUpdatesRef = useRef<Array<{file: any, updates: any}>>([]);

  // Apply pending updates when multisample files change
  useEffect(() => {
    if (pendingUpdatesRef.current.length > 0 && state.multisampleFiles.length > 0) {
      pendingUpdatesRef.current.forEach(({ file, updates }) => {
        // Find the file in the current state by name and rootNote
        const fileIndex = state.multisampleFiles.findIndex(f => 
          f && f.name === file.file.name && f.rootNote === file.rootNote
        );
        
        if (fileIndex !== -1) {
          dispatch({
            type: 'UPDATE_MULTISAMPLE_FILE',
            payload: {
              index: fileIndex,
              updates
            }
          });
        } else {
          console.warn(`Could not find multisample file to update settings for file ${file.file.name} with rootNote ${file.rootNote}`);
        }
      });
      
      // Clear the pending updates
      pendingUpdatesRef.current = [];
    }
  }, [state.multisampleFiles, dispatch]);

  // Calculate paginated presets
  const paginatedPresets = filteredPresets.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.max(1, Math.ceil(filteredPresets.length / pageSize));

  const loadPresets = useCallback(async () => {
    try {
      setIsLoading(true);
      const allPresets = await indexedDB.getAll<LibraryPreset>(STORES.PRESETS);
      setPresets(allPresets);
    } catch (error) {
      console.error('Failed to load presets:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'error',
          title: 'load failed',
          message: 'failed to load presets from library'
        }
      });
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  // Load presets from IndexedDB
  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  // Refresh presets when switching to library tab
  useEffect(() => {
    if (state.currentTab === 'library') {
      // Add a small delay to ensure any pending save operations complete
      const timer = setTimeout(() => {
        loadPresets();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [state.currentTab, loadPresets]);

  // Listen for library refresh events
  useEffect(() => {
    const handleLibraryRefresh = () => {
      if (state.currentTab === 'library') {
        loadPresets();
      }
    };

    window.addEventListener('library-refresh', handleLibraryRefresh);
    return () => {
      window.removeEventListener('library-refresh', handleLibraryRefresh);
    };
  }, [state.currentTab, loadPresets]);

  // Filter and sort presets
  useEffect(() => {
    let filtered = presets;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(preset => 
        preset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        preset.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        preset.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(preset => preset.type === filterType);
    }

    // Apply favorites filter
    if (filterFavorites) {
      filtered = filtered.filter(preset => preset.isFavorite);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = a.updatedAt - b.updatedAt;
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredPresets(filtered);
  }, [presets, searchTerm, filterType, filterFavorites, sortBy, sortOrder]);

  const handleSort = (column: 'name' | 'date' | 'type') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'date' ? 'desc' : 'asc');
    }
  };

  // Helper: is there a session in progress?
  const sessionInProgress = state.drumSamples.some(s => s.isLoaded) || state.multisampleFiles.length > 0;

  // Wrapped handler for preset loading with confirmation
  const handleLoadPreset = async (preset: LibraryPreset) => {
    if (sessionInProgress) {
      setPendingPresetToLoad(preset);
      setIsLoadConfirmOpen(true);
      return;
    }
    await actuallyLoadPreset(preset);
  };

  // The actual preset loading logic (moved from old handleLoadPreset)
  const actuallyLoadPreset = async (preset: LibraryPreset) => {
    try {
      // Set a flag to prevent session restoration from interfering
      window.sessionStorage.setItem('loading-preset', 'true');
      
      // Clear any pending updates from previous loads
      pendingUpdatesRef.current = [];
      
      // Clear any existing session to avoid interference
      await sessionStorageIndexedDB.clearCurrentSession();
      
      // Reset any saved to library flags to ensure clean state
      await sessionStorageIndexedDB.resetSavedToLibraryFlag();
      
      // Switch to the appropriate tab
      dispatch({ type: 'SET_TAB', payload: preset.type });

      // Restore the complete state from the saved preset
      const presetData = preset.data as any;
      const audioContext = window.AudioContext ? new window.AudioContext() : new (window as any).webkitAudioContext();



      if (preset.type === 'drum') {
        // Restore drum settings
        const drumSettings = presetData.drumSettings || defaultDrumSettings;
        dispatch({ type: 'SET_DRUM_SAMPLE_RATE', payload: drumSettings.sampleRate });
        dispatch({ type: 'SET_DRUM_BIT_DEPTH', payload: drumSettings.bitDepth });
        dispatch({ type: 'SET_DRUM_CHANNELS', payload: drumSettings.channels });
        dispatch({ type: 'SET_DRUM_PRESET_NAME', payload: drumSettings.presetName });
        dispatch({ type: 'SET_DRUM_NORMALIZE', payload: drumSettings.normalize });
        dispatch({ type: 'SET_DRUM_NORMALIZE_LEVEL', payload: drumSettings.normalizeLevel });
        dispatch({ type: 'SET_DRUM_PRESET_PLAYMODE', payload: drumSettings.presetSettings.playmode });
        dispatch({ type: 'SET_DRUM_PRESET_TRANSPOSE', payload: drumSettings.presetSettings.transpose });
        dispatch({ type: 'SET_DRUM_PRESET_VELOCITY', payload: drumSettings.presetSettings.velocity });
        dispatch({ type: 'SET_DRUM_PRESET_VOLUME', payload: drumSettings.presetSettings.volume });
        dispatch({ type: 'SET_DRUM_PRESET_WIDTH', payload: drumSettings.presetSettings.width });

        // Restore drum samples
        let restoredSamples: any[] = [];
        try {
          restoredSamples = await restoreDrumSamples(presetData.drumSamples || [], audioContext);
        } catch (error) {
          console.error('Failed to restore drum samples:', error);
          restoredSamples = [];
        }
        
        // Clear existing samples and load new ones
        for (let i = 0; i < 24; i++) {
          dispatch({ type: 'CLEAR_DRUM_SAMPLE', payload: i });
        }
        
        // Load samples back to their original indexes
        restoredSamples.forEach((sample) => {
          if (sample && 
              sample.file && 
              sample.audioBuffer && 
              sample.audioBuffer.duration &&
              sample.metadata &&
              typeof sample.metadata.duration === 'number' &&
              typeof sample.originalIndex === 'number' &&
              sample.originalIndex >= 0 && 
              sample.originalIndex < 24) {
            
            dispatch({
              type: 'LOAD_DRUM_SAMPLE',
              payload: {
                index: sample.originalIndex, // Use the original index
                file: sample.file,
                audioBuffer: sample.audioBuffer,
                metadata: sample.metadata
              }
            });

            // Apply the stored settings
            dispatch({
              type: 'UPDATE_DRUM_SAMPLE',
              payload: {
                index: sample.originalIndex, // Use the original index
                updates: {
                  inPoint: sample.inPoint,
                  outPoint: sample.outPoint,
                  playmode: sample.playmode,
                  reverse: sample.reverse,
                  tune: sample.tune,
                  pan: sample.pan,
                  gain: sample.gain,
                  hasBeenEdited: sample.hasBeenEdited,
                }
              }
            });
          } else {
            console.warn('Skipping invalid drum sample:', sample);
          }
        });

        // Mark session as saved to library
        sessionStorageIndexedDB.markSessionAsSavedToLibrary();

      } else if (preset.type === 'multisample') {
        // Restore multisample settings
        const multisampleSettings = presetData.multisampleSettings || defaultMultisampleSettings;
        dispatch({ type: 'SET_MULTISAMPLE_SAMPLE_RATE', payload: multisampleSettings.sampleRate });
        dispatch({ type: 'SET_MULTISAMPLE_BIT_DEPTH', payload: multisampleSettings.bitDepth });
        dispatch({ type: 'SET_MULTISAMPLE_CHANNELS', payload: multisampleSettings.channels });
        dispatch({ type: 'SET_MULTISAMPLE_PRESET_NAME', payload: multisampleSettings.presetName });
        dispatch({ type: 'SET_MULTISAMPLE_NORMALIZE', payload: multisampleSettings.normalize });
        dispatch({ type: 'SET_MULTISAMPLE_NORMALIZE_LEVEL', payload: multisampleSettings.normalizeLevel });
        dispatch({ type: 'SET_MULTISAMPLE_CUT_AT_LOOP_END', payload: multisampleSettings.cutAtLoopEnd });
        dispatch({ type: 'SET_MULTISAMPLE_GAIN', payload: multisampleSettings.gain });
        dispatch({ type: 'SET_MULTISAMPLE_LOOP_ENABLED', payload: multisampleSettings.loopEnabled });
        dispatch({ type: 'SET_MULTISAMPLE_LOOP_ON_RELEASE', payload: multisampleSettings.loopOnRelease });

        // Restore multisample files
        let restoredFiles: any[] = [];
        try {
          restoredFiles = await restoreMultisampleFiles(presetData.multisampleFiles || [], audioContext);
        } catch (error) {
          console.error('Failed to restore multisample files:', error);
          restoredFiles = [];
        }
        
        // Clear existing files and load new ones
        // Clear from end to beginning to avoid index shifting issues
        for (let i = state.multisampleFiles.length - 1; i >= 0; i--) {
          dispatch({ type: 'CLEAR_MULTISAMPLE_FILE', payload: i });
        }
        
        // Load all valid multisample files first
        const filesToLoad = restoredFiles.filter(file => 
          file && 
          file.file && 
          file.audioBuffer && 
          file.audioBuffer.duration &&
          file.metadata &&
          typeof file.metadata.duration === 'number'
        );
        
        // Load all files with their complete settings in a single operation
        filesToLoad.forEach((file) => {
          try {
            // Create a complete metadata object with all required properties
            const completeMetadata = {
              ...file.metadata,
              // Ensure we have all the properties that LOAD_MULTISAMPLE_FILE expects
              duration: file.metadata.duration,
              bitDepth: file.metadata.bitDepth,
              sampleRate: file.metadata.sampleRate,
              channels: file.metadata.channels,
              fileSize: file.metadata.fileSize,
              midiNote: file.rootNote, // Use the stored rootNote as midiNote
              hasLoopData: true, // We always have loop data since we set defaults
              loopStart: file.loopStart || file.audioBuffer.duration * 0.2,
              loopEnd: file.loopEnd || file.audioBuffer.duration * 0.8,
              format: 'PCM',
              dataLength: file.metadata.fileSize || 0
            };
            
            dispatch({
              type: 'LOAD_MULTISAMPLE_FILE',
              payload: {
                file: file.file,
                audioBuffer: file.audioBuffer,
                metadata: completeMetadata,
                rootNoteOverride: file.rootNote
              }
            });
            
            // Apply the stored settings immediately after loading
            pendingUpdatesRef.current.push({
              file: file,
              updates: {
                inPoint: file.inPoint || 0,
                outPoint: file.outPoint || file.audioBuffer.duration,
                loopStart: file.loopStart || file.audioBuffer.duration * 0.2,
                loopEnd: file.loopEnd || file.audioBuffer.duration * 0.8,
              }
            });
            
          } catch (error) {
            console.error('Failed to load multisample file:', file.file.name, error);
          }
        });

        // Mark session as saved to library
        sessionStorageIndexedDB.markSessionAsSavedToLibrary();
      }

      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'success',
          title: 'preset loaded',
          message: `loaded "${preset.name}" preset`
        }
      });

    } catch (error) {
      console.error('Failed to load preset:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'error',
          title: 'load failed',
          message: 'failed to load preset'
        }
      });
    } finally {
      // Clear the loading flag after the preset is loaded
      window.sessionStorage.removeItem('loading-preset');
    }
  };

  const handleDownloadPreset = async (preset: LibraryPreset) => {
    try {
      // Restore the complete state from the saved preset
      const presetData = preset.data as any;
      const audioContext = window.AudioContext ? new window.AudioContext() : new (window as any).webkitAudioContext();

      if (preset.type === 'drum') {
        // Restore drum samples for patch generation
        const restoredSamples = await restoreDrumSamples(presetData.drumSamples || [], audioContext);
        
        // Convert back to array format with proper indexing for patch generation
        const drumSamplesArray = Array.from({ length: 24 }, () => ({ 
          ...initialDrumSample,
          isAssigned: false,
          assignedKey: undefined
        }));
        restoredSamples.forEach((sample) => {
          if (sample && typeof sample.originalIndex === 'number' && 
              sample.originalIndex >= 0 && sample.originalIndex < 24) {
            drumSamplesArray[sample.originalIndex] = {
              ...sample,
              isLoaded: true,
              isAssigned: true,
              assignedKey: sample.originalIndex
            };
          }
        });
        
        // Create a temporary state for patch generation
        const tempState = {
          ...state,
          drumSettings: presetData.drumSettings || defaultDrumSettings,
          drumSamples: drumSamplesArray
        };
        
        // Generate and download the patch
        const patchBlob = await generateDrumPatch(
          tempState,
          preset.name
        );
        
        downloadBlob(patchBlob, `${preset.name}.opxydrum`);

      } else if (preset.type === 'multisample') {
        // Restore multisample files for patch generation
        const restoredFiles = await restoreMultisampleFiles(presetData.multisampleFiles || [], audioContext);
        
        // Create a temporary state for patch generation
        const tempState = {
          ...state,
          multisampleSettings: presetData.multisampleSettings || defaultMultisampleSettings,
          multisampleFiles: restoredFiles
        };
        
        // Generate and download the patch
        const patchBlob = await generateMultisamplePatch(
          tempState,
          preset.name
        );
        
        downloadBlob(patchBlob, `${preset.name}.opxymulti`);
      }

      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'success',
          title: 'preset downloaded',
          message: `downloaded "${preset.name}" preset`
        }
      });

    } catch (error) {
      console.error('Failed to download preset:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'error',
          title: 'download failed',
          message: 'failed to download preset'
        }
      });
    }
  };

  const handleToggleFavorite = async (preset: LibraryPreset) => {
    try {
      const updatedPreset = { ...preset, isFavorite: !preset.isFavorite };
      await indexedDB.update(STORES.PRESETS, updatedPreset);
      
      // Update local state
      setPresets(prev => prev.map(p => p.id === preset.id ? updatedPreset : p));
      
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'success',
          title: updatedPreset.isFavorite ? 'added to favorites' : 'removed from favorites',
          message: `"${preset.name}" ${updatedPreset.isFavorite ? 'added to' : 'removed from'} favorites`
        }
      });
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'error',
          title: 'update failed',
          message: 'failed to update favorite status'
        }
      });
    }
  };

  const handleDeletePreset = (preset: LibraryPreset) => {
    setPresetToDelete(preset);
    setIsConfirmModalOpen(true);
  };

  const handleBulkDelete = () => {
    setPresetToDelete({ id: 'bulk', name: 'Selected Presets' } as LibraryPreset);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      if (presetToDelete?.id === 'bulk') {
        // Bulk delete
        const presetIds = Array.from(selectedPresets);
        await Promise.all(presetIds.map(id => indexedDB.delete(STORES.PRESETS, id)));
        setSelectedPresets(new Set());
        
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            id: Date.now().toString(),
            type: 'success',
            title: 'presets deleted',
            message: `deleted ${presetIds.length} presets`
          }
        });
      } else if (presetToDelete) {
        // Single delete
        await indexedDB.delete(STORES.PRESETS, presetToDelete.id);
        
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            id: Date.now().toString(),
            type: 'success',
            title: 'preset deleted',
            message: `deleted "${presetToDelete.name}" preset`
          }
        });
      }
      
      // Refresh presets
      loadPresets();
      
    } catch (error) {
      console.error('Failed to delete preset(s):', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'error',
          title: 'delete failed',
          message: 'failed to delete preset(s)'
        }
      });
    } finally {
      setIsConfirmModalOpen(false);
      setPresetToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setIsConfirmModalOpen(false);
    setPresetToDelete(null);
  };

  // Handler for confirming preset load
  const handleConfirmLoadPreset = async () => {
    if (pendingPresetToLoad) {
      setIsLoadConfirmOpen(false);
      await actuallyLoadPreset(pendingPresetToLoad);
      setPendingPresetToLoad(null);
    }
  };

  // Handler for cancelling preset load
  const handleCancelLoadPreset = () => {
    setIsLoadConfirmOpen(false);
    setPendingPresetToLoad(null);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const togglePresetSelection = (presetId: string) => {
    const newSelected = new Set(selectedPresets);
    if (newSelected.has(presetId)) {
      newSelected.delete(presetId);
    } else {
      newSelected.add(presetId);
    }
    setSelectedPresets(newSelected);
  };

  const selectAllPresets = () => {
    setSelectedPresets(new Set(filteredPresets.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedPresets(new Set());
  };

  return (
    <>
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: 'var(--color-bg-primary)',
        padding: window.innerWidth < 768 ? '1rem' : '1.25rem 2rem',
        maxWidth: '1400px',
        margin: '0 auto',
        marginTop: '0.7rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}>
        <div>
          <LibraryTable
            title="presets"
            titleTooltip={
              <>
                <h3>
                  <i className="fas fa-shield-alt" style={{ marginRight: '0.5rem' }}></i>
                  privacy & data
                </h3>
                <p>
                  all data is stored locally on your device. no data is sent to external servers or shared with third parties.
                </p>
                <p style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                  your presets, samples, and settings remain private and secure.
                </p>
              </>
            }
            headerContent={
              <LibraryFilters
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                filterType={filterType}
                onFilterTypeChange={setFilterType}
                filterFavorites={filterFavorites}
                onFilterFavoritesChange={setFilterFavorites}
                selectedPresets={selectedPresets}
                onBulkDelete={handleBulkDelete}
                onClearSelection={clearSelection}
                isMobile={isMobile}
              />
            }
            isLoading={isLoading}
            emptyState={
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px',
                color: 'var(--color-text-secondary)',
                textAlign: 'center'
              }}>
                <i className="fas fa-folder-open" style={{ fontSize: '2rem', marginBottom: '1rem' }}></i>
                <p>no presets found</p>
                <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                  {searchTerm || filterType !== 'all' || filterFavorites 
                    ? 'try adjusting your search or filters' 
                    : 'create your first preset by saving from the drum or multisample tools'}
                </p>
              </div>
            }
            tableContent={
              <LibraryTableContent
                presets={paginatedPresets}
                selectedPresets={selectedPresets}
                onToggleSelection={togglePresetSelection}
                onSelectAll={selectAllPresets}
                onClearSelection={clearSelection}
                onToggleFavorite={handleToggleFavorite}
                onLoadPreset={handleLoadPreset}
                onDownloadPreset={handleDownloadPreset}
                onDeletePreset={handleDeletePreset}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                isMobile={isMobile}
                formatDate={formatDate}
              />
            }
            footerContent={
              !isMobile && (
                <LibraryPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  isMobile={isMobile}
                />
              )
            }
          />
          
          {/* Mobile pagination controls below cards only */}
          {isMobile && filteredPresets.length > pageSize && (
            <LibraryPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              isMobile={isMobile}
            />
          )}
        </div>
      </div>
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        message={
          presetToDelete?.id === 'bulk'
            ? `are you sure you want to delete the ${selectedPresets.size} selected presets? this action cannot be undone.`
            : `are you sure you want to delete "${presetToDelete?.name}"? this action cannot be undone.`
        }
      />
      {/* Confirmation for preset loading */}
      <ConfirmationModal
        isOpen={isLoadConfirmOpen}
        onConfirm={handleConfirmLoadPreset}
        onCancel={handleCancelLoadPreset}
        message={
          pendingPresetToLoad
            ? `loading a preset will overwrite your current session. are you sure you want to load "${pendingPresetToLoad.name}"?`
            : ''
        }
      />
    </>
  );
} 