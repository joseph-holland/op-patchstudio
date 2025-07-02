import React, { useState, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { FileDetailsBadges } from '../common/FileDetailsBadges';
import { WaveformEditor } from '../common/WaveformEditor';


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
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const browseFileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);

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
  const midiNoteToString = (midiNote: number): string => {
    if (midiNote < 0 || midiNote > 127) return '';
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const note = noteNames[midiNote % 12];
    return `${note}${octave}`;
  };

  const noteStringToMidi = (noteStr: string): number => {
    const match = noteStr.match(/^([A-G])(#|b)?(\d+)$/i);
    if (!match) return -1;
    
    const noteMap: { [key: string]: number } = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const [, note, accidental, octaveStr] = match;
    const baseNote = noteMap[note.toUpperCase()];
    if (baseNote === undefined) return -1;
    
    const octave = parseInt(octaveStr);
    let midiNote = (octave + 1) * 12 + baseNote;
    
    if (accidental === '#') midiNote += 1;
    else if (accidental === 'b') midiNote -= 1;
    
    return (midiNote >= 0 && midiNote <= 127) ? midiNote : -1;
  };

  const parseNoteInput = (input: string): number => {
    const trimmed = input.trim().toUpperCase();
    
    // Check if it's a MIDI number
    if (/^\d+$/.test(trimmed)) {
      const midiNum = parseInt(trimmed);
      return (midiNum >= 0 && midiNum <= 127) ? midiNum : -1;
    }
    
    // Try to parse as note name
    return noteStringToMidi(trimmed);
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
    
    const items = Array.from(e.dataTransfer.items);
    const files: File[] = [];
    
    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          await processEntry(entry, files);
        }
      }
    }
    
    const wavFiles = files.filter(file => 
      file.type === 'audio/wav' || file.name.toLowerCase().endsWith('.wav')
    );
    
    const remainingSlots = 24 - state.multisampleFiles.length;
    const filesToProcess = wavFiles.slice(0, remainingSlots);
    
    if (filesToProcess.length > 0) {
      onFilesSelected(filesToProcess);
    }
  };

  const processEntry = async (entry: any, files: File[]): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve) => {
        entry.file((file: File) => resolve(file));
      });
      files.push(file);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries = await new Promise<any[]>((resolve) => {
        reader.readEntries((entries: any[]) => resolve(entries));
      });
      
      for (const childEntry of entries) {
        await processEntry(childEntry, files);
      }
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
      const wavFiles = await extractWavFiles(files);
      const remainingSlots = 24 - state.multisampleFiles.length;
      const filesToProcess = wavFiles.slice(0, remainingSlots);
      
      if (filesToProcess.length > 0) {
        onFilesSelected(filesToProcess);
      }
    }
    e.target.value = '';
  };

  const extractWavFiles = async (files: File[]): Promise<File[]> => {
    const wavFiles: File[] = [];
    
    for (const file of files) {
      if (file.type === 'audio/wav' || file.name.toLowerCase().endsWith('.wav')) {
        wavFiles.push(file);
      }
    }
    
    return wavFiles;
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
    const midiNote = parseNoteInput(noteStr);
    if (midiNote >= 0 && midiNote <= 127) {
      dispatch({
        type: 'UPDATE_MULTISAMPLE_FILE',
        payload: { 
          index, 
          updates: { 
            rootNote: midiNote,
            note: midiNoteToString(midiNote)
          }
        }
      });
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

  const playSample = (index: number) => {
    const sample = state.multisampleFiles[index];
    if (!sample?.isLoaded || !sample.audioBuffer) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createBufferSource();
      source.buffer = sample.audioBuffer;
      source.connect(audioContext.destination);
      source.start(0);
    } catch (error) {
      console.error('Error playing sample:', error);
    }
  };

  const toggleRowExpansion = (index: number) => {
    setExpandedRow(expandedRow === index ? null : index);
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
      file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.wav')
    );
    
    if (audioFile) {
      handleFileInputChange(index, { target: { files: [audioFile] } } as any);
    }
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
            {state.multisampleFiles.map((sample, index) => (
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
                    <div style={{
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: c.text
                    }}>
                      {sample.isLoaded ? midiNoteToString(sample.rootNote || 60) : 'empty slot'}
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      gap: '0.25rem'
                    }}>
                      {sample.isLoaded ? (
                        <>
                          <button
                            onClick={() => playSample(index)}
                            style={{
                              minHeight: '32px',
                              width: '32px',
                              padding: '0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: `1px solid ${c.borderMed}`,
                              borderRadius: '3px',
                              backgroundColor: c.bg,
                              color: c.action,
                              cursor: 'pointer'
                            }}
                            title="play"
                          >
                            <i className="fas fa-play"></i>
                          </button>
                          <button
                            onClick={() => onClearSample(index)}
                            style={{
                              minHeight: '32px',
                              width: '32px',
                              padding: '0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: `1px solid ${c.borderMed}`,
                              borderRadius: '3px',
                              backgroundColor: c.bg,
                              color: c.textSecondary,
                              cursor: 'pointer'
                            }}
                            title="clear"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => openFileDialog(index)}
                            style={{
                              minHeight: '32px',
                              width: '32px',
                              padding: '0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: `1px solid ${c.borderMed}`,
                              borderRadius: '3px',
                              backgroundColor: c.bg,
                              color: c.action,
                              cursor: 'pointer'
                            }}
                            title="browse"
                          >
                            <i className="fas fa-upload"></i>
                          </button>
                          <button
                            onClick={() => onRecordSample(index)}
                            style={{
                              minHeight: '32px',
                              width: '32px',
                              padding: '0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: `1px solid ${c.borderMed}`,
                              borderRadius: '3px',
                              backgroundColor: c.bg,
                              color: c.action,
                              cursor: 'pointer'
                            }}
                            title="record"
                          >
                            <i className="fas fa-microphone"></i>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {sample.isLoaded ? (
                    <>
                      <div style={{
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        color: c.text,
                        marginBottom: '0.5rem',
                        wordBreak: 'break-word'
                      }}>
                        {sample.name}
                      </div>
                      
                      <div style={{ marginBottom: '0.75rem' }}>
                        <FileDetailsBadges
                          duration={sample.duration}
                          fileSize={sample.fileSize}
                          channels={sample.originalChannels}
                          bitDepth={sample.originalBitDepth}
                          sampleRate={sample.originalSampleRate}
                        />
                      </div>

                      <div style={{
                        height: '50px',
                        marginBottom: '0.5rem'
                      }}>
                        {sample.audioBuffer ? (
                          <WaveformEditor
                            audioBuffer={sample.audioBuffer}
                            height={50}
                            inPoint={sample.inPoint || 0}
                            outPoint={sample.outPoint || sample.audioBuffer.length - 1}
                            onMarkersChange={(markers) => {
                              dispatch({
                                type: 'UPDATE_MULTISAMPLE_FILE',
                                payload: {
                                  index,
                                  updates: {
                                    inPoint: markers.inPoint,
                                    outPoint: markers.outPoint
                                  }
                                }
                              });
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '100%',
                            height: '50px',
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
            ))}
          </div>
        )}
      </div>
    );
  }

  // Desktop Table Layout - matching drum tool structure
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
        // Empty State
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
            border: isDragOver ? `2px dashed ${c.borderMed}` : `2px dashed ${c.border}`,
            borderRadius: '6px',
            backgroundColor: isDragOver ? c.bgAlt : c.bg
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
        <>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '140px 1fr 160px',
            gap: '0.5rem',
            padding: '0.75rem',
            background: c.bgAlt,
            borderRadius: '6px 6px 0 0',
            border: `1px solid ${c.border}`,
            borderBottom: 'none',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            color: c.textSecondary
          }}>
            <div>key</div>
            <div>file details</div>
            <div>actions</div>
          </div>

          {/* Sample Rows */}
          <div style={{
            border: `1px solid ${c.border}`,
            borderRadius: '0 0 6px 6px',
            overflow: 'hidden'
          }}>
            {state.multisampleFiles.map((sample, index) => {
              const isExpanded = expandedRow === index;
              const isDraggedOver = hoveredIndex === index;
              const isDragging = draggedItem === index;
              
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
                    draggable={sample.isLoaded}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '140px 1fr 160px',
                      gap: '0.5rem',
                      padding: '0.75rem',
                      background: isDraggedOver ? c.bgAlt : c.bg,
                      borderBottom: index < state.multisampleFiles.length - 1 ? `1px solid ${c.border}` : 'none',
                      transition: 'background 0.2s ease',
                      alignItems: 'center',
                      minHeight: '60px',
                      opacity: isDragging ? 0.5 : 1,
                      cursor: sample.isLoaded ? 'move' : 'default'
                    }}
                  >
                    {/* Key Column */}
                    <div>
                      {sample.isLoaded ? (
                        <div style={{ textAlign: 'center' }}>
                          <input
                            type="text"
                            value={midiNoteToString(sample.rootNote || 60)}
                            onChange={(e) => handleNoteChange(index, e.target.value)}
                            placeholder="C4 or 60"
                            style={{
                              width: '100px',
                              padding: '0.375rem 0.5rem',
                              border: `1px solid ${c.border}`,
                              borderRadius: '3px',
                              fontSize: '0.875rem',
                              fontFamily: 'monospace',
                              textAlign: 'center',
                              marginBottom: '0.25rem'
                            }}
                          />
                          <div style={{ fontSize: '0.75rem', color: c.textSecondary }}>
                            midi {sample.rootNote || 60}
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: c.textSecondary }}>-</div>
                      )}
                    </div>

                    {/* File Details Column */}
                    <div>
                      {sample.isLoaded ? (
                        <div>
                          <div style={{ 
                            fontWeight: '500', 
                            color: c.text, 
                            marginBottom: '0.25rem',
                            fontSize: '0.9rem',
                            wordBreak: 'break-word'
                          }}>
                            {sample.name}
                          </div>
                          <FileDetailsBadges
                            duration={sample.duration}
                            fileSize={sample.fileSize}
                            channels={sample.originalChannels}
                            bitDepth={sample.originalBitDepth}
                            sampleRate={sample.originalSampleRate}
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => openFileDialog(index)}
                          style={{
                            background: c.bg,
                            border: `2px dashed ${c.borderMed}`,
                            borderRadius: '3px',
                            padding: '0.75rem',
                            color: c.textSecondary,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            width: '100%',
                            textAlign: 'center'
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
                          click to browse for audio file
                        </button>
                      )}
                    </div>

                    {/* Actions Column */}
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      {sample.isLoaded ? (
                        <>
                          <button
                            onClick={() => playSample(index)}
                            style={{
                              padding: '0.375rem 0.75rem',
                              border: `1px solid ${c.border}`,
                              borderRadius: '3px',
                              backgroundColor: c.bg,
                              color: c.textSecondary,
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = c.bgAlt;
                              e.currentTarget.style.borderColor = c.borderMed;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = c.bg;
                              e.currentTarget.style.borderColor = c.border;
                            }}
                            title="play"
                          >
                            <i className="fas fa-play"></i>
                          </button>
                          <button
                            onClick={() => onClearSample(index)}
                            style={{
                              padding: '0.375rem 0.75rem',
                              border: `1px solid ${c.border}`,
                              borderRadius: '3px',
                              backgroundColor: c.bg,
                              color: c.textSecondary,
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = c.bgAlt;
                              e.currentTarget.style.borderColor = c.borderMed;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = c.bg;
                              e.currentTarget.style.borderColor = c.border;
                            }}
                            title="clear"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                          <button
                            onClick={() => toggleRowExpansion(index)}
                            style={{
                              padding: '0.375rem 0.75rem',
                              border: `1px solid ${c.border}`,
                              borderRadius: '3px',
                              backgroundColor: c.bg,
                              color: c.textSecondary,
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = c.bgAlt;
                              e.currentTarget.style.borderColor = c.borderMed;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = c.bg;
                              e.currentTarget.style.borderColor = c.border;
                            }}
                            title="edit waveform"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => openFileDialog(index)}
                            style={{
                              padding: '0.375rem 0.75rem',
                              border: 'none',
                              borderRadius: '3px',
                              backgroundColor: c.action,
                              color: 'var(--color-white)',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = c.actionHover;
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = c.action;
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                            title="browse"
                          >
                            <i className="fas fa-upload"></i>
                          </button>
                          <button
                            onClick={() => onRecordSample(index)}
                            style={{
                              padding: '0.375rem 0.75rem',
                              border: `1px solid ${c.border}`,
                              borderRadius: '3px',
                              backgroundColor: c.bg,
                              color: c.textSecondary,
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = c.bgAlt;
                              e.currentTarget.style.borderColor = c.borderMed;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = c.bg;
                              e.currentTarget.style.borderColor = c.border;
                            }}
                            title="record"
                          >
                            <i className="fas fa-microphone"></i>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded Row Content */}
                  {isExpanded && sample.isLoaded && sample.audioBuffer && (
                    <div style={{
                      borderTop: `1px solid ${c.border}`,
                      padding: '1rem',
                      backgroundColor: c.bgAlt
                    }}>
                      <WaveformEditor
                        audioBuffer={sample.audioBuffer}
                        inPoint={sample.inPoint}
                        outPoint={sample.outPoint}
                        onMarkersChange={(markers) => 
                          dispatch({
                            type: 'UPDATE_MULTISAMPLE_FILE',
                            payload: { index, updates: { inPoint: markers.inPoint, outPoint: markers.outPoint } }
                          })
                        }
                        height={120}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}