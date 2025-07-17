// Audio format utilities for handling multiple file types
// Supports WAV, AIF, AIFF, MP3 with metadata extraction capabilities.
//
// Implementation based on public AIF/AIFF format documentation and general best practices.
// No code was copied from proprietary or third-party sources.

import { audioContextManager } from './audioContext';
import { readWavMetadataFromArrayBuffer } from './audio';
import { 
  parseCommChunk, 
  parseMarkChunk, 
  parseInstChunk
} from './aifParser';

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
  // Format-specific metadata
  isFloat?: boolean; // Whether audio data is floating point (32-bit float, etc.)
  rootNote?: number;
  loopPoints?: {
    start: number;
    end: number;
  }[];
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

    // Check AIFF/AIFC format identifier (bytes 8-11)
    const formatId = textDecoder.decode(new Uint8Array(bufferCopy, 8, 4));
    if (formatId !== 'AIFF' && formatId !== 'AIFC') {
      throw new Error(`Invalid AIF file: expected AIFF or AIFC format identifier, got "${formatId}"`);
    }

    // Parse chunks in the file to extract metadata
    let offset = 12;
    let channels = 2;
    let numSampleFrames = 0;
    let bitDepth = 16;
    let sampleRate = 44100;
    let isFloat = false;
    let loopStart: number | undefined;
    let loopEnd: number | undefined;
    let rootNote: number | undefined;
    let ssndOffset = 0;
    let ssndSize = 0;
    let foundLoopPoints = false;
    
    // Marker table for loop points
    let markersList: Array<{ id: number; position: number; name: string }> = [];

    // Iterate through all chunks in the file
    while (offset + 8 < bufferCopy.byteLength) {
      const chunkId = textDecoder.decode(new Uint8Array(bufferCopy, offset, 4));
      const chunkSize = dataView.getUint32(offset + 4, false);
      const chunkDataOffset = offset + 8;
      
      // Parse COMM chunk for core audio properties
      if (chunkId === 'COMM' && chunkSize >= 18) {
        const commChunk = parseCommChunk(dataView, bufferCopy, chunkDataOffset, chunkSize, formatId);
        channels = commChunk.channels;
        numSampleFrames = commChunk.numSampleFrames;
        bitDepth = commChunk.bitDepth;
        sampleRate = commChunk.sampleRate;
        isFloat = commChunk.isFloat;
        
        // Log format detection for debugging
        if (isFloat) {
          console.log(`[AIF PARSER] Detected ${bitDepth}-bit float format`);
        }
      }
      
      // Parse MARK chunk for marker positions (used for loop points)
      if (chunkId === 'MARK') {
        markersList = parseMarkChunk(dataView, bufferCopy, chunkDataOffset);
        // Check for loop point markers by name (when no INST chunk is present)
        for (const marker of markersList) {
          const lowerName = marker.name.toLowerCase();
          if (lowerName.includes('loop start') || lowerName.includes('start')) {
            // Markers should be in sample frames - use position directly
            loopStart = marker.position;
            foundLoopPoints = true;
          } else if (lowerName.includes('loop end') || lowerName.includes('end')) {
            // Markers should be in sample frames - use position directly
            loopEnd = marker.position;
            foundLoopPoints = true;
          }
        }
      }
      
      // Parse INST chunk for root note and loop marker references
      if (chunkId === 'INST') {
        // Use the markersList from MARK chunk if available
        const instChunk = parseInstChunk(dataView, chunkDataOffset, markersList || []);
        // Get loop points from markers with validation
        if (instChunk.loopStart !== undefined) {
          loopStart = instChunk.loopStart;
          foundLoopPoints = true;
        }
        if (instChunk.loopEnd !== undefined) {
          loopEnd = instChunk.loopEnd;
          foundLoopPoints = true;
        }
        // Calculate root note from base note and detune
        if (instChunk.rootNote !== undefined) {
          rootNote = instChunk.rootNote;
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
      offset += 8 + chunkSize + (chunkSize % 2);
    }

    // Fallbacks and validation for missing or incomplete metadata
    if (!numSampleFrames && markersList.length > 0) {
      numSampleFrames = Math.max(...markersList.map(m => m.position));
    }
    
    // Loop points are now used directly without Logic Pro scaling corrections
    
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
      // Browser decode failed, fall back to manual AIF decoder
      if (ssndOffset > 0 && ssndSize > 0) {
        try {
          audioBuffer = await decodeAifManually(bufferCopy, ssndOffset, ssndSize, channels, bitDepth, sampleRate, numSampleFrames, isFloat);
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
    
    // Ensure rootNote is set on metadata if found in INST chunk
    const finalRootNote = rootNote !== undefined ? rootNote : undefined;

    // Return extracted metadata with audioBuffer (may be null if decoding failed)
    return {
      format: 'aiff',
      sampleRate,
      bitDepth,
      channels,
      duration,
      audioBuffer: audioBuffer as any, // Will be null if decoding failed
      fileSize: bufferCopy.byteLength,
      midiNote,
      loopStart: loopStartSeconds,
      loopEnd: loopEndSeconds,
      hasLoopData: foundLoopPoints,
      isFloat,
      rootNote: finalRootNote
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
  numSampleFrames: number,
  isFloat: boolean = false
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
        
        // Convert based on bit depth and format
        if (isFloat && bitDepth === 32) {
          // 32-bit float (big-endian)
          sample = dataView.getFloat32(sampleOffset, false);
        } else if (isFloat && bitDepth === 64) {
          // 64-bit float (big-endian)
          sample = dataView.getFloat64(sampleOffset, false);
        } else {
          // Integer formats
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
    hasLoopData: false,
    isFloat: false // MP3 doesn't support float format
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
          hasLoopData: wavMetadata.hasLoopData,
          isFloat: false // WAV format in our implementation doesn't support float
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
  // Convert from seconds to frames since audioBufferToWav expects frame indices
  const options = {
    rootNote: metadata.rootNote || metadata.midiNote,
    loopStart: metadata.hasLoopData ? Math.floor(metadata.loopStart * audioBuffer.sampleRate) : undefined,
    loopEnd: metadata.hasLoopData ? Math.floor(metadata.loopEnd * audioBuffer.sampleRate) : undefined
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