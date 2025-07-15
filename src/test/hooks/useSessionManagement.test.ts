import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSessionManagement } from '../../hooks/useSessionManagement';
import { AppContextProvider } from '../../context/AppContext';
import { sessionStorageIndexedDB } from '../../utils/sessionStorageIndexedDB';

// Mock the sessionStorageIndexedDB module
vi.mock('../../utils/sessionStorageIndexedDB', () => ({
  sessionStorageIndexedDB: {
    clearCurrentSession: vi.fn(),
    hasPreviousSession: vi.fn(),
    getCurrentSession: vi.fn(),
    saveSession: vi.fn(),
    loadSession: vi.fn(),
    clearCorruptedData: vi.fn(),
    markSessionAsSavedToLibrary: vi.fn(),
    resetSavedToLibraryFlag: vi.fn(),
    clearAllSessionData: vi.fn(),
    loadSampleFromSession: vi.fn(),
  }
}));

describe('useSessionManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });
  });

  describe('declineSessionRestoration', () => {
    it('should clear session data and reset state when declining restoration', async () => {
      const mockClearCurrentSession = vi.mocked(sessionStorageIndexedDB.clearCurrentSession);
      mockClearCurrentSession.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSessionManagement(), {
        wrapper: AppContextProvider,
      });

      // Call declineSessionRestoration
      await act(async () => {
        await result.current.declineSessionRestoration();
      });

      // Verify that clearCurrentSession was called
      expect(mockClearCurrentSession).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when clearing session data', async () => {
      const mockClearCurrentSession = vi.mocked(sessionStorageIndexedDB.clearCurrentSession);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockClearCurrentSession.mockRejectedValue(new Error('Database error'));

      const { result } = renderHook(() => useSessionManagement(), {
        wrapper: AppContextProvider,
      });

      // Call declineSessionRestoration
      await act(async () => {
        await result.current.declineSessionRestoration();
      });

      // Verify that clearCurrentSession was called
      expect(mockClearCurrentSession).toHaveBeenCalledTimes(1);
      
      // Verify that error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to clear session data when declining restoration:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
}); 