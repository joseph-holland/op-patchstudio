import { describe, it, expect, beforeAll } from 'vitest';
import { parseOP1DrumPreset, isOP1DrumPreset, extractKeyIndexFromMarker } from '../../utils/op1DrumPresetParser';

// Mock AIFF file data for testing
function createMockAIFFDrumV1(): ArrayBuffer {
  // Create a minimal AIFF file with OP-1 drum preset metadata
  // Format: AIFF with drum_version: 1, big-endian audio data
  
  const textEncoder = new TextEncoder();
  
  // AIFF header
  const aiffHeader = textEncoder.encode('FORM');
  const fileSize = new ArrayBuffer(4);
  const fileSizeView = new DataView(fileSize);
  fileSizeView.setUint32(0, 1000, false); // Big-endian
  const aiffType = textEncoder.encode('AIFF');
  
  // COMM chunk
  const commChunk = textEncoder.encode('COMM');
  const commSize = new ArrayBuffer(4);
  const commSizeView = new DataView(commSize);
  commSizeView.setUint32(0, 18, false);
  const commData = new ArrayBuffer(18);
  const commDataView = new DataView(commData);
  commDataView.setUint16(0, 1, false); // channels = 1
  commDataView.setUint32(2, 1200, false); // numSampleFrames = 24 samples × 50 frames
  commDataView.setUint16(6, 16, false); // bitDepth
  // Write 80-bit extended float for 44100 Hz sample rate
  const sampleRateBytes = [0x40, 0x0e, 0xac, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
  for (let i = 0; i < 10; i++) {
    commDataView.setUint8(8 + i, sampleRateBytes[i]);
  }
  
  // APPL chunk with OP-1 metadata
  const numSamples = 24;
  const framesPerSample = 50;
  const start = Array.from({ length: numSamples }, (_, i) => i * framesPerSample);
  const end = Array.from({ length: numSamples }, (_, i) => (i + 1) * framesPerSample);
  const metadata = {
    type: 'drum',
    drum_version: 1,
    start,
    end
  };
  
  const metadataJson = JSON.stringify(metadata);
  const applText = 'op-1' + metadataJson;
  const applBytes = textEncoder.encode(applText);
  const applChunk = textEncoder.encode('APPL');
  const applSize = new ArrayBuffer(4);
  const applSizeView = new DataView(applSize);
  applSizeView.setUint32(0, applBytes.length, false);
  
  // SSND chunk with mock audio data
  const ssndChunk = textEncoder.encode('SSND');
  const ssndSize = new ArrayBuffer(4);
  const ssndSizeView = new DataView(ssndSize);
  ssndSizeView.setUint32(0, 2408, false); // 8 bytes for offset+blockSize, 2400 bytes audio
  const ssndData = new ArrayBuffer(2408);
  const ssndDataView = new DataView(ssndData);
  ssndDataView.setUint32(0, 0, false); // offset
  ssndDataView.setUint32(4, 0, false); // blockSize
  // Fill with mock audio data (16-bit big-endian), starting at byte 8
  for (let i = 8; i < 2408; i += 2) {
    const sample = Math.sin(i * 0.01) * 16384; // Generate some waveform
    ssndDataView.setInt16(i, sample, false); // Big-endian
  }
  
  // Combine all chunks
  const totalSize = aiffHeader.byteLength + 4 + aiffType.byteLength + 
                   commChunk.byteLength + 4 + commData.byteLength +
                   applChunk.byteLength + 4 + applBytes.length +
                   ssndChunk.byteLength + 4 + 8 + 2400;
  
  const buffer = new ArrayBuffer(totalSize);
  const view = new Uint8Array(buffer);
  let offset = 0;
  
  // Write AIFF header
  view.set(aiffHeader, offset); offset += aiffHeader.byteLength;
  view.set(new Uint8Array(fileSize), offset); offset += 4;
  view.set(aiffType, offset); offset += aiffType.byteLength;
  
  // Write COMM chunk
  view.set(commChunk, offset); offset += commChunk.byteLength;
  view.set(new Uint8Array(commSize), offset); offset += 4;
  view.set(new Uint8Array(commData), offset); offset += commData.byteLength;
  
  // Write APPL chunk
  view.set(applChunk, offset); offset += applChunk.byteLength;
  view.set(new Uint8Array(applSize), offset); offset += 4;
  view.set(applBytes, offset); offset += applBytes.length;
  
  // Write SSND chunk
  view.set(ssndChunk, offset); offset += ssndChunk.byteLength;
  view.set(new Uint8Array(ssndSize), offset); offset += 4;
  view.set(new Uint8Array(ssndData, 0, 8), offset); offset += 8; // offset + blockSize
  view.set(new Uint8Array(ssndData, 8, 2400), offset); // audio data
  
  return buffer;
}

function createMockAIFCDrumV2(): ArrayBuffer {
  // Create a minimal AIFC file with OP-1 Field drum preset metadata
  // Format: AIFC with drum_version: 2, little-endian audio data (sowt)
  
  const textEncoder = new TextEncoder();
  
  // AIFC header
  const aifcHeader = textEncoder.encode('FORM');
  const fileSize = new ArrayBuffer(4);
  const fileSizeView = new DataView(fileSize);
  fileSizeView.setUint32(0, 1000, false); // Big-endian
  const aifcType = textEncoder.encode('AIFC');
  
  // COMM chunk (AIFC format)
  const commChunk = textEncoder.encode('COMM');
  const commSize = new ArrayBuffer(4);
  const commSizeView = new DataView(commSize);
  commSizeView.setUint32(0, 22, false); // AIFC has extra compression type
  const commData = new ArrayBuffer(22);
  const commDataView = new DataView(commData);
  commDataView.setUint16(0, 1, false); // channels = 1
  commDataView.setUint32(2, 1200, false); // numSampleFrames = 24 samples × 50 frames
  commDataView.setUint16(6, 16, false); // bitDepth
  // Write 80-bit extended float for 44100 Hz sample rate
  const sampleRateBytes = [0x40, 0x0e, 0xac, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
  for (let i = 0; i < 10; i++) {
    commDataView.setUint8(8 + i, sampleRateBytes[i]);
  }
  // Compression type: 'sowt' (little-endian)
  commDataView.setUint32(18, 0x736F7774, false); // "sowt"
  
  // APPL chunk with OP-1 Field metadata
  const numSamples = 24;
  const framesPerSample = 50;
  const start = Array.from({ length: numSamples }, (_, i) => i * framesPerSample);
  const end = Array.from({ length: numSamples }, (_, i) => (i + 1) * framesPerSample);
  const metadata = {
    type: 'drum',
    drum_version: 2,
    start,
    end
  };
  
  const metadataJson = JSON.stringify(metadata);
  const applText = 'op-1' + metadataJson;
  const applBytes = textEncoder.encode(applText);
  const applChunk = textEncoder.encode('APPL');
  const applSize = new ArrayBuffer(4);
  const applSizeView = new DataView(applSize);
  applSizeView.setUint32(0, applBytes.length, false);
  
  // SSND chunk with mock audio data (little-endian)
  const ssndChunk = textEncoder.encode('SSND');
  const ssndSize = new ArrayBuffer(4);
  const ssndSizeView = new DataView(ssndSize);
  ssndSizeView.setUint32(0, 2408, false); // 8 bytes for offset+blockSize, 2400 bytes audio
  const ssndData = new ArrayBuffer(2408);
  const ssndDataView = new DataView(ssndData);
  ssndDataView.setUint32(0, 0, false); // offset
  ssndDataView.setUint32(4, 0, false); // blockSize
  // Fill with mock audio data (16-bit little-endian), starting at byte 8
  for (let i = 8; i < 2408; i += 2) {
    const sample = Math.sin(i * 0.01) * 16384; // Generate some waveform
    ssndDataView.setInt16(i, sample, true); // Little-endian
  }
  
  // Combine all chunks
  const totalSize = aifcHeader.byteLength + 4 + aifcType.byteLength + 
                   commChunk.byteLength + 4 + commData.byteLength +
                   applChunk.byteLength + 4 + applBytes.length +
                   ssndChunk.byteLength + 4 + 8 + 2400;
  
  const buffer = new ArrayBuffer(totalSize);
  const view = new Uint8Array(buffer);
  let offset = 0;
  
  // Write AIFC header
  view.set(aifcHeader, offset); offset += aifcHeader.byteLength;
  view.set(new Uint8Array(fileSize), offset); offset += 4;
  view.set(aifcType, offset); offset += aifcType.byteLength;
  
  // Write COMM chunk
  view.set(commChunk, offset); offset += commChunk.byteLength;
  view.set(new Uint8Array(commSize), offset); offset += 4;
  view.set(new Uint8Array(commData), offset); offset += commData.byteLength;
  
  // Write APPL chunk
  view.set(applChunk, offset); offset += applChunk.byteLength;
  view.set(new Uint8Array(applSize), offset); offset += 4;
  view.set(applBytes, offset); offset += applBytes.length;
  
  // Write SSND chunk
  view.set(ssndChunk, offset); offset += ssndChunk.byteLength;
  view.set(new Uint8Array(ssndSize), offset); offset += 4;
  view.set(new Uint8Array(ssndData, 0, 8), offset); offset += 8; // offset + blockSize
  view.set(new Uint8Array(ssndData, 8, 2400), offset); // audio data
  
  return buffer;
}

describe('OP-1 Drum Preset Parser', () => {
  let drumV1Buffer: ArrayBuffer;
  let drumV2Buffer: ArrayBuffer;

  beforeAll(() => {
    // Create mock AIF files for testing
    drumV1Buffer = createMockAIFFDrumV1();
    drumV2Buffer = createMockAIFCDrumV2();
  });

  describe('Drum Version 1 (AIFF)', () => {
    it('should detect OP-1 drum preset files (v1)', () => {
      const isPreset = isOP1DrumPreset(drumV1Buffer);
      expect(isPreset).toBe(true);
    });

    it('should parse OP-1 drum preset v1 and extract samples', async () => {
      const preset = await parseOP1DrumPreset(drumV1Buffer, 'test_drum_v1.aif');
      
      expect(preset).toBeDefined();
      expect(preset.name).toBe('test_drum_v1');
      expect(preset.samples).toBeInstanceOf(Array);
      expect(preset.samples.length).toBeGreaterThan(0);
      expect(preset.sampleRate).toBeGreaterThan(0);
      expect(preset.channels).toBeGreaterThan(0);
      expect(preset.bitDepth).toBeGreaterThan(0);
      
      // Check that samples have the expected structure
      for (const sample of preset.samples) {
        expect(sample.keyIndex).toBeGreaterThanOrEqual(0);
        expect(sample.keyIndex).toBeLessThan(24); // OP-XY has 24 drum keys
        expect(sample.name).toBeDefined();
        expect(sample.audioBuffer).toBeInstanceOf(AudioBuffer);
        expect(sample.duration).toBeGreaterThan(0);
        expect(sample.startSample).toBeGreaterThanOrEqual(0);
        expect(sample.endSample).toBeGreaterThan(sample.startSample);
      }
    });

    it('should handle big-endian audio data correctly (v1)', async () => {
      const preset = await parseOP1DrumPreset(drumV1Buffer, 'test_drum_v1.aif');
      
      // Check that audio data is read correctly (not all zeros)
      for (const sample of preset.samples) {
        const audioBuffer = sample.audioBuffer;
        const channelData = audioBuffer.getChannelData(0);
        
        // Check that we have some non-zero audio data
        let hasAudioData = false;
        for (let i = 0; i < Math.min(100, channelData.length); i++) {
          if (Math.abs(channelData[i]) > 0.001) {
            hasAudioData = true;
            break;
          }
        }
        expect(hasAudioData).toBe(true);
      }
    });
  });

  describe('Drum Version 2 (AIFC)', () => {
    it('should detect OP-1 Field drum preset files (v2)', () => {
      const isPreset = isOP1DrumPreset(drumV2Buffer);
      expect(isPreset).toBe(true);
    });

    it('should parse OP-1 Field drum preset v2 and extract samples', async () => {
      const preset = await parseOP1DrumPreset(drumV2Buffer, 'test_drum_v2.aif');
      
      expect(preset).toBeDefined();
      expect(preset.name).toBe('test_drum_v2');
      expect(preset.samples).toBeInstanceOf(Array);
      expect(preset.samples.length).toBeGreaterThan(0);
      expect(preset.sampleRate).toBeGreaterThan(0);
      expect(preset.channels).toBeGreaterThan(0);
      expect(preset.bitDepth).toBeGreaterThan(0);
      
      // Check that samples have the expected structure
      for (const sample of preset.samples) {
        expect(sample.keyIndex).toBeGreaterThanOrEqual(0);
        expect(sample.keyIndex).toBeLessThan(24); // OP-XY has 24 drum keys
        expect(sample.name).toBeDefined();
        expect(sample.audioBuffer).toBeInstanceOf(AudioBuffer);
        expect(sample.duration).toBeGreaterThan(0);
        expect(sample.startSample).toBeGreaterThanOrEqual(0);
        expect(sample.endSample).toBeGreaterThan(sample.startSample);
      }
    });

    it('should handle little-endian audio data correctly (v2)', async () => {
      const preset = await parseOP1DrumPreset(drumV2Buffer, 'test_drum_v2.aif');
      
      // Check that audio data is read correctly (not all zeros)
      for (const sample of preset.samples) {
        const audioBuffer = sample.audioBuffer;
        const channelData = audioBuffer.getChannelData(0);
        
        // Check that we have some non-zero audio data
        let hasAudioData = false;
        for (let i = 0; i < Math.min(100, channelData.length); i++) {
          if (Math.abs(channelData[i]) > 0.001) {
            hasAudioData = true;
            break;
          }
        }
        expect(hasAudioData).toBe(true);
      }
    });
  });

  describe('Common functionality', () => {
    it('should map samples to correct key indices for both formats', async () => {
      const presetV1 = await parseOP1DrumPreset(drumV1Buffer, 'test_drum_v1.aif');
      const presetV2 = await parseOP1DrumPreset(drumV2Buffer, 'test_drum_v2.aif');
      
      [presetV1, presetV2].forEach(preset => {
        // Check that samples are sorted by key index
        for (let i = 1; i < preset.samples.length; i++) {
          expect(preset.samples[i].keyIndex).toBeGreaterThanOrEqual(preset.samples[i - 1].keyIndex);
        }
        
        // Check that key indices are within valid range
        for (const sample of preset.samples) {
          expect(sample.keyIndex).toBeGreaterThanOrEqual(0);
          expect(sample.keyIndex).toBeLessThan(24);
        }
      });
    });

    it('should create valid AudioBuffers for each sample in both formats', async () => {
      const presetV1 = await parseOP1DrumPreset(drumV1Buffer, 'test_drum_v1.aif');
      const presetV2 = await parseOP1DrumPreset(drumV2Buffer, 'test_drum_v2.aif');
      
      [presetV1, presetV2].forEach(preset => {
        for (const sample of preset.samples) {
          const audioBuffer = sample.audioBuffer;
          expect(audioBuffer.numberOfChannels).toBe(preset.channels);
          expect(audioBuffer.sampleRate).toBe(preset.sampleRate);
          expect(audioBuffer.length).toBeGreaterThan(0);
          expect(audioBuffer.duration).toBeCloseTo(sample.duration, 3);
        }
      });
    });

    it('should extract filename prefix correctly for both formats', async () => {
      const presetV1 = await parseOP1DrumPreset(drumV1Buffer, 'my_drum_v1.aif');
      const presetV2 = await parseOP1DrumPreset(drumV2Buffer, 'my_drum_v2.aif');
      
      expect(presetV1.name).toBe('my_drum_v1');
      expect(presetV2.name).toBe('my_drum_v2');
      
      // Check that sample names include the filename prefix
      for (const sample of presetV1.samples) {
        expect(sample.name).toMatch(/^my_drum_v1 sample \d+$/);
      }
      
      for (const sample of presetV2.samples) {
        expect(sample.name).toMatch(/^my_drum_v2 sample \d+$/);
      }
    });
  });

  describe('Error handling', () => {
    it('should reject non-AIFF/AIFC files', () => {
      const invalidBuffer = new ArrayBuffer(100);
      const isPreset = isOP1DrumPreset(invalidBuffer);
      expect(isPreset).toBe(false);
    });

    it('should handle files without OP-1 metadata', () => {
      // Create a valid AIFF file without OP-1 metadata
      const textEncoder = new TextEncoder();
      const buffer = new ArrayBuffer(200);
      const view = new Uint8Array(buffer);
      
      // Write basic AIFF header
      view.set(textEncoder.encode('FORM'), 0);
      view.set(textEncoder.encode('AIFF'), 8);
      
      const isPreset = isOP1DrumPreset(buffer);
      expect(isPreset).toBe(false);
    });
  });

  describe('OP-1 to OP-XY naming conversion', () => {
    it('should convert clave alt to wood stick for index 21', () => {
      // Test that 'clave alt' maps to index 21 (wood stick)
      const claveAltIndex = extractKeyIndexFromMarker(-1, 'clave alt');
      expect(claveAltIndex).toBe(21);
      
      // Test that 'wood stick' also maps to index 21
      const woodStickIndex = extractKeyIndexFromMarker(-1, 'wood stick');
      expect(woodStickIndex).toBe(21);
      
      // Test that 'CLAVE ALT' (uppercase) also maps to index 21
      const claveAltUpperIndex = extractKeyIndexFromMarker(-1, 'CLAVE ALT');
      expect(claveAltUpperIndex).toBe(21);
    });
  });
}); 