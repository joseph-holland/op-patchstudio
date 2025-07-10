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
  offMidiEvent: (callback: (event: MidiEvent) => void) => void;
  sendNoteOn: (note: number, velocity?: number, channel?: number) => void;
  sendNoteOff: (note: number, velocity?: number, channel?: number) => void;
  sendControlChange: (controller: number, value: number, channel?: number) => void;
}

export function useWebMidi(): WebMidiHookReturn {
  // Debug: Test WebMidi.js availability
  console.log('[useWebMidi] Hook initialized');
  console.log('[useWebMidi] WebMidi object:', {
    exists: typeof WebMidi !== 'undefined',
    supported: WebMidi?.supported,
    enabled: WebMidi?.enabled,
    inputs: WebMidi?.inputs?.length,
    outputs: WebMidi?.outputs?.length
  });

  const [state, setState] = useState<WebMidiState>({
    isSupported: WebMidi.supported,
    isInitialized: WebMidi.enabled,
    devices: [],
    isConnecting: false,
    error: null
  });

  // Initialize WebMIDI
  const initialize = useCallback(async (): Promise<boolean> => {
    console.log('[WebMidi] Starting initialization...');
    console.log('[WebMidi] Supported:', WebMidi.supported);
    console.log('[WebMidi] Enabled:', WebMidi.enabled);
    
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // If WebMidi is already enabled, just update the state
      if (WebMidi.enabled) {
        console.log('[WebMidi] WebMidi already enabled, updating state...');
        const devices = getDevicesFromWebMidi();
        console.log('[WebMidi] Found devices:', devices);
        
        setState(prev => ({
          ...prev,
          isInitialized: true,
          isConnecting: false,
          devices,
          error: null
        }));

        console.log('[WebMidi] State updated successfully');
        return true;
      }

      console.log('[WebMidi] Calling WebMidi.enable()...');
      await WebMidi.enable();
      console.log('[WebMidi] WebMidi.enable() completed');
      
      const devices = getDevicesFromWebMidi();
      console.log('[WebMidi] Found devices:', devices);
      
      setState(prev => ({
        ...prev,
        isInitialized: true,
        isConnecting: false,
        devices,
        error: null
      }));

      console.log('[WebMidi] Initialization successful');
      return true;
    } catch (error) {
      console.error('[WebMidi] Initialization failed:', error);
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
      console.log('[WebMidi] Auto-initializing (WebMidi already enabled)');
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
    
    console.log('[WebMidi] Getting devices...');
    console.log('[WebMidi] Inputs:', WebMidi.inputs.length);
    console.log('[WebMidi] Outputs:', WebMidi.outputs.length);
    
    // Add input devices
    WebMidi.inputs.forEach((input: any) => {
      console.log('[WebMidi] Input device:', input.name, input.id, input.connection);
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
      console.log('[WebMidi] Output device:', output.name, output.id, output.connection);
      devices.push({
        id: output.id,
        name: output.name || 'Unknown Output',
        manufacturer: output.manufacturer || 'Unknown',
        type: 'output',
        state: output.connection === 'open' ? 'connected' : 'disconnected'
      });
    });

    return devices;
  };

  // Device listener
  useEffect(() => {
    const handlePortsChanged = () => {
      console.log('[WebMidi] Ports changed event received');
      setState(prev => ({ 
        ...prev, 
        devices: getDevicesFromWebMidi(),
        isInitialized: WebMidi.enabled
      }));
    };

    if (WebMidi.enabled) {
      console.log('[WebMidi] Adding portschanged listener');
      WebMidi.addListener('portschanged', handlePortsChanged);
    }

    return () => {
      if (WebMidi.enabled) {
        console.log('[WebMidi] Removing portschanged listener');
        WebMidi.removeListener('portschanged', handlePortsChanged);
      }
    };
  }, []);

  // MIDI event handlers
  const onMidiEvent = useCallback((callback: (event: MidiEvent) => void, channel?: number) => {
    console.log(`[WebMidi] Adding MIDI event listener for channel ${channel !== undefined ? channel : 'all'}`);
    console.log('[WebMidi] Channel parameter:', channel, 'Type:', typeof channel, 'Is undefined:', channel === undefined);
    console.log('[WebMidi] Available inputs:', WebMidi.inputs.length);
    
    // Create a unique ID for this callback
    const callbackId = Math.random().toString(36).substr(2, 9);
    
    // Create a filtered callback if channel is specified
    console.log('[WebMidi] Creating callback - channel !== undefined:', channel !== undefined);
    const extractEventChannel = (event: any) => {
      if (typeof event.channel === 'number') return event.channel;
      if (typeof event.message?.channel === 'number') return event.message.channel;
      if (typeof event.target?.number === 'number') return event.target.number;
      return 1;
    };
    const filteredCallback = channel !== undefined 
      ? (event: any) => {
          console.log('[WebMidi] MIDI event received (filtered):', event);
          console.log('[WebMidi] Event structure:', {
            target: event.target,
            channel: event.channel,
            targetNumber: event.target?.number,
            message: event.message
          });
          const eventChannel = extractEventChannel(event);
          console.log('[WebMidi] Event channel:', eventChannel, 'Expected channel:', channel);
          if (eventChannel === channel) { // Both are 1-based (1-16)
            const midiEvent: MidiEvent = {
              type: event.type,
              note: event.note.number,
              velocity: event.rawVelocity,
              channel: eventChannel, // 1-based (1-16)
              timestamp: event.timestamp
            };
            console.log('[WebMidi] Calling callback with event:', midiEvent);
            callback(midiEvent);
          }
        }
      : (event: any) => {
          console.log('[WebMidi] MIDI event received (unfiltered):', event);
          console.log('[WebMidi] Event structure:', {
            target: event.target,
            channel: event.channel,
            targetNumber: event.target?.number,
            message: event.message
          });
          const eventChannel = extractEventChannel(event);
          console.log('[WebMidi] Event channel:', eventChannel);
          const midiEvent: MidiEvent = {
            type: event.type,
            note: event.note.number,
            velocity: event.rawVelocity,
                          channel: eventChannel, // 1-based (1-16)
            timestamp: event.timestamp
          };
          console.log('[WebMidi] Calling callback with event:', midiEvent);
          callback(midiEvent);
        };
    
    // Store the callback with its ID for cleanup
    (filteredCallback as any).callbackId = callbackId;
    
    // Add listener to all inputs
    WebMidi.inputs.forEach((input: any) => {
      console.log(`[WebMidi] Adding listeners to input: ${input.name}`);
      // Only add the appropriate callback based on whether channel filtering is needed
      input.addListener('noteon', filteredCallback);
      input.addListener('noteoff', filteredCallback);
    });
    
    // Return cleanup function
    return () => {
      console.log('[WebMidi] Cleaning up MIDI event listeners for callback:', callbackId);
      WebMidi.inputs.forEach((input: any) => {
        input.removeListener('noteon', filteredCallback);
        input.removeListener('noteoff', filteredCallback);
      });
    };
  }, []);

  const offMidiEvent = useCallback((_callback: (event: MidiEvent) => void) => {
    console.log('[WebMidi] Removing MIDI event listener (deprecated - use cleanup function)');
    // This function is deprecated - use the cleanup function returned by onMidiEvent instead
  }, []);

  // MIDI output functions
  const sendNoteOn = useCallback((note: number, velocity: number = 127, channel: number = 0) => {
    console.log(`[WebMidi] Sending Note On: note=${note}, velocity=${velocity}, channel=${channel}`);
    WebMidi.outputs.forEach((output: any) => {
      output.channels[channel + 1]?.sendNoteOn(note, { rawAttack: velocity });
    });
  }, []);

  const sendNoteOff = useCallback((note: number, velocity: number = 0, channel: number = 0) => {
    console.log(`[WebMidi] Sending Note Off: note=${note}, velocity=${velocity}, channel=${channel}`);
    WebMidi.outputs.forEach((output: any) => {
      output.channels[channel + 1]?.sendNoteOff(note, { rawRelease: velocity });
    });
  }, []);

  const sendControlChange = useCallback((controller: number, value: number, channel: number = 0) => {
    console.log(`[WebMidi] Sending Control Change: controller=${controller}, value=${value}, channel=${channel}`);
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