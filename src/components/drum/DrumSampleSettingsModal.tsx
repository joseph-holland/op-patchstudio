import { useState, useEffect } from 'react';
import { useAppContext, type DrumSample } from '../../context/AppContext';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { EnhancedWaveformEditor } from '../common/EnhancedWaveformEditor';
import { Slider } from '@carbon/react';
import React from 'react';
import { WaveformZoomModal } from '../common/WaveformZoomModal';

interface DrumSampleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sampleIndex: number;
}

interface SampleSettings {
  playmode: 'oneshot' | 'group' | 'loop' | 'gate';
  reverse: boolean;
  transpose: number; // -48 to +48 semitones
  gain: number; // -30 to +20 dB
  pan: number; // -100 to +100
}

export function DrumSampleSettingsModal({ isOpen, onClose, sampleIndex }: DrumSampleSettingsModalProps) {
  const { state, dispatch } = useAppContext();
  const { play, stopCurrentPlayback } = useAudioPlayer();
  const sample = state.drumSamples[sampleIndex];
  
  const [settings, setSettings] = useState<SampleSettings>({
    playmode: 'oneshot',
    reverse: false,
    transpose: 0,
    gain: 0,
    pan: 0
  });

  // Add local state for marker positions
  const [localInPoint, setLocalInPoint] = useState<number | null>(null);
  const [localOutPoint, setLocalOutPoint] = useState<number | null>(null);

  // Add local state for showZoomModal
  const [showZoomModal, setShowZoomModal] = useState(false);

  // Initialize settings and markers from sample data when modal opens
  useEffect(() => {
    if (isOpen && sample?.isLoaded) {
      setSettings({
        playmode: sample.playmode || 'oneshot',
        reverse: sample.reverse || false,
        transpose: sample.transpose || 0,
        gain: sample.gain || 0,
        pan: sample.pan || 0
      });
      
      // Set local marker state to actual sample marker positions
      const actualInPoint = sample.inPoint !== undefined ? sample.inPoint : 0;
      const actualOutPoint = sample.outPoint !== undefined ? sample.outPoint : (sample.audioBuffer?.duration || 0);
      
      setLocalInPoint(actualInPoint);
      setLocalOutPoint(actualOutPoint);
      
      // Set default marker positions if not already set
      if ((sample.inPoint === undefined || sample.outPoint === undefined) && sample.audioBuffer) {
        dispatch({
          type: 'UPDATE_DRUM_SAMPLE',
          payload: {
            index: sampleIndex,
            updates: {
              inPoint: 0,
              outPoint: sample.audioBuffer.duration
            }
          }
        });
      }
    }
  }, [isOpen, sample, sampleIndex, dispatch]);

  // Use local marker state for sample index calculations
  const getInPointSampleIndex = () => {
    if (!sample?.audioBuffer) return 0;
    return Math.floor(((localInPoint !== null ? localInPoint : sample.inPoint || 0) * sample.audioBuffer.sampleRate));
  };

  const getOutPointSampleIndex = () => {
    if (!sample?.audioBuffer) return 0;
    return Math.floor(((localOutPoint !== null ? localOutPoint : sample.outPoint || sample.audioBuffer.duration) * sample.audioBuffer.sampleRate));
  };

  // Convert sample indices back to time values
  const sampleIndexToTime = (sampleIndex: number) => {
    if (!sample?.audioBuffer) return 0;
    return sampleIndex / sample.audioBuffer.sampleRate;
  };



  // Save local marker state to global state on save
  const handleSave = () => {
    if (sample?.isLoaded) {
      // Check if any values actually changed
      const originalValues = {
        playmode: sample.playmode || 'oneshot',
        reverse: sample.reverse || false,
        transpose: sample.transpose || 0,
        gain: sample.gain || 0,
        pan: sample.pan || 0
      };
      const valuesChanged =
        settings.playmode !== originalValues.playmode ||
        settings.reverse !== originalValues.reverse ||
        settings.transpose !== originalValues.transpose ||
        settings.gain !== originalValues.gain ||
        settings.pan !== originalValues.pan;
      dispatch({
        type: 'UPDATE_DRUM_SAMPLE',
        payload: {
          index: sampleIndex,
          updates: {
            ...settings,
            inPoint: localInPoint !== null ? localInPoint : sample.inPoint,
            outPoint: localOutPoint !== null ? localOutPoint : sample.outPoint,
            hasBeenEdited: sample.hasBeenEdited || valuesChanged
          }
        }
      });
    }
    onClose();
  };

  // Discard local marker changes on cancel
  const handleCancel = () => {
    setLocalInPoint(null);
    setLocalOutPoint(null);
    onClose();
  };

  const handleSaveForAll = (payload: Partial<DrumSample>) => {
    dispatch({
      type: 'UPDATE_ALL_DRUM_SAMPLES',
      payload,
    });
  }

  const handlePlaySample = async () => {
    if (!sample?.audioBuffer) return;

    const inFrame = getInPointSampleIndex();
    const outFrame = getOutPointSampleIndex();

    try {
      if (settings.playmode === 'gate') {
        // For gate mode, we'll start playback and let the key up handler stop it
        await play(
          sample.audioBuffer,
          {
            inFrame,
            outFrame,
            playbackRate: Math.pow(2, settings.transpose / 12),
            gain: settings.gain,
            pan: settings.pan,
            reverse: settings.reverse,
          }
        );
      } else {
        // For oneshot mode, play the selection normally
        await play(
          sample.audioBuffer,
          {
            inFrame,
            outFrame,
            playbackRate: Math.pow(2, settings.transpose / 12),
            gain: settings.gain,
            pan: settings.pan,
            reverse: settings.reverse,
          }
        );
      }
    } catch (error) {
      console.error('Error playing sample:', error);
    }
  };

  const handleStopSample = () => {
    if (settings.playmode === 'gate') {
      stopCurrentPlayback();
    }
  };

  // Add keyboard handler for 'p' key
  useDrumSampleSettingsKeyboard(isOpen, handlePlaySample, handleStopSample, settings.playmode);

  if (!isOpen) return null;

  // Theme color variables (match multisample modal)
  const c = {
    bg: 'var(--color-bg-primary)',
    bgAlt: 'var(--color-bg-secondary)',
    border: 'var(--color-border-light)',
    borderMedium: 'var(--color-border-medium, var(--color-border-light))',
    text: 'var(--color-text-primary)',
    textSecondary: 'var(--color-text-secondary)',
    action: 'var(--color-interactive-focus)',
    shadow: 'var(--color-shadow-primary, rgba(0,0,0,0.15))',
    white: 'var(--color-white, #fff)'
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        fontFamily: 'inherit',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div 
        className="drum-sample-settings-modal"
        style={{
          background: c.bg,
          borderRadius: '15px',
          boxShadow: `0 2px 8px ${c.shadow}`,
          width: '90%',
          maxWidth: '500px',
          maxHeight: 'calc(100vh - 2rem)',
          minHeight: 'auto',
          overflow: 'hidden',
          border: `1px solid ${c.border}`,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          margin: '0 1rem',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1rem 1rem 0.75rem 1rem',
          borderBottom: `1px solid ${c.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexShrink: 0,
        }}>
          <i className="fas fa-cog" style={{ color: c.textSecondary, fontSize: '1.25rem' }}></i>
          <h3 style={{
            margin: 0,
            fontSize: '1.1rem',
            fontWeight: 500,
            color: c.text,
            textTransform: 'lowercase',
            letterSpacing: 0,
          }}>
            sample options
          </h3>
        </div>
        {/* Body - Make scrollable */}
        <div style={{ 
          padding: '1rem', 
          background: c.bg,
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
          maxHeight: 'calc(100vh - 200px)', // Ensure it doesn't overflow on mobile
          WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
        }}>
          {/* Playmode */}
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <label style={{
              minWidth: '80px',
              margin: 0,
              fontSize: '0.9rem',
              fontWeight: 500,
              color: c.text,
              textTransform: 'lowercase',
            }}>
              playmode
            </label>
            <select
              style={{
                flex: 1,
                minWidth: '180px',
                padding: '0.5rem',
                border: `1px solid ${c.border}`,
                borderRadius: '6px',
                fontSize: '0.9rem',
                color: c.text,
                background: c.bgAlt,
                outline: 'none',
                minHeight: '44px',
              }}
              value={settings.playmode}
              onChange={(e) => setSettings({ ...settings, playmode: e.target.value as any })}
            >
              <option value="oneshot">oneshot - play whole sample</option>
              <option value="group">mute group - choke when another sample plays</option>
              <option value="loop">loop - loop at sample end</option>
              <option value="gate">key - play while held</option>
            </select>
          </div>
          {/* Direction */}
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <label style={{
              minWidth: '80px',
              margin: 0,
              fontSize: '0.9rem',
              fontWeight: 500,
              color: c.text,
              textTransform: 'lowercase',
            }}>
              direction
            </label>
            <button
              type="button"
              style={{
                background: c.textSecondary,
                color: c.white,
                border: 'none',
                minWidth: '90px',
                padding: '0.5rem',
                borderRadius: '6px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                outline: 'none',
                boxShadow: 'none',
                transition: 'background 0.15s',
                minHeight: '44px',
              }}
              onClick={() => setSettings({ ...settings, reverse: !settings.reverse })}
            >
              <i
                className="fa fa-play"
                style={{ transform: settings.reverse ? 'scaleX(-1)' : '', color: c.white }}
              ></i>
              <span style={{ marginLeft: '0.5rem', textTransform: 'lowercase' }}>{settings.reverse ? 'reverse' : 'forward'}</span>
            </button>
          </div>
          {/* Enhanced Waveform Display */}
          {sample?.audioBuffer && (
            <div style={{ 
              position: 'relative', 
              marginBottom: '1rem', 
              padding: '0.5rem',
              width: '100%',
              minHeight: '60px',
              overflow: 'hidden'
            }}>
              <EnhancedWaveformEditor
                audioBuffer={sample.audioBuffer}
                inPoint={getInPointSampleIndex()}
                outPoint={getOutPointSampleIndex()}
                onMarkersChange={(markers: { inPoint: number; outPoint: number }) => {
                  if (sample?.audioBuffer) {
                    setLocalInPoint(sampleIndexToTime(markers.inPoint));
                    setLocalOutPoint(sampleIndexToTime(markers.outPoint));
                  }
                }}
                height={60}
                className="sample-waveform"
                showSnapToZero={false}
                showFrameDisplay={false}
                defaultSnapToZero={true}
              />
              <button
                type="button"
                aria-label="zoom waveform"
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'none',
                  border: 'none',
                  color: c.textSecondary,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  zIndex: 2,
                  padding: 0,
                  lineHeight: 1
                }}
                onClick={() => setShowZoomModal(true)}
              >
                <i className="fa fa-search-plus" />
              </button>
              {state.drumSettings.autoZeroCrossing && (
                <button
                  type="button"
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem 1.25rem',
                    border: 'none',
                    borderRadius: '6px',
                    background: c.action,
                    color: c.white,
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                  onClick={() => dispatch({ type: 'APPLY_ZERO_CROSSING_TO_DRUM_SAMPLE', payload: sampleIndex })}
                >
                  <i className="fas fa-wave-square" style={{ fontSize: '1rem' }}></i>
                  apply zero crossing
                </button>
              )}
              {showZoomModal && (
                <WaveformZoomModal
                  isOpen={showZoomModal}
                  onClose={() => setShowZoomModal(false)}
                  audioBuffer={sample.audioBuffer}
                  initialInPoint={localInPoint !== null ? localInPoint : sample.inPoint || 0}
                  initialOutPoint={localOutPoint !== null ? localOutPoint : sample.outPoint || (sample.audioBuffer.duration || 0)}
                  onSave={(inPoint, outPoint) => {
                    setLocalInPoint(inPoint);
                    setLocalOutPoint(outPoint);
                    setShowZoomModal(false);
                  }}
                  onSaveForAll={handleSaveForAll}
                />
              )}
            </div>
          )}
          {/* Transpose */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: 500,
              color: c.text,
              marginBottom: '0.5rem',
              textTransform: 'lowercase',
            }}>
              transpose: {settings.transpose} semitones
            </div>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', padding: 0, margin: 0 }}>
              <Slider
                id="sample-transpose"
                min={-48}
                max={48}
                step={1}
                value={settings.transpose}
                onChange={({ value }) => setSettings({ ...settings, transpose: value })}
                hideTextInput
                style={{ width: '100%', maxWidth: '100%' }}
                className="full-width-slider"
              />
            </div>
          </div>
          {/* Gain */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: 500,
              color: c.text,
              marginBottom: '0.5rem',
              textTransform: 'lowercase',
            }}>
              gain: {settings.gain} dbfs
            </div>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', padding: 0, margin: 0 }}>
              <Slider
                id="sample-gain"
                min={-30}
                max={20}
                step={1}
                value={settings.gain}
                onChange={({ value }) => setSettings({ ...settings, gain: value })}
                hideTextInput
                style={{ width: '100%', maxWidth: '100%' }}
                className="full-width-slider"
              />
            </div>
          </div>
          {/* Pan */}
          <div>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: 500,
              color: c.text,
              textTransform: 'lowercase',
            }}>
              pan: {settings.pan}
            </div>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', padding: 0, margin: 0 }}>
              <Slider
                id="sample-pan"
                min={-100}
                max={100}
                step={1}
                value={settings.pan}
                onChange={({ value }) => setSettings({ ...settings, pan: value })}
                hideTextInput
                style={{ width: '100%', maxWidth: '100%' }}
                className="full-width-slider"
              />
            </div>
          </div>
        </div>
        {/* Footer/Actions */}
        <div style={{
          padding: '0.75rem 1rem 1rem 1rem',
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'flex-end',
          borderTop: `1px solid ${c.border}`,
          background: c.bg,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}>
          <button
            type="button"
            style={{
              padding: '0.625rem 1rem',
              border: `1px solid ${c.border}`,
              borderRadius: '6px',
              backgroundColor: c.bg,
              color: c.textSecondary,
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              minWidth: '80px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            onClick={handleCancel}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = c.bgAlt;
              e.currentTarget.style.borderColor = c.borderMedium;
              e.currentTarget.style.color = c.text;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = c.bg;
              e.currentTarget.style.borderColor = c.border;
              e.currentTarget.style.color = c.textSecondary;
            }}
          >
            <i className="fas fa-times" style={{ marginRight: '0.25rem' }}></i>
            cancel
          </button>
          <button
            type="button"
            style={{
              padding: '0.625rem 1rem',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: c.text,
              color: c.white,
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              minWidth: '80px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            onMouseDown={() => {
              if (settings.playmode === 'gate') {
                handlePlaySample().catch(error => {
                  console.error('Error playing sample:', error);
                });
              }
            }}
            onMouseUp={() => {
              if (settings.playmode === 'gate') {
                handleStopSample();
              }
            }}
            onClick={() => {
              if (settings.playmode !== 'gate') {
                handlePlaySample().catch(error => {
                  console.error('Error playing sample:', error);
                });
              }
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = c.textSecondary;
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = c.text;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
              // Stop playback if mouse leaves button in gate mode
              if (settings.playmode === 'gate') {
                handleStopSample();
              }
            }}
          >
            <i className="fa fa-play" style={{ marginRight: '0.25rem' }}></i>
            play (P)
          </button>
          <button
            type="button"
            style={{
              padding: '0.625rem 1rem',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: c.action,
              color: c.white,
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              minWidth: '80px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            onClick={handleSave}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = c.text;
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = c.action;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <i className="fa fa-save" style={{ marginRight: '0.25rem' }}></i>
            save
          </button>
        </div>
      </div>
    </div>
  );
}

// Add keyboard event handler for 'p' key
export function useDrumSampleSettingsKeyboard(isOpen: boolean, onPlay: () => void, onStop?: () => void, playmode?: string) {
  const isPHeld = React.useRef(false);
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (playmode === 'gate') {
          if (!isPHeld.current) {
            isPHeld.current = true;
            onPlay();
          }
        } else {
          onPlay();
        }
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (playmode === 'gate' && onStop) {
          isPHeld.current = false;
          onStop();
        }
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    if (playmode === 'gate') {
      document.addEventListener('keyup', handleKeyUp);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (playmode === 'gate') {
        document.removeEventListener('keyup', handleKeyUp);
      }
    };
  }, [isOpen, onPlay, onStop, playmode]);
} 