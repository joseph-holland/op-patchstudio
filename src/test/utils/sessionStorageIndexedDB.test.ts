import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sessionStorageIndexedDB } from '../../utils/sessionStorageIndexedDB';
import { createCompleteMultisampleSettings } from './testHelpers';

// Mock IDBTransaction with proper objectStore method
class MockIDBTransaction {
  objectStoreInstance: MockIDBObjectStore;
  
  constructor(storeName: string) {
    this.objectStoreInstance = new MockIDBObjectStore(storeName);
  }
  
  objectStore(_storeName: string) {
    return this.objectStoreInstance;
  }
}

// Mock IDBDatabase with proper transaction method
class MockIDBDatabase {
  transaction(storeName: string) {
    return new MockIDBTransaction(storeName);
  }
}

// Create mock database instance
const mockDb = new MockIDBDatabase();

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn().mockResolvedValue(mockDb),
  deleteDatabase: vi.fn().mockResolvedValue(undefined)
};

// Mock the global indexedDB
Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB,
  writable: true
});

// Mock the IDBRequest
class MockIDBRequest {
  result: any;
  error: any;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  
  constructor(result?: any) {
    this.result = result;
  }
  
  triggerSuccess() {
    if (this.onsuccess) this.onsuccess();
  }
  
  triggerError() {
    if (this.onerror) this.onerror();
  }
}

// Mock the IDBObjectStore
class MockIDBObjectStore {
  name: string;
  data: Map<string, any>;
  
  constructor(name: string) {
    this.name = name;
    this.data = new Map();
  }
  
  put(value: any, key?: string) {
    const request = new MockIDBRequest();
    this.data.set(key || value.id, value);
    setTimeout(() => request.triggerSuccess(), 0);
    return request;
  }
  
  get(key: string) {
    const request = new MockIDBRequest(this.data.get(key));
    setTimeout(() => request.triggerSuccess(), 0);
    return request;
  }
  
  delete(key: string) {
    const request = new MockIDBRequest();
    this.data.delete(key);
    setTimeout(() => request.triggerSuccess(), 0);
    return request;
  }
  
  getAll() {
    const request = new MockIDBRequest(Array.from(this.data.values()));
    setTimeout(() => request.triggerSuccess(), 0);
    return request;
  }
}

describe('sessionStorageIndexedDB', () => {
  let mockDatabase: MockIDBDatabase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDatabase = new MockIDBDatabase();
    
    // Mock the database opening
    const mockRequest = new MockIDBRequest(mockDatabase);
    mockIndexedDB.open.mockReturnValue(mockRequest);
    
    // Mock the database connection
    setTimeout(() => mockRequest.triggerSuccess(), 0);
  });

  describe('saveSession', () => {
    it('should save session data to IndexedDB', async () => {
      const mockState = {
        currentTab: 'drum' as const,
        drumSamples: [],
        multisampleFiles: [],
        selectedMultisample: null,
        isLoading: false,
        error: null,
        isDrumKeyboardPinned: false,
        isMultisampleKeyboardPinned: false,
        notifications: [],
        importedDrumPreset: null,
        importedMultisamplePreset: null,
        isSessionRestorationModalOpen: false,
        sessionInfo: null,
        midiNoteMapping: 'C3' as const,
        drumSettings: {
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          presetName: '',
          normalize: false,
          normalizeLevel: 0,
          presetSettings: {
            playmode: 'poly' as const,
            transpose: 0,
            velocity: 100,
            volume: 100,
            width: 100
          },
          renameFiles: false,
          filenameSeparator: ' ' as const
        },
        multisampleSettings: createCompleteMultisampleSettings()
      };

      const result = await sessionStorageIndexedDB.saveSession(mockState);

      expect(result).toBe('current-session');
    });
  });
}); 