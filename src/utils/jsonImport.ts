// JSON import utilities for OP-XY preset files
import { deepMerge, internalToPercent } from './valueConversions';
import type { AppState } from '../context/AppContext';

// Types for imported JSON structures
interface ImportedEngineSettings {
  playmode?: string;
  transpose?: number;
  'velocity.sensitivity'?: number;
  volume?: number;
  width?: number;
  highpass?: number;
  'portamento.amount'?: number;
  'portamento.type'?: number;
  'tuning.root'?: number;
}

interface ImportedPresetJson {
  engine?: ImportedEngineSettings;
  envelope?: any;
  fx?: any;
  lfo?: any;
  octave?: number;
  name?: string;
  type?: string;
}

// Import drum preset JSON and convert to UI state
export function importDrumPresetJson(
  jsonContent: string,
  currentState: AppState
): Partial<AppState> {
  try {
    const importedJson: ImportedPresetJson = JSON.parse(jsonContent);
    
    if (importedJson.type !== 'drum') {
      throw new Error('Invalid preset type: expected drum preset');
    }

    const updates: Partial<AppState> = {
      drumSettings: { ...currentState.drumSettings }
    };

    // Import preset name if available
    if (importedJson.name) {
      updates.drumSettings!.presetName = importedJson.name;
    }

    // Import engine settings and convert to UI format (0-100%)
    if (importedJson.engine) {
      const engine = importedJson.engine;
      const presetSettings = { ...currentState.drumSettings.presetSettings };

      if (engine.playmode) {
        presetSettings.playmode = engine.playmode as any;
      }
      if (typeof engine.transpose === 'number') {
        presetSettings.transpose = engine.transpose;
      }
      if (typeof engine['velocity.sensitivity'] === 'number') {
        presetSettings.velocity = internalToPercent(engine['velocity.sensitivity']);
      }
      if (typeof engine.volume === 'number') {
        presetSettings.volume = internalToPercent(engine.volume);
      }
      if (typeof engine.width === 'number') {
        presetSettings.width = internalToPercent(engine.width);
      }

      updates.drumSettings!.presetSettings = presetSettings;
    }

    // Store the full imported JSON for later merging during patch generation
    (updates as any).importedDrumPresetJson = importedJson;

    return updates;
  } catch (error) {
    throw new Error(`Failed to import drum preset: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
  }
}

// Import multisample preset JSON and convert to UI state
export function importMultisamplePresetJson(
  jsonContent: string,
  currentState: AppState
): Partial<AppState> {
  try {
    const importedJson: ImportedPresetJson = JSON.parse(jsonContent);
    
    if (importedJson.type !== 'multisampler') {
      throw new Error('Invalid preset type: expected multisample preset');
    }

    const updates: Partial<AppState> = {
      multisampleSettings: { ...currentState.multisampleSettings }
    };

    // Import preset name if available
    if (importedJson.name) {
      updates.multisampleSettings!.presetName = importedJson.name;
    }

    // TODO: Import multisample advanced settings when implemented
    // For now, just store the imported JSON for later merging

    // Store the full imported JSON for later merging during patch generation
    (updates as any).importedMultisamplePresetJson = importedJson;

    return updates;
  } catch (error) {
    throw new Error(`Failed to import multisample preset: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
  }
}

// Merge imported preset settings with base JSON during patch generation
export function mergeImportedDrumSettings(baseJson: any, importedJson?: ImportedPresetJson): void {
  if (!importedJson) return;

  // Merge sections that should be preserved from imported preset
  const sectionsToMerge = ['engine', 'envelope', 'fx', 'lfo', 'octave'];
  
  sectionsToMerge.forEach(section => {
    if (importedJson[section as keyof ImportedPresetJson]) {
      if (!baseJson[section]) baseJson[section] = {};
      deepMerge(baseJson[section], importedJson[section as keyof ImportedPresetJson]);
    }
  });
}

// Merge imported multisample settings with base JSON during patch generation
export function mergeImportedMultisampleSettings(baseJson: any, importedJson?: ImportedPresetJson): void {
  if (!importedJson) return;

  // Merge sections that should be preserved from imported preset
  const sectionsToMerge = ['engine', 'envelope', 'fx', 'lfo', 'octave'];
  
  sectionsToMerge.forEach(section => {
    if (importedJson[section as keyof ImportedPresetJson]) {
      if (!baseJson[section]) baseJson[section] = {};
      deepMerge(baseJson[section], importedJson[section as keyof ImportedPresetJson]);
    }
  });
}

// Validate JSON file before import
export function validatePresetJson(jsonContent: string): { isValid: boolean; type?: string; error?: string } {
  try {
    const json = JSON.parse(jsonContent);
    
    if (!json.type) {
      return { isValid: false, error: 'Missing preset type' };
    }
    
    if (json.type !== 'drum' && json.type !== 'multisampler') {
      return { isValid: false, error: `Unsupported preset type: ${json.type}` };
    }
    
    if (!json.engine) {
      return { isValid: false, error: 'Missing engine settings' };
    }
    
    return { isValid: true, type: json.type };
  } catch (error) {
    return { isValid: false, error: 'Invalid JSON format' };
  }
} 