import { describe, it, expect } from 'vitest';
import {
  parseCommChunk,
  parseMarkChunk,
  parseInstChunk,
  readExtendedFloat80,
  validateSampleRate
} from '../../utils/aifParser';

describe('AIF Parser Functions', () => {
  describe('parseCommChunk', () => {
    it('should parse standard AIFF COMM chunk', () => {
      const buffer = new ArrayBuffer(50);
      const dataView = new DataView(buffer);
      
      // Write COMM chunk data
      dataView.setUint16(0, 2, false); // channels
      dataView.setUint32(2, 44100, false); // numSampleFrames
      dataView.setUint16(6, 16, false); // bitDepth
      
      // Write IEEE 80-bit float sample rate (44100 Hz)
      // 44100 Hz = 0x400EAC44000000000000 in IEEE 80-bit float
      const sampleRate44100 = new Uint8Array([
        0x40, 0x0e, 0xac, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);
      new Uint8Array(buffer, 8, 10).set(sampleRate44100);
      
      const result = parseCommChunk(dataView, buffer, 0, 18, 'AIFF');
      
      expect(result.channels).toBe(2);
      expect(result.numSampleFrames).toBe(44100);
      expect(result.bitDepth).toBe(16);
      expect(result.sampleRate).toBe(44100);
      expect(result.isFloat).toBe(false);
      expect(result.isLittleEndian).toBe(false);
    });

    it('should parse AIFC with 32-bit float compression', () => {
      const buffer = new ArrayBuffer(50);
      const dataView = new DataView(buffer);
      
      // Write COMM chunk data
      dataView.setUint16(0, 1, false); // channels
      dataView.setUint32(2, 22050, false); // numSampleFrames
      dataView.setUint16(6, 32, false); // bitDepth
      
      // Write IEEE 80-bit float sample rate (48000 Hz)
      // 48000 Hz = 0x400EBB80000000000000
      const sampleRate48000 = new Uint8Array([
        0x40, 0x0e, 0xbb, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);
      new Uint8Array(buffer, 8, 10).set(sampleRate48000);
      
      // Write compression type 'fl32'
      const textEncoder = new TextEncoder();
      new Uint8Array(buffer, 18, 4).set(textEncoder.encode('fl32'));
      
      const result = parseCommChunk(dataView, buffer, 0, 22, 'AIFC');
      
      expect(result.channels).toBe(1);
      expect(result.numSampleFrames).toBe(22050);
      expect(result.bitDepth).toBe(32);
      expect(result.sampleRate).toBe(48000);
      expect(result.isFloat).toBe(true);
      expect(result.isLittleEndian).toBe(false);
      expect(result.compressionType).toBe('fl32');
    });

    it('should parse AIFC with little-endian compression', () => {
      const buffer = new ArrayBuffer(50);
      const dataView = new DataView(buffer);
      
      // Write COMM chunk data
      dataView.setUint16(0, 1, false); // channels
      dataView.setUint32(2, 44100, false); // numSampleFrames
      dataView.setUint16(6, 16, false); // bitDepth
      
      // Write IEEE 80-bit float sample rate (44100 Hz)
      // 44100 Hz = 0x400EAC44000000000000
      const sampleRate44100 = new Uint8Array([
        0x40, 0x0e, 0xac, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);
      new Uint8Array(buffer, 8, 10).set(sampleRate44100);
      
      // Write compression type 'sowt' (little-endian)
      const textEncoder = new TextEncoder();
      new Uint8Array(buffer, 18, 4).set(textEncoder.encode('sowt'));
      
      const result = parseCommChunk(dataView, buffer, 0, 22, 'AIFC');
      
      expect(result.channels).toBe(1);
      expect(result.numSampleFrames).toBe(44100);
      expect(result.bitDepth).toBe(16);
      expect(result.sampleRate).toBe(44100);
      expect(result.isFloat).toBe(false);
      expect(result.isLittleEndian).toBe(true);
      expect(result.compressionType).toBe('sowt');
    });

    it('should handle unknown compression types', () => {
      const buffer = new ArrayBuffer(50);
      const dataView = new DataView(buffer);
      
      // Write COMM chunk data
      dataView.setUint16(0, 1, false); // channels
      dataView.setUint32(2, 44100, false); // numSampleFrames
      dataView.setUint16(6, 16, false); // bitDepth
      
      // Write IEEE 80-bit float sample rate (44100 Hz)
      // 44100 Hz = 0x400EAC44000000000000
      const sampleRate44100 = new Uint8Array([
        0x40, 0x0e, 0xac, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);
      new Uint8Array(buffer, 8, 10).set(sampleRate44100);
      
      // Write unknown compression type
      const textEncoder = new TextEncoder();
      new Uint8Array(buffer, 18, 4).set(textEncoder.encode('UNKN'));
      
      const result = parseCommChunk(dataView, buffer, 0, 22, 'AIFC');
      
      expect(result.channels).toBe(1);
      expect(result.numSampleFrames).toBe(44100);
      expect(result.bitDepth).toBe(16);
      expect(result.sampleRate).toBe(44100);
      expect(result.isFloat).toBe(false);
      expect(result.isLittleEndian).toBe(false);
      expect(result.compressionType).toBe('UNKN');
    });

    it('should throw error for chunk too small', () => {
      const buffer = new ArrayBuffer(10);
      const dataView = new DataView(buffer);
      
      expect(() => {
        parseCommChunk(dataView, buffer, 0, 10, 'AIFF');
      }).toThrow('COMM chunk too small');
    });
  });

  describe('parseMarkChunk', () => {
    it('should handle empty MARK chunk', () => {
      const buffer = new ArrayBuffer(10);
      const dataView = new DataView(buffer);
      
      dataView.setUint16(0, 0, false); // numMarkers
      
      const result = parseMarkChunk(dataView, buffer, 0);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('parseInstChunk', () => {
    it('should handle INST chunk without loop points', () => {
      const buffer = new ArrayBuffer(50);
      const dataView = new DataView(buffer);
      
      // Write INST chunk data without loop references
      dataView.setUint8(0, 72); // baseNote (C5)
      dataView.setInt8(1, 0); // detune
      dataView.setUint8(2, 0); // lowNote
      dataView.setUint8(3, 127); // highNote
      dataView.setUint8(4, 0); // lowVelocity
      dataView.setUint8(5, 127); // highVelocity
      dataView.setInt16(6, 0, false); // gain
      
      // No loop references
      dataView.setUint16(8, 0, false); // playMode (no loop)
      dataView.setUint16(10, 0, false); // beginLoop (unused)
      dataView.setUint16(12, 0, false); // endLoop (unused)
      dataView.setUint16(14, 0, false); // playMode (no loop)
      dataView.setUint16(16, 0, false); // beginLoop (unused)
      dataView.setUint16(18, 0, false); // endLoop (unused)
      
      const markers: Array<{ id: number; position: number; name: string }> = [];
      
      const result = parseInstChunk(dataView, 0, markers);
      
      expect(result.rootNote).toBe(72);
      expect(result.loopStart).toBeUndefined();
      expect(result.loopEnd).toBeUndefined();
      expect(result.foundLoopPoints).toBe(false);
    });
  });

  describe('readExtendedFloat80', () => {
    it('should read IEEE 80-bit float correctly', () => {
      // 44100 Hz in IEEE 80-bit float format
      // 44100 Hz = 0x400EAC44000000000000
      const buffer44100 = new Uint8Array([
        0x40, 0x0e, 0xac, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);
      
      const result = readExtendedFloat80(buffer44100);
      
      expect(result).toBeCloseTo(44100, 0);
    });

    it('should read 48000 Hz correctly', () => {
      // 48000 Hz in IEEE 80-bit float format
      // 48000 Hz = 0x400EBB80000000000000
      const buffer48000 = new Uint8Array([
        0x40, 0x0e, 0xbb, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);
      
      const result = readExtendedFloat80(buffer48000);
      
      expect(result).toBeCloseTo(48000, 0);
    });
  });

  describe('validateSampleRate', () => {
    it('should accept valid sample rates', () => {
      expect(validateSampleRate(44100)).toBe(44100);
      expect(validateSampleRate(48000)).toBe(48000);
      expect(validateSampleRate(96000)).toBe(96000);
      expect(validateSampleRate(22050)).toBe(22050);
    });

    it('should use fallback for invalid sample rates', () => {
      expect(validateSampleRate(0)).toBe(44100);
      expect(validateSampleRate(-1)).toBe(44100);
      expect(validateSampleRate(1)).toBe(44100);
      expect(validateSampleRate(1000000)).toBe(44100);
    });
  });
}); 