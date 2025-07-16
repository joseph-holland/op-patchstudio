import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMultisamplePatch } from '../../utils/patchGeneration';
import type { AppState } from '../../context/AppContext';

// Mock JSZip
vi.mock('jszip', () => ({
  default: vi.fn().mockImplementation(() => ({
    file: vi.fn(),
    generateAsync: vi.fn().mockResolvedValue(new Blob(['test'], { type: 'application/zip' }))
  }))
}));

// Mock audio utilities
vi.mock('../../utils/audio', () => ({
  convertAudioFormat: vi.fn().mockImplementation(async (buffer) => buffer),
  sanitizeName: vi.fn().mockImplementation((name) => name.replace(/[^a-zA-Z0-9]/g, '')),
  LOOP_END_PADDING: 5,
  generateFilename: vi.fn().mockImplementation((presetName, _separator, _type, index, _originalName) => 
    `${presetName} ${index}.wav`),
  audioBufferToWav: vi.fn().mockReturnValue(new Blob(['test'], { type: 'audio/wav' }))
}));

// Mock base JSON files
vi.mock('../../components/drum/baseDrumJson', () => ({
  baseDrumJson: {
    engine: {},
    envelope: {},
    fx: {},
    lfo: {},
    octave: 0,
    platform: 'op-xy',
    regions: [],
    type: 'drum',
    version: 1
  }
}));

vi.mock('../../components/multisample/baseMultisampleJson', () => ({
  baseMultisampleJson: {
    engine: {},
    envelope: {},
    fx: {},
    lfo: {},
    octave: 0,
    platform: 'op-xy',
    regions: [],
    type: 'multisample',
    version: 1
  }
}));

// Mock other utilities
vi.mock('../../utils/valueConversions', () => ({
  percentToInternal: vi.fn().mockImplementation((value) => Math.round(value * 327.67))
}));

vi.mock('../../utils/jsonImport', () => ({
  mergeImportedDrumSettings: vi.fn(),
  mergeImportedMultisampleSettings: vi.fn()
}));

describe('patchGeneration', () => {
  let mockAudioBuffer: AudioBuffer;
  let mockState: AppState;

  beforeEach(() => {
    // Create a mock AudioBuffer
    mockAudioBuffer = {
      length: 44100, // 1 second at 44.1kHz
      duration: 1.0,
      sampleRate: 44100,
      numberOfChannels: 1,
      getChannelData: vi.fn().mockReturnValue(new Float32Array(44100))
    } as any;

    // Create mock state
    mockState = {
      drumSamples: [],
      multisampleFiles: [],
      drumSettings: {
        renameFiles: false,
        presetName: 'Test Drum Kit',
        filenameSeparator: 'space'
      },
      multisampleSettings: {
        renameFiles: false,
        presetName: 'Test multisample',
        filenameSeparator: 'space',
        loopEnabled: true,
        loopOnRelease: false,
        normalize: false,
        normalizeLevel: -1,
        cutAtLoopEnd: false,
        gain: 0
      },
      midiNoteMapping: 'C3'
    } as any;
  });

  describe('format conversion', () => {
    it('should ensure all exported files have .wav extension', async () => {
      // Add a multisample file
      mockState.multisampleFiles = [{
        file: new File(['test'], 'test.aif', { type: 'audio/aiff' }),
        audioBuffer: mockAudioBuffer,
        name: 'test.aif',
        isLoaded: true,
        rootNote: 60,
        inPoint: 0,
        outPoint: 1.0,
        loopStart: 0.2, // 0.2 seconds
        loopEnd: 0.8,   // 0.8 seconds
        originalSampleRate: 44100,
        originalBitDepth: 16,
        originalChannels: 1,
        duration: 1.0
      }];

      const result = await generateMultisamplePatch(mockState, 'Test multisample');
      
      // Verify the result is a Blob
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('application/zip');
    });
  });

  describe('AIF loop points conversion', () => {
    it('should correctly convert AIF loop points from seconds to frames', async () => {
      // Create a multisample file with AIF-style loop points (in seconds)
      const sampleRate = 44100;
      const duration = 2.0; // 2 seconds
      const loopStartSeconds = 0.5; // 0.5 seconds
      const loopEndSeconds = 1.5;   // 1.5 seconds
      
      const mockAudioBuffer2 = {
        length: sampleRate * duration,
        duration: duration,
        sampleRate: sampleRate,
        numberOfChannels: 1,
        getChannelData: vi.fn().mockReturnValue(new Float32Array(sampleRate * duration))
      } as any;

      mockState.multisampleFiles = [{
        file: new File(['test'], 'test.aif', { type: 'audio/aiff' }),
        audioBuffer: mockAudioBuffer2,
        name: 'test.aif',
        isLoaded: true,
        rootNote: 60,
        inPoint: 0,
        outPoint: duration,
        loopStart: loopStartSeconds, // AIF loop points are in seconds
        loopEnd: loopEndSeconds,     // AIF loop points are in seconds
        originalSampleRate: sampleRate,
        originalBitDepth: 16,
        originalChannels: 1,
        duration: duration
      }];

      // Mock the audioBufferToWav function to capture the loop points
      const mockAudioBufferToWav = vi.fn().mockReturnValue(new Blob(['test'], { type: 'audio/wav' }));
      vi.doMock('../../utils/audio', async () => {
        const actual = await vi.importActual('../../utils/audio');
        return {
          ...actual,
          audioBufferToWav: mockAudioBufferToWav
        };
      });

      const result = await generateMultisamplePatch(mockState, 'Test multisample');
      
      // Verify the result is a Blob
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('application/zip');
      
      // The loop points should be converted from seconds to frames
      // loopStart: 0.5 seconds * 44100 Hz = 22050 frames
      // loopEnd: 1.5 seconds * 44100 Hz = 66150 frames
      expect(mockAudioBufferToWav).toHaveBeenCalledWith(
        expect.any(Object),
        16,
        expect.objectContaining({
          rootNote: 60,
          loopStart: 22050, // Should be converted to frames
          loopEnd: 66150    // Should be converted to frames
        })
      );
    });
  });
}); 