import { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { audioContextManager } from '../../utils/audioContext';
import { WaveformEditor } from '../common/WaveformEditor';
import { Slider } from '@carbon/react';

interface DrumSampleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sampleIndex: number;
}

interface SampleSettings {
  playmode: 'oneshot' | 'group' | 'loop' | 'gate';
  reverse: boolean;
  tune: number; // -48 to +48 semitones
  gain: number; // -30 to +20 dB
  pan: number; // -100 to +100
}

export function DrumSampleSettingsModal({ isOpen, onClose, sampleIndex }: DrumSampleSettingsModalProps) {
  const { state, dispatch } = useAppContext();
  const sample = state.drumSamples[sampleIndex];
  
  const [settings, setSettings] = useState<SampleSettings>({
    playmode: 'oneshot',
    reverse: false,
    tune: 0,
    gain: 0,
    pan: 0
  });

  // Initialize settings from sample data when modal opens
  useEffect(() => {
    if (isOpen && sample?.isLoaded) {
      setSettings({
        playmode: sample.playmode || 'oneshot',
        reverse: sample.reverse || false,
        tune: sample.tune || 0,
        gain: sample.gain || 0,
        pan: sample.pan || 0
      });

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

  // Convert time values to sample indices for WaveformEditor
  const getInPointSampleIndex = () => {
    if (!sample?.audioBuffer) return 0;
    return Math.floor((sample.inPoint || 0) * sample.audioBuffer.sampleRate);
  };

  const getOutPointSampleIndex = () => {
    if (!sample?.audioBuffer) return 0;
    return Math.floor((sample.outPoint || sample.audioBuffer.duration) * sample.audioBuffer.sampleRate);
  };

  // Convert sample indices back to time values
  const sampleIndexToTime = (sampleIndex: number) => {
    if (!sample?.audioBuffer) return 0;
    return sampleIndex / sample.audioBuffer.sampleRate;
  };

  // Convert time values to percentages for UI display
  const getInPointPercentage = () => {
    if (!sample?.audioBuffer) return 0;
    return Math.round((sample.inPoint || 0) / sample.audioBuffer.duration * 100);
  };

  const getOutPointPercentage = () => {
    if (!sample?.audioBuffer) return 0;
    return Math.round((sample.outPoint || sample.audioBuffer.duration) / sample.audioBuffer.duration * 100);
  };

  const handleSave = () => {
    if (sample?.isLoaded) {
      // Check if any values actually changed
      const originalValues = {
        playmode: sample.playmode || 'oneshot',
        reverse: sample.reverse || false,
        tune: sample.tune || 0,
        gain: sample.gain || 0,
        pan: sample.pan || 0
      };
      
      const valuesChanged = 
        settings.playmode !== originalValues.playmode ||
        settings.reverse !== originalValues.reverse ||
        settings.tune !== originalValues.tune ||
        settings.gain !== originalValues.gain ||
        settings.pan !== originalValues.pan;
      
      dispatch({
        type: 'UPDATE_DRUM_SAMPLE',
        payload: {
          index: sampleIndex,
          updates: {
            ...settings,
            hasBeenEdited: sample.hasBeenEdited || valuesChanged
          }
        }
      });
    }
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handlePlaySample = async () => {
    if (!sample?.audioBuffer) return;

    try {
      const audioContext = await audioContextManager.getAudioContext();
      let buffer = sample.audioBuffer;

      // Apply reverse if enabled
      if (settings.reverse) {
        const revBuffer = audioContext.createBuffer(
          buffer.numberOfChannels,
          buffer.length,
          buffer.sampleRate
        );
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
          const srcData = buffer.getChannelData(ch);
          const dstData = revBuffer.getChannelData(ch);
          for (let i = 0, j = srcData.length - 1; i < srcData.length; i++, j--) {
            dstData[i] = srcData[j];
          }
        }
        buffer = revBuffer;
      }

      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      const panNode = audioContext.createStereoPanner();

      source.buffer = buffer;
      source.playbackRate.value = Math.pow(2, settings.tune / 12); // Semitone tuning
      gainNode.gain.value = Math.pow(10, settings.gain / 20); // Convert dB to linear gain
      panNode.pan.value = Math.max(-1, Math.min(1, settings.pan / 100)); // Convert pan range

      source.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(audioContext.destination);
      source.start(0);
    } catch (error) {
      console.error('Error playing sample:', error);
    }
  };

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
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        fontFamily: 'inherit',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div style={{
        background: c.bg,
        borderRadius: '15px',
        boxShadow: `0 2px 8px ${c.shadow}`,
        width: '95%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'auto',
        border: `1px solid ${c.border}`,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem 1rem 1.5rem',
          borderBottom: `1px solid ${c.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
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
        {/* Body */}
        <div style={{ padding: '1.5rem', background: c.bg }}>
          {/* Playmode */}
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
            <label style={{
              minWidth: '90px',
              margin: 0,
              marginRight: '0.5rem',
              fontSize: '0.9rem',
              fontWeight: 500,
              color: c.text,
              textTransform: 'lowercase',
            }}>
              playmode
            </label>
            <select
              style={{
                width: 'auto',
                display: 'inline-block',
                maxWidth: '350px',
                padding: '0.25rem 0.5rem',
                border: `1px solid ${c.border}`,
                borderRadius: '6px',
                fontSize: '0.9rem',
                color: c.text,
                background: c.bgAlt,
                outline: 'none',
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
          {/* Playback Direction */}
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
            <label style={{
              minWidth: '90px',
              margin: 0,
              marginRight: '0.5rem',
              fontSize: '0.9rem',
              fontWeight: 500,
              color: c.text,
              textTransform: 'lowercase',
            }}>
              playback direction
            </label>
            <button
              type="button"
              style={{
                background: c.textSecondary,
                color: c.white,
                border: 'none',
                minWidth: '90px',
                padding: '0.25rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                outline: 'none',
                boxShadow: 'none',
                transition: 'background 0.15s',
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
          {/* Waveform Display */}
          {sample?.audioBuffer && (
            <div style={{ marginBottom: '1.5rem', background: c.bgAlt, borderRadius: '6px', padding: '0.5rem' }}>
              <WaveformEditor
                audioBuffer={sample.audioBuffer}
                inPoint={getInPointSampleIndex()}
                outPoint={getOutPointSampleIndex()}
                onMarkersChange={(markers: { inPoint: number; outPoint: number; loopStart?: number; loopEnd?: number }) => {
                  if (sample?.audioBuffer) {
                    dispatch({
                      type: 'UPDATE_DRUM_SAMPLE',
                      payload: {
                        index: sampleIndex,
                        updates: {
                          inPoint: sampleIndexToTime(markers.inPoint),
                          outPoint: sampleIndexToTime(markers.outPoint),
                          hasBeenEdited: true,
                        },
                      },
                    });
                  }
                }}
                height={80}
                className="sample-waveform"
              />
              {/* Marker Position Display */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginTop: '0.5rem',
                fontSize: '0.75rem',
                color: c.textSecondary
              }}>
                <span>start: {getInPointPercentage()}%</span>
                <span>end: {getOutPointPercentage()}%</span>
              </div>
            </div>
          )}
          {/* Tuning */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: 500,
              color: c.text,
              marginBottom: '0.5rem',
              textTransform: 'lowercase',
            }}>
              tuning: {settings.tune} semitones
            </div>
            <div style={{ width: '100%' }}>
              <Slider
                id="sample-tuning"
                min={-48}
                max={48}
                step={1}
                value={settings.tune}
                onChange={({ value }) => setSettings({ ...settings, tune: value })}
                hideTextInput
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
              gain: {settings.gain} db
            </div>
            <div style={{ width: '100%' }}>
              <Slider
                id="sample-gain"
                min={-30}
                max={20}
                step={1}
                value={settings.gain}
                onChange={({ value }) => setSettings({ ...settings, gain: value })}
                hideTextInput
              />
            </div>
          </div>
          {/* Pan */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: 500,
              color: c.text,
              marginBottom: '0.5rem',
              textTransform: 'lowercase',
            }}>
              pan: {settings.pan}
            </div>
            <div style={{ width: '100%' }}>
              <Slider
                id="sample-pan"
                min={-100}
                max={100}
                step={1}
                value={settings.pan}
                onChange={({ value }) => setSettings({ ...settings, pan: value })}
                hideTextInput
              />
            </div>
          </div>
        </div>
        {/* Footer/Actions */}
        <div style={{
          padding: '1rem 1.5rem 1.5rem 1.5rem',
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'flex-end',
          borderTop: `1px solid ${c.border}`,
          background: c.bg,
        }}>
          <button
            type="button"
            style={{
              padding: '0.625rem 1.25rem',
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
              padding: '0.625rem 1.25rem',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: c.text,
              color: c.white,
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              minWidth: '80px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
            onClick={() => handlePlaySample().catch(error => {
              console.error('Error playing sample:', error);
            })}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = c.textSecondary;
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = c.text;
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <i className="fa fa-play" style={{ marginRight: '0.25rem' }}></i>
            play
          </button>
          <button
            type="button"
            style={{
              padding: '0.625rem 1.25rem',
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
export function useDrumSampleSettingsKeyboard(isOpen: boolean, onPlay: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        onPlay();
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, onPlay]);
} 