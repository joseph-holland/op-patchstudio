import { useRef, useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Select, SelectItem, Slider, Toggle } from '@carbon/react';
import { importPresetFromFile, type MultisamplePresetJson } from '../../utils/presetImport';
import { ADSREnvelope } from '../common/ADSREnvelope';

interface MultisampleAdvancedSettings {
  playmode: 'poly' | 'mono' | 'legato';
  loopEnabled: boolean;
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

const defaultSettings: MultisampleAdvancedSettings = {
  playmode: 'poly',
  loopEnabled: true,
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

export function MultisamplePresetSettings() {
  const { dispatch } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [settings, setSettings] = useState<MultisampleAdvancedSettings>(defaultSettings);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be selected again
    event.target.value = '';

    try {
      const result = await importPresetFromFile(file, 'multisampler');
      
      if (result.success && result.data) {
        const importedPreset = result.data as MultisamplePresetJson;
        
        // Store the complete imported preset for patch generation
        dispatch({ type: 'SET_IMPORTED_MULTISAMPLE_PRESET', payload: importedPreset });
        
        // Show success notification
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            id: Date.now().toString(),
            type: 'success',
            title: 'settings imported',
            message: 'successfully imported multisample preset settings'
          }
        });
      } else {
        // Show error notification
        dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
            id: Date.now().toString(),
            type: 'error',
            title: 'import failed',
            message: result.error || 'failed to import preset'
          }
        });
      }
    } catch (error) {
      // Show error notification for unexpected errors
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          id: Date.now().toString(),
          type: 'error',
          title: 'import error',
          message: `unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
    }
  };

  const handleSave = () => {
    // Store advanced settings in the imported preset which gets used during patch generation
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

  // Check if any settings have changed from defaults
  const hasPresetChanges = (
    settings.playmode !== defaultSettings.playmode ||
    settings.loopEnabled !== defaultSettings.loopEnabled ||
    settings.transpose !== defaultSettings.transpose ||
    settings.velocitySensitivity !== defaultSettings.velocitySensitivity ||
    settings.volume !== defaultSettings.volume ||
    settings.width !== defaultSettings.width ||
    settings.highpass !== defaultSettings.highpass ||
    settings.portamentoType !== defaultSettings.portamentoType ||
    settings.portamentoAmount !== defaultSettings.portamentoAmount ||
    settings.tuningRoot !== defaultSettings.tuningRoot ||
    settings.ampEnvelope.attack !== defaultSettings.ampEnvelope.attack ||
    settings.ampEnvelope.decay !== defaultSettings.ampEnvelope.decay ||
    settings.ampEnvelope.sustain !== defaultSettings.ampEnvelope.sustain ||
    settings.ampEnvelope.release !== defaultSettings.ampEnvelope.release ||
    settings.filterEnvelope.attack !== defaultSettings.filterEnvelope.attack ||
    settings.filterEnvelope.decay !== defaultSettings.filterEnvelope.decay ||
    settings.filterEnvelope.sustain !== defaultSettings.filterEnvelope.sustain ||
    settings.filterEnvelope.release !== defaultSettings.filterEnvelope.release
  );

  return (
    <>
      <div style={{
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid var(--color-border-notification)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: isMobile ? '1rem' : '0',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ 
            margin: '0',
            color: 'var(--color-text-primary)',
            fontSize: '1.25rem',
            fontWeight: '300'
          }}>
            preset settings
          </h3>
          
          <div style={{ 
            display: 'flex', 
            gap: '0.75rem',
            alignSelf: isMobile ? 'center' : 'auto'
          }}>
            <button
              onClick={handleReset}
              disabled={!hasPresetChanges}
              style={{
                padding: '0.625rem 1.25rem',
                border: '1px solid var(--color-interactive-focus-ring)',
                borderRadius: '3px',
                backgroundColor: 'var(--color-bg-primary)',
                color: hasPresetChanges ? 'var(--color-interactive-secondary)' : 'var(--color-border-medium)',
                fontSize: '0.9rem',
                fontWeight: '500',
                cursor: hasPresetChanges ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                flex: isMobile ? '1' : 'none',
                opacity: hasPresetChanges ? 1 : 0.6
              }}
              onMouseEnter={(e) => {
                if (hasPresetChanges) {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                  e.currentTarget.style.borderColor = 'var(--color-border-medium)';
                  e.currentTarget.style.color = 'var(--color-interactive-dark)';
                }
              }}
              onMouseLeave={(e) => {
                if (hasPresetChanges) {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                  e.currentTarget.style.borderColor = 'var(--color-interactive-focus-ring)';
                  e.currentTarget.style.color = 'var(--color-interactive-secondary)';
                }
              }}
            >
              <i className="fas fa-undo" style={{ fontSize: '0.8rem' }} />
              reset settings
            </button>

            <button
              onClick={handleImportClick}
              style={{
                padding: '0.625rem 1.25rem',
                border: 'none',
                borderRadius: '3px',
                backgroundColor: 'var(--color-interactive-focus)',
                color: 'var(--color-white)',
                fontSize: '0.9rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                flex: isMobile ? '1' : 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-interactive-dark)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-interactive-focus)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <i className="fas fa-upload" style={{ fontSize: '0.8rem' }} />
              import settings
            </button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileImport}
            style={{ display: 'none' }}
          />
        </div>

        {/* Settings Grid */}
        <div style={{ display: 'grid', gap: '2rem' }}>
          
          {/* Playback Settings */}
          <section>
            <h4 style={{ 
              marginBottom: '1rem', 
              color: 'var(--color-text-primary)',
              fontWeight: '500',
              borderBottom: '1px solid var(--color-progress-track)',
              paddingBottom: '0.5rem'
            }}>
              playback
            </h4>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', 
              gap: isMobile ? '1.5rem' : '3rem' 
            }}>
              <div>
                <label style={{ 
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  color: 'var(--color-text-primary)'
                }}>
                  playmode
                </label>
                <div style={{ maxWidth: '150px' }}>
                  <Select
                    id="playmode"
                    labelText=""
                    value={settings.playmode}
                    onChange={(e) => updateSetting('playmode', e.target.value as any)}
                    size="sm"
                  >
                    <SelectItem value="poly" text="poly" />
                    <SelectItem value="mono" text="mono" />
                    <SelectItem value="legato" text="legato" />
                  </Select>
                </div>
              </div>

              <div>
                <label style={{ 
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  color: 'var(--color-text-primary)'
                }}>
                  loop enabled
                </label>
                <Toggle
                  id="multisample-loop-enabled"
                  labelA="off"
                  labelB="on"
                  toggled={settings.loopEnabled}
                  onToggle={(checked) => updateSetting('loopEnabled', checked)}
                  size="sm"
                />
              </div>
            </div>
          </section>

          {/* Sound Settings */}
          <section>
            <h4 style={{ 
              marginBottom: '1rem', 
              color: 'var(--color-text-primary)',
              fontWeight: '500',
              borderBottom: '1px solid var(--color-progress-track)',
              paddingBottom: '0.5rem'
            }}>
              sound
            </h4>
            
            <div className="drum-preset-grid">
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    color: 'var(--color-text-primary)'
                  }}>
                    tuning root
                  </label>
                  <div style={{ maxWidth: '150px' }}>
                    <Select
                      id="tuning-root"
                      labelText=""
                      value={settings.tuningRoot.toString()}
                      onChange={(e) => updateSetting('tuningRoot', parseInt(e.target.value))}
                      size="sm"
                    >
                      {noteNames.map((note, index) => (
                        <SelectItem key={index} value={index.toString()} text={note} />
                      ))}
                    </Select>
                  </div>
                </div>

                <div>
                  <div style={{
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    color: 'var(--color-text-primary)',
                    marginBottom: '0.5rem'
                  }}>
                    velocity sensitivity: {settings.velocitySensitivity}%
                  </div>
                  <div style={{ width: '100%' }}>
                    <Slider
                      id="multisample-velocity-sensitivity"
                      min={0}
                      max={100}
                      step={1}
                      value={settings.velocitySensitivity}
                      onChange={({ value }) => updateSetting('velocitySensitivity', value)}
                      hideTextInput
                    />
                  </div>
                </div>

                <div>
                  <div style={{
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    color: 'var(--color-text-primary)',
                    marginBottom: '0.5rem'
                  }}>
                    volume: {settings.volume}%
                  </div>
                  <div style={{ width: '100%' }}>
                    <Slider
                      id="multisample-volume"
                      min={0}
                      max={100}
                      step={1}
                      value={settings.volume}
                      onChange={({ value }) => updateSetting('volume', value)}
                      hideTextInput
                    />
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <div style={{
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    color: 'var(--color-text-primary)',
                    marginBottom: '0.5rem'
                  }}>
                    transpose: {settings.transpose}
                  </div>
                  <div style={{ width: '100%' }}>
                    <Slider
                      id="multisample-transpose"
                      min={-36}
                      max={36}
                      step={1}
                      value={settings.transpose}
                      onChange={({ value }) => updateSetting('transpose', value)}
                      hideTextInput
                    />
                  </div>
                </div>

                <div>
                  <div style={{
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    color: 'var(--color-text-primary)',
                    marginBottom: '0.5rem'
                  }}>
                    width: {settings.width}%
                  </div>
                  <div style={{ width: '100%' }}>
                    <Slider
                      id="multisample-width"
                      min={0}
                      max={100}
                      step={1}
                      value={settings.width}
                      onChange={({ value }) => updateSetting('width', value)}
                      hideTextInput
                    />
                  </div>
                </div>

                <div>
                  <div style={{
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    color: 'var(--color-text-primary)',
                    marginBottom: '0.5rem'
                  }}>
                    highpass: {settings.highpass}%
                  </div>
                  <div style={{ width: '100%' }}>
                    <Slider
                      id="multisample-highpass"
                      min={0}
                      max={100}
                      step={1}
                      value={settings.highpass}
                      onChange={({ value }) => updateSetting('highpass', value)}
                      hideTextInput
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Portamento */}
          <section>
            <h4 style={{ 
              marginBottom: '1rem', 
              color: 'var(--color-text-primary)',
              fontWeight: '500',
              borderBottom: '1px solid var(--color-progress-track)',
              paddingBottom: '0.5rem'
            }}>
              portamento
            </h4>
            
            <div className="drum-preset-grid">
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  color: 'var(--color-text-primary)'
                }}>
                  type
                </label>
                <div style={{ maxWidth: '150px' }}>
                  <Select
                    id="portamento-type"
                    labelText=""
                    value={settings.portamentoType}
                    onChange={(e) => updateSetting('portamentoType', e.target.value as any)}
                    size="sm"
                  >
                    <SelectItem value="linear" text="linear" />
                    <SelectItem value="exponential" text="exponential" />
                  </Select>
                </div>
              </div>

              <div>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  color: 'var(--color-text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  amount: {settings.portamentoAmount}%
                </div>
                                  <div style={{ width: '100%' }}>
                    <Slider
                      id="multisample-portamento-amount"
                      min={0}
                      max={100}
                      step={1}
                      value={settings.portamentoAmount}
                      onChange={({ value }) => updateSetting('portamentoAmount', value)}
                      hideTextInput
                    />
                  </div>
              </div>
            </div>
          </section>

          {/* Envelopes */}
          <section>
            <h4 style={{ 
              marginBottom: '1rem', 
              color: 'var(--color-text-primary)',
              fontWeight: '500',
              borderBottom: '1px solid var(--color-progress-track)',
              paddingBottom: '0.5rem'
            }}>
              envelopes and filters
            </h4>
            
            <ADSREnvelope
              ampEnvelope={settings.ampEnvelope}
              filterEnvelope={settings.filterEnvelope}
              onAmpEnvelopeChange={updateAmpEnvelope}
              onFilterEnvelopeChange={updateFilterEnvelope}
            />
          </section>
        </div>
      </div>

      {/* Slider Styling */}
      <style>{`
        #multisample-transpose .cds--slider__track,
        #multisample-velocity-sensitivity .cds--slider__track,
        #multisample-volume .cds--slider__track,
        #multisample-width .cds--slider__track,
        #multisample-highpass .cds--slider__track,
        #multisample-portamento-amount .cds--slider__track {
          background: linear-gradient(to right, var(--color-bg-slider-track) 0%, var(--color-interactive-secondary) 100%) !important;
        }
        #multisample-transpose .cds--slider__filled-track,
        #multisample-velocity-sensitivity .cds--slider__filled-track,
        #multisample-volume .cds--slider__filled-track,
        #multisample-width .cds--slider__filled-track,
        #multisample-highpass .cds--slider__filled-track,
        #multisample-portamento-amount .cds--slider__filled-track {
          background: var(--color-interactive-dark) !important;
        }
        #multisample-transpose .cds--slider__thumb,
        #multisample-velocity-sensitivity .cds--slider__thumb,
        #multisample-volume .cds--slider__thumb,
        #multisample-width .cds--slider__thumb,
        #multisample-highpass .cds--slider__thumb,
        #multisample-portamento-amount .cds--slider__thumb {
          background: var(--color-interactive-dark) !important;
          border: 2px solid var(--color-interactive-dark) !important;
        }
        #multisample-transpose .cds--slider__thumb:hover,
        #multisample-velocity-sensitivity .cds--slider__thumb:hover,
        #multisample-volume .cds--slider__thumb:hover,
        #multisample-width .cds--slider__thumb:hover,
        #multisample-highpass .cds--slider__thumb:hover,
        #multisample-portamento-amount .cds--slider__thumb:hover {
          background: var(--color-text-primary) !important;
          border-color: var(--color-text-primary) !important;
        }
      `}</style>
    </>
  );
} 