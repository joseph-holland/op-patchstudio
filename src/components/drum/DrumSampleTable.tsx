import React, { useRef, useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '@carbon/react';
import { WaveformEditor } from '../common/WaveformEditor';
import { FileDetailsBadges } from '../common/FileDetailsBadges';
import { DrumSampleSettingsModal, useDrumSampleSettingsKeyboard } from './DrumSampleSettingsModal';

interface DrumSampleTableProps {
  onFileUpload: (index: number, file: File) => void;
  onClearSample: (index: number) => void;
  onRecordSample?: (index: number) => void;
}

// Full drum names from OP-XY documentation - all lowercase
const drumSampleNames = [
  'kick', 'kick alt', 'snare', 'snare alt', 'rim', 'hand clap', 
  'tambourine', 'shaker', 'closed hi-hat', 'clave', 'open hi-hat', 'cabasa',
  'low tom', 'ride cymbal', 'mid-tom', 'crash cymbal', 'hi-tom', 'cowbell', 
  'triangle', 'low tom', 'low conga', 'clave', 'hi-conga', 'guiro'
];

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
};

export function DrumSampleTable({ onFileUpload, onClearSample, onRecordSample }: DrumSampleTableProps) {
  const { state, dispatch } = useAppContext();
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [selectedSampleIndex, setSelectedSampleIndex] = useState<number>(0);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleFileSelect = (index: number, file: File) => {
    onFileUpload(index, file);
  };

  const openFileDialog = (index: number) => {
    fileInputRefs.current[index]?.click();
  };

  const playSample = (index: number) => {
    const sample = state.drumSamples[index];
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.find(file => 
      file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.wav')
    );
    
    if (audioFile) {
      handleFileSelect(index, audioFile);
    }
  };

  const openSettingsModal = (index: number) => {
    setSelectedSampleIndex(index);
    setSettingsModalOpen(true);
  };

  const closeSettingsModal = () => {
    setSettingsModalOpen(false);
  };

  const playSelectedSample = () => {
    playSample(selectedSampleIndex);
  };

  // Add keyboard handler for 'p' key in settings modal
  useDrumSampleSettingsKeyboard(settingsModalOpen, playSelectedSample);

  if (isMobile) {
    // Mobile Card Layout
    return (
      <div style={{
        fontFamily: '"Montserrat", "Arial", sans-serif'
      }}>


        {/* Mobile Cards */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          {Array.from({ length: 24 }, (_, index) => {
            const sample = state.drumSamples[index];
            const isLoaded = sample?.isLoaded;
            
            return (
              <div key={index}>
                <input
                  type="file"
                  accept="audio/*,.wav"
                  style={{ display: 'none' }}
                  ref={(el) => { fileInputRefs.current[index] = el; }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileSelect(index, file);
                    }
                    e.target.value = '';
                  }}
                />
                
                <div
                  style={{
                    background: c.bg,
                    border: `1px solid ${c.border}`,
                    borderRadius: '3px',
                    padding: '1rem',
                    transition: 'background 0.2s ease'
                  }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  {/* Card Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem'
                  }}>
                    <div style={{
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: c.text,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      {drumSampleNames[index]}
                      {sample?.hasBeenEdited && (
                        <i 
                          className="fas fa-pencil-alt" 
                          style={{ 
                            fontSize: '0.7rem', 
                            color: c.textSecondary,
                            opacity: 0.8
                          }}
                          title="edited sample"
                        ></i>
                      )}
                    </div>
                    
                                         {/* Actions - Play, Clear, and Settings */}
                     <div style={{
                       display: 'flex',
                       gap: '0.25rem'
                     }}>
                       <Button
                         kind="ghost"
                         size="sm"
                         disabled={!isLoaded}
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
                           color: isLoaded ? c.action : c.textSecondary
                         }}
                         title="play"
                       >
                         <i className="fas fa-play"></i>
                       </Button>
                       <Button
                         kind="ghost"
                         size="sm"
                         disabled={!isLoaded}
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
                           color: isLoaded ? c.action : c.textSecondary
                         }}
                         title="clear"
                       >
                         <i className="fas fa-times"></i>
                       </Button>
                       <Button
                         kind="ghost"
                         size="sm"
                         onClick={() => onRecordSample?.(index)}
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
                           color: c.action
                         }}
                         title="record"
                       >
                         <i className="fas fa-microphone"></i>
                       </Button>
                       <Button
                         kind="ghost"
                         size="sm"
                         disabled={!isLoaded}
                         onClick={() => openSettingsModal(index)}
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
                           color: isLoaded ? c.action : c.textSecondary
                         }}
                         title="settings"
                       >
                         <i className="fas fa-cog"></i>
                       </Button>
                     </div>
                  </div>

                  {/* Card Content */}
                  {isLoaded ? (
                    <>
                      {/* File Name */}
                      <div style={{
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        color: c.text,
                        marginBottom: '0.5rem',
                        wordBreak: 'break-word'
                      }}>
                        {sample.name}
                      </div>
                      
                      {/* File Details */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <FileDetailsBadges
                          duration={sample.duration}
                          fileSize={sample.fileSize}
                          channels={sample.originalChannels}
                          bitDepth={sample.originalBitDepth}
                          sampleRate={sample.originalSampleRate}
                        />
                      </div>

                                             {/* Waveform */}
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
                                 type: 'UPDATE_DRUM_SAMPLE',
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
                        background: 'none',
                        border: `2px dashed ${c.borderMed}`,
                        borderRadius: '3px',
                        padding: '1.5rem 1rem',
                        color: c.textSecondary,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                      onTouchStart={(e) => {
                        e.currentTarget.style.borderColor = c.textSecondary;
                        e.currentTarget.style.color = c.action;
                      }}
                      onTouchEnd={(e) => {
                        e.currentTarget.style.borderColor = c.borderMed;
                        e.currentTarget.style.color = c.textSecondary;
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
      </div>
    );
  }

  // Desktop Table Layout
  return (
    <div style={{
      fontFamily: '"Montserrat", "Arial", sans-serif'
    }}>
      {/* Table Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '100px 1fr 160px 140px',
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
        <div>drum key</div>
        <div>file details</div>
        <div>waveform</div>
        <div>actions</div>
      </div>

      {/* Sample Rows */}
      <div style={{
        border: `1px solid ${c.border}`,
        borderRadius: '0 0 6px 6px',
        overflow: 'hidden'
      }}>
        {Array.from({ length: 24 }, (_, index) => {
          const sample = state.drumSamples[index];
          const isLoaded = sample?.isLoaded;
          
          return (
            <div key={index}>
              <input
                type="file"
                accept="audio/*,.wav"
                style={{ display: 'none' }}
                ref={(el) => { fileInputRefs.current[index] = el; }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileSelect(index, file);
                  }
                  e.target.value = '';
                }}
              />
              
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 1fr 160px 140px',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  background: c.bg,
                  borderBottom: index < 23 ? `1px solid ${c.border}` : 'none',
                  transition: 'background 0.2s ease',
                  alignItems: 'center',
                  minHeight: '60px'
                }}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = c.bgAlt;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = c.bg;
                }}
              >
                {/* Drum Name */}
                <div style={{
                  fontSize: '0.8rem',
                  fontWeight: '500',
                  color: c.text,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  {drumSampleNames[index]}
                  {sample?.hasBeenEdited && (
                    <i 
                      className="fas fa-pencil-alt" 
                      style={{ 
                        fontSize: '0.6rem', 
                        color: c.textSecondary,
                        opacity: 0.8
                      }}
                      title="edited sample"
                    ></i>
                  )}
                </div>

                {/* Sample Info */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}>
                  {isLoaded ? (
                    <>
                      <div style={{
                        fontSize: '0.8rem',
                        fontWeight: '500',
                        color: c.text,
                        wordBreak: 'break-word',
                        marginBottom: '0.25rem'
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
                    </>
                  ) : (
                    <button
                      onClick={() => openFileDialog(index)}
                      style={{
                        background: 'none',
                        border: `2px dashed ${c.borderMed}`,
                        borderRadius: '3px',
                        padding: '1rem',
                        color: c.textSecondary,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
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
                  )}
                </div>

                {/* Waveform */}
                <div style={{
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  {isLoaded && sample.audioBuffer ? (
                    <WaveformEditor
                      audioBuffer={sample.audioBuffer}
                      height={40}
                      inPoint={sample.inPoint || 0}
                      outPoint={sample.outPoint || sample.audioBuffer.length - 1}
                      onMarkersChange={(markers) => {
                        dispatch({
                          type: 'UPDATE_DRUM_SAMPLE',
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
                      height: '40px',
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

                {/* Actions - Only play, clear, and settings */}
                <div style={{
                  display: 'flex',
                  gap: '0.25rem',
                  alignItems: 'center'
                }}>
                  <Button
                    kind="ghost"
                    size="sm"
                    disabled={!isLoaded}
                    onClick={() => playSample(index)}
                    style={{
                      minHeight: '28px',
                      width: '28px',
                      padding: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${c.borderMed}`,
                      borderRadius: '3px',
                      backgroundColor: c.bg,
                      color: isLoaded ? c.action : c.textSecondary
                    }}
                    title="play"
                  >
                    <i className="fas fa-play"></i>
                  </Button>
                  <Button
                    kind="ghost"
                    size="sm"
                    disabled={!isLoaded}
                    onClick={() => onClearSample(index)}
                    style={{
                      minHeight: '28px',
                      width: '28px',
                      padding: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${c.borderMed}`,
                      borderRadius: '3px',
                      backgroundColor: c.bg,
                      color: isLoaded ? c.action : c.textSecondary
                    }}
                    title="clear"
                  >
                    <i className="fas fa-times"></i>
                  </Button>
                  <Button
                    kind="ghost"
                    size="sm"
                    onClick={() => onRecordSample?.(index)}
                    style={{
                      minHeight: '28px',
                      width: '28px',
                      padding: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${c.borderMed}`,
                      borderRadius: '3px',
                      backgroundColor: c.bg,
                      color: c.action
                    }}
                    title="record"
                  >
                    <i className="fas fa-microphone"></i>
                  </Button>
                  <Button
                    kind="ghost"
                    size="sm"
                    disabled={!isLoaded}
                    onClick={() => openSettingsModal(index)}
                    style={{
                      minHeight: '28px',
                      width: '28px',
                      padding: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${c.borderMed}`,
                      borderRadius: '3px',
                      backgroundColor: c.bg,
                      color: isLoaded ? c.action : c.textSecondary
                    }}
                    title="settings"
                  >
                    <i className="fas fa-cog"></i>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Settings Modal */}
      <DrumSampleSettingsModal
        isOpen={settingsModalOpen}
        onClose={closeSettingsModal}
        sampleIndex={selectedSampleIndex}
      />
    </div>
  );
} 