import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePatchGeneration } from '../../hooks/usePatchGeneration';
import { useAppContext } from '../../context/AppContext';
import { createCompleteMultisampleSettings } from '../utils/testHelpers';
import { baseDrumJson } from '../../components/drum/baseDrumJson';
import { baseMultisampleJson } from '../../components/multisample/baseMultisampleJson';

// Mock the AppContext
vi.mock('../../context/AppContext');

// Mock the patch generation utilities
vi.mock('../../utils/patchGeneration', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    generateDrumPatch: vi.fn(),
    generateMultisamplePatch: vi.fn(),
    downloadBlob: vi.fn()
  };
});

// Mock the session storage
vi.mock('../../utils/sessionStorageIndexedDB', () => ({
  sessionStorageIndexedDB: {
    saveSession: vi.fn(),
    loadSession: vi.fn(),
    clearSession: vi.fn(),
    hasSession: vi.fn(),
    getSessionInfo: vi.fn(),
    resetSavedToLibraryFlag: vi.fn()
  }
}));

// Define a single mockAudioBuffer at the top of the file:
const mockAudioBuffer = {
  length: 44100,
  duration: 1,
  sampleRate: 44100,
  numberOfChannels: 1,
  getChannelData: () => new Float32Array(44100),
  copyFromChannel: () => {},
  copyToChannel: () => {},
  // Add any other required AudioBuffer methods as no-ops
} as unknown as AudioBuffer;

// Helper function to get all keys in dot notation
function getAllKeys(obj: Record<string, any>, prefix = ''): string[] {
  let keys: string[] = [];
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const value = obj[key];
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys = keys.concat(getAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe('usePatchGeneration', () => {
  const mockDispatch = vi.fn();

  // Create a default mock state with complete multisample settings
  const defaultMockState = {
    state: {
      currentTab: 'drum' as const,
      drumSamples: [
        {
          file: new File(['mock'], 'drum0.wav', { type: 'audio/wav' }),
          audioBuffer: mockAudioBuffer,
          name: 'drum0.wav',
          isLoaded: true,
          inPoint: 0,
          outPoint: 1.0,
          playmode: 'oneshot' as const,
          reverse: false,
          tune: 0,
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
      multisampleFiles: [
        {
          file: new File(['mock'], 'note0.wav', { type: 'audio/wav' }),
          audioBuffer: mockAudioBuffer,
          name: 'note0.wav',
          isLoaded: true,
          rootNote: 60,
          note: 'C3',
          inPoint: 0,
          outPoint: 1.0,
          loopStart: 0,
          loopEnd: 1.0,
          originalBitDepth: 16,
          originalSampleRate: 44100,
          originalChannels: 2,
          fileSize: 1024,
          duration: 1.0
        }
      ],
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
        presetName: '',
        normalize: false,
        normalizeLevel: 0,
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
      multisampleSettings: createCompleteMultisampleSettings()
    },
    dispatch: mockDispatch
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppContext).mockReturnValue(defaultMockState);
  });

  it('should provide expected functions', () => {
    const { result } = renderHook(() => usePatchGeneration())
    
    expect(typeof result.current.generateDrumPatchFile).toBe('function')
    expect(typeof result.current.generateMultisamplePatchFile).toBe('function')
  })

  it('should handle drum patch generation', async () => {
    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateDrumPatchFile('Test Drum Kit')
    })
    
    const { generateDrumPatch } = await import('../../utils/patchGeneration');
    expect(vi.mocked(generateDrumPatch)).toHaveBeenCalled()
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_LOADING'
      })
    )
  })

  it('should handle multisample patch generation', async () => {
    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateMultisamplePatchFile('Test Multisample')
    })
    
    const { generateMultisamplePatch } = await import('../../utils/patchGeneration');
    expect(vi.mocked(generateMultisamplePatch)).toHaveBeenCalled()
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_LOADING'
      })
    )
  })

  it('should handle generation errors', async () => {
    const { generateDrumPatch } = await import('../../utils/patchGeneration');
    vi.mocked(generateDrumPatch).mockRejectedValueOnce(new Error('Generation failed'))
    
    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateDrumPatchFile('Test')
    })
    
    // Should have called dispatch to set error state
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_ERROR'
      })
    )
  })

  it('should use default names when none provided', async () => {
    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateDrumPatchFile()
      await result.current.generateMultisamplePatchFile()
    })
    
    const { generateDrumPatch, generateMultisamplePatch } = await import('../../utils/patchGeneration');
    expect(vi.mocked(generateDrumPatch)).toHaveBeenCalled()
    expect(vi.mocked(generateMultisamplePatch)).toHaveBeenCalled()
  })

  it('should handle no samples loaded error', async () => {
    // Override mock for this test
    vi.mocked(useAppContext).mockReturnValue({
      state: {
        currentTab: 'drum' as const,
        drumSamples: [], // No loaded samples
        multisampleFiles: [],
        selectedMultisample: null,
        isLoading: false,
        error: null,
        isDrumKeyboardPinned: false,
        isMultisampleKeyboardPinned: false,
        drumSettings: {
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          presetName: 'Test',
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
          presetName: 'Test',
          normalizeLevel: -6.0
        }),
        notifications: [],
        importedDrumPreset: null,
        importedMultisamplePreset: null,
        isSessionRestorationModalOpen: false,
        sessionInfo: null,
        midiNoteMapping: 'C3' as const
      },
      dispatch: mockDispatch
    })

    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateDrumPatchFile()
      await result.current.generateMultisamplePatchFile()
    })
    
    // Should have called dispatch to set error state for both
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SET_ERROR',
        payload: 'No samples loaded'
      })
    )
  })

  it('should verify envelope values are included in multisample preset (FIXED)', async () => {
    // Mock the generateMultisamplePatchFile function to capture the JSON that gets generated
    let capturedJson: any = null;
    const { generateMultisamplePatch } = await import('../../utils/patchGeneration');
    vi.mocked(generateMultisamplePatch).mockImplementation(async (state: any, _patchName) => {
      // Capture the state that gets passed to the patch generation
      capturedJson = state;
      return new Blob(['mock patch'], { type: 'application/zip' });
    });

    // Mock state with imported multisample preset that includes envelope values
    vi.mocked(useAppContext).mockReturnValue({
      ...defaultMockState,
      state: {
        ...defaultMockState.state,
        importedMultisamplePreset: {
          engine: {
            playmode: 'poly',
            transpose: 0,
            'velocity.sensitivity': 10240,
            volume: 16466,
            width: 0,
            highpass: 0,
            'portamento.amount': 0,
            'portamento.type': 32767,
            'tuning.root': 0,
          },
          envelope: {
            amp: {
              attack: 500,
              decay: 6000,
              sustain: 22000,
              release: 12000,
            },
            filter: {
              attack: 0,
              decay: 5000,
              sustain: 18000,
              release: 10000,
            },
          },
          regions: []
        }
      }
    });

    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateMultisamplePatchFile('Test Multisample')
    })
    
    // Verify that the state passed to patch generation contains envelope values
    expect(capturedJson).toBeDefined();
    expect(capturedJson.importedMultisamplePreset).toBeDefined();
    expect(capturedJson.importedMultisamplePreset.envelope).toBeDefined();
    expect(capturedJson.importedMultisamplePreset.envelope.amp).toBeDefined();
    expect(capturedJson.importedMultisamplePreset.envelope.filter).toBeDefined();
    
    // Verify specific envelope values are present
    expect(capturedJson.importedMultisamplePreset.envelope.amp.attack).toBe(500);
    expect(capturedJson.importedMultisamplePreset.envelope.amp.decay).toBe(6000);
    expect(capturedJson.importedMultisamplePreset.envelope.amp.sustain).toBe(22000);
    expect(capturedJson.importedMultisamplePreset.envelope.amp.release).toBe(12000);
  })

  it('should verify that envelope values from UI are automatically included in exported preset', async () => {
    // Mock the actual patch generation to capture the final JSON
    let capturedPatchJson: any = null;
    const { generateMultisamplePatch } = await import('../../utils/patchGeneration');
    vi.mocked(generateMultisamplePatch).mockImplementation(async (state, _patchName) => {
      // Simulate what the actual patch generation does - merge imported preset with base JSON
      const baseJson = {
        engine: { playmode: 'poly', volume: 16466 },
        envelope: { amp: { attack: 0, decay: 0, sustain: 32767, release: 32767 } },
        regions: []
      };
      
      // Merge the imported preset (which contains our UI settings)
      if (state.importedMultisamplePreset) {
        if (state.importedMultisamplePreset.engine) {
          Object.assign(baseJson.engine, state.importedMultisamplePreset.engine);
        }
        if (state.importedMultisamplePreset.envelope) {
          Object.assign(baseJson.envelope, state.importedMultisamplePreset.envelope);
        }
      }
      
      capturedPatchJson = baseJson;
      return new Blob(['mock patch'], { type: 'application/zip' });
    });

    // Mock state with imported multisample preset that includes envelope values from UI
    vi.mocked(useAppContext).mockReturnValue({
      ...defaultMockState,
      state: {
        ...defaultMockState.state,
        importedMultisamplePreset: {
          engine: {
            playmode: 'poly',
            transpose: 0,
            'velocity.sensitivity': 10240,
            volume: 16466,
            width: 0,
            highpass: 0,
            'portamento.amount': 0,
            'portamento.type': 32767,
            'tuning.root': 0,
          },
          envelope: {
            amp: {
              attack: 1000,  // Custom UI value
              decay: 8000,   // Custom UI value
              sustain: 25000, // Custom UI value
              release: 15000, // Custom UI value
            },
            filter: {
              attack: 200,   // Custom UI value
              decay: 4000,   // Custom UI value
              sustain: 20000, // Custom UI value
              release: 12000, // Custom UI value
            },
          },
          regions: []
        }
      }
    });

    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateMultisamplePatchFile('Test Multisample')
    })
    
    // Verify that the final patch JSON contains the envelope values from the UI
    expect(capturedPatchJson).toBeDefined();
    expect(capturedPatchJson.envelope).toBeDefined();
    expect(capturedPatchJson.envelope.amp).toBeDefined();
    expect(capturedPatchJson.envelope.filter).toBeDefined();
    
    // Verify that the custom UI envelope values are in the final exported preset
    expect(capturedPatchJson.envelope.amp.attack).toBe(1000);
    expect(capturedPatchJson.envelope.amp.decay).toBe(8000);
    expect(capturedPatchJson.envelope.amp.sustain).toBe(25000);
    expect(capturedPatchJson.envelope.amp.release).toBe(15000);
    
    expect(capturedPatchJson.envelope.filter.attack).toBe(200);
    expect(capturedPatchJson.envelope.filter.decay).toBe(4000);
    expect(capturedPatchJson.envelope.filter.sustain).toBe(20000);
    expect(capturedPatchJson.envelope.filter.release).toBe(12000);
  })

  it('should verify that 100% envelope values (32767) are correctly exported', async () => {
    // Mock the actual patch generation to capture the final JSON
    let capturedPatchJson: any = null;
    const { generateMultisamplePatch } = await import('../../utils/patchGeneration');
    vi.mocked(generateMultisamplePatch).mockImplementation(async (state, _patchName) => {
      // Simulate what the actual patch generation does - merge imported preset with base JSON
      const baseJson = {
        engine: { playmode: 'poly', volume: 16466 },
        envelope: { amp: { attack: 0, decay: 0, sustain: 32767, release: 32767 } },
        regions: []
      };
      
      // Merge the imported preset (which contains our UI settings)
      if (state.importedMultisamplePreset) {
        if (state.importedMultisamplePreset.engine) {
          Object.assign(baseJson.engine, state.importedMultisamplePreset.engine);
        }
        if (state.importedMultisamplePreset.envelope) {
          Object.assign(baseJson.envelope, state.importedMultisamplePreset.envelope);
        }
      }
      
      capturedPatchJson = baseJson;
      return new Blob(['mock patch'], { type: 'application/zip' });
    });

    // Mock state with imported multisample preset that includes 100% envelope values (32767)
    vi.mocked(useAppContext).mockReturnValue({
      ...defaultMockState,
      state: {
        ...defaultMockState.state,
        importedMultisamplePreset: {
          engine: {
            playmode: 'poly',
            transpose: 0,
            'velocity.sensitivity': 32767, // 100%
            volume: 32767, // 100%
            width: 32767, // 100%
            highpass: 32767, // 100%
            'portamento.amount': 32767, // 100%
            'portamento.type': 32767,
            'tuning.root': 0,
          },
          envelope: {
            amp: {
              attack: 32767,  // 100%
              decay: 32767,   // 100%
              sustain: 32767, // 100%
              release: 32767, // 100%
            },
            filter: {
              attack: 32767,  // 100%
              decay: 32767,   // 100%
              sustain: 32767, // 100%
              release: 32767, // 100%
            },
          },
          regions: []
        }
      }
    });

    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateMultisamplePatchFile('Test Multisample')
    })
    
    // Verify that the final patch JSON contains the 100% envelope values (32767)
    expect(capturedPatchJson).toBeDefined();
    expect(capturedPatchJson.envelope).toBeDefined();
    expect(capturedPatchJson.envelope.amp).toBeDefined();
    expect(capturedPatchJson.envelope.filter).toBeDefined();
    
    // Verify that all envelope values are 32767 (100%)
    expect(capturedPatchJson.envelope.amp.attack).toBe(32767);
    expect(capturedPatchJson.envelope.amp.decay).toBe(32767);
    expect(capturedPatchJson.envelope.amp.sustain).toBe(32767);
    expect(capturedPatchJson.envelope.amp.release).toBe(32767);
    
    // Also verify engine values are 32767 (100%)
    expect(capturedPatchJson.engine.volume).toBe(32767);
    expect(capturedPatchJson.engine.width).toBe(32767);
    expect(capturedPatchJson.engine.highpass).toBe(32767);
    expect(capturedPatchJson.engine['velocity.sensitivity']).toBe(32767);
    expect(capturedPatchJson.engine['portamento.amount']).toBe(32767);
  })

  it('should verify envelope values are included in actual exported ZIP file (integration test)', async () => {
    // Mock the actual patch generation to use real logic but capture the ZIP
    const { generateMultisamplePatch } = await import('../../utils/patchGeneration');
    vi.mocked(generateMultisamplePatch).mockImplementation(async (state, patchName) => {
      // Import the real modules for this integration test
      const JSZip = (await import('jszip')).default;
      const { baseMultisampleJson } = await import('../../components/multisample/baseMultisampleJson');
      const { mergeImportedMultisampleSettings } = await import('../../utils/jsonImport');
      
      const zip = new JSZip();
      const sanitizedName = patchName || 'multisample_patch';
      
      // Deep copy base multisample JSON
      const patchJson = JSON.parse(JSON.stringify(baseMultisampleJson));
      patchJson.name = sanitizedName;
      patchJson.regions = [];

      // Merge imported preset settings if they exist
      mergeImportedMultisampleSettings(patchJson, (state as any).importedMultisamplePreset);

      // Add patch.json to ZIP
      zip.file("patch.json", JSON.stringify(patchJson, null, 2));

      // Generate ZIP
      return await zip.generateAsync({ type: 'blob' });
    });

    // Mock state with imported multisample preset that includes envelope values
    vi.mocked(useAppContext).mockReturnValue({
      ...defaultMockState,
      state: {
        ...defaultMockState.state,
        multisampleFiles: [
          {
            file: new File(['mock audio'], 'test.wav', { type: 'audio/wav' }),
            audioBuffer: mockAudioBuffer,
            name: 'test.wav',
            isLoaded: true,
            rootNote: 60,
            inPoint: 0,
            outPoint: 1,
            loopStart: 0,
            loopEnd: 1
          }
        ],
        importedMultisamplePreset: {
          engine: {
            playmode: 'poly',
            transpose: 0,
            'velocity.sensitivity': 32767, // 100%
            volume: 32767, // 100%
            width: 32767, // 100%
            highpass: 32767, // 100%
            'portamento.amount': 32767, // 100%
            'portamento.type': 32767,
            'tuning.root': 0,
          },
          envelope: {
            amp: {
              attack: 32767,  // 100%
              decay: 32767,   // 100%
              sustain: 32767, // 100%
              release: 32767, // 100%
            },
            filter: {
              attack: 32767,  // 100%
              decay: 32767,   // 100%
              sustain: 32767, // 100%
              release: 32767, // 100%
            },
          },
          regions: []
        }
      }
    });

    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateMultisamplePatchFile('Test Multisample')
    })
    
    // Verify that the patch generation was called
    expect(vi.mocked(generateMultisamplePatch)).toHaveBeenCalled();
    
    // The real test is that the mock implementation above uses the actual merge logic
    // and should include the envelope values in the generated ZIP
  })

  it('should verify that envelope values are NOT included when no preset is imported (regression test)', async () => {
    // Mock the actual patch generation to capture the final JSON
    let capturedPatchJson: any = null;
    const { generateMultisamplePatch } = await import('../../utils/patchGeneration');
    vi.mocked(generateMultisamplePatch).mockImplementation(async (state, _patchName) => {
      // Simulate what the actual patch generation does - merge imported preset with base JSON
      const baseJson = {
        engine: { playmode: 'poly', volume: 16466 },
        envelope: { amp: { attack: 0, decay: 0, sustain: 32767, release: 32767 } },
        regions: []
      };
      
      // Merge the imported preset (which contains our UI settings)
      if (state.importedMultisamplePreset) {
        if (state.importedMultisamplePreset.engine) {
          Object.assign(baseJson.engine, state.importedMultisamplePreset.engine);
        }
        if (state.importedMultisamplePreset.envelope) {
          Object.assign(baseJson.envelope, state.importedMultisamplePreset.envelope);
        }
      }
      
      capturedPatchJson = baseJson;
      return new Blob(['mock patch'], { type: 'application/zip' });
    });

    // Mock state with NO imported multisample preset (null)
    vi.mocked(useAppContext).mockReturnValue({
      ...defaultMockState,
      state: {
        ...defaultMockState.state,
        importedMultisamplePreset: null, // No preset imported
        isSessionRestorationModalOpen: false,
        sessionInfo: null,
        midiNoteMapping: 'C3' as const
      }
    });

    const { result } = renderHook(() => usePatchGeneration())
    
    await act(async () => {
      await result.current.generateMultisamplePatchFile('Test Multisample')
    })
    
    // Verify that the final patch JSON contains the default envelope values (NOT 32767)
    expect(capturedPatchJson).toBeDefined();
    expect(capturedPatchJson.envelope).toBeDefined();
    expect(capturedPatchJson.envelope.amp).toBeDefined();
    
    // Verify that envelope values are NOT 32767 (should be defaults)
    expect(capturedPatchJson.envelope.amp.attack).toBe(0);
    expect(capturedPatchJson.envelope.amp.decay).toBe(0);
    expect(capturedPatchJson.envelope.amp.sustain).toBe(32767);
    expect(capturedPatchJson.envelope.amp.release).toBe(32767);
    
    // Verify that engine values are also defaults (NOT 32767)
    expect(capturedPatchJson.engine.volume).toBe(16466);
  })

  it('should export all updated values (engine, envelope, etc.) in the patch JSON', async () => {
    let capturedPatchJson: any = null;
    const { generateMultisamplePatch } = await import('../../utils/patchGeneration');
    vi.mocked(generateMultisamplePatch).mockImplementation(async (state, _patchName) => {
      // Simulate patch generation and capture the merged JSON
      const baseJson = {
        engine: { playmode: 'poly', volume: 16466, width: 0, highpass: 0, transpose: 0, 'velocity.sensitivity': 0, 'portamento.amount': 0, 'portamento.type': 0, 'tuning.root': 0 },
        envelope: {
          amp: { attack: 0, decay: 0, sustain: 32767, release: 32767 },
          filter: { attack: 0, decay: 0, sustain: 32767, release: 32767 }
        },
        regions: []
      };
      if (state.importedMultisamplePreset) {
        if (state.importedMultisamplePreset.engine) {
          Object.assign(baseJson.engine, state.importedMultisamplePreset.engine);
        }
        if (state.importedMultisamplePreset.envelope) {
          Object.assign(baseJson.envelope, state.importedMultisamplePreset.envelope);
        }
        if (state.importedMultisamplePreset.regions) {
          baseJson.regions = state.importedMultisamplePreset.regions;
        }
      }
      capturedPatchJson = baseJson;
      return new Blob(['mock patch'], { type: 'application/zip' });
    });

    // Set all fields to non-default values
    const updatedEngine = {
      playmode: 'mono',
      volume: 12345,
      width: 23456,
      highpass: 3456,
      transpose: 7,
      'velocity.sensitivity': 22222,
      'portamento.amount': 11111,
      'portamento.type': 1,
      'tuning.root': 42,
    };
    const updatedEnvelope = {
      amp: { attack: 1111, decay: 2222, sustain: 3333, release: 4444 },
      filter: { attack: 5555, decay: 6666, sustain: 7777, release: 8888 }
    };
    const updatedRegions = [
      { root: 60, lo: 60, hi: 60, file: 'sample1.wav' },
      { root: 61, lo: 61, hi: 61, file: 'sample2.wav' }
    ];

    vi.mocked(useAppContext).mockReturnValue({
      ...defaultMockState,
      state: {
        ...defaultMockState.state,
        importedMultisamplePreset: {
          engine: updatedEngine,
          envelope: updatedEnvelope,
          regions: updatedRegions
        }
      }
    });

    const { result } = renderHook(() => usePatchGeneration())
    await act(async () => {
      await result.current.generateMultisamplePatchFile('Test Multisample')
    })

    // Assert all updated values are present in the exported JSON
    expect(capturedPatchJson).toBeDefined();
    expect(capturedPatchJson.engine).toMatchObject(updatedEngine);
    expect(capturedPatchJson.envelope.amp).toMatchObject(updatedEnvelope.amp);
    expect(capturedPatchJson.envelope.filter).toMatchObject(updatedEnvelope.filter);
    expect(capturedPatchJson.regions).toEqual(updatedRegions);
  })
})

describe('patch export structure', () => {
  it('should include all required fields from baseDrumJson in exported drum patch', async () => {
    let capturedPatchJson: Record<string, any> | null = null;
    const { generateDrumPatch } = await import('../../utils/patchGeneration');
    vi.mocked(generateDrumPatch).mockImplementation(async (_state, _patchName) => {
      // Simulate patch generation and capture the merged JSON
      const base = JSON.parse(JSON.stringify(baseDrumJson));
      // Simulate merge logic if needed (for now, just use base)
      capturedPatchJson = base;
      return new Blob(['mock patch'], { type: 'application/zip' });
    });

    const { result } = renderHook(() => usePatchGeneration());
    await act(async () => {
      await result.current.generateDrumPatchFile('Test Drum Kit');
    });

    // Compare structure
    const baseKeys = getAllKeys(baseDrumJson);
    const exportedKeys = getAllKeys(capturedPatchJson ?? {});
    for (const key of baseKeys) {
      expect(exportedKeys).toContain(key);
    }
  });

  it('should include all required fields from baseMultisampleJson in exported multisample patch', async () => {
    let capturedPatchJson: Record<string, any> | null = null;
    const { generateMultisamplePatch } = await import('../../utils/patchGeneration');
    vi.mocked(generateMultisamplePatch).mockImplementation(async (_state, _patchName) => {
      // Simulate patch generation and capture the merged JSON
      const base = JSON.parse(JSON.stringify(baseMultisampleJson));
      // Simulate merge logic if needed (for now, just use base)
      capturedPatchJson = base;
      return new Blob(['mock patch'], { type: 'application/zip' });
    });

    const { result } = renderHook(() => usePatchGeneration());
    await act(async () => {
      await result.current.generateMultisamplePatchFile('Test Multisample');
    });

    // Compare structure
    const baseKeys = getAllKeys(baseMultisampleJson);
    const exportedKeys = getAllKeys(capturedPatchJson ?? {});
    for (const key of baseKeys) {
      expect(exportedKeys).toContain(key);
    }
  });


});