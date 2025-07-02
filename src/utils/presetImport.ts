// Import utilities for preset validation and conversion

export interface DrumPresetJson {
  type: 'drum';
  engine: {
    bendrange?: number;
    'velocity.sensitivity'?: number;
    volume?: number;
    width?: number;
    playmode?: 'poly' | 'mono' | 'legato';
    transpose?: number;
    // Other engine properties that might exist
    [key: string]: any;
  };
  // Other patch properties
  [key: string]: any;
}

export interface MultisamplePresetJson {
  type: 'multisampler';
  engine: {
    bendrange?: number;
    'velocity.sensitivity'?: number;
    volume?: number;
    width?: number;
    // Other engine properties that might exist
    [key: string]: any;
  };
  // Other patch properties
  [key: string]: any;
}

export type PresetJson = DrumPresetJson | MultisamplePresetJson;

export interface ImportResult {
  success: boolean;
  data?: PresetJson;
  error?: string;
}

export function validatePresetJson(jsonData: any, expectedType: 'drum' | 'multisampler'): ImportResult {
  try {
    // Check if it's a valid object
    if (!jsonData || typeof jsonData !== 'object') {
      return {
        success: false,
        error: 'Invalid JSON format'
      };
    }

    // Check type field
    if (!jsonData.type) {
      return {
        success: false,
        error: 'Missing "type" field in JSON'
      };
    }

    // Validate type matches expected
    if (jsonData.type !== expectedType) {
      let message = '';
      
      if (expectedType === 'drum' && jsonData.type === 'multisampler') {
        message = 'This is a multisample preset, but you\'re trying to import it into the drum tool. Please switch to the multisample tab to import this preset.';
      } else if (expectedType === 'multisampler' && jsonData.type === 'drum') {
        message = 'This is a drum preset, but you\'re trying to import it into the multisample tool. Please switch to the drum tab to import this preset.';
      } else {
        // Fallback for unknown types
        const actualType = jsonData.type === 'drum' ? 'drum' : 
                          jsonData.type === 'multisampler' ? 'multisampler' : 
                          jsonData.type;
        const expectedTypeName = expectedType === 'drum' ? 'drum' : 'multisampler';
        message = `This preset file has type "${actualType}" but we expected a "${expectedTypeName}" preset. Please make sure you're using the correct preset file.`;
      }
      
      return {
        success: false,
        error: message
      };
    }

    if (!jsonData.engine || typeof jsonData.engine !== 'object') {
      return {
        success: false,
        error: 'Missing or invalid "engine" field'
      };
    }

    // Basic validation - just check that it's a valid patch structure
    // We don't require specific fields since patches can have varying settings

    return {
      success: true,
      data: jsonData as PresetJson
    };

  } catch (error) {
    return {
      success: false,
      error: `JSON parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export async function importPresetFromFile(file: File, expectedType: 'drum' | 'multisampler'): Promise<ImportResult> {
  try {
    // Check file type
    if (!file.name.toLowerCase().endsWith('.json')) {
      return {
        success: false,
        error: 'File must be a JSON file (.json)'
      };
    }

    // Read file content
    const text = await file.text();
    
    // Parse JSON
    let jsonData: any;
    try {
      jsonData = JSON.parse(text);
    } catch (parseError) {
      return {
        success: false,
        error: `Invalid JSON format: ${parseError instanceof Error ? parseError.message : 'Parse error'}`
      };
    }

    // Validate the preset
    return validatePresetJson(jsonData, expectedType);

  } catch (error) {
    return {
      success: false,
      error: `File reading error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Helper function to convert internal values to UI percentages
export function internalToPercent(internal: number): number {
  return Math.round((internal / 32767) * 100);
}

// Extract settings from imported preset for UI
export function extractDrumSettings(preset: DrumPresetJson) {
  const engine = preset.engine;
  
  return {
    presetSettings: {
      playmode: engine.playmode || 'poly',
      transpose: engine.transpose || 0,
              velocity: engine['velocity.sensitivity'] ? internalToPercent(engine['velocity.sensitivity']) : 20,
              volume: engine.volume ? internalToPercent(engine.volume) : 69,
      width: engine.width ? internalToPercent(engine.width) : 0
    }
  };
}

// Note: Multisample presets don't have exposed UI settings like drums
// The engine settings are used during patch generation but not exposed in UI
// The imported preset is stored in context for use during patch generation 