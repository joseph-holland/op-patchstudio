import { useRef, useEffect, useState, useCallback } from 'react';
import { findNearestZeroCrossing } from '../../utils/audio';
import { Tooltip } from './Tooltip';

interface WaveformZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioBuffer: AudioBuffer | null;
  initialInPoint: number;
  initialOutPoint: number;
  onSave: (inPoint: number, outPoint: number) => void;
}

export function WaveformZoomModal({
  isOpen,
  onClose,
  audioBuffer,
  initialInPoint,
  initialOutPoint,
  onSave
}: WaveformZoomModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [inPoint, setInPoint] = useState(initialInPoint);
  const [outPoint, setOutPoint] = useState(initialOutPoint);
  const [snapToZero, setSnapToZero] = useState(true);
  const [dragging, setDragging] = useState<'in' | 'out' | null>(null);
  const [inValue, setInValue] = useState(0);
  const [outValue, setOutValue] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  // Update state when props change
  useEffect(() => {
    setInPoint(initialInPoint);
    setOutPoint(initialOutPoint);
  }, [initialInPoint, initialOutPoint]);

  // Update sample values when markers change
  useEffect(() => {
    if (audioBuffer) {
      const data = audioBuffer.getChannelData(0);
      if (inPoint >= 0 && inPoint < data.length) {
        setInValue(data[inPoint]);
      }
      if (outPoint >= 0 && outPoint < data.length) {
        setOutValue(data[outPoint]);
      }
    }
  }, [audioBuffer, inPoint, outPoint]);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !audioBuffer) return;

    const width = canvas.width;
    const height = canvas.height;
    const data = audioBuffer.getChannelData(0);
    const samples = data.length;

    // Clear canvas with light gray background
    ctx.fillStyle = '#ececec';
    ctx.fillRect(0, 0, width, height);

    // Draw waveform in dark gray
    ctx.fillStyle = '#333';
    const step = Math.ceil(samples / width);
    const amp = height / 2;

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;

      for (let j = 0; j < step; j++) {
        const index = i * step + j;
        if (index < samples) {
          const datum = data[index];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
      }

      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }

    // Draw center line
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }, [audioBuffer]);

  const drawMarkers = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !audioBuffer) return;

    const width = canvas.width;
    const height = canvas.height;
    const samples = audioBuffer.length;

    // Calculate marker positions
    const inX = Math.floor((inPoint / samples) * width);
    const outX = Math.floor((outPoint / samples) * width);

    // Draw markers
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;

    // In marker vertical line
    ctx.beginPath();
    ctx.moveTo(inX, 0);
    ctx.lineTo(inX, height);
    ctx.stroke();

    // Out marker vertical line
    ctx.beginPath();
    ctx.moveTo(outX, 0);
    ctx.lineTo(outX, height);
    ctx.stroke();

    // Draw triangular markers at bottom
    ctx.fillStyle = '#333';
    const triangleSize = 15;

    // In marker triangle (pointing up)
    ctx.beginPath();
    ctx.moveTo(inX - triangleSize / 2, height);
    ctx.lineTo(inX + triangleSize / 2, height);
    ctx.lineTo(inX, height - triangleSize);
    ctx.closePath();
    ctx.fill();

    // Out marker triangle (pointing up)
    ctx.beginPath();
    ctx.moveTo(outX - triangleSize / 2, height);
    ctx.lineTo(outX + triangleSize / 2, height);
    ctx.lineTo(outX, height - triangleSize);
    ctx.closePath();
    ctx.fill();
  }, [audioBuffer, inPoint, outPoint]);

  const updateWaveform = useCallback(() => {
    drawWaveform();
    drawMarkers();
  }, [drawWaveform, drawMarkers]);

  // Handle canvas initialization and sizing ONLY when modal opens
  useEffect(() => {
    if (isOpen && audioBuffer) {
      const canvas = canvasRef.current;
      if (canvas) {
        // Set canvas size - make both width and height responsive
        const container = canvas.parentElement;
        const containerWidth = container?.clientWidth || 300;
        const containerHeight = container?.clientHeight || 300;
        
        const canvasWidth = Math.max(300, containerWidth - 32); // Account for padding
        const canvasHeight = Math.min(250, Math.max(150, containerHeight * 0.5)); // Responsive height with min/max
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Initial draw
        updateWaveform();
      }
    }
  }, [isOpen, audioBuffer]); // Remove updateWaveform from dependencies to prevent resize during dragging

  // Handle redrawing when markers change (without resizing canvas)
  useEffect(() => {
    if (isOpen && audioBuffer) {
      updateWaveform();
    }
  }, [isOpen, audioBuffer, inPoint, outPoint, updateWaveform]);

  // Handle window resize for responsive canvas
  useEffect(() => {
    if (!isOpen || !audioBuffer) return;

    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const container = canvas.parentElement;
        const containerWidth = container?.clientWidth || 300;
        const containerHeight = container?.clientHeight || 300;
        
        const canvasWidth = Math.max(300, containerWidth - 32);
        const canvasHeight = Math.min(250, Math.max(150, containerHeight * 0.5));
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        updateWaveform();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, audioBuffer, updateWaveform]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!audioBuffer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = canvas.width;
    const samples = audioBuffer.length;

    const inX = (inPoint / samples) * width;
    const outX = (outPoint / samples) * width;

    const tolerance = 20;

    if (Math.abs(x - inX) < tolerance) {
      setDragging('in');
    } else if (Math.abs(x - outX) < tolerance) {
      setDragging('out');
    } else {
      // Click to move nearest marker
      const frame = Math.round((x / width) * samples);
      const distanceToIn = Math.abs(x - inX);
      const distanceToOut = Math.abs(x - outX);

      let targetFrame = frame;
      if (snapToZero) {
        targetFrame = findNearestZeroCrossing(audioBuffer, frame, 'both', 500);
      }

      if (distanceToIn < distanceToOut) {
        // Move in point
        const newInPoint = Math.max(0, Math.min(targetFrame, outPoint - 10));
        setInPoint(newInPoint);
      } else {
        // Move out point
        const newOutPoint = Math.max(inPoint + 10, Math.min(targetFrame, samples));
        setOutPoint(newOutPoint);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !audioBuffer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = canvas.width;
    const samples = audioBuffer.length;
    const frame = Math.round((x / width) * samples);

    let targetFrame = frame;
    if (snapToZero) {
      targetFrame = findNearestZeroCrossing(audioBuffer, frame, 'both', 500);
    }

    if (dragging === 'in') {
      const newInPoint = Math.max(0, Math.min(targetFrame, outPoint - 10));
      setInPoint(newInPoint);
    } else if (dragging === 'out') {
      const newOutPoint = Math.max(inPoint + 10, Math.min(targetFrame, samples));
      setOutPoint(newOutPoint);
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const handleSave = () => {
    onSave(inPoint, outPoint);
    onClose();
  };

  const handleInPointChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) || 0;
    const newInPoint = Math.max(0, Math.min(value, outPoint - 10));
    setInPoint(newInPoint);
  };

  const handleOutPointChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10) || 0;
    const newOutPoint = Math.max(inPoint + 10, Math.min(value, audioBuffer?.length || 0));
    setOutPoint(newOutPoint);
  };

  const handleSnapToZeroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isEnabled = e.target.checked;
    setSnapToZero(isEnabled);

    if (isEnabled && audioBuffer) {
      // Find the nearest zero crossing for the current in point
      const snappedIn = findNearestZeroCrossing(audioBuffer, inPoint, 'both', 500);
      const finalIn = Math.max(0, Math.min(snappedIn, outPoint - 10));
      setInPoint(finalIn);

      // Find the nearest zero crossing for the current out point
      const snappedOut = findNearestZeroCrossing(audioBuffer, outPoint, 'both', 500);
      const finalOut = Math.max(finalIn + 10, Math.min(snappedOut, audioBuffer.length));
      setOutPoint(finalOut);
    }
  };

  const playSelection = () => {
    if (!audioBuffer) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createBufferSource();
      
      const selectionLength = outPoint - inPoint;
      const selectionBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        selectionLength,
        audioBuffer.sampleRate
      );
      
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const srcData = audioBuffer.getChannelData(ch);
        const dstData = selectionBuffer.getChannelData(ch);
        for (let i = 0; i < selectionLength; i++) {
          dstData[i] = srcData[inPoint + i];
        }
      }
      
      source.buffer = selectionBuffer;
      source.connect(audioContext.destination);
      source.start(0);
    } catch (error) {
      console.error('Error playing selection:', error);
    }
  };

  // Keyboard event handler for 'p' key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        playSelection();
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, audioBuffer, inPoint, outPoint]);

  if (!audioBuffer || !isOpen) return null;

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
          maxWidth: '900px',
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
            <i className="fas fa-search-plus" style={{
              color: 'var(--color-text-secondary)',
              fontSize: '1.25rem'
            }}></i>
            zoom and edit markers
            <Tooltip 
              content="drag markers to adjust positions. press 'P' to preview."
              isVisible={showTooltip}
            >
              <i 
                className="fas fa-question-circle" 
                style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '1rem',
                  cursor: 'help',
                  marginLeft: '0.25rem'
                }}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              />
            </Tooltip>
          </h3>
        </div>

        {/* Content */}
        <div style={{
          padding: '1.5rem',
          color: '#666',
          fontSize: '0.95rem',
          lineHeight: '1.5'
        }}>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              border: '1px solid #e0e0e0',
              borderRadius: '3px',
              cursor: dragging ? 'grabbing' : 'pointer',
              backgroundColor: '#ececec',
              marginBottom: '1rem',
              display: 'block'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={playSelection}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '3px',
                  backgroundColor: '#333',
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit'
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
                <i className="fas fa-play" style={{ fontSize: '0.8rem' }}></i>
                play selection (P)
              </button>
              <label style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#333',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  id="snap-to-zero"
                  checked={snapToZero}
                  onChange={handleSnapToZeroChange}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: '#333'
                  }}
                />
                <label htmlFor="snap-to-zero" style={{ marginLeft: '8px', cursor: 'pointer', userSelect: 'none' }}>
                  snap to zero crossings
                </label>
              </label>
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '1rem'
          }}>
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '0.875rem',
                fontWeight: '500',
                marginBottom: '0.5rem',
                color: '#333'
              }}>
                start point
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number"
                  id="start-point-input"
                  value={inPoint}
                  onChange={handleInPointChange}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '3px',
                    fontSize: '0.875rem',
                    backgroundColor: '#fff',
                    color: '#333'
                  }}
                />
                <span style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: Math.abs(inValue) < 0.01 ? '#000000' : '#6c757d',
                  color: 'white',
                  borderRadius: '3px',
                  fontSize: '0.75rem',
                  minWidth: '60px',
                  textAlign: 'center'
                }}>
                  {inValue.toFixed(2)}
                </span>
              </div>
            </div>

            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '0.875rem',
                fontWeight: '500',
                marginBottom: '0.5rem',
                color: '#333'
              }}>
                end point
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number"
                  id="end-point-input"
                  value={outPoint}
                  onChange={handleOutPointChange}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '3px',
                    fontSize: '0.875rem',
                    backgroundColor: '#fff',
                    color: '#333'
                  }}
                />
                <span style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: Math.abs(outValue) < 0.01 ? '#000000' : '#6c757d',
                  color: 'white',
                  borderRadius: '3px',
                  fontSize: '0.75rem',
                  minWidth: '60px',
                  textAlign: 'center'
                }}>
                  {outValue.toFixed(2)}
                </span>
              </div>
            </div>
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
        </div>
      </div>
    </div>
  );
} 