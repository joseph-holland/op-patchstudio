// Audio processing utilities migrated from legacy/lib/audio_tools.js
// Enhanced with TypeScript types and improved functionality

import { audioContextManager } from './audioContext';

// Constants preserved from legacy for compatibility
const HEADER_LENGTH = 44;
const MAX_AMPLITUDE = 0x7fff;
const PATCH_SIZE_LIMIT = 8 * 1024 * 1024; // 8mb limit for OP-XY

// WAV format structures
interface WavHeader {
  format: string;
  sampleRate: number;
  bitDepth: number;
  channels: number;
  dataLength: number;
}

interface SmplChunk {
  midiNote: number;
  loopStart: number;
  loopEnd: number;
  hasLoopData: boolean;
}

interface WavMetadata extends WavHeader, SmplChunk {
  audioBuffer: AudioBuffer;
  duration: number;
  fileSize: number;
}

// Enhanced WAV metadata parsing with SMPL chunk support
export async function readWavMetadata(file: File): Promise<WavMetadata> {
  const arrayBuffer = await file.arrayBuffer();
  const dataView = new DataView(arrayBuffer);
  
  // Parse WAV header
  const header = parseWavHeader(dataView);
  
  // Parse SMPL chunk for loop data and MIDI note
  const smplData = parseSmplChunk(dataView);
  
  // Decode audio data
  const audioContext = await audioContextManager.getAudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  
  return {
    ...header,
    ...smplData,
    audioBuffer,
    duration: audioBuffer.duration,
    fileSize: file.size,
  };
}

// Parse WAV file header
function parseWavHeader(dataView: DataView): WavHeader {
  // Check RIFF header
  const riff = String.fromCharCode(...Array.from(new Uint8Array(dataView.buffer, 0, 4)));
  if (riff !== 'RIFF') {
    throw new Error('Invalid WAV file: missing RIFF header');
  }

  // Check WAVE format
  const wave = String.fromCharCode(...Array.from(new Uint8Array(dataView.buffer, 8, 4)));
  if (wave !== 'WAVE') {
    throw new Error('Invalid WAV file: missing WAVE format');
  }

  // Find fmt chunk
  let offset = 12;
  let fmtOffset = -1;
  let dataOffset = -1;
  
  while (offset < dataView.byteLength - 8) {
    const chunkId = String.fromCharCode(...Array.from(new Uint8Array(dataView.buffer, offset, 4)));
    const chunkSize = dataView.getUint32(offset + 4, true);
    
    if (chunkId === 'fmt ') {
      fmtOffset = offset + 8;
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      break;
    }
    
    offset += 8 + chunkSize;
  }

  if (fmtOffset === -1) {
    throw new Error('Invalid WAV file: missing fmt chunk');
  }

  // Parse fmt chunk
  const audioFormat = dataView.getUint16(fmtOffset, true);
  const channels = dataView.getUint16(fmtOffset + 2, true);
  const sampleRate = dataView.getUint32(fmtOffset + 4, true);
  const bitDepth = dataView.getUint16(fmtOffset + 14, true);

  if (audioFormat !== 1) {
    throw new Error('Unsupported WAV format: only PCM is supported');
  }

  const dataLength = dataOffset !== -1 ? dataView.getUint32(dataOffset - 4, true) : 0;

  return {
    format: 'PCM',
    sampleRate,
    bitDepth,
    channels,
    dataLength,
  };
}

// Parse SMPL chunk for loop data and MIDI note information
function parseSmplChunk(dataView: DataView): SmplChunk {
  let offset = 12;
  
  // Default values
  let midiNote = -1;
  let loopStart = 0;
  let loopEnd = 0;
  let hasLoopData = false;

  // Search for SMPL chunk
  while (offset < dataView.byteLength - 8) {
    const chunkId = String.fromCharCode(...Array.from(new Uint8Array(dataView.buffer, offset, 4)));
    const chunkSize = dataView.getUint32(offset + 4, true);
    
    if (chunkId === 'smpl') {
      // Parse SMPL chunk
      const smplOffset = offset + 8;
      
      // MIDI unity note (offset 20)
      if (smplOffset + 20 < dataView.byteLength) {
        midiNote = dataView.getUint32(smplOffset + 20, true);
      }
      
      // Number of loops (offset 36)
      if (smplOffset + 36 < dataView.byteLength) {
        const numLoops = dataView.getUint32(smplOffset + 36, true);
        
        if (numLoops > 0 && smplOffset + 44 < dataView.byteLength) {
          // First loop start and end (offset 44 and 48)
          loopStart = dataView.getUint32(smplOffset + 44, true);
          loopEnd = dataView.getUint32(smplOffset + 48, true);
          hasLoopData = true;
        }
      }
      break;
    }
    
    offset += 8 + chunkSize;
  }

  return {
    midiNote,
    loopStart,
    loopEnd,
    hasLoopData,
  };
}

// Enhanced audio format conversion
export interface ConversionOptions {
  sampleRate?: number;
  bitDepth?: number;
  channels?: number;
}

export async function convertAudioFormat(
  audioBuffer: AudioBuffer,
  options: ConversionOptions = {}
): Promise<AudioBuffer> {
  const targetSampleRate = options.sampleRate || audioBuffer.sampleRate;
  const targetChannels = options.channels || audioBuffer.numberOfChannels;
  
  // Create offline context for conversion
  const offlineContext = audioContextManager.createOfflineContext(
    targetChannels,
    Math.ceil(audioBuffer.duration * targetSampleRate),
    targetSampleRate
  );

  // Create buffer source
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  // Handle channel conversion
  if (targetChannels !== audioBuffer.numberOfChannels) {
    // Add channel splitter/merger for channel conversion
    const splitter = offlineContext.createChannelSplitter(audioBuffer.numberOfChannels);
    const merger = offlineContext.createChannelMerger(targetChannels);
    
    source.connect(splitter);
    
    // Connect channels based on conversion type
    if (targetChannels === 1 && audioBuffer.numberOfChannels === 2) {
      // Stereo to mono: mix L+R channels
      splitter.connect(merger, 0, 0);
      splitter.connect(merger, 1, 0);
    } else if (targetChannels === 2 && audioBuffer.numberOfChannels === 1) {
      // Mono to stereo: duplicate mono channel
      splitter.connect(merger, 0, 0);
      splitter.connect(merger, 0, 1);
    } else {
      // Direct channel mapping
      for (let i = 0; i < Math.min(targetChannels, audioBuffer.numberOfChannels); i++) {
        splitter.connect(merger, i, i);
      }
    }
    
    merger.connect(offlineContext.destination);
  } else {
    source.connect(offlineContext.destination);
  }

  source.start(0);
  
  return await offlineContext.startRendering();
}

// Calculate preset size with accurate conversion estimation
export async function calculatePatchSize(
  audioBuffers: AudioBuffer[],
  options: ConversionOptions = {}
): Promise<number> {
  let totalSize = 0;
  
  for (const buffer of audioBuffers) {
    if (!buffer) continue;
    
    const targetSampleRate = options.sampleRate || buffer.sampleRate;
    const targetChannels = options.channels || buffer.numberOfChannels;
    const targetBitDepth = options.bitDepth || 16;
    
    // Calculate samples after conversion
    const samples = Math.ceil(buffer.duration * targetSampleRate);
    const bytesPerSample = targetBitDepth / 8;
    
    // WAV file size = header + (samples * channels * bytes per sample)
    const fileSize = HEADER_LENGTH + (samples * targetChannels * bytesPerSample);
    totalSize += fileSize;
  }
  
  return totalSize;
}

// Find nearest zero crossing for clean sample trimming
export function findNearestZeroCrossing(
  audioBuffer: AudioBuffer,
  framePosition: number,
  direction: 'forward' | 'backward' | 'both' = 'both',
  maxDistance: number = 1000
): number {
  const channelData = audioBuffer.getChannelData(0);
  const length = channelData.length;
  
  // Clamp position to valid range
  framePosition = Math.max(0, Math.min(framePosition, length - 1));
  
  let bestPosition = framePosition;
  let minAmplitude = Math.abs(channelData[framePosition]);
  
  const searchStart = direction === 'forward' ? framePosition : Math.max(0, framePosition - maxDistance);
  const searchEnd = direction === 'backward' ? framePosition : Math.min(length - 1, framePosition + maxDistance);
  
  for (let i = searchStart; i <= searchEnd; i++) {
    const amplitude = Math.abs(channelData[i]);
    if (amplitude < minAmplitude) {
      minAmplitude = amplitude;
      bestPosition = i;
      
      // If we found a true zero crossing, return immediately
      if (amplitude < 0.001) {
        break;
      }
    }
  }
  
  return bestPosition;
}

// Enhanced resample audio with better quality
export async function resampleAudio(file: File, targetSampleRate: number): Promise<Blob> {
  const audioContext = await audioContextManager.getAudioContext();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Skip resampling if already at target rate
    if (audioBuffer.sampleRate === targetSampleRate) {
      return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    const converted = await convertAudioFormat(audioBuffer, { sampleRate: targetSampleRate });
    return audioBufferToWav(converted);
  } catch (error) {
    console.error("Error during audio resampling:", error);
    throw error;
  }
}

// Enhanced AudioBuffer to WAV conversion with bit depth support
export function audioBufferToWav(audioBuffer: AudioBuffer, bitDepth: number = 16): Blob {
  const nChannels = audioBuffer.numberOfChannels;
  if (nChannels !== 1 && nChannels !== 2) {
    throw new Error("Expecting mono or stereo audioBuffer");
  }

  const bufferLength = audioBuffer.length;
  const bytesPerSample = bitDepth / 8;
  const arrayBuffer = new ArrayBuffer(HEADER_LENGTH + bufferLength * nChannels * bytesPerSample);
  
  const uint8 = new Uint8Array(arrayBuffer);
  
  // Write WAV header
  writeWavHeader(uint8, audioBuffer.sampleRate, nChannels, bitDepth, bufferLength);
  
  // Write audio data based on bit depth
  if (bitDepth === 16) {
    writeAudioData16(uint8, audioBuffer, HEADER_LENGTH);
  } else if (bitDepth === 24) {
    writeAudioData24(uint8, audioBuffer, HEADER_LENGTH);
  } else {
    throw new Error(`Unsupported bit depth: ${bitDepth}`);
  }

  return new Blob([uint8], { type: "audio/wav" });
}

// Write WAV header
function writeWavHeader(
  uint8: Uint8Array,
  sampleRate: number,
  channels: number,
  bitDepth: number,
  length: number
): void {
  const bytesPerSample = bitDepth / 8;
  const dataSize = length * channels * bytesPerSample;
  const fileSize = dataSize + 36;
  const byteRate = sampleRate * channels * bytesPerSample;

  uint8.set([
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    fileSize & 0xff, (fileSize >> 8) & 0xff, (fileSize >> 16) & 0xff, (fileSize >> 24) & 0xff,
    0x57, 0x41, 0x56, 0x45, // "WAVE"
    0x66, 0x6d, 0x74, 0x20, // "fmt "
    0x10, 0x00, 0x00, 0x00, // fmt chunk size (16)
    0x01, 0x00, // PCM format
    channels & 0xff, (channels >> 8) & 0xff,
    sampleRate & 0xff, (sampleRate >> 8) & 0xff, (sampleRate >> 16) & 0xff, (sampleRate >> 24) & 0xff,
    byteRate & 0xff, (byteRate >> 8) & 0xff, (byteRate >> 16) & 0xff, (byteRate >> 24) & 0xff,
    (channels * bytesPerSample) & 0xff, ((channels * bytesPerSample) >> 8) & 0xff,
    bitDepth & 0xff, (bitDepth >> 8) & 0xff,
    0x64, 0x61, 0x74, 0x61, // "data"
    dataSize & 0xff, (dataSize >> 8) & 0xff, (dataSize >> 16) & 0xff, (dataSize >> 24) & 0xff,
  ]);
}

// Write 16-bit audio data
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

// Write 24-bit audio data
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

// Existing functions preserved for compatibility
export function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9 #\-().]+/g, "");
}

export function parseFilename(filename: string): [string, number] {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  const match = nameWithoutExt.match(/(.+?)[\s\-]*([A-G](?:b|#)?\d|\d{1,3})$/i);
  if (!match) {
    throw new Error(`Filename '${filename}' does not match the expected pattern.`);
  }
  const baseName = sanitizeName(match[1]);
  const noteOrNumber = match[2];
  
  if (/^[A-G](?:b|#)?\d$/i.test(noteOrNumber)) {
    return [baseName, noteStringToMidiValue(noteOrNumber)];
  }
  return [baseName, parseInt(noteOrNumber, 10)];
}

export const NOTE_OFFSET = [33, 35, 24, 26, 28, 29, 31];
export const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

export function midiNoteToString(value: number): string {
  const octave = Math.floor(value / 12);
  const noteNumber = value % 12;
  return `${NOTE_NAMES[noteNumber]}${octave - 1}`;
}

export function noteStringToMidiValue(note: string): number {
  const string = note.replace(" ", "");
  if (string.length < 2) {
    throw new Error("Bad note format");
  }

  const noteIdx = string[0].toUpperCase().charCodeAt(0) - 65;
  if (noteIdx < 0 || noteIdx > 6) {
    throw new Error("Bad note");
  }

  let sharpen = 0;
  if (string[1] === "#") {
    sharpen = 1;
  } else if (string[1].toLowerCase() === "b") {
    sharpen = -1;
  }
  return (
    parseInt(string.slice(1 + Math.abs(sharpen)), 10) * 12 +
    NOTE_OFFSET[noteIdx] +
    sharpen
  );
}

// Enhanced base template objects for OP-XY patches
export const baseMultisampleJson = {
  envelope: {
    amp: { attack: 0, decay: 0, release: 32767, sustain: 32767 },
    filter: { attack: 0, decay: 0, release: 0, sustain: 32767 },
  },
  fx: {
    active: false,
    params: [0, 0, 0, 0, 0, 0, 0, 0],
    type: "svf",
  },
  lfo: {
    active: false,
    params: [0, 0, 0, 0, 0, 0, 0, 0],
    type: "element",
  },
  octave: 0,
  platform: "OP-XY",
  regions: [],
  type: "multisampler",
  version: 4,
};

export const baseDrumJson = {
  engine: {
    bendrange: 8191,
    highpass: 0,
    modulation: {
      aftertouch: { amount: 16383, target: 0 },
    },
    playmode: "poly",
    transpose: 0,
    "velocity.sensitivity": 4915, // ~15% of 32767
    volume: 26214, // ~80% of 32767
    width: 0, // 0% stereo width
  },
  platform: "OP-XY",
  type: "drum",
  version: 4,
};

// Utility functions
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 mb';
  if (bytes < 1024) return bytes + ' b';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' kb';
  return (bytes / 1048576).toFixed(1) + ' mb';
}

export function isPatchSizeValid(sizeBytes: number): boolean {
  return sizeBytes <= PATCH_SIZE_LIMIT;
}

export function getPatchSizeWarning(sizeBytes: number): string | null {
  const percentage = (sizeBytes / PATCH_SIZE_LIMIT) * 100;
  
  if (percentage >= 95) {
    return "Preset size too large - reduce sample rate, bit depth, or convert to mono";
  } else if (percentage >= 75) {
    return "Approaching size limit - consider optimizing samples";
  }
  
  return null;
}

/**
 * Get the effective sample rate (NO upsampling)
 * Matches legacy behavior: "0"=keep original, "44100"=44.1kHz, "22050"=22kHz, "11025"=11kHz
 */
export function getEffectiveSampleRate(originalSampleRate: number, selectedRate: string | number): number {
  const selected = selectedRate.toString();
  
  if (selected === "0") {
    // Keep original
    return originalSampleRate;
  }

  const targetRate = parseInt(selected, 10);
  
  // If original is 48kHz, allow conversion to any standard rate
  if (originalSampleRate === 48000) {
    return targetRate;
  }
  
  // For other rates, prevent upsampling
  return Math.min(originalSampleRate, targetRate);
}

// Export metadata type for use in components
export type { WavMetadata };