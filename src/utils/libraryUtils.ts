import { indexedDB, STORES } from './indexedDB';
import type { AppState } from '../context/AppContext';
import { sessionStorageIndexedDB } from './sessionStorageIndexedDB';

// --- AudioBuffer <-> Blob utilities ---
// You must have a utility to convert AudioBuffer to WAV ArrayBuffer
import { audioBufferToWav } from './wavExport';

export async function audioBufferToWavBlob(audioBuffer: AudioBuffer): Promise<Blob> {
  return await audioBufferToWav(audioBuffer);
}

export async function blobToAudioBuffer(blob: Blob, audioContext: AudioContext): Promise<AudioBuffer> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Validate the audio buffer
    if (!audioBuffer || typeof audioBuffer.duration !== 'number' || audioBuffer.duration <= 0) {
      throw new Error('Invalid audio buffer: missing or invalid duration');
    }
    
    return audioBuffer;
  } catch (error) {
    console.error('Failed to convert blob to AudioBuffer:', error);
    throw error;
  }
}

// --- Strip AudioBuffer and replace with Blob for storage (preserving drum sample indexes) ---
async function prepareDrumSamplesForStorage(drumSamples: AppState['drumSamples']): Promise<any[]> {
  if (!Array.isArray(drumSamples)) {
    return [];
  }
  
  const preparedSamples = [];
  for (let index = 0; index < drumSamples.length; index++) {
    const sample = drumSamples[index];
    
    if (sample && sample.isLoaded && sample.audioBuffer) {
      const audioBlob = await audioBufferToWavBlob(sample.audioBuffer);
      const { audioBuffer, ...rest } = sample;
      preparedSamples.push({
        ...rest,
        audioBlob,
        originalIndex: index, // Preserve the original index
        metadata: {
          duration: sample.duration,
          bitDepth: sample.originalBitDepth,
          sampleRate: sample.originalSampleRate,
          channels: sample.originalChannels,
          fileSize: sample.fileSize
        }
      });
    }
  }
  
  return preparedSamples;
}

// --- Strip AudioBuffer and replace with Blob for multisample files ---
async function prepareMultisampleFilesForStorage(multisampleFiles: AppState['multisampleFiles']): Promise<any[]> {
  if (!Array.isArray(multisampleFiles)) {
    return [];
  }
  
  return Promise.all(multisampleFiles.map(async (file) => {
    if (file && file.isLoaded && file.audioBuffer) {
      const audioBlob = await audioBufferToWavBlob(file.audioBuffer);
      const { audioBuffer, ...rest } = file;
      return {
        ...rest,
        audioBlob,
        metadata: {
          // Basic WAV properties
          duration: file.duration,
          bitDepth: file.originalBitDepth,
          sampleRate: file.originalSampleRate,
          channels: file.originalChannels,
          fileSize: file.fileSize,
          // MIDI note information
          midiNote: file.rootNote,
          // Loop information
          hasLoopData: true, // We always have loop data since we set defaults
          loopStart: file.loopStart,
          loopEnd: file.loopEnd,
          // Format information
          format: 'PCM',
          dataLength: file.fileSize || 0
        }
      };
    }
    return file;
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

    // Prepare samples for storage with proper index preservation
    const drumSamples = await prepareDrumSamplesForStorage(state.drumSamples);
    const multisampleFiles = await prepareMultisampleFilesForStorage(state.multisampleFiles);

    // Store the current state data for the preset
    const presetData = {
      drumSettings: state.drumSettings,
      multisampleSettings: state.multisampleSettings,
      drumSamples,
      multisampleFiles,
      importedDrumPreset: state.importedDrumPreset,
      importedMultisamplePreset: state.importedMultisamplePreset
    };
    
    const preset: LibraryPreset = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 2 + 9)}`,
      name: presetName,
      type,
      data: presetData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isFavorite: false,
      sampleCount: type === 'drum' 
        ? drumSamples.length // Now this counts actual loaded samples
        : multisampleFiles.filter(f => f && f.isLoaded).length
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