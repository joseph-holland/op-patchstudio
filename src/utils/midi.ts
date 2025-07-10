import { MIDI_CONSTANTS } from './constants';
// MIDI event types and device info for use with webmidi.js

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

// (If present) Keep any note name/number conversion utilities, constants, or helpers here for use with webmidi.js
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