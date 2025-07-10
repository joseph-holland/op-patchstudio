// Custom React hook for WebMIDI integration using WebMidi.js
// Provides MIDI device management and event handling for keyboards

import { useState, useEffect, useCallback } from 'react';
import { WebMidi, Input, Output } from 'webmidi';
import type { NoteMessageEvent } from 'webmidi';
import type { MidiEvent, MidiDevice } from '../utils/midi';

export interface WebMidiState {
  isSupported: boolean;
  isInitialized: boolean;
  devices: MidiDevice[];
  isConnecting: boolean;
  error: string | null;
}

export interface WebMidiHookReturn {
  state: WebMidiState;
  initialize: () => Promise<boolean>;
  refreshDevices: () => void;
  onMidiEvent: (callback: (event: MidiEvent) => void, channel?: number) => () => void;
  offMidiEvent: () => void;
  sendNoteOn: (note: number, velocity?: number, channel?: number) => void;
  sendNoteOff: (note: number, velocity?: number, channel?: number) => void;
  sendControlChange: (controller: number, value: number, channel?: number) => void;
}
// Note: All channel parameters use 1-16 numbering (MIDI standard), not 0-15

export function useWebMidi(): WebMidiHookReturn {
  const [state, setState] = useState<WebMidiState>({
    isSupported: WebMidi.supported,
    isInitialized: WebMidi.enabled,
    devices: [],
    isConnecting: false,
    error: null
  });

  // Populate devices if WebMidi is already enabled (e.g., other hook instance enabled earlier)
  useEffect(() => {
    if (WebMidi.enabled && state.devices.length === 0) {
      const devices = getDevicesFromWebMidi();
      setState(prev => ({ ...prev, devices }));
    }
  }, []);

  // Initialize WebMIDI
  const initialize = useCallback(async (): Promise<boolean> => {
    console.log('[MIDI] Starting WebMIDI initialization...');
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // If WebMidi is already enabled, just update the state
      if (WebMidi.enabled) {
        console.log('[MIDI] WebMIDI already enabled, updating device list...');
        const devices = getDevicesFromWebMidi();
        
        setState(prev => ({
          ...prev,
          isInitialized: true,
          isConnecting: false,
          devices,
          error: null
        }));

        return true;
      }

      console.log('[MIDI] Enabling WebMIDI...');
      await WebMidi.enable();
      console.log('[MIDI] WebMIDI enabled successfully');
      
      const devices = getDevicesFromWebMidi();
      
      setState(prev => ({
        ...prev,
        isInitialized: true,
        isConnecting: false,
        devices,
        error: null
      }));

      return true;
    } catch (error) {
      console.error('[MIDI] Initialization failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: errorMessage
      }));
      return false;
    }
  }, []);

  // Auto-initialize if WebMidi is already enabled and periodic device state check
  useEffect(() => {
    if (WebMidi.enabled && !state.isInitialized) {
      const devices = getDevicesFromWebMidi();
      setState(prev => ({
        ...prev,
        isInitialized: true,
        devices,
        error: null
      }));
    }

    // Periodic device state check as a fallback for missed portschanged events
    // This is less frequent now since we rely more on event-driven updates
    const interval = setInterval(() => {
      if (WebMidi.enabled) {
        const currentDevices = getDevicesFromWebMidi();
        setState(prev => {
          // Only update if device list has actually changed
          const hasChanged = currentDevices.length !== prev.devices.length ||
            currentDevices.some((device, index) => 
              !prev.devices[index] || 
              prev.devices[index].state !== device.state ||
              prev.devices[index].id !== device.id
            );
          
          if (hasChanged) {
            console.log('[MIDI] Fallback device state check detected changes, updating...');
            return { ...prev, devices: currentDevices };
          }
          return prev;
        });
      }
    }, 8000); // Check every 8 seconds (optimized from 1 second)

    return () => clearInterval(interval);
  }, [state.isInitialized]);

  // Convert WebMidi.js devices to our format
  const getDevicesFromWebMidi = (): MidiDevice[] => {
    const devices: MidiDevice[] = [];
    
    // Add input devices
    WebMidi.inputs.forEach((input: Input) => {
      // More robust connection state detection
      let connectionState: 'connected' | 'disconnected' | 'error' = 'disconnected';
      
      if (input.connection === 'open') {
        connectionState = 'connected';
      } else if (input.connection === 'closed') {
        connectionState = 'disconnected';
      } else if (input.connection === 'pending') {
        // Treat pending as connected since it's in the process of connecting
        connectionState = 'connected';
      } else {
        connectionState = 'error';
      }

      devices.push({
        id: input.id,
        name: input.name || 'Unknown Input',
        manufacturer: input.manufacturer || 'Unknown',
        type: 'input',
        state: connectionState
      });
    });

    // Add output devices
    WebMidi.outputs.forEach((output: Output) => {
      // More robust connection state detection
      let connectionState: 'connected' | 'disconnected' | 'error' = 'disconnected';
      
      if (output.connection === 'open') {
        connectionState = 'connected';
      } else if (output.connection === 'closed') {
        connectionState = 'disconnected';
      } else if (output.connection === 'pending') {
        // Treat pending as connected since it's in the process of connecting
        connectionState = 'connected';
      } else {
        connectionState = 'error';
      }

      devices.push({
        id: output.id,
        name: output.name || 'Unknown Output',
        manufacturer: output.manufacturer || 'Unknown',
        type: 'output',
        state: connectionState
      });
    });

    console.log(`[MIDI] Found ${WebMidi.inputs.length} input(s) and ${WebMidi.outputs.length} output(s)`);
    if (devices.length > 0) {
      devices.forEach(device => {
        console.log(`[MIDI] ${device.type.toUpperCase()}: ${device.name} (${device.state})`);
      });
    }

    return devices;
  };

  // Event-driven device listener - primary mechanism for device state changes
  // This is more efficient than polling and should catch most device changes
  useEffect(() => {
    const handlePortsChanged = () => {
      console.log('[MIDI] Event-driven device list change detected, updating...');
      setState(prev => ({ 
        ...prev, 
        devices: getDevicesFromWebMidi(),
        isInitialized: WebMidi.enabled
      }));
    };

    // Add listener immediately if WebMidi is already enabled
    if (WebMidi.enabled) {
      WebMidi.addListener('portschanged', handlePortsChanged);
    }

    // Also set up a listener for when WebMidi becomes enabled
    const handleEnabled = () => {
      console.log('[MIDI] WebMidi enabled, setting up event-driven device listener...');
      WebMidi.addListener('portschanged', handlePortsChanged);
      // Immediately update device list when enabled
      setState(prev => ({ 
        ...prev, 
        devices: getDevicesFromWebMidi(),
        isInitialized: true
      }));
    };

    // Listen for WebMidi enable events
    WebMidi.addListener('enabled', handleEnabled);

    return () => {
      if (WebMidi.enabled) {
        WebMidi.removeListener('portschanged', handlePortsChanged);
      }
      WebMidi.removeListener('enabled', handleEnabled);
    };
  }, []);

  // MIDI event handlers
  const onMidiEvent = useCallback((callback: (event: MidiEvent) => void, channel?: number) => {
    // console.log(`[MIDI] Setting up event listener for channel: ${channel || 'all'}`);

    const handler = (event: NoteMessageEvent) => {
      // console.log(`[MIDI] Raw event received:`, {
      //   type: event.type,
      //   note: event.note?.number,
      //   velocity: event.rawValue,
      //   channel: event.message?.channel,
      //   target: event.target?.number,
      //   message: event.message?.channel
      // });

      // Derive the MIDI channel as reliably as possible.
      // Priority:
      // 1. Explicit channel passed to onMidiEvent()
      // 2. event.message.channel (available on WebMidi.js v3 events)
      // 3. event.target?.number (InputChannel objects expose their channel number)
      const derivedChannel =
        channel ??
        event.message?.channel ??
        (event.target && 'number' in event.target ? event.target.number : undefined);

      const midiEvent: MidiEvent = {
        type: event.type as 'noteon' | 'noteoff',
        note: event.note.number,
        velocity: event.rawValue || 0,
        channel: derivedChannel, // 1-16 (may be undefined for non-channel messages)
        timestamp: event.timestamp,
      };

      // console.log(`[MIDI] Processed event:`, midiEvent);
      callback(midiEvent);
    };

    WebMidi.inputs.forEach((input: Input) => {
      // console.log(`[MIDI] Adding listeners to input: ${input.name}`);
      // If a specific channel (1-16) is provided, listen on that channel.
      // Otherwise, listen on the entire input (all channels).
      if (channel && channel >= 1 && channel <= 16) {
        const inputChannel = input.channels[channel];
        inputChannel.addListener('noteon', handler);
        inputChannel.addListener('noteoff', handler);
      } else {
        input.addListener('noteon', handler);
        input.addListener('noteoff', handler);
      }
    });

    // Return a cleanup function
    return () => {
      // console.log(`[MIDI] Removing event listener for channel: ${channel || 'all'}`);
      WebMidi.inputs.forEach((input: Input) => {
        if (channel && channel >= 1 && channel <= 16) {
          const inputChannel = input.channels[channel];
          inputChannel.removeListener('noteon', handler);
          inputChannel.removeListener('noteoff', handler);
        } else {
          input.removeListener('noteon', handler);
          input.removeListener('noteoff', handler);
        }
      });
    };
  }, []);

  const offMidiEvent = useCallback(() => {
    // This is more complex to implement correctly with the current onMidiEvent structure.
    // For now, the cleanup function returned by onMidiEvent should be used.
    console.warn('[useWebMidi] offMidiEvent is not fully implemented. Use the cleanup function from onMidiEvent.');
  }, []);

  // MIDI output functions - all use 1-16 channel numbering for consistency
  const sendNoteOn = useCallback((note: number, velocity: number = 127, channel: number = 1) => {
    WebMidi.outputs.forEach((output: Output) => {
      output.channels[channel]?.sendNoteOn(note, { rawAttack: velocity });
    });
  }, []);

  const sendNoteOff = useCallback((note: number, velocity: number = 0, channel: number = 1) => {
    WebMidi.outputs.forEach((output: Output) => {
      output.channels[channel]?.sendNoteOff(note, { rawRelease: velocity });
    });
  }, []);

  const sendControlChange = useCallback((controller: number, value: number, channel: number = 1) => {
    WebMidi.outputs.forEach((output: Output) => {
      output.channels[channel]?.sendControlChange(controller, value);
    });
  }, []);

  // Force refresh devices - useful for manual device detection
  const refreshDevices = useCallback(() => {
    console.log('[MIDI] Manual device refresh requested...');
    if (WebMidi.enabled) {
      const devices = getDevicesFromWebMidi();
      setState(prev => ({ ...prev, devices }));
    }
  }, []);

  return {
    state,
    initialize,
    refreshDevices,
    onMidiEvent,
    offMidiEvent,
    sendNoteOn,
    sendNoteOff,
    sendControlChange
  };
} 