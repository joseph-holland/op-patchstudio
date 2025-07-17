import { useEffect, useState } from 'react';
import { Toggle, Slider } from '@carbon/react';
import { AudioFormatControls } from './AudioFormatControls';
import { EnhancedTooltip } from './EnhancedTooltip';

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
  autoZeroCrossing: boolean;
  onAutoZeroCrossingChange: () => void;
  cutAtLoopEnd?: boolean;
  onCutAtLoopEndChange?: (enabled: boolean) => void;
  onResetAudioSettingsConfirm?: () => void;
  gain?: number; // -30 to +20 dB
  onGainChange?: (gain: number) => void;
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
  autoZeroCrossing,
  onAutoZeroCrossingChange,
  cutAtLoopEnd = false,
  onCutAtLoopEndChange,
  onResetAudioSettingsConfirm,
  gain = 0,
  onGainChange
}: AudioProcessingSectionProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isZeroCrossingTooltipVisible, setIsZeroCrossingTooltipVisible] = useState(false);
  const [isZeroCrossingClicked, setIsZeroCrossingClicked] = useState(false);

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
    autoZeroCrossing !== false || // Default is false
    (type === 'multisample' && cutAtLoopEnd !== false) ||
    (type === 'multisample' && gain !== 0)
  );

  // Check if there are any loaded samples to enable the zero crossing button
  const hasLoadedSamples = samples.some(sample => sample.isLoaded);

  return (
    <div style={{
      backgroundColor: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border-light)',
      borderRadius: '15px',
      padding: isMobile ? '1rem' : '1.5rem',
      marginBottom: '1rem',
    }}>
      <div style={{
        fontSize: '1rem',
        fontWeight: '600',
        color: 'var(--color-text-primary)',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <i className="fas fa-cog" style={{ fontSize: '1rem', color: 'var(--color-text-secondary)' }} />
        audio processing
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <AudioFormatControls
          sampleRate={sampleRate}
          bitDepth={bitDepth}
          channels={channels}
          onSampleRateChange={onSampleRateChange}
          onBitDepthChange={onBitDepthChange}
          onChannelsChange={onChannelsChange}
          samples={samples}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: '1rem',
          marginBottom: '1rem',
          alignItems: 'start',
        }}
      >
        {/* Normalization Row */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)' }}>
            normalization
          </div>
          <div style={{ padding: '4px' }}>
            <Toggle
              id="normalize-toggle"
              labelA="off"
              labelB="on"
              toggled={normalize}
              onToggle={onNormalizeChange}
              size="sm"
            />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem', textAlign: isMobile ? 'center' : 'left', width: '100%' }}>
            normalization level: {normalizeLevel.toFixed(1)} dbfs
          </div>
          <div style={{ width: isMobile ? '90%' : '100%', margin: isMobile ? '0 auto' : undefined }}>
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

        {/* Trim to Loop End + Gain Row (multisample only) */}
        {type === 'multisample' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)' }}>
                trim to loop end
              </div>
              <div style={{ padding: '4px' }}>
                <Toggle
                  id="cut-loop-toggle"
                  labelA="off"
                  labelB="on"
                  toggled={cutAtLoopEnd}
                  onToggle={onCutAtLoopEndChange || (() => {})}
                  size="sm"
                />
              </div>
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-primary)', marginBottom: '0.5rem', textAlign: isMobile ? 'center' : 'left', width: '100%' }}>
                gain: {gain} dbfs
              </div>
              <div style={{ width: isMobile ? '90%' : '100%', margin: isMobile ? '0 auto' : undefined }}>
                <Slider
                  id="gain-slider"
                  min={-30}
                  max={20}
                  step={1}
                  value={gain}
                  onChange={({ value }) => onGainChange?.(value)}
                  hideTextInput
                  style={{ width: '100%' }}
                />
              </div>
              <style>{`
                #gain-slider .cds--slider__track {
                  background: linear-gradient(to right, var(--color-bg-slider-track) 0%, var(--color-interactive-secondary) 100%) !important;
                }
                #gain-slider .cds--slider__filled-track {
                  background: var(--color-interactive-dark) !important;
                }
                #gain-slider .cds--slider__thumb {
                  background: var(--color-interactive-dark) !important;
                  border: 2px solid var(--color-interactive-dark) !important;
                }
                #gain-slider .cds--slider__thumb:hover {
                  background: var(--color-text-primary) !important;
                  border-color: var(--color-text-primary) !important;
                }
              `}</style>
            </div>
          </>
        )}
      </div>

      {/* Auto Zero Crossing Button - moved to end of audio processing section */}
      <div style={{ 
        display: 'flex', 
        justifyContent: isMobile ? 'center' : 'flex-start',
        marginBottom: '1rem'
      }}>
        <EnhancedTooltip
          content={
            <div>
              <p>snap all sample markers to zero crossings for cleaner audio. this does not affect future imports.</p>
            </div>
          }
          isVisible={isZeroCrossingTooltipVisible}
        >
                               <button
            onClick={() => {
              setIsZeroCrossingClicked(true);
              setIsZeroCrossingTooltipVisible(false); // Hide tooltip when clicked
              onAutoZeroCrossingChange();
              // Reset the clicked state after a short delay
              setTimeout(() => setIsZeroCrossingClicked(false), 500);
            }}
            disabled={!hasLoadedSamples}
            style={{
              minHeight: '44px',
              padding: '0.75rem 1.5rem',
              border: '1px solid var(--color-interactive-focus-ring)',
              borderRadius: '6px',
              backgroundColor: isZeroCrossingClicked ? 'var(--color-interactive-dark)' : 'var(--color-bg-primary)',
              color: hasLoadedSamples ? (isZeroCrossingClicked ? 'var(--color-bg-primary)' : 'var(--color-interactive-secondary)') : 'var(--color-border-medium)',
              fontSize: '0.9rem',
              fontWeight: '500',
              cursor: hasLoadedSamples ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              opacity: hasLoadedSamples ? 1 : 0.6,
              width: isMobile ? '100%' : '250px',
            }}
            onMouseEnter={(e) => {
              if (hasLoadedSamples && !isZeroCrossingClicked) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--color-border-medium)';
                e.currentTarget.style.color = 'var(--color-interactive-dark)';
                setIsZeroCrossingTooltipVisible(true);
              }
            }}
            onMouseLeave={(e) => {
              if (hasLoadedSamples && !isZeroCrossingClicked) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                e.currentTarget.style.borderColor = 'var(--color-interactive-focus-ring)';
                e.currentTarget.style.color = 'var(--color-interactive-secondary)';
                setIsZeroCrossingTooltipVisible(false);
              }
            }}
          >
            <i className={`fas ${isZeroCrossingClicked ? 'fa-check' : 'fa-wave-square'}`} style={{ fontSize: '1rem' }} />
            {isZeroCrossingClicked ? 'applied' : 'auto zero crossing'}
          </button>
        </EnhancedTooltip>
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
  );
} 