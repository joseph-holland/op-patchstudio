import { v4 as uuidv4 } from 'uuid';
import type { AppState } from '../context/AppContext';

export interface SessionData {
  sessionId: string;
  timestamp: number;
  drumSettings: AppState['drumSettings'];
  multisampleSettings: AppState['multisampleSettings'];
  drumSamples: Array<{
    originalIndex: number; // Store the original index in the drum samples array
    name: string;
    data: string; // base64 encoded audio data
    type: string;
    size: number;
    settings: {
      inPoint: number;
      outPoint: number;
      playmode: 'oneshot' | 'group' | 'loop' | 'gate';
      reverse: boolean;
      transpose: number;
      pan: number;
      gain: number;
      hasBeenEdited: boolean;
    };
  }>;
  multisampleFiles: Array<{
    name: string;
    data: string; // base64 encoded audio data
    type: string;
    size: number;
    rootNote: number;
    note?: string;
    inPoint: number;
    outPoint: number;
    loopStart: number;
    loopEnd: number;
  }>;
  selectedMultisample: number | null;
  isDrumKeyboardPinned: boolean;
  isMultisampleKeyboardPinned: boolean;
}

const SESSION_STORAGE_KEY = 'op-patchstudio-sessions';
const CURRENT_SESSION_KEY = 'op-patchstudio-current-session';

export class SessionStorageManager {
  private static instance: SessionStorageManager;
  
  private constructor() {}
  
  static getInstance(): SessionStorageManager {
    if (!SessionStorageManager.instance) {
      SessionStorageManager.instance = new SessionStorageManager();
    }
    return SessionStorageManager.instance;
  }

  // Generate a new session ID
  generateSessionId(): string {
    return uuidv4();
  }

  // Save current session data
  async saveSession(state: AppState): Promise<string> {
    const sessionId = this.generateSessionId();
    const timestamp = Date.now();

    // Convert samples to storable format
    const drumSamples = await this.convertDrumSamplesToStorable(state.drumSamples);
    const multisampleFiles = await this.convertMultisampleFilesToStorable(state.multisampleFiles);

    const sessionData: SessionData = {
      sessionId,
      timestamp,
      drumSettings: state.drumSettings,
      multisampleSettings: state.multisampleSettings,
      drumSamples,
      multisampleFiles,
      selectedMultisample: state.selectedMultisample,
      isDrumKeyboardPinned: state.isDrumKeyboardPinned,
      isMultisampleKeyboardPinned: state.isMultisampleKeyboardPinned,
    };



    // Save session data
    localStorage.setItem(`${SESSION_STORAGE_KEY}/${sessionId}`, JSON.stringify(sessionData));
    
    // Update current session reference
    localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
    
    // Update sessions list
    this.updateSessionsList(sessionId, timestamp);

    return sessionId;
  }



  // Load session data
  async loadSession(sessionId: string): Promise<SessionData | null> {
    try {
      const sessionData = localStorage.getItem(`${SESSION_STORAGE_KEY}/${sessionId}`);
      if (!sessionData) return null;

      const parsedData = JSON.parse(sessionData) as SessionData;
      


      return parsedData;
    } catch (error) {
      console.error('Failed to load session:', error);
      return null;
    }
  }

  // Get current session ID
  getCurrentSessionId(): string | null {
    return localStorage.getItem(CURRENT_SESSION_KEY);
  }

  // Check if there's a previous session
  hasPreviousSession(): boolean {
    const currentSessionId = this.getCurrentSessionId();
    if (!currentSessionId) return false;

    const sessionData = localStorage.getItem(`${SESSION_STORAGE_KEY}/${currentSessionId}`);
    return !!sessionData;
  }

  // Get sessions list
  getSessionsList(): Array<{ sessionId: string; timestamp: number; name: string }> {
    try {
      const sessionsList = localStorage.getItem(`${SESSION_STORAGE_KEY}/list`);
      return sessionsList ? JSON.parse(sessionsList) : [];
    } catch (error) {
      console.error('Failed to get sessions list:', error);
      return [];
    }
  }

  // Clear current session
  clearCurrentSession(): void {
    const currentSessionId = this.getCurrentSessionId();
    if (currentSessionId) {
      localStorage.removeItem(`${SESSION_STORAGE_KEY}/${currentSessionId}`);
      localStorage.removeItem(CURRENT_SESSION_KEY);
      this.removeFromSessionsList(currentSessionId);
    }
  }

  // Delete a specific session
  deleteSession(sessionId: string): void {
    localStorage.removeItem(`${SESSION_STORAGE_KEY}/${sessionId}`);
    this.removeFromSessionsList(sessionId);
    
    // If this was the current session, clear the current session reference
    if (this.getCurrentSessionId() === sessionId) {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }
  }

  // Convert drum samples to storable format
  private async convertDrumSamplesToStorable(samples: AppState['drumSamples']): Promise<SessionData['drumSamples']> {
    const storableSamples: SessionData['drumSamples'] = [];
    
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      
      // Only store samples that have been explicitly loaded
      if (sample.isLoaded && sample.file && sample.audioBuffer) {
        // Convert File to base64
        const base64Data = await this.fileToBase64(sample.file);
        
        storableSamples.push({
          originalIndex: i,
          name: sample.file.name,
          data: base64Data,
          type: sample.file.type,
          size: sample.file.size,
          settings: {
            inPoint: sample.inPoint,
            outPoint: sample.outPoint,
            playmode: sample.playmode,
            reverse: sample.reverse,
            transpose: sample.transpose,
            pan: sample.pan,
            gain: sample.gain,
            hasBeenEdited: sample.hasBeenEdited,
          }
        });
      }
    }

    return storableSamples;
  }

  // Convert multisample files to storable format
  private async convertMultisampleFilesToStorable(files: AppState['multisampleFiles']): Promise<SessionData['multisampleFiles']> {
    const storableFiles: SessionData['multisampleFiles'] = [];
    
    for (const file of files) {
      if (!file.file || !file.audioBuffer) {
        continue;
      }

      // Convert File to base64
      const base64Data = await this.fileToBase64(file.file);
      
      storableFiles.push({
        name: file.file.name,
        data: base64Data,
        type: file.file.type,
        size: file.file.size,
        rootNote: file.rootNote,
        note: file.note,
        inPoint: file.inPoint,
        outPoint: file.outPoint,
        loopStart: file.loopStart,
        loopEnd: file.loopEnd,
      });
    }

    return storableFiles;
  }

  // Convert File to base64
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Convert base64 to File
  async base64ToFile(base64: string, filename: string, type: string): Promise<File> {
    try {
      // Validate base64 string
      if (!base64 || typeof base64 !== 'string' || base64.length === 0) {
        console.error('Base64 validation failed:', {
          base64,
          type: typeof base64,
          length: base64?.length,
          isNull: base64 === null,
          isUndefined: base64 === undefined,
          isEmpty: base64 === ''
        });
        throw new Error('Invalid base64 data: not a string or empty');
      }
      
      // Check if it's a valid base64 string
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
        console.error('Base64 format validation failed:', {
          base64: base64.substring(0, 50),
          length: base64.length
        });
        throw new Error('Invalid base64 data: contains invalid characters');
      }
      
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type });
      
      return new File([blob], filename, { type });
    } catch (error) {
      console.error('Failed to convert base64 to File:', error);
      console.error('Base64 data length:', base64?.length);
      console.error('Base64 data preview:', base64?.substring(0, 100));
      throw error;
    }
  }

  // Convert base64 to AudioBuffer
  async base64ToAudioBuffer(base64: string): Promise<AudioBuffer> {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const arrayBuffer = byteArray.buffer;
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    return await audioContext.decodeAudioData(arrayBuffer);
  }

  // Update sessions list
  private updateSessionsList(sessionId: string, timestamp: number): void {
    const sessions = this.getSessionsList();
    const sessionName = `session ${new Date(timestamp).toLocaleString()}`;
    
    // Remove existing entry if it exists
    const filteredSessions = sessions.filter(s => s.sessionId !== sessionId);
    
    // Add new entry at the beginning
    const updatedSessions = [
      { sessionId, timestamp, name: sessionName },
      ...filteredSessions
    ];
    
    // Keep only the last 10 sessions
    const limitedSessions = updatedSessions.slice(0, 10);
    
    localStorage.setItem(`${SESSION_STORAGE_KEY}/list`, JSON.stringify(limitedSessions));
  }

  // Remove from sessions list
  private removeFromSessionsList(sessionId: string): void {
    const sessions = this.getSessionsList();
    const filteredSessions = sessions.filter(s => s.sessionId !== sessionId);
    localStorage.setItem(`${SESSION_STORAGE_KEY}/list`, JSON.stringify(filteredSessions));
  }
}

export const sessionStorage = SessionStorageManager.getInstance(); 