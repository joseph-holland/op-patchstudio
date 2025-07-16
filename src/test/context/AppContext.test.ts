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
      payload: { fromIndex: 0, toIndex: 2 }
    };

    const newState = appReducer(stateWithSamples, action);

    // Verify the reordering worked correctly
    expect(newState.drumSamples[0].name).toBe('Sample 2'); // Original index 1 moved to 0
    expect(newState.drumSamples[1].name).toBe('Sample 3'); // Original index 2 moved to 1
    expect(newState.drumSamples[2].name).toBe('Sample 1'); // Original index 0 moved to 2
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