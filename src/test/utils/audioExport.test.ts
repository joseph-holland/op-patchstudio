import { describe, it, expect, beforeEach } from 'vitest';
import { exportAudioBuffer, getAudioFileExtension, supportsFloatingPoint, type AudioFormat } from '../../utils/audioExport';

// Mock audio context and buffer
class MockAudioBuffer {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  duration: number;

  constructor(channels = 2, length = 1024, sampleRate = 44100) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
  }

  getChannelData(_channel: number): Float32Array {
    const data = new Float32Array(this.length);
    // Create a simple sine wave for testing
    for (let i = 0; i < this.length; i++) {
      data[i] = Math.sin(2 * Math.PI * 440 * i / this.sampleRate) * 0.5;
    }
    return data;
  }
}

describe('audioExport', () => {
  let mockAudioBuffer: MockAudioBuffer;

  beforeEach(() => {
    mockAudioBuffer = new MockAudioBuffer();
  });

  describe('exportAudioBuffer', () => {
    it('should export WAV format by default', () => {
      const result = exportAudioBuffer(mockAudioBuffer as any, {
        format: 'wav',
        bitDepth: 16
      });

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('audio/wav');
    });

    it('should export AIFF format', () => {
      const result = exportAudioBuffer(mockAudioBuffer as any, {
        format: 'aiff',
        bitDepth: 16
      });

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('audio/aiff');
    });

    it('should export AIFF with 32-bit float', () => {
      const result = exportAudioBuffer(mockAudioBuffer as any, {
        format: 'aiff',
        bitDepth: 32,
        isFloat: true
      });

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('audio/aiff');
      // Note: In a more comprehensive test, we would verify the internal structure
      // but for now we're just ensuring it creates a valid blob
    });

    it('should include metadata in exported files', () => {
      const result = exportAudioBuffer(mockAudioBuffer as any, {
        format: 'aiff',
        bitDepth: 24,
        rootNote: 60,
        loopStart: 100,
        loopEnd: 500
      });

      expect(result).toBeInstanceOf(Blob);
      expect(result.size).toBeGreaterThan(0);
    });

    it('should throw error for unsupported format', () => {
      expect(() => {
        exportAudioBuffer(mockAudioBuffer as any, {
          format: 'unsupported' as AudioFormat
        });
      }).toThrow('Unsupported audio format: unsupported');
    });

    it('should handle different bit depths for WAV', () => {
      const result16 = exportAudioBuffer(mockAudioBuffer as any, {
        format: 'wav',
        bitDepth: 16
      });

      const result24 = exportAudioBuffer(mockAudioBuffer as any, {
        format: 'wav',
        bitDepth: 24
      });

      expect(result16).toBeInstanceOf(Blob);
      expect(result24).toBeInstanceOf(Blob);
      // 24-bit should be larger than 16-bit
      expect(result24.size).toBeGreaterThan(result16.size);
    });

    it('should handle different bit depths for AIFF', () => {
      const result16 = exportAudioBuffer(mockAudioBuffer as any, {
        format: 'aiff',
        bitDepth: 16
      });

      const result24 = exportAudioBuffer(mockAudioBuffer as any, {
        format: 'aiff',
        bitDepth: 24
      });

      const result32 = exportAudioBuffer(mockAudioBuffer as any, {
        format: 'aiff',
        bitDepth: 32,
        isFloat: true
      });

      expect(result16).toBeInstanceOf(Blob);
      expect(result24).toBeInstanceOf(Blob);
      expect(result32).toBeInstanceOf(Blob);
      
      // Higher bit depths should generally result in larger files
      expect(result24.size).toBeGreaterThan(result16.size);
      expect(result32.size).toBeGreaterThan(result16.size);
    });

    it('should handle mono audio', () => {
      const monoBuffer = new MockAudioBuffer(1, 1024, 44100);
      
      const result = exportAudioBuffer(monoBuffer as any, {
        format: 'aiff',
        bitDepth: 16
      });

      expect(result).toBeInstanceOf(Blob);
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('getAudioFileExtension', () => {
    it('should return correct extension for wav format', () => {
      expect(getAudioFileExtension('wav')).toBe('wav');
    });

    it('should return correct extension for aiff format', () => {
      expect(getAudioFileExtension('aiff')).toBe('aif');
    });

    it('should throw error for unsupported format', () => {
      expect(() => {
        getAudioFileExtension('unsupported' as AudioFormat);
      }).toThrow('Unsupported audio format: unsupported');
    });
  });

  describe('supportsFloatingPoint', () => {
    it('should return true for AIFF format', () => {
      expect(supportsFloatingPoint('aiff')).toBe(true);
    });

    it('should return false for WAV format', () => {
      expect(supportsFloatingPoint('wav')).toBe(false);
    });

    it('should return false for unsupported formats', () => {
      expect(supportsFloatingPoint('mp3' as AudioFormat)).toBe(false);
    });
  });

  describe('format-specific tests', () => {
    it('should create valid AIFF files with different compression types', () => {
      // Test uncompressed AIFF
      const aiffPCM = exportAudioBuffer(mockAudioBuffer as any, {
        format: 'aiff',
        bitDepth: 16,
        isFloat: false
      });

      // Test 32-bit float AIFF
      const aiffFloat = exportAudioBuffer(mockAudioBuffer as any, {
        format: 'aiff',
        bitDepth: 32,
        isFloat: true
      });

      expect(aiffPCM).toBeInstanceOf(Blob);
      expect(aiffFloat).toBeInstanceOf(Blob);
      
      // Float version should be larger due to higher precision
      expect(aiffFloat.size).toBeGreaterThan(aiffPCM.size);
    });

    it('should handle edge cases for metadata', () => {
      // Test with boundary loop points
      const result = exportAudioBuffer(mockAudioBuffer as any, {
        format: 'aiff',
        bitDepth: 24,
        rootNote: 0, // Lowest MIDI note
        loopStart: 0, // Start of file
        loopEnd: mockAudioBuffer.length - 1 // End of file
      });

      expect(result).toBeInstanceOf(Blob);
      expect(result.size).toBeGreaterThan(0);
    });

    it('should handle high MIDI note values', () => {
      const result = exportAudioBuffer(mockAudioBuffer as any, {
        format: 'aiff',
        bitDepth: 16,
        rootNote: 127 // Highest MIDI note
      });

      expect(result).toBeInstanceOf(Blob);
      expect(result.size).toBeGreaterThan(0);
    });
  });
}); 