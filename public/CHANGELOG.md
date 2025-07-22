# changelog

all notable changes to this project will be documented in this file.

the format is based on [keep a changelog](https://keepachangelog.com/en/1.0.0/).

## [0.14.5] - 2025-07-22

### fixed
- issue 66 drum tool tuning and transpose not working correctly
- issue 65 drum tool export, missing gain and pan, tune, transpose not applying to patch.json
- issue 63 incorrect sample assignment
- issue 62 drum keyboard incorrect layout

## [0.14.4] - 2025-07-22

### changed
- envelope tool in multisample adsr now defaults to 'keys' preset values instead of generating random values when empty

### fixed
- issue with multisample tool sample zone mapping that caused c4 samples to be incorrectly assigned to all lower notes
- changed default adsr in multisample preset from 'random' to 'keys' in multisample tool for more consistent, musical starting point
- preset name is now always reset to empty string on page reload while preserving other user preferences

## [0.14.3] - 2025-07-19

### fixed
- fixed small regression with main tabs focus

## [0.14.2] - 2025-07-19

### fixed
- fixed some duplicate page issues
- additional accessibility for main tabs
- css fixes

## [0.14.1] - 2025-07-18

### fixed
- fixed some small ui issues

## [0.14.0] - 2025-07-17

### added
- 12 and 8-bit export options
- aiff file export

### fixed
- fixed clicks on loops

## [0.13.3] - 2025-07-16

### added
- option to always try and snap markers to zero crossings on import

### fixed
- fixed -dbfs limiter being applied to samples on export

## [0.13.2] - 2025-07-16

### added
- drag and drop support to drum sample management table

### fixed
- fixed loading of drum samples allowing more than 24 to be loaded

## [0.13.1] - 2025-07-16

### fixed
- fixed aif metadata parsing issue causing incorrect loop points to be loaded

## [0.13.0] - 2025-07-15

### added
- import OP-1 and OP-1 field drum presets (.preset.zip files) with automatic parsing and sample extraction
- new op1DrumPresetParser utility for reading and parsing OP-1/OP-1 field preset files
- support for importing existing drum presets to use as starting points for new patches

### fixed
- fixed advanced preset settings not saving to defaults in multisample tool
- restored proper component styling and structure for multisample preset settings
- fixed synchronization between local component state and global app state for preset settings

## [0.12.1] - 2025-07-15

### fixed
- fixed bug in the declineSessionRestoration function

## [0.12.0] - 2025-07-15

### added
- multisample and drum patch export now supports importing audio in multiple formats (mp3, ogg, flac, aif, wav, etc.)
- all imported audio formats are automatically converted to wav on export, ensuring consistent patch compatibility

### fixed
- fixed an issue where original file extensions could be preserved in exports; all exported files now use the .wav extension

### changed
- improved test coverage for patch export logic to guarantee only wav files are included in exported patches

## [0.11.1] - 2025-07-15

### fixed
- fixed: root note and loop points are now properly saved in output wav files for both drum and multisample tools
- enhanced wav generation to include smpl chunks with metadata (root note, loop start/end points)
- multisample wav files now include smpl metadata even when no audio conversion is needed
- fixed multiple critical bugs: drum sample loading limit logic, unused parameters, regex escape characters, variable declarations, case statement scoping, react hook dependencies, typescript comments, and cleaned up all debugging console messages for production readiness

## [0.11.0] - 2025-07-15

### added
- users can now save all patch settings (including adsr envelope, filter, and hidden/imported settings) as their personal defaults for both drum and multisample tools
- default settings are now stored in cookies with a new structure that preserves both ui and imported preset data
- new utility functions for saving/loading/clearing default settings, including support for advanced and hidden parameters
- new test coverage for default settings logic and backward compatibility
- version update script is now fully non-interactive and can be run in ci/cd

### changed
- default settings system now loads all saved parameters, including those not visible in the ui, on app startup
- app context and tool components updated to support new default settings structure
- changelog and version update workflow improved for automation

### fixed
- fixed: default settings now persist all advanced and imported parameters, not just visible ui fields
- fixed: type errors and test coverage for new default settings logic

## [0.10.1] - 2025-07-14

### added
- n/a

### changed
- n/a

### fixed
- improved desktop layout: reduced max-width from 1400px to 1000px to keep content more compact and proportional to drum tool keyboard size

## [0.10.0] - 2025-07-14

### added
- file renaming feature for generated presets: users can now choose to rename all exported sample files with the preset name
- filename separator options: choose between space ' ' or hyphen '-' for generated filenames
- drum sample filenames now use short drum key labels (e.g., kd1, clp, tri) for OP-XY compatibility
- ui controls for file renaming and separator selection, with responsive layout for desktop and mobile

### changed
- all generated filenames are now fully OP-XY compliant: only a-z, 0-9, space, #, -, (, ), and dot are allowed; underscores are no longer supported
- all internal separators in preset names are normalized to the selected separator
- improved layout and alignment of the "generate preset" section for better usability

### fixed
- type errors and test coverage for new file renaming logic and state
- ensured all test mocks and state objects include new file renaming properties

## [0.9.0] - 2025-07-13

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
- OP-XY preset generation (.opxydrum and .opxymulti files)
- advanced preset settings and configuration

### changed
- n/a

### fixed
- n/a 