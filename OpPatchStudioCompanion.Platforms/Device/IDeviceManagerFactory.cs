using OpPatchStudioCompanion.Core.Interfaces;

namespace OpPatchStudioCompanion.Platforms.Device
{
    /// <summary>
    /// Factory for creating platform-specific device managers
    /// </summary>
    public interface IDeviceManagerFactory
    {
        /// <summary>
        /// Creates a new device manager instance for the current platform
        /// </summary>
        /// <returns>A new device manager instance</returns>
        IDeviceManager CreateDeviceManager();
        
        /// <summary>
        /// Gets whether MTP device support is available on this platform
        /// </summary>
        bool IsMtpDeviceSupportAvailable { get; }
        
        /// <summary>
        /// Gets the setup instructions for MTP device support on this platform
        /// </summary>
        string? GetMtpDeviceSetupInstructions();
    }
} 