# changelog

all notable changes to this project will be documented in this file.

the format is based on [keep a changelog](https://keepachangelog.com/en/1.0.0/).

## [0.10.0] - 2025-07-15

### added
- file renaming feature for generated presets: users can now choose to rename all exported sample files with the preset name.
- filename separator options: choose between space ' ' or hyphen '-' for generated filenames.
- drum sample filenames now use short drum key labels (e.g., kd1, clp, tri) for op-xy compatibility.
- ui controls for file renaming and separator selection, with responsive layout for desktop and mobile.

### changed
- all generated filenames are now fully op-xy compliant: only a-z, a-z, 0-9, space, #, -, (, ), and dot are allowed; underscores are no longer supported.
- all internal separators in preset names are normalized to the selected separator.
- improved layout and alignment of the "generate preset" section for better usability.

### fixed
- type errors and test coverage for new file renaming logic and state.
- ensured all test mocks and state objects include new file renaming properties.

## [0.9.0] - 2025-07-14

### changed
- switched all audio normalization from rms to peak normalization for more consistent results
- transparent limiter is now always applied by default to prevent clipping in all exported audio

### fixed
- prevented all possible output clipping by enforcing limiter in the audio processing pipeline

## [0.8.0] - 2025-07-11

### added
- version number display in footer with link to changelog
- changelog.md file for tracking changes
- version management utility (`src/utils/version.ts`)
- version management rule for consistent updates
- dynamic version loading from manifest.json
- comprehensive version update script for automated version management

### changed
- updated manifest.json to include version field
- enhanced footer with version information

### fixed
- n/a

## [0.7.0] - 2025-07-10

### added
- midi device integration with web midi api
- adsr envelope controls for real-time parameter adjustment
- configurable midi note mapping (c3=60 or c4=60)
- real-time audio parameter adjustment while playing

### changed
- enhanced audio playback with new audio player system
- improved midi keyboard interaction

### fixed
- double preset loading bug
- mobile keyboard interaction issues
- default midi channel configuration
- midi mapping bugs

## [0.6.0] - 2025-07-09

### added
- complete library system for preset management
- bulk operations for drum samples (edit, clear)
- preset saving and loading with indexeddb storage
- library pagination and filtering
- preset favorites and search functionality
- preset download and export capabilities

### changed
- enhanced ui with improved tables and tooltips
- better mobile experience with scrolling tabs
- updated library page with comprehensive preset management

### fixed
- library saving and loading bugs
- gain calculation issues
- string.prototype.substr deprecation warnings

## [0.5.0] - 2025-07-08

### added
- session restoration with 12-hour persistence
- rms normalization for audio samples
- cut at loop end functionality for multisample presets
- load confirmation prompts for session safety

### changed
- enhanced session management with automatic restoration
- updated preset generation with normalization support

### fixed
- restore session bugs
- loop point calculation issues

## [0.4.0] - 2025-07-07

### added
- pwa (progressive web app) support with offline functionality
- feedback page for bug reports
- loop point editing and management
- mobile rotation overlay for better ux

### changed
- enhanced mobile experience with proper rotation handling
- improved offline app installation prompts
- better session persistence across browser sessions

### fixed
- pwa rotation issues
- offline install prompt behavior

## [0.3.0] - 2025-07-06

### added
- new audio player system with playmode support
- enhanced preset export functionality
- pre-commit hooks for testing and build validation
- enhanced test coverage and build process

### changed
- improved audio processing pipeline
- better preset generation workflow
- updated build process with comprehensive testing
- enhanced code quality with automated validation

### fixed
- preset export bugs
- audio context management issues
- recording modal bugs
- typescript compilation errors
- build process issues
- test coverage reporting

## [0.2.0] - 2025-07-05

### added
- enhanced waveform editor with zoom and pan functionality
- advanced sample editing capabilities
- real-time audio playback controls
- improved mobile keyboard interface
- complete ui overhaul with modern interface

### changed
- enhanced mobile responsiveness
- improved waveform visualization
- better ui consistency across components
- enhanced mobile experience

### fixed
- waveform rendering issues
- mobile keyboard bugs
- audio playback problems
- ui layout inconsistencies
- theme and color issues
- file import bugs

## [0.1.0] - 2025-07-01

### added
- forked from [buba447/opxy-drum-tool](https://github.com/buba447/opxy-drum-tool) by zeitgeese
- basic drum preset creation tool (24 slots)
- basic multisample preset creation tool
- drag-and-drop sample loading
- op-xy preset generation (.opxydrum and .opxymulti files)
- advanced preset settings and configuration

### changed
- n/a

### fixed
- n/a

## [unreleased]

### added
- n/a

### changed
- n/a

### fixed
- n/a 