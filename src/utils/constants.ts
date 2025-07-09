// App-wide constants for OP-PatchStudio

// Audio processing constants
export const AUDIO_CONSTANTS = {
  LOOP_END_PADDING: 5, // Additional samples to add when cutting at loop end
  HEADER_LENGTH: 44, // WAV file header length
  MAX_AMPLITUDE: 0x7fff, // Maximum 16-bit amplitude
  PATCH_SIZE_LIMIT: 8 * 1024 * 1024, // 8MB limit for OP-XY
} as const;

// UI constants
export const UI_CONSTANTS = {
  BORDER_RADIUS: {
    OUTER: '15px', // Main panels, modals, keyboards
    SECONDARY: '6px', // Buttons, badges
    SMALL: '3px', // Toggles, inputs
  },
  TOUCH_TARGET_MIN: 44, // Minimum touch target size in pixels
} as const;

// MIDI constants
export const MIDI_CONSTANTS = {
  C3_NOTE: 60, // C3 = 60 (Yamaha/OP-1/OP-Z convention)
  MAX_NOTE: 127,
  MIN_NOTE: 0,
} as const; 