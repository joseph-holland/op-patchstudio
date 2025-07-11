// Simple cookie utility functions
export const cookieUtils = {
  // Set a cookie with expiration
  setCookie: (name: string, value: string, days: number = 30) => {
    try {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      const expires = `expires=${date.toUTCString()}`;
      document.cookie = `${name}=${value};${expires};path=/`;
    } catch (error) {
      console.warn('Failed to set cookie (cookies may be disabled):', error);
    }
  },

  // Get a cookie value
  getCookie: (name: string): string | null => {
    try {
      const nameEQ = `${name}=`;
      const ca = document.cookie.split(';');
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
      }
      return null;
    } catch (error) {
      console.warn('Failed to read cookie (cookies may be disabled):', error);
      return null;
    }
  },

  // Remove a cookie
  removeCookie: (name: string) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }
};

// Cookie keys used in the app
export const COOKIE_KEYS = {
  LAST_TAB: 'opxy_last_tab',
  DRUM_KEYBOARD_PINNED: 'opxy_drum_keyboard_pinned',
  MULTISAMPLE_KEYBOARD_PINNED: 'opxy_multisample_keyboard_pinned',
  MIDI_NOTE_MAPPING: 'opxy_midi_note_mapping',
  // Add other cookie keys here as needed
} as const; 