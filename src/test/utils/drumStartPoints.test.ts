import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateDrumPatch } from '../../utils/patchGeneration';
import type { AppState } from '../../context/AppContext';

// Mock JSZip
vi.mock('jszip', () => {
  const mockJSZipInstance = {
    file: vi.fn(),
    generateAsync: vi.fn().mockResolvedValue(new Blob(['mock zip'], { type: 'application/zip' }))
  };

  const mockJSZip = vi.fn().mockImplementation(() => mockJSZipInstance) as any;
  mockJSZip.loadAsync = vi.fn().mockResolvedValue(mockJSZipInstance);

  return {
    default: mockJSZip
  };
});

// Mock audio utilities
vi.mock('../../utils/audio', () => ({
  sanitizeName: vi.fn().mockImplementation((name) => name.replace(/[^a-zA-Z0-9.]/g, '')),
  generateFilename: vi.fn().mockImplementation((_presetName: string, _separator: string, _type: string, _index: number, originalName: string) => originalName),
  LOOP_END_PADDING: 100
}));

// Mock audio export
vi.mock('../../utils/audioExport', () => ({
  exportAudioBuffer: vi.fn().mockResolvedValue(new Blob(['mock audio'], { type: 'audio/wav' })),
  getAudioFileExtension: vi.fn(() => 'wav')
}));

// Mock convertAudioFormat
vi.mock('../../utils/audioFormats', () => ({
  convertAudioFormat: vi.fn().mockImplementation(async (buffer: any) => buffer)
}));

// Mock value conversions
vi.mock('../../utils/valueConversions', () => ({
  percentToInternal: vi.fn((percent: number) => Math.round(percent * 327.67))
}));

// Mock JSON imports
vi.mock('../../utils/jsonImport', () => ({
  mergeImportedDrumSettings: vi.fn(),
  mergeImportedMultisampleSettings: vi.fn()
}));

describe('Drum patch generation with start/end points', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should write inPoint and outPoint to patch.json as sample.start and sample.end', async () => {
    // Create a mock state with a sample that has custom start/end points
    const mockState: AppState = {
      currentTab: 'drum',
      drumSettings: {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        presetName: 'Test Kit',
        normalize: false,
        normalizeLevel: -6.0,
        autoZeroCrossing: true,
        presetSettings: {
          playmode: 'poly',
          transpose: 0,
          velocity: 100,
          volume: 100,
          width: 100
        },
        renameFiles: false,
        filenameSeparator: ' ',
        audioFormat: 'wav' as const
      },
      multisampleSettings: {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        presetName: 'Test Multisample',
        normalize: false,
        normalizeLevel: -6.0,
        autoZeroCrossing: true,
        renameFiles: false,
        filenameSeparator: ' ',
        audioFormat: 'wav' as const,
        cutAtLoopEnd: false,
        gain: 0,
        loopEnabled: true,
        loopOnRelease: false,
        playmode: 'poly',
        transpose: 0,
        velocitySensitivity: 100,
        volume: 100,
        width: 100,
        highpass: 0,
        portamentoType: 'linear',
        portamentoAmount: 0,
        tuningRoot: 60,
        ampEnvelope: { attack: 0, decay: 0, sustain: 32767, release: 1000 },
        filterEnvelope: { attack: 0, decay: 3276, sustain: 983, release: 23757 }
      },
      drumSamples: [
        {
          file: new File(['sample1'], 'sample1.wav', { type: 'audio/wav' }),
          audioBuffer: new AudioContext().createBuffer(1, 44100, 44100),
          name: 'sample1.wav',
          isLoaded: true,
          inPoint: 0.25, // Start at 0.25 seconds (25% through the sample)
          outPoint: 0.75, // End at 0.75 seconds (75% through the sample)
          playmode: 'oneshot',
          reverse: false,
          transpose: 0,
          pan: 0,
          gain: 0,
          hasBeenEdited: true,
          isAssigned: true,
          assignedKey: 0,
          originalBitDepth: 16,
          originalSampleRate: 44100,
          originalChannels: 2,
          fileSize: 1024,
          duration: 1.0 // 1 second duration
        }
      ],
      multisampleFiles: [],
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
      midiNoteMapping: 'C3'
    };

    // Mock JSZip to capture what files are added
    const mockZip = {
      file: vi.fn(),
      generateAsync: vi.fn().mockResolvedValue(new Blob(['mock zip'], { type: 'application/zip' }))
    };

    const JSZip = (await import('jszip')).default;
    vi.mocked(JSZip).mockImplementation(() => mockZip as any);

    // Generate the patch
    await generateDrumPatch(mockState, 'Test Kit');

    // Verify that patch.json was added to the ZIP
    expect(mockZip.file).toHaveBeenCalledWith('patch.json', expect.any(String));

    // Get the patch.json content
    const patchJsonCall = vi.mocked(mockZip.file).mock.calls.find(call => call[0] === 'patch.json');
    expect(patchJsonCall).toBeDefined();

    const patchJsonContent = JSON.parse(patchJsonCall![1] as string);

    // Verify that the region exists
    expect(patchJsonContent.regions).toHaveLength(1);
    const region = patchJsonContent.regions[0];

    // Calculate expected values
    // With 44100 sample rate and 1 second duration, framecount = 44100 frames
    // inPoint: 0.25s => 0.25 / 1.0 = 25% => floor(44100 * 0.25) = 11025 frames
    // outPoint: 0.75s => 0.75 / 1.0 = 75% => floor(44100 * 0.75) = 33075 frames
    const expectedSampleStart = Math.floor(44100 * (0.25 / 1.0));
    const expectedSampleEnd = Math.floor(44100 * (0.75 / 1.0));

    // Verify that sample.start and sample.end are set correctly based on inPoint and outPoint
    expect(region['sample.start']).toBe(expectedSampleStart); // Should be 11025
    expect(region['sample.end']).toBe(expectedSampleEnd); // Should be 33075

    // Also verify that they're not 0 and framecount (which would indicate the bug)
    expect(region['sample.start']).not.toBe(0);
    expect(region['sample.end']).not.toBe(44100);
  });

  it('should handle default inPoint=0 and outPoint=duration correctly', async () => {
    // Create a mock state with a sample using default start/end points
    const mockState: AppState = {
      currentTab: 'drum',
      drumSettings: {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        presetName: 'Test Kit',
        normalize: false,
        normalizeLevel: -6.0,
        autoZeroCrossing: true,
        presetSettings: {
          playmode: 'poly',
          transpose: 0,
          velocity: 100,
          volume: 100,
          width: 100
        },
        renameFiles: false,
        filenameSeparator: ' ',
        audioFormat: 'wav' as const
      },
      multisampleSettings: {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        presetName: 'Test Multisample',
        normalize: false,
        normalizeLevel: -6.0,
        autoZeroCrossing: true,
        renameFiles: false,
        filenameSeparator: ' ',
        audioFormat: 'wav' as const,
        cutAtLoopEnd: false,
        gain: 0,
        loopEnabled: true,
        loopOnRelease: false,
        playmode: 'poly',
        transpose: 0,
        velocitySensitivity: 100,
        volume: 100,
        width: 100,
        highpass: 0,
        portamentoType: 'linear',
        portamentoAmount: 0,
        tuningRoot: 60,
        ampEnvelope: { attack: 0, decay: 0, sustain: 32767, release: 1000 },
        filterEnvelope: { attack: 0, decay: 3276, sustain: 983, release: 23757 }
      },
      drumSamples: [
        {
          file: new File(['sample2'], 'sample2.wav', { type: 'audio/wav' }),
          audioBuffer: new AudioContext().createBuffer(1, 44100, 44100),
          name: 'sample2.wav',
          isLoaded: true,
          inPoint: 0, // Default start
          outPoint: 1.0, // Default end (full duration)
          playmode: 'oneshot',
          reverse: false,
          transpose: 0,
          pan: 0,
          gain: 0,
          hasBeenEdited: false,
          isAssigned: true,
          assignedKey: 0,
          originalBitDepth: 16,
          originalSampleRate: 44100,
          originalChannels: 2,
          fileSize: 1024,
          duration: 1.0
        }
      ],
      multisampleFiles: [],
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
      midiNoteMapping: 'C3'
    };

    // Mock JSZip to capture what files are added
    const mockZip = {
      file: vi.fn(),
      generateAsync: vi.fn().mockResolvedValue(new Blob(['mock zip'], { type: 'application/zip' }))
    };

    const JSZip = (await import('jszip')).default;
    vi.mocked(JSZip).mockImplementation(() => mockZip as any);

    // Generate the patch
    await generateDrumPatch(mockState, 'Test Kit');

    // Get the patch.json content
    const patchJsonCall = vi.mocked(mockZip.file).mock.calls.find(call => call[0] === 'patch.json');
    expect(patchJsonCall).toBeDefined();

    const patchJsonContent = JSON.parse(patchJsonCall![1] as string);

    // Verify that the region exists
    expect(patchJsonContent.regions).toHaveLength(1);
    const region = patchJsonContent.regions[0];

    // With default values (inPoint=0, outPoint=1.0), we should get:
    // sample.start = 0
    // sample.end = framecount (44100)
    expect(region['sample.start']).toBe(0);
    expect(region['sample.end']).toBe(44100);
  });
});
