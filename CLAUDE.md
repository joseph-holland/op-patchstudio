# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start development server (Vite)
- `npm run build` - Build for production (TypeScript + Vite)
- `npm run preview` - Preview production build

### Testing
- `npm run test` - Run tests (Vitest)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI interface
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:e2e` - Run end-to-end tests (Playwright)
- `npm run test:e2e:ui` - Run e2e tests with UI

### Quality & Build Checks
- `npm run lint` - Run ESLint
- `npm run pre-commit` - Run tests and build (required before committing)

## Project Architecture

### Application Structure
OP-PatchStudio is a React + TypeScript Progressive Web App for creating presets for OP-XY synthesizers. The app has two main modes:

1. **Drum Tool** - 24 sample slots for drum presets
2. **Multisample Tool** - Up to 24 zones for chromatic/melodic presets

### Core Technologies
- **React 19** with TypeScript
- **Carbon Design System** - IBM's design system for UI components
- **Vite** - Build tool and dev server
- **Vitest** - Unit testing
- **Playwright** - E2E testing
- **WebAudioAPI** - Audio processing and playback
- **IndexedDB** - Local storage for presets and session management

### Key Architecture Patterns

#### State Management
- **Context + useReducer** pattern in `src/context/AppContext.tsx`
- Single source of truth for all application state
- Strongly typed actions and state shapes
- Automatic cookie persistence for user preferences

#### Audio Processing
- **Centralized AudioContext** via `audioContextManager` singleton
- **useAudioPlayer** hook for consistent audio playback across components
- WebAudioAPI for sample processing, format conversion, and effects
- Support for WAV and AIFF formats with metadata parsing

#### Component Organization
```
src/components/
├── common/        # Shared UI components
├── drum/          # Drum-specific components  
├── multisample/   # Multisample-specific components
└── library/       # Library management components
```

#### Custom Hooks Pattern
Located in `src/hooks/` - encapsulate complex logic:
- `useFileUpload.ts` - File drag/drop and processing
- `usePatchGeneration.ts` - Preset generation logic
- `useAudioPlayer.ts` - Centralized audio playback
- `useSessionManagement.ts` - Session persistence
- `useWebMidi.ts` - MIDI device integration

#### Utility Architecture
`src/utils/` contains pure functions organized by domain:
- `audio.ts` - Audio processing utilities
- `patchGeneration.ts` - OP-XY preset format generation
- `audioFormats.ts` - WAV/AIFF parsing and metadata extraction
- `indexedDB.ts` - Browser storage operations

### Critical Implementation Details

#### OP-XY Preset Compatibility
- Must follow exact JSON schema in `baseDrumJson.ts` and `baseMultisampleJson.ts`
- Sample rate conversion (44.1kHz/22kHz/11kHz)
- Bit depth handling (8-bit to 32-bit float)
- Proper loop point and metadata handling

#### Audio Processing Pipeline
1. File upload → metadata extraction
2. AudioBuffer creation via WebAudioAPI
3. Optional processing (normalize, zero-crossing, effects)
4. Format conversion and export
5. ZIP generation with proper OP-XY folder structure

#### Progressive Web App Features
- Service worker for offline functionality
- File system access for drag/drop
- Audio processing without server dependency
- Auto-installing PWA with manifest

### Development Guidelines

#### TypeScript Standards
- Strong typing required - avoid `any` type
- Interface definitions for all data structures
- Proper error handling with typed exceptions

#### Code Quality
- No console.log statements in production code
- Remove debug logging after fixing issues
- Follow existing Carbon Design System patterns
- Maintain consistent audio processing approach using centralized hooks

#### Testing Strategy
- Unit tests for utilities and hooks
- Component tests for UI interactions
- E2E tests for critical user workflows
- Audio processing tests with mock AudioContext

#### Performance Considerations
- Large audio file handling via streaming
- Memory management for AudioBuffers
- IndexedDB for persistent storage without blocking UI
- Efficient waveform visualization for large samples