import { describe, it, expect } from 'vitest'
import { MIDI_UTILS } from '../../utils/midi'

// Only keep tests for MIDI_UTILS and note name/number conversion utilities

describe('MIDI Utilities', () => {
  describe('Note Name Conversion', () => {
    it('should convert MIDI note to note name using C3 = 60 convention', () => {
      expect(MIDI_UTILS.midiNoteToName(60)).toBe('C3')
      expect(MIDI_UTILS.midiNoteToName(72)).toBe('C4')
      expect(MIDI_UTILS.midiNoteToName(84)).toBe('C5')
      expect(MIDI_UTILS.midiNoteToName(61)).toBe('C#3')
      expect(MIDI_UTILS.midiNoteToName(62)).toBe('D3')
    })

    it('should convert note name to MIDI note using C3 = 60 convention', () => {
      expect(MIDI_UTILS.noteNameToMidi('C3')).toBe(60)
      expect(MIDI_UTILS.noteNameToMidi('C4')).toBe(72)
      expect(MIDI_UTILS.noteNameToMidi('C5')).toBe(84)
      expect(MIDI_UTILS.noteNameToMidi('C#3')).toBe(61)
      expect(MIDI_UTILS.noteNameToMidi('D3')).toBe(62)
    })

    it('should handle negative octaves', () => {
      expect(MIDI_UTILS.noteNameToMidi('C-2')).toBe(0)
      expect(MIDI_UTILS.noteNameToMidi('C-1')).toBe(12)
      expect(MIDI_UTILS.noteNameToMidi('C0')).toBe(24)
    })

    it('should handle high octaves', () => {
      expect(MIDI_UTILS.noteNameToMidi('C8')).toBe(120)
      expect(MIDI_UTILS.noteNameToMidi('G8')).toBe(127)
    })
  })
}) 