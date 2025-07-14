# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.10.0] - 2025-07-15

### Added
- File renaming feature for generated presets: users can now choose to rename all exported sample files with the preset name.
- Filename separator options: choose between space ' ' or hyphen '-' for generated filenames.
- Drum sample filenames now use short drum key labels (e.g., KD1, CLP, TRI) for OP-XY compatibility.
- UI controls for file renaming and separator selection, with responsive layout for desktop and mobile.

### Changed
- All generated filenames are now fully OP-XY compliant: only a-z, A-Z, 0-9, space, #, -, (, ), and dot are allowed; underscores are no longer supported.
- All internal separators in preset names are normalized to the selected separator.
- Improved layout and alignment of the "generate preset" section for better usability.

### Fixed
- Type errors and test coverage for new file renaming logic and state.
- Ensured all test mocks and state objects include new file renaming properties.

## [0.9.0] - 2025-07-14

### Changed
- Switched all audio normalization from RMS to peak normalization for more consistent results
- Transparent limiter is now always applied by default to prevent clipping in all exported audio

### Fixed
- Prevented all possible output clipping by enforcing limiter in the audio processing pipeline

## [0.8.0] - 2025-07-11

### Added
- Version number display in footer with link to CHANGELOG
- CHANGELOG.md file for tracking changes
- Version management utility (`src/utils/version.ts`)
- Version management rule for consistent updates
- Dynamic version loading from manifest.json
- Comprehensive version update script for automated version management

### Changed
- Updated manifest.json to include version field
- Enhanced footer with version information

### Fixed
- N/A

## [0.7.0] - 2025-07-10

### Added
- MIDI device integration with Web MIDI API
- ADSR envelope controls for real-time parameter adjustment
- Configurable MIDI note mapping (C3=60 or C4=60)
- Real-time audio parameter adjustment while playing

### Changed
- Enhanced audio playback with new audio player system
- Improved MIDI keyboard interaction

### Fixed
- Double preset loading bug
- Mobile keyboard interaction issues
- Default MIDI channel configuration
- MIDI mapping bugs

## [0.6.0] - 2025-07-09

### Added
- Complete library system for preset management
- Bulk operations for drum samples (edit, clear)
- Preset saving and loading with IndexedDB storage
- Library pagination and filtering
- Preset favorites and search functionality
- Preset download and export capabilities

### Changed
- Enhanced UI with improved tables and tooltips
- Better mobile experience with scrolling tabs
- Updated library page with comprehensive preset management

### Fixed
- Library saving and loading bugs
- Gain calculation issues
- String.prototype.substr deprecation warnings

## [0.5.0] - 2025-07-08

### Added
- Session restoration with 12-hour persistence
- RMS normalization for audio samples
- Cut at loop end functionality for multisample presets
- Load confirmation prompts for session safety

### Changed
- Enhanced session management with automatic restoration
- Updated preset generation with normalization support

### Fixed
- Restore session bugs
- Loop point calculation issues

## [0.4.0] - 2025-07-07

### Added
- PWA (Progressive Web App) support with offline functionality
- Feedback page for bug reports
- Loop point editing and management
- Mobile rotation overlay for better UX

### Changed
- Enhanced mobile experience with proper rotation handling
- Improved offline app installation prompts
- Better session persistence across browser sessions

### Fixed
- PWA rotation issues
- Offline install prompt behavior

## [0.3.0] - 2025-07-06

### Added
- New audio player system with playmode support
- Enhanced preset export functionality
- Pre-commit hooks for testing and build validation
- Enhanced test coverage and build process

### Changed
- Improved audio processing pipeline
- Better preset generation workflow
- Updated build process with comprehensive testing
- Enhanced code quality with automated validation

### Fixed
- Preset export bugs
- Audio context management issues
- Recording modal bugs
- TypeScript compilation errors
- Build process issues
- Test coverage reporting

## [0.2.0] - 2025-07-05

### Added
- Enhanced waveform editor with zoom and pan functionality
- Advanced sample editing capabilities
- Real-time audio playback controls
- Improved mobile keyboard interface
- Complete UI overhaul with modern interface

### Changed
- Enhanced mobile responsiveness
- Improved waveform visualization
- Better UI consistency across components
- Enhanced mobile experience

### Fixed
- Waveform rendering issues
- Mobile keyboard bugs
- Audio playback problems
- UI layout inconsistencies
- Theme and color issues
- File import bugs

## [0.1.0] - 2025-07-01

### Added
- Forked from [buba447/opxy-drum-tool](https://github.com/buba447/opxy-drum-tool) by zeitgeese
- Basic drum preset creation tool (24 slots)
- Basic multisample preset creation tool
- Drag-and-drop sample loading
- OP-XY preset generation (.opxydrum and .opxymulti files)
- Advanced preset settings and configuration

### Changed
- N/A

### Fixed
- N/A

## [Unreleased]

### Added
- N/A

### Changed
- N/A

### Fixed
- N/A 