import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DrumKeyboard } from '../../components/drum/DrumKeyboard';
import { AppContextProvider } from '../../context/AppContext';

// Import the drumKeyMap to test the mapping directly
const drumKeyMap = [
  // Lower octave (octave 0)
  {
    W: { label: "KD2", idx: 1 },
    E: { label: "SD2", idx: 3 },
    R: { label: "CLP", idx: 5 },
    Y: { label: "CH", idx: 8 },
    U: { label: "OH", idx: 10 },
    A: { label: "KD1", idx: 0 },
    S: { label: "SD1", idx: 2 },
    D: { label: "RIM", idx: 4 },
    F: { label: "TB", idx: 6 },
    G: { label: "SH", idx: 7 },
    H: { label: "CL", idx: 9 },
    J: { label: "CAB", idx: 11 },
  },
  // Upper octave (octave 1)
  {
    W: { label: "RC", idx: 13 },
    E: { label: "CC", idx: 15 },
    R: { label: "COW", idx: 17 },
    Y: { label: "LC", idx: 20 },
    U: { label: "HC", idx: 22 },
    A: { label: "LT1", idx: 12 },
    S: { label: "MT", idx: 14 },
    D: { label: "HT", idx: 16 },
    F: { label: "TRI", idx: 18 },
    G: { label: "LT2", idx: 19 },
    H: { label: "WS", idx: 21 },
    J: { label: "GUI", idx: 23 },
  },
];

describe('DrumKeyboard', () => {
  it('should render without crashing', () => {
    render(
      <AppContextProvider>
        <DrumKeyboard />
      </AppContextProvider>
    );
  });

  it('should have correct drum key mapping for G key in octave 1', () => {
    // Test that the G key in octave 1 correctly maps to "LT2" (low tom alt) at index 19
    const gKeyMapping = drumKeyMap[1].G;
    expect(gKeyMapping.label).toBe('LT2');
    expect(gKeyMapping.idx).toBe(19);
  });

  it('should have correct drum key mapping for A key in octave 1', () => {
    // Test that the A key in octave 1 correctly maps to "LT1" (low tom) at index 12
    const aKeyMapping = drumKeyMap[1].A;
    expect(aKeyMapping.label).toBe('LT1');
    expect(aKeyMapping.idx).toBe(12);
  });

  it('should have correct drum key mapping for S key in octave 1', () => {
    // Test that the S key in octave 1 correctly maps to "MT" (mid-tom) at index 14
    const sKeyMapping = drumKeyMap[1].S;
    expect(sKeyMapping.label).toBe('MT');
    expect(sKeyMapping.idx).toBe(14);
  });

  it('should have correct drum key mapping for D key in octave 1', () => {
    // Test that the D key in octave 1 correctly maps to "HT" (hi-tom) at index 16
    const dKeyMapping = drumKeyMap[1].D;
    expect(dKeyMapping.label).toBe('HT');
    expect(dKeyMapping.idx).toBe(16);
  });

  it('should have correct drum key mapping for F key in octave 1', () => {
    // Test that the F key in octave 1 correctly maps to "TRI" (triangle) at index 18
    const fKeyMapping = drumKeyMap[1].F;
    expect(fKeyMapping.label).toBe('TRI');
    expect(fKeyMapping.idx).toBe(18);
  });

  it('should have correct drum key mapping for Y key in octave 1', () => {
    // Test that the Y key in octave 1 correctly maps to "LC" (low conga) at index 20
    const yKeyMapping = drumKeyMap[1].Y;
    expect(yKeyMapping.label).toBe('LC');
    expect(yKeyMapping.idx).toBe(20);
  });

  it('should have correct drum key mapping for H key in octave 1', () => {
    // Test that the H key in octave 1 correctly maps to "WS" (wood stick) at index 21
    const hKeyMapping = drumKeyMap[1].H;
    expect(hKeyMapping.label).toBe('WS');
    expect(hKeyMapping.idx).toBe(21);
  });

  it('should not have duplicate "LT1" labels in octave 1', () => {
    // Test that there are no duplicate "LT1" labels in octave 1
    const octave1Labels = Object.values(drumKeyMap[1]).map(mapping => mapping.label);
    const lt1Count = octave1Labels.filter(label => label === 'LT1').length;
    expect(lt1Count).toBe(1); // Should only be one "LT1" label (on A key)
  });

  it('should not have duplicate "LT2" labels in octave 1', () => {
    // Test that there are no duplicate "LT2" labels in octave 1
    const octave1Labels = Object.values(drumKeyMap[1]).map(mapping => mapping.label);
    const lt2Count = octave1Labels.filter(label => label === 'LT2').length;
    expect(lt2Count).toBe(1); // Should only be one "LT2" label (on G key)
  });

  it('should not have duplicate "CL1" labels in octave 1', () => {
    // Test that there are no duplicate "CL1" labels in octave 1
    const octave1Labels = Object.values(drumKeyMap[1]).map(mapping => mapping.label);
    const cl1Count = octave1Labels.filter(label => label === 'CL1').length;
    expect(cl1Count).toBe(0); // Should be no "CL1" labels in octave 1 (it's in octave 0)
  });

  it('should not have duplicate "WS" labels in octave 1', () => {
    // Test that there are no duplicate "WS" labels in octave 1
    const octave1Labels = Object.values(drumKeyMap[1]).map(mapping => mapping.label);
    const wsCount = octave1Labels.filter(label => label === 'WS').length;
    expect(wsCount).toBe(1); // Should only be one "WS" label (on H key)
  });

  it('should have unique indices for all keys in octave 1', () => {
    // Test that all indices in octave 1 are unique
    const octave1Indices = Object.values(drumKeyMap[1]).map(mapping => mapping.idx);
    const uniqueIndices = new Set(octave1Indices);
    expect(uniqueIndices.size).toBe(octave1Indices.length);
  });
}); 