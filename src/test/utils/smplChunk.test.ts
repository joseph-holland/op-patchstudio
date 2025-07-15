import { describe, it, expect, beforeEach } from 'vitest';
import { audioBufferToWav } from '../../utils/audio';

// Mock AudioBuffer for testing
function createMockAudioBuffer(length = 1000, sampleRate = 44100, channels = 1) {
  const channelData = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    channelData[i] = Math.sin(i * 0.1) * 0.5; // Simple sine wave
  }
  
  const buffers: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) {
    buffers.push(channelData);
  }
  
  return {
    length,
    sampleRate,
    numberOfChannels: channels,
    duration: length / sampleRate,
    getChannelData: (channel: number) => buffers[channel],
    copyFromChannel: () => {},
    copyToChannel: () => {}
  } as AudioBuffer;
}

describe('SMPL Chunk Functionality', () => {
  let mockBuffer: any;

  beforeEach(() => {
    mockBuffer = createMockAudioBuffer(1000, 44100, 1);
  });

  describe('audioBufferToWav with SMPL metadata', () => {
    it('should create WAV without SMPL chunk when no metadata provided', async () => {
      const result = audioBufferToWav(mockBuffer, 16);
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('audio/wav');
      
      // Verify no SMPL chunk is present
      let arrayBuffer: ArrayBuffer;
      if (typeof (result as any).arrayBuffer === 'function') {
        arrayBuffer = await (result as Blob).arrayBuffer();
      } else if (result instanceof Uint8Array) {
        arrayBuffer = result.buffer;
      } else if (result instanceof ArrayBuffer) {
        arrayBuffer = result;
      } else if ((result as any).buffer instanceof ArrayBuffer) {
        arrayBuffer = (result as any).buffer;
      } else {
        console.warn('Skipping SMPL chunk verification - Blob not supported in test environment');
        return;
      }
      
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Look for "smpl" chunk identifier
      let foundSmpl = false;
      for (let i = 0; i < uint8Array.length - 4; i++) {
        if (uint8Array[i] === 0x73 && // 's'
            uint8Array[i + 1] === 0x6D && // 'm'
            uint8Array[i + 2] === 0x70 && // 'p'
            uint8Array[i + 3] === 0x6C) { // 'l'
          foundSmpl = true;
          break;
        }
      }
      
      expect(foundSmpl).toBe(false);
    });

    it('should create WAV with SMPL chunk when root note provided', async () => {
      const result = audioBufferToWav(mockBuffer, 16, {
        rootNote: 60
      });
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('audio/wav');
      
      // Verify SMPL chunk is present
      let arrayBuffer: ArrayBuffer;
      if (typeof (result as any).arrayBuffer === 'function') {
        arrayBuffer = await (result as Blob).arrayBuffer();
      } else if (result instanceof Uint8Array) {
        arrayBuffer = result.buffer;
      } else if (result instanceof ArrayBuffer) {
        arrayBuffer = result;
      } else if ((result as any).buffer instanceof ArrayBuffer) {
        arrayBuffer = (result as any).buffer;
      } else {
        console.warn('Skipping SMPL chunk verification - Blob not supported in test environment');
        return;
      }
      
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Look for "smpl" chunk identifier
      let foundSmpl = false;
      for (let i = 0; i < uint8Array.length - 4; i++) {
        if (uint8Array[i] === 0x73 && // 's'
            uint8Array[i + 1] === 0x6D && // 'm'
            uint8Array[i + 2] === 0x70 && // 'p'
            uint8Array[i + 3] === 0x6C) { // 'l'
          foundSmpl = true;
          break;
        }
      }
      
      expect(foundSmpl).toBe(true);
    });

    it('should create WAV with SMPL chunk when loop points provided', async () => {
      const result = audioBufferToWav(mockBuffer, 16, {
        loopStart: 100,
        loopEnd: 900
      });
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('audio/wav');
      
      // Verify SMPL chunk is present
      let arrayBuffer: ArrayBuffer;
      if (typeof (result as any).arrayBuffer === 'function') {
        arrayBuffer = await (result as Blob).arrayBuffer();
      } else if (result instanceof Uint8Array) {
        arrayBuffer = result.buffer;
      } else if (result instanceof ArrayBuffer) {
        arrayBuffer = result;
      } else if ((result as any).buffer instanceof ArrayBuffer) {
        arrayBuffer = (result as any).buffer;
      } else {
        console.warn('Skipping SMPL chunk verification - Blob not supported in test environment');
        return;
      }
      
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Look for "smpl" chunk identifier
      let foundSmpl = false;
      for (let i = 0; i < uint8Array.length - 4; i++) {
        if (uint8Array[i] === 0x73 && // 's'
            uint8Array[i + 1] === 0x6D && // 'm'
            uint8Array[i + 2] === 0x70 && // 'p'
            uint8Array[i + 3] === 0x6C) { // 'l'
          foundSmpl = true;
          break;
        }
      }
      
      expect(foundSmpl).toBe(true);
    });

    it('should create WAV with complete SMPL metadata', async () => {
      const result = audioBufferToWav(mockBuffer, 16, {
        rootNote: 72, // C4
        loopStart: 200,
        loopEnd: 800
      });
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('audio/wav');
      
      // Verify SMPL chunk is present and contains correct data
      let arrayBuffer: ArrayBuffer;
      if (typeof (result as any).arrayBuffer === 'function') {
        arrayBuffer = await (result as Blob).arrayBuffer();
      } else if (result instanceof Uint8Array) {
        arrayBuffer = result.buffer;
      } else if (result instanceof ArrayBuffer) {
        arrayBuffer = result;
      } else if ((result as any).buffer instanceof ArrayBuffer) {
        arrayBuffer = (result as any).buffer;
      } else {
        console.warn('Skipping SMPL chunk verification - Blob not supported in test environment');
        return;
      }
      
      const uint8Array = new Uint8Array(arrayBuffer);
      const dataView = new DataView(arrayBuffer);
      
      // Find SMPL chunk
      let smplOffset = -1;
      for (let i = 0; i < uint8Array.length - 4; i++) {
        if (uint8Array[i] === 0x73 && // 's'
            uint8Array[i + 1] === 0x6D && // 'm'
            uint8Array[i + 2] === 0x70 && // 'p'
            uint8Array[i + 3] === 0x6C) { // 'l'
          smplOffset = i;
          break;
        }
      }
      
      expect(smplOffset).toBeGreaterThan(-1);
      
      // Verify SMPL chunk structure
      const smplDataOffset = smplOffset + 8;
      const chunkSize = dataView.getUint32(smplOffset + 4, true);
      expect(chunkSize).toBe(60); // Fixed size for SMPL chunk with one loop
      
      // Verify MIDI unity note (offset 12 from smpl data start)
      const midiNote = dataView.getUint32(smplDataOffset + 12, true);
      expect(midiNote).toBe(72);
      
      // Verify number of loops (offset 28 from smpl data start)
      const numLoops = dataView.getUint32(smplDataOffset + 28, true);
      expect(numLoops).toBe(1);
      
      // Verify loop data (offset 36 from smpl data start)
      const loopStart = dataView.getUint32(smplDataOffset + 36 + 8, true);
      const loopEnd = dataView.getUint32(smplDataOffset + 36 + 12, true);
      expect(loopStart).toBe(200);
      expect(loopEnd).toBe(800);
    });

    it('should handle different bit depths with SMPL metadata', () => {
      const result16 = audioBufferToWav(mockBuffer, 16, {
        rootNote: 60,
        loopStart: 100,
        loopEnd: 900
      });
      
      const result24 = audioBufferToWav(mockBuffer, 24, {
        rootNote: 60,
        loopStart: 100,
        loopEnd: 900
      });
      
      expect(result16).toBeInstanceOf(Blob);
      expect(result24).toBeInstanceOf(Blob);
      expect(result16.type).toBe('audio/wav');
      expect(result24.type).toBe('audio/wav');
      
      // 24-bit should be larger than 16-bit
      expect(result24.size).toBeGreaterThan(result16.size);
    });

    it('should handle stereo audio with SMPL metadata', () => {
      const stereoBuffer = createMockAudioBuffer(1000, 44100, 2);
      
      const result = audioBufferToWav(stereoBuffer, 16, {
        rootNote: 60,
        loopStart: 100,
        loopEnd: 900
      });
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('audio/wav');
    });

    it('should use default values when metadata is partially provided', async () => {
      const result = audioBufferToWav(mockBuffer, 16, {
        rootNote: 60
        // loopStart and loopEnd not provided
      });
      
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('audio/wav');
      
      // Verify SMPL chunk is present
      let arrayBuffer: ArrayBuffer;
      if (typeof (result as any).arrayBuffer === 'function') {
        arrayBuffer = await (result as Blob).arrayBuffer();
      } else if (result instanceof Uint8Array) {
        arrayBuffer = result.buffer;
      } else if (result instanceof ArrayBuffer) {
        arrayBuffer = result;
      } else if ((result as any).buffer instanceof ArrayBuffer) {
        arrayBuffer = (result as any).buffer;
      } else {
        console.warn('Skipping SMPL chunk verification - Blob not supported in test environment');
        return;
      }
      
      const uint8Array = new Uint8Array(arrayBuffer);
      const dataView = new DataView(arrayBuffer);
      
      // Find SMPL chunk
      let smplOffset = -1;
      for (let i = 0; i < uint8Array.length - 4; i++) {
        if (uint8Array[i] === 0x73 && // 's'
            uint8Array[i + 1] === 0x6D && // 'm'
            uint8Array[i + 2] === 0x70 && // 'p'
            uint8Array[i + 3] === 0x6C) { // 'l'
          smplOffset = i;
          break;
        }
      }
      
      expect(smplOffset).toBeGreaterThan(-1);
      
      // Verify default values are used
      const smplDataOffset = smplOffset + 8;
      const midiNote = dataView.getUint32(smplDataOffset + 12, true);
      expect(midiNote).toBe(60);
      
      // Default loop end should be buffer length - 1
      const loopEnd = dataView.getUint32(smplDataOffset + 36 + 12, true);
      expect(loopEnd).toBe(mockBuffer.length - 1);
    });
  });

  describe('SMPL chunk structure validation', () => {
    it('should have correct SMPL chunk size', async () => {
      const result = audioBufferToWav(mockBuffer, 16, {
        rootNote: 60,
        loopStart: 100,
        loopEnd: 900
      });
      
      let arrayBuffer: ArrayBuffer;
      if (typeof (result as any).arrayBuffer === 'function') {
        arrayBuffer = await (result as Blob).arrayBuffer();
      } else if (result instanceof Uint8Array) {
        arrayBuffer = result.buffer;
      } else if (result instanceof ArrayBuffer) {
        arrayBuffer = result;
      } else if ((result as any).buffer instanceof ArrayBuffer) {
        arrayBuffer = (result as any).buffer;
      } else {
        console.warn('Skipping SMPL chunk verification - Blob not supported in test environment');
        return;
      }
      
      const uint8Array = new Uint8Array(arrayBuffer);
      const dataView = new DataView(arrayBuffer);
      
      // Find SMPL chunk
      let smplOffset = -1;
      for (let i = 0; i < uint8Array.length - 4; i++) {
        if (uint8Array[i] === 0x73 && // 's'
            uint8Array[i + 1] === 0x6D && // 'm'
            uint8Array[i + 2] === 0x70 && // 'p'
            uint8Array[i + 3] === 0x6C) { // 'l'
          smplOffset = i;
          break;
        }
      }
      
      expect(smplOffset).toBeGreaterThan(-1);
      
      // Verify chunk size is 60 bytes
      const chunkSize = dataView.getUint32(smplOffset + 4, true);
      expect(chunkSize).toBe(60);
    });

    it('should have correct sample period calculation', async () => {
      const result = audioBufferToWav(mockBuffer, 16, {
        rootNote: 60
      });
      
      let arrayBuffer: ArrayBuffer;
      if (typeof (result as any).arrayBuffer === 'function') {
        arrayBuffer = await (result as Blob).arrayBuffer();
      } else if (result instanceof Uint8Array) {
        arrayBuffer = result.buffer;
      } else if (result instanceof ArrayBuffer) {
        arrayBuffer = result;
      } else if ((result as any).buffer instanceof ArrayBuffer) {
        arrayBuffer = (result as any).buffer;
      } else {
        console.warn('Skipping SMPL chunk verification - Blob not supported in test environment');
        return;
      }
      
      const uint8Array = new Uint8Array(arrayBuffer);
      const dataView = new DataView(arrayBuffer);
      
      // Find SMPL chunk
      let smplOffset = -1;
      for (let i = 0; i < uint8Array.length - 4; i++) {
        if (uint8Array[i] === 0x73 && // 's'
            uint8Array[i + 1] === 0x6D && // 'm'
            uint8Array[i + 2] === 0x70 && // 'p'
            uint8Array[i + 3] === 0x6C) { // 'l'
          smplOffset = i;
          break;
        }
      }
      
      expect(smplOffset).toBeGreaterThan(-1);
      
      // Verify sample period (nanoseconds)
      const smplDataOffset = smplOffset + 8;
      const samplePeriod = dataView.getUint32(smplDataOffset + 8, true);
      const expectedPeriod = Math.round(1000000000 / mockBuffer.sampleRate);
      expect(samplePeriod).toBe(expectedPeriod);
    });
  });
}); 