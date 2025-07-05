import { useRef, useEffect, useState, useCallback } from 'react';

interface EnhancedWaveformEditorProps {
  audioBuffer: AudioBuffer;
  inPoint: number;
  outPoint: number;
  onMarkersChange: (markers: { inPoint: number; outPoint: number }) => void;
  height?: number;
  className?: string;
  showSnapToZero?: boolean;
  showFrameDisplay?: boolean;
  defaultSnapToZero?: boolean;
}

export function EnhancedWaveformEditor({
  audioBuffer,
  inPoint,
  outPoint,
  onMarkersChange,
  height = 80,
  className = '',
  showSnapToZero = true,
  showFrameDisplay = true,
  defaultSnapToZero = true,
}: EnhancedWaveformEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snapToZero, setSnapToZero] = useState(defaultSnapToZero);
  const [dragging, setDragging] = useState<'in' | 'out' | null>(null);

  // Helper functions
  const frameToTime = (frame: number): number => {
    return frame / audioBuffer.sampleRate;
  };

  const isNearZeroCrossing = (frame: number, threshold: number = 0.01): boolean => {
    const data = audioBuffer.getChannelData(0);
    return frame >= 0 && frame < data.length && Math.abs(data[frame]) < threshold;
  };

  const findNearestZeroCrossing = useCallback((position: number, searchDirection: number, maxSearchDistance = 1000): number => {
    const data = audioBuffer.getChannelData(0);
    const searchStart = Math.max(0, Math.min(position, data.length - 1));
    let bestPosition = searchStart;
    let minAbsValue = Math.abs(data[searchStart]);

    const searchLimit = Math.min(maxSearchDistance, 
      searchDirection > 0 ? data.length - searchStart : searchStart);

    for (let i = 1; i <= searchLimit; i++) {
      const checkPos = searchStart + (i * searchDirection);
      if (checkPos < 0 || checkPos >= data.length) break;

      const absValue = Math.abs(data[checkPos]);
      if (absValue < minAbsValue) {
        minAbsValue = absValue;
        bestPosition = checkPos;
      }

      if (absValue < 0.01) break;
    }

    return bestPosition;
  }, [audioBuffer]);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const data = audioBuffer.getChannelData(0);

    // Clear entire canvas first
    ctx.clearRect(0, 0, width, height);

    // Background drawing logic
    const sampleToPixel = (frame: number) => (audioBuffer.length > 1 ? (frame / audioBuffer.length) * width : 0);
    const inX = sampleToPixel(inPoint);
    const outX = sampleToPixel(outPoint);

    // Out-of-bounds area (light grey)
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);

    // In-bounds area (white)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(inX, 0, outX - inX, height);

    // Waveform
    ctx.fillStyle = '#333333';
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;

      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }

      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }

    // Draw center line
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();


  }, [audioBuffer, inPoint, outPoint, snapToZero]);

  const drawMarkers = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const data = audioBuffer.getChannelData(0);

    const inPos = (inPoint / data.length) * width;
    const outPos = (outPoint / data.length) * width;

    // In/Out markers (dark grey) - solid lines
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(inPos, 0);
    ctx.lineTo(inPos, height);
    ctx.moveTo(outPos, 0);
    ctx.lineTo(outPos, height);
    ctx.stroke();

    // In/Out marker handles - triangles with connected squares
    ctx.fillStyle = '#333333';
    const sampleTriangleSize = 10;
    const squareSize = sampleTriangleSize; // Square width matches triangle base
    
    // Sample start marker (triangle above square, triangle pointing up)
    const squareY = height - squareSize;
    const triBaseY = squareY;
    const triTipY = squareY - sampleTriangleSize;
    ctx.beginPath();
    ctx.moveTo(inPos - sampleTriangleSize / 2, triBaseY);
    ctx.lineTo(inPos + sampleTriangleSize / 2, triBaseY);
    ctx.lineTo(inPos, triTipY);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(inPos - squareSize / 2, squareY, squareSize, squareSize);
    
    // Sample end marker (triangle above square, triangle pointing up)
    ctx.beginPath();
    ctx.moveTo(outPos - sampleTriangleSize / 2, triBaseY);
    ctx.lineTo(outPos + sampleTriangleSize / 2, triBaseY);
    ctx.lineTo(outPos, triTipY);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(outPos - squareSize / 2, squareY, squareSize, squareSize);
  }, [audioBuffer, inPoint, outPoint]);

  // Combined effect for initialization and resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeAndDraw = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = height;
        drawWaveform();
        drawMarkers();
      }
    };

    resizeAndDraw(); // Initial setup
    window.addEventListener('resize', resizeAndDraw);
    return () => window.removeEventListener('resize', resizeAndDraw);
  }, [drawWaveform, drawMarkers, height]);

  // Effect for redrawing markers only, without resizing canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawWaveform();
        drawMarkers();
      }
    }
  }, [inPoint, outPoint, snapToZero, drawWaveform, drawMarkers]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    
    const inPos = (inPoint / audioBuffer.length) * width;
    const outPos = (outPoint / audioBuffer.length) * width;
    
    const tolerance = 15; // pixels - increased for better touch targets
    
    if (Math.abs(x - inPos) < tolerance) {
      setDragging('in');
    } else if (Math.abs(x - outPos) < tolerance) {
      setDragging('out');
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    
    let newFrame = Math.floor((x / width) * audioBuffer.length);
    newFrame = Math.max(0, Math.min(audioBuffer.length, newFrame));
    
    // Apply snap to zero if enabled
    if (snapToZero) {
      newFrame = findNearestZeroCrossing(newFrame, 0);
    }
    
    if (dragging === 'in') {
      const newInPoint = Math.min(newFrame, outPoint - 1000); // Ensure minimum gap
      onMarkersChange({ inPoint: newInPoint, outPoint });
    } else if (dragging === 'out') {
      const newOutPoint = Math.max(newFrame, inPoint + 1000); // Ensure minimum gap
      onMarkersChange({ inPoint, outPoint: newOutPoint });
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  // Theme colors
  const c = {
    bg: 'var(--color-bg-primary)',
    bgAlt: 'var(--color-bg-secondary)',
    border: 'var(--color-border-light)',
    text: 'var(--color-text-primary)',
    textSecondary: 'var(--color-text-secondary)',
  };

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: `${height}px`,
          border: `1px solid ${c.border}`,
          borderRadius: '3px',
          cursor: dragging ? 'grabbing' : 'pointer',
          display: 'block',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      
      {showFrameDisplay && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '1rem', 
          marginTop: '0.5rem' 
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.25rem',
            flexWrap: 'nowrap'
          }}>
            <span style={{ 
              minWidth: '70px', 
              fontSize: '0.7rem', 
              color: c.textSecondary,
              flexShrink: 0
            }}>
              sample start:
            </span>
            <span style={{
              padding: '0.2rem 0.4rem',
              backgroundColor: c.bgAlt,
              border: `1px solid ${c.border}`,
              borderRadius: '3px',
              fontSize: '0.75rem',
              fontWeight: '500',
              minWidth: '80px',
              textAlign: 'right',
              flexShrink: 0
            }}>
              {inPoint.toLocaleString()}
            </span>
            <span style={{ 
              fontSize: '0.7rem', 
              color: c.textSecondary,
              marginLeft: '0.25rem',
              flexShrink: 0
            }}>
              frames ({frameToTime(inPoint).toFixed(3)}s)
            </span>
            <span style={{ 
              fontSize: '0.65rem', 
              color: isNearZeroCrossing(inPoint) ? '#6b7280' : '#9ca3af',
              fontWeight: '500',
              marginLeft: '0.25rem',
              flexShrink: 0
            }}>
              {isNearZeroCrossing(inPoint) ? '✓ zero' : '✗ not zero'}
            </span>
          </div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.25rem',
            flexWrap: 'nowrap'
          }}>
            <span style={{ 
              minWidth: '70px', 
              fontSize: '0.7rem', 
              color: c.textSecondary,
              flexShrink: 0
            }}>
              sample end:
            </span>
            <span style={{
              padding: '0.2rem 0.4rem',
              backgroundColor: c.bgAlt,
              border: `1px solid ${c.border}`,
              borderRadius: '3px',
              fontSize: '0.75rem',
              fontWeight: '500',
              minWidth: '80px',
              textAlign: 'right',
              flexShrink: 0
            }}>
              {outPoint.toLocaleString()}
            </span>
            <span style={{ 
              fontSize: '0.7rem', 
              color: c.textSecondary,
              marginLeft: '0.25rem',
              flexShrink: 0
            }}>
              frames ({frameToTime(outPoint).toFixed(3)}s)
            </span>
            <span style={{ 
              fontSize: '0.65rem', 
              color: isNearZeroCrossing(outPoint) ? '#6b7280' : '#9ca3af',
              fontWeight: '500',
              marginLeft: '0.25rem',
              flexShrink: 0
            }}>
              {isNearZeroCrossing(outPoint) ? '✓ zero' : '✗ not zero'}
            </span>
          </div>
        </div>
      )}
      
      {showSnapToZero && (
        <div style={{ 
          marginTop: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.25rem', 
            fontSize: '0.75rem', 
            fontWeight: '500',
            color: c.textSecondary,
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={snapToZero}
              onChange={(e) => setSnapToZero(e.target.checked)}
              style={{
                width: '12px',
                height: '12px',
                accentColor: c.textSecondary
              }}
            />
            <span>snap to zero</span>
          </label>
        </div>
      )}
    </div>
  );
} 