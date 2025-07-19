using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace OpPatchStudioCompanion.Core.Interfaces
{
    public interface IDeviceManager : IDisposable
    {
        /// <summary>
        /// Gets the list of connected devices
        /// </summary>
        Task<DeviceInfo[]> GetConnectedDevicesAsync();
        
        /// <summary>
        /// Connects to a specific device
        /// </summary>
        /// <param name="deviceId">The ID of the device to connect to</param>
        Task<bool> ConnectToDeviceAsync(string deviceId);
        
        /// <summary>
        /// Disconnects from the current device
        /// </summary>
        Task DisconnectAsync();
        
        /// <summary>
        /// Gets the current connected device
        /// </summary>
        DeviceInfo? ConnectedDevice { get; }
        
        /// <summary>
        /// Browses files on the connected device
        /// </summary>
        /// <param name="path">The path to browse (empty for root)</param>
        Task<FileInfo[]> BrowseFilesAsync(string path = "");
        
        /// <summary>
        /// Downloads a file from the device
        /// </summary>
        /// <param name="devicePath">The path of the file on the device</param>
        /// <param name="localPath">The local path to save the file</param>
        Task DownloadFileAsync(string devicePath, string localPath);
        
        /// <summary>
        /// Uploads a file to the device
        /// </summary>
        /// <param name="localPath">The local path of the file</param>
        /// <param name="devicePath">The destination path on the device</param>
        Task UploadFileAsync(string localPath, string devicePath);
        
        /// <summary>
        /// Deletes a file from the device
        /// </summary>
        /// <param name="devicePath">The path of the file to delete</param>
        Task DeleteFileAsync(string devicePath);
        
        /// <summary>
        /// Creates a backup of the device
        /// </summary>
        /// <param name="backupPath">The local path to save the backup</param>
        Task CreateBackupAsync(string backupPath);
        
        /// <summary>
        /// Restores a backup to the device
        /// </summary>
        /// <param name="backupPath">The local path of the backup to restore</param>
        Task RestoreBackupAsync(string backupPath);
        
        /// <summary>
        /// Event fired when a device is connected
        /// </summary>
        event EventHandler<DeviceConnectedEventArgs> DeviceConnected;
        
        /// <summary>
        /// Event fired when a device is disconnected
        /// </summary>
        event EventHandler<DeviceDisconnectedEventArgs> DeviceDisconnected;
        
        /// <summary>
        /// Event fired when an error occurs
        /// </summary>
        event EventHandler<DeviceErrorEventArgs> DeviceError;
    }
    
    public class DeviceInfo
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Manufacturer { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public DeviceType Type { get; set; }
        public long TotalSpace { get; set; }
        public long FreeSpace { get; set; }
        public bool IsConnected { get; set; }
    }
    
    public class FileInfo
    {
        public string Name { get; set; } = string.Empty;
        public string Path { get; set; } = string.Empty;
        public long Size { get; set; }
        public DateTime ModifiedDate { get; set; }
        public bool IsDirectory { get; set; }
    }
    
    public enum DeviceType
    {
        Unknown,
        OPXY,
        OP1,
        OPZ,
        GenericMTP
    }
    
    public class DeviceConnectedEventArgs : EventArgs
    {
        public DeviceInfo Device { get; set; } = new();
    }
    
    public class DeviceDisconnectedEventArgs : EventArgs
    {
        public string DeviceId { get; set; } = string.Empty;
    }
    
    public class DeviceErrorEventArgs : EventArgs
    {
        public string ErrorMessage { get; set; } = string.Empty;
        public Exception? Exception { get; set; }
    }
} 