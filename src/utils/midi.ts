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
    if (this.isInitialized) {
      return true;
    }

    if (!this.isSupported) {
      console.error('[MIDI] WebMIDI is not supported in this browser');
      return false;
    }

    try {
      console.log('[MIDI] Initializing WebMIDI...');
      this.midiAccess = await navigator.requestMIDIAccess();
      console.log('[MIDI] WebMIDI access granted');
      
      this.setupEventListeners();
      this.isInitialized = true;
      
      console.log('[MIDI] WebMIDI initialized successfully');
      return true;
    } catch (error) {
      console.error('[MIDI] Failed to initialize WebMIDI:', error);
      return false;
    }
  }

  // Setup event listeners for device changes
  private setupEventListeners(): void {
    if (!this.midiAccess) return;

    // Handle device connections
    this.midiAccess.onstatechange = (event: any) => {
      const port = event.port;
      
      if (port.type === 'input') {
        if (port.connection === 'open') {
          this.addInputDevice(port);
        } else {
          this.updateDeviceState(port);
        }
      } else if (port.type === 'output') {
        if (port.connection === 'open') {
          this.addOutputDevice(port);
        } else {
          this.updateDeviceState(port);
        }
      }
    };

    // Add existing devices
    this.midiAccess.inputs.forEach((input: any) => {
      if (input.connection === 'open') {
        this.addInputDevice(input);
      }
    });

    this.midiAccess.outputs.forEach((output: any) => {
      if (output.connection === 'open') {
        this.addOutputDevice(output);
      }
    });

    console.log(`[MIDI] Found ${this.midiAccess.inputs.size} input(s) and ${this.midiAccess.outputs.size} output(s)`);
  }

  // Add input device
  private addInputDevice(input: any): void {
    this.inputDevices.set(input.id, input);
    console.log(`[MIDI] Input device connected: ${input.name || 'Unknown'}`);
    
    input.onmidimessage = (event: any) => {
      this.handleMidiMessage(event);
    };

    this.updateDeviceState(input);
    this.notifyDeviceListeners();
  }

  // Add output device
  private addOutputDevice(output: any): void {
    this.outputDevices.set(output.id, output);
    console.log(`[MIDI] Output device connected: ${output.name || 'Unknown'}`);
    this.updateDeviceState(output);
    this.notifyDeviceListeners();
  }

  // Update device state
  private updateDeviceState(port: any): void {
    const device = this.inputDevices.get(port.id) || this.outputDevices.get(port.id);
    if (device) {
      const oldState = device.state;
      device.state = port.connection === 'open' ? 'connected' : 'disconnected';
      
      if (oldState !== device.state) {
        console.log(`[MIDI] Device ${device.name || 'Unknown'} ${device.state}`);
        this.notifyDeviceListeners();
      }
    } else {
      // Device not in our maps yet, add it
      if (port.type === 'input') {
        this.addInputDevice(port);
      } else if (port.type === 'output') {
        this.addOutputDevice(port);
      }
    }
  }

  // Handle incoming MIDI messages
  private handleMidiMessage(event: any): void {
    const data = event.data;
    const timestamp = event.timeStamp;

    if (!data || data.length === 0) {
      return; // Ignore empty messages
    }

    // Only process messages with 3 or more bytes (note/control messages)
    if (data.length >= 3) {
      // Parse MIDI message
      const status = data[0];
      const channel = status & 0x0F;
      const messageType = status & 0xF0;

      console.log(`[MIDI] Raw MIDI data:`, { data: Array.from(data), status: status.toString(16), channel, messageType: messageType.toString(16) });

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
          console.log(`[MIDI] Note Off: ${data[1]} (velocity: ${data[2]}, channel: ${channel + 1})`);
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
          if (velocity > 0) {
            console.log(`[MIDI] Note On: ${data[1]} (velocity: ${velocity}, channel: ${channel + 1})`);
          }
          break;

        case 0xB0: // Control Change
          midiEvent = {
            type: 'controlchange',
            controller: data[1],
            value: data[2],
            channel,
            timestamp
          };
          console.log(`[MIDI] Control Change: CC${data[1]} = ${data[2]} (channel: ${channel + 1})`);
          break;
      }

      if (midiEvent) {
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