import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sessionStorageIndexedDB } from '../../utils/sessionStorageIndexedDB';
import { indexedDB } from '../../utils/indexedDB';

// Mock IndexedDB
vi.mock('../../utils/indexedDB', () => ({
  indexedDB: {
    saveSession: vi.fn(),
    getSession: vi.fn(),
    deleteSession: vi.fn(),
    saveSample: vi.fn(),
    getSample: vi.fn(),
  }
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('SessionStorageIndexedDB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('should be a singleton', () => {
    const instance1 = sessionStorageIndexedDB;
    const instance2 = sessionStorageIndexedDB;
    expect(instance1).toBe(instance2);
  });

  it('should generate unique session IDs', () => {
    const id1 = sessionStorageIndexedDB.generateSessionId();
    const id2 = sessionStorageIndexedDB.generateSessionId();
    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(0);
  });

  it('should mark session as saved to library', async () => {
    const mockSessionData = {
      id: 'test-session-id',
      timestamp: Date.now(),
      drumSamples: [],
      multisampleFiles: [],
      savedToLibrary: false
    };
    
    localStorageMock.getItem.mockReturnValue('test-session-id');
    (indexedDB.getSession as any).mockResolvedValue(mockSessionData);
    (indexedDB.saveSession as any).mockResolvedValue(undefined);
    
    await sessionStorageIndexedDB.markSessionAsSavedToLibrary();
    
    expect(indexedDB.getSession).toHaveBeenCalledWith('test-session-id');
    expect(indexedDB.saveSession).toHaveBeenCalledWith({
      ...mockSessionData,
      savedToLibrary: true
    });
  });

  it('should reset saved to library flag', async () => {
    const mockSessionData = {
      id: 'test-session-id',
      timestamp: Date.now(),
      drumSamples: [],
      multisampleFiles: [],
      savedToLibrary: true
    };
    
    localStorageMock.getItem.mockReturnValue('test-session-id');
    (indexedDB.getSession as any).mockResolvedValue(mockSessionData);
    (indexedDB.saveSession as any).mockResolvedValue(undefined);
    
    await sessionStorageIndexedDB.resetSavedToLibraryFlag();
    
    expect(indexedDB.getSession).toHaveBeenCalledWith('test-session-id');
    expect(indexedDB.saveSession).toHaveBeenCalledWith({
      ...mockSessionData,
      savedToLibrary: false
    });
  });

  it('should handle missing session when marking as saved to library', async () => {
    localStorageMock.getItem.mockReturnValue('test-session-id');
    (indexedDB.getSession as any).mockResolvedValue(null);
    
    await sessionStorageIndexedDB.markSessionAsSavedToLibrary();
    
    expect(indexedDB.getSession).toHaveBeenCalledWith('test-session-id');
    expect(indexedDB.saveSession).not.toHaveBeenCalled();
  });

  it('should handle missing session when resetting saved to library flag', async () => {
    localStorageMock.getItem.mockReturnValue('test-session-id');
    (indexedDB.getSession as any).mockResolvedValue(null);
    
    await sessionStorageIndexedDB.resetSavedToLibraryFlag();
    
    expect(indexedDB.getSession).toHaveBeenCalledWith('test-session-id');
    expect(indexedDB.saveSession).not.toHaveBeenCalled();
  });

  it('should handle errors when marking session as saved to library', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    localStorageMock.getItem.mockReturnValue('test-session-id');
    (indexedDB.getSession as any).mockRejectedValue(new Error('Database error'));
    
    await sessionStorageIndexedDB.markSessionAsSavedToLibrary();
    
    expect(consoleSpy).toHaveBeenCalledWith('Failed to mark session as saved to library:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('should handle errors when resetting saved to library flag', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    localStorageMock.getItem.mockReturnValue('test-session-id');
    (indexedDB.getSession as any).mockRejectedValue(new Error('Database error'));
    
    await sessionStorageIndexedDB.resetSavedToLibraryFlag();
    
    expect(consoleSpy).toHaveBeenCalledWith('Failed to reset saved to library flag:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });
}); 