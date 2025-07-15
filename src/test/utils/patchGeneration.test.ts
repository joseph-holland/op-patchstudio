import { describe, it, expect, vi } from 'vitest';
import { generateMultisamplePatch } from '../../utils/patchGeneration';
import type { AppState } from '../../context/AppContext';

// Mock JSZip
vi.mock('jszip', () => ({
  default: vi.fn().mockImplementation(() => ({
    file: vi.fn(),
    generateAsync: vi.fn().mockResolvedValue(new Blob())
  }))
}));

describe('patchGeneration', () => {
  describe('generateMultisamplePatch', () => {
    it('should generate regions in correct MIDI note order', async () => {
      // Create mock state with samples in random order
      const mockState: Partial<AppState> = {
        multisampleFiles: [
          {
            name: 'C3.wav',
            file: new File([''], 'C3.wav'),
            isLoaded: true,
            rootNote: 60, // C3
            audioBuffer: {
              sampleRate: 44100,
              duration: 1.0,
              numberOfChannels: 1,
              length: 44100,
              getChannelData: () => new Float32Array(44100)
            } as any,
            originalSampleRate: 44100,
            originalBitDepth: 16,
            originalChannels: 1,
            duration: 1.0,
            fileSize: 1000,
            loopStart: 0.1,
            loopEnd: 0.9,
            inPoint: 0,
            outPoint: 1.0
          },
          {
            name: 'F#3.wav',
            file: new File([''], 'F#3.wav'),
            isLoaded: true,
            rootNote: 66, // F#3
            audioBuffer: {
              sampleRate: 44100,
              duration: 1.0,
              numberOfChannels: 1,
              length: 44100,
              getChannelData: () => new Float32Array(44100)
            } as any,
            originalSampleRate: 44100,
            originalBitDepth: 16,
            originalChannels: 1,
            duration: 1.0,
            fileSize: 1000,
            loopStart: 0.1,
            loopEnd: 0.9,
            inPoint: 0,
            outPoint: 1.0
          },
          {
            name: 'C2.wav',
            file: new File([''], 'C2.wav'),
            isLoaded: true,
            rootNote: 48, // C2
            audioBuffer: {
              sampleRate: 44100,
              duration: 1.0,
              numberOfChannels: 1,
              length: 44100,
              getChannelData: () => new Float32Array(44100)
            } as any,
            originalSampleRate: 44100,
            originalBitDepth: 16,
            originalChannels: 1,
            duration: 1.0,
            fileSize: 1000,
            loopStart: 0.1,
            loopEnd: 0.9,
            inPoint: 0,
            outPoint: 1.0
          }
        ],
        multisampleSettings: {
          presetName: 'Test',
          filenameSeparator: ' ',
          renameFiles: true,
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          loopEnabled: false,
          loopOnRelease: true,
          normalize: false,
          normalizeLevel: -1,
          gain: 0,
          cutAtLoopEnd: false
        },
        midiNoteMapping: 'C3'
      };

      // Mock the audio conversion functions
      vi.mock('../../utils/audio', async () => {
        const actual = await vi.importActual('../../utils/audio');
        return {
          ...actual,
          convertAudioFormat: vi.fn().mockResolvedValue({
            sampleRate: 44100,
            duration: 1.0,
            numberOfChannels: 1,
            length: 44100,
            getChannelData: () => new Float32Array(44100)
          }),
          audioBufferToWav: vi.fn().mockReturnValue(new Blob())
        };
      });

      // Capture the regions that get added to the ZIP
      const capturedRegions: any[] = [];
      const mockZip = {
        file: vi.fn((name: string, content: any) => {
          if (name === 'patch.json') {
            const patchData = JSON.parse(content);
            capturedRegions.push(...patchData.regions);
          }
        }),
        generateAsync: vi.fn().mockResolvedValue(new Blob())
      };

      // Mock JSZip to return our mock
      const JSZip = (await import('jszip')).default;
      vi.mocked(JSZip).mockImplementation(() => mockZip as any);

      await generateMultisamplePatch(mockState as AppState);

      // Verify regions are in correct order (by pitch.keycenter)
      expect(capturedRegions).toHaveLength(3);
      expect(capturedRegions[0]['pitch.keycenter']).toBe(48); // C2
      expect(capturedRegions[1]['pitch.keycenter']).toBe(60); // C3
      expect(capturedRegions[2]['pitch.keycenter']).toBe(66); // F#3
    });
  });
}); 