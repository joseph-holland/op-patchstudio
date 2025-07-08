import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { indexedDB, STORES } from '../../utils/indexedDB';
import { generateDrumPatch, generateMultisamplePatch, downloadBlob } from '../../utils/patchGeneration';
import type { LibraryPreset } from '../../utils/libraryUtils';
import { blobToAudioBuffer } from '../../utils/libraryUtils';
import { sessionStorageIndexedDB } from '../../utils/sessionStorageIndexedDB';

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

  const handleDeletePreset = async (preset: LibraryPreset) => {
    try {
      await indexedDB.delete(STORES.PRESETS, preset.id);
      await loadPresets();
      
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'success',
          title: 'preset deleted',
          message: `"${preset.name}" removed from library`
        }
      });
    } catch (error) {
      console.error('Failed to delete preset:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'error',
          title: 'delete failed',
          message: 'failed to delete preset'
        }
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPresets.size === 0) return;

    try {
      for (const presetId of selectedPresets) {
        await indexedDB.delete(STORES.PRESETS, presetId);
      }
      await loadPresets();
      setSelectedPresets(new Set());
      
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'success',
          title: 'presets deleted',
          message: `${selectedPresets.size} presets removed from library`
        }
      });
    } catch (error) {
      console.error('Failed to delete presets:', error);
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'error',
          title: 'delete failed',
          message: 'failed to delete selected presets'
        }
      });
    }
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
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: 'var(--color-bg-primary)',
      padding: '1rem',
      maxWidth: '1400px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      <div>
        {/* Integrated Library Container */}
        <div style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderRadius: '15px',
          marginTop: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--color-border-light)',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto auto auto auto',
            gap: '1rem',
            padding: '1rem',
            background: 'var(--color-bg-secondary)',
            borderBottom: '1px solid var(--color-border-light)',
            alignItems: 'center'
          }}>
            <h2 style={{
              margin: 0,
              color: 'var(--color-text-primary)',
              fontSize: '1.5rem',
              fontWeight: '300'
            }}>
              library
            </h2>
            
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

            {/* Sort Controls */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{
                  padding: '0.5rem',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.9rem'
                }}
              >
                <option value="date">date</option>
                <option value="name">name</option>
                <option value="type">type</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                style={{
                  padding: '0.5rem',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
              </button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedPresets.size > 0 && (
            <div style={{
              padding: '0.75rem 1rem',
              background: 'var(--color-interactive-focus)',
              borderBottom: '1px solid var(--color-border-light)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ color: 'white', fontSize: '0.9rem' }}>
                {selectedPresets.size} preset{selectedPresets.size !== 1 ? 's' : ''} selected
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={clearSelection}
                  style={{
                    padding: '0.5rem 1rem',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  clear
                </button>
                <button
                  onClick={handleBulkDelete}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  delete
                </button>
              </div>
            </div>
          )}

          {/* Table Container */}
          <div style={{
            minHeight: '400px'
          }}>
            {isLoading ? (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px',
                color: 'var(--color-text-secondary)'
              }}>
                <i className="fas fa-spinner fa-spin" style={{ marginRight: '0.5rem' }}></i>
                loading presets...
              </div>
            ) : filteredPresets.length === 0 ? (
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
            ) : (
              <div>
                {/* Presets Table */}
                <div style={{
                  overflowX: 'auto',
                }}>
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
                          borderRight: '1px solid var(--color-border-light)'
                        }}>
                          <input
                            type="checkbox"
                            checked={selectedPresets.size === filteredPresets.length && filteredPresets.length > 0}
                            onChange={selectAllPresets}
                            style={{ margin: 0 }}
                          />
                        </th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          fontSize: '0.85rem',
                          fontWeight: '500',
                          color: 'var(--color-text-primary)',
                          borderRight: '1px solid var(--color-border-light)'
                        }}>
                          name
                        </th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'center',
                          fontSize: '0.85rem',
                          fontWeight: '500',
                          color: 'var(--color-text-primary)',
                          borderRight: '1px solid var(--color-border-light)'
                        }}>
                          type
                        </th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          fontSize: '0.85rem',
                          fontWeight: '500',
                          color: 'var(--color-text-primary)',
                          borderRight: '1px solid var(--color-border-light)'
                        }}>
                          samples
                        </th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          fontSize: '0.85rem',
                          fontWeight: '500',
                          color: 'var(--color-text-primary)',
                          borderRight: '1px solid var(--color-border-light)'
                        }}>
                          updated
                        </th>
                        <th style={{
                          padding: '0.75rem',
                          textAlign: 'center',
                          fontSize: '0.85rem',
                          fontWeight: '500',
                          color: 'var(--color-text-primary)',
                          borderRight: '1px solid var(--color-border-light)'
                        }}>
                          favorite
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
                      {filteredPresets.map((preset) => (
                        <tr
                          key={preset.id}
                          style={{
                            backgroundColor: selectedPresets.has(preset.id) 
                              ? 'var(--color-interactive-focus)' 
                              : 'var(--color-bg-primary)',
                            borderBottom: '1px solid var(--color-border-light)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <td style={{
                            padding: '0.75rem',
                            borderRight: '1px solid var(--color-border-light)',
                            verticalAlign: 'top'
                          }}>
                            <input
                              type="checkbox"
                              checked={selectedPresets.has(preset.id)}
                              onChange={() => togglePresetSelection(preset.id)}
                              style={{ margin: 0 }}
                            />
                          </td>
                          <td style={{
                            padding: '0.75rem',
                            borderRight: '1px solid var(--color-border-light)',
                            verticalAlign: 'top'
                          }}>
                            <div style={{
                              fontSize: '1rem',
                              fontWeight: '500',
                              color: 'var(--color-text-primary)'
                            }}>
                              {preset.name}
                            </div>
                          </td>
                                                  <td style={{
                          padding: '0.75rem',
                          borderRight: '1px solid var(--color-border-light)',
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
                            borderRight: '1px solid var(--color-border-light)',
                            verticalAlign: 'top',
                            fontSize: '0.85rem',
                            color: 'var(--color-text-secondary)'
                          }}>
                            {preset.sampleCount !== undefined ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <i className="fas fa-music"></i>
                                {preset.sampleCount}
                              </div>
                            ) : '-'}
                          </td>
                          <td style={{
                            padding: '0.75rem',
                            borderRight: '1px solid var(--color-border-light)',
                            verticalAlign: 'top',
                            fontSize: '0.85rem',
                            color: 'var(--color-text-secondary)'
                          }}>
                            {formatDate(preset.updatedAt)}
                          </td>
                          <td style={{
                            padding: '0.75rem',
                            borderRight: '1px solid var(--color-border-light)',
                            verticalAlign: 'top',
                            textAlign: 'center'
                          }}>
                            <button
                              onClick={() => handleToggleFavorite(preset)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: preset.isFavorite ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                fontSize: '1rem'
                              }}
                            >
                              <i className={`fas fa-star${preset.isFavorite ? '' : '-o'}`}></i>
                            </button>
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
                              <button
                                onClick={() => handleLoadPreset(preset)}
                                style={{
                                  padding: '0.5rem',
                                  backgroundColor: 'var(--color-interactive-focus)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.3rem'
                                }}
                              >
                                <i className="fas fa-play"></i>
                                load
                              </button>
                              <button
                                onClick={() => handleDownloadPreset(preset)}
                                style={{
                                  padding: '0.5rem',
                                  border: '1px solid var(--color-border-light)',
                                  backgroundColor: 'var(--color-bg-primary)',
                                  color: 'var(--color-text-secondary)',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem'
                                }}
                              >
                                <i className="fas fa-download"></i>
                              </button>
                              <button
                                onClick={() => handleDeletePreset(preset)}
                                style={{
                                  padding: '0.5rem',
                                  border: '1px solid #dc3545',
                                  backgroundColor: 'var(--color-bg-primary)',
                                  color: '#dc3545',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem'
                                }}
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 