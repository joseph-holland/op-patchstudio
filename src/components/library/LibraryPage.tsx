import { useState, useEffect, useCallback } from 'react';
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
  normalizeLevel: -6.0,
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
  normalizeLevel: -6.0,
  cutAtLoopEnd: false,
  gain: 0,
  loopEnabled: true,
  loopOnRelease: true
};

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

  const handleLoadPreset = async (preset: LibraryPreset) => {
    try {
      // Switch to the appropriate tab
      dispatch({ type: 'SET_TAB', payload: preset.type });

      // Restore the complete state from the saved preset
      const presetData = preset.data as any;
      const audioContext = window.AudioContext ? new window.AudioContext() : new (window as any).webkitAudioContext();

      // Helper to restore audioBuffers from blobs
      async function restoreAudioBuffers(samples: any[]) {
        return Promise.all(samples.map(async (sample) => {
          if (sample && sample.audioBlob) {
            const audioBuffer = await blobToAudioBuffer(sample.audioBlob, audioContext);
            const { audioBlob, ...rest } = sample;
            return { ...rest, audioBuffer };
          }
          return sample;
        }));
      }

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
        const restoredSamples = await restoreAudioBuffers(presetData.drumSamples || []);
        
        // Clear existing samples and load new ones
        for (let i = 0; i < 24; i++) {
          dispatch({ type: 'CLEAR_DRUM_SAMPLE', payload: i });
        }
        
        restoredSamples.forEach((sample, index) => {
          if (sample && sample.file && sample.audioBuffer) {
            dispatch({
              type: 'LOAD_DRUM_SAMPLE',
              payload: {
                index,
                file: sample.file,
                audioBuffer: sample.audioBuffer,
                metadata: sample.metadata
              }
            });

            // Apply the stored settings
            dispatch({
              type: 'UPDATE_DRUM_SAMPLE',
              payload: {
                index,
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
        const restoredFiles = await restoreAudioBuffers(presetData.multisampleFiles || []);
        
        // Clear existing files and load new ones
        for (let i = 0; i < state.multisampleFiles.length; i++) {
          dispatch({ type: 'CLEAR_MULTISAMPLE_FILE', payload: i });
        }
        
        restoredFiles.forEach((file) => {
          if (file && file.file && file.audioBuffer) {
            dispatch({
              type: 'LOAD_MULTISAMPLE_FILE',
              payload: {
                file: file.file,
                audioBuffer: file.audioBuffer,
                metadata: file.metadata,
                rootNoteOverride: file.rootNote
              }
            });
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
    }
  };

  const handleDownloadPreset = async (preset: LibraryPreset) => {
    try {
      // Restore the complete state from the saved preset
      const presetData = preset.data as any;
      const audioContext = window.AudioContext ? new window.AudioContext() : new (window as any).webkitAudioContext();

      // Helper to restore audioBuffers from blobs
      async function restoreAudioBuffers(samples: any[]) {
        return Promise.all(samples.map(async (sample) => {
          if (sample && sample.audioBlob) {
            const audioBuffer = await blobToAudioBuffer(sample.audioBlob, audioContext);
            const { audioBlob, ...rest } = sample;
            return { ...rest, audioBuffer };
          }
          return sample;
        }));
      }

      if (preset.type === 'drum') {
        // Restore drum samples for patch generation
        const restoredSamples = await restoreAudioBuffers(presetData.drumSamples || []);
        
        // Create a temporary state for patch generation
        const tempState = {
          ...state,
          drumSettings: presetData.drumSettings || defaultDrumSettings,
          drumSamples: restoredSamples
        };
        
        // Generate and download the patch
        const patchBlob = await generateDrumPatch(
          tempState,
          preset.name
        );
        
        downloadBlob(patchBlob, `${preset.name}.opxydrum`);

      } else if (preset.type === 'multisample') {
        // Restore multisample files for patch generation
        const restoredFiles = await restoreAudioBuffers(presetData.multisampleFiles || []);
        
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
    </>
  );
} 