# OP-PatchStudio

**free & open source preset creator for OP synthesizers. upload samples, edit waveforms, adjust settings and generate patches instantly.**

![op-patchstudio preview](public/assets/preview-image.png)

![OP-PatchStudio preview](public/assets/preview-image-2.png)

- **live demo:** [OP-PatchStudio](https://op-patch.studio/)
- **github:** [github.com/joseph-holland/op-patchstudio](https://github.com/joseph-holland/op-patchstudio)

## features

### core functionality
- **comprehensive preset generation** for OP synthesizers (currently OP-XY, more devices coming soon)
- **modern, responsive ui** built with react, typescript, and carbon design system  
- **drag-and-drop sample assignment** for drum and multisample presets
- **real-time audio processing** with sample rate conversion (44/22/11khz) and format optimization
- **accessibility-compliant interface** with wcag aa touch targets and keyboard navigation
- **live patch size monitoring** with optimization recommendations

### drum tool (24 slots)
- **virtual drum keyboard** with OP-XY key mapping (w, e, r, y, u, a, s, d, f, g, h, j)
- **bulk operations** for editing and clearing multiple samples at once
- **individual sample settings** including playmode, reverse, tune, pan, and gain
- **waveform editing** with in/out point markers and snap-to-zero-crossing
- **sample recording** with device selection and real-time waveform visualization
- **OP-1 preset import** support for loading existing drum presets
- **unassigned sample management** for samples beyond the 24 drum keys

### multisample tool (up to 24 zones)
- **virtual midi keyboard** with note assignment and zone mapping
- **automatic note detection** from filename parsing (c4, f#3, etc.)
- **loop point editing** with start/end markers and loop visualization
- **midi note mapping toggle** between c3=60 and c4=60 conventions
- **adsr envelope presets** with randomization and custom settings
- **advanced preset settings** including envelopes, tuning, velocity sensitivity, and modulation
- **real-time sample playback** with pitch shifting and adsr envelopes

### audio processing
- **advanced waveform editing** with interactive zoom modal and marker adjustment
- **snap-to-zero-crossing** functionality for clean sample trimming
- **audio normalization** with peak detection and configurable levels
- **transparent limiter** to prevent clipping and ensure consistent levels
- **format conversion** between wav and aiff with metadata preservation
- **sample rate conversion** with quality preservation
- **bit depth conversion** (8-bit, 12-bit, 16-bit, 24-bit, 32-bit)
- **channel conversion** (mono/stereo)
- **gain adjustment** with precise dbfs control
- **cut at loop end** functionality for multisample presets

### library system
- **preset management** with save, load, and organize capabilities
- **indexeddb storage** for local preset persistence
- **search and filtering** by type, favorites, and keywords
- **bulk operations** for deleting multiple presets
- **preset favorites** with star rating system
- **pagination** for large preset collections
- **preset metadata** including sample counts and descriptions
- **export capabilities** for sharing presets

### session management
- **automatic session saving** with 12-hour persistence
- **session restoration** with confirmation dialogs
- **cross-browser persistence** using indexeddb
- **session state recovery** for samples, settings, and metadata

### recording capabilities
- **built-in audio recording** with microphone access
- **device selection** for multiple audio inputs
- **real-time waveform visualization** during recording
- **recording time limits** with auto-stop functionality
- **playback preview** of recorded samples
- **automatic metadata embedding** (root note, loop points)
- **filename customization** with timestamp generation

### midi integration
- **webmidi api support** for midi keyboard and controller input
- **midi device detection** and connection management
- **midi channel selection** for multi-device setups
- **real-time midi note mapping** to drum and multisample keys
- **visual feedback** for midi-triggered keys
- **velocity sensitivity** support for expressive playing

### file management
- **drag-and-drop upload** with visual feedback
- **batch file processing** for multiple samples
- **file renaming options** with preset name integration
- **filename separators** (space or hyphen)
- **audio format detection** and metadata extraction
- **wav metadata parsing** including smpl chunks and loop points
- **file size optimization** with compression recommendations

### preset settings
- **engine-level settings** including playmode, transpose, velocity, volume, width
- **envelope controls** for amplitude and filter with visual graphs
- **modulation settings** for aftertouch, modwheel, pitchbend, velocity
- **tuning controls** with root note and scale options
- **portamento settings** with type and amount controls
- **highpass filter** with frequency control
- **preset import/export** for engine settings

### mobile & accessibility
- **progressive web app (pwa)** with offline functionality
- **mobile rotation handling** with landscape orientation prompts
- **touch-friendly interface** with proper touch targets
- **keyboard navigation** with arrow key support
- **screen reader compatibility** with proper aria labels
- **high contrast mode** support
- **responsive design** for all screen sizes

### advanced features
- **waveform zoom** for detailed sample editing
- **bulk edit** for batch sample operations
- **confirmation dialogs** for destructive operations
- **notification system** for user feedback
- **error handling** with graceful fallbacks
- **performance optimization** with efficient audio processing
- **memory management** with automatic cleanup

## development setup

this project has been migrated to react with typescript for improved maintainability and modularity.

### requirements

- node.js 18+ 
- npm or yarn

### installation

```bash
# clone the repository
git clone https://github.com/joseph-holland/op-patchstudio.git
cd op-patchstudio

# install dependencies
npm install

# start development server
npm run dev

# build for production
npm run build

# run tests
npm run test
```

### project structure

```
/src
  /components         # react ui components (carbon-based, OP-XY themed)
    /common          # shared components
    /drum           # drum-specific components
    /multisample    # multisample-specific components
    /library        # library management components
  /hooks              # custom hooks for state, file i/o, audio, etc.
  /utils              # pure js/ts logic: audio, patch, file mgmt
  /theme              # custom carbon theme and style overrides
  /context            # app/global context providers
  app.tsx
  main.tsx
```

## usage

1. **open** the [OP-PatchStudio web app](https://op-patch.studio/) in your browser
2. select either the **drum** or **multisample** tab.
3. drag and drop your samples, or use the browse button to select files.
4. assign notes (for multisample), adjust settings and use the advanced dialog for detailed control.
5. optionally, use **import patch.json** to load engine-level settings from existing preset files.
6. click **generate patch** to download your preset as a zip file.
7. unzip and copy the folder to your OP-XY's `presets` directory via usb.

## progressive web app (pwa)

OP-PatchStudio is available as a progressive web app for offline use and quick access.

### install for offline use

- **desktop**: look for the install icon in your browser's address bar or menu
- **mobile**: use your browser's "add to home screen" option
- **automatic prompt**: the app will show an install prompt when available

### pwa features

- **offline functionality**: core features work without internet connection
- **home screen access**: launch directly from your device's home screen
- **app shortcuts**: quick access to drum and multisample tools
- **automatic updates**: app updates automatically when online
- **native app experience**: runs like a native app with full-screen mode

### offline capabilities

- ✅ create and edit drum presets
- ✅ create and edit multisample presets  
- ✅ waveform editing and sample processing
- ✅ generate and download patch files
- ✅ library management and preset storage
- ✅ audio recording and processing

## credits

- joseph holland
- inspired by the awesome [opxy-drum-tool](https://buba447.github.io/opxy-drum-tool/) by brandon withrow (zeitgeese)

OP-PatchStudio is an unofficial tool not affiliated with or endorsed by teenage engineering.
this software is provided "as is" without warranty of any kind. use at your own risk. for educational and personal use only.
OP-XY, OP-1 and OP-Z are registered trademarks of teenage engineering.

