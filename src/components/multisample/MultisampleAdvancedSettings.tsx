import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Modal, Slider, Select, SelectItem, Toggle } from '@carbon/react';
import { ADSREnvelope } from '../common/ADSREnvelope';

interface MultisampleAdvancedSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MultisampleAdvancedSettings {
  playmode: 'poly' | 'mono' | 'legato';
  loopEnabled: boolean;
  loopOnRelease: boolean;
  transpose: number; // -36 to +36
  velocitySensitivity: number; // 0-100%
  volume: number; // 0-100%
  width: number; // 0-100%
  highpass: number; // 0-100%
  portamentoType: 'linear' | 'exponential';
  portamentoAmount: number; // 0-100%
  tuningRoot: number; // 0-11 (C to B)
  ampEnvelope: {
    attack: number; // 0-32767
    decay: number; // 0-32767
    sustain: number; // 0-32767
    release: number; // 0-32767
  };
  filterEnvelope: {
    attack: number; // 0-32767
    decay: number; // 0-32767
    sustain: number; // 0-32767
    release: number; // 0-32767
  };
}

// Convert percentage to internal value (0-100% -> 0-32767)
const percentToInternal = (percent: number): number => {
  return Math.round((percent / 100) * 32767);
};

// Convert internal value to percentage (0-32767 -> 0-100%)
// const internalToPercent = (internal: number): number => {
//   return Math.round((internal / 32767) * 100);
// };

const defaultSettings: MultisampleAdvancedSettings = {
  playmode: 'poly',
  loopEnabled: true,
  loopOnRelease: true,
  transpose: 0,
      velocitySensitivity: 20,
        volume: 69,
  width: 0,
  highpass: 0,
  portamentoType: 'linear',
  portamentoAmount: 0,
  tuningRoot: 0, // C
  ampEnvelope: {
    attack: 0,
    decay: 0,
    sustain: 32767, // 100%
    release: 0,
  },
  filterEnvelope: {
    attack: 0,
    decay: 0,
    sustain: 32767, // 100%
    release: 0,
  },
};

export function MultisampleAdvancedSettings({ isOpen, onClose }: MultisampleAdvancedSettingsProps) {
  const { state, dispatch } = useAppContext();
  const [settings, setSettings] = useState<MultisampleAdvancedSettings>({
    ...defaultSettings,
    loopEnabled: state.multisampleSettings.loopEnabled,
    loopOnRelease: state.multisampleSettings.loopOnRelease
  });

  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const handleSave = () => {
    // Save loop settings to global context
    dispatch({ type: 'SET_MULTISAMPLE_LOOP_ENABLED', payload: settings.loopEnabled });
    dispatch({ type: 'SET_MULTISAMPLE_LOOP_ON_RELEASE', payload: settings.loopOnRelease });
    
    // Store other settings in the imported preset which gets used during patch generation
    dispatch({
      type: 'SET_IMPORTED_MULTISAMPLE_PRESET',
      payload: {
        engine: {
          playmode: settings.playmode,
          transpose: settings.transpose,
          'velocity.sensitivity': percentToInternal(settings.velocitySensitivity),
          volume: percentToInternal(settings.volume),
          width: percentToInternal(settings.width),
          highpass: percentToInternal(settings.highpass),
          'portamento.amount': percentToInternal(settings.portamentoAmount),
          'portamento.type': settings.portamentoType === 'linear' ? 32767 : 0,
          'tuning.root': settings.tuningRoot,
        },
        envelope: {
          amp: {
            attack: settings.ampEnvelope.attack,
            decay: settings.ampEnvelope.decay,
            sustain: settings.ampEnvelope.sustain,
            release: settings.ampEnvelope.release,
          },
          filter: {
            attack: settings.filterEnvelope.attack,
            decay: settings.filterEnvelope.decay,
            sustain: settings.filterEnvelope.sustain,
            release: settings.filterEnvelope.release,
          },
        },
        regions: [] // Will be populated during patch generation
      }
    });

    // Show success notification
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        id: Date.now().toString(),
        type: 'success',
        title: 'Settings Saved',
        message: 'Advanced multisample settings have been saved'
      }
    });

    onClose();
  };

  const handleReset = () => {
    setSettings(defaultSettings);
  };

  const updateSetting = <K extends keyof MultisampleAdvancedSettings>(
    key: K,
    value: MultisampleAdvancedSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateAmpEnvelope = (envelope: MultisampleAdvancedSettings['ampEnvelope']) => {
    setSettings(prev => ({ ...prev, ampEnvelope: envelope }));
  };

  const updateFilterEnvelope = (envelope: MultisampleAdvancedSettings['filterEnvelope']) => {
    setSettings(prev => ({ ...prev, filterEnvelope: envelope }));
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        open={isOpen}
        onRequestClose={onClose}
        modalHeading="Advanced Multisample Settings"
        primaryButtonText="Save Settings"
        secondaryButtonText="Reset to Defaults"
        onRequestSubmit={handleSave}
        onSecondarySubmit={handleReset}
        size="lg"
      >
        <div style={{ 
          display: 'grid', 
          gap: '2rem',
          maxHeight: '70vh',
          overflowY: 'auto',
          padding: '1rem 0'
        }}>
          
          {/* Playback Settings */}
          <section>
            <h4 style={{ 
              marginBottom: '1rem', 
              color: 'var(--color-text-primary)',
              fontWeight: '500',
              borderBottom: '1px solid var(--color-border-subtle)',
              paddingBottom: '0.5rem'
            }}>
              Playback
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Play Mode
                </label>
                <Select
                  id="playmode"
                  value={settings.playmode}
                  onChange={(e) => updateSetting('playmode', e.target.value as any)}
                >
                  <SelectItem value="poly" text="Polyphonic" />
                  <SelectItem value="mono" text="Monophonic" />
                  <SelectItem value="legato" text="Legato" />
                </Select>
              </div>

              <div>
                <Toggle
                  id="advanced-loop-enabled"
                  labelText="Loop Enabled"
                  toggled={settings.loopEnabled}
                  onToggle={(checked) => updateSetting('loopEnabled', checked)}
                />
                <style>{`
                  #advanced-loop-enabled .cds--toggle-input__appearance {
                    background-color: var(--color-surface-secondary) !important;
                  }
                  #advanced-loop-enabled .cds--toggle-input__appearance:before {
                    background-color: var(--color-text-secondary) !important;
                  }
                  #advanced-loop-enabled .cds--toggle-input:checked + .cds--toggle-input__appearance {
                    background-color: var(--color-interactive-primary) !important;
                  }
                  #advanced-loop-enabled .cds--toggle-input:checked + .cds--toggle-input__appearance:before {
                    background-color: var(--color-surface-primary) !important;
                  }
                  #advanced-loop-enabled .cds--toggle__text--off,
                  #advanced-loop-enabled .cds--toggle__text--on {
                    color: var(--color-text-secondary) !important;
                  }
                `}</style>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <Toggle
                  id="advanced-loop-onrelease"
                  labelText="Loop On Release"
                  toggled={settings.loopOnRelease}
                  onToggle={(checked) => updateSetting('loopOnRelease', checked)}
                />
                <style>{`
                  #advanced-loop-onrelease .cds--toggle-input__appearance {
                    background-color: var(--color-surface-secondary) !important;
                  }
                  #advanced-loop-onrelease .cds--toggle-input__appearance:before {
                    background-color: var(--color-text-secondary) !important;
                  }
                  #advanced-loop-onrelease .cds--toggle-input:checked + .cds--toggle-input__appearance {
                    background-color: var(--color-interactive-primary) !important;
                  }
                  #advanced-loop-onrelease .cds--toggle-input:checked + .cds--toggle-input__appearance:before {
                    background-color: var(--color-surface-primary) !important;
                  }
                  #advanced-loop-onrelease .cds--toggle__text--off,
                  #advanced-loop-onrelease .cds--toggle__text--on {
                    color: var(--color-text-secondary) !important;
                  }
                `}</style>
              </div>
            </div>
          </section>

          {/* Global Parameters */}
          <section>
            <h4 style={{ 
              marginBottom: '1rem', 
              color: '#222',
              fontWeight: '500',
              borderBottom: '1px solid #e0e0e0',
              paddingBottom: '0.5rem'
            }}>
              Global Parameters
            </h4>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  color: 'var(--color-text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  transpose: {settings.transpose > 0 ? '+' : ''}{settings.transpose}
                </div>
                <Slider
                  id="advanced-transpose"
                  min={-36}
                  max={36}
                  step={1}
                  value={settings.transpose}
                  onChange={({ value }) => updateSetting('transpose', value)}
                  hideTextInput
                />
              </div>

              <div>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  color: '#222',
                  marginBottom: '0.5rem'
                }}>
                  velocity sensitivity: {settings.velocitySensitivity}%
                </div>
                <Slider
                  id="advanced-velocity-sensitivity"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.velocitySensitivity}
                  onChange={({ value }) => updateSetting('velocitySensitivity', value)}
                  hideTextInput
                />
              </div>

              <div>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  color: '#222',
                  marginBottom: '0.5rem'
                }}>
                  volume: {settings.volume}%
                </div>
                <Slider
                  id="advanced-volume"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.volume}
                  onChange={({ value }) => updateSetting('volume', value)}
                  hideTextInput
                />
              </div>

              <div>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  color: '#222',
                  marginBottom: '0.5rem'
                }}>
                  width: {settings.width}%
                </div>
                <Slider
                  id="advanced-width"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.width}
                  onChange={({ value }) => updateSetting('width', value)}
                  hideTextInput
                />
              </div>

              <div>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  color: '#222',
                  marginBottom: '0.5rem'
                }}>
                  highpass filter: {settings.highpass}%
                </div>
                <Slider
                  id="advanced-highpass"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.highpass}
                  onChange={({ value }) => updateSetting('highpass', value)}
                  hideTextInput
                />
              </div>
            </div>
          </section>

          {/* Portamento */}
          <section>
            <h4 style={{ 
              marginBottom: '1rem', 
              color: '#222',
              fontWeight: '500',
              borderBottom: '1px solid #e0e0e0',
              paddingBottom: '0.5rem'
            }}>
              Portamento
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Type
                </label>
                <Select
                  id="portamento-type"
                  value={settings.portamentoType}
                  onChange={(e) => updateSetting('portamentoType', e.target.value as any)}
                >
                  <SelectItem value="linear" text="Linear" />
                  <SelectItem value="exponential" text="Exponential" />
                </Select>
              </div>

              <div>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  color: '#222',
                  marginBottom: '0.5rem'
                }}>
                  amount: {settings.portamentoAmount}%
                </div>
                <Slider
                  id="advanced-portamento-amount"
                  min={0}
                  max={100}
                  step={1}
                  value={settings.portamentoAmount}
                  onChange={({ value }) => updateSetting('portamentoAmount', value)}
                  hideTextInput
                />
              </div>
            </div>
          </section>

          {/* Tuning */}
          <section>
            <h4 style={{ 
              marginBottom: '1rem', 
              color: '#222',
              fontWeight: '500',
              borderBottom: '1px solid #e0e0e0',
              paddingBottom: '0.5rem'
            }}>
              Tuning
            </h4>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Root Note
              </label>
              <Select
                id="tuning-root"
                value={settings.tuningRoot.toString()}
                onChange={(e) => updateSetting('tuningRoot', parseInt(e.target.value))}
              >
                {noteNames.map((note, index) => (
                  <SelectItem key={index} value={index.toString()} text={note} />
                ))}
              </Select>
            </div>
          </section>

          {/* ADSR Envelopes */}
          <section>
            <ADSREnvelope
              ampEnvelope={settings.ampEnvelope}
              filterEnvelope={settings.filterEnvelope}
              onAmpEnvelopeChange={updateAmpEnvelope}
              onFilterEnvelopeChange={updateFilterEnvelope}
              width={650}
              height={280}
            />
          </section>
        </div>
      </Modal>

      {/* Slider Styling */}
      <style>{`
        #advanced-transpose .cds--slider__track,
        #advanced-velocity-sensitivity .cds--slider__track,
        #advanced-volume .cds--slider__track,
        #advanced-width .cds--slider__track,
        #advanced-highpass .cds--slider__track,
        #advanced-portamento-amount .cds--slider__track {
          background: linear-gradient(to right, var(--color-surface-secondary) 0%, var(--color-text-secondary) 100%) !important;
        }
        #advanced-transpose .cds--slider__filled-track,
        #advanced-velocity-sensitivity .cds--slider__filled-track,
        #advanced-volume .cds--slider__filled-track,
        #advanced-width .cds--slider__filled-track,
        #advanced-highpass .cds--slider__filled-track,
        #advanced-portamento-amount .cds--slider__filled-track {
          background: var(--color-interactive-primary) !important;
        }
        #advanced-transpose .cds--slider__thumb,
        #advanced-velocity-sensitivity .cds--slider__thumb,
        #advanced-volume .cds--slider__thumb,
        #advanced-width .cds--slider__thumb,
        #advanced-highpass .cds--slider__thumb,
        #advanced-portamento-amount .cds--slider__thumb {
          background: var(--color-interactive-primary) !important;
          border: 2px solid var(--color-interactive-primary) !important;
        }
        #advanced-transpose .cds--slider__thumb:hover,
        #advanced-velocity-sensitivity .cds--slider__thumb:hover,
        #advanced-volume .cds--slider__thumb:hover,
        #advanced-width .cds--slider__thumb:hover,
        #advanced-highpass .cds--slider__thumb:hover,
        #advanced-portamento-amount .cds--slider__thumb:hover {
          background: var(--color-interactive-hover) !important;
          border-color: var(--color-interactive-hover) !important;
        }
      `}</style>
    </>
  );
}