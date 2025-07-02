import { useRef, useEffect, useState, useCallback } from 'react';
import { findNearestZeroCrossing } from '../../utils/audio';

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
    ctx.lineWidth = 2;

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
    const triangleSize = 10;

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

  // Handle canvas initialization and updates
  useEffect(() => {
    if (isOpen && audioBuffer) {
      const canvas = canvasRef.current;
      if (canvas) {
        // Set canvas size
        const parentWidth = (canvas.parentElement?.clientWidth || 300) - 32;
        canvas.width = parentWidth;
        canvas.height = 200;
        
        updateWaveform();
      }
    }
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
              color: '#222',
              fontSize: '1.25rem'
            }}></i>
            zoom & edit markers
          </h3>
        </div>

        {/* Content */}
        <div style={{
          padding: '1.5rem',
          color: '#666',
          fontSize: '0.95rem',
          lineHeight: '1.5'
        }}>
          <p style={{ 
            fontSize: '0.875rem', 
            color: '#666',
            margin: '0 0 1rem 0'
          }}>
            tip: drag markers to adjust positions. press 'p' to preview the sample.
          </p>
          
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '200px',
              border: '1px solid #e0e0e0',
              borderRadius: '3px',
              cursor: dragging ? 'grabbing' : 'pointer',
              backgroundColor: '#ececec',
              marginBottom: '1rem'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />

          <div style={{ marginBottom: '1rem' }}>
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
                onChange={(e) => setSnapToZero(e.target.checked)}
                style={{
                  width: '16px',
                  height: '16px',
                  accentColor: '#333'
                }}
              />
              snap to zero crossings
            </label>
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
                  backgroundColor: Math.abs(inValue) < 0.01 ? '#28a745' : '#6c757d',
                  color: 'white',
                  borderRadius: '3px',
                  fontSize: '0.75rem',
                  minWidth: '60px',
                  textAlign: 'center'
                }}>
                  {inValue.toFixed(3)}
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
                  backgroundColor: Math.abs(outValue) < 0.01 ? '#28a745' : '#6c757d',
                  color: 'white',
                  borderRadius: '3px',
                  fontSize: '0.75rem',
                  minWidth: '60px',
                  textAlign: 'center'
                }}>
                  {outValue.toFixed(3)}
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