using OpPatchStudioCompanion.Core.Interfaces;
using OpPatchStudioCompanion.Platforms.Device;

namespace OpPatchStudioCompanion.Platforms.macOS.Device
{
    public class MacOSDeviceManagerFactory : IDeviceManagerFactory
    {
        public IDeviceManager CreateDeviceManager()
        {
            return new MacOSDeviceManager();
        }
        
        public bool IsMtpDeviceSupportAvailable => false; // Will be true when MTP support is implemented
        
        public string? GetMtpDeviceSetupInstructions()
        {
            return @"mtp device support for macos is not yet implemented.

planned implementation will use:
- libmtp for mtp device communication
- usbmuxd for device detection
- custom op-xy protocol handling

this will allow:
- browsing op-xy file system
- uploading/downloading presets and samples
- creating device backups
- restoring from backups";
        }
    }
} 