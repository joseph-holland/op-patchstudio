using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using NAudio.Wave;
using OpPatchStudioCompanion.Core.Interfaces;

namespace OpPatchStudioCompanion.Platforms.macOS.Audio
{
    public class MacOSAudioRecorder : IAudioRecorder
    {
        private WaveInEvent? _waveIn;
        private WaveFileWriter? _waveWriter;
        private MemoryStream? _audioStream;
        private bool _isRecording;
        private DateTime _recordingStartTime;
        
        public bool IsRecording => _isRecording;
        
        public event EventHandler? RecordingStarted;
        public event EventHandler<RecordingStoppedEventArgs>? RecordingStopped;
        public event EventHandler<RecordingErrorEventArgs>? RecordingError;
        
        public async Task<AudioDevice[]> GetAvailableDevicesAsync()
        {
            try
            {
                var devices = new List<AudioDevice>();
                
                // Get default device
                devices.Add(new AudioDevice
                {
                    Id = "default",
                    Name = "default microphone",
                    Description = "system default audio input",
                    IsDefault = true,
                    IsSystemAudio = false
                });
                
                // Get available wave in devices
                for (int i = 0; i < WaveIn.DeviceCount; i++)
                {
                    var capabilities = WaveIn.GetCapabilities(i);
                    devices.Add(new AudioDevice
                    {
                        Id = i.ToString(),
                        Name = capabilities.ProductName,
                        Description = $"audio input device {i}",
                        IsDefault = false,
                        IsSystemAudio = false
                    });
                }
                
                // Note: For system audio recording on macOS, we'll need to check for BlackHole
                // This is a placeholder for now
                if (IsBlackHoleInstalled())
                {
                    devices.Add(new AudioDevice
                    {
                        Id = "blackhole",
                        Name = "blackhole 2ch",
                        Description = "system audio capture (requires blackhole)",
                        IsDefault = false,
                        IsSystemAudio = true
                    });
                }
                
                return devices.ToArray();
            }
            catch (Exception ex)
            {
                OnRecordingError("failed to enumerate audio devices", ex);
                return new AudioDevice[] { new AudioDevice { Id = "default", Name = "default microphone", IsDefault = true } };
            }
        }
        
        public async Task StartRecordingAsync(string deviceId, int sampleRate = 44100, int channels = 2)
        {
            try
            {
                if (_isRecording)
                {
                    throw new InvalidOperationException("recording is already in progress");
                }
                
                _audioStream = new MemoryStream();
                
                if (deviceId == "blackhole")
                {
                    // System audio recording via BlackHole
                    await StartSystemAudioRecordingAsync(sampleRate, channels);
                }
                else
                {
                    // Standard microphone recording
                    await StartMicrophoneRecordingAsync(deviceId, sampleRate, channels);
                }
                
                _isRecording = true;
                _recordingStartTime = DateTime.Now;
                RecordingStarted?.Invoke(this, EventArgs.Empty);
            }
            catch (Exception ex)
            {
                OnRecordingError("failed to start recording", ex);
                throw;
            }
        }
        
        public async Task<byte[]> StopRecordingAsync()
        {
            try
            {
                if (!_isRecording)
                {
                    throw new InvalidOperationException("no recording in progress");
                }
                
                var duration = DateTime.Now - _recordingStartTime;
                
                if (_waveIn != null)
                {
                    _waveIn.StopRecording();
                    _waveIn.Dispose();
                    _waveIn = null;
                }
                
                if (_waveWriter != null)
                {
                    _waveWriter.Dispose();
                    _waveWriter = null;
                }
                
                _isRecording = false;
                
                var audioData = _audioStream?.ToArray() ?? Array.Empty<byte>();
                _audioStream?.Dispose();
                _audioStream = null;
                
                RecordingStopped?.Invoke(this, new RecordingStoppedEventArgs
                {
                    AudioData = audioData,
                    Duration = duration,
                    SampleRate = 44100,
                    Channels = 2
                });
                
                return audioData;
            }
            catch (Exception ex)
            {
                OnRecordingError("failed to stop recording", ex);
                throw;
            }
        }
        
        private async Task StartMicrophoneRecordingAsync(string deviceId, int sampleRate, int channels)
        {
            _waveIn = new WaveInEvent
            {
                WaveFormat = new WaveFormat(sampleRate, channels),
                BufferMilliseconds = 50
            };
            
            if (deviceId != "default" && int.TryParse(deviceId, out int deviceIndex))
            {
                _waveIn.DeviceNumber = deviceIndex;
            }
            
            _waveWriter = new WaveFileWriter(_audioStream, _waveIn.WaveFormat);
            
            _waveIn.DataAvailable += (sender, e) =>
            {
                _waveWriter?.Write(e.Buffer, 0, e.BytesRecorded);
            };
            
            _waveIn.RecordingStopped += (sender, e) =>
            {
                _waveWriter?.Dispose();
                _waveWriter = null;
            };
            
            _waveIn.StartRecording();
        }
        
        private async Task StartSystemAudioRecordingAsync(int sampleRate, int channels)
        {
            // This is a placeholder for BlackHole integration
            // In a real implementation, we would use CoreAudio APIs or BlackHole's interface
            throw new NotImplementedException("system audio recording requires blackhole installation and coreaudio integration");
        }
        
        private bool IsBlackHoleInstalled()
        {
            // Check if BlackHole is installed by looking for its audio device
            try
            {
                for (int i = 0; i < WaveIn.DeviceCount; i++)
                {
                    var capabilities = WaveIn.GetCapabilities(i);
                    if (capabilities.ProductName.ToLower().Contains("blackhole"))
                    {
                        return true;
                    }
                }
                return false;
            }
            catch
            {
                return false;
            }
        }
        
        private void OnRecordingError(string message, Exception? exception = null)
        {
            RecordingError?.Invoke(this, new RecordingErrorEventArgs
            {
                ErrorMessage = message,
                Exception = exception
            });
        }
        
        public void Dispose()
        {
            if (_isRecording)
            {
                StopRecordingAsync().Wait();
            }
            
            _waveIn?.Dispose();
            _waveWriter?.Dispose();
            _audioStream?.Dispose();
        }
    }
} 