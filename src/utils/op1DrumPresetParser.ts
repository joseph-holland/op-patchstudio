// OP-1 drum preset parser
// Parses OP-1 drum preset files (.aif/.aiff) and extracts individual drum samples
//
// Implementation based on public AIF/AIFF format documentation and OP-1 file structure analysis.
// No code was copied from proprietary or third-party sources.

import { audioContextManager } from './audioContext';
import { 
  parseCommChunk, 
  parseMarkChunk 
} from './aifParser';
import type { AudioMetadata } from './audioFormats';

export interface OP1DrumSample {
  keyIndex: number; // 0-23 for OP-XY drum keys
  startSample: number;
  endSample: number;
  duration: number;
  name: string;
  audioBuffer: AudioBuffer;
  metadata: AudioMetadata;
}

export interface OP1DrumPreset {
  name: string;
  samples: OP1DrumSample[];
  totalDuration: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

// Parse OP-1 drum preset AIFF file
export async function parseOP1DrumPreset(arrayBuffer: ArrayBuffer, filename: string): Promise<OP1DrumPreset> {
  try {
    const dataView = new DataView(arrayBuffer);
    const textDecoder = new TextDecoder('ascii');
    
    // Extract base filename for sample naming (remove extension)
    const baseFilename = filename.replace(/\.(aif|aiff)$/i, '');
    
    // Check FORM header
    const form = textDecoder.decode(new Uint8Array(arrayBuffer, 0, 4));
    if (form !== 'FORM') {
      throw new Error('Invalid AIFF file: missing FORM header');
    }

    // Check AIFF/AIFC format identifier
    const formatId = textDecoder.decode(new Uint8Array(arrayBuffer, 8, 4));
    if (formatId !== 'AIFF' && formatId !== 'AIFC') {
      throw new Error(`Invalid AIFF file: expected AIFF or AIFC format identifier, got "${formatId}"`);
    }

    // Parse chunks to extract metadata and sample positions
    let offset = 12;
    let channels = 2;
    let numSampleFrames = 0;
    let bitDepth = 16;
    let sampleRate = 44100;
    let ssndOffset = 0;
    let isLittleEndian = false; // Track byte order for audio data
    
    // Sample metadata from chunks
    const sampleMetadata: Array<{
      keyIndex: number;
      startSample: number;
      endSample: number;
      name: string;
    }> = [];

    // Parse chunks
    while (offset + 8 < arrayBuffer.byteLength) {
      const chunkId = textDecoder.decode(new Uint8Array(arrayBuffer, offset, 4));
      const chunkSize = dataView.getUint32(offset + 4, false);
      const chunkDataOffset = offset + 8;
      
      // Parse COMM chunk for core audio properties
      if (chunkId === 'COMM') {
        const commChunk = parseCommChunk(dataView, arrayBuffer, chunkDataOffset, chunkSize, formatId);
        channels = commChunk.channels;
        numSampleFrames = commChunk.numSampleFrames;
        bitDepth = commChunk.bitDepth;
        sampleRate = commChunk.sampleRate;
        isLittleEndian = commChunk.isLittleEndian;
      }
      
      // Parse SSND chunk for audio data location
      if (chunkId === 'SSND') {
        // SSND chunk structure: offset (4 bytes) + blockSize (4 bytes) + audio data
        ssndOffset = chunkDataOffset; // Store the SSND chunk start for reference
      }
      
      // Parse custom OP-1 metadata chunks
      if (chunkId === 'OP1D' || chunkId === 'OP1F') {
        // OP-1 drum preset metadata chunk
        const numSamples = dataView.getUint16(chunkDataOffset, false);
        let sampleOffset = chunkDataOffset + 2;
        
        for (let i = 0; i < numSamples; i++) {
          const keyIndex = dataView.getUint8(sampleOffset);
          const startSample = dataView.getUint32(sampleOffset + 1, false);
          const endSample = dataView.getUint32(sampleOffset + 5, false);
          const nameLength = dataView.getUint8(sampleOffset + 9);
          
          // Parse sample name
          const nameBytes = new Uint8Array(arrayBuffer, sampleOffset + 10, nameLength);
          const name = textDecoder.decode(nameBytes);
          
          sampleMetadata.push({
            keyIndex,
            startSample,
            endSample,
            name: name || `${baseFilename} sample ${i + 1}`
          });
          
          sampleOffset += 10 + nameLength;
        }
      }
      
      // Parse APPL chunk for OP-1 metadata
      if (chunkId === 'APPL' && sampleMetadata.length === 0) {
        try {
          const applData = new Uint8Array(arrayBuffer, chunkDataOffset, chunkSize);
          const applText = textDecoder.decode(applData);
          
          // Check if this is OP-1 metadata
          if (applText.startsWith('op-1')) {
            const jsonStart = applText.indexOf('{');
            if (jsonStart !== -1) {
              let jsonStr = applText.substring(jsonStart);
              
              // Clean the JSON string by removing null characters and other problematic characters
              jsonStr = jsonStr.replace(/\0/g, ''); // Remove null characters
              jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ''); // Remove other control characters
              jsonStr = jsonStr.trim(); // Remove leading/trailing whitespace
              
              // Try to find the end of the JSON object
              let braceCount = 0;
              let jsonEnd = -1;
              for (let i = 0; i < jsonStr.length; i++) {
                if (jsonStr[i] === '{') {
                  braceCount++;
                } else if (jsonStr[i] === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    jsonEnd = i + 1;
                    break;
                  }
                }
              }
              
              // If we found a complete JSON object, use it
              if (jsonEnd > 0) {
                jsonStr = jsonStr.substring(0, jsonEnd);
              }
              
              const op1Metadata = JSON.parse(jsonStr);
              
              // Check if this is a drum preset
              if (op1Metadata.type === 'drum' && op1Metadata.drum_version) {
                // Extract sample positions from the metadata
                if (op1Metadata.start && op1Metadata.end && Array.isArray(op1Metadata.start) && Array.isArray(op1Metadata.end)) {
                  const numSamples = Math.min(op1Metadata.start.length, op1Metadata.end.length, 24);
                  
                  // Track unique samples to avoid duplicates
                  const uniqueSamples = new Map<string, number>();
                  const validSamples: Array<{
                    keyIndex: number;
                    startSample: number;
                    endSample: number;
                    name: string;
                  }> = [];
                  
                  for (let i = 0; i < numSamples; i++) {
                    const startSample = op1Metadata.start[i];
                    const endSample = op1Metadata.end[i];
                    
                    if (startSample !== undefined && endSample !== undefined && endSample > startSample) {
                      const sampleKey = `${startSample}-${endSample}`;
                      
                      // Only add if this is a unique sample
                      if (!uniqueSamples.has(sampleKey)) {
                        uniqueSamples.set(sampleKey, i);
                        validSamples.push({
                          keyIndex: i,
                          startSample,
                          endSample,
                          name: `${baseFilename} sample ${i + 1}`
                        });
                      }
                    }
                  }
                  
                  // Add the valid samples to metadata
                  sampleMetadata.push(...validSamples);
                }
              }
            }
          }
        } catch (error) {
          console.warn('Failed to parse APPL chunk:', error);
        }
      }
      
      // Parse MARK chunk for marker-based sample positions (fallback)
      if (chunkId === 'MARK' && sampleMetadata.length === 0) {
        const markersList = parseMarkChunk(dataView, arrayBuffer, chunkDataOffset);
        
        for (const marker of markersList) {
          // Try to extract key index from marker name or ID
          let keyIndex = extractKeyIndexFromMarker(marker.id, marker.name);
          
          // If no key index found, use the marker index as key index (load in order found)
          if (keyIndex === null) {
            keyIndex = markersList.indexOf(marker);
          }
          
          // Only add if we have a valid key index
          if (keyIndex >= 0 && keyIndex < 24) {
            sampleMetadata.push({
              keyIndex,
              startSample: marker.position,
              endSample: 0, // Will be calculated from next marker
              name: marker.name || `${baseFilename} sample ${keyIndex + 1}`
            });
          }
        }
        
        // Calculate end samples from start positions
        for (let i = 0; i < sampleMetadata.length; i++) {
          if (i < sampleMetadata.length - 1) {
            sampleMetadata[i].endSample = sampleMetadata[i + 1].startSample;
          } else {
            sampleMetadata[i].endSample = numSampleFrames;
          }
        }
      }
      
      offset += 8 + chunkSize + (chunkSize % 2 === 1 ? 1 : 0); // Account for padding
    }

    if (sampleMetadata.length === 0) {
      throw new Error('No sample metadata found in OP-1 drum preset file');
    }

    // After parsing all chunks and before extracting samples:
    // Determine if APPL chunk start/end are byte offsets or sample frames
    let isByteOffsets = false;
    if (sampleMetadata.length > 0 && numSampleFrames > 0) {
      // If the first start/end is much larger than numSampleFrames, treat as bytes
      const threshold = 10 * numSampleFrames; // heuristic: 10x sample frames
      if (sampleMetadata[0].startSample > threshold || sampleMetadata[0].endSample > threshold) {
        isByteOffsets = true;
      }
    }

    // Find SSND chunk's actual audio data start
    let ssndDataStart = 0;
    let ssndDataLength = 0;
    if (ssndOffset > 0) {
      // SSND chunk: offset (4 bytes) + blockSize (4 bytes) + audio data
      const ssndOffsetField = dataView.getUint32(ssndOffset, false);
      ssndDataStart = ssndOffset + 8 + ssndOffsetField;
      ssndDataLength = arrayBuffer.byteLength - ssndDataStart;
    }
    const bytesPerSample = channels * (bitDepth / 8);

    // If using byte offsets and the largest end offset is greater than the actual SSND data, scale all offsets
    if (isByteOffsets && sampleMetadata.length > 0 && ssndDataLength > 0) {
      const maxEnd = Math.max(...sampleMetadata.map(m => m.endSample));
      if (maxEnd > ssndDataLength) {
        // Scale all start/end values proportionally
        for (const m of sampleMetadata) {
          m.startSample = Math.round((m.startSample / maxEnd) * ssndDataLength);
          m.endSample = Math.round((m.endSample / maxEnd) * ssndDataLength);
        }
      }
    }

    // Extract individual samples
    const samples: OP1DrumSample[] = [];
    const audioContext = await audioContextManager.getAudioContext();
    for (const [sampleIdx, metadata] of sampleMetadata.entries()) {
      if (metadata.keyIndex >= 0 && metadata.keyIndex < 24) {
        let sampleStartByte = 0;
        let sampleByteLength = 0;
        let sampleEndByte = 0;
        if (isByteOffsets) {
          // start/end are byte offsets from ssndDataStart
          // Ensure proper 2-byte alignment for 16-bit samples
          const rawStartByte = ssndDataStart + metadata.startSample;
          const rawEndByte = ssndDataStart + metadata.endSample;
          
          sampleStartByte = rawStartByte + (rawStartByte % 2); // Round up to even
          sampleEndByte = rawEndByte + (rawEndByte % 2); // Round up to even
          sampleByteLength = sampleEndByte - sampleStartByte;
        } else {
          // start/end are sample frames
          sampleStartByte = ssndDataStart + (metadata.startSample * bytesPerSample);
          sampleEndByte = ssndDataStart + (metadata.endSample * bytesPerSample);
          sampleByteLength = (metadata.endSample - metadata.startSample) * bytesPerSample;
        }
        const sampleLength = isByteOffsets
          ? Math.floor(sampleByteLength / bytesPerSample)
          : metadata.endSample - metadata.startSample;
        // Only proceed if all values are valid
        if (sampleLength > 0 && sampleByteLength > 0 && sampleStartByte < sampleEndByte && sampleStartByte + sampleByteLength <= arrayBuffer.byteLength && channels >= 1) {
          // Additional check for valid AudioBuffer creation
          if (sampleLength <= 0 || channels <= 0 || sampleRate <= 0) {
            console.warn(`Skipping sample ${sampleIdx}: Invalid AudioBuffer params (sampleLength=${sampleLength}, channels=${channels}, sampleRate=${sampleRate})`);
            continue;
          }
          // Create AudioBuffer for this sample
          const audioBuffer = audioContext.createBuffer(
            channels,
            sampleLength,
            sampleRate
          );
          // Debug: Check if audioBuffer was created successfully
          if (!audioBuffer) {
            console.warn(`Skipping sample ${sampleIdx}: audioBuffer creation failed (sampleLength=${sampleLength}, channels=${channels}, sampleRate=${sampleRate})`);
            continue;
          }
          
          const audioData = new Uint8Array(arrayBuffer, sampleStartByte, sampleByteLength);
          // Convert to float samples and copy to AudioBuffer
          if (bitDepth === 16) {
            // Handle both big-endian (AIFF) and little-endian (AIFC sowt) byte order
            for (let channel = 0; channel < channels; channel++) {
              const channelData = audioBuffer.getChannelData(channel);
              for (let i = 0; i < sampleLength; i++) {
                const sampleOffset = (i * channels + channel) * 2;
                // Read 16-bit sample in the appropriate byte order
                const byte1 = audioData[sampleOffset];
                const byte2 = audioData[sampleOffset + 1];
                
                let sample: number;
                if (isLittleEndian) {
                  // Little-endian (sowt): low byte first, high byte second
                  sample = (byte2 << 8) | byte1;
                } else {
                  // Big-endian (standard AIFF): high byte first, low byte second
                  sample = (byte1 << 8) | byte2;
                }
                
                // Convert to signed 16-bit integer
                const signedSample = (sample & 0x8000) ? sample - 0x10000 : sample;
                channelData[i] = signedSample / 32768.0;
                
              }
            }
          } else if (bitDepth === 24) {
            // Handle 24-bit samples
            for (let channel = 0; channel < channels; channel++) {
              const channelData = audioBuffer.getChannelData(channel);
              for (let i = 0; i < sampleLength; i++) {
                const sampleOffset = (i * channels + channel) * 3;
                const sample = (audioData[sampleOffset] << 16) |
                              (audioData[sampleOffset + 1] << 8) |
                              audioData[sampleOffset + 2];
                // Convert 24-bit signed integer to float
                const floatSample = sample >= 0x800000 ? sample - 0x1000000 : sample;
                channelData[i] = floatSample / 8388608.0;
              }
            }
          }
          // Create metadata for this sample
          const sampleMetadataObj: AudioMetadata = {
            format: 'aiff',
            sampleRate,
            bitDepth,
            channels,
            duration: sampleLength / sampleRate,
            audioBuffer,
            fileSize: sampleByteLength,
            midiNote: 60 + metadata.keyIndex, // Map key index to MIDI note
            loopStart: 0,
            loopEnd: 0,
            hasLoopData: false
          };
          samples.push({
            keyIndex: metadata.keyIndex,
            startSample: metadata.startSample,
            endSample: metadata.endSample,
            duration: sampleLength / sampleRate,
            name: metadata.name,
            audioBuffer,
            metadata: sampleMetadataObj
          });
        } else {
          // Skip invalid or empty sample
          continue;
        }
      }
    }

    // Keep samples in the order they were found (no sorting)

    return {
      name: filename.replace(/\.(aif|aiff)$/i, ''),
      samples,
      totalDuration: numSampleFrames / sampleRate,
      sampleRate,
      channels,
      bitDepth
    };

  } catch (error) {
    console.error('Error parsing OP-1 drum preset:', error);
    throw new Error(`Failed to parse OP-1 drum preset: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Extract key index from marker ID or name
export function extractKeyIndexFromMarker(markerId: number, markerName: string): number | null {
  // Try to extract from marker name first - look for various patterns
  const nameMatch = markerName.match(/(\d+)/);
  if (nameMatch) {
    const keyIndex = parseInt(nameMatch[1], 10);
    if (keyIndex >= 0 && keyIndex < 24) {
      return keyIndex;
    }
  }
  
  // Try to extract from marker ID
  if (markerId >= 0 && markerId < 24) {
    return markerId;
  }
  
  // Handle OP-1 to OP-XY naming conversion
  let normalizedName = markerName.toLowerCase();
  if (normalizedName.includes('clave alt')) {
    normalizedName = normalizedName.replace('clave alt', 'wood stick');
  }
  
  // Try to extract from common drum sample names
  const drumNameMap: { [key: string]: number } = {
    'kick': 0, 'kick alt': 1, 'snare': 2, 'snare alt': 3, 'rim': 4, 'hand clap': 5,
    'tambourine': 6, 'shaker': 7, 'closed hi-hat': 8, 'clave': 9, 'open hi-hat': 10, 'cabasa': 11,
    'low tom': 12, 'ride cymbal': 13, 'mid-tom': 14, 'crash cymbal': 15, 'hi-tom': 16, 'cowbell': 17,
    'triangle': 18, 'low tom alt': 19, 'low conga': 20, 'wood stick': 21, 'hi-conga': 22, 'guiro': 23
  };
  
  for (const [drumName, index] of Object.entries(drumNameMap)) {
    if (normalizedName.includes(drumName)) {
      return index;
    }
  }
  
  return null;
}

// Detect if a file is an OP-1 drum preset
export function isOP1DrumPreset(arrayBuffer: ArrayBuffer): boolean {
  try {
    const textDecoder = new TextDecoder('ascii');
    
    // Check if it's an AIFF file
    const form = textDecoder.decode(new Uint8Array(arrayBuffer, 0, 4));
    if (form !== 'FORM') {
      return false;
    }
    
    const formatId = textDecoder.decode(new Uint8Array(arrayBuffer, 8, 4));
    if (formatId !== 'AIFF' && formatId !== 'AIFC') {
      return false;
    }
    
    // Check for OP-1 specific chunks or markers
    const dataView = new DataView(arrayBuffer);
    let offset = 12;
    let hasMarkers = false;
    let markerCount = 0;
    
    while (offset + 8 < arrayBuffer.byteLength) {
      const chunkId = textDecoder.decode(new Uint8Array(arrayBuffer, offset, 4));
      const chunkSize = dataView.getUint32(offset + 4, false);
      
      // Check for OP-1 drum preset metadata chunks
      if (chunkId === 'OP1D' || chunkId === 'OP1F') {
        return true;
      }
      
      // Check for APPL chunk with OP-1 metadata
      if (chunkId === 'APPL') {
        try {
          const applData = new Uint8Array(arrayBuffer, offset + 8, chunkSize);
          const applText = textDecoder.decode(applData);
          
          if (applText.startsWith('op-1')) {
            const jsonStart = applText.indexOf('{');
            if (jsonStart !== -1) {
              let jsonStr = applText.substring(jsonStart);
              
              // Clean the JSON string by removing null characters and other problematic characters
              jsonStr = jsonStr.replace(/\0/g, ''); // Remove null characters
              jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ''); // Remove other control characters
              jsonStr = jsonStr.trim(); // Remove leading/trailing whitespace
              
              // Try to find the end of the JSON object
              let braceCount = 0;
              let jsonEnd = -1;
              for (let i = 0; i < jsonStr.length; i++) {
                if (jsonStr[i] === '{') {
                  braceCount++;
                } else if (jsonStr[i] === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    jsonEnd = i + 1;
                    break;
                  }
                }
              }
              
              // If we found a complete JSON object, use it
              if (jsonEnd > 0) {
                jsonStr = jsonStr.substring(0, jsonEnd);
              }
              
              const op1Metadata = JSON.parse(jsonStr);
              
              if (op1Metadata.type === 'drum' && op1Metadata.drum_version) {
                // Check if there are any valid samples (not just duplicates)
                if (op1Metadata.start && op1Metadata.end && Array.isArray(op1Metadata.start) && Array.isArray(op1Metadata.end)) {
                  const uniqueSamples = new Set<string>();
                  for (let i = 0; i < Math.min(op1Metadata.start.length, op1Metadata.end.length); i++) {
                    const startSample = op1Metadata.start[i];
                    const endSample = op1Metadata.end[i];
                    if (startSample !== undefined && endSample !== undefined && endSample > startSample) {
                      uniqueSamples.add(`${startSample}-${endSample}`);
                    }
                  }
                  // Only return true if there are actual unique samples
                  return uniqueSamples.size > 0;
                }
                return true;
              }
            }
          }
        } catch (error) {
          // Ignore parsing errors
        }
      }
      
      // Check for marker chunks that might indicate drum preset structure
      if (chunkId === 'MARK') {
        hasMarkers = true;
        markerCount = dataView.getUint16(offset + 8, false);
        // OP-1 drum presets typically have 24 markers (one per key), but some might have fewer
        if (markerCount > 0 && markerCount <= 24) {
          return true;
        }
      }
      
      offset += 8 + chunkSize + (chunkSize % 2 === 1 ? 1 : 0);
    }
    
    // If it's an AIFF file with markers, it might be a drum preset even without OP-1 specific chunks
    // This is more permissive to handle various OP-1 preset formats
    if (hasMarkers && markerCount > 0) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
} 