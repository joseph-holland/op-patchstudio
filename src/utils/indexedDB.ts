import type { AppState } from '../context/AppContext';

// Database configuration
const DB_NAME = 'op-patchstudio-db';
const DB_VERSION = 1;

// Store names
export const STORES = {
  SESSIONS: 'sessions',
  SAMPLES: 'samples',
  PRESETS: 'presets', // Future use
  METADATA: 'metadata' // Future use
} as const;

// Database schema interfaces
export interface SessionData {
  id: string;
  timestamp: number;
  name?: string;
  drumSettings: AppState['drumSettings'];
  multisampleSettings: AppState['multisampleSettings'];
  drumSamples: Array<{
    originalIndex: number;
    sampleId: string; // Reference to samples store
    settings: {
      inPoint: number;
      outPoint: number;
      playmode: 'oneshot' | 'group' | 'loop' | 'gate';
      reverse: boolean;
      tune: number;
      pan: number;
      gain: number;
      hasBeenEdited: boolean;
    };
  }>;
  multisampleFiles: Array<{
    sampleId: string; // Reference to samples store
    fileName: string; // File name for matching during restoration
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

export interface SampleData {
  id: string;
  name: string;
  type: string;
  size: number;
  data: ArrayBuffer; // Raw audio data
  metadata: {
    sampleRate: number;
    bitDepth: number;
    channels: number;
    duration: number;
    midiNote?: number;
    note?: string;
  };
  createdAt: number;
  tags?: string[]; // Future: for organizing samples
}

export interface PresetData {
  id: string;
  name: string;
  type: 'drum' | 'multisample';
  data: any; // Preset-specific data
  createdAt: number;
  updatedAt: number;
  isFavorite?: boolean;
  tags?: string[];
  description?: string;
  sampleCount?: number; // Number of samples in the preset
}

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private static instance: IndexedDBManager;

  private constructor() {}

  static getInstance(): IndexedDBManager {
    if (!IndexedDBManager.instance) {
      IndexedDBManager.instance = new IndexedDBManager();
    }
    return IndexedDBManager.instance;
  }

  // Initialize database
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create sessions store
        if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
          const sessionsStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
          sessionsStore.createIndex('timestamp', 'timestamp', { unique: false });
          sessionsStore.createIndex('name', 'name', { unique: false });
        }

        // Create samples store
        if (!db.objectStoreNames.contains(STORES.SAMPLES)) {
          const samplesStore = db.createObjectStore(STORES.SAMPLES, { keyPath: 'id' });
          samplesStore.createIndex('name', 'name', { unique: false });
          samplesStore.createIndex('type', 'type', { unique: false });
          samplesStore.createIndex('createdAt', 'createdAt', { unique: false });
          samplesStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }

        // Create presets store (future use)
        if (!db.objectStoreNames.contains(STORES.PRESETS)) {
          const presetsStore = db.createObjectStore(STORES.PRESETS, { keyPath: 'id' });
          presetsStore.createIndex('name', 'name', { unique: false });
          presetsStore.createIndex('type', 'type', { unique: false });
          presetsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Create metadata store (future use)
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
        }

        console.log('IndexedDB schema created/updated');
      };
    });
  }

  // Ensure database is initialized
  private async ensureInit(): Promise<void> {
    if (!this.db) {
      await this.init();
    }
  }

  // Generic CRUD operations
  async add<T>(storeName: string, data: T): Promise<void> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(storeName: string, id: string): Promise<T | null> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async update<T>(storeName: string, data: T): Promise<void> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex<T>(storeName: string, indexName: string, value: any): Promise<T[]> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Session-specific operations
  async saveSession(sessionData: SessionData): Promise<void> {
    await this.update(STORES.SESSIONS, sessionData);
  }

  async getSession(id: string): Promise<SessionData | null> {
    return this.get<SessionData>(STORES.SESSIONS, id);
  }

  async getAllSessions(): Promise<SessionData[]> {
    return this.getAll<SessionData>(STORES.SESSIONS);
  }

  async deleteSession(id: string): Promise<void> {
    await this.delete(STORES.SESSIONS, id);
  }

  // Sample-specific operations
  async saveSample(sampleData: SampleData): Promise<void> {
    await this.update(STORES.SAMPLES, sampleData);
  }

  async getSample(id: string): Promise<SampleData | null> {
    return this.get<SampleData>(STORES.SAMPLES, id);
  }

  async getAllSamples(): Promise<SampleData[]> {
    return this.getAll<SampleData>(STORES.SAMPLES);
  }

  async deleteSample(id: string): Promise<void> {
    await this.delete(STORES.SAMPLES, id);
  }

  async getSamplesByType(type: string): Promise<SampleData[]> {
    return this.getByIndex<SampleData>(STORES.SAMPLES, 'type', type);
  }

  // Preset-specific operations
  async savePreset(presetData: PresetData): Promise<void> {
    await this.update(STORES.PRESETS, presetData);
  }

  async getPreset(id: string): Promise<PresetData | null> {
    return this.get<PresetData>(STORES.PRESETS, id);
  }

  async getAllPresets(): Promise<PresetData[]> {
    return this.getAll<PresetData>(STORES.PRESETS);
  }

  async deletePreset(id: string): Promise<void> {
    await this.delete(STORES.PRESETS, id);
  }

  async getPresetsByType(type: 'drum' | 'multisample'): Promise<PresetData[]> {
    return this.getByIndex<PresetData>(STORES.PRESETS, 'type', type);
  }

  // Utility methods
  async clearAll(): Promise<void> {
    await this.ensureInit();
    const stores = Object.values(STORES);
    
    for (const storeName of stores) {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  async getDatabaseSize(): Promise<number> {
    // Note: This is an approximation as IndexedDB doesn't provide exact size
    const sessions = await this.getAllSessions();
    const samples = await this.getAllSamples();
    
    let totalSize = 0;
    
    // Estimate session size
    sessions.forEach(session => {
      totalSize += JSON.stringify(session).length;
    });
    
    // Add sample sizes
    samples.forEach(sample => {
      totalSize += sample.data.byteLength;
      totalSize += JSON.stringify(sample.metadata).length;
    });
    
    return totalSize;
  }
}

// Export singleton instance
export const indexedDB = IndexedDBManager.getInstance(); 