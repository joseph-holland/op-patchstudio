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
  
  // Decode audio data first to get duration
  const audioContext = await audioContextManager.getAudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  
  // Calculate duration from WAV data chunk size to match legacy behavior
  const calculatedDuration = header.dataLength / (header.bitDepth / 8) / header.channels / header.sampleRate;
  
  // Parse SMPL chunk for loop data and MIDI note with proper fallbacks
  const smplData = parseSmplChunk(dataView, header.sampleRate, calculatedDuration, file.name);
  
  return {
    ...header,
    ...smplData,
    audioBuffer,
    duration: calculatedDuration, // Use calculated duration instead of AudioBuffer.duration
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
function parseSmplChunk(dataView: DataView, sampleRate: number, duration: number, filename: string): SmplChunk {
  let offset = 12;
  
  // Default values - use duration-based defaults like legacy code
  let midiNote = -1;
  let loopStart = duration * 0.1; // 10% into the sample
  let loopEnd = duration * 0.9;   // 90% into the sample
  let hasLoopData = false;

  // Search for SMPL chunk
  while (offset < dataView.byteLength - 8) {
    const chunkId = String.fromCharCode(
      dataView.getUint8(offset),
      dataView.getUint8(offset + 1),
      dataView.getUint8(offset + 2),
      dataView.getUint8(offset + 3)
    );
    const chunkSize = dataView.getUint32(offset + 4, true);
    
    if (chunkId === 'smpl') {
      // Parse SMPL chunk
      const smplOffset = offset + 8;
      
      // MIDI unity note (offset 12) - according to WAV file specification
      if (smplOffset + 12 < dataView.byteLength) {
        midiNote = dataView.getUint32(smplOffset + 12, true);
      }
      
      // Number of loops (offset 28)
      if (smplOffset + 28 < dataView.byteLength) {
        const numLoops = dataView.getUint32(smplOffset + 28, true);
        
        if (numLoops > 0 && smplOffset + 36 + 24 <= dataView.byteLength) {
          // First loop descriptor starts at offset 36
          const loopOffset = smplOffset + 36;
          const loopStartFrames = dataView.getUint32(loopOffset + 8, true);
          const loopEndFrames = dataView.getUint32(loopOffset + 12, true);
          
          // Convert frames to seconds
          loopStart = loopStartFrames / sampleRate;
          loopEnd = loopEndFrames / sampleRate;
          hasLoopData = true;
        }
      }
      break;
    }
    
    offset += 8 + chunkSize + (chunkSize % 2); // Account for padding to even boundary
  }

  // Fallback: parse root note from filename if not found in SMPL chunk
  if (midiNote < 0) {
    try {
      const parsed = parseFilename(filename);
      if (parsed && parsed.length > 1) {
        midiNote = parsed[1];
      }
    } catch (_) {
      // ignore filename parsing errors
    }
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
  normalize?: boolean;
  normalizeLevel?: number; // dB
  gain?: number; // dB
  cutAtLoopEnd?: boolean;
  loopEnd?: number; // Sample position to trim at (if cutAtLoopEnd is true)
}

/**
 * Normalize an AudioBuffer to a target level in dBFS using RMS
 * @param audioBuffer - The audio buffer to normalize
 * @param targetLevelDB - Target level in dBFS (default: -6.0)
 * @returns The normalized audio buffer
 */
export async function normalizeAudioBuffer(audioBuffer: AudioBuffer, targetLevelDB: number = -6.0): Promise<AudioBuffer> {
  // Calculate RMS across all channels
  let sumOfSquares = 0;
  let totalSamples = 0;
  
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < channelData.length; i++) {
      sumOfSquares += channelData[i] * channelData[i];
      totalSamples++;
    }
  }
  
  if (totalSamples === 0) {
    return audioBuffer;
  }
  
  const rms = Math.sqrt(sumOfSquares / totalSamples);
  
  if (rms === 0) {
    return audioBuffer;
  }
  
  // Calculate normalization gain to reach the target level
  const targetAmplitude = Math.pow(10, targetLevelDB / 20);
  const normalizeGain = targetAmplitude / rms;
  
  // Create a new audio buffer with the same properties
  const audioContext = await audioContextManager.getAudioContext();
  const normalizedBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );
  
  // Apply the gain to all channels
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const inputChannel = audioBuffer.getChannelData(ch);
    const outputChannel = normalizedBuffer.getChannelData(ch);
    
    for (let i = 0; i < inputChannel.length; i++) {
      outputChannel[i] = inputChannel[i] * normalizeGain;
    }
  }
  
  return normalizedBuffer;
}

/**
 * Calculate RMS normalization gain factor for an AudioBuffer
 * @param audioBuffer - The audio buffer to analyze
 * @param targetLevelDB - Target level in dBFS (default: -6.0)
 * @returns The gain factor to apply, or 1.0 if no normalization needed
 */
export function calculateNormalizationGain(audioBuffer: AudioBuffer, targetLevelDB: number = -6.0): number {
  // Calculate RMS across all channels
  let sumOfSquares = 0;
  let totalSamples = 0;
  
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < channelData.length; i++) {
      sumOfSquares += channelData[i] * channelData[i];
      totalSamples++;
    }
  }
  
  if (totalSamples === 0) {
    return 1.0;
  }
  
  const rms = Math.sqrt(sumOfSquares / totalSamples);
  
  if (rms === 0) {
    return 1.0;
  }
  
  // Calculate normalization gain to reach the target level
  const targetAmplitude = Math.pow(10, targetLevelDB / 20);
  const normalizeGain = targetAmplitude / rms;
  
  return normalizeGain;
}

/**
 * Trim audio at loop end position
 * @param audioBuffer - The audio buffer to trim
 * @param loopEnd - The loop end position in samples
 * @returns The trimmed audio buffer
 */
export async function cutAudioAtLoopEnd(audioBuffer: AudioBuffer, loopEnd: number): Promise<AudioBuffer> {
  // Validate loop end position
  if (loopEnd <= 0 || loopEnd >= audioBuffer.length) {
    return audioBuffer;
  }

  // Trim point is loopEnd + 5 samples (matching reference implementation)
  const cutPoint = loopEnd + 5;
  
  if (cutPoint >= audioBuffer.length) {
    return audioBuffer;
  }

  // Create a new audio buffer with the cut length
  const audioContext = await audioContextManager.getAudioContext();
  const cutBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    cutPoint,
    audioBuffer.sampleRate
  );

  // Copy the audio data up to the cut point
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const inputChannel = audioBuffer.getChannelData(ch);
    const outputChannel = cutBuffer.getChannelData(ch);
    
    for (let i = 0; i < cutPoint; i++) {
      outputChannel[i] = inputChannel[i];
    }
  }

  return cutBuffer;
}

export async function convertAudioFormat(
  audioBuffer: AudioBuffer,
  options: ConversionOptions = {}
): Promise<AudioBuffer> {
  const targetSampleRate = options.sampleRate || audioBuffer.sampleRate;
  const targetChannels = options.channels || audioBuffer.numberOfChannels;
  const normalize = options.normalize || false;
  const normalizeLevel = options.normalizeLevel || 0;
  const gain = options.gain || 0;
  
  // Apply trim to loop end if enabled (do this first to get correct duration)
  let processedBuffer = audioBuffer;
  if (options.cutAtLoopEnd && options.loopEnd) {
    processedBuffer = await cutAudioAtLoopEnd(audioBuffer, options.loopEnd);
  }

  // Create offline context for conversion with correct duration
  const offlineContext = audioContextManager.createOfflineContext(
    targetChannels,
    Math.ceil(processedBuffer.duration * targetSampleRate),
    targetSampleRate
  );

  // Create buffer source
  const source = offlineContext.createBufferSource();
  source.buffer = processedBuffer;

  // Create gain node for normalization and gain
  const gainNode = offlineContext.createGain();
  let gainValue = 1;

  // Apply gain
  if (gain !== 0) {
    gainValue *= Math.pow(10, gain / 20);
  }

  // Apply normalization if enabled
  if (normalize) {
    const normalizeGain = calculateNormalizationGain(processedBuffer, normalizeLevel);
    gainValue *= normalizeGain;
  }

  gainNode.gain.value = gainValue;

  // Handle channel conversion
  if (targetChannels !== processedBuffer.numberOfChannels) {
    // Add channel splitter/merger for channel conversion
    const splitter = offlineContext.createChannelSplitter(processedBuffer.numberOfChannels);
    const merger = offlineContext.createChannelMerger(targetChannels);
    
    source.connect(splitter);
    
    // Connect channels based on conversion type
    if (targetChannels === 1 && processedBuffer.numberOfChannels === 2) {
      // Stereo to mono: mix L+R channels through gain node
      splitter.connect(gainNode, 0, 0);
      splitter.connect(gainNode, 1, 0);
      gainNode.connect(merger, 0, 0);
    } else if (targetChannels === 2 && processedBuffer.numberOfChannels === 1) {
      // Mono to stereo: duplicate mono channel through gain node
      splitter.connect(gainNode, 0, 0);
      gainNode.connect(merger, 0, 0);
      gainNode.connect(merger, 0, 1);
    } else {
      // Direct channel mapping - create separate gain nodes for each channel
      const numChannels = Math.min(targetChannels, processedBuffer.numberOfChannels);
      const gainNodes: GainNode[] = [];
      
      for (let i = 0; i < numChannels; i++) {
        const channelGainNode = offlineContext.createGain();
        channelGainNode.gain.value = gainValue;
        gainNodes.push(channelGainNode);
        
        // Connect splitter output to gain node input
        splitter.connect(channelGainNode, i, 0);
        // Connect gain node output to merger input
        channelGainNode.connect(merger, 0, i);
      }
    }
    
    merger.connect(offlineContext.destination);
  } else {
    source.connect(gainNode);
    gainNode.connect(offlineContext.destination);
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

/**
 * Check if a preset name contains only valid characters for OP-XY/OP-1 devices
 * @param name - The preset name to validate
 * @returns true if the name contains only valid characters, false otherwise
 */
export function isValidPresetName(name: string): boolean {
  return /^[a-zA-Z0-9 #\-().]*$/.test(name);
}

/**
 * Get invalid characters from a preset name
 * @param name - The preset name to check
 * @returns Array of invalid characters found in the name
 */
export function getInvalidPresetNameChars(name: string): string[] {
  const invalidChars = name.match(/[^a-zA-Z0-9 #\-().]/g);
  return invalidChars ? [...new Set(invalidChars)] : [];
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
  if (value < 0 || value > 127) return '';
  const noteNumber = value % 12;
  const octave = Math.floor(value / 12) - 2;
  return `${NOTE_NAMES[noteNumber]}${octave}`;
}

const NOTE_NAME_TO_SEMITONE: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1,
  'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4,
  'F': 5, 'F#': 6, 'Gb': 6,
  'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10,
  'B': 11
};

export function noteStringToMidiValue(note: string): number {
  const match = note.match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!match) throw new Error('Bad note format');
  const [, letter, accidental, octaveStr] = match;
  const base = letter.toUpperCase() + (accidental || '');
  const semitone = NOTE_NAME_TO_SEMITONE[base];
  if (semitone === undefined) throw new Error('Bad note');
  const octave = parseInt(octaveStr, 10);
  return (octave + 2) * 12 + semitone;
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