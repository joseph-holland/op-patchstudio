import React, { useEffect, useState } from 'react';
import { PatchSizeIndicator } from './PatchSizeIndicator';
import { PresetNameInput } from '../library/PresetNameInput';
import type { FilenameSeparator } from '../../utils/constants';

interface GeneratePresetSectionProps {
  type: 'drum' | 'multisample';
  hasLoadedSamples: boolean;
  hasPresetName: boolean;
  canGeneratePatch: boolean;
  loadedSamplesCount: number;
  editedSamplesCount: number;
  presetName: string;
  onPresetNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hasChangesFromDefaults: boolean;
  onResetAll: () => void;
  onSaveToLibrary: () => void;
  onDownloadPreset: () => void;
  inputId: string;
  renameFiles: boolean;
  onRenameFilesChange: (enabled: boolean) => void;
  filenameSeparator: FilenameSeparator;
  onFilenameSeparatorChange: (separator: FilenameSeparator) => void;
}

export function GeneratePresetSection({
  type,
  hasLoadedSamples,
  hasPresetName,
  canGeneratePatch,
  loadedSamplesCount,
  editedSamplesCount,
  presetName,
  onPresetNameChange,
  hasChangesFromDefaults,
  onResetAll,
  onSaveToLibrary,
  onDownloadPreset,
  inputId,
  renameFiles,
  onRenameFilesChange,
  filenameSeparator,
  onFilenameSeparatorChange
}: GeneratePresetSectionProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div style={{
      background: 'var(--color-bg-primary)',
      borderRadius: '15px',
      boxShadow: '0 2px 8px var(--color-shadow-primary)',
      border: '1px solid var(--color-border-subtle)',
      overflow: 'hidden',
      marginBottom: isMobile ? '1rem' : '2rem',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isMobile ? '0.5rem 1rem 0.5rem 1rem' : '0.7rem 1rem 0.5rem 1rem',
        borderBottom: '1px solid var(--color-border-medium)',
        backgroundColor: 'var(--color-bg-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <h3 style={{
            margin: 0,
            color: '#222',
            fontSize: '1.25rem',
            fontWeight: 300,
          }}>
            generate preset
          </h3>
        </div>
      </div>

      {/* Content */}
      <div style={{ 
        padding: isMobile ? '1rem' : '2rem',
      }}>

        {/* Preset Name and File Renaming Controls */}
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: isMobile ? '1.5rem' : 0,
            marginBottom: '2rem',
            paddingBottom: '1.5rem',
            borderBottom: '1px solid var(--color-border-light)'
          }}
        >
          {/* Preset Name Input */}
          <div style={{ width: isMobile ? '100%' : '50%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start' }}>
            <div style={{ width: isMobile ? '100%' : '80%' }}>
              <PresetNameInput
                id={inputId}
                labelText="preset name"
                value={presetName}
                onChange={(value: string) => {
                  // Create a proper synthetic event that matches React.ChangeEvent<HTMLInputElement>
                  const syntheticEvent = {
                    target: { value },
                    currentTarget: { value },
                    preventDefault: () => {},
                    stopPropagation: () => {},
                    nativeEvent: new Event('change'),
                    type: 'change',
                    bubbles: true,
                    cancelable: true,
                    defaultPrevented: false,
                    eventPhase: 0,
                    isTrusted: true,
                    timeStamp: Date.now(),
                    isDefaultPrevented: () => false,
                    isPropagationStopped: () => false,
                    persist: () => {}
                  } as React.ChangeEvent<HTMLInputElement>;
                  onPresetNameChange(syntheticEvent);
                }}
                placeholder="enter preset name..."
                className="preset-name-input-wide"
              />
              <style>{`
                .preset-name-input-wide input.cds--text-input {
                  width: 100% !important;
                  min-width: 0 !important;
                  max-width: none !important;
                  box-sizing: border-box;
                }
                @media (min-width: 769px) {
                  .preset-name-input-wide {
                    width: 100%;
                  }
                }
                @media (max-width: 768px) {
                  .preset-name-input-wide {
                    width: 100%;
                  }
                }
              `}</style>
            </div>
          </div>

          {/* File Renaming Controls */}
          <div
            style={{
              width: isMobile ? '100%' : '50%',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              marginTop: isMobile ? '1.5rem' : 0,
              alignItems: isMobile ? 'center' : 'flex-start',
              justifyContent: 'flex-start',
              boxSizing: 'border-box',
              paddingLeft: isMobile ? 0 : '2rem',
              textAlign: isMobile ? 'center' : 'left',
            }}
          >
            {/* Rename Files Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: isMobile ? 'center' : 'flex-start', width: isMobile ? '100%' : 'auto' }}>
              <input
                type="checkbox"
                id={`rename-files-${inputId}`}
                checked={renameFiles}
                onChange={(e) => onRenameFilesChange(e.target.checked)}
                style={{
                  width: '16px',
                  height: '16px',
                  accentColor: 'var(--color-interactive-focus)'
                }}
              />
              <label
                htmlFor={`rename-files-${inputId}`}
                style={{
                  fontSize: '0.9rem',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  width: isMobile ? 'auto' : undefined,
                  textAlign: isMobile ? 'center' : 'left',
                }}
              >
                rename files with preset name
              </label>
            </div>

            {/* Filename Separator Options */}
            {renameFiles && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: isMobile ? 'center' : 'flex-start', width: isMobile ? '100%' : 'auto' }}>
                <div style={{
                  fontSize: '0.8rem',
                  color: 'var(--color-text-secondary)',
                  marginBottom: '0.25rem',
                  textAlign: isMobile ? 'center' : 'left',
                  width: isMobile ? '100%' : 'auto',
                }}>
                  filename separator:
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: isMobile ? 'center' : 'flex-start', width: isMobile ? '100%' : 'auto' }}>
                  {([' ', '-'] as const).map((separator) => (
                    <label
                      key={separator}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        color: 'var(--color-text-primary)',
                        userSelect: 'none',
                        textAlign: isMobile ? 'center' : 'left',
                      }}
                    >
                      <input
                        type="radio"
                        name={`filename-separator-${inputId}`}
                        value={separator}
                        checked={filenameSeparator === separator}
                        onChange={() => onFilenameSeparatorChange(separator)}
                        style={{ accentColor: 'var(--color-interactive-focus)' }}
                      />
                      <span>
                        {separator === ' ' ? "space ' '" : "hyphen '-'"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Preset Size and Summary */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '1.5rem' : '2rem',
          alignItems: 'flex-start',
          marginBottom: '2rem'
        }}>
          {/* Preset Size Indicator - 50% width */}
          <div style={{ 
            width: isMobile ? '100%' : '50%'
          }}>
            <PatchSizeIndicator type={type} />
          </div>
          
          {/* Preset Summary - 50% width */}
          <div style={{
            width: isMobile ? '100%' : '50%',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: '500',
              color: '#222',
              marginBottom: '0.25rem'
            }}>
              preset summary
            </div>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              fontSize: '0.8rem',
              color: '#666'
            }}>
              {/* Validation Message - only show when can't generate */}
              {!canGeneratePatch && !hasPresetName && (
                <div style={{
                  color: '#666',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.25rem'
                }}>
                  <i className="fas fa-exclamation-triangle" style={{ fontSize: '0.7rem', width: '12px', textAlign: 'center' }}></i>
                  <span>enter preset name to continue</span>
                </div>
              )}
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className={`fas ${hasLoadedSamples ? 'fa-check' : 'fa-times'}`} 
                   style={{ color: '#666', fontSize: '0.7rem', width: '12px', textAlign: 'center' }}></i>
                <span>{loadedSamplesCount} {loadedSamplesCount === 1 ? 'sample' : 'samples'} loaded</span>
              </div>
              
              {/* Show load samples message when no samples but have preset name */}
              {!canGeneratePatch && hasPresetName && !hasLoadedSamples && (
                <div style={{
                  color: '#666',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '0.25rem'
                }}>
                  <i className="fas fa-exclamation-triangle" style={{ fontSize: '0.7rem', width: '12px', textAlign: 'center' }}></i>
                  <span>load samples to continue</span>
                </div>
              )}
              
              {/* Only show custom settings info when samples are loaded and settings have been changed */}
              {hasLoadedSamples && editedSamplesCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="fas fa-info-circle" style={{ color: '#666', fontSize: '0.7rem', width: '12px', textAlign: 'center' }}></i>
                  <span>{editedSamplesCount} {editedSamplesCount === 1 ? 'sample' : 'samples'} with custom settings</span>
                </div>
              )}
              
              {/* File Format Info - only show when ready to generate */}
              {canGeneratePatch && (
                <div style={{
                  color: '#666',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '0.5rem'
                }}>
                  <i className="fas fa-file-archive" style={{ fontSize: '0.7rem', width: '12px', textAlign: 'center' }}></i>
                  <span>saves as '{presetName}.preset.zip'</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons at Bottom */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: isMobile ? 'center' : 'flex-end',
          flexDirection: isMobile ? 'column' : 'row',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--color-border-light)',
        }}>
          <button
            onClick={onResetAll}
            disabled={!hasChangesFromDefaults}
            style={{
              minHeight: '44px',
              minWidth: '44px',
              padding: '0.75rem 1.5rem',
              border: '1px solid var(--color-interactive-focus-ring)',
              borderRadius: '6px',
              backgroundColor: 'var(--color-bg-primary)',
              color: hasChangesFromDefaults ? 'var(--color-interactive-secondary)' : 'var(--color-border-medium)',
              fontSize: '0.9rem',
              fontWeight: '500',
              cursor: hasChangesFromDefaults ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              opacity: hasChangesFromDefaults ? 1 : 0.6,
              width: isMobile ? '100%' : 'auto',
            }}
            onMouseEnter={(e) => {
              if (hasChangesFromDefaults) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--color-border-medium)';
                e.currentTarget.style.color = 'var(--color-interactive-dark)';
              }
            }}
            onMouseLeave={(e) => {
              if (hasChangesFromDefaults) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                e.currentTarget.style.borderColor = 'var(--color-interactive-focus-ring)';
                e.currentTarget.style.color = 'var(--color-interactive-secondary)';
              }
            }}
          >
            <i className="fas fa-undo" style={{ fontSize: '1rem' }}></i>
            reset all
          </button>
          <button
            onClick={onSaveToLibrary}
            disabled={!canGeneratePatch}
            style={{
              minHeight: '44px',
              minWidth: '44px',
              padding: '0.75rem 1.5rem',
              border: '1px solid var(--color-interactive-focus)',
              borderRadius: '6px',
              backgroundColor: 'var(--color-bg-primary)',
              color: canGeneratePatch ? 'var(--color-interactive-focus)' : 'var(--color-border-medium)',
              fontSize: '0.9rem',
              fontWeight: '500',
              cursor: canGeneratePatch ? 'pointer' : 'not-allowed',
              opacity: canGeneratePatch ? 1 : 0.6,
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              width: isMobile ? '100%' : 'auto',
            }}
            onMouseEnter={(e) => {
              if (canGeneratePatch) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--color-interactive-dark)';
                e.currentTarget.style.color = 'var(--color-interactive-dark)';
              }
            }}
            onMouseLeave={(e) => {
              if (canGeneratePatch) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                e.currentTarget.style.borderColor = 'var(--color-interactive-focus)';
                e.currentTarget.style.color = 'var(--color-interactive-focus)';
              }
            }}
          >
            <i className="fas fa-save" style={{ fontSize: '1rem' }}></i>
            save to library
          </button>
          <button
            onClick={onDownloadPreset}
            disabled={!canGeneratePatch}
            style={{
              minHeight: '44px',
              minWidth: '44px',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: canGeneratePatch ? 'var(--color-interactive-focus)' : 'var(--color-border-medium)',
              color: 'var(--color-white)',
              fontSize: '0.9rem',
              fontWeight: '500',
              cursor: canGeneratePatch ? 'pointer' : 'not-allowed',
              opacity: canGeneratePatch ? 1 : 0.6,
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              width: isMobile ? '100%' : 'auto',
            }}
            onMouseEnter={(e) => {
              if (canGeneratePatch) {
                e.currentTarget.style.backgroundColor = 'var(--color-interactive-dark)';
              }
            }}
            onMouseLeave={(e) => {
              if (canGeneratePatch) {
                e.currentTarget.style.backgroundColor = 'var(--color-interactive-focus)';
              }
            }}
          >
            <i className="fas fa-download" style={{ fontSize: '1rem' }}></i>
            download preset
          </button>
        </div>
      </div>
    </div>
  );
} 