import { useState, useEffect, useCallback } from 'react';
import { ConfirmationModal } from './ConfirmationModal';
import { LibraryTable } from './LibraryTable';
import { useAppContext } from '../../context/AppContext';
import { indexedDB, STORES } from '../../utils/indexedDB';
import { generateDrumPatch, generateMultisamplePatch, downloadBlob } from '../../utils/patchGeneration';
import type { LibraryPreset } from '../../utils/libraryUtils';
import { blobToAudioBuffer } from '../../utils/libraryUtils';
import { sessionStorageIndexedDB } from '../../utils/sessionStorageIndexedDB';
import { IconButton } from './IconButton';

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
        Object.entries(presetData.drumSettings).forEach(([key, value]) => {
          if (key === 'presetSettings') {
            Object.entries(value as any).forEach(([settingKey, settingValue]) => {
              dispatch({ 
                type: `SET_DRUM_PRESET_${settingKey.toUpperCase()}` as any, 
                payload: settingValue 
              });
            });
          } else {
            dispatch({ 
              type: `SET_DRUM_${key.toUpperCase()}` as any, 
              payload: value 
            });
          }
        });
        // Restore drum samples (with audioBuffer)
        const drumSamples = await restoreAudioBuffers(presetData.drumSamples || []);
        dispatch({ type: 'RESTORE_SESSION', payload: {
          drumSettings: presetData.drumSettings,
          multisampleSettings: state.multisampleSettings,
          drumSamples,
          multisampleFiles: state.multisampleFiles,
          selectedMultisample: state.selectedMultisample,
          isDrumKeyboardPinned: state.isDrumKeyboardPinned,
          isMultisampleKeyboardPinned: state.isMultisampleKeyboardPinned
        }});
        // Restore imported preset
        if (presetData.importedDrumPreset) {
          const importedDrumPreset = await restoreAudioBuffers(presetData.importedDrumPreset);
          dispatch({ type: 'SET_IMPORTED_DRUM_PRESET', payload: importedDrumPreset });
        }
      } else {
        // Restore multisample settings
        Object.entries(presetData.multisampleSettings).forEach(([key, value]) => {
          dispatch({ 
            type: `SET_MULTISAMPLE_${key.toUpperCase()}` as any, 
            payload: value 
          });
        });
        // Restore multisample files (with audioBuffer)
        const multisampleFiles = await restoreAudioBuffers(presetData.multisampleFiles || []);
        dispatch({ type: 'RESTORE_SESSION', payload: {
          drumSettings: state.drumSettings,
          multisampleSettings: presetData.multisampleSettings,
          drumSamples: state.drumSamples,
          multisampleFiles,
          selectedMultisample: state.selectedMultisample,
          isDrumKeyboardPinned: state.isDrumKeyboardPinned,
          isMultisampleKeyboardPinned: state.isMultisampleKeyboardPinned
        }});
        // Restore imported preset
        if (presetData.importedMultisamplePreset) {
          const importedMultisamplePreset = await restoreAudioBuffers(presetData.importedMultisamplePreset);
          dispatch({ type: 'SET_IMPORTED_MULTISAMPLE_PRESET', payload: importedMultisamplePreset });
        }
      }

      // Mark the current session as saved to library since we're working with a saved preset
      await sessionStorageIndexedDB.markSessionAsSavedToLibrary();

      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'success',
          title: 'preset loaded',
          message: `"${preset.name}" loaded into ${preset.type} tool`
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
      // Generate the actual patch file for download
      let patchBlob: Blob;
      const audioContext = window.AudioContext ? new window.AudioContext() : new (window as any).webkitAudioContext();

      // Helper to restore audioBuffers from blobs (same as in handleLoadPreset)
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
        // Create a temporary state with the saved preset data
        const presetData = preset.data as any;
        
        // Restore audio buffers from blobs
        const drumSamples = await restoreAudioBuffers(presetData.drumSamples || []);
        const importedDrumPreset = presetData.importedDrumPreset ? 
          await restoreAudioBuffers(presetData.importedDrumPreset) : null;
        
        const tempState = {
          ...state,
          drumSettings: presetData.drumSettings,
          drumSamples,
          importedDrumPreset
        };
        
        // Get audio format settings from drum settings
        const targetSampleRate = presetData.drumSettings.sampleRate || undefined;
        const targetBitDepth = presetData.drumSettings.bitDepth || undefined;
        const targetChannels = presetData.drumSettings.channels === 1 ? "mono" : "keep";
        
        patchBlob = await generateDrumPatch(
          tempState, 
          preset.name,
          targetSampleRate,
          targetBitDepth,
          targetChannels
        );
      } else {
        // Create a temporary state with the saved preset data
        const presetData = preset.data as any;
        
        // Restore audio buffers from blobs
        const multisampleFiles = await restoreAudioBuffers(presetData.multisampleFiles || []);
        const importedMultisamplePreset = presetData.importedMultisamplePreset ? 
          await restoreAudioBuffers(presetData.importedMultisamplePreset) : null;
        
        const tempState = {
          ...state,
          multisampleSettings: presetData.multisampleSettings,
          multisampleFiles,
          importedMultisamplePreset
        };
        
        // Get audio format settings from multisample settings
        const targetSampleRate = presetData.multisampleSettings.sampleRate || undefined;
        const targetBitDepth = presetData.multisampleSettings.bitDepth || undefined;
        const targetChannels = presetData.multisampleSettings.channels === 1 ? "mono" : "keep";
        const multisampleGain = presetData.multisampleSettings.gain || 0;
        
        patchBlob = await generateMultisamplePatch(
          tempState, 
          preset.name,
          targetSampleRate,
          targetBitDepth,
          targetChannels,
          multisampleGain
        );
      }
      
      // Use the downloadBlob function from patchGeneration utils
      downloadBlob(patchBlob, `${preset.name}.preset.zip`);

      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'success',
          title: 'preset downloaded',
          message: `"${preset.name}" downloaded`
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
      await loadPresets();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleDeletePreset = (preset: LibraryPreset) => {
    setPresetToDelete(preset);
    setIsConfirmModalOpen(true);
  };

  const handleBulkDelete = () => {
    // We set a placeholder preset to indicate bulk delete mode
    setPresetToDelete({ id: 'bulk', name: 'bulk', type: 'drum', data: {}, sampleCount: 0, isFavorite: false, createdAt: 0, updatedAt: 0 });
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (presetToDelete) {
      if (presetToDelete.id === 'bulk') {
        // Bulk delete logic
        try {
          await Promise.all(
            Array.from(selectedPresets).map(id => indexedDB.delete(STORES.PRESETS, id))
          );
          dispatch({
            type: 'ADD_NOTIFICATION',
            payload: {
              id: Date.now().toString(),
              type: 'success',
              title: 'presets deleted',
              message: `successfully deleted ${selectedPresets.size} presets`
            }
          });
          clearSelection();
        } catch (error) {
          console.error('Failed to bulk delete presets:', error);
          dispatch({
            type: 'ADD_NOTIFICATION',
            payload: {
              id: Date.now().toString(),
              type: 'error',
              title: 'delete failed',
              message: 'could not delete selected presets'
            }
          });
        }
      } else {
        // Single delete logic
        try {
          await indexedDB.delete(STORES.PRESETS, presetToDelete.id);
          dispatch({
            type: 'ADD_NOTIFICATION',
            payload: {
              id: Date.now().toString(),
              type: 'success',
              title: 'preset deleted',
              message: `successfully deleted '${presetToDelete.name}'`
            }
          });
          // Also remove from selection if it was selected
          if (selectedPresets.has(presetToDelete.id)) {
            const newSelected = new Set(selectedPresets);
            newSelected.delete(presetToDelete.id);
            setSelectedPresets(newSelected);
          }
        } catch (error) {
          console.error('Failed to delete preset:', error);
          dispatch({
            type: 'ADD_NOTIFICATION',
            payload: {
              id: Date.now().toString(),
              type: 'error',
              title: 'delete failed',
              message: `could not delete '${presetToDelete.name}'`
            }
          });
        }
      }
      loadPresets();
    }
    setIsConfirmModalOpen(false);
    setPresetToDelete(null);
  };

  const handleCancelDelete = () => {
    setIsConfirmModalOpen(false);
    setPresetToDelete(null);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        <div >
                  <LibraryTable
          title="presets"
            headerContent={
              isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Search */}
                  <div style={{ width: '100%' }}>
                    <input
                      type="text"
                      placeholder="search presets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-bg-primary)',
                        color: 'var(--color-text-primary)',
                        fontSize: '1rem'
                      }}
                    />
                  </div>

                  {/* Filters Row */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {/* Type Filter */}
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value as any)}
                      style={{
                        padding: '0.75rem',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-bg-primary)',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.9rem',
                        flex: 1
                      }}
                    >
                      <option value="all">all types</option>
                      <option value="drum">drum</option>
                      <option value="multisample">multisample</option>
                    </select>

                    {/* Favorites Filter */}
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      color: 'var(--color-text-secondary)',
                      padding: '0.75rem',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-bg-primary)',
                      whiteSpace: 'nowrap'
                    }}>
                      <input
                        type="checkbox"
                        checked={filterFavorites}
                        onChange={(e) => setFilterFavorites(e.target.checked)}
                        style={{ margin: 0, width: '16px', height: '16px' }}
                      />
                      favorites
                    </label>
                  </div>

                  {/* Bulk Actions */}
                  {selectedPresets.size > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={handleBulkDelete}
                        style={{
                          padding: '0.75rem 1rem',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: '6px',
                          backgroundColor: 'var(--color-bg-primary)',
                          color: 'var(--color-text-primary)',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          flex: 1
                        }}
                      >
                        delete selected ({selectedPresets.size})
                      </button>
                      <button
                        onClick={clearSelection}
                        style={{
                          padding: '0.75rem 1rem',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: '6px',
                          backgroundColor: 'var(--color-bg-secondary)',
                          color: 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          fontSize: '0.9rem'
                        }}
                      >
                        clear
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {/* Search */}
                  <div style={{ minWidth: '200px' }}>
                    <input
                      type="text"
                      placeholder="search presets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '6px',
                        backgroundColor: 'var(--color-bg-primary)',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>

                  {/* Type Filter */}
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-bg-primary)',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.9rem'
                    }}
                  >
                    <option value="all">all types</option>
                    <option value="drum">drum</option>
                    <option value="multisample">multisample</option>
                  </select>

                  {/* Favorites Filter */}
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: 'var(--color-text-secondary)'
                  }}>
                    <input
                      type="checkbox"
                      checked={filterFavorites}
                      onChange={(e) => setFilterFavorites(e.target.checked)}
                      style={{ margin: 0 }}
                    />
                    favorites
                  </label>
                  
                  {/* Bulk Actions */}
                  <button
                    onClick={handleBulkDelete}
                    disabled={selectedPresets.size === 0}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-bg-primary)',
                      color: selectedPresets.size === 0 ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                      cursor: selectedPresets.size === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '0.85rem',
                      opacity: selectedPresets.size === 0 ? 0.5 : 1,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    delete
                  </button>
                </div>
              )
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
            isMobile
              ? paginatedPresets.length > 0
                ? paginatedPresets.map((preset, index) => (
                    <div key={preset.id} style={{
                      background: 'var(--color-bg-primary)',
                      border: '1px solid var(--color-border-light)',
                      borderTop: index === 0 ? '1px solid var(--color-border-light)' : 'none',
                      borderBottom: '1px solid var(--color-border-light)',
                      borderRadius: 0,
                      boxShadow: 'none',
                      marginBottom: 0,
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}>
                      {/* Header with name, type, and favorite */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontWeight: 600, 
                            fontSize: '1.1rem', 
                            color: 'var(--color-text-primary)',
                            marginBottom: '0.25rem'
                          }}>
                            {preset.name}
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem',
                            color: 'var(--color-text-secondary)', 
                            fontSize: '0.9rem' 
                          }}>
                            <i className={`fas fa-${preset.type === 'drum' ? 'drum' : 'keyboard'}`}></i>
                            {preset.type}
                          </div>
                        </div>
                        <IconButton
                          icon={preset.isFavorite ? 'fas fa-star' : 'far fa-star'}
                          onClick={() => handleToggleFavorite(preset)}
                          title={preset.isFavorite ? 'remove from favorites' : 'add to favorites'}
                          color={preset.isFavorite ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
                        />
                      </div>

                      {/* Description */}
                      {preset.description && (
                        <div style={{ 
                          color: 'var(--color-text-secondary)', 
                          fontSize: '0.85rem',
                          lineHeight: '1.4'
                        }}>
                          {preset.description}
                        </div>
                      )}

                      {/* Metadata row */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        fontSize: '0.8rem',
                        color: 'var(--color-text-secondary)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <i className="fas fa-music"></i>
                          {preset.sampleCount !== undefined ? `${preset.sampleCount} samples` : 'no samples'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <i className="fas fa-clock"></i>
                          {formatDate(preset.updatedAt)}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ 
                        display: 'flex', 
                        gap: '0.5rem', 
                        marginTop: '0.5rem'
                      }}>
                        <button 
                          onClick={() => handleLoadPreset(preset)} 
                          style={{ 
                            fontSize: '0.9rem', 
                            padding: '0.75rem 1rem', 
                            borderRadius: '6px', 
                            border: 'none', 
                            background: 'var(--color-interactive-focus)', 
                            color: 'var(--color-white)', 
                            cursor: 'pointer',
                            flex: 1,
                            fontWeight: '500'
                          }}
                        >
                          load
                        </button>
                        <button 
                          onClick={() => handleDownloadPreset(preset)} 
                          style={{ 
                            fontSize: '0.9rem', 
                            padding: '0.75rem 1rem', 
                            borderRadius: '6px', 
                            border: '1px solid var(--color-border-light)', 
                            background: 'var(--color-bg-secondary)', 
                            color: 'var(--color-text-primary)', 
                            cursor: 'pointer',
                            flex: 1
                          }}
                        >
                          download
                        </button>
                        <IconButton
                          icon="fas fa-trash"
                          onClick={() => handleDeletePreset(preset)}
                          title="delete preset"
                          color="var(--color-text-secondary)"
                        />
                      </div>
                    </div>
                  ))
                : null
              : paginatedPresets.length > 0
                ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      backgroundColor: 'var(--color-bg-primary)'
                    }}>
                      <thead>
                        <tr style={{
                          backgroundColor: 'var(--color-bg-secondary)',
                          borderBottom: '1px solid var(--color-border-light)'
                        }}>
                          <th style={{
                            padding: '0.75rem',
                            textAlign: 'left',
                            fontSize: '0.85rem',
                            fontWeight: '500',
                            color: 'var(--color-text-primary)',
                          }}>
                            <input
                              type="checkbox"
                              checked={selectedPresets.size === filteredPresets.length && filteredPresets.length > 0}
                              onChange={e => e.target.checked ? selectAllPresets() : clearSelection()}
                              style={{
                                margin: 0,
                                width: '16px',
                                height: '16px',
                                accentColor: 'var(--color-text-secondary)',
                                cursor: 'pointer',
                              }}
                            />
                          </th>
                          <th 
                            style={{
                              padding: '0.75rem',
                              textAlign: 'left',
                              fontSize: '0.85rem',
                              fontWeight: '500',
                              color: 'var(--color-text-primary)',
                              cursor: 'pointer'
                            }}
                            onClick={() => handleSort('name')}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>name</span>
                              {sortBy === 'name' ? (
                                <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                              ) : (
                                <i className="fas fa-sort" style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }}></i>
                              )}
                            </div>
                          </th>
                          <th 
                            style={{
                              padding: '0.75rem',
                              textAlign: 'center',
                              fontSize: '0.85rem',
                              fontWeight: '500',
                              color: 'var(--color-text-primary)',
                            }}
                            onClick={() => handleSort('type')}
                          >
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                              <span>type</span>
                              {sortBy === 'type' ? (
                                <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                              ) : (
                                <i className="fas fa-sort" style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }}></i>
                              )}
                            </div>
                          </th>
                          <th style={{
                            padding: '0.75rem',
                            textAlign: 'center',
                            fontSize: '0.85rem',
                            fontWeight: '500',
                            color: 'var(--color-text-primary)',
                          }}>
                            samples
                          </th>
                          <th 
                            style={{
                              padding: '0.75rem',
                              textAlign: 'left',
                              fontSize: '0.85rem',
                              fontWeight: '500',
                              color: 'var(--color-text-primary)',
                              cursor: 'pointer'
                            }}
                            onClick={() => handleSort('date')}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span>updated</span>
                              {sortBy === 'date' ? (
                                <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                              ) : (
                                <i className="fas fa-sort" style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }}></i>
                              )}
                            </div>
                          </th>
                          <th style={{
                            padding: '0.75rem',
                            textAlign: 'center',
                            fontSize: '0.85rem',
                            fontWeight: '500',
                            color: 'var(--color-text-primary)'
                          }}>
                            actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedPresets.map((preset) => (
                          <tr
                            key={preset.id}
                            style={{
                              backgroundColor: selectedPresets.has(preset.id) 
                                ? 'var(--color-bg-secondary)' 
                                : 'var(--color-bg-primary)',
                              borderBottom: '1px solid var(--color-border-light)',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <td style={{
                              padding: '0.75rem',
                              verticalAlign: 'top'
                            }}>
                              <input
                                type="checkbox"
                                checked={selectedPresets.has(preset.id)}
                                onChange={() => togglePresetSelection(preset.id)}
                                style={{
                                  margin: 0,
                                  width: '16px',
                                  height: '16px',
                                  accentColor: 'var(--color-text-secondary)',
                                  cursor: 'pointer',
                                }}
                              />
                            </td>
                            <td style={{
                              padding: '0.75rem',
                              verticalAlign: 'top'
                            }}>
                              <div style={{
                                fontSize: '0.9rem',
                                fontWeight: 400,
                                color: 'var(--color-text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontFamily: 'Montserrat, Arial, sans-serif'
                              }}>
                                {preset.name}
                              </div>
                            </td>
                            <td style={{
                              padding: '0.75rem',
                              verticalAlign: 'top',
                              textAlign: 'center'
                            }}>
                              <i 
                                className={`fas fa-${preset.type === 'drum' ? 'drum' : 'keyboard'}`}
                                style={{
                                  fontSize: '1.2rem',
                                  color: 'var(--color-text-secondary)'
                                }}
                                title={preset.type}
                              ></i>
                            </td>
                            <td style={{
                              padding: '0.75rem',
                              verticalAlign: 'top',
                              fontSize: '0.85rem',
                              color: 'var(--color-text-secondary)',
                              textAlign: 'center'
                            }}>
                              {preset.sampleCount !== undefined ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                                  <i className="fas fa-music"></i>
                                  {preset.sampleCount}
                                </div>
                              ) : '-'}
                            </td>
                            <td style={{
                              padding: '0.75rem',
                              verticalAlign: 'top',
                              fontSize: '0.85rem',
                              color: 'var(--color-text-secondary)'
                            }}>
                              {formatDate(preset.updatedAt)}
                            </td>
                            <td style={{
                              padding: '0.75rem',
                              verticalAlign: 'top'
                            }}>
                              <div style={{
                                display: 'flex',
                                gap: '0.5rem',
                                justifyContent: 'center'
                              }}>
                                <IconButton
                                  icon={preset.isFavorite ? 'fas fa-star' : 'far fa-star'}
                                  onClick={() => handleToggleFavorite(preset)}
                                  title={preset.isFavorite ? 'remove from favorites' : 'add to favorites'}
                                  color={preset.isFavorite ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
                                />
                                <IconButton
                                  icon="fas fa-folder-open"
                                  onClick={() => handleLoadPreset(preset)}
                                  title="load preset"
                                  color="var(--color-interactive-focus)"
                                />
                                <IconButton
                                  icon="fas fa-download"
                                  onClick={() => handleDownloadPreset(preset)}
                                  title="download preset"
                                  color="var(--color-text-secondary)"
                                />
                                <IconButton
                                  icon="fas fa-trash"
                                  onClick={() => handleDeletePreset(preset)}
                                  title="delete preset"
                                  color="var(--color-text-secondary)"
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Pagination Footer */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        background: 'var(--color-bg-primary)',
                        borderTop: '1px solid var(--color-border-light)',
                        padding: '1rem',
                        borderBottomLeftRadius: '0',
                        borderBottomRightRadius: '0',
                        minHeight: '64px',
                        marginTop: 0
                      }}
                    >
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        style={{
                          padding: '0.75rem 1.5rem',
                          borderRadius: '6px',
                          border: '1px solid var(--color-border-light)',
                          background: 'var(--color-bg-primary)',
                          color: currentPage === 1 ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          fontSize: '1rem',
                          opacity: currentPage === 1 ? 0.5 : 1,
                          transition: 'background 0.2s, color 0.2s',
                        }}
                      >
                        Previous
                      </button>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', margin: '0 1.5rem' }}>
                        Page {currentPage} of {Math.max(1, Math.ceil(filteredPresets.length / pageSize))}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredPresets.length / pageSize), p + 1))}
                        disabled={currentPage === Math.ceil(filteredPresets.length / pageSize) || filteredPresets.length === 0}
                        style={{
                          padding: '0.75rem 1.5rem',
                          borderRadius: '6px',
                          border: '1px solid var(--color-border-light)',
                          background: 'var(--color-bg-primary)',
                          color: (currentPage === Math.ceil(filteredPresets.length / pageSize) || filteredPresets.length === 0) ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                          cursor: (currentPage === Math.ceil(filteredPresets.length / pageSize) || filteredPresets.length === 0) ? 'not-allowed' : 'pointer',
                          fontSize: '1rem',
                          opacity: (currentPage === Math.ceil(filteredPresets.length / pageSize) || filteredPresets.length === 0) ? 0.5 : 1,
                          transition: 'background 0.2s, color 0.2s',
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )
                : null
          }
        />
        
        {/* Mobile pagination controls below cards only */}
        {isMobile && filteredPresets.length > pageSize && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', margin: '1rem 0' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '6px',
                border: '1px solid var(--color-border-light)',
                background: 'var(--color-bg-primary)',
                color: currentPage === 1 ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                opacity: currentPage === 1 ? 0.5 : 1,
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              Previous
            </button>
            <span style={{ alignSelf: 'center', color: 'var(--color-text-secondary)', fontSize: '1rem' }}>Page {currentPage} of {Math.ceil(filteredPresets.length / pageSize)}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredPresets.length / pageSize), p + 1))}
              disabled={currentPage === Math.ceil(filteredPresets.length / pageSize)}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '6px',
                border: '1px solid var(--color-border-light)',
                background: 'var(--color-bg-primary)',
                color: currentPage === Math.ceil(filteredPresets.length / pageSize) ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                cursor: currentPage === Math.ceil(filteredPresets.length / pageSize) ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                opacity: currentPage === Math.ceil(filteredPresets.length / pageSize) ? 0.5 : 1,
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              Next
            </button>
          </div>
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