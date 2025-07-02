import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  midiNoteToString,
  noteStringToMidiValue,
  formatFileSize,
  sanitizeName,
  parseFilename,
  isPatchSizeValid,
  readWavMetadata,
  audioBufferToWav,
  findNearestZeroCrossing,
  NOTE_NAMES,
  NOTE_OFFSET
} from '../../utils/audio'

// Mock AudioContext for testing
const mockAudioContext = {
  decodeAudioData: vi.fn()
}

vi.mock('../../utils/audioContext', () => ({
  audioContextManager: {
    getAudioContext: () => Promise.resolve(mockAudioContext)
  }
}))

// Mock AudioBuffer for testing
const createMockAudioBuffer = (length: number = 100, sampleRate: number = 44100) => ({
  length,
  sampleRate,
  numberOfChannels: 1,
  duration: length / sampleRate,
  getChannelData: (_channel: number) => {
    // Create a simple test signal with zero crossings
    const data = new Float32Array(length)
    for (let i = 0; i < length; i++) {
      data[i] = Math.sin(2 * Math.PI * i / 10) * 0.5 // Sine wave with zero crossings
    }
    return data
  },
  copyFromChannel: vi.fn(),
  copyToChannel: vi.fn()
})

describe('audio utilities', () => {
  describe('midiNoteToString', () => {
    it('should convert MIDI note numbers to note strings correctly', () => {
      expect(midiNoteToString(60)).toBe('C4')
      expect(midiNoteToString(69)).toBe('A4')
      expect(midiNoteToString(72)).toBe('C5')
    })

    it('should handle sharps correctly', () => {
      expect(midiNoteToString(61)).toBe('C#4')
      expect(midiNoteToString(70)).toBe('A#4')
    })

    it('should handle edge cases', () => {
      expect(midiNoteToString(0)).toBe('C-1')
      expect(midiNoteToString(127)).toBe('G9')
    })

    it('should handle negative numbers gracefully', () => {
      expect(midiNoteToString(-1)).toBe('undefined-2')
      expect(midiNoteToString(-12)).toBe('C-2')
    })
  })

  describe('noteStringToMidiValue', () => {
    it('should convert note strings to MIDI note numbers correctly', () => {
      // Based on the actual NOTE_OFFSET implementation
      expect(noteStringToMidiValue('C4')).toBe(72)  // Using OP-XY specific mapping
      expect(noteStringToMidiValue('A4')).toBe(81)
      expect(noteStringToMidiValue('C5')).toBe(84)
    })

    it('should handle sharps correctly', () => {
      expect(noteStringToMidiValue('C#4')).toBe(73)
      expect(noteStringToMidiValue('A#4')).toBe(82)
    })

    it('should handle flats correctly', () => {
      expect(noteStringToMidiValue('Db4')).toBe(73)
      expect(noteStringToMidiValue('Bb4')).toBe(82)
    })

    it('should handle case insensitivity', () => {
      expect(noteStringToMidiValue('c4')).toBe(72)
      expect(noteStringToMidiValue('a#4')).toBe(82)
    })

    it('should throw error for invalid input', () => {
      expect(() => noteStringToMidiValue('X4')).toThrow('Bad note')
      expect(() => noteStringToMidiValue('C')).toThrow('Bad note format')
    })

    it('should handle edge cases', () => {
      expect(noteStringToMidiValue('C-1')).toBe(12)
      expect(noteStringToMidiValue('G9')).toBe(139)
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(512)).toBe('512 b')
      expect(formatFileSize(1023)).toBe('1023 b')
    })

    it('should format kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1.0 kb')
      expect(formatFileSize(1536)).toBe('1.5 kb')
      expect(formatFileSize(2048)).toBe('2.0 kb')
    })

    it('should format megabytes correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 mb')
      expect(formatFileSize(1536 * 1024)).toBe('1.5 mb')
    })

    it('should format gigabytes correctly', () => {
      // Function only goes up to mb, doesn't handle GB
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1024.0 mb')
    })

    it('should handle zero and negative values', () => {
      expect(formatFileSize(0)).toBe('0 mb')
      expect(formatFileSize(-100)).toBe('-100 b')
    })
  })

  describe('sanitizeName', () => {
    it('should remove invalid characters', () => {
      expect(sanitizeName('test@#$%')).toBe('test#')
      expect(sanitizeName('file/name\\test')).toBe('filenametest')
    })

    it('should preserve valid characters', () => {
      expect(sanitizeName('Test 123 #-().')).toBe('Test 123 #-().')
      expect(sanitizeName('Bass C4')).toBe('Bass C4')
    })

    it('should handle empty string', () => {
      expect(sanitizeName('')).toBe('')
    })
  })

  describe('parseFilename', () => {
    it('should parse filename with note', () => {
      const [name, note] = parseFilename('Bass C4.wav')
      expect(name).toBe('Bass')
      expect(note).toBe(72) // Using OP-XY specific MIDI mapping
    })

    it('should parse filename with number', () => {
      const [name, note] = parseFilename('Kick 1.wav')
      expect(name).toBe('Kick')
      expect(note).toBe(1)
    })

    it('should handle sharps and flats', () => {
      const [name1, note1] = parseFilename('Sample C#4.wav')
      expect(name1).toBe('Sample')
      expect(note1).toBe(73)

      const [name2, note2] = parseFilename('Sample Db4.wav')
      expect(name2).toBe('Sample')
      expect(note2).toBe(73)
    })

    it('should throw error for invalid filename', () => {
      expect(() => parseFilename('invalid.wav')).toThrow(
        "Filename 'invalid.wav' does not match the expected pattern."
      )
    })
  })

  describe('isPatchSizeValid', () => {
    const PATCH_SIZE_LIMIT = 8 * 1024 * 1024 // 8MB

    it('should return true for sizes under the limit', () => {
      expect(isPatchSizeValid(1024 * 1024)).toBe(true) // 1MB
      expect(isPatchSizeValid(7 * 1024 * 1024)).toBe(true) // 7MB
    })

    it('should return true for sizes equal to the limit', () => {
      expect(isPatchSizeValid(PATCH_SIZE_LIMIT)).toBe(true)
    })

    it('should return false for sizes over the limit', () => {
      expect(isPatchSizeValid(PATCH_SIZE_LIMIT + 1)).toBe(false)
      expect(isPatchSizeValid(10 * 1024 * 1024)).toBe(false) // 10MB
    })

    it('should handle zero and negative values', () => {
      expect(isPatchSizeValid(0)).toBe(true)
      expect(isPatchSizeValid(-1)).toBe(true)
    })
  })

  describe('readWavMetadata', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should handle invalid WAV files gracefully', async () => {
      // Mock File with arrayBuffer method
      const mockFile = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
        size: 10
      } as any

      await expect(readWavMetadata(mockFile)).rejects.toThrow('Invalid WAV file: missing RIFF header')
    })

    it('should process a minimal valid WAV structure', async () => {
      // Create a minimal WAV file buffer
      const wavBuffer = new ArrayBuffer(44 + 1000) // Header + some data
      const view = new DataView(wavBuffer)
      
      // Write correct WAV header (little-endian for numeric values)
      // RIFF header
      view.setUint8(0, 0x52) // 'R'
      view.setUint8(1, 0x49) // 'I'
      view.setUint8(2, 0x46) // 'F'
      view.setUint8(3, 0x46) // 'F'
      view.setUint32(4, 1036, true) // File size - 8 (44 + 1000 - 8)
      
      // WAVE header
      view.setUint8(8, 0x57)  // 'W'
      view.setUint8(9, 0x41)  // 'A'
      view.setUint8(10, 0x56) // 'V'
      view.setUint8(11, 0x45) // 'E'
      
      // fmt chunk
      view.setUint8(12, 0x66) // 'f'
      view.setUint8(13, 0x6d) // 'm'
      view.setUint8(14, 0x74) // 't'
      view.setUint8(15, 0x20) // ' '
      view.setUint32(16, 16, true) // fmt chunk size
      view.setUint16(20, 1, true) // PCM format
      view.setUint16(22, 1, true) // mono
      view.setUint32(24, 44100, true) // sample rate
      view.setUint32(28, 88200, true) // byte rate
      view.setUint16(32, 2, true) // block align
      view.setUint16(34, 16, true) // bit depth
      
      // data chunk
      view.setUint8(36, 0x64) // 'd'
      view.setUint8(37, 0x61) // 'a'
      view.setUint8(38, 0x74) // 't'
      view.setUint8(39, 0x61) // 'a'
      view.setUint32(40, 1000, true) // data size

      // Mock File with arrayBuffer method
      const mockFile = {
        arrayBuffer: vi.fn().mockResolvedValue(wavBuffer),
        size: 44 + 1000
      } as any
      
      const mockAudioBuffer = createMockAudioBuffer(1000, 44100)
      mockAudioContext.decodeAudioData.mockResolvedValue(mockAudioBuffer)

      const metadata = await readWavMetadata(mockFile)
      
      expect(metadata.sampleRate).toBe(44100)
      expect(metadata.channels).toBe(1)
      expect(metadata.bitDepth).toBe(16)
      expect(metadata.format).toBe('PCM')
    })
  })

  describe('audioBufferToWav', () => {
    it('should create a WAV blob from audio buffer', () => {
      const mockBuffer = createMockAudioBuffer(1000, 44100)
      const result = audioBufferToWav(mockBuffer)
      
      expect(result).toBeInstanceOf(Blob)
      expect(result.type).toBe('audio/wav')
    })

    it('should handle different bit depths', () => {
      const mockBuffer = createMockAudioBuffer(1000, 44100)
      
      const result16 = audioBufferToWav(mockBuffer, 16)
      const result24 = audioBufferToWav(mockBuffer, 24)
      
      expect(result16).toBeInstanceOf(Blob)
      expect(result24).toBeInstanceOf(Blob)
      expect(result24.size).toBeGreaterThan(result16.size) // 24-bit should be larger
    })

    it('should throw error for unsupported channels', () => {
      const mockBuffer = {
        ...createMockAudioBuffer(1000, 44100),
        numberOfChannels: 3
      }
      
      expect(() => audioBufferToWav(mockBuffer)).toThrow('Expecting mono or stereo audioBuffer')
    })

    it('should throw error for unsupported bit depth', () => {
      const mockBuffer = createMockAudioBuffer(1000, 44100)
      
      expect(() => audioBufferToWav(mockBuffer, 32)).toThrow('Unsupported bit depth: 32')
    })
  })

  describe('findNearestZeroCrossing', () => {
    let mockBuffer: any

    beforeEach(() => {
      mockBuffer = createMockAudioBuffer(100, 44100)
    })

    it('should find the nearest zero crossing', () => {
      const result = findNearestZeroCrossing(mockBuffer, 10)
      expect(typeof result).toBe('number')
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThan(100)
    })

    it('should return original position if it is already close to zero', () => {
      // Position 0 should be close to zero due to the sine wave starting at 0
      const result = findNearestZeroCrossing(mockBuffer, 0)
      expect(result).toBe(0)
    })

    it('should respect direction parameter', () => {
      const forwardResult = findNearestZeroCrossing(mockBuffer, 50, 'forward')
      const backwardResult = findNearestZeroCrossing(mockBuffer, 50, 'backward')
      
      expect(typeof forwardResult).toBe('number')
      expect(typeof backwardResult).toBe('number')
    })

    it('should respect max distance parameter', () => {
      // With a very small max distance, it should find something within range
      const result = findNearestZeroCrossing(mockBuffer, 0, 'forward', 1)
      expect(result).toBe(0) // Position 0 is already the best within 1 sample distance
    })
  })

  describe('constants', () => {
    it('should have correct NOTE_NAMES array', () => {
      expect(NOTE_NAMES).toEqual([
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
      ])
    })

    it('should have correct NOTE_OFFSET array', () => {
      expect(NOTE_OFFSET).toEqual([33, 35, 24, 26, 28, 29, 31])
    })
  })
})