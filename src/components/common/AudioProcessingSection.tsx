import { useEffect, useState } from 'react';
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
      borderRadius: '15px',
      border: '1px solid var(--color-border-subtle)',
      boxShadow: '0 2px 8px var(--color-shadow-primary)',
      overflow: 'hidden',
      marginBottom: isMobile ? '1.5rem' : '2rem'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isMobile ? '0.5rem 1rem 0.5rem 1rem' : '0.7rem 1rem 0.5rem 1rem',
        borderBottom: '1px solid var(--color-border-light)',
        backgroundColor: 'var(--color-bg-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <h3 style={{
            margin: 0,
            color: '#222',
            fontSize: '1.25rem',
            fontWeight: 300,
          }}>
            audio processing
          </h3>
        </div>
      </div>
      {/* Content */}
      <div style={{
        paddingLeft: isMobile ? '1rem' : '2rem',
        paddingRight: isMobile ? '1rem' : '2rem',
        paddingTop: isMobile ? '1rem' : '2rem',
        paddingBottom: isMobile ? '1rem' : '2rem',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        {/* Audio Format Controls */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? '1.25rem' : '2rem',
            marginBottom: isMobile ? '1.25rem' : '2rem',
          }}
        >
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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? '1.25rem' : '2rem',
            marginBottom: isMobile ? '1.25rem' : '2rem',
          }}
        >
          {/* Normalization Row */}
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '1rem' : '2rem',
            alignItems: isMobile ? 'center' : 'flex-start',
          }}>
            {/* Normalization Toggle - Left Side */}
            <div style={{ 
              flex: isMobile ? 'none' : '1',
              width: isMobile ? '100%' : 'auto',
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem', 
              justifyContent: isMobile ? 'center' : 'flex-start' 
            }}>
              <div style={{ fontSize: isMobile ? '0.95rem' : '1rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                normalization
              </div>
              <Toggle
                id="normalize-toggle"
                labelA="off"
                labelB="on"
                toggled={normalize}
                onToggle={onNormalizeChange}
                size="sm"
              />
            </div>
            
            {/* Normalization Level Slider - Right Side */}
            <div style={{ 
              flex: isMobile ? 'none' : '1',
              width: isMobile ? '100%' : 'auto'
            }}>
              <div style={{ fontSize: isMobile ? '0.9rem' : '1rem', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '0.5rem', textAlign: isMobile ? 'center' : 'left' }}>
                normalization level: {normalizeLevel.toFixed(1)} db
              </div>
              <Slider
                id="normalize-level"
                min={-6.0}
                max={0.0}
                step={0.1}
                value={normalizeLevel}
                onChange={({ value }) => onNormalizeLevelChange(value)}
                hideTextInput
                style={{ width: '100%' }}
              />
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
          </div>
          {/* Loop End Cut Toggle (new row, only for multisample) */}
          {type === 'multisample' && (
            <div style={{ width: isMobile ? '100%' : 'auto', display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: isMobile ? 'center' : 'flex-start' }}>
              <div style={{ fontSize: isMobile ? '0.95rem' : '1rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
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
        </div>
        
        {/* Action Buttons Below Settings */}
        {onResetAudioSettingsConfirm && (
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: isMobile ? 'center' : 'flex-end',
            flexDirection: isMobile ? 'column' : 'row',
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--color-border-light)',
          }}>
            <button
              onClick={hasAudioSettingsChanged ? onResetAudioSettingsConfirm : undefined}
              disabled={!hasAudioSettingsChanged}
              style={{
                minHeight: '44px',
                minWidth: '44px',
                padding: '0.75rem 1.5rem',
                border: '1px solid var(--color-interactive-focus-ring)',
                borderRadius: '6px',
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
                gap: '0.75rem',
                opacity: hasAudioSettingsChanged ? 1 : 0.6,
                width: isMobile ? '100%' : 'auto',
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
              <i className="fas fa-undo" style={{ fontSize: '1rem' }} />
              reset audio settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 