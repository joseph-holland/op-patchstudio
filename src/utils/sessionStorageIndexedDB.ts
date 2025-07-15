import type { AppState } from '../context/AppContext';
import { indexedDB, type SessionData, type SampleData } from './indexedDB';

// Constants
const CURRENT_SESSION_KEY = 'op-patchstudio-current-session';
const SINGLE_SESSION_ID = 'current-session'; // Fixed session ID for single session approach

export class SessionStorageManagerIndexedDB {
  private static instance: SessionStorageManagerIndexedDB;

  private constructor() {}

  static getInstance(): SessionStorageManagerIndexedDB {
    if (!SessionStorageManagerIndexedDB.instance) {
      SessionStorageManagerIndexedDB.instance = new SessionStorageManagerIndexedDB();
    }
    return SessionStorageManagerIndexedDB.instance;
  }

  // Save current session data (always overwrites previous session)
  async saveSession(state: AppState): Promise<string> {
    const timestamp = Date.now();

    // First, clear all existing samples to avoid accumulation
    await this.clearAllSamples();

    // Save all samples to the samples store
    const drumSampleIds: string[] = []; // Track drum sample IDs by index
    const multisampleSampleIds: string[] = []; // Track multisample sample IDs by index
    
    // Save drum samples
    for (let i = 0; i < state.drumSamples.length; i++) {
      const sample = state.drumSamples[i];
      
      if (sample && sample.isLoaded && sample.file && sample.audioBuffer) {
        const sampleId = `drum-${i}-${timestamp}`;
        drumSampleIds[i] = sampleId;
        
        // Convert File to Blob to avoid detached ArrayBuffer issues
        const arrayBuffer = await sample.file.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: sample.file.type });
        
        const sampleData: SampleData = {
          id: sampleId,
          name: sample.file.name,
          type: sample.file.type,
          size: sample.file.size,
          data: blob,
          metadata: {
            sampleRate: sample.audioBuffer.sampleRate,
            bitDepth: sample.originalBitDepth || 16,
            channels: sample.audioBuffer.numberOfChannels,
            duration: sample.audioBuffer.duration,
            midiNote: undefined, // Drum samples don't have MIDI notes
          },
          createdAt: timestamp,
        };
        
        await indexedDB.saveSample(sampleData);
      }
    }

    // Save multisample files
    for (let i = 0; i < state.multisampleFiles.length; i++) {
      const file = state.multisampleFiles[i];
      if (file.file && file.audioBuffer) {
        const sampleId = `multisample-${i}-${timestamp}`;
        multisampleSampleIds[i] = sampleId;
        
        // Store the AudioBuffer data directly instead of the raw file
        // This avoids corruption issues with AIF files
        const audioBuffer = file.audioBuffer;
        const channelData: Float32Array[] = [];
        
        // Extract channel data from AudioBuffer
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          const channelBuffer = audioBuffer.getChannelData(channel);
          channelData.push(new Float32Array(channelBuffer));
        }
        
        const sampleData: SampleData = {
          id: sampleId,
          name: file.file.name,
          type: file.file.type,
          size: file.file.size,
          data: new Blob([JSON.stringify({
            sampleRate: audioBuffer.sampleRate,
            numberOfChannels: audioBuffer.numberOfChannels,
            length: audioBuffer.length,
            duration: audioBuffer.duration,
            channelData: channelData.map(channel => Array.from(channel)) // Convert to regular array for JSON serialization
          })], { type: 'application/json' }),
          metadata: {
            sampleRate: audioBuffer.sampleRate,
            bitDepth: file.originalBitDepth || 16,
            channels: audioBuffer.numberOfChannels,
            duration: audioBuffer.duration,
            midiNote: file.rootNote,
            note: file.note,
          },
          createdAt: timestamp,
        };
        
        await indexedDB.saveSample(sampleData);
      }
    }

    // Create session data with references to samples
    const drumSamplesForSession = state.drumSamples
      .map((sample, index) => {
        if (sample && sample.isLoaded && sample.file) {
          const sampleId = drumSampleIds[index];
          if (sampleId) {
            return {
              originalIndex: index,
              sampleId,
              settings: {
                inPoint: sample.inPoint,
                outPoint: sample.outPoint,
                playmode: sample.playmode,
                reverse: sample.reverse,
                tune: sample.tune,
                pan: sample.pan,
                gain: sample.gain,
                hasBeenEdited: sample.hasBeenEdited,
              }
            };
          }
        }
        return null;
      })
      .filter(Boolean) as SessionData['drumSamples'];

    const multisampleFilesForSession = state.multisampleFiles
      .map((file, index) => {
        if (file.file) {
          const sampleId = multisampleSampleIds[index];
          if (sampleId) {
            return {
              sampleId,
              fileName: file.file.name,
              rootNote: file.rootNote,
              note: file.note,
              inPoint: file.inPoint,
              outPoint: file.outPoint,
              loopStart: file.loopStart,
              loopEnd: file.loopEnd,
            };
          }
        }
        return null;
      })
      .filter(Boolean) as SessionData['multisampleFiles'];

    const sessionData: SessionData = {
      id: SINGLE_SESSION_ID,
      timestamp,
      version: 1, // Add version for future schema compatibility
      drumSettings: state.drumSettings,
      multisampleSettings: state.multisampleSettings,
      drumSamples: drumSamplesForSession,
      multisampleFiles: multisampleFilesForSession,
      selectedMultisample: state.selectedMultisample,
      isDrumKeyboardPinned: state.isDrumKeyboardPinned,
      isMultisampleKeyboardPinned: state.isMultisampleKeyboardPinned,
      savedToLibrary: false, // Track if this session has been saved to library
    };

    // Save session data (this will overwrite any existing session)
    await indexedDB.saveSession(sessionData);
    
    // Update current session reference (keep this in localStorage for quick access)
    localStorage.setItem(CURRENT_SESSION_KEY, SINGLE_SESSION_ID);

    return SINGLE_SESSION_ID;
  }

  // Load session data
  async loadSession(): Promise<SessionData | null> {
    try {
      const sessionData = await indexedDB.getSession(SINGLE_SESSION_ID);
      if (!sessionData) {
        return null;
      }

      // Handle version migration if needed
      const migratedSessionData = this.migrateSessionData(sessionData);

      return migratedSessionData;
    } catch (error) {
      console.error('Failed to load session from IndexedDB:', error);
      return null;
    }
  }

  // Migrate session data to current version
  private migrateSessionData(sessionData: SessionData): SessionData {
    const currentVersion = 1;
    const sessionVersion = sessionData.version || 0;

    if (sessionVersion === currentVersion) {
      return sessionData;
    }

    console.log(`Migrating session from version ${sessionVersion} to ${currentVersion}`);

    // Add migration logic here when needed
    const migratedData = {
      ...sessionData,
      version: currentVersion,
    };

    return migratedData;
  }

  // Get current session ID (always returns the single session ID)
  getCurrentSessionId(): string {
    return SINGLE_SESSION_ID;
  }

  // Check if there's a previous session
  async hasPreviousSession(): Promise<boolean> {
    try {
      const sessionData = await indexedDB.getSession(SINGLE_SESSION_ID);
      if (!sessionData) {
        return false;
      }

      // Check if session has any samples
      const hasDrumSamples = sessionData.drumSamples && sessionData.drumSamples.length > 0;
      const hasMultisampleFiles = sessionData.multisampleFiles && sessionData.multisampleFiles.length > 0;

      return hasDrumSamples || hasMultisampleFiles;
    } catch (error) {
      console.error('Error checking for previous session:', error);
      return false;
    }
  }

  // Get the current session (simplified from getMostRecentSessionWithSamples)
  async getCurrentSession(): Promise<SessionData | null> {
    try {
      const sessionData = await indexedDB.getSession(SINGLE_SESSION_ID);
      if (!sessionData) {
        return null;
      }

      // Check if session has any samples
      const hasDrumSamples = sessionData.drumSamples && sessionData.drumSamples.length > 0;
      const hasMultisampleFiles = sessionData.multisampleFiles && sessionData.multisampleFiles.length > 0;

      if (!hasDrumSamples && !hasMultisampleFiles) {
        return null;
      }

      return sessionData;
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }

  // Clear current session
  async clearCurrentSession(): Promise<void> {
    try {
      // Clear all samples
      await this.clearAllSamples();
      
      // Delete the session
      await indexedDB.deleteSession(SINGLE_SESSION_ID);
      
      // Remove from localStorage
      localStorage.removeItem(CURRENT_SESSION_KEY);
      
    } catch (error) {
      console.error('Failed to clear current session:', error);
    }
  }

  // Clear all session data (for migration to new format)
  async clearAllSessionData(): Promise<void> {
    try {
      // Clear all samples
      await this.clearAllSamples();
      
      // Delete the session
      await indexedDB.deleteSession(SINGLE_SESSION_ID);
      
      // Remove from localStorage
      localStorage.removeItem(CURRENT_SESSION_KEY);
      
    } catch (error) {
      console.error('Failed to clear all session data:', error);
    }
  }

  // Mark session as saved to library
  async markSessionAsSavedToLibrary(): Promise<void> {
    try {
      const sessionData = await indexedDB.getSession(SINGLE_SESSION_ID);
      if (sessionData) {
        sessionData.savedToLibrary = true;
        await indexedDB.saveSession(sessionData);
      }
    } catch (error) {
      console.error('Failed to mark session as saved to library:', error);
    }
  }

  // Reset saved to library flag
  async resetSavedToLibraryFlag(): Promise<void> {
    try {
      const sessionData = await indexedDB.getSession(SINGLE_SESSION_ID);
      if (sessionData) {
        sessionData.savedToLibrary = false;
        await indexedDB.saveSession(sessionData);
      }
    } catch (error) {
      console.error('Failed to reset saved to library flag:', error);
    }
  }

  // Clear all samples (helper method)
  private async clearAllSamples(): Promise<void> {
    try {
      const allSamples = await indexedDB.getAllSamples();
      for (const sample of allSamples) {
        await indexedDB.deleteSample(sample.id);
      }
    } catch (error) {
      console.error('Failed to clear samples:', error);
    }
  }

  // Clear corrupted data (simplified for single session)
  async clearCorruptedData(): Promise<void> {
    try {
      // Check if current session exists and is valid
      const sessionData = await indexedDB.getSession(SINGLE_SESSION_ID);
      if (!sessionData) {
        return;
      }

      // Check for corrupted samples
      const corruptedSampleIds: string[] = [];
      
      // Check drum samples
      for (const storedSample of sessionData.drumSamples || []) {
        try {
          const sampleData = await indexedDB.getSample(storedSample.sampleId);
          if (!sampleData) {
            corruptedSampleIds.push(storedSample.sampleId);
          } else {
            // Try to create a File from the Blob to test if it's corrupted
            try {
              const file = new File([sampleData.data], sampleData.name, { type: sampleData.type });
              await file.arrayBuffer(); // This will throw if the data is corrupted
            } catch (error) {
              corruptedSampleIds.push(storedSample.sampleId);
            }
          }
        } catch (error) {
          corruptedSampleIds.push(storedSample.sampleId);
        }
      }

      // Check multisample files
      for (const storedFile of sessionData.multisampleFiles || []) {
        try {
          const sampleData = await indexedDB.getSample(storedFile.sampleId);
          if (!sampleData) {
            corruptedSampleIds.push(storedFile.sampleId);
          } else {
            // Try to create a File from the Blob to test if it's corrupted
            try {
              const file = new File([sampleData.data], sampleData.name, { type: sampleData.type });
              await file.arrayBuffer(); // This will throw if the data is corrupted
            } catch (error) {
              corruptedSampleIds.push(storedFile.sampleId);
            }
          }
        } catch (error) {
          corruptedSampleIds.push(storedFile.sampleId);
        }
      }

      // Remove corrupted samples from session data
      if (corruptedSampleIds.length > 0) {
        
        // Remove corrupted samples from session data
        if (sessionData.drumSamples) {
          sessionData.drumSamples = sessionData.drumSamples.filter(
            sample => !corruptedSampleIds.includes(sample.sampleId)
          );
        }
        
        if (sessionData.multisampleFiles) {
          sessionData.multisampleFiles = sessionData.multisampleFiles.filter(
            file => !corruptedSampleIds.includes(file.sampleId)
          );
        }

        // Update session data
        await indexedDB.saveSession(sessionData);
      }

      // Delete corrupted samples from samples store
      for (const sampleId of corruptedSampleIds) {
        try {
          await indexedDB.deleteSample(sampleId);
        } catch (error) {
          console.error(`Failed to delete corrupted sample ${sampleId}:`, error);
        }
      }

    } catch (error) {
      console.error('Failed to clear corrupted data:', error);
    }
  }

  // Convert ArrayBuffer to File
  async arrayBufferToFile(arrayBuffer: ArrayBuffer, filename: string, type: string): Promise<File> {
    return new File([arrayBuffer], filename, { type });
  }

  // Convert ArrayBuffer to AudioBuffer
  async arrayBufferToAudioBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    return await audioContext.decodeAudioData(arrayBuffer);
  }

  // Load sample from session
  async loadSampleFromSession(sampleId: string): Promise<{ file: File; audioBuffer: AudioBuffer; metadata: any } | null> {
    try {
      const sampleData = await indexedDB.getSample(sampleId);
      if (!sampleData) {
        return null;
      }

      let audioBuffer: AudioBuffer;
      let file: File;

      if (sampleData.data.type === 'application/json') {
        // Load from stored AudioBuffer data
        const arrayBuffer = await sampleData.data.arrayBuffer();
        const text = new TextDecoder().decode(arrayBuffer);
        const audioData = JSON.parse(text);
        
        // Reconstruct AudioBuffer
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioBuffer = audioContext.createBuffer(
          audioData.numberOfChannels,
          audioData.length,
          audioData.sampleRate
        );
        
        // Copy channel data back to AudioBuffer
        for (let channel = 0; channel < audioData.numberOfChannels; channel++) {
          const channelData = audioBuffer.getChannelData(channel);
          const storedChannelData = audioData.channelData[channel];
          channelData.set(storedChannelData);
        }
        
        // Create a dummy file for compatibility
        file = new File([], sampleData.name, { type: sampleData.type });
        
      } else {
        // Legacy: try to load from raw file data (for backward compatibility)
        const arrayBuffer = await sampleData.data.arrayBuffer();
        file = await this.arrayBufferToFile(arrayBuffer, sampleData.name, sampleData.type);
        audioBuffer = await this.arrayBufferToAudioBuffer(arrayBuffer);
      }

      return {
        file,
        audioBuffer,
        metadata: {
          ...sampleData.metadata,
          fileSize: sampleData.size
        }
      };
    } catch (error) {
      console.error('Failed to load sample from session:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }
}

// Export singleton instance
export const sessionStorageIndexedDB = SessionStorageManagerIndexedDB.getInstance(); 