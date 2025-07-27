// AIFF/AIFC export utilities
// Handles AIFF file generation with proper chunk structure for loop points, root notes, and 32-bit float support
// Based on Apple AIFF-C specification and ConvertWithMoss compatibility

export interface AiffExportOptions {
  rootNote?: number;
  loopStart?: number;
  loopEnd?: number;
  bitDepth?: number;
  isFloat?: boolean;
  sampleRate?: number; // Target sample rate (11025, 22050, 44100)
  channels?: number;   // Target channel count (1 for mono, 2 for stereo)
}

export type AiffCompressionType = 'NONE' | 'fl32' | 'fl64' | 'sowt';

interface AiffCompressionInfo {
  type: AiffCompressionType;
  name: string;
  isFloat: boolean;
  isLittleEndian: boolean;
  bytesPerSample: number;
}

/**
 * Get compression info for AIFF format
 */
function getCompressionInfo(bitDepth: number, isFloat: boolean): AiffCompressionInfo {
  if (isFloat) {
    if (bitDepth === 32) {
      return {
        type: 'fl32',
        name: '32-bit floating point',
        isFloat: true,
        isLittleEndian: false,
        bytesPerSample: 4
      };
    } else if (bitDepth === 64) {
      return {
        type: 'fl64',
        name: '64-bit floating point',
        isFloat: true,
        isLittleEndian: false,
        bytesPerSample: 8
      };
    }
  }
  
  // PCM formats
  const bytesPerSample = bitDepth === 12 ? 2 : Math.ceil(bitDepth / 8); // 12-bit stored as 16-bit
  return {
    type: 'NONE',
    name: 'not compressed',
    isFloat: false,
    isLittleEndian: false,
    bytesPerSample
  };
}

/**
 * Write IEEE 80-bit extended float (AIFF sample rate format)
 */
function writeExtendedFloat80(dataView: DataView, offset: number, value: number): void {
  // Handle special cases
  if (value === 0) {
    for (let i = 0; i < 10; i++) {
      dataView.setUint8(offset + i, 0);
    }
    return;
  }

  // Convert to IEEE 80-bit extended precision
  const sign = value < 0 ? 1 : 0;
  const absValue = Math.abs(value);
  
  // Calculate exponent and mantissa
  let exponent = Math.floor(Math.log2(absValue)) + 16383; // Bias of 16383
  let mantissa = absValue / Math.pow(2, exponent - 16383);
  
  // Normalize mantissa to [1, 2) range
  if (mantissa >= 2) {
    mantissa /= 2;
    exponent++;
  } else if (mantissa < 1) {
    mantissa *= 2;
    exponent--;
  }
  
  // Scale mantissa to 63-bit integer (IEEE 80-bit has explicit leading bit)
  const mantissaInt = Math.round(mantissa * Math.pow(2, 63));
  
  // Write exponent (15 bits + sign bit)
  const exponentWithSign = (sign << 15) | (exponent & 0x7FFF);
  dataView.setUint16(offset, exponentWithSign, false);
  
  // Write mantissa (64 bits, but only 63 bits used)
  // Note: IEEE 80-bit stores mantissa as 64 bits, but only 63 are used
  const hiMant = Math.floor(mantissaInt / Math.pow(2, 32));
  const loMant = mantissaInt % Math.pow(2, 32);
  
  dataView.setUint32(offset + 2, hiMant, false);
  dataView.setUint32(offset + 6, loMant, false);
}

/**
 * Write a Pascal string (length byte + text + optional pad byte)
 */
function writePString(dataView: DataView, offset: number, str: string): number {
  const textBytes = new TextEncoder().encode(str);
  const length = Math.min(textBytes.length, 255);
  
  // Write length byte
  dataView.setUint8(offset, length);
  let pos = offset + 1;
  
  // Write text bytes
  for (let i = 0; i < length; i++) {
    dataView.setUint8(pos++, textBytes[i]);
  }
  
  // Add pad byte if total length is odd
  const totalLength = 1 + length;
  if (totalLength % 2 === 1) {
    dataView.setUint8(pos++, 0);
  }
  
  return pos - offset; // Return total bytes written
}

/**
 * Write 4-character ID
 */
function writeID(dataView: DataView, offset: number, id: string): void {
  const bytes = new TextEncoder().encode(id.padEnd(4).substring(0, 4));
  for (let i = 0; i < 4; i++) {
    dataView.setUint8(offset + i, bytes[i]);
  }
}

/**
 * Resample audio buffer to target sample rate
 */
async function resampleAudioBuffer(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
  const audioContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    Math.ceil(audioBuffer.length * targetSampleRate / audioBuffer.sampleRate),
    targetSampleRate
  );
  
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start();
  
  return await audioContext.startRendering();
}

/**
 * Convert audio buffer to target channel count
 */
async function convertChannels(audioBuffer: AudioBuffer, targetChannels: number): Promise<AudioBuffer> {
  const audioContext = new OfflineAudioContext(
    targetChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );
  
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start();
  
  return await audioContext.startRendering();
}

/**
 * Convert AudioBuffer to AIFF file with comprehensive chunk support
 */
export async function audioBufferToAiff(
  audioBuffer: AudioBuffer,
  options: AiffExportOptions = {}
): Promise<Blob> {
  const {
    rootNote,
    loopStart,
    loopEnd,
    bitDepth = 16,
    isFloat = false,
    sampleRate: targetSampleRate,
    channels: targetChannels
  } = options;

  // Validate bit depth
  if (![8, 12, 16, 24, 32, 64].includes(bitDepth)) {
    throw new Error(`Unsupported bit depth: ${bitDepth}. Supported: 8, 12, 16, 24, 32, 64`);
  }

  // Validate sample rate if provided
  if (targetSampleRate && ![11025, 22050, 44100].includes(targetSampleRate)) {
    throw new Error(`Unsupported sample rate: ${targetSampleRate}. Supported: 11025, 22050, 44100`);
  }

  // Validate channels if provided
  if (targetChannels && ![1, 2].includes(targetChannels)) {
    throw new Error(`Unsupported channel count: ${targetChannels}. Supported: 1 (mono), 2 (stereo)`);
  }

  // Convert audio buffer if needed
  let processedBuffer = audioBuffer;
  
  // Handle sample rate conversion
  if (targetSampleRate && targetSampleRate !== audioBuffer.sampleRate) {
    processedBuffer = await resampleAudioBuffer(audioBuffer, targetSampleRate);
  }
  
  // Handle channel conversion
  if (targetChannels && targetChannels !== audioBuffer.numberOfChannels) {
    processedBuffer = await convertChannels(processedBuffer, targetChannels);
  }

  const nChannels = processedBuffer.numberOfChannels;
  const numSampleFrames = processedBuffer.length;
  const sampleRate = processedBuffer.sampleRate;
  
  if (nChannels !== 1 && nChannels !== 2) {
    throw new Error("AIFF export supports only mono or stereo audio");
  }

  const compressionInfo = getCompressionInfo(bitDepth, isFloat);
  const isAIFC = compressionInfo.type !== 'NONE';
  const formType = isAIFC ? 'AIFC' : 'AIFF';
  
  // Calculate chunk sizes
  const hasMarkers = loopStart !== undefined && loopEnd !== undefined;
  const hasInstrument = rootNote !== undefined || hasMarkers;
  
  // FVER chunk (AIFC only)
  const fverChunkSize = isAIFC ? 12 : 0; // 8 + 4 bytes
  
  // COMM chunk size
  const compressionNameLength = writePString(new DataView(new ArrayBuffer(256)), 0, compressionInfo.name);
  const commChunkSize = 8 + (isAIFC ? 22 + compressionNameLength : 18);
  
  // MARK chunk size (if needed)
  let markChunkSize = 0;
  if (hasMarkers) {
    // Calculate marker chunk size: 8 + 2 + (2 markers * (2 + 4 + pstring))
    const startMarkerNameSize = writePString(new DataView(new ArrayBuffer(256)), 0, 'start');
    const endMarkerNameSize = writePString(new DataView(new ArrayBuffer(256)), 0, 'end');
    markChunkSize = 8 + 2 + (2 + 4 + startMarkerNameSize) + (2 + 4 + endMarkerNameSize);
  }
  
  // INST chunk size (if needed)
  const instChunkSize = hasInstrument ? 28 : 0; // 8 + 20 bytes
  
  // SSND chunk size
  const audioDataSize = numSampleFrames * nChannels * compressionInfo.bytesPerSample;
  const ssndChunkSize = 8 + 8 + audioDataSize + (audioDataSize % 2); // Add pad byte if needed
  
  // Calculate total file size
  const totalDataSize = fverChunkSize + commChunkSize + markChunkSize + instChunkSize + ssndChunkSize;
  const totalFileSize = 12 + totalDataSize; // FORM header + data
  
  // Create buffer
  const arrayBuffer = new ArrayBuffer(totalFileSize);
  const dataView = new DataView(arrayBuffer);
  const uint8 = new Uint8Array(arrayBuffer);
  
  let offset = 0;
  
  // Write FORM header
  writeID(dataView, offset, 'FORM'); offset += 4;
  dataView.setUint32(offset, totalDataSize + 4, false); offset += 4; // +4 for form type
  writeID(dataView, offset, formType); offset += 4;
  
  // Write FVER chunk (AIFC only)
  if (isAIFC) {
    writeID(dataView, offset, 'FVER'); offset += 4;
    dataView.setUint32(offset, 4, false); offset += 4;
    dataView.setUint32(offset, 0xA2805140, false); offset += 4; // AIFC Version 1
  }
  
  // Write COMM chunk
  writeID(dataView, offset, 'COMM'); offset += 4;
  const commDataSize = isAIFC ? 18 + compressionNameLength : 18;
  dataView.setUint32(offset, commDataSize, false); offset += 4;
  
  // COMM chunk data
  dataView.setUint16(offset, nChannels, false); offset += 2;
  dataView.setUint32(offset, numSampleFrames, false); offset += 4;
  dataView.setUint16(offset, bitDepth, false); offset += 2;
  writeExtendedFloat80(dataView, offset, sampleRate); offset += 10;
  
  // AIFC-specific compression info
  if (isAIFC) {
    writeID(dataView, offset, compressionInfo.type); offset += 4;
    offset += writePString(dataView, offset, compressionInfo.name);
  }
  
  // Write MARK chunk (if needed)
  if (hasMarkers) {
    writeID(dataView, offset, 'MARK'); offset += 4;
    const markDataSize = markChunkSize - 8;
    dataView.setUint32(offset, markDataSize, false); offset += 4;
    
    // Number of markers
    dataView.setUint16(offset, 2, false); offset += 2;
    
    // Start marker
    dataView.setUint16(offset, 1, false); offset += 2; // ID
    dataView.setUint32(offset, loopStart ?? 0, false); offset += 4; // Position
    offset += writePString(dataView, offset, 'start');
    
    // End marker
    dataView.setUint16(offset, 2, false); offset += 2; // ID
    dataView.setUint32(offset, (loopEnd ?? (numSampleFrames - 1)) - 1, false); offset += 4; // Position (subtract 1 frame)
    offset += writePString(dataView, offset, 'end');
  }
  
  // Write INST chunk (if needed)
  if (hasInstrument) {
    writeID(dataView, offset, 'INST'); offset += 4;
    dataView.setUint32(offset, 20, false); offset += 4;
    
    // INST chunk data
    dataView.setUint8(offset, rootNote ?? 60); offset += 1; // baseNote
    dataView.setInt8(offset, 0); offset += 1; // detune
    dataView.setUint8(offset, 0); offset += 1; // lowNote
    dataView.setUint8(offset, 127); offset += 1; // highNote
    dataView.setUint8(offset, 1); offset += 1; // lowVelocity
    dataView.setUint8(offset, 127); offset += 1; // highVelocity
    dataView.setInt16(offset, 0, false); offset += 2; // gain
    
    // Sustain loop
    dataView.setUint16(offset, hasMarkers ? 1 : 0, false); offset += 2; // playMode (1 = forward loop)
    dataView.setUint16(offset, hasMarkers ? 1 : 0, false); offset += 2; // beginLoop marker ID
    dataView.setUint16(offset, hasMarkers ? 2 : 0, false); offset += 2; // endLoop marker ID
    
    // Release loop (no loop)
    dataView.setUint16(offset, 0, false); offset += 2; // playMode
    dataView.setUint16(offset, 0, false); offset += 2; // beginLoop marker ID
    dataView.setUint16(offset, 0, false); offset += 2; // endLoop marker ID
  }
  
  // Write SSND chunk
  writeID(dataView, offset, 'SSND'); offset += 4;
  dataView.setUint32(offset, 8 + audioDataSize, false); offset += 4;
  dataView.setUint32(offset, 0, false); offset += 4; // offset
  dataView.setUint32(offset, 0, false); offset += 4; // blockSize
  
  // Write audio data
  writeAudioData(uint8, offset, processedBuffer, compressionInfo, bitDepth);
  
  return new Blob([arrayBuffer], { type: 'audio/aiff' });
}

/**
 * Write audio data based on compression type
 */
function writeAudioData(
  uint8: Uint8Array,
  offset: number,
  audioBuffer: AudioBuffer,
  compressionInfo: AiffCompressionInfo,
  bitDepth: number
): void {
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const bytesPerSample = compressionInfo.bytesPerSample;
  
  // Get channel data
  const buffers = [];
  for (let ch = 0; ch < channels; ch++) {
    buffers.push(audioBuffer.getChannelData(ch));
  }
  
  // Create DataView and byteIndex once for the entire function
  const dataView = new DataView(uint8.buffer, offset);
  let byteIndex = 0;
  
  if (compressionInfo.isFloat) {
    // 32-bit or 64-bit float
    
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < channels; ch++) {
        const sample = buffers[ch][i];
        
        if (bytesPerSample === 4) {
          // 32-bit float, big-endian
          dataView.setFloat32(byteIndex, sample, false);
          byteIndex += 4;
        } else if (bytesPerSample === 8) {
          // 64-bit float, big-endian
          dataView.setFloat64(byteIndex, sample, false);
          byteIndex += 8;
        }
      }
    }
  } else {
    // PCM integer data
    
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < channels; ch++) {
        let sample = buffers[ch][i];
        sample = Math.min(1, Math.max(-1, sample));
        
        if (bytesPerSample === 1) {
          // 8-bit unsigned
          const intSample = Math.round((sample + 1) * 127.5);
          dataView.setUint8(byteIndex, intSample);
          byteIndex += 1;
        } else if (bytesPerSample === 2) {
          // 16-bit signed, big-endian (or 12-bit stored as 16-bit)
          let intSample: number;
          if (bitDepth === 12) {
            // 12-bit: use 12-bit range and store as 16-bit with 4 LSBs set to 0
            intSample = Math.round(sample * 0x7FF) << 4;
          } else {
            // 16-bit: use full 16-bit range
            intSample = Math.round(sample * 0x7FFF);
          }
          dataView.setInt16(byteIndex, intSample, false);
          byteIndex += 2;
        } else if (bytesPerSample === 3) {
          // 24-bit signed, big-endian
          const intSample = Math.round(sample * 0x7FFFFF);
          dataView.setUint8(byteIndex, (intSample >> 16) & 0xFF);
          dataView.setUint8(byteIndex + 1, (intSample >> 8) & 0xFF);
          dataView.setUint8(byteIndex + 2, intSample & 0xFF);
          byteIndex += 3;
        } else if (bytesPerSample === 4) {
          // 32-bit signed, big-endian
          const intSample = Math.round(sample * 0x7FFFFFFF);
          dataView.setInt32(byteIndex, intSample, false);
          byteIndex += 4;
        }
      }
    }
  }
} 