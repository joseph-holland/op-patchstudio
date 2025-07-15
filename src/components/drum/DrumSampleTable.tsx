import React, { useRef, useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { triggerRotateOverlay } from '../../App';
import { isMobile as isMobileDevice, isTablet } from 'react-device-detect';

import { SmallWaveform } from '../common/SmallWaveform';
import { WaveformZoomModal } from '../common/WaveformZoomModal';
import { FileDetailsBadges } from '../common/FileDetailsBadges';
import { DrumSampleSettingsModal } from './DrumSampleSettingsModal';
import { IconButton } from '../common/IconButton';


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
  const { play } = useAudioPlayer();
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [selectedSampleIndex, setSelectedSampleIndex] = useState<number>(0);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<{ index: number; audioBuffer: AudioBuffer; inPoint: number; outPoint: number } | null>(null);

  // Debug: Log state changes
  useEffect(() => {
    // State change tracking removed for production
  }, [state.drumSamples]);

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
    try {
      onFileUpload(index, file);
    } catch (error) {
      console.error('Error in handleFileSelect:', error);
    }
  };

  const openFileDialog = (index: number) => {
    fileInputRefs.current[index]?.click();
  };

  const playSample = async (index: number) => {
    const sample = state.drumSamples[index];
    if (!sample?.isLoaded || !sample.audioBuffer) return;

    try {
      await play(sample.audioBuffer, {
        inFrame: sample.inPoint !== undefined ? Math.floor(sample.inPoint * sample.audioBuffer.sampleRate) : 0,
        outFrame: sample.outPoint !== undefined ? Math.floor(sample.outPoint * sample.audioBuffer.sampleRate) : sample.audioBuffer.length,
        playbackRate: Math.pow(2, (sample.tune || 0) / 12),
        gain: sample.gain || 0,
        pan: sample.pan || 0,
        reverse: sample.reverse || false,
      });
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
    // Check if we're on a mobile device and in portrait mode
    const mobileOrTablet = isMobileDevice || isTablet;
    const isPortraitMode = window.innerHeight > window.innerWidth;
    
    if (mobileOrTablet && isPortraitMode) {
      // Show rotate overlay instead of opening modal
      triggerRotateOverlay(() => {
        // This callback will be executed when device is rotated to landscape
        setSelectedSampleIndex(index);
        setSettingsModalOpen(true);
      });
    } else {
      // Open modal directly on desktop or landscape mobile
      setSelectedSampleIndex(index);
      setSettingsModalOpen(true);
    }
  };

  const closeSettingsModal = () => {
    setSettingsModalOpen(false);
  };

  const openZoomModal = (index: number) => {
    const sample = state.drumSamples[index];
    if (sample && sample.audioBuffer) {
      setSelectedSample({
        index,
        audioBuffer: sample.audioBuffer,
        inPoint: sample.inPoint || 0,
        outPoint: sample.outPoint || sample.duration || sample.audioBuffer.duration,
      });
      setIsZoomModalOpen(true);
    }
  };

  const closeZoomModal = () => {
    setIsZoomModalOpen(false);
    setSelectedSample(null);
  };

  const handleZoomSave = (inPoint: number, outPoint: number) => {
    if (selectedSample) {
      dispatch({
        type: 'UPDATE_DRUM_SAMPLE',
        payload: {
          index: selectedSample.index,
          updates: {
            inPoint,
            outPoint,
            hasBeenEdited: true,
          },
        },
      });
    }
    closeZoomModal();
  };



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
                      try {
                        handleFileSelect(index, file);
                      } catch (error) {
                        console.error('Error in file input handler:', error);
                      }
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
                            fontSize: '14px', 
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
                       <IconButton
                         icon="fas fa-play"
                         onClick={() => playSample(index).catch(error => { console.error('Error playing sample:', error); })}
                         title="play"
                         color={isLoaded ? c.action : c.textSecondary}
                         disabled={!isLoaded}
                       />
                       <IconButton
                         icon="fas fa-times"
                         onClick={() => onClearSample(index)}
                         title="clear"
                         color={isLoaded ? c.action : c.textSecondary}
                         disabled={!isLoaded}
                       />
                       <IconButton
                         icon="fas fa-microphone"
                         onClick={() => onRecordSample?.(index)}
                         title="record"
                         color="var(--color-accent-primary)"
                       />
                       <IconButton
                         icon="fas fa-cog"
                         onClick={() => openSettingsModal(index)}
                         title="settings"
                         color={isLoaded ? c.action : c.textSecondary}
                         disabled={!isLoaded}
                       />
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
                           <SmallWaveform
                             audioBuffer={sample.audioBuffer}
                             height={50}
                             inPoint={Math.round((sample.inPoint || 0) * sample.audioBuffer.sampleRate)}
                             outPoint={Math.round((sample.outPoint || sample.duration || sample.audioBuffer.duration) * sample.audioBuffer.sampleRate)}
                             onMarkersChange={(markers: { inPoint: number; outPoint: number; loopStart?: number; loopEnd?: number }) => {
                               const toSeconds = (frame: number) => frame / (sample.audioBuffer?.sampleRate || 44100);
                               dispatch({
                                 type: 'UPDATE_DRUM_SAMPLE',
                                 payload: {
                                   index,
                                   updates: {
                                     inPoint: toSeconds(markers.inPoint),
                                     outPoint: toSeconds(markers.outPoint),
                                   }
                                 }
                               });
                             }}
                             onZoomEdit={() => openZoomModal(index)}
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
      fontFamily: '"Montserrat", "Arial", sans-serif',
      // Remove or reduce padding/margin so table stretches to section edges
      padding: 0,
      margin: 0
    }}>
      {/* Table Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '120px minmax(200px, 1fr) minmax(200px, 1fr) 180px',
        gap: '0.5rem',
        padding: '0.75rem',
        background: c.bgAlt,
        borderBottom: 'none',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        color: c.textSecondary
      }}>
        <div>drum key</div>
        <div>file details</div>
        <div style={{ paddingLeft: '10px' }}>waveform</div>
        <div style={{ paddingLeft: '10px' }}>actions</div>
      </div>

      {/* Sample Rows */}
      <div style={{
        borderTop: `1px solid ${c.border}`,
        borderBottom: `1px solid ${c.border}`,
        overflow: 'hidden',
        padding: 0,
        margin: 0
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
                  gridTemplateColumns: '120px minmax(200px, 1fr) minmax(200px, 1fr) 180px',
                  gap: '0.5rem',
                  padding: 0, // Remove row padding
                  background: c.bg,
                  borderBottom: index < 23 ? `1px solid ${c.border}` : 'none',
                  transition: 'background 0.2s ease',
                  alignItems: 'center',
                  minHeight: '54px'
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
                  gridColumn: '1 / 2',
                  fontSize: '0.8rem',
                  fontWeight: '500',
                  color: c.text,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  paddingLeft: '16px'
                }}>
                  {drumSampleNames[index]}
                  {sample?.hasBeenEdited && (
                    <i 
                      className="fas fa-pencil-alt" 
                      style={{ 
                        fontSize: '14px', 
                        color: c.textSecondary,
                        opacity: 0.8
                      }}
                      title="edited sample"
                    ></i>
                  )}
                </div>

                {/* Sample Info and Waveform - Combined when empty */}
                {isLoaded ? (
                  <>
                    {/* Sample Info */}
                    <div style={{
                      gridColumn: '2 / 3',
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
                      />
                    </div>

                    {/* Waveform */}
                    <div style={{
                      gridColumn: '3 / 4',
                      height: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      paddingRight: '8px'
                    }}>
                                              {sample.audioBuffer ? (
                          <SmallWaveform
                            audioBuffer={sample.audioBuffer}
                            height={44}
                            inPoint={Math.round((sample.inPoint || 0) * sample.audioBuffer.sampleRate)}
                            outPoint={Math.round((sample.outPoint || sample.duration || sample.audioBuffer.duration) * sample.audioBuffer.sampleRate)}
                            onMarkersChange={(markers: { inPoint: number; outPoint: number; loopStart?: number; loopEnd?: number }) => {
                              const toSeconds = (frame: number) => frame / (sample.audioBuffer?.sampleRate || 44100);
                              dispatch({
                                type: 'UPDATE_DRUM_SAMPLE',
                                payload: {
                                  index,
                                  updates: {
                                    inPoint: toSeconds(markers.inPoint),
                                    outPoint: toSeconds(markers.outPoint),
                                  }
                                }
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
                  <div style={{ gridColumn: '2 / 4', paddingRight: '8px' }}>
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

                {/* Actions - Only play, clear, and settings */}
                <div style={{
                  gridColumn: '4 / 5',
                  display: 'flex',
                  gap: '0.25rem',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingRight: '16px'
                }}>
                  <IconButton
                    icon="fas fa-play"
                    onClick={() => playSample(index).catch(error => { console.error('Error playing sample:', error); })}
                    title="play"
                    color={isLoaded ? c.action : c.textSecondary}
                    disabled={!isLoaded}
                  />
                  <IconButton
                    icon="fas fa-times"
                    onClick={() => onClearSample(index)}
                    title="clear"
                    color={isLoaded ? c.action : c.textSecondary}
                    disabled={!isLoaded}
                  />
                  <IconButton
                    icon="fas fa-microphone"
                    onClick={() => onRecordSample?.(index)}
                    title="record"
                    color="var(--color-accent-primary)"
                  />
                  <IconButton
                    icon="fas fa-cog"
                    onClick={() => openSettingsModal(index)}
                    title="settings"
                    color={isLoaded ? c.action : c.textSecondary}
                    disabled={!isLoaded}
                  />
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

      {/* Waveform Zoom Modal */}
      <WaveformZoomModal
        isOpen={isZoomModalOpen}
        onClose={closeZoomModal}
        audioBuffer={selectedSample?.audioBuffer || null}
        initialInPoint={selectedSample?.inPoint || 0}
        initialOutPoint={selectedSample?.outPoint || 0}
        onSave={handleZoomSave}
      />
    </div>
  );
} 