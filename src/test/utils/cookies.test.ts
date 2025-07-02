import { describe, it, expect, beforeEach, vi } from 'vitest'
import { cookieUtils, COOKIE_KEYS } from '../../utils/cookies'

describe('cookieUtils', () => {
  beforeEach(() => {
    // Reset document.cookie mock
    Object.defineProperty(document, 'cookie', {
      get: vi.fn(() => ''),
      set: vi.fn(),
      configurable: true
    })
    vi.clearAllMocks()
  })

  describe('setCookie', () => {
    it('should set a cookie with default expiration', () => {
      cookieUtils.setCookie('test', 'value')
      expect(document.cookie).toContain('test=value')
    })

    it('should set a cookie with custom expiration days', () => {
      cookieUtils.setCookie('test', 'value', 60)
      expect(document.cookie).toContain('test=value')
    })

    it('should handle errors gracefully when cookies are disabled', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Mock document.cookie to throw an error
      Object.defineProperty(document, 'cookie', {
        set: () => { throw new Error('Cookies disabled') },
        configurable: true
      })

      cookieUtils.setCookie('test', 'value')
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to set cookie (cookies may be disabled):', 
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('getCookie', () => {
    it('should return the correct cookie value', () => {
      document.cookie = 'test=value; path=/'
      expect(cookieUtils.getCookie('test')).toBe('value')
    })

    it('should return null for non-existent cookie', () => {
      expect(cookieUtils.getCookie('nonexistent')).toBeNull()
    })

    it('should handle cookies with spaces correctly', () => {
      document.cookie = ' test=value ; other=data'
      expect(cookieUtils.getCookie('test')).toBe('value')
    })

    it('should handle errors gracefully when cookies are disabled', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Mock document.cookie to throw an error
      Object.defineProperty(document, 'cookie', {
        get: () => { throw new Error('Cookies disabled') },
        configurable: true
      })

      const result = cookieUtils.getCookie('test')
      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to read cookie (cookies may be disabled):', 
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('removeCookie', () => {
    it('should remove a cookie by setting it to expire in the past', () => {
      document.cookie = 'test=value; path=/'
      cookieUtils.removeCookie('test')
      expect(document.cookie).toContain('test=; expires=Thu, 01 Jan 1970 00:00:00 UTC')
    })
  })
})

describe('COOKIE_KEYS', () => {
  it('should have all required cookie keys defined', () => {
    expect(COOKIE_KEYS.LAST_TAB).toBe('opxy_last_tab')
    expect(COOKIE_KEYS.DRUM_KEYBOARD_PINNED).toBe('opxy_drum_keyboard_pinned')
    expect(COOKIE_KEYS.MULTISAMPLE_KEYBOARD_PINNED).toBe('opxy_multisample_keyboard_pinned')
  })

  it('should be readonly (as const assertion)', () => {
    // This test ensures the COOKIE_KEYS object structure is preserved
    expect(typeof COOKIE_KEYS).toBe('object')
    expect(Object.keys(COOKIE_KEYS)).toEqual([
      'LAST_TAB',
      'DRUM_KEYBOARD_PINNED', 
      'MULTISAMPLE_KEYBOARD_PINNED'
    ])
  })
})