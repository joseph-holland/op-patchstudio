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

  return (
    <div 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        fontFamily: '"Montserrat", "Arial", sans-serif'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCancel();
        }
      }}
    >
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{
          padding: '1.5rem 1.5rem 1rem 1.5rem',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <h3 style={{
            margin: '0',
            fontSize: '1.25rem',
            fontWeight: '300',
            color: '#222',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <i className="fas fa-cog" style={{
              color: '#222',
              fontSize: '1.25rem'
            }}></i>
            sample options
          </h3>
        </div>
        <div style={{ padding: '1.5rem' }}>


          {/* Playmode */}
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
            <label style={{ 
              minWidth: '90px', 
              margin: 0, 
              marginRight: '0.5rem',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}>
              playmode
            </label>
            <select 
              style={{ 
                width: 'auto', 
                display: 'inline-block', 
                maxWidth: '350px',
                padding: '0.25rem 0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9rem'
              }}
              value={settings.playmode}
              onChange={(e) => setSettings({...settings, playmode: e.target.value as any})}
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
              fontWeight: '500'
            }}>
              playback direction
            </label>
            <button 
              type="button" 
              style={{ 
                background: '#444', 
                color: '#fff', 
                border: 'none', 
                minWidth: '90px',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              onClick={() => setSettings({...settings, reverse: !settings.reverse})}
            >
              <i 
                className="fa fa-play" 
                style={{ transform: settings.reverse ? 'scaleX(-1)' : '' }}
              ></i>
              <span style={{ marginLeft: '0.5rem' }}>{settings.reverse ? 'reverse' : 'forward'}</span>
            </button>
          </div>

          {/* Waveform Display */}
          {sample?.audioBuffer && (
            <div style={{ marginBottom: '1rem' }}>
              <WaveformEditor
                audioBuffer={sample.audioBuffer}
                inPoint={sample.inPoint || 0}
                outPoint={sample.outPoint || sample.audioBuffer.duration}
                onMarkersChange={(markers: { inPoint: number; outPoint: number; loopStart?: number; loopEnd?: number }) => {
                  dispatch({
                    type: 'UPDATE_DRUM_SAMPLE',
                    payload: {
                      index: sampleIndex,
                      updates: {
                        inPoint: markers.inPoint,
                        outPoint: markers.outPoint,
                        hasBeenEdited: true
                      }
                    }
                  });
                }}
                height={80}
                className="sample-waveform"
              />
            </div>
          )}

          {/* Tuning */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: '500',
              color: 'var(--color-text-primary)',
              marginBottom: '0.5rem'
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
                onChange={({ value }) => setSettings({...settings, tune: value})}
                hideTextInput
              />
            </div>
          </div>

          {/* Gain */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: '500',
              color: 'var(--color-text-primary)',
              marginBottom: '0.5rem'
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
                onChange={({ value }) => setSettings({...settings, gain: value})}
                hideTextInput
              />
            </div>
          </div>

          {/* Pan */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              fontSize: '0.9rem',
              fontWeight: '500',
              color: 'var(--color-text-primary)',
              marginBottom: '0.5rem'
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
                onChange={({ value }) => setSettings({...settings, pan: value})}
                hideTextInput
              />
            </div>
          </div>
        </div>

        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.5rem'
        }}>
          <button 
            type="button" 
            style={{ 
              background: '#888', 
              color: '#fff', 
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            onClick={handleCancel}
          >
            <i className="fas fa-times" style={{ marginRight: '0.25rem' }}></i>
            cancel
          </button>
          <button 
            type="button" 
            style={{ 
              background: '#222', 
              color: '#fff', 
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            onClick={() => handlePlaySample().catch(error => {
              console.error('Error playing sample:', error);
            })}
          >
            <i className="fa fa-play" style={{ marginRight: '0.25rem' }}></i>
            play
          </button>
          <button 
            type="button" 
            style={{ 
              background: '#000', 
              color: '#fff', 
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            onClick={handleSave}
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