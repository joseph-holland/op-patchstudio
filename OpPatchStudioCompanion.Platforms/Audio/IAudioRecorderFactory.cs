using OpPatchStudioCompanion.Core.Interfaces;

namespace OpPatchStudioCompanion.Platforms.Audio
{
    /// <summary>
    /// Factory for creating platform-specific audio recorders
    /// </summary>
    public interface IAudioRecorderFactory
    {
        /// <summary>
        /// Creates a new audio recorder instance for the current platform
        /// </summary>
        /// <returns>A new audio recorder instance</returns>
        IAudioRecorder CreateAudioRecorder();
        
        /// <summary>
        /// Gets whether system audio recording is supported on this platform
        /// </summary>
        bool IsSystemAudioRecordingSupported { get; }
        
        /// <summary>
        /// Gets the setup instructions for system audio recording on this platform
        /// </summary>
        string? GetSystemAudioSetupInstructions();
    }
} 