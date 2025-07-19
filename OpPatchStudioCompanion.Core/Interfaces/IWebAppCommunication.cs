using System;
using System.Threading.Tasks;

namespace OpPatchStudioCompanion.Core.Interfaces
{
    public interface IWebAppCommunication : IDisposable
    {
        /// <summary>
        /// Starts the local server for web app communication
        /// </summary>
        /// <param name="port">The port to listen on (default: 5000)</param>
        Task StartServerAsync(int port = 5000);
        
        /// <summary>
        /// Stops the local server
        /// </summary>
        Task StopServerAsync();
        
        /// <summary>
        /// Gets whether the server is running
        /// </summary>
        bool IsServerRunning { get; }
        
        /// <summary>
        /// Gets the server URL
        /// </summary>
        string ServerUrl { get; }
        
        /// <summary>
        /// Sends recorded audio data to the web app
        /// </summary>
        /// <param name="audioData">The audio data to send</param>
        /// <param name="filename">The filename for the audio</param>
        Task SendAudioToWebAppAsync(byte[] audioData, string filename);
        
        /// <summary>
        /// Sends device information to the web app
        /// </summary>
        /// <param name="deviceInfo">The device information</param>
        Task SendDeviceInfoToWebAppAsync(DeviceInfo deviceInfo);
        
        /// <summary>
        /// Sends file list to the web app
        /// </summary>
        /// <param name="files">The list of files</param>
        Task SendFileListToWebAppAsync(FileInfo[] files);
        
        /// <summary>
        /// Event fired when the web app requests audio recording
        /// </summary>
        event EventHandler<AudioRecordingRequestEventArgs> AudioRecordingRequested;
        
        /// <summary>
        /// Event fired when the web app requests device connection
        /// </summary>
        event EventHandler<DeviceConnectionRequestEventArgs> DeviceConnectionRequested;
        
        /// <summary>
        /// Event fired when the web app requests file operations
        /// </summary>
        event EventHandler<FileOperationRequestEventArgs> FileOperationRequested;
        
        /// <summary>
        /// Event fired when the web app connects
        /// </summary>
        event EventHandler WebAppConnected;
        
        /// <summary>
        /// Event fired when the web app disconnects
        /// </summary>
        event EventHandler WebAppDisconnected;
    }
    
    public class AudioRecordingRequestEventArgs : EventArgs
    {
        public string DeviceId { get; set; } = string.Empty;
        public int SampleRate { get; set; } = 44100;
        public int Channels { get; set; } = 2;
        public int MaxDuration { get; set; } = 30;
    }
    
    public class DeviceConnectionRequestEventArgs : EventArgs
    {
        public string DeviceId { get; set; } = string.Empty;
        public string Operation { get; set; } = string.Empty; // "connect", "disconnect", "browse", etc.
        public string? Path { get; set; }
    }
    
    public class FileOperationRequestEventArgs : EventArgs
    {
        public string Operation { get; set; } = string.Empty; // "download", "upload", "delete", "backup", "restore"
        public string SourcePath { get; set; } = string.Empty;
        public string? DestinationPath { get; set; }
    }
} 