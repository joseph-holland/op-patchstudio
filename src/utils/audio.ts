// Audio processing utilities migrated from legacy/lib/audio_tools.js
// Enhanced with TypeScript types and improved functionality

import { audioContextManager } from './audioContext';
import { AUDIO_CONSTANTS } from './constants';
import type { FilenameSeparator } from './constants';

// Constants preserved from legacy for compatibility
const HEADER_LENGTH = 44;
const MAX_AMPLITUDE = 0x7fff;
const PATCH_SIZE_LIMIT = 8 * 1024 * 1024; // 8mb limit for OP-XY

// Audio processing constants
export const LOOP_END_PADDING = 5; // Additional samples to add when cutting at loop end

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
export async function readWavMetadata(file: File, mapping: 'C3' | 'C4' = 'C3'): Promise<WavMetadata> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    return await readWavMetadataFromArrayBuffer(arrayBuffer, file.name, file.size, mapping);
  } catch (error) {
    throw new Error(`Failed to read WAV metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Overloaded version that accepts ArrayBuffer directly (for session restoration)
export async function readWavMetadataFromArrayBuffer(
  arrayBuffer: ArrayBuffer, 
  filename: string, 
  fileSize: number, 
  mapping: 'C3' | 'C4' = 'C3'
): Promise<WavMetadata> {
  try {
    // Create separate copies for parsing and decoding to avoid detached buffer issues
    const parseBuffer = arrayBuffer.slice(0);
    const decodeBuffer = arrayBuffer.slice(0);
    
    const dataView = new DataView(parseBuffer);
    
    // Parse WAV header
    const header = parseWavHeader(dataView);
    
    // Decode audio data using separate buffer
    const audioContext = await audioContextManager.getAudioContext();
    const audioBuffer = await audioContext.decodeAudioData(decodeBuffer);
    
    // Calculate duration from decoded audio buffer
    const duration = audioBuffer.duration;
    
    // Parse SMPL chunk for loop points and MIDI note using the parse buffer
    const smplData = parseSmplChunk(dataView, header.sampleRate, duration, filename, mapping);
    
    return {
      format: header.format,
      sampleRate: header.sampleRate,
      bitDepth: header.bitDepth,
      channels: header.channels,
      dataLength: header.dataLength,
      duration,
      audioBuffer,
      midiNote: smplData.midiNote,
      loopStart: smplData.loopStart,
      loopEnd: smplData.loopEnd,
      hasLoopData: smplData.hasLoopData,
      fileSize
    };
  } catch (error) {
    throw new Error(`Failed to read WAV metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
function parseSmplChunk(dataView: DataView, sampleRate: number, duration: number, filename: string, mapping: 'C3' | 'C4' = 'C3'): SmplChunk {
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
      const parsed = parseFilename(filename, mapping);
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
  normalizeLevel?: number; // dBFS
  gain?: number; // dBFS
  cutAtLoopEnd?: boolean;
  loopEnd?: number; // Sample position to trim at (if cutAtLoopEnd is true)
  applyLimiter?: boolean; // Apply limiter to prevent clipping
  sampleName?: string; // For logging purposes
}

/**
 * Normalize an AudioBuffer to a target level in dBFS using peak normalization
 * @param audioBuffer - The audio buffer to normalize
 * @param targetLevelDB - Target level in dBFS (default: -0.1)
 * @returns The normalized audio buffer
 */
export async function normalizeAudioBuffer(audioBuffer: AudioBuffer, targetLevelDB: number = 0.0): Promise<AudioBuffer> {
  const normalizeGain = calculatePeakNormalizationGain(audioBuffer, targetLevelDB);
  
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
 * Calculate peak normalization gain factor for an AudioBuffer
 * @param audioBuffer - The audio buffer to analyze
 * @param targetLevelDB - Target level in dBFS (default: 0.0)
 * @returns The gain factor to apply, or 1.0 if no normalization needed
 */
export function calculatePeakNormalizationGain(audioBuffer: AudioBuffer, targetLevelDB: number = 0.0): number {
  // Find maximum amplitude across all channels
  let maxAmplitude = 0;
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < channelData.length; i++) {
      const amplitude = Math.abs(channelData[i]);
      if (amplitude > maxAmplitude) {
        maxAmplitude = amplitude;
      }
    }
  }
  if (maxAmplitude === 0) {
    return 1.0;
  }
  const targetAmplitude = Math.pow(10, targetLevelDB / 20);
  const normalizeGain = targetAmplitude / maxAmplitude;
  return normalizeGain;
}

/**
 * Create a limiter for audio processing
 * @param audioContext - The audio context (can be AudioContext or OfflineAudioContext)
 * @param threshold - Threshold in dBFS (default: -0.1dBFS for safety)
 * @returns A configured DynamicsCompressor node
 */
export function createLimiter(audioContext: BaseAudioContext, threshold: number = -0.1): DynamicsCompressorNode {
  const limiter = audioContext.createDynamicsCompressor();
  
  // Professional limiter settings
  limiter.threshold.setValueAtTime(threshold, audioContext.currentTime);    // Configurable threshold
  limiter.knee.setValueAtTime(0, audioContext.currentTime);          // Hard knee
  limiter.ratio.setValueAtTime(20, audioContext.currentTime);        // 20:1 ratio
  limiter.attack.setValueAtTime(0.001, audioContext.currentTime);    // 1ms attack
  limiter.release.setValueAtTime(0.01, audioContext.currentTime);    // 10ms release
  
  return limiter;
}

/**
 * Apply limiter to audio buffer
 * @param audioBuffer - The audio buffer to process
 * @param threshold - Threshold in dBFS (default: -0.1dBFS for safety)
 * @returns The limited audio buffer
 */
export async function applyLimiter(audioBuffer: AudioBuffer, threshold: number = -0.1): Promise<AudioBuffer> {
  // Create offline context for processing
  const offlineContext = audioContextManager.createOfflineContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );
  
  // Create limiter from the offline context
  const limiter = createLimiter(offlineContext, threshold);
  
  // Create buffer source
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  
  // Connect: source → limiter → destination
  source.connect(limiter);
  limiter.connect(offlineContext.destination);
  
  source.start(0);
  
  return await offlineContext.startRendering();
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

  // Trim point is loopEnd + LOOP_END_PADDING samples (buffer for the loop end)
  const cutPoint = loopEnd + LOOP_END_PADDING;
  
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
  const shouldApplyLimiter = options.applyLimiter !== undefined ? options.applyLimiter : true;
  
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
  let normalizeGain = 1;
  let originalPeakDB = 0;
  if (normalize) {
    // Calculate original peak level in dBFS
    let maxAmplitude = 0;
    for (let ch = 0; ch < processedBuffer.numberOfChannels; ch++) {
      const channelData = processedBuffer.getChannelData(ch);
      for (let i = 0; i < channelData.length; i++) {
        const amplitude = Math.abs(channelData[i]);
        if (amplitude > maxAmplitude) {
          maxAmplitude = amplitude;
        }
      }
    }
    originalPeakDB = maxAmplitude > 0 ? 20 * Math.log10(maxAmplitude) : -Infinity;
    
    normalizeGain = calculatePeakNormalizationGain(processedBuffer, normalizeLevel);
    gainValue *= normalizeGain;
  }

  // Debug logging for normalization and gain
  if (normalize || gain !== 0) {
    const sampleInfo = options.sampleName ? ` (${options.sampleName})` : '';
    console.log(`[AUDIO PROCESSING]${sampleInfo} normalization: ${normalize}, target: ${normalizeLevel}dBFS, original peak: ${originalPeakDB.toFixed(1)}dBFS, normalizeGain: ${normalizeGain.toFixed(4)}, gain: ${gain}dBFS, final gainValue: ${gainValue.toFixed(4)}`);
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
  
  let result = await offlineContext.startRendering();
  
  // Apply limiter if enabled
  if (shouldApplyLimiter) {
    // Set limiter threshold based on normalization target
    // Add small headroom (0.1dB) to prevent limiting normalized audio
    const limiterThreshold = normalize ? normalizeLevel + 0.1 : -0.1;
    result = await applyLimiter(result, limiterThreshold);
  }
  
  return result;
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
  maxDistance: number = 1000,
  bounds?: { min?: number; max?: number }
): number {
  const channelData = audioBuffer.getChannelData(0);
  const length = channelData.length;
  
  // Clamp position to valid range
  framePosition = Math.max(0, Math.min(framePosition, length - 1));
  
  let bestPosition = framePosition;
  let minAmplitude = Math.abs(channelData[framePosition]);
  
  const searchStart = direction === 'forward' ? framePosition : Math.max(0, framePosition - maxDistance);
  const searchEnd = direction === 'backward' ? framePosition : Math.min(length - 1, framePosition + maxDistance);
  
  // Apply bounds if provided
  const boundedSearchStart = bounds?.min !== undefined ? Math.max(searchStart, bounds.min) : searchStart;
  const boundedSearchEnd = bounds?.max !== undefined ? Math.min(searchEnd, bounds.max) : boundedSearchStart;
  
  for (let i = boundedSearchStart; i <= boundedSearchEnd; i++) {
    const amplitude = Math.abs(channelData[i]);
    if (amplitude < minAmplitude) {
      minAmplitude = amplitude;
      bestPosition = i;
      
      // If we found a true zero crossing, return immediately
      if (amplitude < AUDIO_CONSTANTS.ZERO_CROSSING_THRESHOLD) {
        break;
      }
    }
  }
  
  return bestPosition;
}

// Apply zero-crossing detection to sample markers
export function applyZeroCrossingToMarkers(
  audioBuffer: AudioBuffer,
  inPoint: number,
  outPoint: number,
  loopStart?: number,
  loopEnd?: number,
  maxSearchDistance: number = 500
): {
  inPoint: number;
  outPoint: number;
  loopStart?: number;
  loopEnd?: number;
  adjustments: { marker: string; original: number; adjusted: number }[];
} {
  const adjustments: { marker: string; original: number; adjusted: number }[] = [];
  
  // Convert time-based positions to frame positions
  const inFrame = Math.floor(inPoint * audioBuffer.sampleRate);
  const outFrame = Math.floor(outPoint * audioBuffer.sampleRate);
  
  // Apply zero-crossing detection to in point (search forward)
  const adjustedInFrame = findNearestZeroCrossing(audioBuffer, inFrame, 'forward', maxSearchDistance);
  if (adjustedInFrame !== inFrame) {
    adjustments.push({
      marker: 'inPoint',
      original: inFrame,
      adjusted: adjustedInFrame
    });
  }
  
  // Apply zero-crossing detection to out point (search backward)
  const adjustedOutFrame = findNearestZeroCrossing(audioBuffer, outFrame, 'backward', maxSearchDistance);
  if (adjustedOutFrame !== outFrame) {
    adjustments.push({
      marker: 'outPoint',
      original: outFrame,
      adjusted: adjustedOutFrame
    });
  }
  
  // Apply zero-crossing detection to loop points if they exist
  let adjustedLoopStart: number | undefined;
  let adjustedLoopEnd: number | undefined;
  
  if (loopStart !== undefined) {
    const loopStartFrame = Math.floor(loopStart * audioBuffer.sampleRate);
    const inFrame = Math.floor(inPoint * audioBuffer.sampleRate);
    const outFrame = Math.floor(outPoint * audioBuffer.sampleRate);
    
    // Find zero crossing within the in/out point bounds
    adjustedLoopStart = findNearestZeroCrossing(
      audioBuffer, 
      loopStartFrame, 
      'both', 
      maxSearchDistance,
      { min: inFrame, max: outFrame }
    );
    
    if (adjustedLoopStart !== loopStartFrame) {
      adjustments.push({
        marker: 'loopStart',
        original: loopStartFrame,
        adjusted: adjustedLoopStart
      });
    }
  }
  
  if (loopEnd !== undefined) {
    const loopEndFrame = Math.floor(loopEnd * audioBuffer.sampleRate);
    const inFrame = Math.floor(inPoint * audioBuffer.sampleRate);
    const outFrame = Math.floor(outPoint * audioBuffer.sampleRate);
    
    // Find zero crossing within the in/out point bounds
    adjustedLoopEnd = findNearestZeroCrossing(
      audioBuffer, 
      loopEndFrame, 
      'both', 
      maxSearchDistance,
      { min: inFrame, max: outFrame }
    );
    
    if (adjustedLoopEnd !== loopEndFrame) {
      adjustments.push({
        marker: 'loopEnd',
        original: loopEndFrame,
        adjusted: adjustedLoopEnd
      });
    }
  }
  
  // Convert frame positions back to time
  const result = {
    inPoint: adjustedInFrame / audioBuffer.sampleRate,
    outPoint: adjustedOutFrame / audioBuffer.sampleRate,
    loopStart: adjustedLoopStart !== undefined ? adjustedLoopStart / audioBuffer.sampleRate : undefined,
    loopEnd: adjustedLoopEnd !== undefined ? adjustedLoopEnd / audioBuffer.sampleRate : undefined,
    adjustments
  };
  
  return result;
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

// Enhanced AudioBuffer to WAV conversion with SMPL chunk support
export function audioBufferToWav(
  audioBuffer: AudioBuffer, 
  bitDepth: number = 16,
  options: {
    rootNote?: number;
    loopStart?: number;
    loopEnd?: number;
  } = {}
): Blob {
  const nChannels = audioBuffer.numberOfChannels;
  if (nChannels !== 1 && nChannels !== 2) {
    throw new Error("Expecting mono or stereo audioBuffer");
  }

  const bufferLength = audioBuffer.length;
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
  dataView.setUint32(offset, audioBuffer.sampleRate, true); offset += 4;
  dataView.setUint32(offset, audioBuffer.sampleRate * nChannels * bytesPerSample, true); offset += 4; // byte rate
  dataView.setUint16(offset, nChannels * bytesPerSample, true); offset += 2; // block align
  dataView.setUint16(offset, bitDepth, true); offset += 2;
  
  // Write SMPL chunk BEFORE data chunk if we have metadata
  if (hasSmplChunk) {
    writeString(uint8, offset, "smpl"); offset += 4;
    dataView.setUint32(offset, smplChunkSize, true); offset += 4;
    
    // SMPL chunk data (60 bytes total)
    dataView.setUint32(offset, 0, true); offset += 4; // manufacturer
    dataView.setUint32(offset, 0, true); offset += 4; // product
    dataView.setUint32(offset, Math.round(1000000000 / audioBuffer.sampleRate), true); offset += 4; // sample period (nanoseconds)
    dataView.setUint32(offset, options.rootNote ?? 60, true); offset += 4; // MIDI unity note
    dataView.setUint32(offset, 0, true); offset += 4; // MIDI pitch fraction
    dataView.setUint32(offset, 0, true); offset += 4; // SMPTE format
    dataView.setUint32(offset, 0, true); offset += 4; // SMPTE offset
    dataView.setUint32(offset, 1, true); offset += 4; // number of loops
    dataView.setUint32(offset, 0, true); offset += 4; // sampler data
    
    // Loop data (24 bytes)
    dataView.setUint32(offset, 0, true); offset += 4; // cue point ID
    dataView.setUint32(offset, 0, true); offset += 4; // type (0 = forward loop)
    dataView.setUint32(offset, options.loopStart ?? 0, true); offset += 4; // start
    dataView.setUint32(offset, (options.loopEnd ?? (bufferLength - 1)) - 1, true); offset += 4; // end (subtract 1 frame)
    dataView.setUint32(offset, 0, true); offset += 4; // fraction
    dataView.setUint32(offset, 0, true); offset += 4; // play count
  }
  
  // Write data chunk
  writeString(uint8, offset, "data"); offset += 4;
  dataView.setUint32(offset, audioDataSize, true); offset += 4;
  
  // Write audio data
  if (bitDepth === 16) {
    writeAudioData16(uint8, audioBuffer, offset);
  } else if (bitDepth === 24) {
    writeAudioData24(uint8, audioBuffer, offset);
  } else {
    throw new Error(`Unsupported bit depth: ${bitDepth}`);
  }

  return new Blob([uint8], { type: "audio/wav" });
}

// Helper function to write strings to Uint8Array
function writeString(uint8: Uint8Array, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    uint8[offset + i] = str.charCodeAt(i);
  }
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

export function parseFilename(filename: string, mapping: 'C3' | 'C4' = 'C3'): [string, number] {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  const match = nameWithoutExt.match(/(.+?)[\s-]*([A-G](?:b|#)?\d|\d{1,3})$/i);
  if (!match) {
    throw new Error(`Filename '${filename}' does not match the expected pattern.`);
  }
  const baseName = sanitizeName(match[1]);
  const noteOrNumber = match[2];
  
  if (/^[A-G](?:b|#)?\d$/i.test(noteOrNumber)) {
    return [baseName, noteStringToMidiValue(noteOrNumber, mapping)];
  }
  return [baseName, parseInt(noteOrNumber, 10)];
}

export const NOTE_OFFSET = [33, 35, 24, 26, 28, 29, 31];
export const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

export function midiNoteToString(value: number, mapping: 'C3' | 'C4' = 'C3'): string {
  if (value < 0 || value > 127) return '';
  const noteNumber = value % 12;
  // C3=60: octave = Math.floor(value / 12) - 2
  // C4=60: octave = Math.floor(value / 12) - 1
  const octave = mapping === 'C3'
    ? Math.floor(value / 12) - 2
    : Math.floor(value / 12) - 1;
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

export function noteStringToMidiValue(note: string, mapping: 'C3' | 'C4' = 'C3'): number {
  const match = note.match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!match) throw new Error('Bad note format');
  const [, letter, accidental, octaveStr] = match;
  const base = letter.toUpperCase() + (accidental || '');
  const semitone = NOTE_NAME_TO_SEMITONE[base];
  if (semitone === undefined) throw new Error('Bad note');
  const octave = parseInt(octaveStr, 10);
  // C3=60: (octave + 2) * 12 + semitone
  // C4=60: (octave + 1) * 12 + semitone
  return (mapping === 'C3'
    ? (octave + 2) * 12
    : (octave + 1) * 12
  ) + semitone;
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
 * Generate a new filename based on preset name and sample type
 * @param presetName - The preset name to use as base
 * @param separator - The separator to use between parts (' ' or '-')
 * @param type - The type of sample ('drum' or 'multisample')
 * @param index - The sample index (for drum) or note (for multisample)
 * @param originalName - The original filename (for extension)
 * @param mapping - The MIDI note mapping convention ('C3' or 'C4')
 * @param extension - The file extension to use (defaults to 'wav')
 * @returns The new filename
 */
export function generateFilename(
  presetName: string, 
  separator: FilenameSeparator, 
  type: 'drum' | 'multisample', 
  index: number, 
  _originalName: string,
  mapping: 'C3' | 'C4' = 'C3',
  extension: string = 'wav'
): string {
  
  // Normalize separators in preset name and trim leading/trailing separators
  const normalizedPresetName = presetName.replace(/[ _-]+/g, separator).replace(/^[ _-]+|[ _-]+$/g, '');
  
  // Sanitize preset name - remove invalid characters but keep the chosen separator
  const allowedChars = separator === ' ' ? 'a-zA-Z0-9 ' : 'a-zA-Z0-9-';
  const cleanPresetName = normalizedPresetName.replace(new RegExp(`[^${allowedChars}]`, 'g'), '');
  
  if (type === 'drum') {
    // Short drum key labels by index (from DrumKeyboard.tsx)
    // Keep original labels to match TE docs, handle duplicate 'LT' in filename generation
    const drumShortLabels = [
      'KD1', 'KD2', 'SD1', 'SD2', 'RIM', 'CLP', 'TB', 'SH', 'CH', 'CL', 'OH', 'CAB',
      'RC', 'CC', 'LT', 'COW', 'MT', 'HT', 'LC', 'HC', 'TRI', 'LT', 'WS', 'GUI'
    ];
    let drumLabel = drumShortLabels[index] || `DRUM${index + 1}`;
    
    // Handle duplicate 'LT' entries - second LT becomes 'LT2' in filename
    if (drumLabel === 'LT' && index === 21) {
      drumLabel = 'LT2';
    }
    
    return `${cleanPresetName}${separator}${drumLabel}.${extension}`;
  } else {
    // For multisample, use note names with proper MIDI mapping
    const noteString = midiNoteToString(index, mapping);
    return `${cleanPresetName}${separator}${noteString}.${extension}`;
  }
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