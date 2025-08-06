// WAV export utilities
// Handles WAV file generation with SMPL chunk support for loop points and root notes

const MAX_AMPLITUDE = 0x7fff;

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

export interface WavExportOptions {
  rootNote?: number;
  loopStart?: number;
  loopEnd?: number;
  sampleRate?: number; // Target sample rate (11025, 22050, 44100)
  channels?: number;   // Target channel count (1 for mono, 2 for stereo)
}

/**
 * Convert AudioBuffer to WAV file with optional SMPL chunk for metadata
 * @param audioBuffer - The audio buffer to convert
 * @param bitDepth - Bit depth (16 or 24)
 * @param options - Optional metadata for SMPL chunk
 * @returns WAV file as Blob
 */
export async function audioBufferToWav(
  audioBuffer: AudioBuffer, 
  bitDepth: number = 16,
  options: WavExportOptions = {}
): Promise<Blob> {
  // Validate bit depth
  if (![8, 12, 16, 24].includes(bitDepth)) {
    throw new Error(`Unsupported bit depth: ${bitDepth}. Supported: 8, 12, 16, 24`);
  }

  // Validate sample rate if provided
  if (options.sampleRate && ![11025, 22050, 44100].includes(options.sampleRate)) {
    throw new Error(`Unsupported sample rate: ${options.sampleRate}. Supported: 11025, 22050, 44100`);
  }

  // Validate input audio buffer channels
  if (audioBuffer.numberOfChannels !== 1 && audioBuffer.numberOfChannels !== 2) {
    throw new Error(`Expecting mono or stereo audioBuffer`);
  }

  // Validate channels if provided
  if (options.channels && ![1, 2].includes(options.channels)) {
    throw new Error(`Unsupported channel count: ${options.channels}. Supported: 1 (mono), 2 (stereo)`);
  }

  // Convert audio buffer if needed
  let processedBuffer = audioBuffer;
  
  // Handle sample rate conversion
  if (options.sampleRate && options.sampleRate !== audioBuffer.sampleRate) {
    processedBuffer = await resampleAudioBuffer(audioBuffer, options.sampleRate);
  }
  
  // Handle channel conversion
  if (options.channels && options.channels !== audioBuffer.numberOfChannels) {
    processedBuffer = await convertChannels(processedBuffer, options.channels);
  }

  const nChannels = processedBuffer.numberOfChannels;
  const bufferLength = processedBuffer.length;
  const bytesPerSample = bitDepth / 8;
  
  // Calculate sizes
  const audioDataSize = bufferLength * nChannels * bytesPerSample;
  const fmtChunkSize = 16;
  const smplChunkSize = 60; // Fixed size for SMPL chunk with one loop
  
  // Calculate total size - SMPL chunk goes before data chunk
  const hasSmplChunk = options.rootNote !== undefined || options.loopStart !== undefined || options.loopEnd !== undefined;
  const totalSize = 4 + (8 + fmtChunkSize) + (hasSmplChunk ? (8 + smplChunkSize) : 0) + (8 + audioDataSize);
  
  // Create buffer
  const arrayBuffer = new ArrayBuffer(8 + totalSize);
  const uint8 = new Uint8Array(arrayBuffer);
  const dataView = new DataView(arrayBuffer);
  
  let offset = 0;
  
  // Write RIFF header
  writeString(uint8, offset, "RIFF"); offset += 4;
  dataView.setUint32(offset, totalSize, true); offset += 4;
  writeString(uint8, offset, "WAVE"); offset += 4;
  
  // Write fmt chunk
  writeString(uint8, offset, "fmt "); offset += 4;
  dataView.setUint32(offset, fmtChunkSize, true); offset += 4;
  dataView.setUint16(offset, 1, true); offset += 2; // PCM format
  dataView.setUint16(offset, nChannels, true); offset += 2;
  dataView.setUint32(offset, processedBuffer.sampleRate, true); offset += 4;
  dataView.setUint32(offset, processedBuffer.sampleRate * nChannels * bytesPerSample, true); offset += 4; // byte rate
  dataView.setUint16(offset, nChannels * bytesPerSample, true); offset += 2; // block align
  dataView.setUint16(offset, bitDepth, true); offset += 2;
  
  // Write SMPL chunk BEFORE data chunk if we have metadata
  if (hasSmplChunk) {
    writeString(uint8, offset, "smpl"); offset += 4;
    dataView.setUint32(offset, smplChunkSize, true); offset += 4;
    
    // SMPL chunk data (60 bytes total)
    dataView.setUint32(offset, 0, true); offset += 4; // manufacturer
    dataView.setUint32(offset, 0, true); offset += 4; // product
    dataView.setUint32(offset, Math.round(1000000000 / processedBuffer.sampleRate), true); offset += 4; // sample period (nanoseconds)
    dataView.setUint32(offset, options.rootNote ?? 60, true); offset += 4; // MIDI unity note
    dataView.setUint32(offset, 0, true); offset += 4; // MIDI pitch fraction
    dataView.setUint32(offset, 0, true); offset += 4; // SMPTE format
    dataView.setUint32(offset, 0, true); offset += 4; // SMPTE offset
    dataView.setUint32(offset, 1, true); offset += 4; // number of loops
    dataView.setUint32(offset, 0, true); offset += 4; // sampler data
    
    // Loop data (24 bytes)
    dataView.setUint32(offset, 0, true); offset += 4; // cue point ID
    dataView.setUint32(offset, 0, true); offset += 4; // type (0 = forward loop)
    dataView.setUint32(offset, (options.loopStart ?? 0) - 1, true); offset += 4; // start (subtract 1 to match reference)
    dataView.setUint32(offset, (options.loopEnd ?? (bufferLength - 1)) - 1, true); offset += 4; // end (subtract 1 frame)
    dataView.setUint32(offset, 0, true); offset += 4; // fraction
    dataView.setUint32(offset, 0, true); offset += 4; // play count
  }
  
  // Write data chunk
  writeString(uint8, offset, "data"); offset += 4;
  dataView.setUint32(offset, audioDataSize, true); offset += 4;
  
  // Write audio data
  if (bitDepth === 8) {
    writeAudioData8(uint8, processedBuffer, offset);
  } else if (bitDepth === 12) {
    writeAudioData12(uint8, processedBuffer, offset);
  } else if (bitDepth === 16) {
    writeAudioData16(uint8, processedBuffer, offset);
  } else if (bitDepth === 24) {
    writeAudioData24(uint8, processedBuffer, offset);
  } else {
    throw new Error(`Unsupported bit depth: ${bitDepth}`);
  }

  return new Blob([uint8], { type: "audio/wav" });
}

/**
 * Helper function to write strings to Uint8Array
 */
function writeString(uint8: Uint8Array, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    uint8[offset + i] = str.charCodeAt(i);
  }
}

/**
 * Write 16-bit audio data to Uint8Array
 */
function writeAudioData16(uint8: Uint8Array, audioBuffer: AudioBuffer, offset: number): void {
  const int16 = new Int16Array(uint8.buffer, offset);
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  
  const buffers = [];
  for (let ch = 0; ch < channels; ch++) {
    buffers.push(audioBuffer.getChannelData(ch));
  }

  for (let i = 0, index = 0; i < length; i++) {
    for (let ch = 0; ch < channels; ch++) {
      let sample = buffers[ch][i];
      sample = Math.min(1, Math.max(-1, sample));
      int16[index++] = Math.round(sample * MAX_AMPLITUDE);
    }
  }
}

/**
 * Write 8-bit audio data to Uint8Array
 */
function writeAudioData8(uint8: Uint8Array, audioBuffer: AudioBuffer, offset: number): void {
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const maxAmplitude = 0x7f; // 8-bit max (signed)
  
  const buffers = [];
  for (let ch = 0; ch < channels; ch++) {
    buffers.push(audioBuffer.getChannelData(ch));
  }

  let byteIndex = offset;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < channels; ch++) {
      let sample = buffers[ch][i];
      sample = Math.min(1, Math.max(-1, sample));
      const intSample = Math.round(sample * maxAmplitude);
      
      // Convert to unsigned 8-bit (0-255) for WAV format
      const unsignedSample = intSample + 128;
      uint8[byteIndex++] = Math.max(0, Math.min(255, unsignedSample));
    }
  }
}

/**
 * Write 12-bit audio data to Uint8Array
 * Note: 12-bit audio is stored as 16-bit with the 4 least significant bits set to 0
 */
function writeAudioData12(uint8: Uint8Array, audioBuffer: AudioBuffer, offset: number): void {
  const int16 = new Int16Array(uint8.buffer, offset);
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const maxAmplitude = 0x7ff; // 12-bit max (signed)
  
  const buffers = [];
  for (let ch = 0; ch < channels; ch++) {
    buffers.push(audioBuffer.getChannelData(ch));
  }

  for (let i = 0, index = 0; i < length; i++) {
    for (let ch = 0; ch < channels; ch++) {
      let sample = buffers[ch][i];
      sample = Math.min(1, Math.max(-1, sample));
      const intSample = Math.round(sample * maxAmplitude);
      
      // Store as 16-bit with 4 LSBs set to 0 (effectively 12-bit)
      int16[index++] = intSample << 4;
    }
  }
}

/**
 * Write 24-bit audio data to Uint8Array
 */
function writeAudioData24(uint8: Uint8Array, audioBuffer: AudioBuffer, offset: number): void {
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const maxAmplitude = 0x7fffff; // 24-bit max
  
  const buffers = [];
  for (let ch = 0; ch < channels; ch++) {
    buffers.push(audioBuffer.getChannelData(ch));
  }

  let byteIndex = offset;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < channels; ch++) {
      let sample = buffers[ch][i];
      sample = Math.min(1, Math.max(-1, sample));
      const intSample = Math.round(sample * maxAmplitude);
      
      // Write 24-bit little-endian
      uint8[byteIndex++] = intSample & 0xff;
      uint8[byteIndex++] = (intSample >> 8) & 0xff;
      uint8[byteIndex++] = (intSample >> 16) & 0xff;
    }
  }
} 