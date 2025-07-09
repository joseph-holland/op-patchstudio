// WebMIDI utilities for OP-PatchStudio
// Provides MIDI device connection, event handling, and device management

import { MIDI_CONSTANTS } from './constants';

// MIDI event types
export interface MidiNoteEvent {
  type: 'noteon' | 'noteoff';
  note: number;
  velocity: number;
  channel: number;
  timestamp: number;
}

export interface MidiControlEvent {
  type: 'controlchange';
  controller: number;
  value: number;
  channel: number;
  timestamp: number;
}

export type MidiEvent = MidiNoteEvent | MidiControlEvent;

// MIDI device information
export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  type: 'input' | 'output';
  state: 'connected' | 'disconnected' | 'error';
}

// WebMIDI manager class
class WebMidiManager {
  private static instance: WebMidiManager;
  private midiAccess: any = null;
  private inputDevices: Map<string, any> = new Map();
  private outputDevices: Map<string, any> = new Map();
  private eventListeners: Set<(event: MidiEvent) => void> = new Set();
  private deviceListeners: Set<(devices: MidiDevice[]) => void> = new Set();
  private isSupported: boolean = false;
  private isInitialized: boolean = false;

  private constructor() {
    this.checkSupport();
  }

  public static getInstance(): WebMidiManager {
    if (!WebMidiManager.instance) {
      WebMidiManager.instance = new WebMidiManager();
    }
    return WebMidiManager.instance;
  }

  // Check if WebMIDI is supported in the browser
  private checkSupport(): void {
    this.isSupported = typeof navigator !== 'undefined' && 
                      'requestMIDIAccess' in navigator;
  }

  // Initialize WebMIDI access
  public async initialize(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('WebMIDI is not supported in this browser');
      return false;
    }

    if (this.isInitialized) {
      return true;
    }

    try {
      // Use type assertion to avoid TypeScript conflicts
      const nav = navigator as any;
      this.midiAccess = await nav.requestMIDIAccess({
        sysex: false, // We don't need system exclusive messages
        software: true // Allow software MIDI ports
      });

      this.setupEventListeners();
      this.isInitialized = true;
      
      console.log('WebMIDI initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize WebMIDI:', error);
      return false;
    }
  }

  // Setup MIDI port event listeners
  private setupEventListeners(): void {
    if (!this.midiAccess) return;

    // Handle port connections
    this.midiAccess.onstatechange = (event: any) => {
      const port = event.port;
      this.updateDeviceState(port);
      this.notifyDeviceListeners();
    };

    // Setup existing ports
    this.midiAccess.inputs.forEach((input: any) => {
      this.addInputDevice(input);
    });

    this.midiAccess.outputs.forEach((output: any) => {
      this.addOutputDevice(output);
    });
  }

  // Add an input device
  private addInputDevice(input: any): void {
    this.inputDevices.set(input.id, input);
    
    input.onmidimessage = (event: any) => {
      this.handleMidiMessage(event);
    };

    this.updateDeviceState(input);
  }

  // Add an output device
  private addOutputDevice(output: any): void {
    this.outputDevices.set(output.id, output);
    this.updateDeviceState(output);
  }

  // Update device state
  private updateDeviceState(port: any): void {
    // Update the device in the appropriate map
    if (port.type === 'input') {
      this.inputDevices.set(port.id, port);
    }
    if (port.type === 'output') {
      this.outputDevices.set(port.id, port);
    }
  }

  // Handle incoming MIDI messages
  private handleMidiMessage(event: any): void {
    const data = event.data;
    const timestamp = event.timeStamp;

    if (!data || data.length === 0) {
      return; // Ignore empty messages
    }

    // Only log and process messages with 3 or more bytes (note/control messages)
    if (data.length >= 3) {
      console.log('Raw MIDI message received:', { data, timestamp }); // Debug logging

      // Parse MIDI message
      const status = data[0];
      const channel = status & 0x0F;
      const messageType = status & 0xF0;

      console.log(`MIDI Message - Status: ${status.toString(16)}, Channel: ${channel}, Type: ${messageType.toString(16)}`); // Debug logging

      let midiEvent: MidiEvent | null = null;

      switch (messageType) {
        case 0x80: // Note Off
          midiEvent = {
            type: 'noteoff',
            note: data[1],
            velocity: data[2],
            channel,
            timestamp
          };
          console.log('Note Off event:', midiEvent); // Debug logging
          break;

        case 0x90: // Note On
          const velocity = data[2];
          // Note On with velocity 0 is equivalent to Note Off
          midiEvent = {
            type: velocity === 0 ? 'noteoff' : 'noteon',
            note: data[1],
            velocity,
            channel,
            timestamp
          };
          console.log('Note On event:', midiEvent); // Debug logging
          break;

        case 0xB0: // Control Change
          midiEvent = {
            type: 'controlchange',
            controller: data[1],
            value: data[2],
            channel,
            timestamp
          };
          console.log('Control Change event:', midiEvent); // Debug logging
          break;
      }

      if (midiEvent) {
        console.log('Notifying MIDI event listeners:', midiEvent); // Debug logging
        this.notifyEventListeners(midiEvent);
      }
    } else {
      // Silently ignore system messages (clock, etc.) that are less than 3 bytes
      // These are normal and don't need to be logged
    }
  }

  // Send MIDI message to output devices
  public sendMidiMessage(message: number[]): void {
    this.outputDevices.forEach(output => {
      if (output.state === 'connected') {
        try {
          output.send(message);
        } catch (error) {
          console.error('Failed to send MIDI message:', error);
        }
      }
    });
  }

  // Send note on message
  public sendNoteOn(note: number, velocity: number = 127, channel: number = 0): void {
    const message = [0x90 + channel, note, velocity];
    this.sendMidiMessage(message);
  }

  // Send note off message
  public sendNoteOff(note: number, velocity: number = 0, channel: number = 0): void {
    const message = [0x80 + channel, note, velocity];
    this.sendMidiMessage(message);
  }

  // Send control change message
  public sendControlChange(controller: number, value: number, channel: number = 0): void {
    const message = [0xB0 + channel, controller, value];
    this.sendMidiMessage(message);
  }

  // Get all connected devices
  public getDevices(): MidiDevice[] {
    const devices: MidiDevice[] = [];

    // Add input devices
    this.inputDevices.forEach(input => {
      devices.push({
        id: input.id,
        name: input.name || 'Unknown Input',
        manufacturer: input.manufacturer || 'Unknown',
        type: 'input',
        state: input.state === 'connected' ? 'connected' : 'disconnected'
      });
    });

    // Add output devices
    this.outputDevices.forEach(output => {
      devices.push({
        id: output.id,
        name: output.name || 'Unknown Output',
        manufacturer: output.manufacturer || 'Unknown',
        type: 'output',
        state: output.state === 'connected' ? 'connected' : 'disconnected'
      });
    });

    return devices;
  }

  // Get input devices only
  public getInputDevices(): MidiDevice[] {
    return this.getDevices().filter(device => device.type === 'input');
  }

  // Get output devices only
  public getOutputDevices(): MidiDevice[] {
    return this.getDevices().filter(device => device.type === 'output');
  }

  // Check if WebMIDI is supported
  public isWebMidiSupported(): boolean {
    return this.isSupported;
  }

  // Check if WebMIDI is initialized
  public isWebMidiInitialized(): boolean {
    // Consider initialized if we have MIDI access and devices, even if initialize() wasn't explicitly called
    return this.isInitialized || (this.midiAccess !== null && (this.inputDevices.size > 0 || this.outputDevices.size > 0));
  }

  // Add event listener
  public addEventListener(listener: (event: MidiEvent) => void): void {
    this.eventListeners.add(listener);
  }

  // Remove event listener
  public removeEventListener(listener: (event: MidiEvent) => void): void {
    this.eventListeners.delete(listener);
  }

  // Add device listener
  public addDeviceListener(listener: (devices: MidiDevice[]) => void): void {
    this.deviceListeners.add(listener);
  }

  // Remove device listener
  public removeDeviceListener(listener: (devices: MidiDevice[]) => void): void {
    this.deviceListeners.delete(listener);
  }

  // Notify event listeners
  private notifyEventListeners(event: MidiEvent): void {
    console.log(`Notifying ${this.eventListeners.size} MIDI event listeners`); // Debug logging
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in MIDI event listener:', error);
      }
    });
  }

  // Notify device listeners
  private notifyDeviceListeners(): void {
    const devices = this.getDevices();
    this.deviceListeners.forEach(listener => {
      try {
        listener(devices);
      } catch (error) {
        console.error('Error in device listener:', error);
      }
    });
  }

  // Cleanup
  public cleanup(): void {
    this.eventListeners.clear();
    this.deviceListeners.clear();
    this.inputDevices.clear();
    this.outputDevices.clear();
    this.midiAccess = null;
    this.isInitialized = false;
  }
}

// Export singleton instance
export const webMidiManager = WebMidiManager.getInstance();

// MIDI note mapping utilities
export const MIDI_UTILS = {
  // Convert MIDI note to note name (using C3 = 60 convention)
  midiNoteToName: (note: number): string => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor((note - MIDI_CONSTANTS.C3_NOTE) / 12) + 3;
    const noteName = noteNames[note % 12];
    return `${noteName}${octave}`;
  },

  // Convert note name to MIDI note (using C3 = 60 convention)
  noteNameToMidi: (noteName: string): number => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
    
    if (!match) {
      throw new Error(`Invalid note name: ${noteName}`);
    }

    const [, note, octaveStr] = match;
    const octave = parseInt(octaveStr);
    const noteIndex = noteNames.indexOf(note);
    
    if (noteIndex === -1) {
      throw new Error(`Invalid note: ${note}`);
    }

    return (octave - 3) * 12 + MIDI_CONSTANTS.C3_NOTE + noteIndex;
  },

  // Check if note is in valid MIDI range
  isValidMidiNote: (note: number): boolean => {
    return note >= MIDI_CONSTANTS.MIN_NOTE && note <= MIDI_CONSTANTS.MAX_NOTE;
  },

  // Get note frequency from MIDI note
  midiNoteToFrequency: (note: number): number => {
    return 440 * Math.pow(2, (note - 69) / 12);
  },

  // Get MIDI note from frequency
  frequencyToMidiNote: (frequency: number): number => {
    return Math.round(12 * Math.log2(frequency / 440) + 69);
  }
};

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    webMidiManager.cleanup();
  });
} 