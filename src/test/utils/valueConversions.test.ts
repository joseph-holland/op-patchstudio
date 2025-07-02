import { describe, it, expect } from 'vitest'
import { 
  percentToInternal, 
  internalToPercent, 
  deepMerge 
} from '../../utils/valueConversions'

describe('valueConversions', () => {
  describe('percentToInternal', () => {
    it('should convert 0% to 0', () => {
      expect(percentToInternal(0)).toBe(0)
    })

    it('should convert 50% to approximately 16384 (half of 32767)', () => {
      expect(percentToInternal(50)).toBe(16384)
    })

    it('should convert 100% to 32767', () => {
      expect(percentToInternal(100)).toBe(32767)
    })

    it('should handle values outside 0-100 range', () => {
      expect(percentToInternal(-10)).toBe(-3277)
      expect(percentToInternal(150)).toBe(49151)
    })

    it('should handle decimal percentages', () => {
      expect(percentToInternal(25.5)).toBe(8356)
    })
  })

  describe('internalToPercent', () => {
    it('should convert 0 to 0%', () => {
      expect(internalToPercent(0)).toBe(0)
    })

    it('should convert 16384 to approximately 50%', () => {
      expect(internalToPercent(16384)).toBe(50)
    })

    it('should convert 32767 to 100%', () => {
      expect(internalToPercent(32767)).toBe(100)
    })

    it('should handle values outside 0-32767 range', () => {
      expect(internalToPercent(-3277)).toBe(-10)
      expect(internalToPercent(49151)).toBe(150)
    })

    it('should round to nearest whole percent', () => {
      expect(internalToPercent(16383)).toBe(50) // Should round to 50
      expect(internalToPercent(16385)).toBe(50) // Should round to 50
    })
  })

  describe('deepMerge', () => {
    it('should merge simple objects', () => {
      const target = { a: 1, b: 2 }
      const source = { c: 3, d: 4 }
      
      deepMerge(target, source)
      
      expect(target).toEqual({ a: 1, b: 2, c: 3, d: 4 })
    })

    it('should overwrite primitive values', () => {
      const target = { a: 1, b: 2 }
      const source = { a: 10, c: 3 }
      
      deepMerge(target, source)
      
      expect(target).toEqual({ a: 10, b: 2, c: 3 })
    })

    it('should merge nested objects recursively', () => {
      const target = {
        engine: { volume: 50, pan: 0 },
        fx: { type: 'reverb' }
      }
      const source = {
        engine: { volume: 75, width: 100 },
        envelope: { attack: 10 }
      }
      
      deepMerge(target, source)
      
      expect(target).toEqual({
        engine: { volume: 75, pan: 0, width: 100 },
        fx: { type: 'reverb' },
        envelope: { attack: 10 }
      })
    })

    it('should handle deeply nested objects', () => {
      const target = {
        level1: {
          level2: {
            level3: { a: 1, b: 2 }
          }
        }
      }
      const source = {
        level1: {
          level2: {
            level3: { b: 20, c: 30 }
          }
        }
      }
      
      deepMerge(target, source)
      
      expect(target.level1.level2.level3).toEqual({ a: 1, b: 20, c: 30 })
    })

    it('should handle arrays by overwriting them (not merging)', () => {
      const target = { params: [1, 2, 3] }
      const source = { params: [4, 5] }
      
      deepMerge(target, source)
      
      expect(target.params).toEqual([4, 5])
    })

    it('should create missing nested objects', () => {
      const target = { existing: 'value' }
      const source = {
        new: {
          nested: {
            deep: 'value'
          }
        }
      }
      
      deepMerge(target, source)
      
      expect(target).toEqual({
        existing: 'value',
        new: {
          nested: {
            deep: 'value'
          }
        }
      })
    })

    it('should handle null and undefined values', () => {
      const target = { a: 1, b: null, c: undefined }
      const source = { b: 2, c: 3, d: null, e: undefined }
      
      deepMerge(target, source)
      
      expect(target).toEqual({ a: 1, b: 2, c: 3, d: null, e: undefined })
    })

    it('should replace object with non-object', () => {
      const target = { config: { nested: 'value' } }
      const source = { config: 'simple string' }
      
      deepMerge(target, source)
      
      expect(target.config).toBe('simple string')
    })
  })
})