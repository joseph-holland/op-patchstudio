import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { findNearestZeroCrossing } from '../../utils/audio';
import { audioContextManager } from '../../utils/audioContext';
import { Tooltip } from './Tooltip';

interface WaveformZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioBuffer: AudioBuffer | null;
  initialInPoint: number;
  initialOutPoint: number;
  initialLoopStart?: number;
  initialLoopEnd?: number;
  onSave: (inPoint: number, outPoint: number, loopStart?: number, loopEnd?: number) => void;
}

export function WaveformZoomModal({
  isOpen,
  onClose,
  audioBuffer,
  initialInPoint,
  initialOutPoint,
  initialLoopStart,
  initialLoopEnd,
  onSave,
}: WaveformZoomModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [inFrame, setInFrame] = useState(0);
  const [outFrame, setOutFrame] = useState(0);
  const [loopStartFrame, setLoopStartFrame] = useState(0);
  const [loopEndFrame, setLoopEndFrame] = useState(0);
  const [snapToZero, setSnapToZero] = useState(true);
  const [dragging, setDragging] = useState<'in' | 'out' | 'loopStart' | 'loopEnd' | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // Check if this is a multisample (has loop points)
  const hasLoopPoints = initialLoopStart !== undefined && initialLoopEnd !== undefined;

  // Helper functions for frame and time display
  const frameToTime = (frame: number): number => {
    if (!audioBuffer) return 0;
    return frame / audioBuffer.sampleRate;
  };

  // Check if a frame is at or near zero crossing
  const isNearZeroCrossing = (frame: number, threshold: number = 0.01): boolean => {
    if (!audioBuffer) return false;
    const data = audioBuffer.getChannelData(0);
    return frame >= 0 && frame < data.length && Math.abs(data[frame]) < threshold;
  };

  // Theme colors
  const c = {
    bg: 'var(--color-bg-primary)',
    bgAlt: 'var(--color-bg-secondary)',
    border: 'var(--color-border-light)',
    text: 'var(--color-text-primary)',
    textSecondary: 'var(--color-text-secondary)',
    action: 'var(--color-interactive-focus)',
  };

  // Initialize frames when modal opens
  useEffect(() => {
    if (isOpen && audioBuffer) {
      const durationSec = audioBuffer.length / audioBuffer.sampleRate;
      setInFrame(Math.floor((initialInPoint / durationSec) * audioBuffer.length));
      setOutFrame(Math.floor((initialOutPoint / durationSec) * audioBuffer.length));
      
      if (hasLoopPoints) {
        setLoopStartFrame(Math.floor((initialLoopStart! / durationSec) * audioBuffer.length));
        setLoopEndFrame(Math.floor((initialLoopEnd! / durationSec) * audioBuffer.length));
      }
    }
  }, [isOpen, audioBuffer, initialInPoint, initialOutPoint, initialLoopStart, initialLoopEnd, hasLoopPoints]);

  const findNearestZeroCrossingLocal = useCallback((position: number, searchDirection: number, maxSearchDistance = 1000): number => {
    if (!audioBuffer) return position;
    
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
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const data = audioBuffer.getChannelData(0);

    // Clear entire canvas first
    ctx.clearRect(0, 0, width, height);

    // Background drawing logic
    const sampleToPixel = (frame: number) => (audioBuffer.length > 1 ? (frame / audioBuffer.length) * width : 0);
    const inX = sampleToPixel(inFrame);
    const outX = sampleToPixel(outFrame);

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

    // Draw zero crossing indicators (subtle dotted lines)
    if (snapToZero) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      
      // Find and draw zero crossings every ~1000 samples
      const stepSize = Math.max(1000, Math.floor(data.length / 50));
      for (let i = 0; i < data.length; i += stepSize) {
        if (Math.abs(data[i]) < 0.05) {
          const x = sampleToPixel(i);
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }
  }, [audioBuffer, inFrame, outFrame, snapToZero]);

  const drawMarkers = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const data = audioBuffer.getChannelData(0);

    const inPos = (inFrame / data.length) * width;
    const outPos = (outFrame / data.length) * width;
    const loopStartPos = hasLoopPoints ? (loopStartFrame / data.length) * width : 0;
    const loopEndPos = hasLoopPoints ? (loopEndFrame / data.length) * width : 0;

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
    const margin = 2; // margin from bottom
    const bottomHandleY = height - (squareSize + margin);
    
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

    // Draw loop markers if this is a multisample
    if (hasLoopPoints) {
      // Loop markers (medium grey) - dashed lines
      const triangleSize = 10;
      const squareSize = triangleSize; // Square width matches triangle base
      ctx.fillStyle = '#555555';
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);

      // Loop start - vertical line, square above triangle
      ctx.beginPath();
      ctx.moveTo(loopStartPos, 0);
      ctx.lineTo(loopStartPos, height);
      ctx.stroke();
      
      ctx.setLineDash([]);
      // Square above triangle
      ctx.fillRect(loopStartPos - squareSize / 2, 0, squareSize, squareSize);
      // Triangle pointing down from square
      ctx.beginPath();
      ctx.moveTo(loopStartPos - triangleSize / 2, squareSize);
      ctx.lineTo(loopStartPos + triangleSize / 2, squareSize);
      ctx.lineTo(loopStartPos, squareSize + triangleSize);
      ctx.closePath();
      ctx.fill();

      // Loop end - vertical line, square above triangle
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(loopEndPos, 0);
      ctx.lineTo(loopEndPos, height);
      ctx.stroke();
      
      ctx.setLineDash([]);
      // Square above triangle
      ctx.fillRect(loopEndPos - squareSize / 2, 0, squareSize, squareSize);
      // Triangle pointing down from square
      ctx.beginPath();
      ctx.moveTo(loopEndPos - triangleSize / 2, squareSize);
      ctx.lineTo(loopEndPos + triangleSize / 2, squareSize);
      ctx.lineTo(loopEndPos, squareSize + triangleSize);
      ctx.closePath();
      ctx.fill();
    }
  }, [audioBuffer, inFrame, outFrame, loopStartFrame, loopEndFrame, hasLoopPoints]);

  // Combined effect for initialization and resizing
  useEffect(() => {
    if (!isOpen || !audioBuffer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeAndDraw = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = 200; // Fixed height
        drawWaveform();
        drawMarkers();
      }
    };

    resizeAndDraw(); // Initial setup

    window.addEventListener('resize', resizeAndDraw);
    return () => window.removeEventListener('resize', resizeAndDraw);
  }, [isOpen, audioBuffer, drawWaveform, drawMarkers]);

  // Effect for redrawing markers only, without resizing canvas
  useEffect(() => {
    if (isOpen && audioBuffer) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawWaveform();
          drawMarkers();
        }
      }
    }
  }, [inFrame, outFrame, loopStartFrame, loopEndFrame, isOpen, audioBuffer, drawWaveform, drawMarkers]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!audioBuffer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = canvas.width;
    const height = canvas.height;
    const data = audioBuffer.getChannelData(0);

    const inPos = (inFrame / data.length) * width;
    const outPos = (outFrame / data.length) * width;
    const loopStartPos = hasLoopPoints ? (loopStartFrame / data.length) * width : 0;
    const loopEndPos = hasLoopPoints ? (loopEndFrame / data.length) * width : 0;

    // Define vertical zones for marker selection
    const topZone = height * 0.2;
    const bottomZone = height * 0.8;
    const tolerance = 40;

    // Determine available markers based on vertical zone and sample type
    let availableMarkers: Array<'in' | 'out' | 'loopStart' | 'loopEnd'> = [];
    
    if (hasLoopPoints) {
      if (y <= topZone) {
        availableMarkers = ['loopStart', 'loopEnd'];
      } else if (y >= bottomZone) {
        availableMarkers = ['in', 'out'];
      } else {
        availableMarkers = ['in', 'loopStart', 'loopEnd', 'out'];
      }
    } else {
      availableMarkers = ['in', 'out'];
    }

    const markerPositions = {
      in: inPos,
      loopStart: loopStartPos,
      loopEnd: loopEndPos,
      out: outPos
    };

    // Check for marker grabs
    let grabbed = false;
    for (const markerType of availableMarkers) {
      if (Math.abs(x - markerPositions[markerType]) < tolerance) {
        setDragging(markerType);
        grabbed = true;
        break;
      }
    }

    if (!grabbed) {
      // Click to move nearest available marker
      const distances: Record<string, number> = {};
      availableMarkers.forEach(markerType => {
        distances[markerType] = Math.abs(x - markerPositions[markerType]);
      });

      const closest = Object.keys(distances).reduce((a, b) => distances[a] < distances[b] ? a : b) as 'in' | 'out' | 'loopStart' | 'loopEnd';
      
      let targetFrame = Math.round((x / width) * data.length);
      if (snapToZero) {
        targetFrame = findNearestZeroCrossingLocal(targetFrame, targetFrame > data.length / 2 ? -1 : 1, 500);
      }

      // Apply constraints when moving markers
      switch (closest) {
        case 'in':
          const newInFrame = Math.max(0, Math.min(targetFrame, data.length - 1));
          setInFrame(newInFrame);
          if (hasLoopPoints && newInFrame >= loopStartFrame) {
            setLoopStartFrame(Math.min(newInFrame + 1, loopEndFrame - 1));
          }
          break;
        case 'loopStart':
          if (hasLoopPoints) {
            setLoopStartFrame(Math.max(inFrame, Math.min(targetFrame, loopEndFrame - 1)));
          }
          break;
        case 'loopEnd':
          if (hasLoopPoints) {
            setLoopEndFrame(Math.max(loopStartFrame + 1, Math.min(targetFrame, outFrame)));
          }
          break;
        case 'out':
          const newOutFrame = Math.max(hasLoopPoints ? loopStartFrame + 2 : inFrame + 1, Math.min(targetFrame, data.length));
          setOutFrame(newOutFrame);
          if (hasLoopPoints && newOutFrame <= loopEndFrame) {
            setLoopEndFrame(Math.max(newOutFrame - 1, loopStartFrame + 1));
          }
          break;
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
    const data = audioBuffer.getChannelData(0);

    const frame = Math.round((x / width) * data.length);
    let targetFrame = frame;
    if (snapToZero) {
      targetFrame = findNearestZeroCrossingLocal(frame, frame > data.length / 2 ? -1 : 1, 500);
    }

    switch (dragging) {
      case 'in':
        const newInFrame = Math.max(0, Math.min(targetFrame, hasLoopPoints ? loopEndFrame - 2 : outFrame - 1, data.length - 1));
        setInFrame(newInFrame);
        if (hasLoopPoints && newInFrame >= loopStartFrame) {
          setLoopStartFrame(Math.min(newInFrame + 1, loopEndFrame - 1));
        }
        break;
      case 'loopStart':
        if (hasLoopPoints) {
          if (targetFrame < inFrame) {
            setInFrame(Math.max(0, targetFrame));
            setLoopStartFrame(Math.max(Math.max(0, targetFrame), Math.min(targetFrame, loopEndFrame - 1)));
          } else {
            setLoopStartFrame(Math.max(inFrame, Math.min(targetFrame, loopEndFrame - 1)));
          }
        }
        break;
      case 'loopEnd':
        if (hasLoopPoints) {
          setLoopEndFrame(Math.max(loopStartFrame + 1, Math.min(targetFrame, outFrame)));
        }
        break;
      case 'out':
        const newOutFrame = Math.max(hasLoopPoints ? loopStartFrame + 2 : inFrame + 1, Math.min(targetFrame, data.length));
        setOutFrame(newOutFrame);
        if (hasLoopPoints && newOutFrame <= loopEndFrame) {
          setLoopEndFrame(Math.max(newOutFrame - 1, loopStartFrame + 1));
        }
        break;
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const handleSave = () => {
    if (!audioBuffer) return;
    const durationSec = audioBuffer.length / audioBuffer.sampleRate;
    const inPointSec = (inFrame / audioBuffer.length) * durationSec;
    const outPointSec = (outFrame / audioBuffer.length) * durationSec;
    
    if (hasLoopPoints) {
      const loopStartSec = (loopStartFrame / audioBuffer.length) * durationSec;
      const loopEndSec = (loopEndFrame / audioBuffer.length) * durationSec;
      onSave(inPointSec, outPointSec, loopStartSec, loopEndSec);
    } else {
      onSave(inPointSec, outPointSec);
    }
    onClose();
  };

  const playSelection = async () => {
    if (!audioBuffer) return;

    try {
      const audioContext = await audioContextManager.getAudioContext();
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

      const startOffset = (inFrame / audioBuffer.length) * audioBuffer.duration;
      const endOffset = (outFrame / audioBuffer.length) * audioBuffer.duration;
      const duration = endOffset - startOffset;

      if (duration > 0) {
        source.connect(audioContext.destination);
        source.start(0, startOffset, duration);
      }
    } catch (error) {
      console.error('Error playing selection:', error);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        playSelection().catch(error => {
          console.error('Error playing selection:', error);
        });
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen]);

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
          backgroundColor: c.bg,
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
          borderBottom: `1px solid ${c.border}`
        }}>
          <h3 style={{
            margin: '0',
            fontSize: '1.25rem',
            fontWeight: '300',
            color: c.text,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <i className="fas fa-search-plus" style={{
              color: c.textSecondary,
              fontSize: '1.25rem'
            }}></i>
            zoom and edit markers
            <Tooltip
              content="drag markers to adjust positions. press 'p' to preview."
              isVisible={showTooltip}
            >
              <i
                className="fas fa-question-circle"
                style={{
                  color: c.textSecondary,
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
          color: c.textSecondary,
          fontSize: '0.95rem',
          lineHeight: '1.5'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                border: `1px solid ${c.border}`,
                borderRadius: '3px',
                cursor: dragging ? 'grabbing' : 'pointer',
                display: 'block'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

          {/* Marker Display */}
          {hasLoopPoints ? (
            // Multisample layout: 2x2 grid
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ minWidth: '80px', fontSize: '0.75rem', color: c.textSecondary }}>
                    sample start:
                  </span>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: c.bgAlt,
                    border: `1px solid ${c.border}`,
                    borderRadius: '3px',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    minWidth: '90px',
                    textAlign: 'right'
                  }}>
                    {audioBuffer ? inFrame.toLocaleString() : '0'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: c.textSecondary }}>
                    frames ({audioBuffer ? frameToTime(inFrame).toFixed(3) : '0.000'}s)
                  </span>
                  <span style={{ 
                    fontSize: '0.65rem', 
                    color: isNearZeroCrossing(inFrame) ? '#6b7280' : '#9ca3af',
                    fontWeight: '500'
                  }}>
                    {isNearZeroCrossing(inFrame) ? '✓ zero' : '✗ not zero'}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ minWidth: '80px', fontSize: '0.75rem', color: c.textSecondary }}>
                    sample end:
                  </span>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: c.bgAlt,
                    border: `1px solid ${c.border}`,
                    borderRadius: '3px',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    minWidth: '90px',
                    textAlign: 'right'
                  }}>
                    {audioBuffer ? outFrame.toLocaleString() : '0'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: c.textSecondary }}>
                    frames ({audioBuffer ? frameToTime(outFrame).toFixed(3) : '0.000'}s)
                  </span>
                  <span style={{ 
                    fontSize: '0.65rem', 
                    color: isNearZeroCrossing(outFrame) ? '#6b7280' : '#9ca3af',
                    fontWeight: '500'
                  }}>
                    {isNearZeroCrossing(outFrame) ? '✓ zero' : '✗ not zero'}
                  </span>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ minWidth: '80px', fontSize: '0.75rem', color: c.textSecondary }}>
                    loop start:
                  </span>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: c.bgAlt,
                    border: `1px solid ${c.border}`,
                    borderRadius: '3px',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    minWidth: '90px',
                    textAlign: 'right'
                  }}>
                    {audioBuffer ? loopStartFrame.toLocaleString() : '0'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: c.textSecondary }}>
                    frames ({audioBuffer ? frameToTime(loopStartFrame).toFixed(3) : '0.000'}s)
                  </span>
                  <span style={{ 
                    fontSize: '0.65rem', 
                    color: isNearZeroCrossing(loopStartFrame) ? '#6b7280' : '#9ca3af',
                    fontWeight: '500'
                  }}>
                    {isNearZeroCrossing(loopStartFrame) ? '✓ zero' : '✗ not zero'}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ minWidth: '80px', fontSize: '0.75rem', color: c.textSecondary }}>
                    loop end:
                  </span>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: c.bgAlt,
                    border: `1px solid ${c.border}`,
                    borderRadius: '3px',
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    minWidth: '90px',
                    textAlign: 'right'
                  }}>
                    {audioBuffer ? loopEndFrame.toLocaleString() : '0'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: c.textSecondary }}>
                    frames ({audioBuffer ? frameToTime(loopEndFrame).toFixed(3) : '0.000'}s)
                  </span>
                  <span style={{ 
                    fontSize: '0.65rem', 
                    color: isNearZeroCrossing(loopEndFrame) ? '#6b7280' : '#9ca3af',
                    fontWeight: '500'
                  }}>
                    {isNearZeroCrossing(loopEndFrame) ? '✓ zero' : '✗ not zero'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            // Drum sample layout: single row
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ minWidth: '80px', fontSize: '0.75rem', color: c.textSecondary }}>
                  sample start:
                </span>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: c.bgAlt,
                  border: `1px solid ${c.border}`,
                  borderRadius: '3px',
                  fontSize: '0.8rem',
                  fontWeight: '500',
                  minWidth: '90px',
                  textAlign: 'right'
                }}>
                  {inFrame.toLocaleString()}
                </span>
                <span style={{ fontSize: '0.7rem', color: c.textSecondary }}>
                  frames ({frameToTime(inFrame).toFixed(3)}s)
                </span>
                <span style={{ 
                  fontSize: '0.65rem', 
                  color: isNearZeroCrossing(inFrame) ? '#6b7280' : '#9ca3af',
                  fontWeight: '500'
                }}>
                  {isNearZeroCrossing(inFrame) ? '✓ zero' : '✗ not zero'}
                </span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ minWidth: '80px', fontSize: '0.75rem', color: c.textSecondary }}>
                  sample end:
                </span>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: c.bgAlt,
                  border: `1px solid ${c.border}`,
                  borderRadius: '3px',
                  fontSize: '0.8rem',
                  fontWeight: '500',
                  minWidth: '90px',
                  textAlign: 'right'
                }}>
                  {outFrame.toLocaleString()}
                </span>
                <span style={{ fontSize: '0.7rem', color: c.textSecondary }}>
                  frames ({frameToTime(outFrame).toFixed(3)}s)
                </span>
                <span style={{ 
                  fontSize: '0.65rem', 
                  color: isNearZeroCrossing(outFrame) ? '#6b7280' : '#9ca3af',
                  fontWeight: '500'
                }}>
                  {isNearZeroCrossing(outFrame) ? '✓ zero' : '✗ not zero'}
                </span>
              </div>
            </div>
          )}
          
          <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: '1rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <button
                onClick={() => playSelection().catch(error => {
                  console.error('Error playing selection:', error);
                })}
                style={{
                  padding: '0.65rem 1rem',
                  border: `1px solid ${c.border}`,
                  borderRadius: '3px',
                  background: 'transparent',
                  color: c.textSecondary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  fontFamily: 'inherit'
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
                color: 'var(--color-text-primary)',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={snapToZero}
                  onChange={(e) => setSnapToZero(e.target.checked)}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: 'var(--color-text-primary)'
                  }}
                />
                <span style={{ marginLeft: '8px', cursor: 'pointer', userSelect: 'none' }}>
                  snap to zero crossings
                </span>
              </label>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          background: c.bgAlt,
          borderTop: `1px solid ${c.border}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '1rem'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.65rem 1rem',
              border: `1px solid ${c.border}`,
              borderRadius: '3px',
              background: 'transparent',
              color: c.textSecondary,
              cursor: 'pointer'
            }}
          >
            cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '0.65rem 1rem',
              border: 'none',
              borderRadius: '3px',
              background: c.action,
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            save markers
          </button>
        </div>
      </div>
    </div>
  );
} 