using OpPatchStudioCompanion.Core.Interfaces;
using OpPatchStudioCompanion.Platforms.Audio;

namespace OpPatchStudioCompanion.Platforms.macOS.Audio
{
    public class MacOSAudioRecorderFactory : IAudioRecorderFactory
    {
        public IAudioRecorder CreateAudioRecorder()
        {
            return new MacOSAudioRecorder();
        }
        
        public bool IsSystemAudioRecordingSupported => true;
        
        public string? GetSystemAudioSetupInstructions()
        {
            return @"to record system audio on macos, you need to install blackhole:

1. install blackhole using homebrew:
   brew install blackhole-2ch

2. or download from: https://existential.audio/blackhole/

3. restart your computer after installation

4. in system preferences > sound > output, select 'blackhole 2ch' as your output device

5. in system preferences > sound > input, select 'blackhole 2ch' as your input device

6. now you can record system audio by selecting 'blackhole 2ch' as your recording source

note: blackhole creates a virtual audio device that captures system audio output and makes it available as input.";
        }
    }
} 