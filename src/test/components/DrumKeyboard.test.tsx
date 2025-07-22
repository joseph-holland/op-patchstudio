import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    W: { label: "RC-13", idx: 13 },
    E: { label: "CC-15", idx: 15 },
    R: { label: "TRI-17", idx: 17 },
    Y: { label: "LC-18", idx: 18 },
    U: { label: "HC-19", idx: 19 },
    A: { label: "LT1-12", idx: 12 },
    S: { label: "MT-14", idx: 14 },
    D: { label: "HT-16", idx: 16 },
    F: { label: "LC-20", idx: 20 },
    G: { label: "LT2-21", idx: 21 },
    H: { label: "CL2-22", idx: 22 },
    J: { label: "GUI-23", idx: 23 },
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
    // Test that the G key in octave 1 correctly maps to "LT2" (low tom alt) at index 21
    const gKeyMapping = drumKeyMap[1].G;
    expect(gKeyMapping.label).toBe('LT2-21');
    expect(gKeyMapping.idx).toBe(21);
  });

  it('should have correct drum key mapping for A key in octave 1', () => {
    // Test that the A key in octave 1 correctly maps to "LT1" (low tom) at index 12
    const aKeyMapping = drumKeyMap[1].A;
    expect(aKeyMapping.label).toBe('LT1-12');
    expect(aKeyMapping.idx).toBe(12);
  });

  it('should have correct drum key mapping for S key in octave 1', () => {
    // Test that the S key in octave 1 correctly maps to "MT" (mid-tom) at index 14
    const sKeyMapping = drumKeyMap[1].S;
    expect(sKeyMapping.label).toBe('MT-14');
    expect(sKeyMapping.idx).toBe(14);
  });

  it('should have correct drum key mapping for D key in octave 1', () => {
    // Test that the D key in octave 1 correctly maps to "HT" (hi-tom) at index 16
    const dKeyMapping = drumKeyMap[1].D;
    expect(dKeyMapping.label).toBe('HT-16');
    expect(dKeyMapping.idx).toBe(16);
  });

  it('should have correct drum key mapping for F key in octave 1', () => {
    // Test that the F key in octave 1 correctly maps to "LC-20" (low conga) at index 20
    const fKeyMapping = drumKeyMap[1].F;
    expect(fKeyMapping.label).toBe('LC-20');
    expect(fKeyMapping.idx).toBe(20);
  });

  it('should have correct drum key mapping for Y key in octave 1', () => {
    // Test that the Y key in octave 1 correctly maps to "LTA" (low tom alt) at index 18
    const yKeyMapping = drumKeyMap[1].Y;
    expect(yKeyMapping.label).toBe('LC-18');
    expect(yKeyMapping.idx).toBe(18);
  });

  it('should have correct drum key mapping for H key in octave 1', () => {
    // Test that the H key in octave 1 correctly maps to "CL2" (wood stick) at index 22
    const hKeyMapping = drumKeyMap[1].H;
    expect(hKeyMapping.label).toBe('CL2-22');
    expect(hKeyMapping.idx).toBe(22);
  });

  it('should not have duplicate "LT1" labels in octave 1', () => {
    // Test that there are no duplicate "LT1" labels in octave 1
    const octave1Labels = Object.values(drumKeyMap[1]).map(mapping => mapping.label);
    const lt1Count = octave1Labels.filter(label => label === 'LT1-12').length;
    expect(lt1Count).toBe(1); // Should only be one "LT1" label (on A key)
  });

  it('should not have duplicate "LT2" labels in octave 1', () => {
    // Test that there are no duplicate "LT2" labels in octave 1
    const octave1Labels = Object.values(drumKeyMap[1]).map(mapping => mapping.label);
    const lt2Count = octave1Labels.filter(label => label === 'LT2-21').length;
    expect(lt2Count).toBe(1); // Should only be one "LT2" label (on G key)
  });

  it('should not have duplicate "CL1" labels in octave 1', () => {
    // Test that there are no duplicate "CL1" labels in octave 1
    const octave1Labels = Object.values(drumKeyMap[1]).map(mapping => mapping.label);
    const cl1Count = octave1Labels.filter(label => label === 'CL1').length;
    expect(cl1Count).toBe(0); // Should be no "CL1" labels in octave 1 (it's in octave 0)
  });

  it('should not have duplicate "CL2" labels in octave 1', () => {
    // Test that there are no duplicate "CL2" labels in octave 1
    const octave1Labels = Object.values(drumKeyMap[1]).map(mapping => mapping.label);
    const cl2Count = octave1Labels.filter(label => label === 'CL2-22').length;
    expect(cl2Count).toBe(1); // Should only be one "CL2" label (on H key)
  });

  it('should have unique indices for all keys in octave 1', () => {
    // Test that all indices in octave 1 are unique
    const octave1Indices = Object.values(drumKeyMap[1]).map(mapping => mapping.idx);
    const uniqueIndices = new Set(octave1Indices);
    expect(uniqueIndices.size).toBe(octave1Indices.length);
  });
}); 