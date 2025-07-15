import { describe, it, expect, vi } from 'vitest';
import { generateMultisamplePatch } from '../../utils/patchGeneration';
import type { AppState } from '../../context/AppContext';

// Mock the audio conversion functions at the top level
vi.mock('../../utils/audio', async () => {
  const actual = await vi.importActual('../../utils/audio');
  // Define mockAudioBuffer inside the factory to avoid hoisting issues
  const mockAudioBuffer = {
    length: 44100,
    duration: 1,
    sampleRate: 44100,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(44100)
  };
  return {
    ...actual,
    convertAudioFormat: vi.fn().mockResolvedValue(mockAudioBuffer),
    audioBufferToWav: vi.fn().mockReturnValue(new Blob(['mock wav data'], { type: 'audio/wav' }))
  };
});

// Mock function to create audio buffer (for legacy test code)
function createMockAudioBuffer(length: number, sampleRate: number) {
  return {
    sampleRate,
    duration: length / sampleRate,
    numberOfChannels: 1,
    length,
    getChannelData: () => new Float32Array(length)
  } as any;
}

describe('patchGeneration', () => {
  describe('generateMultisamplePatch', () => {
    it('should generate a valid ZIP file with WAV exports', async () => {
      // Create mock state with a single sample
      const mockState: Partial<AppState> = {
        multisampleFiles: [
          {
            name: 'C3.wav',
            file: new File([''], 'C3.wav'),
            isLoaded: true,
            rootNote: 60, // C3
            audioBuffer: createMockAudioBuffer(44100, 44100),
            loopStart: 0.1,
            loopEnd: 0.8,
            duration: 1,
            originalSampleRate: 44100,
            inPoint: 0,
            outPoint: 1
          }
        ],
        multisampleSettings: {
          presetName: 'Test',
          filenameSeparator: ' ',
          renameFiles: false, // Don't rename to keep original filename logic
          cutAtLoopEnd: true,
          loopEnabled: true,
          loopOnRelease: true,
          normalize: false,
          normalizeLevel: -6.0,
          sampleRate: 44100,
          bitDepth: 16,
          channels: 1,
          gain: 0
        },
        midiNoteMapping: 'C3'
      };

      const result = await generateMultisamplePatch(mockState as unknown as AppState);

      // Verify that the result is a blob (ZIP file)
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('application/zip');
    });
  });

  describe('format conversion', () => {
    it('should ensure all exported files have .wav extension', async () => {
      // Test with different input file types
      const mockFiles = [
        { name: 'sample.mp3', type: 'audio/mpeg', rootNote: 60 },
        { name: 'sample.aif', type: 'audio/aiff', rootNote: 62 }
      ];

      const mockState = {
        multisampleFiles: mockFiles.map((file) => ({
          name: file.name,
          file: file as any,
          isLoaded: true,
          audioBuffer: {
            length: 44100,
            duration: 1,
            sampleRate: 44100,
            numberOfChannels: 1,
            getChannelData: () => new Float32Array(44100)
          },
          originalSampleRate: 44100,
          originalBitDepth: 16,
          rootNote: file.rootNote,
          loopStart: 0,
          loopEnd: 1,
          duration: 1,
          inPoint: 0,
          outPoint: 1
        })),
        multisampleSettings: {
          presetName: 'Test',
          filenameSeparator: ' ',
          renameFiles: true, // Ensure unique output filenames for each input file
          cutAtLoopEnd: true,
          loopEnabled: true,
          loopOnRelease: true,
          normalize: false,
          normalizeLevel: -6.0,
          sampleRate: 44100,
          bitDepth: 16,
          channels: 1,
          gain: 0
        },
        midiNoteMapping: 'C3'
      };

      // Generate multisample patch
      const result = await generateMultisamplePatch(mockState as unknown as AppState);

      // Read the zip and check filenames
      const JSZip = (await import('jszip')).default;
      const zipContent = await JSZip.loadAsync(result);
      const fileNames = Object.keys(zipContent.files);
      
      // Only check sample files, not patch.json
      const sampleFiles = fileNames.filter(name => name !== 'patch.json');
      
      // Log the sample files for debugging
      console.log('Sample files in ZIP:', sampleFiles);
      // Should have converted files
      expect(sampleFiles.length).toBe(mockFiles.length);
      
      // All files should have .wav extension
      for (const name of sampleFiles) {
        expect(name.endsWith('.wav')).toBe(true);
      }
      
      // Verify that the result is a blob (ZIP file)
      expect(result).toBeInstanceOf(Blob);
    });
  });
}); 