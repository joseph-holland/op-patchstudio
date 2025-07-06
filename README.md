# OP-PatchStudio

**free & open source preset creator for OP synthesizers. upload samples, edit waveforms, adjust settings and generate patches instantly.**

![OP-PatchStudio Preview](public/assets/preview-image.png)


![OP-PatchStudio Preview](public/assets/preview-image-2.png)

- **live demo:** [OP-PatchStudio](https://op-patch.studio/)
- **GitHub:** [github.com/joseph-holland/op-patchstudio](https://github.com/joseph-holland/op-patchstudio)

## features

- **comprehensive preset generation** for OP synthesizers (currently OP-XY, more devices coming soon)
- **modern, responsive ui** built with React, TypeScript, and Carbon Design System  
- **drag-and-drop sample assignment** for drum and multisample presets
- **advanced waveform editing** with interactive zoom modal and marker adjustment
- **snap-to-zero-crossing** functionality for clean sample trimming
- **real-time audio processing** with sample rate conversion (44/22/11khz) and format optimization
- **accessibility-compliant interface** with WCAG AA touch targets and keyboard navigation
- **live patch size monitoring** with optimization recommendations
- **advanced preset settings** including envelopes, tuning, velocity sensitivity, and modulation

## development setup

This project has been migrated to React with TypeScript for improved maintainability and modularity.

### requirements

- Node.js 18+ 
- npm or yarn

### installation

```bash
# Clone the repository
git clone https://github.com/joseph-holland/op-patchstudio.git
cd op-patchstudio

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

### project structure

```
/src
  /components         # React UI components (Carbon-based, OP-XY themed)
    /common          # Shared components
    /drum           # Drum-specific components
    /multisample    # Multisample-specific components
  /hooks              # Custom hooks for state, file I/O, audio, etc.
  /utils              # Pure JS/TS logic: audio, patch, file mgmt
  /theme              # Custom Carbon theme and style overrides
  /context            # App/global context providers
  App.tsx
  main.tsx
```

## usage

1. **open** the [OP-PatchStudio web app](https://op-patch.studio/) in your browser
2. select either the **drum** or **multisample** tab.
3. drag and drop your samples, or use the browse button to select files.
4. assign notes (for multisample), adjust settings and use the advanced dialog for detailed control.
5. optionally, use **import settings** to load engine-level settings from existing preset files.
6. click **generate patch** to download your preset as a zip file.
7. unzip and copy the folder to your OP-XY's `presets` directory via usb.

## progressive web app (pwa)

OP-PatchStudio is available as a Progressive Web App for offline use and quick access.

### install for offline use

- **desktop**: Look for the install icon in your browser's address bar or menu
- **mobile**: Use your browser's "Add to Home Screen" option
- **automatic prompt**: The app will show an install prompt when available

### pwa features

- **offline functionality**: Core features work without internet connection
- **home screen access**: Launch directly from your device's home screen
- **app shortcuts**: Quick access to Drum and Multisample tools
- **automatic updates**: App updates automatically when online
- **native app experience**: Runs like a native app with full-screen mode

### offline capabilities

- ✅ Create and edit drum presets
- ✅ Create and edit multisample presets  
- ✅ Waveform editing and sample processing
- ✅ Generate and download patch files
- ⚠️ Sample upload requires internet connection
- ⚠️ Some advanced features may require online access


See [MIGRATION_COMPLETION_SUMMARY.md](MIGRATION_COMPLETION_SUMMARY.md) for detailed progress report.

## credits

- joseph holland
- inspired by the awesome [opxy-drum-tool](https://buba447.github.io/opxy-drum-tool/) by brandon withrow (zeitgeese)

OP-PatchStudio is an unofficial tool not affiliated with or endorsed by teenage engineering.
this software is provided "as is" without warranty of any kind. use at your own risk. for educational and personal use only.
OP-XY, OP-1 are a registered trademarks of teenage engineering.

