import React, { useState, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { audioContextManager } from '../../utils/audioContext';
import { FileDetailsBadges } from '../common/FileDetailsBadges';
import { SmallWaveform } from '../common/SmallWaveform';
import { EnhancedTooltip } from '../common/EnhancedTooltip';
import { WaveformZoomModal } from '../common/WaveformZoomModal';

import { midiNoteToString, noteStringToMidiValue } from '../../utils/audio';


interface MultisampleSampleTableProps {
  onFileUpload: (index: number, file: File) => void;
  onClearSample: (index: number) => void;
  onRecordSample: (index: number) => void;
  onFilesSelected: (files: File[]) => void;
  onBrowseFilesRef?: React.MutableRefObject<(() => void) | null>;
}

// Theme colour shortcuts for readability
const c = {
  bg: 'var(--color-bg-primary)',
  bgAlt: 'var(--color-bg-secondary)',
  border: 'var(--color-border-light)',
  borderMed: 'var(--color-border-medium)',
  borderSubtle: 'var(--color-border-subtle)',
  text: 'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
  shadow: '0 2px 8px var(--color-shadow-primary)',
  action: 'var(--color-interactive-focus)',
  actionHover: 'var(--color-interactive-dark)',
  disabled: 'var(--color-border-medium)'
};

// Style for action buttons to ensure accessibility (44x44px target)
const actionButtonStyle: React.CSSProperties = {
  width: '44px',
  height: '44px',
  minWidth: '44px',
  minHeight: '44px',
  maxWidth: '44px',
  maxHeight: '44px',
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `1px solid ${c.borderMed}`,
  borderRadius: '3px',
  backgroundColor: c.bg,
  cursor: 'pointer',
  flexShrink: 0
};

export function MultisampleSampleTable({ 
  onFileUpload, 
  onClearSample,
  onRecordSample,
  onFilesSelected,
  onBrowseFilesRef
}: MultisampleSampleTableProps) {
  const { state, dispatch } = useAppContext();
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
      const [isDragOver, setIsDragOver] = useState(false);
      const [zoomModalOpen, setZoomModalOpen] = useState(false);
  const [zoomSampleIndex, setZoomSampleIndex] = useState<number>(0);
  const [editingNotes, setEditingNotes] = useState<{ [key: number]: string }>({});
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const browseFileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isKeyHelpTooltipVisible, setIsKeyHelpTooltipVisible] = useState(false);

  // Detect mobile screen size
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // MIDI note conversion helpers
  const parseNoteInput = (input: string): number => {
    const trimmed = input.trim().toUpperCase();
    
    // Check if it's a MIDI number
    if (/^\d+$/.test(trimmed)) {
      const midiNum = parseInt(trimmed);
      return (midiNum >= 0 && midiNum <= 127) ? midiNum : -1;
    }
    
    // Try to parse as note name, using current mapping
    return noteStringToMidiValue(trimmed, state.midiNoteMapping);
  };

  // File drag and drop handlers for the entire table
  const handleTableDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  };

  const handleTableDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleTableDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files: File[] = [];
    
    // Use the .items property for robust folder and file handling
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const items = Array.from(e.dataTransfer.items);
      
      // Process all dropped items in parallel
      const processingPromises = items.map(item => {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          return processEntry(entry, files);
        }
        return Promise.resolve();
      });
      
      await Promise.all(processingPromises);
      
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Fallback for browsers that don't support .items
      files.push(...Array.from(e.dataTransfer.files));
    }
    
    const audioFiles = files.filter(file => 
      file.type.startsWith('audio/') || 
      file.name.toLowerCase().endsWith('.wav') ||
      file.name.toLowerCase().endsWith('.aif') ||
      file.name.toLowerCase().endsWith('.aiff') ||
      file.name.toLowerCase().endsWith('.mp3') ||
      file.name.toLowerCase().endsWith('.m4a') ||
      file.name.toLowerCase().endsWith('.ogg') ||
      file.name.toLowerCase().endsWith('.flac')
    );
    
    const remainingSlots = 24 - state.multisampleFiles.length;
    const filesToProcess = audioFiles.slice(0, remainingSlots);
    
    if (filesToProcess.length > 0) {
      // Show user feedback about file limit
      if (audioFiles.length > remainingSlots) {
        // Show notification about file limit
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            id: Date.now().toString(),
            type: 'info',
            title: 'file limit reached',
            message: `loaded ${filesToProcess.length} files (${audioFiles.length - remainingSlots} additional files skipped)`
          }
        });
      }
      
      onFilesSelected(filesToProcess);
    } else if (files.length > 0) {
      // No audio files found in dropped items - can provide user feedback if desired
    } else {
      // No files found in drop event
    }
  };

  const processEntry = async (entry: any, files: File[]): Promise<void> => {
    try {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => {
          entry.file((file: File) => {
            if (file) {
              resolve(file);
            } else {
              reject(new Error('Failed to get file from entry'));
            }
          });
        });
        files.push(file);
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        
        // Read all entries from the directory
        const readEntries = (): Promise<any[]> => {
          return new Promise((resolve, reject) => {
            reader.readEntries((entries: any[]) => {
              if (entries && entries.length > 0) {
                resolve(entries);
              } else {
                resolve([]);
              }
            }, (error: any) => {
              console.error('Error reading directory entries:', error);
              reject(error);
            });
          });
        };
        
        // Read all entries recursively (handle large directories)
        let allEntries: any[] = [];
        let hasMore = true;
        
        while (hasMore) {
          const entries = await readEntries();
          if (entries.length === 0) {
            hasMore = false;
          } else {
            allEntries = allEntries.concat(entries);
          }
        }
        
        // Process all entries in parallel for better performance
        await Promise.all(allEntries.map(childEntry => processEntry(childEntry, files)));
      }
    } catch (error) {
      console.error('Error processing entry:', entry?.name, error);
    }
  };

  const handleBrowseFiles = () => {
    browseFileInputRef.current?.click();
  };

  React.useEffect(() => {
    if (onBrowseFilesRef) {
      onBrowseFilesRef.current = handleBrowseFiles;
    }
  }, [onBrowseFilesRef]);

  const handleBrowseFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const audioFiles = await extractAudioFiles(files);
      const remainingSlots = 24 - state.multisampleFiles.length;
      const filesToProcess = audioFiles.slice(0, remainingSlots);
      
      if (filesToProcess.length > 0) {
        // Show user feedback about file limit
        if (audioFiles.length > remainingSlots) {
          // Show notification about file limit
          dispatch({
            type: 'ADD_NOTIFICATION',
            payload: {
              id: Date.now().toString(),
              type: 'info',
              title: 'file limit reached',
              message: `loaded ${filesToProcess.length} files (${audioFiles.length - remainingSlots} additional files skipped)`
            }
          });
        }
        
        onFilesSelected(filesToProcess);
      } else {
        console.log('No audio files found in selected files');
      }
    }
    e.target.value = '';
  };

  const extractAudioFiles = async (files: File[]): Promise<File[]> => {
    const audioFiles: File[] = [];
    
    for (const file of files) {
      if (file.type.startsWith('audio/') || 
          file.name.toLowerCase().endsWith('.wav') ||
          file.name.toLowerCase().endsWith('.aif') ||
          file.name.toLowerCase().endsWith('.aiff') ||
          file.name.toLowerCase().endsWith('.mp3') ||
          file.name.toLowerCase().endsWith('.m4a') ||
          file.name.toLowerCase().endsWith('.ogg') ||
          file.name.toLowerCase().endsWith('.flac')) {
        audioFiles.push(file);
      }
    }
    
    return audioFiles;
  };

  const handleEmptyAreaClick = () => {
    if (state.multisampleFiles.length === 0) {
      browseFileInputRef.current?.click();
    }
  };

  const handleFileInputChange = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onFileUpload(index, file);
    }
    e.target.value = '';
  };

  const handleNoteChange = (index: number, noteStr: string) => {
    // Always store the current editing value to allow free typing
    setEditingNotes(prev => ({ ...prev, [index]: noteStr }));
  };

  const handleNoteBlur = (index: number) => {
    // On blur, try to parse and update if valid, otherwise revert
    const currentValue = editingNotes[index];
    if (currentValue !== undefined) {
      const midiNote = parseNoteInput(currentValue);
      if (midiNote >= 0 && midiNote <= 127) {
        // Valid note - update the state
        dispatch({
          type: 'UPDATE_MULTISAMPLE_FILE',
          payload: { 
            index, 
            updates: { 
              rootNote: midiNote
            }
          }
        });
      }
      // Clear editing state regardless of validity (will revert to stored note if invalid)
      setEditingNotes(prev => {
        const newState = { ...prev };
        delete newState[index];
        return newState;
      });
    }
  };

  const handleNoteKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // Handle Enter key like blur
      handleNoteBlur(index);
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setHoveredIndex(index);
  };

  const handleDragLeave = () => {
    setHoveredIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    
    if (draggedItem !== null && draggedItem !== targetIndex) {
      dispatch({
        type: 'REORDER_MULTISAMPLE_FILES',
        payload: {
          fromIndex: draggedItem,
          toIndex: targetIndex
        }
      });
    }
    
    setDraggedItem(null);
    setHoveredIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setHoveredIndex(null);
  };

  const playSample = async (index: number) => {
    const sample = state.multisampleFiles[index];
    if (!sample?.isLoaded || !sample.audioBuffer) return;

    try {
      const audioContext = await audioContextManager.getAudioContext();
      const source = audioContext.createBufferSource();
      source.buffer = sample.audioBuffer;
      source.connect(audioContext.destination);
      source.start(0);
    } catch (error) {
      console.error('Error playing sample:', error);
    }
  };



  const openFileDialog = (index: number) => {
    fileInputRefs.current[index]?.click();
  };

  const handleRowDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleRowDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.find(file => 
      file.type.startsWith('audio/') || 
      file.name.toLowerCase().endsWith('.wav') ||
      file.name.toLowerCase().endsWith('.aif') ||
      file.name.toLowerCase().endsWith('.aiff') ||
      file.name.toLowerCase().endsWith('.mp3') ||
      file.name.toLowerCase().endsWith('.m4a') ||
      file.name.toLowerCase().endsWith('.ogg') ||
      file.name.toLowerCase().endsWith('.flac')
    );
    
    if (audioFile) {
      handleFileInputChange(index, { target: { files: [audioFile] } } as any);
    }
  };

  const openZoomModal = (index: number) => {
    setZoomSampleIndex(index);
    setZoomModalOpen(true);
  };

  const closeZoomModal = () => {
    setZoomModalOpen(false);
  };

  const handleZoomSave = (inPoint: number, outPoint: number, loopStart?: number, loopEnd?: number) => {
    dispatch({
      type: 'UPDATE_MULTISAMPLE_FILE',
      payload: {
        index: zoomSampleIndex,
        updates: {
          inPoint,
          outPoint,
          loopStart: loopStart || 0,
          loopEnd: loopEnd || (state.multisampleFiles[zoomSampleIndex]?.audioBuffer ? state.multisampleFiles[zoomSampleIndex].audioBuffer!.duration : 0)
        }
      }
    });
  };

  if (isMobile) {
    // Mobile Card Layout - similar to drum tool
    return (
      <div style={{
        fontFamily: '"Montserrat", "Arial", sans-serif'
      }}>
        <input
          ref={browseFileInputRef}
          type="file"
          accept="audio/*,.wav"
          multiple
          onChange={handleBrowseFileChange}
          style={{ display: 'none' }}
        />

        {state.multisampleFiles.length === 0 ? (
          <div 
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4rem 2rem',
              color: '#9ca3af',
              textAlign: 'center',
              minHeight: '200px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              border: `2px dashed ${c.borderMed}`,
              borderRadius: '6px',
              backgroundColor: c.bg
            }}
            onClick={handleEmptyAreaClick}
            onDragOver={handleTableDragOver}
            onDragLeave={handleTableDragLeave}
            onDrop={handleTableDrop}
          >
            <i className="fas fa-music" style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}></i>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: '500' }}>
              no samples loaded
            </p>
                          <p style={{ margin: '0', fontSize: '0.9rem' }}>
                drag and drop audio files or folders here, or click to browse
              </p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            {[...state.multisampleFiles].reverse().map((sample, reversedIndex) => {
              // Convert reversed index back to original index
              const index = state.multisampleFiles.length - 1 - reversedIndex;
              
              return (
              <div key={index}>
                <input
                  type="file"
                  accept="audio/*,.wav"
                  style={{ display: 'none' }}
                  ref={(el) => { fileInputRefs.current[index] = el; }}
                  onChange={(e) => handleFileInputChange(index, e)}
                />
                
                <div
                                     style={{
                     background: c.bg,
                     border: `1px solid ${c.border}`,
                     borderRadius: '3px',
                     padding: '1rem',
                     transition: 'background 0.2s ease'
                   }}
                  onDragOver={handleRowDragOver}
                  onDrop={(e) => handleRowDrop(e, index)}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem'
                  }}>
                    {sample?.isLoaded ? (
                      <div style={{ textAlign: 'left' }}>
                        <input
                          type="text"
                          value={editingNotes[index] ?? midiNoteToString(sample.rootNote || 60, state.midiNoteMapping)}
                          onChange={(e) => handleNoteChange(index, e.target.value)}
                          onBlur={() => handleNoteBlur(index)}
                          onKeyDown={(e) => handleNoteKeyDown(index, e)}
                          onFocus={(e) => (e.target as HTMLInputElement).select()}
                          onClick={(e) => {
                            e.stopPropagation();
                            (e.target as HTMLInputElement).select();
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          placeholder="C4 or 60"
                          style={{
                            width: '80px',
                            padding: '0.25rem 0.375rem',
                            border: `1px solid ${c.border}`,
                            borderRadius: '3px',
                            fontSize: '0.875rem',
                            fontFamily: 'monospace',
                            textAlign: 'center',
                            marginBottom: '0.125rem',
                            fontWeight: '600'
                          }}
                        />
                        <div style={{ 
                          fontSize: '0.7rem', 
                          color: c.textSecondary,
                          textAlign: 'center'
                        }}>
                          midi {sample.rootNote || 60}
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        color: c.textSecondary
                      }}>
                        empty slot
                      </div>
                    )}
                    
                    <div style={{
                      display: 'flex',
                      gap: '0.25rem'
                    }}>
                      {sample?.isLoaded ? (
                        <>
                          <button
                            onClick={() => playSample(index).catch(error => {
                              console.error('Error playing sample:', error);
                            })}
                            style={actionButtonStyle}
                            title="play"
                          >
                            <i className="fas fa-play" style={{ fontSize: '18px' }}></i>
                          </button>
                          <button
                            onClick={() => onClearSample(index)}
                            style={actionButtonStyle}
                            title="clear"
                          >
                            <i className="fas fa-times" style={{ fontSize: '18px' }}></i>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => openFileDialog(index)}
                            style={actionButtonStyle}
                            title="browse"
                          >
                            <i className="fas fa-upload" style={{ fontSize: '18px' }}></i>
                          </button>
                          <button
                            onClick={() => onRecordSample(index)}
                            style={actionButtonStyle}
                            title="record"
                          >
                            <i className="fas fa-microphone" style={{ fontSize: '18px' }}></i>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {sample?.isLoaded ? (
                    <>
                      <div style={{ 
                        fontWeight: '500', 
                        color: c.text, 
                        marginBottom: '0.1rem',
                        fontSize: '0.8rem',
                        wordBreak: 'break-word'
                      }}>
                        {sample.name}
                      </div>
                      
                      <div style={{ marginBottom: '0.1rem' }}>
                        <FileDetailsBadges
                          duration={sample.duration}
                          fileSize={sample.fileSize}
                          channels={sample.originalChannels}
                          bitDepth={sample.originalBitDepth}
                          sampleRate={sample.originalSampleRate}
                          isFloat={sample.isFloat}
                        />
                      </div>

                      <div style={{
                        height: '44px',
                        marginBottom: '0.1rem'
                      }}>
                        {sample.audioBuffer ? (
                          <SmallWaveform
                            audioBuffer={sample.audioBuffer}
                            height={44}
                            inPoint={Math.floor((sample.inPoint || 0) * sample.audioBuffer.sampleRate)}
                            outPoint={Math.floor((sample.outPoint || sample.audioBuffer.duration) * sample.audioBuffer.sampleRate)}
                            loopStart={Math.floor((sample.loopStart || 0) * sample.audioBuffer.sampleRate)}
                            loopEnd={Math.floor((sample.loopEnd || sample.audioBuffer.duration) * sample.audioBuffer.sampleRate)}
                            onMarkersChange={(markers: { inPoint: number; outPoint: number; loopStart?: number; loopEnd?: number }) => {
                              const audioBuffer = sample.audioBuffer;
                              if (!audioBuffer) return;
                              const toSeconds = (frame: number) => frame / audioBuffer.sampleRate;
                              dispatch({
                                type: 'UPDATE_MULTISAMPLE_FILE',
                                payload: {
                                  index,
                                  updates: {
                                    inPoint: toSeconds(markers.inPoint),
                                    outPoint: toSeconds(markers.outPoint),
                                    loopStart: toSeconds(markers.loopStart || 0),
                                    loopEnd: toSeconds(markers.loopEnd || audioBuffer.duration),
                                  },
                                },
                              });
                            }}
                            onZoomEdit={() => openZoomModal(index)}
                          />
                        ) : (
                          <div style={{
                            width: '100%',
                            height: '44px',
                            background: c.borderSubtle,
                            borderRadius: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: c.textSecondary,
                            fontSize: '0.7rem'
                          }}>
                            no sample
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => openFileDialog(index)}
                      style={{
                        width: '100%',
                        background: c.bg,
                        border: `2px dashed ${c.borderMed}`,
                        borderRadius: '3px',
                        padding: '1.5rem 1rem',
                        color: c.textSecondary,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                    >
                      tap to browse for audio file
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Desktop Layout
  return (
    <div style={{
      fontFamily: '"Montserrat", "Arial", sans-serif',
      // Remove or reduce padding/margin so table stretches to section edges
      padding: 0,
      margin: 0
    }}>
      <input
        ref={browseFileInputRef}
        type="file"
        accept="audio/*,.wav"
        multiple
        onChange={handleBrowseFileChange}
        style={{ display: 'none' }}
      />

      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '100px minmax(200px, 1fr) minmax(200px, 1fr) 120px',
        gap: '0.5rem',
        padding: '0.75rem',
        background: c.bgAlt,
        borderBottom: 'none',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        color: c.textSecondary,
        position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          key
          <EnhancedTooltip
            isVisible={isKeyHelpTooltipVisible}
            content={
              <>
                <h3>
                  <i className="fas fa-music" style={{ marginRight: '0.5rem' }}></i>
                  note editing
                </h3>
                <p><strong>click to edit note:</strong></p>
                <p>• musical notes: <strong>C5</strong>, <strong>A#2</strong>, <strong>Bb3</strong></p>
                <p>• midi numbers: <strong>60</strong>, <strong>72</strong>, <strong>48</strong></p>
                <p>• press <strong>enter</strong> or click away to save</p>
              </>
            }
          >
            <span
              style={{ display: 'flex' }}
              onClick={(e) => {
                e.stopPropagation();
                setIsKeyHelpTooltipVisible(!isKeyHelpTooltipVisible);
              }}
              onMouseEnter={() => setIsKeyHelpTooltipVisible(true)}
              onMouseLeave={() => setIsKeyHelpTooltipVisible(false)}
            >
              <i 
                className="fas fa-question-circle" 
                style={{ 
                  fontSize: '14px', 
                  color: c.textSecondary,
                  cursor: 'help'
                }}
              />
            </span>
          </EnhancedTooltip>
        </div>
        <div>file details</div>
        <div style={{ paddingLeft: '10px' }}>waveform</div>
        <div style={{ paddingLeft: '25px' }}>actions</div>
      </div>

      {/* Sample Rows */}
      <div style={{
        borderTop: `1px solid ${c.border}`,
        borderBottom: `1px solid ${c.border}`,
        overflow: 'hidden',
        padding: 0,
        margin: 0
        // borderRadius removed to keep table bottom square
      }}>
        {state.multisampleFiles.length === 0 ? (
          // Empty state with large drop area
          <div
            style={{
              minHeight: '300px',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: isDragOver ? c.bgAlt : c.bg,
              transition: 'background 0.2s ease',
              position: 'relative'
            }}
            onDragOver={handleTableDragOver}
            onDragLeave={handleTableDragLeave}
            onDrop={handleTableDrop}
            onClick={handleEmptyAreaClick}
          >
            <div style={{
              border: `3px dashed ${isDragOver ? c.textSecondary : c.borderMed}`,
              borderRadius: '15px',
              padding: '3rem',
              width: '100%',
              maxWidth: '500px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              color: isDragOver ? c.action : c.textSecondary
            }}>
              <i className="fas fa-music" style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}></i>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: '300' }}>
                {isDragOver ? 'drop files here' : 'no samples loaded'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                drag and drop wav files here or click to browse
              </p>
            </div>
          </div>
        ) : (
          [...state.multisampleFiles].reverse().map((sample, reversedIndex) => {
            // Convert reversed index back to original index
            const index = state.multisampleFiles.length - 1 - reversedIndex;
            
            const isDragging = draggedItem === index;
            const isDraggedOver = hoveredIndex === index && draggedItem !== null && draggedItem !== index;

            return (
              <div key={index}>
                <input
                  type="file"
                  accept="audio/*,.wav"
                  style={{ display: 'none' }}
                  ref={(el) => { fileInputRefs.current[index] = el; }}
                  onChange={(e) => handleFileInputChange(index, e)}
                />
                
                <div
                  draggable={sample?.isLoaded}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '100px minmax(200px, 1fr) minmax(200px, 1fr) 120px',
                    gap: '0.5rem',
                    padding: 0, // Remove row padding
                    background: isDraggedOver ? c.bgAlt : c.bg,
                    borderBottom: reversedIndex < state.multisampleFiles.length - 1 ? `1px solid ${c.border}` : 'none',
                    transition: 'background 0.2s ease',
                    alignItems: 'center',
                    minHeight: '54px',
                    opacity: isDragging ? 0.5 : 1,
                    cursor: sample?.isLoaded ? 'move' : 'default'
                  }}
                  onMouseEnter={(e) => {
                    if (!isDragging) {
                      e.currentTarget.style.background = c.bgAlt;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isDragging) {
                      e.currentTarget.style.background = c.bg;
                    }
                  }}
                >
                  {/* Key Column */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    paddingLeft: '16px'
                  }}>
                    {sample?.isLoaded ? (
                      <div style={{ textAlign: 'center' }}>
                        <input
                          type="text"
                          value={editingNotes[index] ?? midiNoteToString(sample.rootNote || 60, state.midiNoteMapping)}
                          onChange={(e) => handleNoteChange(index, e.target.value)}
                          onBlur={() => handleNoteBlur(index)}
                          onKeyDown={(e) => handleNoteKeyDown(index, e)}
                          onFocus={(e) => (e.target as HTMLInputElement).select()}
                          onClick={(e) => {
                            e.stopPropagation();
                            (e.target as HTMLInputElement).select();
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          placeholder="C4 or 60"
                          style={{
                            width: '80px',
                            padding: '0.25rem 0.375rem',
                            border: `1px solid ${c.border}`,
                            borderRadius: '3px',
                            fontSize: '0.875rem',
                            fontFamily: 'monospace',
                            textAlign: 'center',
                            marginBottom: '0.125rem',
                            fontWeight: '600'
                          }}
                        />
                        <div style={{ fontSize: '0.7rem', color: c.textSecondary }}>
                          midi {sample.rootNote || 60}
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', color: c.textSecondary }}>-</div>
                    )}
                  </div>

                  {/* File Details and Waveform - Combined when empty */}
                  {sample?.isLoaded ? (
                    <>
                      {/* File Details Column */}
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.15rem'
                      }}>
                        <div style={{
                          fontSize: '0.8rem',
                          fontWeight: '500',
                          color: c.text,
                          wordBreak: 'break-word',
                          marginBottom: '0.1rem'
                        }}>
                          {sample.name}
                        </div>
                        <FileDetailsBadges
                          duration={sample.duration}
                          fileSize={sample.fileSize}
                          channels={sample.originalChannels}
                          bitDepth={sample.originalBitDepth}
                          sampleRate={sample.originalSampleRate}
                          isFloat={sample.isFloat}
                        />
                      </div>

                      {/* Waveform Column */}
                      <div style={{
                        height: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        paddingRight: '8px'
                      }}>
                        {sample.audioBuffer ? (
                          <SmallWaveform
                            audioBuffer={sample.audioBuffer}
                            height={44}
                            inPoint={Math.floor((sample.inPoint || 0) * sample.audioBuffer.sampleRate)}
                            outPoint={Math.floor((sample.outPoint || sample.audioBuffer.duration) * sample.audioBuffer.sampleRate)}
                            loopStart={Math.floor((sample.loopStart || 0) * sample.audioBuffer.sampleRate)}
                            loopEnd={Math.floor((sample.loopEnd || sample.audioBuffer.duration) * sample.audioBuffer.sampleRate)}
                            onMarkersChange={(markers: { inPoint: number; outPoint: number; loopStart?: number; loopEnd?: number }) => {
                              const audioBuffer = sample.audioBuffer;
                              if (!audioBuffer) return;
                              const toSeconds = (frame: number) => frame / audioBuffer.sampleRate;
                              dispatch({
                                type: 'UPDATE_MULTISAMPLE_FILE',
                                payload: {
                                  index,
                                  updates: {
                                    inPoint: toSeconds(markers.inPoint),
                                    outPoint: toSeconds(markers.outPoint),
                                    loopStart: toSeconds(markers.loopStart || 0),
                                    loopEnd: toSeconds(markers.loopEnd || audioBuffer.duration),
                                  },
                                },
                              });
                            }}
                            onZoomEdit={() => openZoomModal(index)}
                          />
                        ) : (
                          <div style={{
                            width: '100%',
                            height: '44px',
                            background: c.borderSubtle,
                            borderRadius: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: c.textSecondary,
                            fontSize: '0.7rem'
                          }}>
                            no sample
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    // Empty state - spans both columns
                    <div style={{ gridColumn: 'span 2', paddingRight: '8px' }}>
                      <button
                        onClick={() => openFileDialog(index)}
                        style={{
                          width: '100%',
                          height: '44px',
                          background: 'none',
                          border: `2px dashed ${c.borderMed}`,
                          borderRadius: '3px',
                          padding: '0 1rem',
                          color: c.textSecondary,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = c.textSecondary;
                          e.currentTarget.style.color = c.action;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = c.borderMed;
                          e.currentTarget.style.color = c.textSecondary;
                        }}
                      >
                        drop sample here or click to browse
                      </button>
                    </div>
                  )}

                  {/* Actions Column */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.25rem', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    paddingRight: '16px'
                  }}>
                    {sample?.isLoaded ? (
                      <>
                        <button
                          onClick={() => playSample(index).catch(error => {
                            console.error('Error playing sample:', error);
                          })}
                          style={actionButtonStyle}
                          title="play"
                        >
                          <i className="fas fa-play" style={{ fontSize: '18px' }}></i>
                        </button>
                        <button
                          onClick={() => onClearSample(index)}
                          style={actionButtonStyle}
                          title="clear"
                        >
                          <i className="fas fa-times" style={{ fontSize: '18px' }}></i>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => openFileDialog(index)}
                          style={actionButtonStyle}
                          title="browse"
                        >
                          <i className="fas fa-upload" style={{ fontSize: '18px' }}></i>
                        </button>
                        <button
                          onClick={() => onRecordSample(index)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRecordSample(index);
                            }
                          }}
                          aria-label={`record sample for slot ${index + 1}`}
                          style={{
                            ...actionButtonStyle,
                            backgroundColor: 'var(--color-surface-primary)',
                            border: '1px solid var(--color-interactive-primary)',
                            outline: 'none'
                          }}
                          title="record"
                          onFocus={(e) => {
                            e.currentTarget.style.outline = '2px solid var(--color-interactive-focus)';
                            e.currentTarget.style.outlineOffset = '2px';
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.outline = 'none';
                          }}
                        >
                          <i className="fas fa-microphone" style={{ fontSize: '18px', color: 'var(--color-accent-primary)' }} aria-hidden="true"></i>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Waveform Zoom Modal */}
      <WaveformZoomModal
        isOpen={zoomModalOpen}
        onClose={closeZoomModal}
        audioBuffer={state.multisampleFiles[zoomSampleIndex]?.audioBuffer || null}
        initialInPoint={state.multisampleFiles[zoomSampleIndex]?.inPoint || 0}
        initialOutPoint={state.multisampleFiles[zoomSampleIndex]?.outPoint || (state.multisampleFiles[zoomSampleIndex]?.audioBuffer ? state.multisampleFiles[zoomSampleIndex].audioBuffer!.length / state.multisampleFiles[zoomSampleIndex].audioBuffer!.sampleRate : 0)}
        initialLoopStart={state.multisampleFiles[zoomSampleIndex]?.loopStart || 0}
        initialLoopEnd={state.multisampleFiles[zoomSampleIndex]?.loopEnd || (state.multisampleFiles[zoomSampleIndex]?.audioBuffer ? state.multisampleFiles[zoomSampleIndex].audioBuffer!.length / state.multisampleFiles[zoomSampleIndex].audioBuffer!.sampleRate : 0)}
        onSave={handleZoomSave}
      />
    </div>
  );
}