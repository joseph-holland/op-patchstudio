# Audio Player Hook

The `useAudioPlayer` hook provides a centralized way to handle audio playback across the application. This replaces the scattered audio playback implementations that were previously duplicated across different components.

## Features

- **Centralized Audio Management**: All audio playback goes through a single hook
- **Automatic Cleanup**: Stops previous playback when starting new audio
- **Advanced Options**: Support for gain, pan, playback rate, and reverse
- **Selection Playback**: Play specific time ranges from audio buffers
- **State Management**: Track playback state and timing information

## Usage

### Basic Usage

```tsx
import { useAudioPlayer } from '../hooks/useAudioPlayer';

function MyComponent() {
  const { playAudioBuffer, stop, getState } = useAudioPlayer();

  const handlePlay = async () => {
    if (audioBuffer) {
      await playAudioBuffer(audioBuffer);
    }
  };

  const handleStop = () => {
    stop();
  };

  const state = getState();
  console.log('Is playing:', state.isPlaying);
}
```

### Playing Audio Selections

```tsx
const { playSelection } = useAudioPlayer();

const handlePlaySelection = async () => {
  if (audioBuffer) {
    // Play from frame 1000 to frame 5000
    await playSelection(audioBuffer, 1000, 5000);
  }
};
```

### Advanced Options

```tsx
const { playAudioBuffer } = useAudioPlayer();

const handlePlayWithEffects = async () => {
  if (audioBuffer) {
    await playAudioBuffer(audioBuffer, {
      playbackRate: 2.0,    // Play at 2x speed
      gain: -6,             // -6dBFS volume reduction
      pan: 50,              // 50% right pan
      reverse: true,        // Reverse the audio
      startTime: 1.0,       // Start at 1 second
      duration: 2.0,        // Play for 2 seconds
    });
  }
};
```

## API Reference

### `playAudioBuffer(audioBuffer, options?)`

Plays an AudioBuffer with optional effects.

**Parameters:**
- `audioBuffer`: The AudioBuffer to play
- `options`: Optional playback settings
  - `startTime`: Start time in seconds (default: 0)
  - `duration`: Duration to play in seconds (default: full buffer)
  - `playbackRate`: Playback speed multiplier (default: 1.0)
  - `gain`: Volume in dBFS (default: 0)
  - `pan`: Stereo pan position -100 to 100 (default: 0)
  - `reverse`: Reverse the audio (default: false)

**Returns:** Promise<boolean> - true if playback started successfully

### `playSelection(audioBuffer, inFrame, outFrame, options?)`

Plays a selection from an AudioBuffer.

**Parameters:**
- `audioBuffer`: The AudioBuffer to play
- `inFrame`: Start frame number
- `outFrame`: End frame number
- `options`: Same as playAudioBuffer (except startTime/duration are calculated from frames)

**Returns:** Promise<boolean> - true if playback started successfully

### `stop()`

Stops current playback and cleans up audio nodes.

### `getState()`

Returns current playback state.

**Returns:**
```tsx
{
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}
```

## Migration Guide

### From Direct WebAudioAPI Usage

**Before:**
```tsx
const playSample = async () => {
  const audioContext = await audioContextManager.getAudioContext();
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start(0);
};
```

**After:**
```tsx
const { playAudioBuffer } = useAudioPlayer();

const playSample = async () => {
  await playAudioBuffer(audioBuffer);
};
```

### From Selection Playback

**Before:**
```tsx
const playSelection = async () => {
  const audioContext = await audioContextManager.getAudioContext();
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  const startOffset = (inFrame / audioBuffer.length) * audioBuffer.duration;
  const endOffset = (outFrame / audioBuffer.length) * audioBuffer.duration;
  const duration = endOffset - startOffset;
  source.connect(audioContext.destination);
  source.start(0, startOffset, duration);
};
```

**After:**
```tsx
const { playSelection } = useAudioPlayer();

const playSelection = async () => {
  await playSelection(audioBuffer, inFrame, outFrame);
};
```

## Benefits

1. **Consistency**: All audio playback uses the same code path
2. **Maintainability**: Changes to audio logic only need to be made in one place
3. **Features**: Easy to add effects, filters, and advanced audio processing
4. **Memory Management**: Automatic cleanup prevents memory leaks
5. **Testing**: Centralized audio logic is easier to test and mock
6. **Single AudioContext**: Uses the shared `audioContextManager` singleton for all audio operations

## Architecture

The `useAudioPlayer` hook integrates with the existing `audioContextManager` singleton to ensure all audio playback across the application uses the same WebAudioAPI context:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Components    │    │  useAudioPlayer  │    │ audioContextMgr │
│                 │    │      Hook        │    │   (Singleton)   │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ • Zoom Modal    │───▶│ • playAudioBuffer│───▶│ • Single        │
│ • Drum Keyboard │    │ • playSelection  │    │   AudioContext  │
│ • Sample Tables │    │ • stop           │    │ • State Mgmt    │
│ • etc.          │    │ • getState       │    │ • Cleanup       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### AudioContext Integration Benefits

- **Prevents memory leaks** from multiple audio contexts
- **Maintains consistent sample rate** across all audio
- **Handles browser autoplay policies** centrally
- **Provides unified state management** for the audio context
- **Ensures efficient resource usage** across the entire application 