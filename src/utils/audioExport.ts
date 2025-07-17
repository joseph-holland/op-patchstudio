// Audio export utilities - unified interface for WAV and AIFF export
// Provides common types and main export functions used by patch generation

import { audioBufferToWav } from './wavExport';
import { audioBufferToAiff } from './aiffExport';

export type AudioFormat = 'wav' | 'aiff';

export interface AudioExportOptions {
  format: AudioFormat;
  bitDepth?: number;
  isFloat?: boolean;
  rootNote?: number;
  loopStart?: number;
  loopEnd?: number;
}

export interface AudioExportMetadata {
  rootNote?: number;
  loopStart?: number; // in frames
  loopEnd?: number;   // in frames
}

/**
 * Export AudioBuffer to specified format with metadata
 * @param audioBuffer - The audio buffer to export
 * @param options - Export options including format, bit depth, and metadata
 * @returns Exported audio file as Blob
 */
export function exportAudioBuffer(
  audioBuffer: AudioBuffer,
  options: AudioExportOptions
): Blob {
  const {
    format,
    bitDepth = 16,
    isFloat = false,
    rootNote,
    loopStart,
    loopEnd
  } = options;

  const metadata = {
    rootNote,
    loopStart,
    loopEnd
  };

  switch (format) {
    case 'wav':
      return audioBufferToWav(audioBuffer, bitDepth, metadata);
    
    case 'aiff':
      return audioBufferToAiff(audioBuffer, {
        ...metadata,
        bitDepth,
        isFloat
      });
    
    default:
      throw new Error(`Unsupported audio format: ${format}`);
  }
}

/**
 * Get file extension for audio format
 */
export function getAudioFileExtension(format: AudioFormat): string {
  switch (format) {
    case 'wav':
      return 'wav';
    case 'aiff':
      return 'aif';
    default:
      throw new Error(`Unsupported audio format: ${format}`);
  }
}

/**
 * Get MIME type for audio format
 */
export function getAudioMimeType(format: AudioFormat): string {
  switch (format) {
    case 'wav':
      return 'audio/wav';
    case 'aiff':
      return 'audio/aiff';
    default:
      return 'audio/wav';
  }
}

/**
 * Check if format supports floating point audio
 */
export function supportsFloatingPoint(format: AudioFormat): boolean {
  switch (format) {
    case 'aiff':
      return true;
    case 'wav':
      return false; // WAV can support float but our implementation doesn't
    default:
      return false;
  }
}

/**
 * Get supported bit depths for format
 */
export function getSupportedBitDepths(format: AudioFormat, isFloat: boolean = false): number[] {
  switch (format) {
    case 'wav':
      return [8, 12, 16, 24];
    case 'aiff':
      if (isFloat) {
        return [32, 64];
      }
      return [8, 12, 16, 24, 32];
    default:
      return [16];
  }
}

/**
 * Validate export options
 */
export function validateExportOptions(options: AudioExportOptions): void {
  const { format, bitDepth = 16, isFloat = false } = options;
  
  const supportedBitDepths = getSupportedBitDepths(format, isFloat);
  if (!supportedBitDepths.includes(bitDepth)) {
    throw new Error(`Bit depth ${bitDepth} not supported for ${format} format${isFloat ? ' (float)' : ''}`);
  }
  
  if (isFloat && !supportsFloatingPoint(format)) {
    throw new Error(`Floating point not supported for ${format} format`);
  }
}

/**
 * Create default export options for format
 */
export function createDefaultExportOptions(format: AudioFormat): AudioExportOptions {
  return {
    format,
    bitDepth: format === 'aiff' ? 24 : 16,
    isFloat: false
  };
}

/**
 * Convert seconds to frames
 */
export function secondsToFrames(seconds: number, sampleRate: number): number {
  return Math.round(seconds * sampleRate);
}

/**
 * Convert frames to seconds
 */
export function framesToSeconds(frames: number, sampleRate: number): number {
  return frames / sampleRate;
}

/**
 * Legacy compatibility - re-export audioBufferToWav
 */
export { audioBufferToWav } from './wavExport';
export { audioBufferToAiff } from './aiffExport'; 