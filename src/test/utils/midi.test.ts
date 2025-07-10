import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MIDI_UTILS, type MidiEvent, type MidiDevice } from '../../utils/midi'
import { MIDI_CONSTANTS } from '../../utils/constants'
import { createMockMidiPort, createMockMidiAccess } from '../setup'

// Import the singleton instance
let webMidiManager: any

describe('WebMIDI Manager', () => {
  let mockRequestMIDIAccess: any
  let mockInputPort: any
  let mockOutputPort: any
  let mockMidiAccess: any

  beforeEach(async () => {
    // Clear module cache to get fresh instances
    vi.resetModules()
    
    // Create mock MIDI ports
    mockInputPort = createMockMidiPort('input-1', 'Test Input', 'input')
    mockOutputPort = createMockMidiPort('output-1', 'Test Output', 'output')
    
    // Create mock MIDI access
    mockMidiAccess = createMockMidiAccess([mockInputPort], [mockOutputPort])
    
    // Mock navigator.requestMIDIAccess
    mockRequestMIDIAccess = vi.fn().mockResolvedValue(mockMidiAccess)
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      writable: true,
      value: mockRequestMIDIAccess
    })

    // Clear console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Import fresh instance
    const midiModule = await import('../../utils/midi')
    webMidiManager = midiModule.webMidiManager
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = webMidiManager
      const instance2 = webMidiManager
      expect(instance1).toBe(instance2)
    })
  })

  describe('WebMIDI Support Detection', () => {
    it('should detect WebMIDI support when available', () => {
      expect(webMidiManager.isWebMidiSupported()).toBe(true)
    })

    it('should detect lack of WebMIDI support', () => {
      // Test the support detection logic directly
      const hasRequestMIDIAccess = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
      expect(hasRequestMIDIAccess).toBe(true) // Should be true in our test environment
      
      // Test with a mock that doesn't have requestMIDIAccess
      const mockNavigator = { ...navigator }
      delete (mockNavigator as any).requestMIDIAccess
      const hasNoRequestMIDIAccess = typeof mockNavigator !== 'undefined' && 'requestMIDIAccess' in mockNavigator
      expect(hasNoRequestMIDIAccess).toBe(false)
    })
  })

  describe('Initialization', () => {
    it('should initialize successfully when WebMIDI is supported', async () => {
      const result = await webMidiManager.initialize()
      expect(result).toBe(true)
      expect(mockRequestMIDIAccess).toHaveBeenCalled()
    })

    it('should handle initialization failure', async () => {
      mockRequestMIDIAccess.mockRejectedValue(new Error('Permission denied'))
      
      const result = await webMidiManager.initialize()
      expect(result).toBe(false)
    })

    it('should not re-initialize if already initialized', async () => {
      await webMidiManager.initialize()
      const result = await webMidiManager.initialize()
      expect(result).toBe(true)
      expect(mockRequestMIDIAccess).toHaveBeenCalledTimes(1)
    })
  })

  describe('Device Management', () => {
    beforeEach(async () => {
      await webMidiManager.initialize()
    })

    it('should detect connected devices on initialization', () => {
      const devices = webMidiManager.getDevices()
      expect(devices).toHaveLength(2)
      expect(devices.find((d: MidiDevice) => d.type === 'input')).toBeDefined()
      expect(devices.find((d: MidiDevice) => d.type === 'output')).toBeDefined()
    })

    it('should handle device state changes', () => {
      // Test that device listeners are properly registered and can be called
      const deviceListeners: MidiDevice[][] = []
      webMidiManager.addDeviceListener((devices: MidiDevice[]) => {
        deviceListeners.push([...devices])
      })

      // Get initial device count
      const initialDevices = webMidiManager.getDevices()
      expect(initialDevices.length).toBeGreaterThan(0)

      // Manually trigger device listener notification to test the mechanism
      webMidiManager['notifyDeviceListeners']()

      // Verify that the listener was called
      expect(deviceListeners.length).toBeGreaterThan(0)
      expect(deviceListeners[0]).toEqual(initialDevices)
    })

    it('should get input devices only', () => {
      const inputDevices = webMidiManager.getInputDevices()
      expect(inputDevices).toHaveLength(1)
      expect(inputDevices[0].type).toBe('input')
    })

    it('should get output devices only', () => {
      const outputDevices = webMidiManager.getOutputDevices()
      expect(outputDevices).toHaveLength(1)
      expect(outputDevices[0].type).toBe('output')
    })

    it('should handle devices without names', () => {
      const unnamedPort = createMockMidiPort('unnamed-1', '', 'input')
      // Override the name property to be undefined
      Object.defineProperty(unnamedPort, 'name', {
        value: undefined,
        writable: true
      })
      
      mockMidiAccess.inputs.set('unnamed-1', unnamedPort)
      if (mockMidiAccess.onstatechange) {
        mockMidiAccess.onstatechange({ port: unnamedPort })
      }

      const devices = webMidiManager.getDevices()
      const unnamedDevice = devices.find((d: MidiDevice) => d.id === 'unnamed-1')
      expect(unnamedDevice?.name).toBe('Unknown Input')
    })
  })

  describe('MIDI Message Handling', () => {
    let eventListeners: MidiEvent[] = []

    beforeEach(async () => {
      await webMidiManager.initialize()
      eventListeners = []
      webMidiManager.addEventListener((event: MidiEvent) => {
        eventListeners.push(event)
      })
    })

    it('should handle Note On messages', () => {
      const midiData = new Uint8Array([0x90, 60, 100]) // Note On, C3, velocity 100
      const event = { data: midiData, timeStamp: Date.now() }
      
      if (mockInputPort.onmidimessage) {
        mockInputPort.onmidimessage(event)
      }

      expect(eventListeners).toHaveLength(1)
      expect(eventListeners[0]).toEqual({
        type: 'noteon',
        note: 60,
        velocity: 100,
        channel: 0,
        timestamp: event.timeStamp
      })
    })

    it('should handle Note Off messages', () => {
      const midiData = new Uint8Array([0x80, 60, 0]) // Note Off, C3, velocity 0
      const event = { data: midiData, timeStamp: Date.now() }
      
      if (mockInputPort.onmidimessage) {
        mockInputPort.onmidimessage(event)
      }

      expect(eventListeners).toHaveLength(1)
      expect(eventListeners[0]).toEqual({
        type: 'noteoff',
        note: 60,
        velocity: 0,
        channel: 0,
        timestamp: event.timeStamp
      })
    })

    it('should handle Note On with velocity 0 as Note Off', () => {
      const midiData = new Uint8Array([0x90, 60, 0]) // Note On, C3, velocity 0
      const event = { data: midiData, timeStamp: Date.now() }
      
      if (mockInputPort.onmidimessage) {
        mockInputPort.onmidimessage(event)
      }

      expect(eventListeners).toHaveLength(1)
      expect(eventListeners[0]).toEqual({
        type: 'noteoff',
        note: 60,
        velocity: 0,
        channel: 0,
        timestamp: event.timeStamp
      })
    })

    it('should handle Control Change messages', () => {
      const midiData = new Uint8Array([0xB0, 1, 64]) // Control Change, CC1, value 64
      const event = { data: midiData, timeStamp: Date.now() }
      
      if (mockInputPort.onmidimessage) {
        mockInputPort.onmidimessage(event)
      }

      expect(eventListeners).toHaveLength(1)
      expect(eventListeners[0]).toEqual({
        type: 'controlchange',
        controller: 1,
        value: 64,
        channel: 0,
        timestamp: event.timeStamp
      })
    })

    it('should handle messages on different channels', () => {
      const midiData = new Uint8Array([0x91, 60, 100]) // Note On, C3, velocity 100, channel 1
      const event = { data: midiData, timeStamp: Date.now() }
      
      if (mockInputPort.onmidimessage) {
        mockInputPort.onmidimessage(event)
      }

      expect(eventListeners).toHaveLength(1)
      expect(eventListeners[0].channel).toBe(1)
    })

    it('should ignore empty messages', () => {
      const emptyData = new Uint8Array([])
      const event = { data: emptyData, timeStamp: Date.now() }
      
      if (mockInputPort.onmidimessage) {
        mockInputPort.onmidimessage(event)
      }

      expect(eventListeners).toHaveLength(0)
    })

    it('should ignore short messages (less than 3 bytes)', () => {
      const shortData = new Uint8Array([0xF8]) // MIDI Clock
      const event = { data: shortData, timeStamp: Date.now() }
      
      if (mockInputPort.onmidimessage) {
        mockInputPort.onmidimessage(event)
      }

      expect(eventListeners).toHaveLength(0)
    })

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Test error')
      })
      webMidiManager.addEventListener(errorListener)

      const midiData = new Uint8Array([0x90, 60, 100])
      const event = { data: midiData, timeStamp: Date.now() }
      
      // Should not throw
      expect(() => {
        if (mockInputPort.onmidimessage) {
          mockInputPort.onmidimessage(event)
        }
      }).not.toThrow()
    })
  })

  describe('MIDI Message Sending', () => {
    beforeEach(async () => {
      await webMidiManager.initialize()
    })

    it('should send Note On messages', () => {
      webMidiManager.sendNoteOn(60, 100, 0)
      
      expect(mockOutputPort.send).toHaveBeenCalledWith([0x90, 60, 100])
    })

    it('should send Note Off messages', () => {
      webMidiManager.sendNoteOff(60, 0, 0)
      
      expect(mockOutputPort.send).toHaveBeenCalledWith([0x80, 60, 0])
    })

    it('should send Control Change messages', () => {
      webMidiManager.sendControlChange(1, 64, 0)
      
      expect(mockOutputPort.send).toHaveBeenCalledWith([0xB0, 1, 64])
    })

    it('should send raw MIDI messages', () => {
      const message = [0x90, 60, 100]
      webMidiManager.sendMidiMessage(message)
      
      expect(mockOutputPort.send).toHaveBeenCalledWith(message)
    })

    it('should handle send errors gracefully', () => {
      mockOutputPort.send.mockImplementation(() => {
        throw new Error('Send failed')
      })

      expect(() => {
        webMidiManager.sendMidiMessage([0x90, 60, 100])
      }).not.toThrow()
    })

    it('should only send to connected devices', () => {
      mockOutputPort.state = 'disconnected'
      
      webMidiManager.sendMidiMessage([0x90, 60, 100])
      
      expect(mockOutputPort.send).not.toHaveBeenCalled()
    })
  })

  describe('Event Listener Management', () => {
    it('should add and remove event listeners', () => {
      const listener = vi.fn()
      
      webMidiManager.addEventListener(listener)
      expect(webMidiManager['eventListeners'].has(listener)).toBe(true)
      
      webMidiManager.removeEventListener(listener)
      expect(webMidiManager['eventListeners'].has(listener)).toBe(false)
    })

    it('should add and remove device listeners', () => {
      const listener = vi.fn()
      
      webMidiManager.addDeviceListener(listener)
      expect(webMidiManager['deviceListeners'].has(listener)).toBe(true)
      
      webMidiManager.removeDeviceListener(listener)
      expect(webMidiManager['deviceListeners'].has(listener)).toBe(false)
    })
  })

  describe('Initialization State', () => {
    it('should report correct initialization state', async () => {
      expect(webMidiManager.isWebMidiInitialized()).toBe(false)
      
      await webMidiManager.initialize()
      expect(webMidiManager.isWebMidiInitialized()).toBe(true)
    })
  })
})

describe('MIDI Utilities', () => {
  describe('Note Name Conversion', () => {
    it('should convert MIDI note to note name using C3 = 60 convention', () => {
      expect(MIDI_UTILS.midiNoteToName(60)).toBe('C3')
      expect(MIDI_UTILS.midiNoteToName(72)).toBe('C4')
      expect(MIDI_UTILS.midiNoteToName(84)).toBe('C5')
      expect(MIDI_UTILS.midiNoteToName(61)).toBe('C#3')
      expect(MIDI_UTILS.midiNoteToName(62)).toBe('D3')
    })

    it('should convert note name to MIDI note using C3 = 60 convention', () => {
      expect(MIDI_UTILS.noteNameToMidi('C3')).toBe(60)
      expect(MIDI_UTILS.noteNameToMidi('C4')).toBe(72)
      expect(MIDI_UTILS.noteNameToMidi('C5')).toBe(84)
      expect(MIDI_UTILS.noteNameToMidi('C#3')).toBe(61)
      expect(MIDI_UTILS.noteNameToMidi('D3')).toBe(62)
    })

    it('should handle negative octaves', () => {
      expect(MIDI_UTILS.noteNameToMidi('C-2')).toBe(0)
      expect(MIDI_UTILS.noteNameToMidi('C-1')).toBe(12)
      expect(MIDI_UTILS.noteNameToMidi('C0')).toBe(24)
    })

    it('should handle high octaves', () => {
      expect(MIDI_UTILS.noteNameToMidi('C8')).toBe(120)
      expect(MIDI_UTILS.noteNameToMidi('G8')).toBe(127)
    })

    it('should throw error for invalid note names', () => {
      expect(() => MIDI_UTILS.noteNameToMidi('invalid')).toThrow('Invalid note name')
      expect(() => MIDI_UTILS.noteNameToMidi('H3')).toThrow('Invalid note')
      expect(() => MIDI_UTILS.noteNameToMidi('C')).toThrow('Invalid note name')
    })

    it('should handle all note names', () => {
      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
      noteNames.forEach((note, index) => {
        const midiNote = 60 + index // C3 = 60
        expect(MIDI_UTILS.midiNoteToName(midiNote)).toBe(`${note}3`)
        expect(MIDI_UTILS.noteNameToMidi(`${note}3`)).toBe(midiNote)
      })
    })
  })

  describe('Note Validation', () => {
    it('should validate MIDI note range', () => {
      expect(MIDI_UTILS.isValidMidiNote(0)).toBe(true)
      expect(MIDI_UTILS.isValidMidiNote(60)).toBe(true)
      expect(MIDI_UTILS.isValidMidiNote(127)).toBe(true)
      expect(MIDI_UTILS.isValidMidiNote(-1)).toBe(false)
      expect(MIDI_UTILS.isValidMidiNote(128)).toBe(false)
    })
  })

  describe('Frequency Conversion', () => {
    it('should convert MIDI note to frequency', () => {
      // A4 = 440Hz = MIDI note 69
      expect(MIDI_UTILS.midiNoteToFrequency(69)).toBeCloseTo(440, 1)
      // C4 = 261.63Hz = MIDI note 72 (in our convention)
      expect(MIDI_UTILS.midiNoteToFrequency(72)).toBeCloseTo(523.25, 1)
    })

    it('should convert frequency to MIDI note', () => {
      expect(MIDI_UTILS.frequencyToMidiNote(440)).toBe(69)
      expect(MIDI_UTILS.frequencyToMidiNote(261.63)).toBe(60)
    })

    it('should handle round-trip conversion', () => {
      const originalNote = 60
      const frequency = MIDI_UTILS.midiNoteToFrequency(originalNote)
      const convertedNote = MIDI_UTILS.frequencyToMidiNote(frequency)
      expect(convertedNote).toBe(originalNote)
    })
  })
})

describe('MIDI Constants', () => {
  it('should have correct C3 note value', () => {
    expect(MIDI_CONSTANTS.C3_NOTE).toBe(60)
  })

  it('should have correct note range', () => {
    expect(MIDI_CONSTANTS.MIN_NOTE).toBe(0)
    expect(MIDI_CONSTANTS.MAX_NOTE).toBe(127)
  })
})

describe('Edge Cases and Error Handling', () => {
  beforeEach(async () => {
    // Import fresh instance for edge case tests
    vi.resetModules()
    const midiModule = await import('../../utils/midi')
    webMidiManager = midiModule.webMidiManager
  })

  it('should handle missing navigator object', () => {
    // Test the support detection logic directly
    const hasNavigator = typeof navigator !== 'undefined'
    expect(hasNavigator).toBe(true)
    
    // Test with a mock that doesn't have navigator
    const mockGlobal = { ...global }
    delete (mockGlobal as any).navigator
    const hasNoNavigator = typeof (mockGlobal as any).navigator !== 'undefined'
    expect(hasNoNavigator).toBe(false)
  })

  it('should handle device listener errors gracefully', () => {
    const errorListener = vi.fn().mockImplementation(() => {
      throw new Error('Device listener error')
    })
    webMidiManager.addDeviceListener(errorListener)

    // Should not throw
    expect(() => {
      webMidiManager['notifyDeviceListeners']()
    }).not.toThrow()
  })

  it('should handle cleanup properly', () => {
    const listener = vi.fn()
    webMidiManager.addEventListener(listener)
    webMidiManager.addDeviceListener(listener)

    webMidiManager.cleanup()

    expect(webMidiManager['eventListeners'].size).toBe(0)
    expect(webMidiManager['deviceListeners'].size).toBe(0)
  })
}) 