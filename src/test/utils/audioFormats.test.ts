import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  readAudioMetadata,
  readAudioMetadataFromArrayBuffer,
  detectAudioFormat,
  isValidAudioFile,
  audioBufferToWavWithMetadata,
  type AudioMetadata
} from '../../utils/audioFormats'

// Mock AudioContext for testing
const mockAudioContext = {
  decodeAudioData: vi.fn(),
  createBuffer: vi.fn((channels, length, sampleRate) => ({
    length,
    sampleRate,
    numberOfChannels: channels,
    duration: length / sampleRate,
    getChannelData: (_channel: number) => {
      const data = new Float32Array(length);
      // Return silent buffer by default
      return data;
    },
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn()
  })),
  createDynamicsCompressor: vi.fn(() => ({
    threshold: { value: 0 },
    knee: { value: 0 },
    ratio: { value: 0 },
    attack: { value: 0 },
    release: { value: 0 },
    connect: vi.fn(),
    reduction: 0,
    channelCount: 2,
    channelCountMode: 'max' as ChannelCountMode,
    channelInterpretation: 'speakers' as ChannelInterpretation,
    context: undefined as unknown as BaseAudioContext,
    numberOfInputs: 1,
    numberOfOutputs: 1,
    disconnect: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })),
}

vi.mock('../../utils/audioContext', () => ({
  audioContextManager: {
    getAudioContext: () => Promise.resolve(mockAudioContext),
    createOfflineContext: vi.fn(),
  }
}))

// Mock the audio utility functions
vi.mock('../../utils/audio', () => ({
  readWavMetadataFromArrayBuffer: vi.fn(),
  parseFilename: vi.fn(),
  audioBufferToWav: vi.fn(() => new Blob(['mock wav data'], { type: 'audio/wav' }))
}))

describe('audioFormats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mock behavior
    mockAudioContext.decodeAudioData.mockResolvedValue({
      length: 44100,
      sampleRate: 44100,
      numberOfChannels: 1,
      duration: 1.0,
      getChannelData: () => new Float32Array(44100),
      copyFromChannel: vi.fn(),
      copyToChannel: vi.fn()
    })
  })

  describe('detectAudioFormat', () => {
    it('should detect WAV format from header', () => {
      const wavHeader = new ArrayBuffer(44)
      
      // Write RIFF header
      const textEncoder = new TextEncoder()
      const riffBytes = textEncoder.encode('RIFF')
      new Uint8Array(wavHeader, 0, 4).set(riffBytes)
      
      const format = detectAudioFormat(wavHeader, 'test.wav')
      expect(format).toBe('wav')
    })

    it('should detect AIFF format from header', () => {
      const aiffHeader = new ArrayBuffer(44)
      
      // Write FORM header
      const textEncoder = new TextEncoder()
      const formBytes = textEncoder.encode('FORM')
      new Uint8Array(aiffHeader, 0, 4).set(formBytes)
      
      const format = detectAudioFormat(aiffHeader, 'test.aiff')
      expect(format).toBe('aiff')
    })

    it('should detect MP3 format from header', () => {
      const mp3Header = new ArrayBuffer(44)
      
      // Write ID3 header
      const textEncoder = new TextEncoder()
      const id3Bytes = textEncoder.encode('ID3')
      new Uint8Array(mp3Header, 0, 4).set(id3Bytes)
      
      const format = detectAudioFormat(mp3Header, 'test.mp3')
      expect(format).toBe('mp3')
    })

    it('should detect format from file extension when header is not recognized', () => {
      const unknownHeader = new ArrayBuffer(44)
      
      expect(detectAudioFormat(unknownHeader, 'test.wav')).toBe('wav')
      expect(detectAudioFormat(unknownHeader, 'test.aif')).toBe('aiff')
      expect(detectAudioFormat(unknownHeader, 'test.aiff')).toBe('aiff')
      expect(detectAudioFormat(unknownHeader, 'test.mp3')).toBe('mp3')
      expect(detectAudioFormat(unknownHeader, 'test.m4a')).toBe('m4a')
      expect(detectAudioFormat(unknownHeader, 'test.ogg')).toBe('ogg')
      expect(detectAudioFormat(unknownHeader, 'test.flac')).toBe('flac')
    })

    it('should throw error for unsupported format', () => {
      const unknownHeader = new ArrayBuffer(44)
      
      expect(() => detectAudioFormat(unknownHeader, 'test.xyz')).toThrow('Unsupported audio format: xyz')
    })
  })

  describe('isValidAudioFile', () => {
    it('should validate audio files by MIME type', () => {
      const validFiles = [
        new File([''], 'test.wav', { type: 'audio/wav' }),
        new File([''], 'test.aiff', { type: 'audio/aiff' }),
        new File([''], 'test.mp3', { type: 'audio/mpeg' }),
        new File([''], 'test.m4a', { type: 'audio/mp4' }),
        new File([''], 'test.ogg', { type: 'audio/ogg' }),
        new File([''], 'test.flac', { type: 'audio/flac' })
      ]

      validFiles.forEach(file => {
        expect(isValidAudioFile(file)).toBe(true)
      })
    })

    it('should validate audio files by extension', () => {
      const validFiles = [
        new File([''], 'test.wav', { type: 'application/octet-stream' }),
        new File([''], 'test.aif', { type: 'application/octet-stream' }),
        new File([''], 'test.aiff', { type: 'application/octet-stream' }),
        new File([''], 'test.mp3', { type: 'application/octet-stream' }),
        new File([''], 'test.m4a', { type: 'application/octet-stream' }),
        new File([''], 'test.ogg', { type: 'application/octet-stream' }),
        new File([''], 'test.flac', { type: 'application/octet-stream' })
      ]

      validFiles.forEach(file => {
        expect(isValidAudioFile(file)).toBe(true)
      })
    })

    it('should reject invalid audio files', () => {
      const invalidFiles = [
        new File([''], 'test.txt', { type: 'text/plain' }),
        new File([''], 'test.jpg', { type: 'image/jpeg' }),
        new File([''], 'test.xyz', { type: 'application/octet-stream' })
      ]

      invalidFiles.forEach(file => {
        expect(isValidAudioFile(file)).toBe(false)
      })
    })
  })

  describe('readAudioMetadata', () => {
    it('should read WAV metadata', async () => {
      const { readWavMetadataFromArrayBuffer } = await import('../../utils/audio')
      const mockWavMetadata = {
        format: 'PCM',
        sampleRate: 44100,
        bitDepth: 16,
        channels: 1,
        dataLength: 44100,
        duration: 1.0,
        audioBuffer: mockAudioContext.createBuffer(1, 44100, 44100),
        fileSize: 44144,
        midiNote: 60,
        loopStart: 0.1,
        loopEnd: 0.9,
        hasLoopData: true
      }
      
      vi.mocked(readWavMetadataFromArrayBuffer).mockResolvedValue(mockWavMetadata)

      const file = new File(['mock wav data'], 'test.wav', { type: 'audio/wav' })
      // Mock the arrayBuffer method
      file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(44))
      
      const metadata = await readAudioMetadata(file, 'C3')

      expect(metadata.format).toBe('wav')
      expect(metadata.sampleRate).toBe(44100)
      expect(metadata.midiNote).toBe(60)
      expect(metadata.hasLoopData).toBe(true)
    })

    it('should read AIF metadata', async () => {
      // Create a mock AIF file with proper structure
      const aiffBuffer = new ArrayBuffer(200)
      const dataView = new DataView(aiffBuffer)
      
      // Write FORM header
      const textEncoder = new TextEncoder()
      new Uint8Array(aiffBuffer, 0, 4).set(textEncoder.encode('FORM'))
      dataView.setUint32(4, 196, false) // Big-endian chunk size
      new Uint8Array(aiffBuffer, 8, 4).set(textEncoder.encode('AIFF'))
      
      // Write COMM chunk
      new Uint8Array(aiffBuffer, 12, 4).set(textEncoder.encode('COMM'))
      dataView.setUint32(16, 18, false) // COMM chunk size
      dataView.setUint16(20, 1, false) // channels
      dataView.setUint32(22, 44100, false) // numSampleFrames
      dataView.setUint16(26, 16, false) // bitDepth
      
      // Write sample rate (80-bit extended)
      dataView.setUint16(28, 0x4000, false) // exponent
      dataView.setUint32(30, 0xAC440000, false) // mantissa (44100)
      
      // Write INST chunk
      new Uint8Array(aiffBuffer, 38, 4).set(textEncoder.encode('INST'))
      dataView.setUint32(42, 20, false) // INST chunk size
      dataView.setUint8(46, 60) // baseNote (middle C)
      dataView.setInt8(47, 0) // detune
      dataView.setUint8(48, 0) // lowNote
      dataView.setUint8(49, 127) // highNote
      dataView.setUint8(50, 0) // lowVelocity
      dataView.setUint8(51, 127) // highVelocity
      dataView.setInt16(52, 0, false) // gain
      
      // Sustain loop
      dataView.setUint16(54, 1, false) // playMode
      dataView.setUint16(56, 4410, false) // beginLoop (0.1s)
      dataView.setUint16(58, 39690, false) // endLoop (0.9s)
      
      // Release loop
      dataView.setUint16(60, 0, false) // playMode
      dataView.setUint16(62, 0, false) // beginLoop
      dataView.setUint16(64, 0, false) // endLoop

      const file = new File([aiffBuffer], 'test.aiff', { type: 'audio/aiff' })
      // Mock the arrayBuffer method
      file.arrayBuffer = vi.fn().mockResolvedValue(aiffBuffer)
      
      const metadata = await readAudioMetadata(file, 'C3')

      expect(metadata.format).toBe('aiff')
      expect(metadata.sampleRate).toBe(44100)
      expect(metadata.bitDepth).toBe(16)
      expect(metadata.channels).toBe(1)
      expect(metadata.rootNote).toBe(60)
      expect(metadata.midiNote).toBe(60)
      expect(metadata.hasLoopData).toBe(true)
      expect(metadata.loopStart).toBeCloseTo(0.1, 0)
      expect(metadata.loopEnd).toBeCloseTo(0.9, 0)
    })

    it('should read MP3 metadata', async () => {
      const { parseFilename } = await import('../../utils/audio')
      vi.mocked(parseFilename).mockReturnValue(['test', 60])

      const file = new File(['mock mp3 data'], 'test.mp3', { type: 'audio/mpeg' })
      // Mock the arrayBuffer method
      file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(44))
      
      const metadata = await readAudioMetadata(file, 'C3')

      expect(metadata.format).toBe('mp3')
      expect(metadata.bitDepth).toBe(16)
      expect(metadata.midiNote).toBe(60)
      expect(metadata.hasLoopData).toBe(false)
    })

    it('should handle unsupported format', async () => {
      const file = new File(['mock data'], 'test.xyz', { type: 'application/octet-stream' })
      // Mock the arrayBuffer method
      file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(44))
      
      await expect(readAudioMetadata(file, 'C3')).rejects.toThrow('Unsupported audio format: xyz')
    })
  })

  describe('readAudioMetadataFromArrayBuffer', () => {
    it('should convert WAV metadata to AudioMetadata format', async () => {
      const { readWavMetadataFromArrayBuffer } = await import('../../utils/audio')
      const mockWavMetadata = {
        format: 'PCM',
        sampleRate: 44100,
        bitDepth: 16,
        channels: 1,
        dataLength: 44100,
        duration: 1.0,
        audioBuffer: mockAudioContext.createBuffer(1, 44100, 44100),
        fileSize: 44144,
        midiNote: 60,
        loopStart: 0.1,
        loopEnd: 0.9,
        hasLoopData: true
      }
      
      vi.mocked(readWavMetadataFromArrayBuffer).mockResolvedValue(mockWavMetadata)

      const buffer = new ArrayBuffer(44)
      const metadata = await readAudioMetadataFromArrayBuffer(buffer, 'test.wav', 44144, 'C3')

      expect(metadata.format).toBe('wav')
      expect(metadata.sampleRate).toBe(44100)
      expect(metadata.bitDepth).toBe(16)
      expect(metadata.channels).toBe(1)
      expect(metadata.duration).toBe(1.0)
      expect(metadata.fileSize).toBe(44144)
      expect(metadata.midiNote).toBe(60)
      expect(metadata.loopStart).toBe(0.1)
      expect(metadata.loopEnd).toBe(0.9)
      expect(metadata.hasLoopData).toBe(true)
    })
  })

  describe('audioBufferToWavWithMetadata', () => {
    it('should convert audio buffer to WAV with metadata', async () => {
      const audioBuffer = mockAudioContext.createBuffer(1, 44100, 44100)
      const metadata: AudioMetadata = {
        format: 'wav',
        sampleRate: 44100,
        bitDepth: 16,
        channels: 1,
        duration: 1.0,
        audioBuffer,
        fileSize: 44144,
        midiNote: 60,
        loopStart: 0.1,
        loopEnd: 0.9,
        hasLoopData: true,
        rootNote: 60
      }

      const blob = await audioBufferToWavWithMetadata(audioBuffer, metadata, 16)
      
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('audio/wav')
    })
  })

  describe('AIF metadata parsing edge cases', () => {
    it('should handle AIF files without INST chunk', async () => {
      const aiffBuffer = new ArrayBuffer(100)
      const dataView = new DataView(aiffBuffer)
      
      // Write FORM header
      const textEncoder = new TextEncoder()
      new Uint8Array(aiffBuffer, 0, 4).set(textEncoder.encode('FORM'))
      dataView.setUint32(4, 96, false)
      new Uint8Array(aiffBuffer, 8, 4).set(textEncoder.encode('AIFF'))
      
      // Write COMM chunk only
      new Uint8Array(aiffBuffer, 12, 4).set(textEncoder.encode('COMM'))
      dataView.setUint32(16, 18, false)
      dataView.setUint16(20, 1, false)
      dataView.setUint32(22, 44100, false)
      dataView.setUint16(26, 16, false)
      dataView.setUint16(28, 0x4000, false)
      dataView.setUint32(30, 0xAC440000, false)

      const { parseFilename } = await import('../../utils/audio')
      vi.mocked(parseFilename).mockReturnValue(['test', 72])

      const file = new File([aiffBuffer], 'test.aiff', { type: 'audio/aiff' })
      // Mock the arrayBuffer method
      file.arrayBuffer = vi.fn().mockResolvedValue(aiffBuffer)
      
      const metadata = await readAudioMetadata(file, 'C3')

      expect(metadata.format).toBe('aiff')
      expect(metadata.midiNote).toBe(72) // From filename
      expect(metadata.hasLoopData).toBe(false)
    })

    it('should handle AIF files with MARK chunk', async () => {
      const aiffBuffer = new ArrayBuffer(200)
      const dataView = new DataView(aiffBuffer)
      
      // Write FORM header
      const textEncoder = new TextEncoder()
      new Uint8Array(aiffBuffer, 0, 4).set(textEncoder.encode('FORM'))
      dataView.setUint32(4, 196, false)
      new Uint8Array(aiffBuffer, 8, 4).set(textEncoder.encode('AIFF'))
      
      // Write COMM chunk
      new Uint8Array(aiffBuffer, 12, 4).set(textEncoder.encode('COMM'))
      dataView.setUint32(16, 18, false)
      dataView.setUint16(20, 1, false)
      dataView.setUint32(22, 44100, false)
      dataView.setUint16(26, 16, false)
      dataView.setUint16(28, 0x4000, false)
      dataView.setUint32(30, 0xAC440000, false)
      
      // Write MARK chunk
      new Uint8Array(aiffBuffer, 38, 4).set(textEncoder.encode('MARK'))
      dataView.setUint32(42, 20, false) // MARK chunk size
      dataView.setUint16(46, 2, false) // numMarkers
      
      // First marker: loop start
      dataView.setUint16(48, 1, false) // id
      dataView.setUint32(50, 4410, false) // position (0.1s)
      dataView.setUint8(54, 10) // name length
      new Uint8Array(aiffBuffer, 55, 10).set(textEncoder.encode('loop start'))
      
      // Second marker: loop end
      dataView.setUint16(65, 2, false) // id
      dataView.setUint32(67, 39690, false) // position (0.9s)
      dataView.setUint8(71, 8) // name length
      new Uint8Array(aiffBuffer, 72, 8).set(textEncoder.encode('loop end'))

      const file = new File([aiffBuffer], 'test.aiff', { type: 'audio/aiff' })
      // Mock the arrayBuffer method
      file.arrayBuffer = vi.fn().mockResolvedValue(aiffBuffer)
      
      const metadata = await readAudioMetadata(file, 'C3')

      expect(metadata.format).toBe('aiff')
      expect(metadata.hasLoopData).toBe(true)
      expect(metadata.loopStart).toBeCloseTo(0.1, 0)
      expect(metadata.loopEnd).toBeCloseTo(0.9, 0)
    })
  })
}) 