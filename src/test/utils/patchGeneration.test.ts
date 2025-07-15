import { describe, it, expect, vi } from 'vitest';
import { generateMultisamplePatch } from '../../utils/patchGeneration';
import { createCompleteMultisampleSettings } from './testHelpers';
import type { AppState } from '../../context/AppContext';

// Mock dependencies
vi.mock('jszip', () => ({
  default: vi.fn().mockImplementation(() => ({
    file: vi.fn().mockReturnThis(),
    generateAsync: vi.fn().mockResolvedValue(new Blob(['mock zip'], { type: 'application/zip' }))
  }))
}));

// Mock the audio utilities
vi.mock('../../utils/audio', () => ({
  convertAudioFormat: vi.fn().mockImplementation(async (audioBuffer: AudioBuffer) => {
    // Return a mock AudioBuffer that matches the input
    return {
      length: audioBuffer.length,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      getChannelData: () => new Float32Array(audioBuffer.length),
      copyFromChannel: () => {},
      copyToChannel: () => {}
    } as unknown as AudioBuffer;
  }),
  sanitizeName: vi.fn((name: string) => name),
  generateFilename: vi.fn((presetName: string, separator: string, type: string, index: number) => 
    `${presetName}${separator}${type}${separator}${index}.wav`),
  audioBufferToWav: vi.fn(() => new Blob(['mock wav'], { type: 'audio/wav' })),
  LOOP_END_PADDING: 0
}));

vi.mock('../../utils/jsonImport', () => ({
  mergeImportedDrumSettings: vi.fn(),
  mergeImportedMultisampleSettings: vi.fn()
}));

// At the top of the file, ensure JSZip is not mocked
vi.unmock('jszip');

describe('patchGeneration', () => {
  // Create a proper mock AudioBuffer
  const createMockAudioBuffer = (length: number = 44100, channels: number = 1, sampleRate: number = 44100) => ({
    length,
    duration: length / sampleRate,
    sampleRate,
    numberOfChannels: channels,
    getChannelData: () => new Float32Array(length),
    copyFromChannel: () => {},
    copyToChannel: () => {}
  } as unknown as AudioBuffer);

  const mockDrumSamples = Array.from({ length: 24 }, (_, i) => ({
    file: new File(['mock'], `drum${i}.wav`, { type: 'audio/wav' }),
    audioBuffer: createMockAudioBuffer(44100, 2, 44100),
    name: `drum${i}.wav`,
    isLoaded: true,
    inPoint: 0,
    outPoint: 1.0,
    playmode: 'oneshot' as const,
    reverse: false,
    tune: 0,
    pan: 0,
    gain: 0,
    hasBeenEdited: false,
    originalBitDepth: 16,
    originalSampleRate: 44100,
    originalChannels: 2,
    fileSize: 1024,
    duration: 1.0
  }));

  // Update the mock multisample files to use proper AudioBuffer
  const mockMultisampleFiles = [
    {
      id: '1',
      name: 'note0.wav',
      file: new File(['mock'], 'note0.wav', { type: 'audio/wav' }),
      isLoaded: true,
      audioBuffer: createMockAudioBuffer(44100, 1, 44100),
      rootNote: 60,
      inPoint: 0,
      outPoint: 1.0,
      loopStart: 0,
      loopEnd: 1.0,
      originalSampleRate: 44100,
      originalBitDepth: 16,
      originalChannels: 1,
      duration: 1.0,
      fileSize: 1024
    },
    {
      id: '2',
      name: 'note1.wav',
      file: new File(['mock'], 'note1.wav', { type: 'audio/wav' }),
      isLoaded: true,
      audioBuffer: createMockAudioBuffer(44100, 1, 44100),
      rootNote: 61,
      inPoint: 0,
      outPoint: 1.0,
      loopStart: 0,
      loopEnd: 1.0,
      originalSampleRate: 44100,
      originalBitDepth: 16,
      originalChannels: 1,
      duration: 1.0,
      fileSize: 1024
    }
  ];

  const mockState = {
    currentTab: 'drum' as const,
    drumSamples: mockDrumSamples,
    multisampleFiles: mockMultisampleFiles,
    selectedMultisample: null,
    isLoading: false,
    error: null,
    isDrumKeyboardPinned: false,
    isMultisampleKeyboardPinned: false,
    notifications: [],
    importedDrumPreset: null,
    importedMultisamplePreset: null,
    isSessionRestorationModalOpen: false,
    sessionInfo: null,
    midiNoteMapping: 'C3' as const,
    drumSettings: {
      sampleRate: 44100,
      bitDepth: 16,
      channels: 2,
      presetName: 'Test Kit',
      normalize: false,
      normalizeLevel: -6.0,
      presetSettings: {
        playmode: 'poly' as const,
        transpose: 0,
        velocity: 100,
        volume: 100,
        width: 100
      },
      renameFiles: false,
      filenameSeparator: ' ' as const
    },
    multisampleSettings: createCompleteMultisampleSettings({
      presetName: 'Test Multisample',
      normalizeLevel: -6.0,
      cutAtLoopEnd: true
    })
  };

  describe('generateMultisamplePatch', () => {
    it('should generate a valid ZIP file with WAV exports', async () => {
      // Create mock state with a single sample
      const result = await generateMultisamplePatch(mockState as unknown as AppState);

      // Verify that the result is a blob (ZIP file)
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('application/zip');
    });
  });

  describe('format conversion', () => {
    it('should ensure all exported files have .wav extension', async () => {
      const mockFilesWithDifferentExtensions = [
        {
          id: '1',
          name: 'sample.mp3',
          file: new File(['mock'], 'sample.mp3', { type: 'audio/mp3' }),
          isLoaded: true,
          audioBuffer: createMockAudioBuffer(44100, 1, 44100),
          rootNote: 60,
          inPoint: 0,
          outPoint: 1.0,
          loopStart: 0,
          loopEnd: 1.0,
          originalSampleRate: 44100,
          originalBitDepth: 16,
          originalChannels: 1,
          duration: 1.0,
          fileSize: 1024
        }
      ];

      const mockState = {
        multisampleFiles: mockFilesWithDifferentExtensions.map((file) => ({
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
        multisampleSettings: createCompleteMultisampleSettings({
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
        }),
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
      expect(sampleFiles.length).toBe(mockFilesWithDifferentExtensions.length);
      
      // All files should have .wav extension
      for (const name of sampleFiles) {
        expect(name.endsWith('.wav')).toBe(true);
      }
      
      // Verify that the result is a blob (ZIP file)
      expect(result).toBeInstanceOf(Blob);
    });
  });
}); 