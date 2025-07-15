import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveDrumSettingsAsDefault,
  saveMultisampleSettingsAsDefault,
  loadDrumDefaultSettings,
  loadMultisampleDefaultSettings,
  loadDrumImportedPreset,
  loadMultisampleImportedPreset,
  hasCustomDrumDefaults,
  hasCustomMultisampleDefaults,
  clearDrumDefaults,
  clearMultisampleDefaults,
  defaultDrumSettings,
  defaultMultisampleSettings
} from '../../utils/defaultSettings';
import { cookieUtils, COOKIE_KEYS } from '../../utils/cookies';

// Mock the cookie utilities
vi.mock('../../utils/cookies', () => ({
  cookieUtils: {
    setCookie: vi.fn(),
    getCookie: vi.fn(),
    removeCookie: vi.fn(),
  },
  COOKIE_KEYS: {
    DRUM_DEFAULT_SETTINGS: 'opxy_drum_default_settings',
    MULTISAMPLE_DEFAULT_SETTINGS: 'opxy_multisample_default_settings',
  }
}));

describe('defaultSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clear any saved settings after each test
    clearDrumDefaults();
    clearMultisampleDefaults();
  });

  describe('saveDrumSettingsAsDefault', () => {
    it('should save drum settings to cookies', () => {
      const mockSettings = {
        sampleRate: 48000,
        bitDepth: 24,
        channels: 1,
        presetName: 'test preset',
        normalize: true,
        normalizeLevel: -3.0,
        renameFiles: true,
        filenameSeparator: '-' as const,
        presetSettings: {
          playmode: 'mono' as const,
          transpose: 12,
          velocity: 50,
          volume: 80,
          width: 25
        }
      };

      saveDrumSettingsAsDefault(mockSettings, null);

      expect(cookieUtils.setCookie).toHaveBeenCalledWith(
        COOKIE_KEYS.DRUM_DEFAULT_SETTINGS,
        JSON.stringify({
          basicSettings: {
            sampleRate: 48000,
            bitDepth: 24,
            channels: 1,
            presetName: 'test preset',
            normalize: true,
            normalizeLevel: -3.0,
            renameFiles: true,
            filenameSeparator: '-',
            presetSettings: {
              playmode: 'mono',
              transpose: 12,
              velocity: 50,
              volume: 80,
              width: 25
            }
          },
          importedPreset: null
        }),
        365
      );
    });

    it('should save drum settings with imported preset data', () => {
      const mockSettings = {
        sampleRate: 48000,
        bitDepth: 24,
        channels: 1,
        presetName: 'test preset',
        normalize: true,
        normalizeLevel: -3.0,
        renameFiles: true,
        filenameSeparator: '-' as const,
        presetSettings: {
          playmode: 'mono' as const,
          transpose: 12,
          velocity: 50,
          volume: 80,
          width: 25
        }
      };

      const mockImportedPreset = {
        engine: {
          playmode: 'poly',
          transpose: 0,
          'velocity.sensitivity': 10240,
          volume: 16466,
          width: 0
        }
      };

      saveDrumSettingsAsDefault(mockSettings, mockImportedPreset);

      expect(cookieUtils.setCookie).toHaveBeenCalledWith(
        COOKIE_KEYS.DRUM_DEFAULT_SETTINGS,
        JSON.stringify({
          basicSettings: {
            sampleRate: 48000,
            bitDepth: 24,
            channels: 1,
            presetName: 'test preset',
            normalize: true,
            normalizeLevel: -3.0,
            renameFiles: true,
            filenameSeparator: '-',
            presetSettings: {
              playmode: 'mono',
              transpose: 12,
              velocity: 50,
              volume: 80,
              width: 25
            }
          },
          importedPreset: mockImportedPreset
        }),
        365
      );
    });
  });

  describe('saveMultisampleSettingsAsDefault', () => {
    it('should save multisample settings to cookies', () => {
      const mockSettings = {
        sampleRate: 96000,
        bitDepth: 32,
        channels: 2,
        presetName: 'test multisample',
        normalize: false,
        normalizeLevel: -6.0,
        cutAtLoopEnd: true,
        gain: 5,
        loopEnabled: false,
        loopOnRelease: false,
        renameFiles: true,
        filenameSeparator: ' ' as const
      };

      saveMultisampleSettingsAsDefault(mockSettings, null);

      expect(cookieUtils.setCookie).toHaveBeenCalledWith(
        COOKIE_KEYS.MULTISAMPLE_DEFAULT_SETTINGS,
        JSON.stringify({
          basicSettings: {
            sampleRate: 96000,
            bitDepth: 32,
            channels: 2,
            presetName: 'test multisample',
            normalize: false,
            normalizeLevel: -6.0,
            cutAtLoopEnd: true,
            gain: 5,
            loopEnabled: false,
            loopOnRelease: false,
            renameFiles: true,
            filenameSeparator: ' '
          },
          importedPreset: null
        }),
        365
      );
    });
  });

  describe('loadDrumDefaultSettings', () => {
    it('should return default settings when no custom settings are saved', () => {
      (cookieUtils.getCookie as any).mockReturnValue(null);

      const result = loadDrumDefaultSettings();

      expect(result).toEqual(defaultDrumSettings);
    });

    it('should return custom settings when they are saved', () => {
      const customSettings = {
        sampleRate: 48000,
        bitDepth: 24,
        channels: 1,
        normalize: true,
        normalizeLevel: -3.0,
        renameFiles: true,
        filenameSeparator: '-',
        presetSettings: {
          playmode: 'mono' as const,
          transpose: 12,
          velocity: 50,
          volume: 80,
          width: 25
        }
      };

      (cookieUtils.getCookie as any).mockReturnValue(JSON.stringify(customSettings));

      const result = loadDrumDefaultSettings();

      expect(result).toEqual({
        ...defaultDrumSettings,
        ...customSettings
      });
    });

    it('should handle JSON parsing errors gracefully', () => {
      (cookieUtils.getCookie as any).mockReturnValue('invalid json');

      const result = loadDrumDefaultSettings();

      expect(result).toEqual(defaultDrumSettings);
    });
  });

  describe('loadMultisampleDefaultSettings', () => {
    it('should return default settings when no custom settings are saved', () => {
      (cookieUtils.getCookie as any).mockReturnValue(null);

      const result = loadMultisampleDefaultSettings();

      expect(result).toEqual(defaultMultisampleSettings);
    });

    it('should return custom settings when they are saved', () => {
      const customSettings = {
        sampleRate: 96000,
        bitDepth: 32,
        channels: 2,
        normalize: false,
        normalizeLevel: -6.0,
        cutAtLoopEnd: true,
        gain: 5,
        loopEnabled: false,
        loopOnRelease: false,
        renameFiles: true,
        filenameSeparator: ' '
      };

      (cookieUtils.getCookie as any).mockReturnValue(JSON.stringify(customSettings));

      const result = loadMultisampleDefaultSettings();

      expect(result).toEqual({
        ...defaultMultisampleSettings,
        ...customSettings
      });
    });
  });

  describe('loadDrumImportedPreset', () => {
    it('should return null when no imported preset is saved', () => {
      (cookieUtils.getCookie as any).mockReturnValue(null);

      const result = loadDrumImportedPreset();

      expect(result).toBeNull();
    });

    it('should return imported preset when it is saved', () => {
      const savedData = {
        basicSettings: { sampleRate: 48000 },
        importedPreset: { engine: { playmode: 'poly' } }
      };

      (cookieUtils.getCookie as any).mockReturnValue(JSON.stringify(savedData));

      const result = loadDrumImportedPreset();

      expect(result).toEqual({ engine: { playmode: 'poly' } });
    });
  });

  describe('loadMultisampleImportedPreset', () => {
    it('should return null when no imported preset is saved', () => {
      (cookieUtils.getCookie as any).mockReturnValue(null);

      const result = loadMultisampleImportedPreset();

      expect(result).toBeNull();
    });

    it('should return imported preset when it is saved', () => {
      const savedData = {
        basicSettings: { sampleRate: 48000 },
        importedPreset: { 
          engine: { playmode: 'poly' },
          envelope: { amp: { attack: 1000 } }
        }
      };

      (cookieUtils.getCookie as any).mockReturnValue(JSON.stringify(savedData));

      const result = loadMultisampleImportedPreset();

      expect(result).toEqual({ 
        engine: { playmode: 'poly' },
        envelope: { amp: { attack: 1000 } }
      });
    });
  });

  describe('hasCustomDefaults', () => {
    it('should return false when no custom drum defaults exist', () => {
      (cookieUtils.getCookie as any).mockReturnValue(null);

      expect(hasCustomDrumDefaults()).toBe(false);
    });

    it('should return true when custom drum defaults exist', () => {
      (cookieUtils.getCookie as any).mockReturnValue('{"sampleRate": 48000}');

      expect(hasCustomDrumDefaults()).toBe(true);
    });

    it('should return false when no custom multisample defaults exist', () => {
      (cookieUtils.getCookie as any).mockReturnValue(null);

      expect(hasCustomMultisampleDefaults()).toBe(false);
    });

    it('should return true when custom multisample defaults exist', () => {
      (cookieUtils.getCookie as any).mockReturnValue('{"sampleRate": 96000}');

      expect(hasCustomMultisampleDefaults()).toBe(true);
    });
  });

  describe('clearDefaults', () => {
    it('should clear drum defaults', () => {
      clearDrumDefaults();

      expect(cookieUtils.removeCookie).toHaveBeenCalledWith(COOKIE_KEYS.DRUM_DEFAULT_SETTINGS);
    });

    it('should clear multisample defaults', () => {
      clearMultisampleDefaults();

      expect(cookieUtils.removeCookie).toHaveBeenCalledWith(COOKIE_KEYS.MULTISAMPLE_DEFAULT_SETTINGS);
    });
  });
}); 