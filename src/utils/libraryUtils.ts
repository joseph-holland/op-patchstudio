import { indexedDB, STORES } from './indexedDB';
import type { AppState } from '../context/AppContext';
import { sessionStorageIndexedDB } from './sessionStorageIndexedDB';

// --- AudioBuffer <-> Blob utilities ---
// You must have a utility to convert AudioBuffer to WAV ArrayBuffer
import { audioBufferToWav } from './audio'; // adjust import if needed

export async function audioBufferToWavBlob(audioBuffer: AudioBuffer): Promise<Blob> {
  const wavArrayBuffer = audioBufferToWav(audioBuffer);
  return new Blob([wavArrayBuffer], { type: 'audio/wav' });
}

export async function blobToAudioBuffer(blob: Blob, audioContext: AudioContext): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
}

// --- Strip AudioBuffer and replace with Blob for storage ---
async function prepareSamplesForStorage(samples: any[] | undefined | null): Promise<any[]> {
  // Handle cases where samples might be undefined, null, or not an array
  if (!samples || !Array.isArray(samples)) {
    return [];
  }
  
  return Promise.all(samples.map(async (sample) => {
    if (sample && sample.audioBuffer) {
      const audioBlob = await audioBufferToWavBlob(sample.audioBuffer);
      const { audioBuffer, ...rest } = sample;
      return { ...rest, audioBlob };
    }
    return sample;
  }));
}

// Enhanced PresetData interface for library
export interface LibraryPreset {
  id: string;
  name: string;
  type: 'drum' | 'multisample';
  data: any;
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
  tags?: string[];
  description?: string;
  sampleCount?: number; // Number of samples in the preset
}

export async function savePresetToLibrary(
  state: AppState,
  presetName: string,
  type: 'drum' | 'multisample'
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!presetName.trim()) {
      return {
        success: false,
        error: 'please enter a preset name before saving'
      };
    }

    // Prepare samples for storage (replace AudioBuffer with Blob)
    const drumSamples = await prepareSamplesForStorage(state.drumSamples);
    const multisampleFiles = await prepareSamplesForStorage(state.multisampleFiles);
    const importedDrumPreset = state.importedDrumPreset ? await prepareSamplesForStorage(state.importedDrumPreset) : undefined;
    const importedMultisamplePreset = state.importedMultisamplePreset ? await prepareSamplesForStorage(state.importedMultisamplePreset) : undefined;

    // Store the current state data for the preset
    const presetData = {
      drumSettings: state.drumSettings,
      multisampleSettings: state.multisampleSettings,
      drumSamples,
      multisampleFiles,
      importedDrumPreset,
      importedMultisamplePreset
    };
    
    const preset: LibraryPreset = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: presetName,
      type,
      data: presetData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isFavorite: false,
      sampleCount: type === 'drum' 
        ? drumSamples.filter(s => s && s.isLoaded).length
        : multisampleFiles.length
    };

    await indexedDB.add(STORES.PRESETS, preset);

    // Mark the current session as saved to library to prevent restore prompt
    await sessionStorageIndexedDB.markSessionAsSavedToLibrary();

    return {
      success: true
    };
  } catch (error) {
    console.error('Failed to save preset:', error);
    return {
      success: false,
      error: 'failed to save preset to library'
    };
  }
}

export async function resetAllSettings(
  _state: AppState,
  type: 'drum' | 'multisample'
): Promise<{ success: boolean; error?: string }> {
  try {
    if (type === 'drum') {
      // Reset drum settings to defaults
      // This would need to be implemented based on your default values
      // For now, we'll just return success
      return { success: true };
    } else {
      // Reset multisample settings to defaults
      // This would need to be implemented based on your default values
      // For now, we'll just return success
      return { success: true };
    }
  } catch (error) {
    console.error('Failed to reset settings:', error);
    return {
      success: false,
      error: 'failed to reset settings'
    };
  }
} 