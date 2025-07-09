// Custom React hook for WebMIDI integration
// Provides MIDI device management and event handling for keyboards

import { useState, useEffect, useCallback } from 'react';
import { webMidiManager } from '../utils/midi';
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
  onMidiEvent: (callback: (event: MidiEvent) => void, channel?: number) => void;
  offMidiEvent: (callback: (event: MidiEvent) => void) => void;
  sendNoteOn: (note: number, velocity?: number, channel?: number) => void;
  sendNoteOff: (note: number, velocity?: number, channel?: number) => void;
  sendControlChange: (controller: number, value: number, channel?: number) => void;
}

export function useWebMidi(): WebMidiHookReturn {
  const [state, setState] = useState<WebMidiState>({
    isSupported: webMidiManager.isWebMidiSupported(),
    isInitialized: webMidiManager.isWebMidiInitialized(),
    devices: [],
    isConnecting: false,
    error: null
  });

  // Initialize WebMIDI
  const initialize = useCallback(async (): Promise<boolean> => {
    if (state.isInitialized) return true;

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const success = await webMidiManager.initialize();
      
      setState(prev => ({
        ...prev,
        isInitialized: success,
        isConnecting: false,
        devices: webMidiManager.getDevices(),
        error: success ? null : 'Failed to initialize WebMIDI'
      }));

      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: errorMessage
      }));
      return false;
    }
  }, [state.isInitialized]);

  // Device listener
  useEffect(() => {
    const deviceListener = (devices: MidiDevice[]) => {
      setState(prev => ({ 
        ...prev, 
        devices,
        isInitialized: webMidiManager.isWebMidiInitialized() // Update initialization status when devices change
      }));
    };

    webMidiManager.addDeviceListener(deviceListener);

    return () => {
      webMidiManager.removeDeviceListener(deviceListener);
    };
  }, []);

  // MIDI event handlers
  const onMidiEvent = useCallback((callback: (event: MidiEvent) => void, channel?: number) => {
    console.log(`Adding MIDI event listener for channel ${channel !== undefined ? channel + 1 : 'all'}`); // Debug logging
    
    // Create a filtered callback if channel is specified
    const filteredCallback = channel !== undefined 
      ? (event: MidiEvent) => {
          if (event.channel === channel) {
            callback(event);
          }
        }
      : callback;
    
    webMidiManager.addEventListener(filteredCallback);
  }, []);

  const offMidiEvent = useCallback((callback: (event: MidiEvent) => void) => {
    console.log('Removing MIDI event listener'); // Debug logging
    webMidiManager.removeEventListener(callback);
  }, []);

  // MIDI output functions
  const sendNoteOn = useCallback((note: number, velocity: number = 127, channel: number = 0) => {
    webMidiManager.sendNoteOn(note, velocity, channel);
  }, []);

  const sendNoteOff = useCallback((note: number, velocity: number = 0, channel: number = 0) => {
    webMidiManager.sendNoteOff(note, velocity, channel);
  }, []);

  const sendControlChange = useCallback((controller: number, value: number, channel: number = 0) => {
    webMidiManager.sendControlChange(controller, value, channel);
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