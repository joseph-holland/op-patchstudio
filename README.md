# op-patchstudio companion app

a native desktop companion app for op-patchstudio that enables system audio recording and op-xy device management.

## overview

this companion app extends the op-patchstudio web application with native desktop capabilities:

- **system audio recording**: capture audio from any application (daws, virtual instruments, youtube, etc.)
- **op-xy device management**: browse, backup, and restore op-xy devices via mtp
- **seamless integration**: communicate with the web app via local http/websocket

## architecture

the project uses a clean architecture pattern with platform-specific implementations:

```
op-patchstudio-companion/
├── OpPatchStudioCompanion.App/           # main avalonia ui application
├── OpPatchStudioCompanion.Core/          # shared interfaces and models
├── OpPatchStudioCompanion.Platforms/     # platform-agnostic abstractions
├── OpPatchStudioCompanion.Platforms.macOS/    # macos-specific implementations
├── OpPatchStudioCompanion.Platforms.Windows/  # windows-specific implementations
└── OpPatchStudioCompanion.Platforms.Linux/    # linux-specific implementations
```

### core components

- **IAudioRecorder**: interface for audio recording across platforms
- **IDeviceManager**: interface for op-xy device management
- **IWebAppCommunication**: interface for web app communication

### platform support

#### macos
- audio recording via naudio and coreaudio
- system audio capture via blackhole (requires installation)
- mtp device support (planned)

#### windows
- audio recording via naudio and wasapi
- system audio capture via wasapi loopback
- mtp device support (planned)

#### linux
- audio recording via pulseaudio/pipewire
- system audio capture via parec/cli tools
- mtp device support (planned)

## setup

### prerequisites

- .net 9.0 sdk
- avalonia templates: `dotnet new install Avalonia.Templates`

### building

```bash
# restore dependencies
dotnet restore

# build the solution
dotnet build

# run the app
dotnet run --project OpPatchStudioCompanion.App
```

### system audio recording setup

#### macos
1. install blackhole: `brew install blackhole-2ch`
2. restart your computer
3. in system preferences > sound > output, select 'blackhole 2ch'
4. in system preferences > sound > input, select 'blackhole 2ch'
5. select 'blackhole 2ch' as your recording source in the app

#### windows
system audio recording is supported out of the box via wasapi loopback.

#### linux
system audio recording requires pulseaudio or pipewire with appropriate permissions.

## development

### adding new features

1. define interfaces in `OpPatchStudioCompanion.Core/Interfaces/`
2. implement platform-specific versions in respective platform folders
3. create factories for dependency injection
4. update the main app to use the new features

### testing

```bash
# run tests
dotnet test

# run with coverage
dotnet test --collect:"XPlat Code Coverage"
```

## roadmap

### phase 1: core infrastructure ✅
- [x] project structure and architecture
- [x] basic audio recording (microphone)
- [x] web app communication framework
- [x] device management interfaces

### phase 2: system audio recording
- [ ] macos blackhole integration
- [ ] windows wasapi loopback
- [ ] linux pulseaudio/pipewire
- [ ] real-time audio streaming to web app

### phase 3: op-xy device integration
- [ ] mtp device detection
- [ ] file browsing and transfer
- [ ] backup/restore functionality
- [ ] preset installation

### phase 4: advanced features
- [ ] real-time effects and monitoring
- [ ] batch processing
- [ ] custom protocol support
- [ ] plugin architecture

## contributing

1. fork the repository
2. create a feature branch
3. implement your changes
4. add tests
5. submit a pull request

## license

mit license - see license file for details.

