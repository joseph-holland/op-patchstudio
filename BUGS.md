# OP-PatchStudio Bug Tracker

Last updated: 2026-01-17

## Fixed - Pending User Confirmation

### 1. Envelope/ADSR Settings Not Written to Preset
- **Source**: GitHub #103, Feedback Form (7/27/2025)
- **Status**: ✅ Fixed - Pending User Confirmation
- **Description**: Amp envelope/ADSR settings configured in the UI don't get written to the downloaded preset file. Additionally, the Envelopes and Filters tab curves reset to default and don't respond to user input.
- **Impact**: High - Users cannot configure envelopes, core feature broken
- **Reproduction**: Touch any knob or curve point in Envelopes and Filters tab
- **Fix**:
  - Updated UI to persist envelope changes to preset format
  - Added envelope settings application in patch generation
  - Modified files: `MultisamplePresetSettings.tsx`, `patchGeneration.ts`

### 2. Drum Tool Start Points Not Written to patch.json
- **Source**: GitHub #101
- **Status**: ✅ Fixed - Pending User Confirmation
- **Description**: Start point settings for drum samples don't get written to the patch.json file
- **Impact**: High - Sample playback won't respect configured start points on device
- **Reproduction**: Set start points in drum tool, download preset, check patch.json
- **Fix**:
  - Updated patch generation to use inPoint/outPoint from state instead of hardcoded values
  - Modified files: `patchGeneration.ts`

### 3. Multisample Keyboard Mapping Broken
- **Source**: Feedback Form (7/21/2025)
- **Status**: ✅ Fixed - Pending User Confirmation
- **Description**:
  - Manually placing a sample on a keyboard note transposes it across all keys
  - Previous placed samples get ignored/overwritten
  - Batch import only applies the last (highest tone) sample across entire keyboard
- **Impact**: Critical - Multisample tool essentially non-functional
- **Reproduction**:
  1. Place sample on C3
  2. Place second sample on C4
  3. C3 sample gets replaced/ignored
- **Reporter**: via Forms
- **Fix**:
  - Added automatic MIDI note collision detection
  - Samples now auto-assign to nearest available MIDI note when collision detected
  - Modified files: `AppContext.tsx`

## Open Bugs

### 4. Drum Tool Keyboard Pinning Not Working on Mobile
- **Source**: GitHub #43
- **Status**: Open
- **Description**: Keyboard pinning feature doesn't work on mobile devices
- **Impact**: Medium - UX issue on mobile
- **Platform**: Mobile only

### 5. Can't Swipe Keyboard Octaves on Mobile
- **Source**: GitHub #42
- **Status**: Open
- **Description**: Unable to swipe to change keyboard octaves on mobile devices
- **Impact**: Medium - Navigation issue on mobile
- **Platform**: Mobile only

### 6. PWA Won't Load When Offline
- **Source**: Feedback Form (11/10/2025)
- **Status**: Open
- **Description**: Chrome PWA just displays "You're offline" message and doesn't load the app when offline, despite being a PWA
- **Impact**: Medium - Breaks offline-first promise of PWA
- **Platform**: Chrome PWA
- **Reporter**: via Forms

### 7. Unable to Load Some OP-1 Drum Presets
- **Source**: Feedback Form (7/19/2025)
- **Status**: Open
- **Description**: Error "import failed: the file does not appear to be a valid OP-1 drum preset" for files that work fine on actual OP-1 device
- **Impact**: Medium - Import compatibility issue
- **Reporter**: via Forms
- **Note**: Need sample files to reproduce

---

## Notes
- Focus on critical bugs affecting core preset generation first (#1, #2, #3)
- Multisample keyboard mapping (#3) may be related to envelope issues (#1)
- Need to request sample files from ... for issue #7
