import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Select, SelectItem, Toggle, Slider } from '@carbon/react';
import { ADSREnvelope } from '../common/ADSREnvelope';
import { importPresetFromFile } from '../../utils/presetImport';
import type { MultisamplePresetJson } from '../../utils/presetImport';

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

export function MultisamplePresetSettings() {
  const { state, dispatch } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  
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
    // Reset all advanced settings to defaults
    dispatch({ type: 'SET_MULTISAMPLE_PLAYMODE', payload: 'poly' });
    dispatch({ type: 'SET_MULTISAMPLE_TRANSPOSE', payload: 0 });
    dispatch({ type: 'SET_MULTISAMPLE_VELOCITY_SENSITIVITY', payload: 20 });
    dispatch({ type: 'SET_MULTISAMPLE_VOLUME', payload: 69 });
    dispatch({ type: 'SET_MULTISAMPLE_WIDTH', payload: 0 });
    dispatch({ type: 'SET_MULTISAMPLE_HIGHPASS', payload: 0 });
    dispatch({ type: 'SET_MULTISAMPLE_PORTAMENTO_TYPE', payload: 'linear' });
    dispatch({ type: 'SET_MULTISAMPLE_PORTAMENTO_AMOUNT', payload: 0 });
    dispatch({ type: 'SET_MULTISAMPLE_TUNING_ROOT', payload: 0 });
    dispatch({ type: 'SET_MULTISAMPLE_AMP_ENVELOPE', payload: ADSR_PRESETS.keys.amp });
    dispatch({ type: 'SET_MULTISAMPLE_FILTER_ENVELOPE', payload: ADSR_PRESETS.keys.filter });
  };

  const updateSetting = <K extends keyof MultisampleAdvancedSettings>(
    key: K,
    value: MultisampleAdvancedSettings[K]
  ) => {
    // Update the corresponding global state
    switch (key) {
      case 'playmode':
        dispatch({ type: 'SET_MULTISAMPLE_PLAYMODE', payload: value as 'poly' | 'mono' | 'legato' });
        break;
      case 'transpose':
        dispatch({ type: 'SET_MULTISAMPLE_TRANSPOSE', payload: value as number });
        break;
      case 'velocitySensitivity':
        dispatch({ type: 'SET_MULTISAMPLE_VELOCITY_SENSITIVITY', payload: value as number });
        break;
      case 'volume':
        dispatch({ type: 'SET_MULTISAMPLE_VOLUME', payload: value as number });
        break;
      case 'width':
        dispatch({ type: 'SET_MULTISAMPLE_WIDTH', payload: value as number });
        break;
      case 'highpass':
        dispatch({ type: 'SET_MULTISAMPLE_HIGHPASS', payload: value as number });
        break;
      case 'portamentoType':
        dispatch({ type: 'SET_MULTISAMPLE_PORTAMENTO_TYPE', payload: value as 'linear' | 'exponential' });
        break;
      case 'portamentoAmount':
        dispatch({ type: 'SET_MULTISAMPLE_PORTAMENTO_AMOUNT', payload: value as number });
        break;
      case 'tuningRoot':
        dispatch({ type: 'SET_MULTISAMPLE_TUNING_ROOT', payload: value as number });
        break;
    }
  };

  const updateAmpEnvelope = (envelope: MultisampleAdvancedSettings['ampEnvelope']) => {
    dispatch({ type: 'SET_MULTISAMPLE_AMP_ENVELOPE', payload: envelope });
  };

  const updateFilterEnvelope = (envelope: MultisampleAdvancedSettings['filterEnvelope']) => {
    dispatch({ type: 'SET_MULTISAMPLE_FILTER_ENVELOPE', payload: envelope });
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* Basic Settings Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => toggleSection('basic')}>
          <span style={{ transform: expandedSections.basic ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '500', color: 'var(--color-text-primary)' }}>basic settings</h3>
        </div>
        
        {expandedSections.basic && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0 0 1rem' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '0.5rem' : '2rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Select
                  id="playmode"
                  labelText=""
                  value={state.multisampleSettings.playmode}
                  onChange={(e) => updateSetting('playmode', e.target.value as any)}
                  size="sm"
                >
                  <SelectItem value="poly" text="poly" />
                  <SelectItem value="mono" text="mono" />
                  <SelectItem value="legato" text="legato" />
                </Select>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Toggle
                  id="loop-enabled"
                  labelA="off"
                  labelB="on"
                  toggled={state.multisampleSettings.loopEnabled}
                  onToggle={(checked: boolean) => updateSetting('loopEnabled', checked)}
                  size="sm"
                  labelText="loop enabled"
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Toggle
                  id="loop-on-release"
                  labelA="off"
                  labelB="on"
                  toggled={state.multisampleSettings.loopOnRelease}
                  onToggle={(checked: boolean) => updateSetting('loopOnRelease', checked)}
                  size="sm"
                  labelText="loop on release"
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '0.5rem' : '2rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Select
                  id="tuning-root"
                  labelText=""
                  value={state.multisampleSettings.tuningRoot.toString()}
                  onChange={(e) => updateSetting('tuningRoot', parseInt(e.target.value))}
                  size="sm"
                >
                  {noteNames.map((note, index) => (
                    <SelectItem key={index} value={index.toString()} text={note} />
                  ))}
                </Select>
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: isMobile ? 0 : '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>transpose: {state.multisampleSettings.transpose}</label>
                <Slider
                  id="multisample-transpose"
                  min={-36}
                  max={36}
                  step={1}
                  value={state.multisampleSettings.transpose}
                  onChange={({ value }) => updateSetting('transpose', value)}
                  hideTextInput
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sound Settings Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => toggleSection('sound')}>
          <span style={{ transform: expandedSections.sound ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '500', color: 'var(--color-text-primary)' }}>sound settings</h3>
        </div>
        
        {expandedSections.sound && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0 0 1rem' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '0.5rem' : '2rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>width: {state.multisampleSettings.width}%</label>
                <Slider
                  id="multisample-width"
                  min={0}
                  max={100}
                  step={1}
                  value={state.multisampleSettings.width}
                  onChange={({ value }) => updateSetting('width', value)}
                  hideTextInput
                />
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: isMobile ? 0 : '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>highpass: {state.multisampleSettings.highpass}%</label>
                <Slider
                  id="multisample-highpass"
                  min={0}
                  max={100}
                  step={1}
                  value={state.multisampleSettings.highpass}
                  onChange={({ value }) => updateSetting('highpass', value)}
                  hideTextInput
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '0.5rem' : '2rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>velocity sensitivity: {state.multisampleSettings.velocitySensitivity}%</label>
                <Slider
                  id="multisample-velocity-sensitivity"
                  min={0}
                  max={100}
                  step={1}
                  value={state.multisampleSettings.velocitySensitivity}
                  onChange={({ value }) => updateSetting('velocitySensitivity', value)}
                  hideTextInput
                />
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: isMobile ? 0 : '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>volume: {state.multisampleSettings.volume}%</label>
                <Slider
                  id="multisample-volume"
                  min={0}
                  max={100}
                  step={1}
                  value={state.multisampleSettings.volume}
                  onChange={({ value }) => updateSetting('volume', value)}
                  hideTextInput
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '0.5rem' : '2rem', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Select
                  id="portamento-type"
                  labelText=""
                  value={state.multisampleSettings.portamentoType}
                  onChange={(e) => updateSetting('portamentoType', e.target.value as any)}
                  size="sm"
                >
                  <SelectItem value="linear" text="linear" />
                  <SelectItem value="exponential" text="exponential" />
                </Select>
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: isMobile ? 0 : '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>portamento amount: {state.multisampleSettings.portamentoAmount}%</label>
                <Slider
                  id="multisample-portamento-amount"
                  min={0}
                  max={100}
                  step={1}
                  value={state.multisampleSettings.portamentoAmount}
                  onChange={({ value }) => updateSetting('portamentoAmount', value)}
                  hideTextInput
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Envelope Settings Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => toggleSection('envelopes')}>
          <span style={{ transform: expandedSections.envelopes ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '500', color: 'var(--color-text-primary)' }}>envelope settings</h3>
        </div>
        
        {expandedSections.envelopes && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0 0 1rem' }}>
            <ADSREnvelope
              ampEnvelope={state.multisampleSettings.ampEnvelope}
              filterEnvelope={state.multisampleSettings.filterEnvelope}
              onAmpEnvelopeChange={updateAmpEnvelope}
              onFilterEnvelopeChange={updateFilterEnvelope}
            />
          </div>
        )}
      </div>

      {/* Import/Reset Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button onClick={handleImportClick} style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--color-border-light)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
          import settings
        </button>
        <button onClick={handleReset} style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid var(--color-border-light)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
          reset to defaults
        </button>
      </div>
      
      {/* Hidden file input for importing settings */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".json"
        onChange={handleFileImport}
      />
    </div>
  );
} 