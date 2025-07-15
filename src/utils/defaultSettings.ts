import { cookieUtils, COOKIE_KEYS } from './cookies';
import type { AppState } from '../context/AppContext';

// Default settings that will be used when no custom defaults are saved
export const defaultDrumSettings: AppState['drumSettings'] = {
  sampleRate: 44100,
  bitDepth: 16,
  channels: 2,
  presetName: '',
  normalize: false,
  normalizeLevel: -1.0,
  renameFiles: false,
  filenameSeparator: ' ',
  presetSettings: {
    playmode: 'poly',
    transpose: 0,
    velocity: 20,
    volume: 69,
    width: 0
  }
};

export const defaultMultisampleSettings: AppState['multisampleSettings'] = {
  sampleRate: 44100,
  bitDepth: 16,
  channels: 2,
  presetName: '',
  normalize: false,
  normalizeLevel: -1.0,
  cutAtLoopEnd: false,
  gain: 0,
  loopEnabled: true,
  loopOnRelease: true,
  renameFiles: false,
  filenameSeparator: ' '
};

// Extended default settings that include imported preset data
export interface ExtendedDrumDefaults {
  basicSettings: typeof defaultDrumSettings;
  importedPreset: any | null;
}

export interface ExtendedMultisampleDefaults {
  basicSettings: typeof defaultMultisampleSettings;
  importedPreset: any | null;
}

// Save drum settings as default (including imported preset data)
export function saveDrumSettingsAsDefault(settings: AppState['drumSettings'], importedPreset: any | null = null): void {
  try {
    const settingsToSave: ExtendedDrumDefaults = {
      basicSettings: {
        sampleRate: settings.sampleRate,
        bitDepth: settings.bitDepth,
        channels: settings.channels,
        presetName: settings.presetName,
        normalize: settings.normalize,
        normalizeLevel: settings.normalizeLevel,
        renameFiles: settings.renameFiles,
        filenameSeparator: settings.filenameSeparator,
        presetSettings: {
          playmode: settings.presetSettings.playmode,
          transpose: settings.presetSettings.transpose,
          velocity: settings.presetSettings.velocity,
          volume: settings.presetSettings.volume,
          width: settings.presetSettings.width
        }
      },
      importedPreset: importedPreset
    };
    
    cookieUtils.setCookie(COOKIE_KEYS.DRUM_DEFAULT_SETTINGS, JSON.stringify(settingsToSave), 365);
  } catch (error) {
    console.warn('Failed to save drum default settings:', error);
  }
}

// Save multisample settings as default (including imported preset data)
export function saveMultisampleSettingsAsDefault(settings: AppState['multisampleSettings'], importedPreset: any | null = null): void {
  try {
    const settingsToSave: ExtendedMultisampleDefaults = {
      basicSettings: {
        sampleRate: settings.sampleRate,
        bitDepth: settings.bitDepth,
        channels: settings.channels,
        presetName: settings.presetName,
        normalize: settings.normalize,
        normalizeLevel: settings.normalizeLevel,
        cutAtLoopEnd: settings.cutAtLoopEnd,
        gain: settings.gain,
        loopEnabled: settings.loopEnabled,
        loopOnRelease: settings.loopOnRelease,
        renameFiles: settings.renameFiles,
        filenameSeparator: settings.filenameSeparator
      },
      importedPreset: importedPreset
    };
    
    cookieUtils.setCookie(COOKIE_KEYS.MULTISAMPLE_DEFAULT_SETTINGS, JSON.stringify(settingsToSave), 365);
  } catch (error) {
    console.warn('Failed to save multisample default settings:', error);
  }
}

// Load drum default settings
export function loadDrumDefaultSettings(): typeof defaultDrumSettings {
  try {
    const savedSettings = cookieUtils.getCookie(COOKIE_KEYS.DRUM_DEFAULT_SETTINGS);
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      
      // Handle both old format (just basic settings) and new format (with imported preset)
      if (parsed.basicSettings) {
        // New format with imported preset
        return { ...defaultDrumSettings, ...parsed.basicSettings };
      } else {
        // Old format - just basic settings
        return { ...defaultDrumSettings, ...parsed };
      }
    }
  } catch (error) {
    console.warn('Failed to load drum default settings, using defaults:', error);
  }
  return defaultDrumSettings;
}

// Load multisample default settings
export function loadMultisampleDefaultSettings(): typeof defaultMultisampleSettings {
  try {
    const savedSettings = cookieUtils.getCookie(COOKIE_KEYS.MULTISAMPLE_DEFAULT_SETTINGS);
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      
      // Handle both old format (just basic settings) and new format (with imported preset)
      if (parsed.basicSettings) {
        // New format with imported preset
        return { ...defaultMultisampleSettings, ...parsed.basicSettings };
      } else {
        // Old format - just basic settings
        return { ...defaultMultisampleSettings, ...parsed };
      }
    }
  } catch (error) {
    console.warn('Failed to load multisample default settings, using defaults:', error);
  }
  return defaultMultisampleSettings;
}

// Load drum imported preset data
export function loadDrumImportedPreset(): any | null {
  try {
    const savedSettings = cookieUtils.getCookie(COOKIE_KEYS.DRUM_DEFAULT_SETTINGS);
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      return parsed.importedPreset || null;
    }
  } catch (error) {
    console.warn('Failed to load drum imported preset, using null:', error);
  }
  return null;
}

// Load multisample imported preset data
export function loadMultisampleImportedPreset(): any | null {
  try {
    const savedSettings = cookieUtils.getCookie(COOKIE_KEYS.MULTISAMPLE_DEFAULT_SETTINGS);
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      return parsed.importedPreset || null;
    }
  } catch (error) {
    console.warn('Failed to load multisample imported preset, using null:', error);
  }
  return null;
}

// Check if custom default settings exist
export function hasCustomDrumDefaults(): boolean {
  return cookieUtils.getCookie(COOKIE_KEYS.DRUM_DEFAULT_SETTINGS) !== null;
}

export function hasCustomMultisampleDefaults(): boolean {
  return cookieUtils.getCookie(COOKIE_KEYS.MULTISAMPLE_DEFAULT_SETTINGS) !== null;
}

// Clear default settings
export function clearDrumDefaults(): void {
  cookieUtils.removeCookie(COOKIE_KEYS.DRUM_DEFAULT_SETTINGS);
}

export function clearMultisampleDefaults(): void {
  cookieUtils.removeCookie(COOKIE_KEYS.MULTISAMPLE_DEFAULT_SETTINGS);
} 