// Audio format utilities for handling multiple file types
// Supports WAV, AIF, AIFF, MP3 with metadata extraction capabilities.
//
// Implementation based on public AIF/AIFF format documentation and general best practices.
// No code was copied from proprietary or third-party sources.

import { audioContextManager } from './audioContext';
import { readWavMetadataFromArrayBuffer } from './audio';

// Audio format types
export type AudioFormat = 'wav' | 'aif' | 'aiff' | 'mp3' | 'm4a' | 'ogg' | 'flac';

// Metadata interface for all audio formats
export interface AudioMetadata {
  format: AudioFormat;
  sampleRate: number;
  bitDepth: number;
  channels: number;
  duration: number;
  audioBuffer: AudioBuffer;
  fileSize: number;
  // MIDI note and loop data (common across formats)
  midiNote: number;
  loopStart: number;
  loopEnd: number;
  hasLoopData: boolean;
  // AIF-specific metadata
  rootNote?: number;
  loopPoints?: {
    start: number;
    end: number;
  }[];
}

// Parse IEEE 80-bit extended precision float (used for sample rate in AIFF)
function parseIeee80BitFloat(dataView: DataView, offset: number): number {
  // IEEE 80-bit format: 1 bit sign, 15 bits exponent, 64 bits mantissa
  const signBit = (dataView.getUint8(offset) & 0x80) !== 0;
  const exponent = ((dataView.getUint8(offset) & 0x7F) << 8) | dataView.getUint8(offset + 1);
  
  // Extract 64-bit mantissa (8 bytes)
  let mantissa = 0;
  for (let i = 2; i < 10; i++) {
    mantissa = mantissa * 256 + dataView.getUint8(offset + i);
  }
  
  // Handle special cases
  if (exponent === 0) {
    return 0; // Zero or denormalized
  }
  
  if (exponent === 0x7FFF) {
    return signBit ? -Infinity : Infinity; // Infinity or NaN
  }
  
  // Normal calculation
  const biasedExponent = exponent - 16383;
  const normalizedMantissa = 1 + mantissa / Math.pow(2, 63);
  const result = Math.pow(2, biasedExponent) * normalizedMantissa;
  
  // Validate and snap to common sample rates
  if (result > 0 && result < 1000000) {
    const commonRates = [
      { rate: 44100, tolerance: 300 },
      { rate: 48000, tolerance: 200 },
      { rate: 22050, tolerance: 100 },
      { rate: 88200, tolerance: 400 },
      { rate: 96000, tolerance: 200 },
      { rate: 11025, tolerance: 50 },
      { rate: 16000, tolerance: 50 },
      { rate: 8000, tolerance: 50 },
      { rate: 176400, tolerance: 500 },
      { rate: 192000, tolerance: 500 }
    ];
    
    for (const { rate, tolerance } of commonRates) {
      if (Math.abs(result - rate) < tolerance) {
        return rate;
      }
    }
    
    // Special case for 44.1kHz range
    if (result >= 43000 && result <= 45500) {
      return 44100;
    }
  }
  
  return signBit ? -result : result;
}

// Validate and normalize sample rate
function validateSampleRate(sampleRate: number): number {
  if (sampleRate >= 8000 && sampleRate <= 192000) {
    // Check against common sample rates
    const commonRates = [8000, 11025, 16000, 22050, 44100, 48000, 88200, 96000, 176400, 192000];
    for (const rate of commonRates) {
      if (Math.abs(sampleRate - rate) <= rate * 0.02) {
        return rate;
      }
    }
    return Math.round(sampleRate);
  }
  
  console.warn(`Invalid sample rate detected: ${sampleRate}Hz. Using fallback 44100Hz.`);
  return 44100;
}

// Parse AIF metadata from header only (no decodeAudioData)
// This function extracts audio metadata (sample rate, bit depth, channels, loop points, root note, etc.)
// directly from the AIF/AIFF file header. It does not attempt to decode the audio data for playback.
// This approach ensures robust metadata extraction even for files that are not supported by browser decoders.
//
// Implementation is original and based on the published AIF/AIFF file format specification.
// No code was copied from proprietary or third-party sources.
async function parseAifMetadata(arrayBuffer: ArrayBuffer, filename: string, mapping: 'C3' | 'C4' = 'C3'): Promise<AudioMetadata> {
  try {
    // Create a copy of the ArrayBuffer early to avoid detachment issues
    const bufferCopy = arrayBuffer.slice(0);
    const dataView = new DataView(bufferCopy);
    const textDecoder = new TextDecoder('ascii');
    
    // Check FORM header (standard for AIF/AIFF files)
    const form = textDecoder.decode(new Uint8Array(bufferCopy, 0, 4));
    if (form !== 'FORM') {
      throw new Error('Invalid AIF file: missing FORM header');
    }

    // Check AIFF/AIFC format identifier
    


    // Parse chunks in the file to extract metadata
    let offset = 12;
    let channels = 2;
    let numSampleFrames = 0;
    let bitDepth = 16;
    let sampleRate = 44100;
    let loopStart: number | undefined;
    let loopEnd: number | undefined;
    let rootNote: number | undefined;
    let ssndOffset = 0;
    let ssndSize = 0;
    let foundLoopPoints = false;
    
    // Marker table for loop points
    const markers: Record<number, number> = {};

    // Iterate through all chunks in the file
    while (offset + 8 < bufferCopy.byteLength) {
      const chunkId = textDecoder.decode(new Uint8Array(bufferCopy, offset, 4));
      const chunkSize = dataView.getUint32(offset + 4, false);
      const chunkDataOffset = offset + 8;
      
      // Parse COMM chunk for core audio properties
      if (chunkId === 'COMM' && chunkSize >= 18) {
        channels = dataView.getUint16(chunkDataOffset, false);
        numSampleFrames = dataView.getUint32(chunkDataOffset + 2, false);
        bitDepth = dataView.getUint16(chunkDataOffset + 6, false);
        // Parse IEEE 80-bit float sample rate (standard for AIFF)
        sampleRate = parseIeee80BitFloat(dataView, chunkDataOffset + 8);
        sampleRate = validateSampleRate(sampleRate);
      }
      
      // Parse MARK chunk for marker positions (used for loop points)
      if (chunkId === 'MARK') {
        const numMarkers = dataView.getUint16(chunkDataOffset, false);
        let markerOffset = chunkDataOffset + 2;
        
        for (let i = 0; i < numMarkers; i++) {
          const markerId = dataView.getUint16(markerOffset, false);
          const markerPosition = dataView.getUint32(markerOffset + 2, false);
          const markerNameLength = dataView.getUint8(markerOffset + 6);
          
          // Parse marker name (Pascal string)
          const markerNameBytes = new Uint8Array(bufferCopy, markerOffset + 7, markerNameLength);
          const markerName = textDecoder.decode(markerNameBytes);
          
          markers[markerId] = markerPosition;
          
          // Check for loop point markers by name (when no INST chunk is present)
          const lowerName = markerName.toLowerCase();
          if (lowerName.includes('loop start') || lowerName.includes('start')) {
            loopStart = markerPosition;
            foundLoopPoints = true;
          } else if (lowerName.includes('loop end') || lowerName.includes('end')) {
            loopEnd = markerPosition;
            foundLoopPoints = true;
          }
          
          markerOffset += 7 + markerNameLength + (markerNameLength % 2 === 0 ? 1 : 0);
        }
      }
      
      // Parse INST chunk for root note and loop marker references
      if (chunkId === 'INST') {
        const baseNote = dataView.getUint8(chunkDataOffset);
        const detune = dataView.getInt8(chunkDataOffset + 1);
        const sustainLoop = dataView.getUint16(chunkDataOffset + 8, false);
        const releaseLoop = dataView.getUint16(chunkDataOffset + 10, false);
        
        // Get loop points from markers with validation
        if (sustainLoop > 0) {
          if (markers[sustainLoop] !== undefined) {
            loopStart = markers[sustainLoop];
          }
          foundLoopPoints = true;
        }
        
        if (releaseLoop > 0) {
          if (markers[releaseLoop] !== undefined) {
            loopEnd = markers[releaseLoop];
          }
          foundLoopPoints = true;
        }
        
        // Calculate root note from base note and detune
        if (baseNote > 0) {
          rootNote = baseNote + Math.round(detune / 100);
        }
      }
      
      // Store SSND chunk info for audio data extraction
      if (chunkId === 'SSND') {
        ssndOffset = chunkDataOffset;
        ssndSize = chunkSize;
        if (!numSampleFrames) {
          const dataSize = chunkSize - 8; // Subtract offset and block size
          if (bitDepth && channels) {
            numSampleFrames = Math.floor(dataSize / (bitDepth / 8 * channels));
          }
        }
      }
      
      // Move to next chunk (chunks are padded to even boundaries)
      offset += 8 + (chunkSize + 1 & ~1);
    }

    // Fallbacks and validation for missing or incomplete metadata
    if (!numSampleFrames && Object.keys(markers).length > 0) {
      numSampleFrames = Math.max(...Object.values(markers));
    }
    
    // Validate and set loop points only if they were found in the file
    if (foundLoopPoints) {
      // Validate loop points are within audio duration
      const maxFrame = numSampleFrames - 1;
      
      if (loopStart !== undefined) {
        if (loopStart < 0 || loopStart > maxFrame) {
          console.warn(`[AIF PARSER] Invalid loop start ${loopStart}, clamping to valid range`);
          loopStart = Math.max(0, Math.min(loopStart, maxFrame));
        }
      } else {
        loopStart = 0;
      }
      
      if (loopEnd !== undefined) {
        if (loopEnd <= loopStart || loopEnd > maxFrame) {
          console.warn(`[AIF PARSER] Invalid loop end ${loopEnd}, clamping to valid range`);
          loopEnd = Math.max(loopStart + 1, Math.min(loopEnd, maxFrame));
        }
      } else {
        loopEnd = maxFrame;
      }
    } else {
      // No loop points found in file, set to defaults
      loopStart = 0;
      loopEnd = Math.max(0, numSampleFrames - 1);
    }
    

    
    const duration = numSampleFrames / sampleRate;

    // Now attempt to decode the audio data for playback
    let audioBuffer: AudioBuffer | null = null;
    try {
      const audioContext = await audioContextManager.getAudioContext();
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (decodeError) {
      console.warn(`[AIF PARSER] Failed to decode audio data for ${filename}:`, decodeError);
      
      // Manual AIF decoder fallback - extract raw PCM data and create AudioBuffer
      if (ssndOffset > 0 && ssndSize > 0) {
        try {
          audioBuffer = await decodeAifManually(bufferCopy, ssndOffset, ssndSize, channels, bitDepth, sampleRate, numSampleFrames);
        } catch (manualError) {
          console.error(`[AIF PARSER] Manual AIF decoder failed for ${filename}:`, manualError);
          // Continue with null audioBuffer - metadata is still valid
        }
      }
    }

    // Extract root note from filename if not found in INST chunk
    let midiNote = rootNote || 60;
    if (!rootNote) {
      try {
        const { parseFilename } = await import('./audio');
        const parsed = parseFilename(filename, mapping);
        if (parsed && parsed.length > 1) {
          midiNote = parsed[1];
        }
      } catch (_) {
        // ignore filename parsing errors
      }
    }

    // Convert loop points from frames to seconds
    const loopStartSeconds = loopStart !== undefined ? loopStart / sampleRate : 0;
    const loopEndSeconds = loopEnd !== undefined ? loopEnd / sampleRate : duration;
    
    // DEBUG: Log raw loop point extraction
    console.log(`[AIF PARSER] ${filename}: loopStart=${loopStart}, loopEnd=${loopEnd}, numSampleFrames=${numSampleFrames}, sampleRate=${sampleRate}, foundLoopPoints=${foundLoopPoints}`);
    console.log(`[AIF PARSER] ${filename}: loopStartSeconds=${loopStartSeconds}, loopEndSeconds=${loopEndSeconds}, duration=${duration}`);
    
    // Return extracted metadata with audioBuffer (may be null if decoding failed)
    return {
      format: 'aiff',
      sampleRate,
      bitDepth,
      channels,
      duration,
      audioBuffer: audioBuffer as any, // Will be null if decoding failed
      fileSize: arrayBuffer.byteLength,
      midiNote,
      loopStart: loopStartSeconds,
      loopEnd: loopEndSeconds,
      hasLoopData: foundLoopPoints,
      rootNote: rootNote
    };
  } catch (error) {
    throw new Error(`Failed to parse AIF metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Manual AIF decoder - extracts raw PCM data and creates AudioBuffer
async function decodeAifManually(
  arrayBuffer: ArrayBuffer,
  ssndOffset: number,
  _ssndSize: number,
  channels: number,
  bitDepth: number,
  sampleRate: number,
  numSampleFrames: number
): Promise<AudioBuffer> {
  const dataView = new DataView(arrayBuffer);
  
  // SSND chunk structure: offset (4 bytes) + blockSize (4 bytes) + audio data
  const offset = dataView.getUint32(ssndOffset, false);
  const audioDataOffset = ssndOffset + 8 + offset; // Skip offset and blockSize
  const bytesPerSample = bitDepth / 8;
  const bytesPerFrame = bytesPerSample * channels;
  

  
  // Create AudioContext with matching sample rate
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: sampleRate
  });
  
  // Create empty AudioBuffer
  const audioBuffer = audioContext.createBuffer(channels, numSampleFrames, sampleRate);
  
  // Extract and convert PCM data
  for (let channel = 0; channel < channels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    
    for (let frame = 0; frame < numSampleFrames; frame++) {
      const sampleOffset = audioDataOffset + (frame * bytesPerFrame) + (channel * bytesPerSample);
      
      if (sampleOffset + bytesPerSample <= arrayBuffer.byteLength) {
        let sample: number;
        
        // Convert based on bit depth
        switch (bitDepth) {
          case 8:
            // 8-bit unsigned
            sample = (dataView.getUint8(sampleOffset) - 128) / 128;
            break;
          case 16:
            // 16-bit signed, big-endian
            sample = dataView.getInt16(sampleOffset, false) / 32768;
            break;
          case 24:
            // 24-bit signed, big-endian
            const b1 = dataView.getUint8(sampleOffset);
            const b2 = dataView.getUint8(sampleOffset + 1);
            const b3 = dataView.getUint8(sampleOffset + 2);
            const signed = (b1 & 0x80) !== 0;
            let value = (b1 << 16) | (b2 << 8) | b3;
            if (signed) {
              value = value - 0x1000000;
            }
            sample = value / 8388608;
            break;
          case 32:
            // 32-bit signed, big-endian
            sample = dataView.getInt32(sampleOffset, false) / 2147483648;
            break;
          default:
            sample = 0;
            console.warn(`Unsupported bit depth: ${bitDepth}`);
        }
        
        channelData[frame] = sample;
      }
    }
  }
  

  return audioBuffer;
}

// Parse MP3 metadata (basic implementation)
async function parseMp3Metadata(
  arrayBuffer: ArrayBuffer,
  filename: string,
  fileSize: number,
  mapping: 'C3' | 'C4' = 'C3'
): Promise<AudioMetadata> {
  // For MP3, we rely on the Web Audio API to decode and extract basic info
  const audioContext = await audioContextManager.getAudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Extract root note from filename
  let midiNote = -1;
  try {
    const { parseFilename } = await import('./audio');
    const parsed = parseFilename(filename, mapping);
    if (parsed && parsed.length > 1) {
      midiNote = parsed[1];
    }
  } catch (_) {
    // ignore filename parsing errors
  }

  return {
    format: 'mp3',
    sampleRate: audioBuffer.sampleRate,
    bitDepth: 16, // MP3 is typically 16-bit
    channels: audioBuffer.numberOfChannels,
    duration: audioBuffer.duration,
    audioBuffer,
    fileSize,
    midiNote,
    loopStart: audioBuffer.duration * 0.1,
    loopEnd: audioBuffer.duration * 0.9,
    hasLoopData: false
  };
}

// Read audio metadata from File object
export async function readAudioMetadata(file: File, mapping: 'C3' | 'C4' = 'C3'): Promise<AudioMetadata> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    return await readAudioMetadataFromArrayBuffer(arrayBuffer, file.name, file.size, mapping);
  } catch (error) {
    throw new Error(`Failed to read audio metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Overloaded version that accepts ArrayBuffer directly
export async function readAudioMetadataFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  filename: string,
  fileSize: number,
  mapping: 'C3' | 'C4' = 'C3'
): Promise<AudioMetadata> {
  try {
    // Detect file format
    const format = detectAudioFormat(arrayBuffer, filename);
    
    switch (format) {
      case 'wav':
        const wavMetadata = await readWavMetadataFromArrayBuffer(arrayBuffer, filename, fileSize, mapping);
        // Convert WavMetadata to AudioMetadata
        return {
          format: 'wav' as const,
          sampleRate: wavMetadata.sampleRate,
          bitDepth: wavMetadata.bitDepth,
          channels: wavMetadata.channels,
          duration: wavMetadata.duration,
          audioBuffer: wavMetadata.audioBuffer,
          fileSize: wavMetadata.fileSize,
          midiNote: wavMetadata.midiNote,
          loopStart: wavMetadata.loopStart,
          loopEnd: wavMetadata.loopEnd,
          hasLoopData: wavMetadata.hasLoopData
        };
      case 'aif':
      case 'aiff':
        return await parseAifMetadata(arrayBuffer, filename, mapping);
      case 'mp3':
        return await parseMp3Metadata(arrayBuffer, filename, fileSize, mapping);
      default:
        throw new Error(`Unsupported audio format: ${format}`);
    }
  } catch (error) {
    throw new Error(`Failed to read audio metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Detect audio format from file header and extension
export function detectAudioFormat(arrayBuffer: ArrayBuffer, filename: string): AudioFormat {
  const extension = filename.toLowerCase().split('.').pop();
  
  // Check file headers
  if (arrayBuffer.byteLength >= 4) {
    const header = String.fromCharCode(...Array.from(new Uint8Array(arrayBuffer, 0, 4)));
    
    if (header === 'RIFF') {
      return 'wav';
    }
    
    if (header === 'FORM') {
      return 'aiff';
    }
    
    if (header === 'ID3' || header === '\xff\xfb') {
      return 'mp3';
    }
  }
  
  // Fallback to extension
  switch (extension) {
    case 'wav':
      return 'wav';
    case 'aif':
    case 'aiff':
      return 'aiff';
    case 'mp3':
      return 'mp3';
    case 'm4a':
      return 'm4a';
    case 'ogg':
      return 'ogg';
    case 'flac':
      return 'flac';
    default:
      throw new Error(`Unsupported audio format: ${extension}`);
  }
}

// Convert audio buffer to WAV with metadata preservation
export async function audioBufferToWavWithMetadata(
  audioBuffer: AudioBuffer,
  metadata: AudioMetadata,
  bitDepth: number = 16
): Promise<Blob> {
  const { audioBufferToWav } = await import('./audio');
  
  // Use metadata loop points if available
  const options = {
    rootNote: metadata.rootNote || metadata.midiNote,
    loopStart: metadata.hasLoopData ? metadata.loopStart : undefined,
    loopEnd: metadata.hasLoopData ? metadata.loopEnd : undefined
  };
  
  return audioBufferToWav(audioBuffer, bitDepth, options);
}

// Validate audio file format
export function isValidAudioFile(file: File): boolean {
  const validTypes = [
    'audio/wav',
    'audio/aiff',
    'audio/aif',
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/ogg',
    'audio/flac'
  ];
  
  const validExtensions = [
    '.wav',
    '.aif',
    '.aiff',
    '.mp3',
    '.m4a',
    '.ogg',
    '.flac'
  ];
  
  // Check MIME type
  if (validTypes.includes(file.type)) {
    return true;
  }
  
  // Check file extension
  const extension = file.name.toLowerCase();
  return validExtensions.some(ext => extension.endsWith(ext));
} 