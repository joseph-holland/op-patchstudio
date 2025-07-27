import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Select, SelectItem, Toggle, Slider } from '@carbon/react';
import { ADSREnvelope } from '../common/ADSREnvelope';
import { importPresetFromFile } from '../../utils/presetImport';
import type { MultisamplePresetJson } from '../../utils/presetImport';
import { percentToInternal } from '../../utils/valueConversions';

// ADSR Presets for different instrument types (copied from ADSREnvelope component)
const ADSR_PRESETS = {
  bass: {
    amp: { attack: 1000, decay: 12000, sustain: 28000, release: 15000 },
    filter: { attack: 0, decay: 8000, sustain: 20000, release: 12000 }
  },
  pad: {
    amp: { attack: 15000, decay: 20000, sustain: 30000, release: 25000 },
    filter: { attack: 4000, decay: 15000, sustain: 25000, release: 20000 }
  },
  keys: {
    amp: { attack: 500, decay: 6000, sustain: 22000, release: 12000 },
    filter: { attack: 0, decay: 5000, sustain: 18000, release: 10000 }
  },
  pluck: {
    amp: { attack: 0, decay: 2000, sustain: 8000, release: 5000 },
    filter: { attack: 0, decay: 3000, sustain: 12000, release: 8000 }
  },
  lead: {
    amp: { attack: 800, decay: 8000, sustain: 20000, release: 12000 },
    filter: { attack: 0, decay: 6000, sustain: 18000, release: 10000 }
  },
  sustain: {
    amp: { attack: 0, decay: 0, sustain: 32767, release: 0 },
    filter: { attack: 0, decay: 0, sustain: 32767, release: 0 }
  }
};

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

// Function to create true default settings (non-random, consistent values)
const createTrueDefaultSettings = (): MultisampleAdvancedSettings => {
  return {
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
    ampEnvelope: ADSR_PRESETS.keys.amp, // Use consistent 'keys' preset as default
    filterEnvelope: ADSR_PRESETS.keys.filter,
  };
};

export function MultisamplePresetSettings() {
  const { state, dispatch } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  


  // Function to convert global state to local settings format
  const createSettingsFromGlobalState = (): MultisampleAdvancedSettings => {
    const currentAmpEnvelope = state.multisampleSettings.ampEnvelope;
    const currentFilterEnvelope = state.multisampleSettings.filterEnvelope;
    
    // Always use the current envelope values from global state
    // Don't replace with preset values - preserve user's custom settings
    const ampEnvelope = currentAmpEnvelope;
    const filterEnvelope = currentFilterEnvelope;
    
    return {
      playmode: state.multisampleSettings.playmode,
      loopEnabled: state.multisampleSettings.loopEnabled,
      loopOnRelease: state.multisampleSettings.loopOnRelease,
      transpose: state.multisampleSettings.transpose,
      velocitySensitivity: state.multisampleSettings.velocitySensitivity,
      volume: state.multisampleSettings.volume,
      width: state.multisampleSettings.width,
      highpass: state.multisampleSettings.highpass,
      portamentoType: state.multisampleSettings.portamentoType,
      portamentoAmount: state.multisampleSettings.portamentoAmount,
      tuningRoot: state.multisampleSettings.tuningRoot,
      ampEnvelope,
      filterEnvelope,
    };
  };

  const [settings, setSettings] = useState<MultisampleAdvancedSettings>(() => {
    return createSettingsFromGlobalState();
  });
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    sound: false,
    envelopes: true
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sync local settings with global state when global state changes
  // Note: Excluded ampEnvelope and filterEnvelope from dependencies to prevent loops
  useEffect(() => {
    const globalSettings = createSettingsFromGlobalState();
    setSettings(globalSettings);
  }, [
    state.multisampleSettings.playmode,
    state.multisampleSettings.loopEnabled,
    state.multisampleSettings.loopOnRelease,
    state.multisampleSettings.transpose,
    state.multisampleSettings.velocitySensitivity,
    state.multisampleSettings.volume,
    state.multisampleSettings.width,
    state.multisampleSettings.highpass,
    state.multisampleSettings.portamentoType,
    state.multisampleSettings.portamentoAmount,
    state.multisampleSettings.tuningRoot,
    // Removed ampEnvelope and filterEnvelope to prevent reset loops
  ]);

  // Note: Removed the useEffect that was resetting envelopes to 'keys' preset
  // This was causing the envelopes to reset every time the user interacted with them

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

  const handleReset = () => {
    const resetSettings = createTrueDefaultSettings();
    setSettings(resetSettings);
    dispatchSettingsToContext(resetSettings);
  };

  const updateSetting = <K extends keyof MultisampleAdvancedSettings>(
    key: K,
    value: MultisampleAdvancedSettings[K]
  ) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      dispatchSettingsToContext(newSettings);
      return newSettings;
    });
  };

  // Function to dispatch current settings to app context
  const dispatchSettingsToContext = (currentSettings: MultisampleAdvancedSettings) => {
    // Dispatch individual settings to global context for save-as-defaults functionality
    dispatch({ type: 'SET_MULTISAMPLE_PLAYMODE', payload: currentSettings.playmode });
    dispatch({ type: 'SET_MULTISAMPLE_TRANSPOSE', payload: currentSettings.transpose });
    dispatch({ type: 'SET_MULTISAMPLE_VELOCITY_SENSITIVITY', payload: currentSettings.velocitySensitivity });
    dispatch({ type: 'SET_MULTISAMPLE_VOLUME', payload: currentSettings.volume });
    dispatch({ type: 'SET_MULTISAMPLE_WIDTH', payload: currentSettings.width });
    dispatch({ type: 'SET_MULTISAMPLE_HIGHPASS', payload: currentSettings.highpass });
    dispatch({ type: 'SET_MULTISAMPLE_PORTAMENTO_TYPE', payload: currentSettings.portamentoType });
    dispatch({ type: 'SET_MULTISAMPLE_PORTAMENTO_AMOUNT', payload: currentSettings.portamentoAmount });
    dispatch({ type: 'SET_MULTISAMPLE_TUNING_ROOT', payload: currentSettings.tuningRoot });
    dispatch({ type: 'SET_MULTISAMPLE_AMP_ENVELOPE', payload: currentSettings.ampEnvelope });
    dispatch({ type: 'SET_MULTISAMPLE_FILTER_ENVELOPE', payload: currentSettings.filterEnvelope });
    
    // Dispatch loop settings to global context
    dispatch({ type: 'SET_MULTISAMPLE_LOOP_ENABLED', payload: currentSettings.loopEnabled });
    dispatch({ type: 'SET_MULTISAMPLE_LOOP_ON_RELEASE', payload: currentSettings.loopOnRelease });
    
    // Also store in the imported preset format for patch generation
    const payload = {
      engine: {
        playmode: currentSettings.playmode,
        transpose: currentSettings.transpose,
        'velocity.sensitivity': percentToInternal(currentSettings.velocitySensitivity),
        volume: percentToInternal(currentSettings.volume),
        width: percentToInternal(currentSettings.width),
        highpass: percentToInternal(currentSettings.highpass),
        'portamento.amount': percentToInternal(currentSettings.portamentoAmount),
        'portamento.type': currentSettings.portamentoType === 'linear' ? 32767 : 0,
        'tuning.root': currentSettings.tuningRoot,
      },
      envelope: {
        amp: {
          attack: currentSettings.ampEnvelope.attack,
          decay: currentSettings.ampEnvelope.decay,
          sustain: currentSettings.ampEnvelope.sustain,
          release: currentSettings.ampEnvelope.release,
        },
        filter: {
          attack: currentSettings.filterEnvelope.attack,
          decay: currentSettings.filterEnvelope.decay,
          sustain: currentSettings.filterEnvelope.sustain,
          release: currentSettings.filterEnvelope.release,
        },
      },
      regions: [] // Will be populated during patch generation
    };

    dispatch({
      type: 'SET_IMPORTED_MULTISAMPLE_PRESET',
      payload
    });
  };

  const updateAmpEnvelope = (envelope: MultisampleAdvancedSettings['ampEnvelope']) => {
    setSettings(prev => {
      const newSettings = { ...prev, ampEnvelope: envelope };
      // Only dispatch envelope changes to avoid loops
      dispatch({ type: 'SET_MULTISAMPLE_AMP_ENVELOPE', payload: envelope });
      return newSettings;
    });
  };

  const updateFilterEnvelope = (envelope: MultisampleAdvancedSettings['filterEnvelope']) => {
    setSettings(prev => {
      const newSettings = { ...prev, filterEnvelope: envelope };
      // Only dispatch envelope changes to avoid loops
      dispatch({ type: 'SET_MULTISAMPLE_FILTER_ENVELOPE', payload: envelope });
      return newSettings;
    });
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Get true default settings for comparison
  const trueDefaults = createTrueDefaultSettings();

  // Check if any settings have changed from their true default values
  const hasPresetChanges = (
    // Check non-envelope settings against true defaults
    settings.playmode !== trueDefaults.playmode ||
    settings.loopEnabled !== trueDefaults.loopEnabled ||
    settings.loopOnRelease !== trueDefaults.loopOnRelease ||
    settings.transpose !== trueDefaults.transpose ||
    settings.velocitySensitivity !== trueDefaults.velocitySensitivity ||
    settings.volume !== trueDefaults.volume ||
    settings.width !== trueDefaults.width ||
    settings.highpass !== trueDefaults.highpass ||
    settings.portamentoType !== trueDefaults.portamentoType ||
    settings.portamentoAmount !== trueDefaults.portamentoAmount ||
    settings.tuningRoot !== trueDefaults.tuningRoot ||
    // Check envelope settings against true defaults
    settings.ampEnvelope.attack !== trueDefaults.ampEnvelope.attack ||
    settings.ampEnvelope.decay !== trueDefaults.ampEnvelope.decay ||
    settings.ampEnvelope.sustain !== trueDefaults.ampEnvelope.sustain ||
    settings.ampEnvelope.release !== trueDefaults.ampEnvelope.release ||
    settings.filterEnvelope.attack !== trueDefaults.filterEnvelope.attack ||
    settings.filterEnvelope.decay !== trueDefaults.filterEnvelope.decay ||
    settings.filterEnvelope.sustain !== trueDefaults.filterEnvelope.sustain ||
    settings.filterEnvelope.release !== trueDefaults.filterEnvelope.release
  );

  return (
    <div style={{
      background: 'var(--color-bg-primary)',
      borderRadius: '15px',
      boxShadow: '0 2px 8px var(--color-shadow-primary)',
      border: '1px solid var(--color-border-subtle)',
      overflow: 'hidden',
      marginBottom: '1rem',
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
            preset settings
          </h3>
        </div>
      </div>

      {/* Content */}
      <div style={{ 
        padding: isMobile ? '1rem' : '2rem',
      }}>
        {/* Settings Grid */}
        <div style={{ display: 'grid', gap: '1rem' }}>
          
          {/* Essential Settings */}
          <section style={{
            border: '1px solid var(--color-border-light)',
            borderRadius: '6px',
            marginBottom: '0.75rem',
            overflow: 'hidden',
            background: 'var(--color-bg-primary)'
          }}>
            {/* Header */}
            <div
              onClick={() => toggleSection('basic')}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.25rem',
                background: 'var(--color-bg-secondary)',
                cursor: 'pointer',
                userSelect: 'none',
                borderBottom: expandedSections.basic ? '1px solid var(--color-border-light)' : 'none',
                transition: 'background 0.2s',
                borderRadius: '6px 6px 0 0',
                overflow: 'hidden',
              }}
            >
              <h4 style={{
                margin: 0,
                color: 'var(--color-text-primary)',
                fontWeight: '500',
                fontSize: '1rem',
                letterSpacing: '0.01em',
              }}>basic</h4>
              <i
                className="fas fa-chevron-right"
                style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '1rem',
                  transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)',
                  transform: expandedSections.basic ? 'rotate(90deg)' : 'rotate(0deg)'
                }}
              />
            </div>
            {/* Content */}
            {expandedSections.basic && (
              <div style={{ padding: '1.25rem' }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', 
                  gap: isMobile ? '1.5rem' : '2rem',
                  alignItems: 'start',
                  justifyContent: isMobile ? 'center' : 'start'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: isMobile ? 'center' : 'flex-start',
                    textAlign: isMobile ? 'center' : 'left'
                  }}>
                    <label style={{ 
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: '500',
                      fontSize: '0.875rem',
                      color: 'var(--color-text-primary)'
                    }}>
                      playmode
                    </label>
                    <div style={{ width: '100%', maxWidth: '150px' }}>
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

                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: isMobile ? 'center' : 'flex-start',
                    textAlign: isMobile ? 'center' : 'left'
                  }}>
                    <label style={{ 
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: '500',
                      fontSize: '0.875rem',
                      color: 'var(--color-text-primary)'
                    }}>
                      loop enabled
                    </label>
                    <div style={{ padding: '4px' }}>
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

                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: isMobile ? 'center' : 'flex-start',
                    textAlign: isMobile ? 'center' : 'left'
                  }}>
                    <label style={{ 
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: '500',
                      fontSize: '0.875rem',
                      color: 'var(--color-text-primary)'
                    }}>
                      loop on release
                    </label>
                    <div style={{ padding: '4px' }}>
                      <Toggle
                        id="multisample-loop-onrelease"
                        labelA="off"
                        labelB="on"
                        toggled={settings.loopOnRelease}
                        onToggle={(checked) => updateSetting('loopOnRelease', checked)}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Advanced Settings */}
          <section style={{
            border: '1px solid var(--color-border-light)',
            borderRadius: '6px',
            marginBottom: '0.75rem',
            overflow: 'hidden',
            background: 'var(--color-bg-primary)'
          }}>
            {/* Header */}
            <div
              onClick={() => toggleSection('sound')}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.25rem',
                background: 'var(--color-bg-secondary)',
                cursor: 'pointer',
                userSelect: 'none',
                borderBottom: expandedSections.sound ? '1px solid var(--color-border-light)' : 'none',
                transition: 'background 0.2s',
                borderRadius: '6px 6px 0 0',
                overflow: 'hidden',
              }}
            >
              <h4 style={{
                margin: 0,
                color: 'var(--color-text-primary)',
                fontWeight: '500',
                fontSize: '1rem',
                letterSpacing: '0.01em',
              }}>advanced</h4>
              <i
                className="fas fa-chevron-right"
                style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '1rem',
                  transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)',
                  transform: expandedSections.sound ? 'rotate(90deg)' : 'rotate(0deg)'
                }}
              />
            </div>
            {/* Content */}
            {expandedSections.sound && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: isMobile ? '1.5rem' : '2rem',
                  padding: '1rem',
                  backgroundColor: 'var(--color-bg-primary)',
                  width: '100%',
                  boxSizing: 'border-box',
                  overflowX: 'auto',
                }}
              >
                {/* Row 1: Tuning root + Transpose */}
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '0.5rem' : '2rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>tuning root</label>
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
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: isMobile ? 0 : '0.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>transpose: {settings.transpose}</label>
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

                {/* Row 2: Width + Highpass */}
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '0.5rem' : '2rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>width: {settings.width}%</label>
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
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: isMobile ? 0 : '0.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>highpass: {settings.highpass}%</label>
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

                {/* Row 3: Velocity Sensitivity + Volume */}
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '0.5rem' : '2rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>velocity sensitivity: {settings.velocitySensitivity}%</label>
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
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: isMobile ? 0 : '0.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>volume: {settings.volume}%</label>
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

                {/* Row 4: Portamento Type + Amount */}
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '0.5rem' : '2rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>portamento type</label>
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
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: isMobile ? 0 : '0.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>portamento amount: {settings.portamentoAmount}%</label>
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
            )}
          </section>

          {/* Envelopes and Filters */}
          <section style={{
            border: '1px solid var(--color-border-light)',
            borderRadius: '6px',
            marginBottom: '0.75rem',
            overflow: 'hidden',
            background: 'var(--color-bg-primary)'
          }}>
            {/* Header */}
            <div
              onClick={() => toggleSection('envelopes')}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 1.25rem',
                background: 'var(--color-bg-secondary)',
                cursor: 'pointer',
                userSelect: 'none',
                borderBottom: expandedSections.envelopes ? '1px solid var(--color-border-light)' : 'none',
                transition: 'background 0.2s',
                borderRadius: '6px 6px 0 0',
                overflow: 'hidden',
              }}
            >
              <h4 style={{
                margin: 0,
                color: 'var(--color-text-primary)',
                fontWeight: '500',
                fontSize: '1rem',
                letterSpacing: '0.01em',
              }}>envelopes and filters</h4>
              <i
                className="fas fa-chevron-right"
                style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '1rem',
                  transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)',
                  transform: expandedSections.envelopes ? 'rotate(90deg)' : 'rotate(0deg)'
                }}
              />
            </div>
            {/* Content */}
            {expandedSections.envelopes && (
              <div style={{ 
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: isMobile ? '1.5rem' : '3rem',
                padding: '1rem',
                border: '1px solid var(--color-border-light)'
              }}>
                {/* Envelopes */}
                <div style={{ 
                  flex: isMobile ? '1' : '1 1 50%',
                  minWidth: 0
                }}>
                  <ADSREnvelope
                    ampEnvelope={settings.ampEnvelope}
                    filterEnvelope={settings.filterEnvelope}
                    onAmpEnvelopeChange={updateAmpEnvelope}
                    onFilterEnvelopeChange={updateFilterEnvelope}
                  />
                </div>
                
                {/* Filters (Coming Soon) */}
                <div style={{
                  flex: isMobile ? '1' : '1 1 50%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: isMobile ? '200px' : '300px',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-bg-panel)',
                  color: 'var(--color-text-secondary)'
                }}>
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem',
                    textAlign: 'center'
                  }}>
                    filters
                  </div>
                  <div style={{
                    fontSize: '0.9rem',
                    opacity: 0.7,
                    textAlign: 'center'
                  }}>
                    coming soon
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Action Buttons at Bottom */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: isMobile ? 'center' : 'flex-end',
          flexDirection: isMobile ? 'column' : 'row',
          marginTop: '1.5rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--color-border-light)',
        }}>
          <button
            onClick={handleReset}
            disabled={!hasPresetChanges}
            style={{
              minHeight: '44px',
              minWidth: '44px',
              padding: '0.75rem 1.5rem',
              border: '1px solid var(--color-interactive-focus-ring)',
              borderRadius: '6px',
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
              gap: '0.75rem',
              opacity: hasPresetChanges ? 1 : 0.6,
              width: isMobile ? '100%' : 'auto',
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
            <i className="fas fa-undo" style={{ fontSize: '1rem' }}></i>
            reset settings
          </button>
          <button
            onClick={handleImportClick}
            style={{
              minHeight: '44px',
              minWidth: '44px',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '6px',
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
              gap: '0.75rem',
              width: isMobile ? '100%' : 'auto',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-interactive-dark)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-interactive-focus)';
            }}
          >
            <i className="fas fa-upload" style={{ fontSize: '1rem' }}></i>
            import patch.json
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
    </div>
  );
} 