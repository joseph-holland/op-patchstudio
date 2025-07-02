/**
 * Convert percentage to internal value (0-100% -> 0-32767)
 * Matches legacy percentToInternal function
 */
export function percentToInternal(percent: number): number {
  return Math.round((percent / 100) * 32767);
}

/**
 * Convert internal value to percentage (0-32767 -> 0-100%)
 * Matches legacy internalToPercent function
 */
export function internalToPercent(internal: number): number {
  return Math.round((internal / 32767) * 100);
}

/**
 * Deep merge objects, matching legacy deepMerge function
 * Used for merging imported preset settings with base JSON
 */
export function deepMerge(target: any, source: any): void {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
} 