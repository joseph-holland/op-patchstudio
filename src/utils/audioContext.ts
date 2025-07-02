// Singleton AudioContext manager to prevent memory leaks and handle browser limitations
class AudioContextManager {
  private static instance: AudioContextManager;
  private audioContext: AudioContext | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager();
    }
    return AudioContextManager.instance;
  }

  public async getAudioContext(): Promise<AudioContext> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext();
      this.isInitialized = true;
    }

    // Handle suspended state (common in browsers due to autoplay policies)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    return this.audioContext;
  }

  public async closeAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
      this.isInitialized = false;
    }
  }

  public getState(): AudioContextState | null {
    return this.audioContext?.state || null;
  }

  public getSampleRate(): number {
    return this.audioContext?.sampleRate || 44100;
  }

  public isReady(): boolean {
    return this.isInitialized && this.audioContext?.state === 'running';
  }

  // Create offline context for rendering
  public createOfflineContext(
    numberOfChannels: number,
    length: number,
    sampleRate: number
  ): OfflineAudioContext {
    return new OfflineAudioContext(numberOfChannels, length, sampleRate);
  }

  // Cleanup method for app shutdown
  public cleanup(): Promise<void> {
    return this.closeAudioContext();
  }
}

// Export singleton instance
export const audioContextManager = AudioContextManager.getInstance();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    audioContextManager.cleanup();
  });
}