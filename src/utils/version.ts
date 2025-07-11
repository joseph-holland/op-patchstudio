// Utility to load version from manifest.json
export async function getAppVersion(): Promise<string> {
  try {
    const response = await fetch('/manifest.json');
    if (!response.ok) {
      throw new Error(`Failed to load version from manifest: ${response.statusText}`);
    }
    const manifest = await response.json();
    return manifest.version || '0.0.0';
  } catch (error) {
    console.warn('Failed to load version from manifest:', error);
    return '0.0.0';
  }
} 