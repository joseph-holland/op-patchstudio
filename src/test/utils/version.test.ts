import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAppVersion } from '../../utils/version';

// Mock fetch
global.fetch = vi.fn();

describe('getAppVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return version from manifest.json', async () => {
    const mockManifest = { version: '0.7.0' };
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockManifest)
    });

    const version = await getAppVersion();
    expect(version).toBe('0.7.0');
    expect(fetch).toHaveBeenCalledWith('/manifest.json');
  });

  it('should return default version when manifest has no version', async () => {
    const mockManifest = {};
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockManifest)
    });

    const version = await getAppVersion();
    expect(version).toBe('0.0.0');
  });

  it('should return default version when fetch fails', async () => {
    (fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const version = await getAppVersion();
    expect(version).toBe('0.0.0');
  });
}); 