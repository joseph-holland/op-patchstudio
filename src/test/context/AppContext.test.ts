import { describe, it, expect } from 'vitest';
import { appReducer, initialState } from '../../context/AppContext';

describe('AppContext - REORDER_DRUM_SAMPLES', () => {
  it('should reorder drum samples correctly', () => {
    // Create initial state with some loaded samples
    const stateWithSamples = {
      ...initialState,
      drumSamples: [
        { ...initialState.drumSamples[0], isLoaded: true, name: 'Sample 1' },
        { ...initialState.drumSamples[1], isLoaded: true, name: 'Sample 2' },
        { ...initialState.drumSamples[2], isLoaded: true, name: 'Sample 3' },
        ...initialState.drumSamples.slice(3)
      ]
    };

    // Test reordering: move sample from index 0 to index 2
    const action = {
      type: 'REORDER_DRUM_SAMPLES' as const,
      payload: {
        fromIndex: 0,
        toIndex: 2
      }
    };

    const newState = appReducer(stateWithSamples, action);

    // Verify the reordering worked correctly
    expect(newState.drumSamples[0].name).toBe('Sample 2');
    expect(newState.drumSamples[1].name).toBe('Sample 3');
    expect(newState.drumSamples[2].name).toBe('Sample 1');
  });

  it('should handle reordering to same index (no change)', () => {
    const stateWithSamples = {
      ...initialState,
      drumSamples: [
        { ...initialState.drumSamples[0], isLoaded: true, name: 'Sample 1' },
        { ...initialState.drumSamples[1], isLoaded: true, name: 'Sample 2' },
        ...initialState.drumSamples.slice(2)
      ]
    };

    // Test reordering to same index
    const action = {
      type: 'REORDER_DRUM_SAMPLES' as const,
      payload: { fromIndex: 0, toIndex: 0 }
    };

    const newState = appReducer(stateWithSamples, action);

    // Verify no change occurred
    expect(newState.drumSamples[0].name).toBe('Sample 1');
    expect(newState.drumSamples[1].name).toBe('Sample 2');
  });

  it('should maintain array length of 24', () => {
    const stateWithSamples = {
      ...initialState,
      drumSamples: [
        { ...initialState.drumSamples[0], isLoaded: true, name: 'Sample 1' },
        { ...initialState.drumSamples[1], isLoaded: true, name: 'Sample 2' },
        ...initialState.drumSamples.slice(2)
      ]
    };

    const action = {
      type: 'REORDER_DRUM_SAMPLES' as const,
      payload: { fromIndex: 0, toIndex: 23 }
    };

    const newState = appReducer(stateWithSamples, action);

    // Verify array length is maintained
    expect(newState.drumSamples).toHaveLength(24);
  });
});

describe('AppContext - Unassigned Sample Management', () => {
  it('should add unassigned drum sample correctly', () => {
    const mockFile = new File(['test'], 'test.wav', { type: 'audio/wav' });
    const mockAudioBuffer = new AudioContext().createBuffer(1, 44100, 44100);
    const mockMetadata = {
      format: 'wav' as const,
      duration: 1.0,
      bitDepth: 16,
      sampleRate: 44100,
      channels: 1,
      fileSize: 1024,
      audioBuffer: mockAudioBuffer,
      midiNote: 60,
      loopStart: 0,
      loopEnd: 44100,
      hasLoopData: false
    };

    const action = {
      type: 'ADD_UNASSIGNED_DRUM_SAMPLE' as const,
      payload: {
        file: mockFile,
        audioBuffer: mockAudioBuffer,
        metadata: mockMetadata
      }
    };

    const newState = appReducer(initialState, action);

    // Verify the unassigned sample was added
    expect(newState.drumSamples.length).toBe(25); // 24 original + 1 new
    const newSample = newState.drumSamples[24];
    expect(newSample.isLoaded).toBe(true);
    expect(newSample.name).toBe('test.wav');
    expect(newSample.isAssigned).toBe(false);
    expect(newSample.assignedKey).toBeUndefined();
  });

  it('should assign unassigned sample to drum key correctly', () => {
    // Create state with an unassigned sample
    const stateWithUnassigned = {
      ...initialState,
      drumSamples: [
        ...initialState.drumSamples,
        {
          ...initialState.drumSamples[0],
          isLoaded: true,
          name: 'Unassigned Sample',
          isAssigned: false,
          assignedKey: undefined
        }
      ]
    };

    const action = {
      type: 'ASSIGN_DRUM_SAMPLE' as const,
      payload: {
        sampleIndex: 24, // The unassigned sample
        targetKeyIndex: 5 // Assign to drum key 5
      }
    };

    const newState = appReducer(stateWithUnassigned, action);

    // Verify the sample was assigned
    const assignedSample = newState.drumSamples[24];
    expect(assignedSample.isAssigned).toBe(true);
    expect(assignedSample.assignedKey).toBe(5);
  });

  it('should unassign sample correctly', () => {
    // Create state with an assigned sample
    const stateWithAssigned = {
      ...initialState,
      drumSamples: [
        {
          ...initialState.drumSamples[0],
          isLoaded: true,
          name: 'Assigned Sample',
          isAssigned: true,
          assignedKey: 5
        },
        ...initialState.drumSamples.slice(1)
      ]
    };

    const action = {
      type: 'UNASSIGN_DRUM_SAMPLE' as const,
      payload: 0
    };

    const newState = appReducer(stateWithAssigned, action);

    // Verify the sample was unassigned
    const unassignedSample = newState.drumSamples[0];
    expect(unassignedSample.isAssigned).toBe(false);
    expect(unassignedSample.assignedKey).toBeUndefined();
  });

  it('should handle assigning sample to already occupied key', () => {
    // Create state with two assigned samples
    const stateWithAssigned = {
      ...initialState,
      drumSamples: [
        {
          ...initialState.drumSamples[0],
          isLoaded: true,
          name: 'Sample 1',
          isAssigned: true,
          assignedKey: 5
        },
        {
          ...initialState.drumSamples[1],
          isLoaded: true,
          name: 'Sample 2',
          isAssigned: true,
          assignedKey: 10 // Different key from Sample 1
        },
        ...initialState.drumSamples.slice(2)
      ]
    };

    const action = {
      type: 'ASSIGN_DRUM_SAMPLE' as const,
      payload: {
        sampleIndex: 1, // Sample 2
        targetKeyIndex: 5 // Assign to same key as Sample 1
      }
    };

    const newState = appReducer(stateWithAssigned, action);

    // Verify Sample 1 was unassigned and Sample 2 was assigned to key 5
    expect(newState.drumSamples[0].isAssigned).toBe(false);
    expect(newState.drumSamples[0].assignedKey).toBeUndefined();
    expect(newState.drumSamples[1].isAssigned).toBe(true);
    expect(newState.drumSamples[1].assignedKey).toBe(5);
  });
});

describe('AppContext - SWAP_DRUM_SAMPLES', () => {
  it('should swap drum samples while keeping key names fixed', () => {
    // Create initial state with assigned samples
    const stateWithSamples = {
      ...initialState,
      drumSamples: [
        { ...initialState.drumSamples[0], isLoaded: true, name: 'Crash Cymbal', isAssigned: true, assignedKey: 0 },
        { ...initialState.drumSamples[1], isLoaded: true, name: 'Ride Cymbal', isAssigned: true, assignedKey: 1 },
        ...initialState.drumSamples.slice(2)
      ]
    };

    // Test swapping: move crash cymbal (index 0) to ride cymbal position (index 1)
    const action = {
      type: 'SWAP_DRUM_SAMPLES' as const,
      payload: {
        fromIndex: 0,
        toIndex: 1
      }
    };

    const newState = appReducer(stateWithSamples, action);

    // Verify the samples were swapped
    expect(newState.drumSamples[0].name).toBe('Ride Cymbal');
    expect(newState.drumSamples[1].name).toBe('Crash Cymbal');
    
    // Verify the assignedKey properties were updated correctly
    expect(newState.drumSamples[0].assignedKey).toBe(0);
    expect(newState.drumSamples[1].assignedKey).toBe(1);
  });

  it('should handle swapping with unassigned samples', () => {
    // Create initial state with one assigned and one unassigned sample
    const stateWithSamples = {
      ...initialState,
      drumSamples: [
        { ...initialState.drumSamples[0], isLoaded: true, name: 'Crash Cymbal', isAssigned: true, assignedKey: 0 },
        { ...initialState.drumSamples[1], isLoaded: true, name: 'Unassigned Sample', isAssigned: false, assignedKey: undefined },
        ...initialState.drumSamples.slice(2)
      ]
    };

    // Test swapping assigned sample with unassigned sample
    const action = {
      type: 'SWAP_DRUM_SAMPLES' as const,
      payload: {
        fromIndex: 0,
        toIndex: 1
      }
    };

    const newState = appReducer(stateWithSamples, action);

    // Verify the samples were swapped
    expect(newState.drumSamples[0].name).toBe('Unassigned Sample');
    expect(newState.drumSamples[1].name).toBe('Crash Cymbal');
    
    // Verify the assignedKey properties were updated correctly
    expect(newState.drumSamples[0].assignedKey).toBeUndefined();
    expect(newState.drumSamples[1].assignedKey).toBe(1);
  });
});

describe('AppContext - RESTORE_SESSION', () => {
  it('should restore session with proper isFloat property and assignment state', () => {
    const mockFile = new File(['test'], 'test.wav', { type: 'audio/wav' });
    const mockAudioBuffer = new AudioContext().createBuffer(1, 44100, 44100);
    
    const action = {
      type: 'RESTORE_SESSION' as const,
      payload: {
        drumSettings: initialState.drumSettings,
        multisampleSettings: initialState.multisampleSettings,
        drumSamples: [
          {
            originalIndex: 0,
            isAssigned: true,
            assignedKey: 0,
            file: mockFile,
            audioBuffer: mockAudioBuffer,
            name: 'Restored Sample 1',
            isLoaded: true,
            inPoint: 0,
            outPoint: 1.0,
            playmode: 'oneshot' as const,
            reverse: false,
            transpose: 0,
            pan: 0,
            gain: 0,
            hasBeenEdited: false,
            originalBitDepth: 24,
            originalSampleRate: 44100,
            originalChannels: 2,
            fileSize: 1024,
            duration: 1.0,
            isFloat: true // Test the isFloat property
          },
          {
            originalIndex: 25, // Beyond the first 24 slots
            isAssigned: false,
            assignedKey: undefined,
            file: mockFile,
            audioBuffer: mockAudioBuffer,
            name: 'Unassigned Sample',
            isLoaded: true,
            inPoint: 0,
            outPoint: 1.0,
            playmode: 'oneshot' as const,
            reverse: false,
            transpose: 0,
            pan: 0,
            gain: 0,
            hasBeenEdited: false,
            originalBitDepth: 16,
            originalSampleRate: 44100,
            originalChannels: 1,
            fileSize: 512,
            duration: 1.0,
            isFloat: false
          }
        ],
        multisampleFiles: [],
        selectedMultisample: null,
        isDrumKeyboardPinned: false,
        isMultisampleKeyboardPinned: false
      }
    };

    const newState = appReducer(initialState, action);

    // Verify the restored samples have the correct properties
    const restoredSample1 = newState.drumSamples[0];
    expect(restoredSample1.isLoaded).toBe(true);
    expect(restoredSample1.name).toBe('Restored Sample 1');
    expect(restoredSample1.isAssigned).toBe(true);
    expect(restoredSample1.assignedKey).toBe(0);
    expect(restoredSample1.isFloat).toBe(true); // Verify isFloat is preserved
    expect(restoredSample1.originalBitDepth).toBe(24);
    expect(restoredSample1.originalSampleRate).toBe(44100);
    expect(restoredSample1.originalChannels).toBe(2);

    // Verify the unassigned sample is properly restored
    const unassignedSample = newState.drumSamples[25];
    expect(unassignedSample.isLoaded).toBe(true);
    expect(unassignedSample.name).toBe('Unassigned Sample');
    expect(unassignedSample.isAssigned).toBe(false);
    expect(unassignedSample.assignedKey).toBeUndefined();
    expect(unassignedSample.isFloat).toBe(false); // Verify isFloat is preserved
    expect(unassignedSample.originalBitDepth).toBe(16);
    expect(unassignedSample.originalSampleRate).toBe(44100);
    expect(unassignedSample.originalChannels).toBe(1);

    // Verify empty slots in the first 24 are properly assigned
    for (let i = 1; i < 24; i++) {
      if (!newState.drumSamples[i].isLoaded) {
        expect(newState.drumSamples[i].isAssigned).toBe(true);
        expect(newState.drumSamples[i].assignedKey).toBe(i);
      }
    }

    // Verify the array size accommodates all samples
    expect(newState.drumSamples.length).toBe(26); // 0-25 inclusive
  });

  it('should handle empty slots with proper assignment state', () => {
    const action = {
      type: 'RESTORE_SESSION' as const,
      payload: {
        drumSettings: initialState.drumSettings,
        multisampleSettings: initialState.multisampleSettings,
        drumSamples: [], // No samples to restore
        multisampleFiles: [],
        selectedMultisample: null,
        isDrumKeyboardPinned: false,
        isMultisampleKeyboardPinned: false
      }
    };

    const newState = appReducer(initialState, action);

    // Verify we have at least 24 slots
    expect(newState.drumSamples.length).toBe(24);

    // Verify all slots 0-23 are assigned to their respective keys
    for (let i = 0; i < 24; i++) {
      expect(newState.drumSamples[i].isAssigned).toBe(true);
      expect(newState.drumSamples[i].assignedKey).toBe(i);
      expect(newState.drumSamples[i].isLoaded).toBe(false);
    }
  });
});