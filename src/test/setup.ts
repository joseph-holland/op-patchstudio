import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Audio APIs that aren't available in jsdom
global.AudioContext = vi.fn().mockImplementation(() => ({
  createBufferSource: vi.fn(() => ({
    buffer: null,
    connect: vi.fn(() => ({ connect: vi.fn() })),
    start: vi.fn(),
    stop: vi.fn(),
    playbackRate: { value: 1 }
  })),
  createBuffer: vi.fn(),
  createGain: vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(() => ({ connect: vi.fn() }))
  })),
  createStereoPanner: vi.fn(() => ({
    pan: { value: 0 },
    connect: vi.fn(() => ({ connect: vi.fn() }))
  })),
  destination: {},
  sampleRate: 44100,
  state: 'running',
  resume: vi.fn(() => Promise.resolve()),
  suspend: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
  decodeAudioData: vi.fn(() => Promise.resolve({}))
}))

// Mock MediaRecorder
const MediaRecorderMock = function (this: any) {
  this.start = vi.fn()
  this.stop = vi.fn()
  this.pause = vi.fn()
  this.resume = vi.fn()
  this.state = 'inactive'
  this.ondataavailable = null
  this.onstop = null
  this.onerror = null
}
MediaRecorderMock.isTypeSupported = vi.fn(() => true)

global.MediaRecorder = MediaRecorderMock as any

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn(() => Promise.resolve({
      getTracks: () => []
    }))
  }
})

// Mock JSZip
vi.mock('jszip', () => ({
  default: vi.fn().mockImplementation(() => ({
    file: vi.fn(),
    generateAsync: vi.fn(() => Promise.resolve(new Blob()))
  }))
}))

// Mock File API methods
global.URL.createObjectURL = vi.fn(() => 'mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock localStorage and sessionStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
}
global.localStorage = localStorageMock as any
global.sessionStorage = localStorageMock as any