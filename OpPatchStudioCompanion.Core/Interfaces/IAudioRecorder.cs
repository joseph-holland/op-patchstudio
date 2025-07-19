using System;
using System.Threading.Tasks;

namespace OpPatchStudioCompanion.Core.Interfaces
{
    public interface IAudioRecorder : IDisposable
    {
        /// <summary>
        /// Gets the list of available audio devices
        /// </summary>
        Task<AudioDevice[]> GetAvailableDevicesAsync();
        
        /// <summary>
        /// Starts recording audio from the specified device
        /// </summary>
        /// <param name="deviceId">The ID of the audio device to record from</param>
        /// <param name="sampleRate">Sample rate in Hz (default: 44100)</param>
        /// <param name="channels">Number of channels (default: 2)</param>
        Task StartRecordingAsync(string deviceId, int sampleRate = 44100, int channels = 2);
        
        /// <summary>
        /// Stops recording and returns the recorded audio data
        /// </summary>
        /// <returns>The recorded audio data as a byte array</returns>
        Task<byte[]> StopRecordingAsync();
        
        /// <summary>
        /// Gets the current recording status
        /// </summary>
        bool IsRecording { get; }
        
        /// <summary>
        /// Event fired when recording starts
        /// </summary>
        event EventHandler RecordingStarted;
        
        /// <summary>
        /// Event fired when recording stops
        /// </summary>
        event EventHandler<RecordingStoppedEventArgs> RecordingStopped;
        
        /// <summary>
        /// Event fired when an error occurs during recording
        /// </summary>
        event EventHandler<RecordingErrorEventArgs> RecordingError;
    }
    
    public class AudioDevice
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public bool IsDefault { get; set; }
        public bool IsSystemAudio { get; set; }
    }
    
    public class RecordingStoppedEventArgs : EventArgs
    {
        public byte[] AudioData { get; set; } = Array.Empty<byte>();
        public TimeSpan Duration { get; set; }
        public int SampleRate { get; set; }
        public int Channels { get; set; }
    }
    
    public class RecordingErrorEventArgs : EventArgs
    {
        public string ErrorMessage { get; set; } = string.Empty;
        public Exception? Exception { get; set; }
    }
} 