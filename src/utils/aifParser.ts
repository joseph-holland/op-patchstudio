// Common AIF parsing utilities
// Shared functions for parsing AIF/AIFF files used by both main audio parser and OP-1 drum parser

/**
 * Parse IEEE 80-bit extended float (AIFF sample rate)
 * This is the working implementation from the OP-1 drum parser
 */
export function readExtendedFloat80(buffer: Uint8Array, offset: number = 0): number {
  if (buffer.length < offset + 10) {
    throw new Error("Buffer too small to contain 80-bit float");
  }
  
  // Read exponent (2 bytes, big-endian)
  const expon = (buffer[offset] << 8) | buffer[offset + 1];
  
  // Read high and low mantissa (each 4 bytes, big-endian, unsigned)
  // Use multiplication instead of left shifts to avoid signed integer overflow
  const hiMant = (
    (buffer[offset + 2] * 0x1000000) + // equivalent to << 24 but safe
    (buffer[offset + 3] << 16) +
    (buffer[offset + 4] << 8) +
    buffer[offset + 5]
  ) >>> 0; // ensure unsigned
  
  const loMant = (
    (buffer[offset + 6] * 0x1000000) +
    (buffer[offset + 7] << 16) +
    (buffer[offset + 8] << 8) +
    buffer[offset + 9]
  ) >>> 0;

  if (expon === 0 && hiMant === 0 && loMant === 0) {
    return 0.0;
  }

  // Sign bit is in the highest bit of exponent
  const sign = (expon & 0x8000) ? -1 : 1;
  const exponent = (expon & 0x7FFF) - 16383;

  // Combine mantissa (63 bits used)
  const mantissa = hiMant * Math.pow(2, 32) + loMant;
  const fraction = mantissa / Math.pow(2, 63);

  return sign * fraction * Math.pow(2, exponent);
}

/**
 * Validate and correct sample rate for AIF files
 * Handles common parsing errors and unusual sample rates
 */
export function validateSampleRate(sampleRate: number): number {
  // Standard sample rates for audio files
  const standardRates = [8000, 11025, 16000, 22050, 44100, 48000, 88200, 96000, 176400, 192000];
  
  // Check if the parsed rate is close to any standard rate
  for (const rate of standardRates) {
    const tolerance = rate * 0.05; // 5% tolerance
    if (Math.abs(sampleRate - rate) <= tolerance) {
      return rate;
    }
  }
  
  // Special handling for AIF files with unusual sample rates
  // The value 80768 appears to be a parsing error - let's check if it's in a reasonable range
  if (sampleRate > 70000 && sampleRate < 80000) {
    // This range suggests it might be a 48kHz file with parsing issues
    console.warn(`[AIF PARSER] Unusual sample rate ${sampleRate}Hz detected, using 48000Hz`);
    return 48000;
  }
  
  if (sampleRate > 40000 && sampleRate < 50000) {
    // This range suggests it might be a 44.1kHz file with parsing issues
    console.warn(`[AIF PARSER] Unusual sample rate ${sampleRate}Hz detected, using 44100Hz`);
    return 44100;
  }
  
  // If all else fails, use the parsed rate but ensure it's positive
  const result = Math.abs(sampleRate);
  if (result < 8000 || result > 192000) {
    console.warn(`[AIF PARSER] Invalid sample rate detected: ${sampleRate}Hz. Using fallback 44100Hz.`);
    return 44100;
  }
  
  return result;
}

/**
 * Parse COMM chunk from AIF file
 * Extracts channels, numSampleFrames, bitDepth, and sampleRate
 */
export function parseCommChunk(
  dataView: DataView, 
  arrayBuffer: ArrayBuffer, 
  chunkDataOffset: number, 
  chunkSize: number,
  formatId: string
): {
  channels: number;
  numSampleFrames: number;
  bitDepth: number;
  sampleRate: number;
  isLittleEndian: boolean;
} {
  if (chunkSize < 18) {
    throw new Error('COMM chunk too small');
  }

  // 8–9: channels
  // 10–13: numSampleFrames
  // 14–15: bitDepth
  // 16–25: sampleRate (80-bit float)
  // For AIFC: 26-29: compression type (4 bytes)
  const channels = dataView.getUint16(chunkDataOffset, false);
  const numSampleFrames = dataView.getUint32(chunkDataOffset + 2, false);
  const bitDepth = dataView.getUint16(chunkDataOffset + 6, false);
  
  // Parse IEEE 80-bit float sample rate
  const sampleRate = readExtendedFloat80(new Uint8Array(arrayBuffer), chunkDataOffset + 8);
  const validatedSampleRate = validateSampleRate(sampleRate);
  
  let isLittleEndian = false;
  
  // Check for AIFC compression type
  if (formatId === 'AIFC' && chunkSize >= 22) {
    // AIFC has compression type after sample rate
    const textDecoder = new TextDecoder('ascii');
    const compressionType = textDecoder.decode(new Uint8Array(arrayBuffer, chunkDataOffset + 18, 4));
    
    if (compressionType === 'sowt') {
      // 'sowt' means signed 16-bit little-endian (reverse of 'twos')
      isLittleEndian = true;
    }
  }

  return {
    channels,
    numSampleFrames,
    bitDepth,
    sampleRate: validatedSampleRate,
    isLittleEndian
  };
}

/**
 * Parse MARK chunk from AIF file
 * Extracts marker positions and names
 */
export function parseMarkChunk(
  dataView: DataView,
  arrayBuffer: ArrayBuffer,
  chunkDataOffset: number
): Array<{
  id: number;
  position: number;
  name: string;
}> {
  const textDecoder = new TextDecoder('ascii');
  const numMarkers = dataView.getUint16(chunkDataOffset, false);
  const markers: Array<{ id: number; position: number; name: string }> = [];
  
  let markerOffset = chunkDataOffset + 2;
  
  for (let i = 0; i < numMarkers; i++) {
    const markerId = dataView.getUint16(markerOffset, false);
    const markerPosition = dataView.getUint32(markerOffset + 2, false);
    const markerNameLength = dataView.getUint8(markerOffset + 6);
    
    // Parse marker name (Pascal string)
    const markerNameBytes = new Uint8Array(arrayBuffer, markerOffset + 7, markerNameLength);
    const markerName = textDecoder.decode(markerNameBytes);
    
    markers.push({
      id: markerId,
      position: markerPosition,
      name: markerName
    });
    
    markerOffset += 7 + markerNameLength + (markerNameLength % 2 === 0 ? 1 : 0);
  }
  
  return markers;
}

/**
 * Parse INST chunk from AIF file
 * Extracts root note and loop marker references
 */
export function parseInstChunk(
  dataView: DataView,
  chunkDataOffset: number,
  markers: Array<{ id: number; position: number; name: string }>
): {
  rootNote?: number;
  loopStart?: number;
  loopEnd?: number;
  foundLoopPoints: boolean;
} {
  const baseNote = dataView.getUint8(chunkDataOffset);
  const detune = dataView.getInt8(chunkDataOffset + 1);
  
  // INST chunk loop structure:
  // +8: sustainLoop playMode (2 bytes)
  // +10: sustainLoop beginLoop marker ID (2 bytes)  
  // +12: sustainLoop endLoop marker ID (2 bytes)
  // +14: releaseLoop playMode (2 bytes)
  // +16: releaseLoop beginLoop marker ID (2 bytes)
  // +18: releaseLoop endLoop marker ID (2 bytes)
  const sustainLoopBegin = dataView.getUint16(chunkDataOffset + 10, false);
  const sustainLoopEnd = dataView.getUint16(chunkDataOffset + 12, false);
  
  let rootNote: number | undefined;
  let loopStart: number | undefined;
  let loopEnd: number | undefined;
  let foundLoopPoints = false;
  
  // Get loop points from markers with validation
  if (sustainLoopBegin > 0) {
    const marker = markers.find(m => m.id === sustainLoopBegin);
    if (marker) {
      loopStart = marker.position;
      foundLoopPoints = true;
    }
  }
  
  if (sustainLoopEnd > 0) {
    const marker = markers.find(m => m.id === sustainLoopEnd);
    if (marker) {
      loopEnd = marker.position;
      foundLoopPoints = true;
    }
  }
  
  // Calculate root note from base note and detune
  if (baseNote > 0) {
    rootNote = baseNote + Math.round(detune / 100);
  }
  
  return {
    rootNote,
    loopStart,
    loopEnd,
    foundLoopPoints
  };
}

/**
 * Find loop points from marker names (fallback when no INST chunk is present)
 */
export function findLoopPointsFromMarkers(
  markers: Array<{ id: number; position: number; name: string }>
): {
  loopStart?: number;
  loopEnd?: number;
  foundLoopPoints: boolean;
} {
  let loopStart: number | undefined;
  let loopEnd: number | undefined;
  let foundLoopPoints = false;
  
  for (const marker of markers) {
    const lowerName = marker.name.toLowerCase();
    if (lowerName.includes('loop start') || lowerName.includes('start')) {
      loopStart = marker.position;
      foundLoopPoints = true;
    } else if (lowerName.includes('loop end') || lowerName.includes('end')) {
      loopEnd = marker.position;
      foundLoopPoints = true;
    }
  }
  
  return {
    loopStart,
    loopEnd,
    foundLoopPoints
  };
} 