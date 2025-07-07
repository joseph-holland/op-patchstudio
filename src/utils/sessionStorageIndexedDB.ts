import { v4 as uuidv4 } from 'uuid';
import type { AppState } from '../context/AppContext';
import { indexedDB, type SessionData, type SampleData } from './indexedDB';
import { readWavMetadata } from './audio';

// Constants
const CURRENT_SESSION_KEY = 'op-patchstudio-current-session';

export class SessionStorageManagerIndexedDB {
  private static instance: SessionStorageManagerIndexedDB;

  private constructor() {}

  static getInstance(): SessionStorageManagerIndexedDB {
    if (!SessionStorageManagerIndexedDB.instance) {
      SessionStorageManagerIndexedDB.instance = new SessionStorageManagerIndexedDB();
    }
    return SessionStorageManagerIndexedDB.instance;
  }

  // Generate unique session ID
  generateSessionId(): string {
    return uuidv4();
  }

  // Save current session data
  async saveSession(state: AppState): Promise<string> {
    const sessionId = this.generateSessionId();
    const timestamp = Date.now();

    // First, save all samples to the samples store
    const sampleIds = new Map<string, string>(); // file name -> sample id
    
    // Save drum samples
    for (let i = 0; i < state.drumSamples.length; i++) {
      const sample = state.drumSamples[i];
      
      if (sample && sample.isLoaded && sample.file && sample.audioBuffer) {
        const sampleId = uuidv4();
        sampleIds.set(sample.file.name, sampleId);
        
        // Convert File to ArrayBuffer
        const arrayBuffer = await this.fileToArrayBuffer(sample.file);
        
        const sampleData: SampleData = {
          id: sampleId,
          name: sample.file.name,
          type: sample.file.type,
          size: sample.file.size,
          data: arrayBuffer,
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
    for (const file of state.multisampleFiles) {
      if (file.file && file.audioBuffer) {
        const sampleId = uuidv4();
        sampleIds.set(file.file.name, sampleId);
        
        // Convert File to ArrayBuffer
        const arrayBuffer = await this.fileToArrayBuffer(file.file);
        
        const sampleData: SampleData = {
          id: sampleId,
          name: file.file.name,
          type: file.file.type,
          size: file.file.size,
          data: arrayBuffer,
          metadata: {
            sampleRate: file.audioBuffer.sampleRate,
            bitDepth: file.originalBitDepth || 16,
            channels: file.audioBuffer.numberOfChannels,
            duration: file.audioBuffer.duration,
            midiNote: file.rootNote,
            note: file.note,
          },
          createdAt: timestamp,
        };
        
        await indexedDB.saveSample(sampleData);
      }
    }

    // Create session data with references to samples
    const sessionData: SessionData = {
      id: sessionId,
      timestamp,
      drumSettings: state.drumSettings,
      multisampleSettings: state.multisampleSettings,
      drumSamples: state.drumSamples
        .map((sample, index) => {
          if (sample && sample.isLoaded && sample.file) {
            const sampleId = sampleIds.get(sample.file!.name);
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
        .filter(Boolean) as SessionData['drumSamples'],
      multisampleFiles: state.multisampleFiles
        .map(file => {
          if (file.file) {
            const sampleId = sampleIds.get(file.file!.name);
            if (sampleId) {
              return {
                sampleId,
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
        .filter(Boolean) as SessionData['multisampleFiles'],
      selectedMultisample: state.selectedMultisample,
      isDrumKeyboardPinned: state.isDrumKeyboardPinned,
      isMultisampleKeyboardPinned: state.isMultisampleKeyboardPinned,
    };

    // Save session data
    await indexedDB.saveSession(sessionData);
    
    // Update current session reference (keep this in localStorage for quick access)
    localStorage.setItem(CURRENT_SESSION_KEY, sessionId);

    return sessionId;
  }

  // Load session data
  async loadSession(sessionId: string): Promise<SessionData | null> {
    try {
      const sessionData = await indexedDB.getSession(sessionId);
      if (!sessionData) return null;

      return sessionData;
    } catch (error) {
      console.error('Failed to load session from IndexedDB:', error);
      return null;
    }
  }

  // Get current session ID
  getCurrentSessionId(): string | null {
    return localStorage.getItem(CURRENT_SESSION_KEY);
  }

  // Check if there's a previous session
  async hasPreviousSession(): Promise<boolean> {
    const currentSessionId = this.getCurrentSessionId();
    if (!currentSessionId) return false;

    const sessionData = await indexedDB.getSession(currentSessionId);
    return !!sessionData;
  }

  // Get sessions list
  async getSessionsList(): Promise<Array<{ sessionId: string; timestamp: number; name?: string }>> {
    try {
      const sessions = await indexedDB.getAllSessions();
      return sessions.map(session => ({
        sessionId: session.id,
        timestamp: session.timestamp,
        name: session.name
      }));
    } catch (error) {
      console.error('Failed to get sessions list:', error);
      return [];
    }
  }

  // Clear current session
  async clearCurrentSession(): Promise<void> {
    const currentSessionId = this.getCurrentSessionId();
    if (currentSessionId) {
      await indexedDB.deleteSession(currentSessionId);
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }
  }

  // Delete a specific session
  async deleteSession(sessionId: string): Promise<void> {
    await indexedDB.deleteSession(sessionId);
    
    // If this was the current session, clear the current session reference
    if (this.getCurrentSessionId() === sessionId) {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }
  }

  // Convert File to ArrayBuffer
  private async fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as ArrayBuffer;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // Convert ArrayBuffer to File
  async arrayBufferToFile(arrayBuffer: ArrayBuffer, filename: string, type: string): Promise<File> {
    const blob = new Blob([arrayBuffer], { type });
    return new File([blob], filename, { type });
  }

  // Convert ArrayBuffer to AudioBuffer
  async arrayBufferToAudioBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    return await audioContext.decodeAudioData(arrayBuffer);
  }

  // Load sample from IndexedDB
  async loadSampleFromSession(sampleId: string): Promise<{ file: File; audioBuffer: AudioBuffer; metadata: any } | null> {
    try {
      const sampleData = await indexedDB.getSample(sampleId);
      if (!sampleData) return null;

      // Convert ArrayBuffer back to File and AudioBuffer
      const file = await this.arrayBufferToFile(sampleData.data, sampleData.name, sampleData.type);
      const audioBuffer = await this.arrayBufferToAudioBuffer(sampleData.data);
      
      // Parse WAV metadata
      const metadata = await readWavMetadata(file);
      
      return { file, audioBuffer, metadata };
    } catch (error) {
      console.error('Failed to load sample from IndexedDB:', error);
      return null;
    }
  }
}

// Export singleton instance
export const sessionStorageIndexedDB = SessionStorageManagerIndexedDB.getInstance(); 