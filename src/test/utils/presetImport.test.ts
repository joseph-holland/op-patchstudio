import { describe, it, expect } from 'vitest'
import { validatePresetJson } from '../../utils/presetImport'

describe('presetImport', () => {
  describe('validatePresetJson', () => {
    describe('drum preset validation', () => {
      it('should validate a valid drum preset', () => {
        const validDrumPreset = {
          type: 'drum',
          engine: {
            'velocity.sensitivity': 15000,
            volume: 20000,
            width: 0
          },
          regions: [],
          platform: 'OP-XY',
          version: 4
        }

        const result = validatePresetJson(validDrumPreset, 'drum')
        
        expect(result.success).toBe(true)
        expect(result.data).toEqual(validDrumPreset)
        expect(result.error).toBeUndefined()
      })

      it('should reject non-drum preset when expecting drum', () => {
        const multisamplePreset = {
          type: 'multisampler',
          engine: {
            'velocity.sensitivity': 15000,
            volume: 20000,
            width: 0
          }
        }

        const result = validatePresetJson(multisamplePreset, 'drum')
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('multisample preset')
      })

      it('should reject preset without type field', () => {
        const invalidPreset = {
          engine: {
            'velocity.sensitivity': 15000,
            volume: 20000
          }
        }

        const result = validatePresetJson(invalidPreset, 'drum')
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Missing "type" field')
      })

      it('should reject preset without engine field', () => {
        const invalidPreset = {
          type: 'drum',
          regions: []
        }

        const result = validatePresetJson(invalidPreset, 'drum')
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Missing or invalid "engine" field')
      })

      it('should validate drum preset with minimal required fields', () => {
        const minimalDrumPreset = {
          type: 'drum',
          engine: {}
        }

        const result = validatePresetJson(minimalDrumPreset, 'drum')
        
        expect(result.success).toBe(true)
        expect(result.data?.type).toBe('drum')
      })
    })

    describe('multisample preset validation', () => {
      it('should validate a valid multisample preset', () => {
        const validMultisamplePreset = {
          type: 'multisampler',
          engine: {
            bendrange: 13653,
            'velocity.sensitivity': 10240,
            volume: 16466,
            width: 0
          },
          regions: [],
          platform: 'OP-XY',
          version: 4
        }

        const result = validatePresetJson(validMultisamplePreset, 'multisampler')
        
        expect(result.success).toBe(true)
        expect(result.data).toEqual(validMultisamplePreset)
        expect(result.error).toBeUndefined()
      })

      it('should reject non-multisample preset when expecting multisample', () => {
        const drumPreset = {
          type: 'drum',
          engine: {
            'velocity.sensitivity': 15000,
            volume: 20000
          }
        }

        const result = validatePresetJson(drumPreset, 'multisampler')
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('drum preset')
      })

      it('should validate multisample preset with extra fields', () => {
        const presetWithExtras = {
          type: 'multisampler',
          engine: {
            bendrange: 13653,
            'velocity.sensitivity': 10240,
            volume: 16466,
            width: 0,
            customField: 'should be preserved'
          },
          envelope: {
            amp: { attack: 0, decay: 0 }
          },
          fx: { active: false },
          customTopLevel: 'also preserved'
        }

        const result = validatePresetJson(presetWithExtras, 'multisampler')
        
        expect(result.success).toBe(true)
        expect(result.data?.engine?.customField).toBe('should be preserved')
        expect(result.data?.customTopLevel).toBe('also preserved')
      })
    })

    describe('error handling', () => {
      it('should handle null input', () => {
        const result = validatePresetJson(null, 'drum')
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Invalid JSON format')
      })

      it('should handle undefined input', () => {
        const result = validatePresetJson(undefined, 'drum')
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Invalid JSON format')
      })

      it('should handle non-object input', () => {
        const result = validatePresetJson('not an object', 'drum')
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Invalid JSON format')
      })

      it('should handle array input', () => {
        const result = validatePresetJson(['not', 'an', 'object'], 'drum')
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Missing "type" field')
      })

      it('should handle JSON parsing errors gracefully', () => {
        // Test with an object that would cause issues during processing
        const problematicObject = {
          type: 'drum',
          engine: null // This might cause issues in some validation logic
        }

        const result = validatePresetJson(problematicObject, 'drum')
        
        // Should still handle gracefully, even if validation fails
        expect(result).toHaveProperty('success')
        expect(result).toHaveProperty('error')
      })
    })

    describe('type validation edge cases', () => {
      it('should handle unexpected type values', () => {
        const invalidTypePreset = {
          type: 'synth', // Not drum or multisampler
          engine: {}
        }

        const result = validatePresetJson(invalidTypePreset, 'drum')
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('type "synth"')
      })

      it('should handle wrong case type', () => {
        const casePreset = {
          type: 'DRUM', // Wrong case
          engine: {}
        }

        const result = validatePresetJson(casePreset, 'drum')
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('type "DRUM"')
      })

      it('should handle type as number', () => {
        const numberTypePreset = {
          type: 123,
          engine: {}
        }

        const result = validatePresetJson(numberTypePreset, 'drum')
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('type "123"')
      })
    })

    describe('engine validation', () => {
      it('should handle engine as non-object', () => {
        const invalidEnginePreset = {
          type: 'drum',
          engine: 'not an object'
        }

        const result = validatePresetJson(invalidEnginePreset, 'drum')
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Missing or invalid "engine" field')
      })

      it('should handle missing engine field', () => {
        const noEnginePreset = {
          type: 'drum',
          regions: []
        }

        const result = validatePresetJson(noEnginePreset, 'drum')
        
        expect(result.success).toBe(false)
        expect(result.error).toContain('Missing or invalid "engine" field')
      })

      it('should accept empty engine object', () => {
        const emptyEnginePreset = {
          type: 'drum',
          engine: {}
        }

        const result = validatePresetJson(emptyEnginePreset, 'drum')
        
        expect(result.success).toBe(true)
        expect(result.data?.engine).toEqual({})
      })
    })
  })
})