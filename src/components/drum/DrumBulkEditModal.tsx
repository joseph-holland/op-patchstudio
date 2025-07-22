import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';

interface DrumBulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BulkSettings {
  playmode: 'oneshot' | 'group' | 'loop' | 'gate';
  reverse: boolean;
  transpose: number; // -48 to +48 semitones
  gain: number; // -30 to +20 dB
  pan: number; // -100 to +100
}

export function DrumBulkEditModal({ isOpen, onClose }: DrumBulkEditModalProps) {
  const { state, dispatch } = useAppContext();
  
  const [settings, setSettings] = useState<BulkSettings>({
    playmode: 'oneshot',
    reverse: false,
    transpose: 0,
    gain: 0,
    pan: 0
  });

  const loadedSamplesCount = state.drumSamples.filter(sample => sample && sample.isLoaded).length;

  const handleSave = () => {
    // Apply settings to all loaded samples
    state.drumSamples.forEach((sample, index) => {
      if (sample && sample.isLoaded) {
        // Check if any values actually changed from the sample's current values
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
            index,
            updates: {
              ...settings,
              hasBeenEdited: sample.hasBeenEdited || valuesChanged
            }
          }
        });
      }
    });
    
    onClose();
  };

  const handleCancel = () => {
    onClose();
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
          padding: '1.5rem 2rem',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h3 style={{
            margin: 0,
            color: '#222',
            fontSize: '1.25rem',
            fontWeight: '300'
          }}>bulk edit samples</h3>
        </div>
        <div style={{ padding: '2rem' }}>
          <div 
            style={{ 
              fontSize: '0.9rem', 
              background: '#f3f4f6', 
              color: '#374151', 
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '2rem'
            }}
          >
            these settings will be applied to all <strong>{loadedSamplesCount}</strong> loaded {loadedSamplesCount === 1 ? 'sample' : 'samples'}.
          </div>

          {/* Playmode */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ 
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151'
            }}>
              playmode
            </label>
            <select 
              style={{ 
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: '#fff',
                color: '#374151',
                outline: 'none'
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

          {/* Direction */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ 
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151'
            }}>
              direction
            </label>
            <select 
              style={{ 
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem',
                backgroundColor: '#fff',
                color: '#374151',
                outline: 'none'
              }}
              value={settings.reverse ? 'reverse' : 'forward'}
              onChange={(e) => setSettings({...settings, reverse: e.target.value === 'reverse'})}
            >
              <option value="forward">forward</option>
              <option value="reverse">reverse</option>
            </select>
          </div>

          {/* Transpose */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ 
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151'
            }}>transpose (semitones)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input
                type="range"
                min="-48"
                max="48"
                value={settings.transpose}
                step="1"
                style={{
                  flex: 1,
                  height: '6px',
                  borderRadius: '3px',
                  background: `linear-gradient(to right, #6b7280 0%, #6b7280 ${((settings.transpose + 48) / 96) * 100}%, #e5e7eb ${((settings.transpose + 48) / 96) * 100}%, #e5e7eb 100%)`,
                  outline: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none'
                }}
                onChange={(e) => setSettings({...settings, transpose: parseInt(e.target.value)})}
              />
              <input 
                type="number" 
                min="-48" 
                max="48" 
                value={settings.transpose} 
                style={{ 
                  width: '80px', 
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  backgroundColor: '#fff',
                  color: '#374151',
                  outline: 'none'
                }}
                onChange={(e) => {
                  const val = Math.max(-48, Math.min(48, parseInt(e.target.value) || 0));
                  setSettings({...settings, transpose: val});
                }}
              />
            </div>
          </div>

          {/* Gain */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ 
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151'
            }}>gain (db)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input
                type="range"
                min="-30"
                max="20"
                value={settings.gain}
                step="1"
                style={{
                  flex: 1,
                  height: '6px',
                  borderRadius: '3px',
                  background: `linear-gradient(to right, #6b7280 0%, #6b7280 ${((settings.gain + 30) / 50) * 100}%, #e5e7eb ${((settings.gain + 30) / 50) * 100}%, #e5e7eb 100%)`,
                  outline: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none'
                }}
                onChange={(e) => setSettings({...settings, gain: parseInt(e.target.value)})}
              />
              <input 
                type="number" 
                min="-30" 
                max="20" 
                value={settings.gain} 
                style={{ 
                  width: '80px', 
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  backgroundColor: '#fff',
                  color: '#374151',
                  outline: 'none'
                }}
                onChange={(e) => {
                  const val = Math.max(-30, Math.min(20, parseInt(e.target.value) || 0));
                  setSettings({...settings, gain: val});
                }}
              />
            </div>
          </div>

          {/* Pan */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ 
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#374151'
            }}>pan</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input
                type="range"
                min="-100"
                max="100"
                value={settings.pan}
                step="1"
                style={{
                  flex: 1,
                  height: '6px',
                  borderRadius: '3px',
                  background: `linear-gradient(to right, #6b7280 0%, #6b7280 ${((settings.pan + 100) / 200) * 100}%, #e5e7eb ${((settings.pan + 100) / 200) * 100}%, #e5e7eb 100%)`,
                  outline: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none'
                }}
                onChange={(e) => setSettings({...settings, pan: parseInt(e.target.value)})}
              />
              <input 
                type="number" 
                min="-100" 
                max="100" 
                value={settings.pan} 
                step="1" 
                style={{ 
                  width: '80px', 
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  backgroundColor: '#fff',
                  color: '#374151',
                  outline: 'none'
                }}
                onChange={(e) => {
                  const val = Math.max(-100, Math.min(100, parseInt(e.target.value) || 0));
                  setSettings({...settings, pan: val});
                }}
              />
            </div>
          </div>
        </div>

        <div style={{
          padding: '1.5rem 2rem',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem'
        }}>
          <button 
            type="button" 
            style={{ 
              padding: '0.625rem 1.25rem',
              border: '1px solid #d1d5db',
              borderRadius: '3px',
              backgroundColor: '#fff',
              color: '#6b7280',
              fontSize: '0.9rem',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
            onClick={handleCancel}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.borderColor = '#9ca3af';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#fff';
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            <i className="fas fa-times"></i>
            cancel
          </button>
          <button 
            type="button" 
            style={{ 
              padding: '0.625rem 1.25rem',
              border: 'none',
              borderRadius: '3px',
              backgroundColor: loadedSamplesCount === 0 ? '#9ca3af' : '#333',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: '500',
              cursor: loadedSamplesCount === 0 ? 'not-allowed' : 'pointer',
              opacity: loadedSamplesCount === 0 ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
            onClick={handleSave}
            disabled={loadedSamplesCount === 0}
            onMouseEnter={(e) => {
              if (loadedSamplesCount > 0) {
                e.currentTarget.style.backgroundColor = '#555';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (loadedSamplesCount > 0) {
                e.currentTarget.style.backgroundColor = '#333';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <i className="fas fa-save"></i>
            apply to {loadedSamplesCount} {loadedSamplesCount === 1 ? 'sample' : 'samples'}
          </button>
        </div>
      </div>
    </div>
  );
} 