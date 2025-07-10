// Custom React hook for WebMIDI integration using WebMidi.js
// Provides MIDI device management and event handling for keyboards

import { useState, useEffect, useCallback } from 'react';
import { WebMidi } from 'webmidi';
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
  onMidiEvent: (callback: (event: MidiEvent) => void, channel?: number) => () => void;
  offMidiEvent: () => void;
  sendNoteOn: (note: number, velocity?: number, channel?: number) => void;
  sendNoteOff: (note: number, velocity?: number, channel?: number) => void;
  sendControlChange: (controller: number, value: number, channel?: number) => void;
}

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

  // Auto-initialize if WebMidi is already enabled
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
  }, [state.isInitialized]);

  // Convert WebMidi.js devices to our format
  const getDevicesFromWebMidi = (): MidiDevice[] => {
    const devices: MidiDevice[] = [];
    
    // Add input devices
    WebMidi.inputs.forEach((input: any) => {
      devices.push({
        id: input.id,
        name: input.name || 'Unknown Input',
        manufacturer: input.manufacturer || 'Unknown',
        type: 'input',
        state: input.connection === 'open' ? 'connected' : 'disconnected'
      });
    });

    // Add output devices
    WebMidi.outputs.forEach((output: any) => {
      devices.push({
        id: output.id,
        name: output.name || 'Unknown Output',
        manufacturer: output.manufacturer || 'Unknown',
        type: 'output',
        state: output.connection === 'open' ? 'connected' : 'disconnected'
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

  // Device listener
  useEffect(() => {
    const handlePortsChanged = () => {
      console.log('[MIDI] Device list changed, updating...');
      setState(prev => ({ 
        ...prev, 
        devices: getDevicesFromWebMidi(),
        isInitialized: WebMidi.enabled
      }));
    };

    if (WebMidi.enabled) {
      WebMidi.addListener('portschanged', handlePortsChanged);
    }

    return () => {
      if (WebMidi.enabled) {
        WebMidi.removeListener('portschanged', handlePortsChanged);
      }
    };
  }, []);

  // MIDI event handlers
  const onMidiEvent = useCallback((callback: (event: MidiEvent) => void, channel?: number) => {
    // console.log(`[MIDI] Setting up event listener for channel: ${channel || 'all'}`);

    const handler = (event: any) => {
      // console.log(`[MIDI] Raw event received:`, {
      //   type: event.type,
      //   note: event.note?.number,
      //   velocity: event.rawVelocity,
      //   channel: event.channel,
      //   target: event.target?.number,
      //   message: event.message?.channel
      // });

      // Derive the MIDI channel as reliably as possible.
      // Priority:
      // 1. Explicit channel passed to onMidiEvent()
      // 2. event.channel (only defined when listening on a specific InputChannel)
      // 3. event.message?.channel (available on WebMidi.js v3 events)
      // 4. event.target?.number (InputChannel objects expose their channel number)
      const derivedChannel =
        channel ??
        event.channel ??
        (event.message && typeof event.message.channel === 'number' ? event.message.channel : undefined) ??
        (event.target && typeof event.target.number === 'number' ? event.target.number : undefined);

      const midiEvent: MidiEvent = {
        type: event.type,
        note: event.note.number,
        velocity: event.rawVelocity || 0,
        channel: derivedChannel, // 1-16 (may be undefined for non-channel messages)
        timestamp: event.timestamp,
      };

      // console.log(`[MIDI] Processed event:`, midiEvent);
      callback(midiEvent);
    };

    WebMidi.inputs.forEach(input => {
      // console.log(`[MIDI] Adding listeners to input: ${input.name}`);
      // If a specific channel (1-16) is provided, listen on that channel.
      // Otherwise, listen on the entire input (all channels).
      const target = (channel && channel >= 1 && channel <= 16)
        ? input.channels[channel]
        : input;
      
      (target as any).addListener('noteon', handler);
      (target as any).addListener('noteoff', handler);
    });

    // Return a cleanup function
    return () => {
      // console.log(`[MIDI] Removing event listener for channel: ${channel || 'all'}`);
      WebMidi.inputs.forEach(input => {
        const target = (channel && channel >= 1 && channel <= 16)
          ? input.channels[channel]
          : input;
        
        (target as any).removeListener('noteon', handler);
        (target as any).removeListener('noteoff', handler);
      });
    };
  }, []);

  const offMidiEvent = useCallback(() => {
    // This is more complex to implement correctly with the current onMidiEvent structure.
    // For now, the cleanup function returned by onMidiEvent should be used.
    console.warn('[useWebMidi] offMidiEvent is not fully implemented. Use the cleanup function from onMidiEvent.');
  }, []);

  // MIDI output functions
  const sendNoteOn = useCallback((note: number, velocity: number = 127, channel: number = 0) => {
    WebMidi.outputs.forEach((output: any) => {
      output.channels[channel + 1]?.sendNoteOn(note, { rawAttack: velocity });
    });
  }, []);

  const sendNoteOff = useCallback((note: number, velocity: number = 0, channel: number = 0) => {
    WebMidi.outputs.forEach((output: any) => {
      output.channels[channel + 1]?.sendNoteOff(note, { rawRelease: velocity });
    });
  }, []);

  const sendControlChange = useCallback((controller: number, value: number, channel: number = 0) => {
    WebMidi.outputs.forEach((output: any) => {
      output.channels[channel + 1]?.sendControlChange(controller, value);
    });
  }, []);

  return {
    state,
    initialize,
    onMidiEvent,
    offMidiEvent,
    sendNoteOn,
    sendNoteOff,
    sendControlChange
  };
} 