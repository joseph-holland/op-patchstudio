// MIDI Device Selector Component
// Displays connected MIDI devices and provides initialization controls

import { useState } from 'react';
import { useWebMidi } from '../../hooks/useWebMidi';

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
          cursor: 'pointer',
          minWidth: '60px'
        }}
      >
        {Array.from({ length: 16 }, (_, i) => (
          <option key={i} value={i + 1}>
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
  const [selectedChannel, setSelectedChannel] = useState(1); // Default to channel 1 (1-based)

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
        padding: '0.75rem 1rem',
        background: 'var(--color-bg-primary)',
        borderRadius: '6px',
        border: '1px solid var(--color-border-light)',
        textAlign: 'center'
      }}>
        <div style={{ 
          color: 'var(--color-text-secondary)',
          fontSize: '0.875rem'
        }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight: '0.5rem' }}></i>
          webmidi not supported
        </div>
      </div>
    );
  }

  if (!state.isInitialized) {
    return (
      <div className={`midi-device-selector ${className}`} style={{
        background: 'var(--color-bg-primary)',
        overflow: 'hidden',
        height: '60px'
      }}>
        {/* Compact single-row layout */}
        <div style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          {/* Left side - Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            flexShrink: 0
          }}>
            <i className="fas fa-music" style={{ fontSize: '0.75rem' }}></i>
            midi devices
          </div>

          {/* Right side - Connect button */}
          <div style={{ marginLeft: 'auto' }}>
            <button
              onClick={handleInitialize}
              disabled={state.isConnecting}
              style={{
                background: 'var(--color-interactive-focus)',
                color: 'var(--color-white)',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                cursor: state.isConnecting ? 'not-allowed' : 'pointer',
                opacity: state.isConnecting ? 0.6 : 1,
                transition: 'all 0.2s ease',
                fontFamily: '"Montserrat", "Arial", sans-serif',
                fontWeight: 500,
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={e => {
                if (!state.isConnecting) {
                  e.currentTarget.style.backgroundColor = 'var(--color-interactive-dark)';
                }
              }}
              onMouseLeave={e => {
                if (!state.isConnecting) {
                  e.currentTarget.style.backgroundColor = 'var(--color-interactive-focus)';
                }
              }}
            >
              {state.isConnecting ? (
                <>
                  <i className="fas fa-spinner fa-spin" style={{ fontSize: '0.75rem' }}></i>
                  connecting...
                </>
              ) : (
                <>
                  <i className="fas fa-plug" style={{ fontSize: '0.75rem' }}></i>
                  connect midi devices
                </>
              )}
            </button>
          </div>
        </div>
        {state.error && (
          <div style={{
            color: 'var(--color-text-error)',
            fontSize: '0.75rem',
            marginTop: '0.5rem',
            padding: '0 1rem 0.75rem 1rem'
          }}>
            {state.error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`midi-device-selector ${className}`} style={{
      background: 'var(--color-bg-primary)',
      overflow: 'hidden',
      height: '60px'
    }}>
      {/* Compact single-row layout */}
      <div style={{
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        {/* Left side - Header and channel selector */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexShrink: 0
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
          
          <MidiChannelSelector 
            selectedChannel={selectedChannel}
            onChannelChange={(channel) => {
              setSelectedChannel(channel);
              onChannelChange?.(channel);
            }}
          />
        </div>

        {/* Center - Device count & Rescan */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.75rem',
          color: 'var(--color-text-secondary)',
          flexShrink: 0
        }}>
          <span>{filteredDevices.length} connected</span>
          <button
            onClick={handleInitialize}
            disabled={state.isConnecting}
            title="Rescan MIDI devices"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: state.isConnecting ? 'not-allowed' : 'pointer',
              padding: '0.25rem',
              fontSize: '0.875rem',
              lineHeight: 1,
              opacity: state.isConnecting ? 0.6 : 1,
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={e => {
              if (!state.isConnecting) e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={e => {
              if (!state.isConnecting) e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            {state.isConnecting 
              ? <i className="fas fa-spinner fa-spin"></i> 
              : <i className="fas fa-sync-alt"></i>}
          </button>
        </div>

        {/* Right side - Compact device list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {filteredDevices.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: '0.75rem'
            }}>
              <i className="fas fa-search" style={{ marginRight: '0.5rem' }}></i>
              no midi devices detected
            </div>
          ) : (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              flexWrap: 'wrap'
            }}>
              {/* Input Devices */}
              {inputDevices.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    color: 'var(--color-text-secondary)',
                    fontWeight: 500,
                    textTransform: 'uppercase'
                  }}>
                    in:
                  </span>
                  {inputDevices.map(device => (
                    <CompactDeviceItem key={device.id} device={device} />
                  ))}
                </div>
              )}

              {/* Output Devices */}
              {outputDevices.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    color: 'var(--color-text-secondary)',
                    fontWeight: 500,
                    textTransform: 'uppercase'
                  }}>
                    out:
                  </span>
                  {outputDevices.map(device => (
                    <CompactDeviceItem key={device.id} device={device} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact device item component for single-row layout
function CompactDeviceItem({ device }: { device: import('../../utils/midi').MidiDevice }) {
  const isConnected = device.state === 'connected';
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.25rem 0.5rem',
      background: isConnected ? 'var(--color-bg-secondary)' : 'var(--color-bg-primary)',
      borderRadius: '3px',
      border: `1px solid ${isConnected ? 'var(--color-border-light)' : 'var(--color-border-subtle)'}`,
      transition: 'all 0.2s ease',
      fontSize: '0.7rem'
    }}>
      {/* Connection Status */}
      <div style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: isConnected ? 'var(--color-interactive-focus)' : 'var(--color-text-secondary)',
        flexShrink: 0,
        transition: 'all 0.2s ease'
      }}></div>

      {/* Device Name */}
      <span style={{
        color: 'var(--color-text-primary)',
        fontWeight: 500,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '120px'
      }}>
        {device.name}
      </span>

      {/* Device Type Badge */}
      <span style={{
        fontSize: '0.65rem',
        color: isConnected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        fontWeight: 600,
        flexShrink: 0
      }}>
        {device.type}
      </span>
    </div>
  );
}

 