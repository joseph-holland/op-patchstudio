using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using OpPatchStudioCompanion.Core.Interfaces;

namespace OpPatchStudioCompanion.Platforms.macOS.Communication
{
    public class MacOSWebAppCommunication : IWebAppCommunication, IDisposable
    {
        private HttpListener? _httpListener;
        private CancellationTokenSource? _cancellationTokenSource;
        private bool _isRunning;
        private readonly object _lockObject = new object();
        
        public event EventHandler? WebAppConnected;
        public event EventHandler? WebAppDisconnected;
        
        public async Task StartServerAsync(int port = 5000)
        {
            if (_isRunning)
                return;
                
            try
            {
                _httpListener = new HttpListener();
                _httpListener.Prefixes.Add($"http://localhost:{port}/");
                _cancellationTokenSource = new CancellationTokenSource();
                
                _httpListener.Start();
                _isRunning = true;
                
                Console.WriteLine($"web app server started on http://localhost:{port}");
                
                // Start listening for requests
                _ = Task.Run(() => ListenForRequestsAsync(_cancellationTokenSource.Token));
                
                // Fire connected event
                WebAppConnected?.Invoke(this, EventArgs.Empty);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"failed to start web server: {ex.Message}");
                throw;
            }
        }
        
        public async Task StopServerAsync()
        {
            if (!_isRunning)
                return;
                
            try
            {
                _cancellationTokenSource?.Cancel();
                _httpListener?.Stop();
                _httpListener?.Close();
                _isRunning = false;
                
                Console.WriteLine("web app server stopped");
                
                // Fire disconnected event
                WebAppDisconnected?.Invoke(this, EventArgs.Empty);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"failed to stop web server: {ex.Message}");
            }
        }
        
        public async Task SendAudioToWebAppAsync(byte[] audioData, string filename)
        {
            try
            {
                var message = new WebAppMessage
                {
                    Type = "audio_data",
                    Data = new Dictionary<string, object>
                    {
                        ["filename"] = filename,
                        ["size"] = audioData.Length,
                        ["timestamp"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
                    }
                };
                
                // For now, just log the message
                Console.WriteLine($"sending audio to web app: {filename} ({audioData.Length} bytes)");
                
                // TODO: Implement actual WebSocket or HTTP POST to web app
            }
            catch (Exception ex)
            {
                Console.WriteLine($"failed to send audio to web app: {ex.Message}");
            }
        }
        
        private async Task ListenForRequestsAsync(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested && _httpListener?.IsListening == true)
            {
                try
                {
                    var context = await _httpListener.GetContextAsync();
                    _ = Task.Run(() => HandleRequestAsync(context), cancellationToken);
                }
                catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
                {
                    Console.WriteLine($"error handling request: {ex.Message}");
                }
            }
        }
        
        private async Task HandleRequestAsync(HttpListenerContext context)
        {
            try
            {
                var request = context.Request;
                var response = context.Response;
                
                // Set CORS headers
                response.Headers.Add("Access-Control-Allow-Origin", "*");
                response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                response.Headers.Add("Access-Control-Allow-Headers", "Content-Type");
                
                // Handle preflight requests
                if (request.HttpMethod == "OPTIONS")
                {
                    response.StatusCode = 200;
                    response.Close();
                    return;
                }
                
                var path = request.Url?.AbsolutePath ?? "";
                var method = request.HttpMethod;
                
                switch (path)
                {
                    case "/api/status":
                        await HandleStatusRequest(response);
                        break;
                        
                    case "/api/audio/devices":
                        await HandleAudioDevicesRequest(response);
                        break;
                        
                    case "/api/audio/start":
                        await HandleAudioStartRequest(request, response);
                        break;
                        
                    case "/api/audio/stop":
                        await HandleAudioStopRequest(response);
                        break;
                        
                    case "/api/device/connect":
                        await HandleDeviceConnectRequest(response);
                        break;
                        
                    case "/api/device/backup":
                        await HandleDeviceBackupRequest(response);
                        break;
                        
                    case "/api/device/restore":
                        await HandleDeviceRestoreRequest(response);
                        break;
                        
                    default:
                        await HandleNotFound(response);
                        break;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"error handling request: {ex.Message}");
                await HandleError(context.Response, ex);
            }
        }
        
        private async Task HandleStatusRequest(HttpListenerResponse response)
        {
            var status = new
            {
                status = "running",
                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                version = "0.1.0"
            };
            
            await SendJsonResponse(response, status);
        }
        
        private async Task HandleAudioDevicesRequest(HttpListenerResponse response)
        {
            var devices = new[]
            {
                new { id = "default", name = "default microphone", isDefault = true },
                new { id = "blackhole", name = "system audio (blackhole)", isDefault = false }
            };
            
            await SendJsonResponse(response, devices);
        }
        
        private async Task HandleAudioStartRequest(HttpListenerRequest request, HttpListenerResponse response)
        {
            // TODO: Implement actual audio recording start
            var result = new { success = true, message = "audio recording started" };
            await SendJsonResponse(response, result);
        }
        
        private async Task HandleAudioStopRequest(HttpListenerResponse response)
        {
            // TODO: Implement actual audio recording stop
            var result = new { success = true, message = "audio recording stopped" };
            await SendJsonResponse(response, result);
        }
        
        private async Task HandleDeviceConnectRequest(HttpListenerResponse response)
        {
            // TODO: Implement actual device connection
            var result = new { success = false, message = "no op-xy devices found" };
            await SendJsonResponse(response, result);
        }
        
        private async Task HandleDeviceBackupRequest(HttpListenerResponse response)
        {
            // TODO: Implement actual device backup
            var result = new { success = false, message = "no device connected" };
            await SendJsonResponse(response, result);
        }
        
        private async Task HandleDeviceRestoreRequest(HttpListenerResponse response)
        {
            // TODO: Implement actual device restore
            var result = new { success = false, message = "no device connected" };
            await SendJsonResponse(response, result);
        }
        
        private async Task HandleNotFound(HttpListenerResponse response)
        {
            response.StatusCode = 404;
            var error = new { error = "not found" };
            await SendJsonResponse(response, error);
        }
        
        private async Task HandleError(HttpListenerResponse response, Exception ex)
        {
            response.StatusCode = 500;
            var error = new { error = "internal server error", message = ex.Message };
            await SendJsonResponse(response, error);
        }
        
        private async Task SendJsonResponse(HttpListenerResponse response, object data)
        {
            var json = JsonSerializer.Serialize(data, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
            
            var buffer = Encoding.UTF8.GetBytes(json);
            
            response.ContentType = "application/json";
            response.ContentLength64 = buffer.Length;
            
            await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            response.Close();
        }
        
        public void Dispose()
        {
            _ = StopServerAsync();
            _httpListener?.Dispose();
            _cancellationTokenSource?.Dispose();
        }
    }
    
    public class WebAppMessage
    {
        public string Type { get; set; } = string.Empty;
        public Dictionary<string, object> Data { get; set; } = new Dictionary<string, object>();
    }
} 