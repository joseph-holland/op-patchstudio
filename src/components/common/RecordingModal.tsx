import { useState, useRef, useEffect, useCallback } from 'react';

interface RecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (audioBuffer: AudioBuffer, filename: string) => void;
  maxDuration?: number; // in seconds
}

interface AudioDevice {
  deviceId: string;
  label: string;
}

export function RecordingModal({ 
  isOpen, 
  onClose, 
  onSave, 
  maxDuration = 20 
}: RecordingModalProps) {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBuffer, setRecordedBuffer] = useState<AudioBuffer | null>(null);
  const [error, setError] = useState<string>('');
  const [filename, setFilename] = useState<string>('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // Get available audio input devices
  const getAudioDevices = useCallback(async () => {
    try {
      // First request permission to get device labels
      await navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `microphone ${device.deviceId.slice(0, 8)}`
        }));
      
      setDevices(audioInputs);
      if (audioInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(audioInputs[0].deviceId);
      }
    } catch (err) {
      console.error('Error getting audio devices:', err);
      setError('failed to access audio devices. please check permissions.');
      // Set a default device even if we can't enumerate
      setDevices([{ deviceId: 'default', label: 'default microphone' }]);
      setSelectedDeviceId('default');
    }
  }, []);

  // Initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      resetRecording();
      getAudioDevices();
    } else {
      cleanup();
    }
  }, [isOpen, getAudioDevices]);

  // Generate default filename when modal opens
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const dateStr = now.getFullYear().toString() + 
                     (now.getMonth() + 1).toString().padStart(2, '0') + 
                     now.getDate().toString().padStart(2, '0');
      const timeStr = now.getHours().toString().padStart(2, '0') + 
                     now.getMinutes().toString().padStart(2, '0') + 
                     now.getSeconds().toString().padStart(2, '0');
      setFilename(`rec-sample-${dateStr}-${timeStr}-note`);
    }
  }, [isOpen]);

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  const resetRecording = () => {
    setIsRecording(false);
    setIsPlaying(false);
    setRecordingTime(0);
    setRecordedBuffer(null);
    setError('');
    audioChunksRef.current = [];
    cleanup();
  };

  const startRecording = async () => {
    try {
      setError('');
      console.log('Starting recording with device:', selectedDeviceId);
      
      // Request microphone access with selected device
      const constraints: MediaStreamConstraints = {
        audio: selectedDeviceId && selectedDeviceId !== 'default' 
          ? { deviceId: { exact: selectedDeviceId } } 
          : true
      };
      
      streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Set up MediaRecorder
      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm';
      }
      
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
      
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
        });
        await processRecordedAudio(audioBlob);
      };
      
      // Set up real-time waveform visualization
      setupWaveformVisualization();
      
      // Start recording
      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      
      // Start timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setRecordingTime(elapsed);
        
        // Auto-stop at max duration
        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 100);
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('failed to start recording. please check microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
  };

  const setupWaveformVisualization = () => {
    if (!streamRef.current || !canvasRef.current) return;
    
    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();
    const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
    source.connect(analyserRef.current);
    
    analyserRef.current.fftSize = 2048;
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      if (!analyserRef.current || !canvasRef.current) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      analyserRef.current.getByteTimeDomainData(dataArray);
      
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.lineWidth = 2;
      ctx.strokeStyle = isRecording ? '#333' : '#666';
      ctx.beginPath();
      
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      ctx.stroke();
      
      if (isRecording) {
        animationRef.current = requestAnimationFrame(draw);
      }
    };
    
    draw();
  };

  const processRecordedAudio = async (audioBlob: Blob) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      setRecordedBuffer(audioBuffer);
      
      // Draw final waveform
      drawStaticWaveform(audioBuffer);
    } catch (err) {
      console.error('Error processing recorded audio:', err);
      setError('failed to process recorded audio.');
    }
  };

  const drawStaticWaveform = (audioBuffer: AudioBuffer) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const data = audioBuffer.getChannelData(0);
    const samples = data.length;
    const samplesPerPixel = samples / width;
    
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    const centerY = height / 2;
    
    for (let x = 0; x < width; x++) {
      const startSample = Math.floor(x * samplesPerPixel);
      const endSample = Math.floor((x + 1) * samplesPerPixel);
      
      let min = 0;
      let max = 0;
      
      for (let i = startSample; i < endSample && i < samples; i++) {
        const value = data[i];
        if (value < min) min = value;
        if (value > max) max = value;
      }
      
      const minY = centerY - (min * centerY);
      const maxY = centerY - (max * centerY);
      
      ctx.moveTo(x, minY);
      ctx.lineTo(x, maxY);
    }
    
    ctx.stroke();
  };

  const playRecording = async () => {
    if (!recordedBuffer) return;
    
    try {
      const audioContext = new AudioContext();
      const source = audioContext.createBufferSource();
      source.buffer = recordedBuffer;
      source.connect(audioContext.destination);
      
      setIsPlaying(true);
      source.start();
      
      source.onended = () => {
        setIsPlaying(false);
      };
      
      // Auto-stop after duration
      setTimeout(() => {
        setIsPlaying(false);
      }, recordedBuffer.duration * 1000);
      
    } catch (err) {
      console.error('Error playing recording:', err);
      setError('failed to play recording.');
    }
  };

  const handleSave = () => {
    if (recordedBuffer) {
      onSave(recordedBuffer, filename);
      onClose();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: '"Montserrat", "Arial", sans-serif'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#fff',
          borderRadius: '6px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          maxWidth: '500px',
          width: '90%',
          margin: '0 1rem',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem 1.5rem 1rem 1.5rem',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <h3 style={{
            margin: '0',
            fontSize: '1.25rem',
            fontWeight: '300',
            color: '#222',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <i className="fas fa-microphone" style={{
              color: '#222',
              fontSize: '1.25rem'
            }}></i>
            record audio sample
          </h3>
        </div>

        {/* Content */}
        <div style={{
          padding: '1.5rem',
          color: '#555',
          fontSize: '0.95rem',
          lineHeight: '1.5'
        }}>
          {/* Input Device Selection */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontSize: '0.9rem',
              color: '#333',
              fontWeight: '500'
            }}>
              input device
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              disabled={isRecording}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '3px',
                fontSize: '0.9rem',
                backgroundColor: '#fff',
                color: '#333'
              }}
            >
              {devices.length === 0 ? (
                <option value="">loading devices...</option>
              ) : (
                devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Filename Input */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontSize: '0.9rem',
              color: '#333',
              fontWeight: '500'
            }}>
              filename
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              disabled={isRecording}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '3px',
                fontSize: '0.9rem',
                backgroundColor: '#fff',
                color: '#333',
                boxSizing: 'border-box'
              }}
              placeholder="enter filename for the recording"
            />
          </div>

          {/* Recording Status */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1rem',
            padding: '1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '3px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isRecording && (
                <div style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#333',
                  borderRadius: '50%',
                  animation: 'pulse 1s infinite'
                }} />
              )}
              <span style={{ fontSize: '0.9rem', color: '#333' }}>
                {isRecording ? 'recording...' : recordedBuffer ? 'recording complete' : 'ready to record'}
              </span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>
              {formatTime(recordingTime)}
            </div>
          </div>

          {/* Recording Controls */}
          <div style={{ 
            display: 'flex', 
            gap: '0.75rem', 
            justifyContent: 'center',
            marginBottom: '1.5rem'
          }}>
            {!isRecording && !recordedBuffer && (
              <button
                onClick={startRecording}
                style={{
                  padding: '0.625rem 1.25rem',
                  border: 'none',
                  borderRadius: '3px',
                  backgroundColor: '#333',
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#555';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#333';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <i className="fas fa-microphone"></i>
                start recording
              </button>
            )}
            
            {isRecording && (
              <button
                onClick={stopRecording}
                style={{
                  padding: '0.625rem 1.25rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '3px',
                  backgroundColor: '#fff',
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                  e.currentTarget.style.borderColor = '#9ca3af';
                  e.currentTarget.style.color = '#374151';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fff';
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                <i className="fas fa-stop"></i>
                stop recording
              </button>
            )}
            
            {recordedBuffer && (
              <>
                <button
                  onClick={playRecording}
                  disabled={isPlaying}
                  style={{
                    padding: '0.625rem 1.25rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '3px',
                    backgroundColor: '#fff',
                    color: isPlaying ? '#9ca3af' : '#6b7280',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: isPlaying ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: isPlaying ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isPlaying) {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                      e.currentTarget.style.borderColor = '#9ca3af';
                      e.currentTarget.style.color = '#374151';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isPlaying) {
                      e.currentTarget.style.backgroundColor = '#fff';
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.color = '#6b7280';
                    }
                  }}
                >
                  <i className={`fas fa-${isPlaying ? 'pause' : 'play'}`}></i>
                  {isPlaying ? 'playing...' : 'play'}
                </button>
                <button
                  onClick={resetRecording}
                  style={{
                    padding: '0.625rem 1.25rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '3px',
                    backgroundColor: '#fff',
                    color: '#6b7280',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                    e.currentTarget.style.borderColor = '#9ca3af';
                    e.currentTarget.style.color = '#374151';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#fff';
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.color = '#6b7280';
                  }}
                >
                  <i className="fas fa-redo"></i>
                  retake
                </button>
              </>
            )}
          </div>

          {/* Waveform Display */}
          <div style={{ marginBottom: '1rem' }}>
            <canvas
              ref={canvasRef}
              width={400}
              height={80}
              style={{
                width: '100%',
                height: '80px',
                border: '1px solid #e0e0e0',
                borderRadius: '3px',
                backgroundColor: '#fff'
              }}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ccc',
              borderRadius: '3px',
              color: '#333',
              fontSize: '0.9rem',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          {/* Recording Info */}
          <div style={{ 
            fontSize: '0.8rem', 
            color: '#666',
            textAlign: 'center'
          }}>
            maximum recording time: {maxDuration}s
            <br />
            <small>devices: {devices.length}, selected: {selectedDeviceId}</small>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '1rem 1.5rem 1.5rem 1.5rem',
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.625rem 1.25rem',
              border: '1px solid #d1d5db',
              borderRadius: '3px',
              backgroundColor: '#fff',
              color: '#6b7280',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              minWidth: '80px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.borderColor = '#9ca3af';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#fff';
              e.currentTarget.style.borderColor = '#d1d5db';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            cancel
          </button>
          {recordedBuffer && (
            <button
              onClick={handleSave}
              style={{
                padding: '0.625rem 1.25rem',
                border: 'none',
                borderRadius: '3px',
                backgroundColor: '#333',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit',
                minWidth: '80px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#555';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#333';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              save
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
} 