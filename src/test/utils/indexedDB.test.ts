import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { indexedDB, STORES, type SessionData, type SampleData, type PresetData } from '../../utils/indexedDB';

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

// Mock IDBDatabase
const mockDatabase = {
  objectStoreNames: {
    contains: vi.fn(),
  },
  createObjectStore: vi.fn(() => ({
    createIndex: vi.fn(),
  })),
  transaction: vi.fn(),
  close: vi.fn(),
};

// Mock IDBTransaction
const mockTransaction = {
  objectStore: vi.fn(),
  oncomplete: null,
  onerror: null,
};

// Mock IDBObjectStore
const mockObjectStore = {
  add: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(),
  clear: vi.fn(),
  index: vi.fn(() => ({
    getAll: vi.fn(),
  })),
};

// Mock IDBRequest
const createMockRequest = (result?: any, error?: any) => {
  const request = {
    result,
    error,
    onsuccess: null as any,
    onerror: null as any,
    oncomplete: null as any,
    onupgradeneeded: null as any,
  };

  // Simulate IndexedDB's asynchronous behavior
  setTimeout(() => {
    if (error && request.onerror) {
      request.onerror({ target: request });
    } else if (request.onsuccess) {
      request.onsuccess({ target: request });
    }
    if (request.oncomplete) {
      request.oncomplete({ target: request });
    }
  }, 0);

  return request;
};

// Mock IDBOpenDBRequest for database initialization
const createMockOpenRequest = (database?: any, error?: any, shouldUpgrade = false) => {
  const request = {
    result: database,
    error,
    onsuccess: null as any,
    onerror: null as any,
    onupgradeneeded: null as any,
  };

  // Simulate IndexedDB's asynchronous behavior
  setTimeout(() => {
    if (error && request.onerror) {
      request.onerror({ target: request });
    } else if (shouldUpgrade && request.onupgradeneeded) {
      // Trigger upgrade event and call createObjectStore on the database
      request.onupgradeneeded({ 
        target: request,
        oldVersion: 0,
        newVersion: 1
      } as unknown as IDBVersionChangeEvent);
      if (database && database.createObjectStore) {
        database.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
        database.createObjectStore(STORES.SAMPLES, { keyPath: 'id' });
        database.createObjectStore(STORES.PRESETS, { keyPath: 'id' });
        database.createObjectStore(STORES.METADATA, { keyPath: 'key' });
      }
      // After upgrade, call onsuccess to resolve the open request
      setTimeout(() => {
        if (request.onsuccess) {
          request.onsuccess({ target: request });
        }
      }, 0);
    } else if (request.onsuccess) {
      request.onsuccess({ target: request });
    }
  }, 0);

  return request;
};

describe('IndexedDB Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup global IndexedDB mock
    global.indexedDB = mockIndexedDB as any;
    
    // Reset all mocks
    Object.values(mockIndexedDB).forEach(mock => {
      if (mock && typeof mock === 'object' && 'mockClear' in mock) {
        (mock as any).mockClear();
      }
    });
    Object.values(mockDatabase).forEach(mock => {
      if (mock && typeof mock === 'object' && 'mockClear' in mock) {
        (mock as any).mockClear();
      }
    });
    Object.values(mockTransaction).forEach(mock => {
      if (mock && typeof mock === 'object' && 'mockClear' in mock) {
        (mock as any).mockClear();
      }
    });
    Object.values(mockObjectStore).forEach(mock => {
      if (mock && typeof mock === 'object' && 'mockClear' in mock) {
        (mock as any).mockClear();
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Database Initialization', () => {
    it('should initialize database successfully', async () => {
      const mockRequest = createMockOpenRequest(mockDatabase);
      mockIndexedDB.open.mockReturnValue(mockRequest);
      
      await indexedDB.init();
      
      expect(mockIndexedDB.open).toHaveBeenCalledWith('op-patchstudio-db', 1);
    });

    it('should handle database initialization failure', async () => {
      const mockRequest = createMockOpenRequest(null, new Error('Database error'));
      mockIndexedDB.open.mockReturnValue(mockRequest);
      
      await expect(indexedDB.init()).rejects.toThrow('Database error');
    });

    it('should create object stores on upgrade', async () => {
      // Mock the database to simulate an upgrade scenario
      const mockRequest = createMockOpenRequest(mockDatabase, null, true);
      mockIndexedDB.open.mockReturnValue(mockRequest);
      
      await indexedDB.init();
      
      expect(mockIndexedDB.open).toHaveBeenCalledWith('op-patchstudio-db', 1);
      // Verify that the upgrade event would create the stores
      expect(mockDatabase.createObjectStore).toHaveBeenCalledWith(STORES.SESSIONS, { keyPath: 'id' });
      expect(mockDatabase.createObjectStore).toHaveBeenCalledWith(STORES.SAMPLES, { keyPath: 'id' });
      expect(mockDatabase.createObjectStore).toHaveBeenCalledWith(STORES.PRESETS, { keyPath: 'id' });
      expect(mockDatabase.createObjectStore).toHaveBeenCalledWith(STORES.METADATA, { keyPath: 'key' });
    });
  });

  describe('Generic CRUD Operations', () => {
    beforeEach(() => {
      // Setup successful database connection
      const mockRequest = createMockOpenRequest(mockDatabase);
      mockIndexedDB.open.mockReturnValue(mockRequest);
      mockDatabase.transaction.mockReturnValue(mockTransaction);
      mockTransaction.objectStore.mockReturnValue(mockObjectStore);
    });

    describe('Add Operation', () => {
      it('should add data successfully', async () => {
        const testData = { id: 'test-1', name: 'Test Item' };
        const mockRequest = createMockRequest();
        mockObjectStore.add.mockReturnValue(mockRequest);
        
        await indexedDB.add('test-store', testData);
        
        expect(mockDatabase.transaction).toHaveBeenCalledWith(['test-store'], 'readwrite');
        expect(mockObjectStore.add).toHaveBeenCalledWith(testData);
      });

      it('should handle add operation failure', async () => {
        const testData = { id: 'test-1', name: 'Test Item' };
        const mockRequest = createMockRequest(null, new Error('Add failed'));
        mockObjectStore.add.mockReturnValue(mockRequest);
        
        await expect(indexedDB.add('test-store', testData)).rejects.toThrow('Add failed');
      });
    });

    describe('Get Operation', () => {
      it('should get data successfully', async () => {
        const testData = { id: 'test-1', name: 'Test Item' };
        const mockRequest = createMockRequest(testData);
        mockObjectStore.get.mockReturnValue(mockRequest);
        
        const result = await indexedDB.get('test-store', 'test-1');
        
        expect(result).toEqual(testData);
        expect(mockObjectStore.get).toHaveBeenCalledWith('test-1');
      });

      it('should return null when item not found', async () => {
        const mockRequest = createMockRequest(undefined);
        mockObjectStore.get.mockReturnValue(mockRequest);
        
        const result = await indexedDB.get('test-store', 'nonexistent');
        
        expect(result).toBeNull();
      });

      it('should handle get operation failure', async () => {
        const mockRequest = createMockRequest(null, new Error('Get failed'));
        mockObjectStore.get.mockReturnValue(mockRequest);
        
        await expect(indexedDB.get('test-store', 'test-1')).rejects.toThrow('Get failed');
      });
    });

    describe('Update Operation', () => {
      it('should update data successfully', async () => {
        const testData = { id: 'test-1', name: 'Updated Item' };
        const mockRequest = createMockRequest();
        mockObjectStore.put.mockReturnValue(mockRequest);
        
        await indexedDB.update('test-store', testData);
        
        expect(mockObjectStore.put).toHaveBeenCalledWith(testData);
      });

      it('should handle update operation failure', async () => {
        const testData = { id: 'test-1', name: 'Updated Item' };
        const mockRequest = createMockRequest(null, new Error('Update failed'));
        mockObjectStore.put.mockReturnValue(mockRequest);
        
        await expect(indexedDB.update('test-store', testData)).rejects.toThrow('Update failed');
      });
    });

    describe('Delete Operation', () => {
      it('should delete data successfully', async () => {
        const mockRequest = createMockRequest();
        mockObjectStore.delete.mockReturnValue(mockRequest);
        
        await indexedDB.delete('test-store', 'test-1');
        
        expect(mockObjectStore.delete).toHaveBeenCalledWith('test-1');
      });

      it('should handle delete operation failure', async () => {
        const mockRequest = createMockRequest(null, new Error('Delete failed'));
        mockObjectStore.delete.mockReturnValue(mockRequest);
        
        await expect(indexedDB.delete('test-store', 'test-1')).rejects.toThrow('Delete failed');
      });
    });

    describe('Get All Operation', () => {
      it('should get all data successfully', async () => {
        const testData = [
          { id: 'test-1', name: 'Item 1' },
          { id: 'test-2', name: 'Item 2' }
        ];
        const mockRequest = createMockRequest(testData);
        mockObjectStore.getAll.mockReturnValue(mockRequest);
        
        const result = await indexedDB.getAll('test-store');
        
        expect(result).toEqual(testData);
      });

      it('should handle get all operation failure', async () => {
        const mockRequest = createMockRequest(null, new Error('Get all failed'));
        mockObjectStore.getAll.mockReturnValue(mockRequest);
        
        await expect(indexedDB.getAll('test-store')).rejects.toThrow('Get all failed');
      });
    });

    describe('Get By Index Operation', () => {
      it('should get data by index successfully', async () => {
        const testData = [
          { id: 'test-1', type: 'drum', name: 'Drum Kit' },
          { id: 'test-2', type: 'drum', name: 'Another Kit' }
        ];
        const mockIndex = { getAll: vi.fn() };
        const mockRequest = createMockRequest(testData);
        mockObjectStore.index.mockReturnValue(mockIndex);
        mockIndex.getAll.mockReturnValue(mockRequest);
        
        const result = await indexedDB.getByIndex('test-store', 'type', 'drum');
        
        expect(result).toEqual(testData);
        expect(mockObjectStore.index).toHaveBeenCalledWith('type');
        expect(mockIndex.getAll).toHaveBeenCalledWith('drum');
      });

      it('should handle index query failure', async () => {
        const mockIndex = { getAll: vi.fn() };
        const mockRequest = createMockRequest(null, new Error('Index query failed'));
        mockObjectStore.index.mockReturnValue(mockIndex);
        mockIndex.getAll.mockReturnValue(mockRequest);
        
        await expect(indexedDB.getByIndex('test-store', 'type', 'drum')).rejects.toThrow('Index query failed');
      });
    });
  });

  describe('Session Operations', () => {
    beforeEach(() => {
      const mockRequest = createMockOpenRequest(mockDatabase);
      mockIndexedDB.open.mockReturnValue(mockRequest);
      mockDatabase.transaction.mockReturnValue(mockTransaction);
      mockTransaction.objectStore.mockReturnValue(mockObjectStore);
    });

    it('should save session successfully', async () => {
      const sessionData: SessionData = {
        id: 'session-1',
        timestamp: Date.now(),
        name: 'Test Session',
        drumSettings: {} as any,
        multisampleSettings: {} as any,
        drumSamples: [],
        multisampleFiles: [],
        selectedMultisample: null,
        isDrumKeyboardPinned: false,
        isMultisampleKeyboardPinned: false,
      };
      const mockRequest = createMockRequest();
      mockObjectStore.put.mockReturnValue(mockRequest);
      
      await indexedDB.saveSession(sessionData);
      
      expect(mockObjectStore.put).toHaveBeenCalledWith(sessionData);
    });

    it('should get session successfully', async () => {
      const sessionData: SessionData = {
        id: 'session-1',
        timestamp: Date.now(),
        name: 'Test Session',
        drumSettings: {} as any,
        multisampleSettings: {} as any,
        drumSamples: [],
        multisampleFiles: [],
        selectedMultisample: null,
        isDrumKeyboardPinned: false,
        isMultisampleKeyboardPinned: false,
      };
      const mockRequest = createMockRequest(sessionData);
      mockObjectStore.get.mockReturnValue(mockRequest);
      
      const result = await indexedDB.getSession('session-1');
      
      expect(result).toEqual(sessionData);
    });

    it('should get all sessions successfully', async () => {
      const sessions = [
        { id: 'session-1', timestamp: Date.now(), name: 'Session 1' } as SessionData,
        { id: 'session-2', timestamp: Date.now(), name: 'Session 2' } as SessionData,
      ];
      const mockRequest = createMockRequest(sessions);
      mockObjectStore.getAll.mockReturnValue(mockRequest);
      
      const result = await indexedDB.getAllSessions();
      
      expect(result).toEqual(sessions);
    });

    it('should delete session successfully', async () => {
      const mockRequest = createMockRequest();
      mockObjectStore.delete.mockReturnValue(mockRequest);
      
      await indexedDB.deleteSession('session-1');
      
      expect(mockObjectStore.delete).toHaveBeenCalledWith('session-1');
    });
  });

  describe('Sample Operations', () => {
    beforeEach(() => {
      const mockRequest = createMockOpenRequest(mockDatabase);
      mockIndexedDB.open.mockReturnValue(mockRequest);
      mockDatabase.transaction.mockReturnValue(mockTransaction);
      mockTransaction.objectStore.mockReturnValue(mockObjectStore);
    });

    it('should save sample successfully', async () => {
      const sampleData: SampleData = {
        id: 'sample-1',
        name: 'Test Sample',
        type: 'drum',
        size: 1024,
        data: new Blob([new ArrayBuffer(1024)]),
        metadata: {
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          duration: 1.0,
        },
        createdAt: Date.now(),
      };
      const mockRequest = createMockRequest();
      mockObjectStore.put.mockReturnValue(mockRequest);
      
      await indexedDB.saveSample(sampleData);
      
      expect(mockObjectStore.put).toHaveBeenCalledWith(sampleData);
    });

    it('should get sample successfully', async () => {
      const sampleData: SampleData = {
        id: 'sample-1',
        name: 'Test Sample',
        type: 'drum',
        size: 1024,
        data: new Blob([new ArrayBuffer(1024)]),
        metadata: {
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          duration: 1.0,
        },
        createdAt: Date.now(),
      };
      const mockRequest = createMockRequest(sampleData);
      mockObjectStore.get.mockReturnValue(mockRequest);
      
      const result = await indexedDB.getSample('sample-1');
      
      expect(result).toEqual(sampleData);
    });

    it('should get all samples successfully', async () => {
      const samples = [
        { id: 'sample-1', name: 'Sample 1', type: 'drum' } as SampleData,
        { id: 'sample-2', name: 'Sample 2', type: 'multisample' } as SampleData,
      ];
      const mockRequest = createMockRequest(samples);
      mockObjectStore.getAll.mockReturnValue(mockRequest);
      
      const result = await indexedDB.getAllSamples();
      
      expect(result).toEqual(samples);
    });

    it('should delete sample successfully', async () => {
      const mockRequest = createMockRequest();
      mockObjectStore.delete.mockReturnValue(mockRequest);
      
      await indexedDB.deleteSample('sample-1');
      
      expect(mockObjectStore.delete).toHaveBeenCalledWith('sample-1');
    });

    it('should get samples by type successfully', async () => {
      const drumSamples = [
        { id: 'sample-1', name: 'Drum 1', type: 'drum' } as SampleData,
        { id: 'sample-2', name: 'Drum 2', type: 'drum' } as SampleData,
      ];
      const mockIndex = { getAll: vi.fn() };
      const mockRequest = createMockRequest(drumSamples);
      mockObjectStore.index.mockReturnValue(mockIndex);
      mockIndex.getAll.mockReturnValue(mockRequest);
      
      const result = await indexedDB.getSamplesByType('drum');
      
      expect(result).toEqual(drumSamples);
      expect(mockObjectStore.index).toHaveBeenCalledWith('type');
      expect(mockIndex.getAll).toHaveBeenCalledWith('drum');
    });
  });

  describe('Preset Operations', () => {
    beforeEach(() => {
      const mockRequest = createMockOpenRequest(mockDatabase);
      mockIndexedDB.open.mockReturnValue(mockRequest);
      mockDatabase.transaction.mockReturnValue(mockTransaction);
      mockTransaction.objectStore.mockReturnValue(mockObjectStore);
    });

    it('should save preset successfully', async () => {
      const presetData: PresetData = {
        id: 'preset-1',
        name: 'Test Preset',
        type: 'drum',
        data: { drumSamples: [] },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isFavorite: false,
      };
      const mockRequest = createMockRequest();
      mockObjectStore.put.mockReturnValue(mockRequest);
      
      await indexedDB.savePreset(presetData);
      
      expect(mockObjectStore.put).toHaveBeenCalledWith(presetData);
    });

    it('should get preset successfully', async () => {
      const presetData: PresetData = {
        id: 'preset-1',
        name: 'Test Preset',
        type: 'drum',
        data: { drumSamples: [] },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isFavorite: false,
      };
      const mockRequest = createMockRequest(presetData);
      mockObjectStore.get.mockReturnValue(mockRequest);
      
      const result = await indexedDB.getPreset('preset-1');
      
      expect(result).toEqual(presetData);
    });

    it('should get all presets successfully', async () => {
      const presets = [
        { id: 'preset-1', name: 'Drum Kit', type: 'drum' } as PresetData,
        { id: 'preset-2', name: 'Multisample', type: 'multisample' } as PresetData,
      ];
      const mockRequest = createMockRequest(presets);
      mockObjectStore.getAll.mockReturnValue(mockRequest);
      
      const result = await indexedDB.getAllPresets();
      
      expect(result).toEqual(presets);
    });

    it('should delete preset successfully', async () => {
      const mockRequest = createMockRequest();
      mockObjectStore.delete.mockReturnValue(mockRequest);
      
      await indexedDB.deletePreset('preset-1');
      
      expect(mockObjectStore.delete).toHaveBeenCalledWith('preset-1');
    });

    it('should get presets by type successfully', async () => {
      const drumPresets = [
        { id: 'preset-1', name: 'Drum Kit 1', type: 'drum' } as PresetData,
        { id: 'preset-2', name: 'Drum Kit 2', type: 'drum' } as PresetData,
      ];
      const mockIndex = { getAll: vi.fn() };
      const mockRequest = createMockRequest(drumPresets);
      mockObjectStore.index.mockReturnValue(mockIndex);
      mockIndex.getAll.mockReturnValue(mockRequest);
      
      const result = await indexedDB.getPresetsByType('drum');
      
      expect(result).toEqual(drumPresets);
      expect(mockObjectStore.index).toHaveBeenCalledWith('type');
      expect(mockIndex.getAll).toHaveBeenCalledWith('drum');
    });
  });

  describe('Utility Operations', () => {
    beforeEach(() => {
      const mockRequest = createMockOpenRequest(mockDatabase);
      mockIndexedDB.open.mockReturnValue(mockRequest);
      mockDatabase.transaction.mockReturnValue(mockTransaction);
      mockTransaction.objectStore.mockReturnValue(mockObjectStore);
    });

    it('should clear all stores successfully', async () => {
      // Mock successful clear operations
      const mockClearRequests = [
        createMockRequest(),
        createMockRequest(),
        createMockRequest(),
        createMockRequest()
      ];
      
      mockObjectStore.clear
        .mockReturnValueOnce(mockClearRequests[0])
        .mockReturnValueOnce(mockClearRequests[1])
        .mockReturnValueOnce(mockClearRequests[2])
        .mockReturnValueOnce(mockClearRequests[3]);

      await indexedDB.clearAll();

      // clearAll makes separate transactions for each store
      expect(mockDatabase.transaction).toHaveBeenCalledWith([STORES.SESSIONS], 'readwrite');
      expect(mockDatabase.transaction).toHaveBeenCalledWith([STORES.SAMPLES], 'readwrite');
      expect(mockDatabase.transaction).toHaveBeenCalledWith([STORES.PRESETS], 'readwrite');
      expect(mockDatabase.transaction).toHaveBeenCalledWith([STORES.METADATA], 'readwrite');
      expect(mockObjectStore.clear).toHaveBeenCalledTimes(4);
    });

    it('should get database size successfully', async () => {
      const sessions = [{ id: '1' }, { id: '2' }];
      const samples = [{ 
        id: '1', 
        data: new Blob(['test data'], { type: 'audio/wav' }),
        metadata: { sampleRate: 44100, bitDepth: 16, channels: 2, duration: 1.0 }
      }];
      const presets = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const metadata = [{ key: '1' }];

      mockObjectStore.getAll
        .mockReturnValueOnce(createMockRequest(sessions))
        .mockReturnValueOnce(createMockRequest(samples))
        .mockReturnValueOnce(createMockRequest(presets))
        .mockReturnValueOnce(createMockRequest(metadata));

      const size = await indexedDB.getDatabaseSize();

      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database not initialized error', async () => {
      const mockRequest = createMockOpenRequest(null, new Error('Database not initialized'));
      mockIndexedDB.open.mockReturnValue(mockRequest);
      
      await expect(indexedDB.init()).rejects.toThrow('Database not initialized');
    });

    it('should handle database connection error', async () => {
      const mockRequest = createMockOpenRequest(mockDatabase);
      mockIndexedDB.open.mockReturnValue(mockRequest);
      mockDatabase.transaction.mockImplementation(() => {
        throw new Error('Transaction failed');
      });
      
      await expect(indexedDB.add('test-store', { id: 'test' })).rejects.toThrow('Transaction failed');
    });
  });
}); 