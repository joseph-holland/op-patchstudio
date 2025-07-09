// MIDI Device Selector Component
// Displays connected MIDI devices and provides initialization controls

import { useState } from 'react';
import { useWebMidi } from '../../hooks/useWebMidi';
import { EnhancedTooltip } from './EnhancedTooltip';

// MIDI Channel Selector Component
interface MidiChannelSelectorProps {
  selectedChannel: number;
  onChannelChange: (channel: number) => void;
}

function MidiChannelSelector({ selectedChannel, onChannelChange }: MidiChannelSelectorProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.75rem'
    }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>channel:</span>
      <select
        value={selectedChannel}
        onChange={(e) => onChannelChange(parseInt(e.target.value))}
        style={{
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-light)',
          borderRadius: '3px',
          padding: '0.25rem 0.5rem',
          fontSize: '0.75rem',
          color: 'var(--color-text-primary)',
          fontFamily: '"Montserrat", "Arial", sans-serif',
          cursor: 'pointer'
        }}
      >
        {Array.from({ length: 16 }, (_, i) => (
          <option key={i} value={i}>
            {i + 1}
          </option>
        ))}
      </select>
    </div>
  );
}

interface MidiDeviceSelectorProps {
  className?: string;
  showInputsOnly?: boolean;
  showOutputsOnly?: boolean;
  onChannelChange?: (channel: number) => void;
}

export function MidiDeviceSelector({ 
  className = '',
  showInputsOnly = false,
  showOutputsOnly = false,
  onChannelChange
}: MidiDeviceSelectorProps) {
  const { state, initialize } = useWebMidi();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(0); // Default to channel 1 (0-indexed)

  const handleInitialize = async () => {
    if (!state.isSupported) {
      alert('WebMIDI is not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.');
      return;
    }
    
    await initialize();
  };

  // Filter devices based on props
  const filteredDevices = state.devices.filter(device => {
    if (showInputsOnly) return device.type === 'input';
    if (showOutputsOnly) return device.type === 'output';
    return true;
  });

  const inputDevices = filteredDevices.filter(d => d.type === 'input');
  const outputDevices = filteredDevices.filter(d => d.type === 'output');

  if (!state.isSupported) {
    return (
      <div className={`midi-device-selector ${className}`} style={{
        padding: '1rem',
        background: 'var(--color-bg-secondary)',
        borderRadius: '6px',
        border: '1px solid var(--color-border-subtle)',
        textAlign: 'center'
      }}>
        <div style={{ 
          color: 'var(--color-text-secondary)',
          fontSize: '0.875rem',
          marginBottom: '0.5rem'
        }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight: '0.5rem' }}></i>
          webmidi not supported
        </div>
        <div style={{ 
          color: 'var(--color-text-secondary)',
          fontSize: '0.75rem'
        }}>
          please use chrome, edge, or another chromium-based browser
        </div>
      </div>
    );
  }

  if (!state.isInitialized) {
    return (
      <div className={`midi-device-selector ${className}`} style={{
        padding: '1rem',
        background: 'var(--color-bg-secondary)',
        borderRadius: '6px',
        border: '1px solid var(--color-border-subtle)',
        textAlign: 'center'
      }}>
        <button
          onClick={handleInitialize}
          disabled={state.isConnecting}
          style={{
            background: 'var(--color-interactive-focus)',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            cursor: state.isConnecting ? 'not-allowed' : 'pointer',
            opacity: state.isConnecting ? 0.6 : 1,
            transition: 'all 0.2s ease',
            fontFamily: '"Montserrat", "Arial", sans-serif'
          }}
        >
          {state.isConnecting ? (
            <>
              <i className="fas fa-spinner fa-spin" style={{ marginRight: '0.5rem' }}></i>
              connecting...
            </>
          ) : (
            <>
              <i className="fas fa-plug" style={{ marginRight: '0.5rem' }}></i>
              connect midi devices
            </>
          )}
        </button>
        {state.error && (
          <div style={{
            color: 'var(--color-text-error)',
            fontSize: '0.75rem',
            marginTop: '0.5rem'
          }}>
            {state.error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`midi-device-selector ${className}`} style={{
      background: 'var(--color-bg-secondary)',
      borderRadius: '6px',
      border: '1px solid var(--color-border-subtle)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--color-border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--color-text-primary)'
        }}>
          <i className="fas fa-music" style={{ fontSize: '0.75rem' }}></i>
          midi devices
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <MidiChannelSelector 
            selectedChannel={selectedChannel}
            onChannelChange={(channel) => {
              setSelectedChannel(channel);
              onChannelChange?.(channel);
            }}
          />
          <EnhancedTooltip 
            isVisible={isTooltipVisible}
            content={
              <div>
                <h3>midi device support</h3>
                <p>connect midi keyboards, controllers, or drum pads to play virtual instruments</p>
                <p><strong>note:</strong> devices must be connected before opening this page</p>
                <p><strong>channel:</strong> select which midi channel to listen to (1-16)</p>
              </div>
            }>
            <i 
              className="fas fa-question-circle" 
              style={{ 
                fontSize: '0.75rem', 
                color: 'var(--color-text-secondary)',
                cursor: 'help'
              }}
              onMouseEnter={() => setIsTooltipVisible(true)}
              onMouseLeave={() => setIsTooltipVisible(false)}
            ></i>
          </EnhancedTooltip>
        </div>
      </div>

      {/* Device Lists */}
      <div style={{ padding: '0.75rem 1rem' }}>
        {filteredDevices.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
            fontSize: '0.75rem',
            padding: '1rem 0'
          }}>
            <i className="fas fa-search" style={{ marginRight: '0.5rem' }}></i>
            no midi devices detected
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Input Devices */}
            {inputDevices.length > 0 && (
              <div>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                  marginBottom: '0.5rem',
                  fontWeight: 500
                }}>
                  input devices ({inputDevices.length})
                </div>
                {inputDevices.map(device => (
                  <DeviceItem key={device.id} device={device} />
                ))}
              </div>
            )}

            {/* Output Devices */}
            {outputDevices.length > 0 && (
              <div>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                  marginBottom: '0.5rem',
                  fontWeight: 500
                }}>
                  output devices ({outputDevices.length})
                </div>
                {outputDevices.map(device => (
                  <DeviceItem key={device.id} device={device} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Individual device item component
function DeviceItem({ device }: { device: import('../../utils/midi').MidiDevice }) {
  const isConnected = device.state === 'connected';
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.5rem',
      background: isConnected ? 'var(--color-bg-primary)' : 'var(--color-bg-secondary)',
      borderRadius: '3px',
      border: `1px solid ${isConnected ? 'var(--color-border-light)' : 'var(--color-border-subtle)'}`
    }}>
      {/* Connection Status */}
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: isConnected ? '#4CAF50' : '#9E9E9E',
        flexShrink: 0
      }}></div>

      {/* Device Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.75rem',
          fontWeight: 500,
          color: 'var(--color-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {device.name}
        </div>
        {device.manufacturer && device.manufacturer !== 'Unknown' && (
          <div style={{
            fontSize: '0.7rem',
            color: 'var(--color-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {device.manufacturer}
          </div>
        )}
      </div>

      {/* Device Type */}
      <div style={{
        fontSize: '0.7rem',
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        fontWeight: 500,
        flexShrink: 0
      }}>
        {device.type}
      </div>
    </div>
  );
} 