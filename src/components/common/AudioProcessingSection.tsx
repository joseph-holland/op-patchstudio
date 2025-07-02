import React, { useEffect, useState } from 'react';
import { Toggle, Slider } from '@carbon/react';
import { AudioFormatControls } from './AudioFormatControls';

interface AudioProcessingSectionProps {
  type: 'drum' | 'multisample';
  sampleRate: number;
  bitDepth: number;
  channels: number;
  onSampleRateChange: (value: string) => void;
  onBitDepthChange: (value: string) => void;
  onChannelsChange: (value: string) => void;
  samples: any[];
  normalize: boolean;
  normalizeLevel: number;
  onNormalizeChange: (enabled: boolean) => void;
  onNormalizeLevelChange: (level: number) => void;
  cutAtLoopEnd?: boolean;
  onCutAtLoopEndChange?: (enabled: boolean) => void;
  onResetAudioSettingsConfirm?: () => void;
}

export function AudioProcessingSection({
  type,
  sampleRate,
  bitDepth,
  channels,
  onSampleRateChange,
  onBitDepthChange,
  onChannelsChange,
  samples,
  normalize,
  normalizeLevel,
  onNormalizeChange,
  onNormalizeLevelChange,
  cutAtLoopEnd = false,
  onCutAtLoopEndChange,
  onResetAudioSettingsConfirm
}: AudioProcessingSectionProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check if audio processing settings have been modified from defaults
  const hasAudioSettingsChanged = (
    sampleRate !== 0 || // 0 = original
    bitDepth !== 0 ||
    channels !== 0 ||
    normalize !== false ||
    normalizeLevel !== 0.0 ||
    (type === 'multisample' && cutAtLoopEnd !== false)
  );

  return (
    <div style={{
      background: 'var(--color-bg-primary)',
      borderTop: '1px solid var(--color-progress-track)',
      padding: '1.5rem 2rem'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '2rem',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: isMobile ? 'flex-start' : 'space-between',
        alignItems: isMobile ? 'flex-start' : 'center',
        gap: isMobile ? '1rem' : '0'
      }}>
        <h3 style={{ 
          margin: '0',
          color: 'var(--color-text-primary)',
          fontSize: '1.25rem',
          fontWeight: '300',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          alignSelf: isMobile ? 'flex-start' : 'auto'
        }}>
          audio processing
        </h3>
        {onResetAudioSettingsConfirm && (
          <button
            onClick={hasAudioSettingsChanged ? onResetAudioSettingsConfirm : undefined}
            disabled={!hasAudioSettingsChanged}
            style={{
              padding: '0.625rem 1.25rem',
              border: '1px solid var(--color-interactive-focus-ring)',
              borderRadius: '3px',
              backgroundColor: 'var(--color-bg-primary)',
              color: hasAudioSettingsChanged ? 'var(--color-interactive-secondary)' : 'var(--color-border-medium)',
              fontSize: '0.9rem',
              fontWeight: '500',
              cursor: hasAudioSettingsChanged ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              opacity: hasAudioSettingsChanged ? 1 : 0.6,
              alignSelf: isMobile ? 'center' : 'auto'
            }}
            onMouseEnter={(e) => {
              if (hasAudioSettingsChanged) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--color-border-medium)';
                e.currentTarget.style.color = 'var(--color-interactive-dark)';
              }
            }}
            onMouseLeave={(e) => {
              if (hasAudioSettingsChanged) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                e.currentTarget.style.borderColor = 'var(--color-interactive-focus-ring)';
                e.currentTarget.style.color = 'var(--color-interactive-secondary)';
              }
            }}
          >
            <i className="fas fa-undo"></i>
            reset settings
          </button>
        )}
      </div>

      {/* Audio Format Controls and Processing Controls */}
      <div>
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '2rem' : '4rem',
          alignItems: isMobile ? 'stretch' : 'flex-start'
        }}>
          {/* Audio Format Controls */}
          <div style={{
            flex: isMobile ? 'none' : '1'
          }}>
            <AudioFormatControls
              sampleRate={sampleRate}
              bitDepth={bitDepth}
              channels={channels}
              onSampleRateChange={onSampleRateChange}
              onBitDepthChange={onBitDepthChange}
              onChannelsChange={onChannelsChange}
              samples={samples}
              size="sm"
              isMobile={isMobile}
            />
          </div>

          {/* Processing Controls */}
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '1.5rem' : '2rem',
            alignItems: isMobile ? 'stretch' : 'flex-start'
          }}>
            {isMobile ? (
              // Mobile Layout: Toggles side by side, slider below
              <>
                {/* Toggles Row */}
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  justifyContent: 'space-around',
                  width: '100%',
                  maxWidth: '100%',
                  overflow: 'hidden'
                }}>
                  {/* Cut at Loop End - only for multisample tool */}
                  {type === 'multisample' && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      flex: '1',
                      alignItems: 'center',
                      minWidth: 0,
                      maxWidth: '100%'
                    }}>
                      <div style={{
                        fontSize: '0.8rem',
                        fontWeight: '500',
                        color: 'var(--color-text-primary)',
                        textAlign: 'center',
                        lineHeight: '1.2',
                        hyphens: 'auto',
                        wordBreak: 'break-word',
                        maxWidth: '100%'
                      }}>
                        loop end cut
                      </div>
                      <Toggle
                        id="cut-loop-toggle"
                        labelA="off"
                        labelB="on"
                        toggled={cutAtLoopEnd}
                        onToggle={onCutAtLoopEndChange || (() => {})}
                        size="sm"
                      />
                      <style>{`
                        #cut-loop-toggle .cds--toggle-input__appearance {
                          background-color: var(--color-bg-slider-track) !important;
                        }
                        #cut-loop-toggle .cds--toggle-input__appearance:before {
                          background-color: var(--color-interactive-secondary) !important;
                        }
                        #cut-loop-toggle .cds--toggle-input:checked + .cds--toggle-input__appearance {
                          background-color: var(--color-interactive-dark) !important;
                        }
                        #cut-loop-toggle .cds--toggle-input:checked + .cds--toggle-input__appearance:before {
                          background-color: var(--color-bg-primary) !important;
                        }
                        #cut-loop-toggle .cds--toggle__text--off,
                        #cut-loop-toggle .cds--toggle__text--on {
                          color: var(--color-interactive-secondary) !important;
                        }
                      `}</style>
                    </div>
                  )}

                  {/* Normalize Toggle */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    flex: '1',
                    alignItems: 'center',
                    minWidth: 0,
                    maxWidth: '100%'
                  }}>
                    <div style={{
                      fontSize: '0.8rem',
                      fontWeight: '500',
                      color: 'var(--color-text-primary)',
                      textAlign: 'center',
                      lineHeight: '1.2',
                      wordBreak: 'break-word',
                      maxWidth: '100%'
                    }}>
                      normalize
                    </div>
                    <Toggle
                      id="normalize-toggle"
                      labelA="off"
                      labelB="on"
                      toggled={normalize}
                      onToggle={onNormalizeChange}
                      size="sm"
                    />
                    <style>{`
                      #normalize-toggle .cds--toggle-input__appearance {
                        background-color: var(--color-bg-slider-track) !important;
                      }
                      #normalize-toggle .cds--toggle-input__appearance:before {
                        background-color: var(--color-interactive-secondary) !important;
                      }
                      #normalize-toggle .cds--toggle-input:checked + .cds--toggle-input__appearance {
                        background-color: var(--color-interactive-dark) !important;
                      }
                      #normalize-toggle .cds--toggle-input:checked + .cds--toggle-input__appearance:before {
                        background-color: var(--color-bg-primary) !important;
                      }
                      #normalize-toggle .cds--toggle__text--off,
                      #normalize-toggle .cds--toggle__text--on {
                        color: var(--color-interactive-secondary) !important;
                      }
                    `}</style>
                  </div>
                </div>

                {/* Normalization Level Slider - below toggles */}
                <div style={{
                  width: '100%'
                }}>
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    color: 'var(--color-text-primary)',
                    marginBottom: '0.5rem',
                    textAlign: 'center'
                  }}>
                    normalization level: {normalizeLevel.toFixed(1)} db
                  </div>
                  <div style={{ width: '100%' }}>
                    <Slider
                      id="normalize-level"
                      min={-6.0}
                      max={0.0}
                      step={0.1}
                      value={normalizeLevel}
                      onChange={({ value }) => onNormalizeLevelChange(value)}
                      hideTextInput
                    />
                  </div>
                  <style>{`
                    #normalize-level .cds--slider__track {
                      background: linear-gradient(to right, var(--color-bg-slider-track) 0%, var(--color-interactive-secondary) 100%) !important;
                    }
                    #normalize-level .cds--slider__filled-track {
                      background: var(--color-interactive-dark) !important;
                    }
                    #normalize-level .cds--slider__thumb {
                      background: var(--color-interactive-dark) !important;
                      border: 2px solid var(--color-interactive-dark) !important;
                    }
                    #normalize-level .cds--slider__thumb:hover {
                      background: var(--color-text-primary) !important;
                      border-color: var(--color-text-primary) !important;
                    }
                  `}</style>
                </div>
              </>
            ) : (
              // Desktop Layout: All controls in a row
              <>
                {/* Cut at Loop End - only for multisample tool */}
                {type === 'multisample' && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    <div style={{
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      color: 'var(--color-text-primary)'
                    }}>
                      loop end cut
                    </div>
                    <Toggle
                      id="cut-loop-toggle"
                      labelA="off"
                      labelB="on"
                      toggled={cutAtLoopEnd}
                      onToggle={onCutAtLoopEndChange || (() => {})}
                      size="sm"
                    />
                    <style>{`
                      #cut-loop-toggle .cds--toggle-input__appearance {
                        background-color: var(--color-bg-slider-track) !important;
                      }
                      #cut-loop-toggle .cds--toggle-input__appearance:before {
                        background-color: var(--color-interactive-secondary) !important;
                      }
                      #cut-loop-toggle .cds--toggle-input:checked + .cds--toggle-input__appearance {
                        background-color: var(--color-interactive-dark) !important;
                      }
                      #cut-loop-toggle .cds--toggle-input:checked + .cds--toggle-input__appearance:before {
                        background-color: var(--color-bg-primary) !important;
                      }
                      #cut-loop-toggle .cds--toggle__text--off,
                      #cut-loop-toggle .cds--toggle__text--on {
                        color: var(--color-interactive-secondary) !important;
                      }
                    `}</style>
                  </div>
                )}

                {/* Normalize Toggle */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  <div style={{
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    color: 'var(--color-text-primary)'
                  }}>
                    normalize
                  </div>
                  <Toggle
                    id="normalize-toggle"
                    labelA="off"
                    labelB="on"
                    toggled={normalize}
                    onToggle={onNormalizeChange}
                    size="sm"
                  />
                  <style>{`
                    #normalize-toggle .cds--toggle-input__appearance {
                      background-color: var(--color-bg-slider-track) !important;
                    }
                    #normalize-toggle .cds--toggle-input__appearance:before {
                      background-color: var(--color-interactive-secondary) !important;
                    }
                    #normalize-toggle .cds--toggle-input:checked + .cds--toggle-input__appearance {
                      background-color: var(--color-interactive-dark) !important;
                    }
                    #normalize-toggle .cds--toggle-input:checked + .cds--toggle-input__appearance:before {
                      background-color: var(--color-bg-primary) !important;
                    }
                    #normalize-toggle .cds--toggle__text--off,
                    #normalize-toggle .cds--toggle__text--on {
                      color: var(--color-interactive-secondary) !important;
                    }
                  `}</style>
                </div>

                {/* Normalization Level Slider - auto-adjusts to available space */}
                <div style={{
                  flex: '1',
                  minWidth: '200px',
                  maxWidth: '250px'
                }}>
                  <div style={{
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    color: 'var(--color-text-primary)',
                    marginBottom: '0.5rem'
                  }}>
                    normalization level: {normalizeLevel.toFixed(1)} db
                  </div>
                  <div style={{ width: '100%' }}>
                    <Slider
                      id="normalize-level"
                      min={-6.0}
                      max={0.0}
                      step={0.1}
                      value={normalizeLevel}
                      onChange={({ value }) => onNormalizeLevelChange(value)}
                      hideTextInput
                    />
                  </div>
                  <style>{`
                    #normalize-level .cds--slider__track {
                      background: linear-gradient(to right, var(--color-bg-slider-track) 0%, var(--color-interactive-secondary) 100%) !important;
                    }
                    #normalize-level .cds--slider__filled-track {
                      background: var(--color-interactive-dark) !important;
                    }
                    #normalize-level .cds--slider__thumb {
                      background: var(--color-interactive-dark) !important;
                      border: 2px solid var(--color-interactive-dark) !important;
                    }
                    #normalize-level .cds--slider__thumb:hover {
                      background: var(--color-text-primary) !important;
                      border-color: var(--color-text-primary) !important;
                    }
                  `}</style>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 