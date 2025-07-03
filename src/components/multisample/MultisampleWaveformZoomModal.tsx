import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Tooltip } from '../common/Tooltip';

interface MultisampleWaveformZoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioBuffer: AudioBuffer | null;
  initialInPoint: number;
  initialOutPoint: number;
  initialLoopStart: number;
  initialLoopEnd: number;
  onSave: (inPoint: number, outPoint: number, loopStart: number, loopEnd: number) => void;
}

export function MultisampleWaveformZoomModal({
  isOpen,
  onClose,
  audioBuffer,
  initialInPoint,
  initialOutPoint,
  initialLoopStart,
  initialLoopEnd,
  onSave
}: MultisampleWaveformZoomModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [inFrame, setInFrame] = useState(0);
  const [outFrame, setOutFrame] = useState(0);
  const [loopStartFrame, setLoopStartFrame] = useState(0);
  const [loopEndFrame, setLoopEndFrame] = useState(0);
  const [dragging, setDragging] = useState<'in' | 'out' | 'loopStart' | 'loopEnd' | null>(null);
  const [snapToZero, setSnapToZero] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  const [inValue, setInValue] = useState(0);
  const [outValue, setOutValue] = useState(0);
  const [loopStartValue, setLoopStartValue] = useState(0);
  const [loopEndValue, setLoopEndValue] = useState(0);
  
  // Helper functions for percentage conversion
  const frameToPercentage = (frame: number) => {
    if (!audioBuffer) return 0;
    return (frame / audioBuffer.length) * 100;
  };
  
  const percentageToFrame = (percentage: number) => {
    if (!audioBuffer) return 0;
    return Math.floor((percentage / 100) * audioBuffer.length);
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
      // All initial values are time in seconds, convert to frames
      const duration = audioBuffer.length / audioBuffer.sampleRate;
      setInFrame(Math.floor((initialInPoint / duration) * audioBuffer.length));
      setOutFrame(Math.floor((initialOutPoint / duration) * audioBuffer.length));
      setLoopStartFrame(Math.floor((initialLoopStart / duration) * audioBuffer.length));
      setLoopEndFrame(Math.floor((initialLoopEnd / duration) * audioBuffer.length));
    }
  }, [isOpen, audioBuffer, initialInPoint, initialOutPoint, initialLoopStart, initialLoopEnd]);

  // Update sample values when markers change
  useEffect(() => {
    if (audioBuffer) {
      const data = audioBuffer.getChannelData(0);
      if (inFrame >= 0 && inFrame < data.length) {
        setInValue(data[inFrame]);
      }
      if (outFrame >= 0 && outFrame < data.length) {
        setOutValue(data[outFrame]);
      }
      if (loopStartFrame >= 0 && loopStartFrame < data.length) {
        setLoopStartValue(data[loopStartFrame]);
      }
      if (loopEndFrame >= 0 && loopEndFrame < data.length) {
        setLoopEndValue(data[loopEndFrame]);
      }
    }
  }, [audioBuffer, inFrame, outFrame, loopStartFrame, loopEndFrame]);

  const findNearestZeroCrossing = useCallback((position: number, searchDirection: number, maxSearchDistance = 1000): number => {
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

    // --- New background drawing logic ---
    const sampleToPixel = (frame: number) => (audioBuffer.length > 1 ? (frame / audioBuffer.length) * width : 0);
    const inX = sampleToPixel(inFrame);
    const outX = sampleToPixel(outFrame);

    // Out-of-bounds area (light grey)
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);

    // In-bounds area (white)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(inX, 0, outX - inX, height);
    // --- End new background drawing logic ---

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
  }, [audioBuffer, inFrame, outFrame]);

  const drawMarkers = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const data = audioBuffer.getChannelData(0);

    const inPos = (inFrame / data.length) * width;
    const loopStartPos = (loopStartFrame / data.length) * width;
    const loopEndPos = (loopEndFrame / data.length) * width;
    const outPos = (outFrame / data.length) * width;

    // In/Out markers (dark grey) - solid lines
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(inPos, 0);
    ctx.lineTo(inPos, height);
    ctx.moveTo(outPos, 0);
    ctx.lineTo(outPos, height);
    ctx.stroke();

    // In/Out marker handles - triangles pointing up from bottom
    ctx.fillStyle = '#333333';
    const sampleTriangleSize = 14;
    const bottomY = height;
    
    // Sample start triangle (pointing up)
    ctx.beginPath();
    ctx.moveTo(inPos - sampleTriangleSize / 2, bottomY);
    ctx.lineTo(inPos + sampleTriangleSize / 2, bottomY);
    ctx.lineTo(inPos, bottomY - sampleTriangleSize);
    ctx.closePath();
    ctx.fill();
    
    // Sample end triangle (pointing up)
    ctx.beginPath();
    ctx.moveTo(outPos - sampleTriangleSize / 2, bottomY);
    ctx.lineTo(outPos + sampleTriangleSize / 2, bottomY);
    ctx.lineTo(outPos, bottomY - sampleTriangleSize);
    ctx.closePath();
    ctx.fill();

    // Loop markers (medium grey) - dashed lines
    const triangleSize = 14;
    ctx.fillStyle = '#555555';
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    // Loop start - vertical line and triangle at top
    ctx.beginPath();
    ctx.moveTo(loopStartPos, 0);
    ctx.lineTo(loopStartPos, height);
    ctx.stroke();
    
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(loopStartPos - triangleSize / 2, 0);
    ctx.lineTo(loopStartPos + triangleSize / 2, 0);
    ctx.lineTo(loopStartPos, triangleSize);
    ctx.closePath();
    ctx.fill();

    // Loop end - vertical line and triangle at top
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(loopEndPos, 0);
    ctx.lineTo(loopEndPos, height);
    ctx.stroke();
    
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(loopEndPos - triangleSize / 2, 0);
    ctx.lineTo(loopEndPos + triangleSize / 2, 0);
    ctx.lineTo(loopEndPos, triangleSize);
    ctx.closePath();
    ctx.fill();
  }, [audioBuffer, inFrame, outFrame, loopStartFrame, loopEndFrame]);

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
          // No need to clear the whole canvas, just redraw
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
    const loopStartPos = (loopStartFrame / data.length) * width;
    const loopEndPos = (loopEndFrame / data.length) * width;
    const outPos = (outFrame / data.length) * width;

    // Define vertical zones for marker selection
    const topZone = height * 0.2;
    const bottomZone = height * 0.8;
    const tolerance = 40;

    // Determine available markers based on vertical zone
    let availableMarkers: Array<'in' | 'out' | 'loopStart' | 'loopEnd'> = [];
    
    if (y <= topZone) {
      availableMarkers = ['loopStart', 'loopEnd'];
    } else if (y >= bottomZone) {
      availableMarkers = ['in', 'out'];
    } else {
      availableMarkers = ['in', 'loopStart', 'loopEnd', 'out'];
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
        targetFrame = findNearestZeroCrossing(targetFrame, targetFrame > data.length / 2 ? -1 : 1, 500);
      }

      // Apply constraints when moving markers
      switch (closest) {
        case 'in':
          const newInFrame = Math.max(0, Math.min(targetFrame, data.length - 1));
          setInFrame(newInFrame);
          if (newInFrame >= loopStartFrame) {
            setLoopStartFrame(Math.min(newInFrame + 1, loopEndFrame - 1));
          }
          break;
        case 'loopStart':
          setLoopStartFrame(Math.max(inFrame, Math.min(targetFrame, loopEndFrame - 1)));
          break;
        case 'loopEnd':
          setLoopEndFrame(Math.max(loopStartFrame + 1, Math.min(targetFrame, outFrame)));
          break;
        case 'out':
          const newOutFrame = Math.max(loopStartFrame + 2, Math.min(targetFrame, data.length));
          setOutFrame(newOutFrame);
          if (newOutFrame <= loopEndFrame) {
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
      targetFrame = findNearestZeroCrossing(frame, frame > data.length / 2 ? -1 : 1, 500);
    }

    switch (dragging) {
      case 'in':
        const newInFrame = Math.max(0, Math.min(targetFrame, loopEndFrame - 2, data.length - 1));
        setInFrame(newInFrame);
        if (newInFrame >= loopStartFrame) {
          setLoopStartFrame(Math.min(newInFrame + 1, loopEndFrame - 1));
        }
        break;
      case 'loopStart':
        if (targetFrame < inFrame) {
          setInFrame(Math.max(0, targetFrame));
          setLoopStartFrame(Math.max(Math.max(0, targetFrame), Math.min(targetFrame, loopEndFrame - 1)));
        } else {
          setLoopStartFrame(Math.max(inFrame, Math.min(targetFrame, loopEndFrame - 1)));
        }
        break;
      case 'loopEnd':
        setLoopEndFrame(Math.max(loopStartFrame + 1, Math.min(targetFrame, outFrame)));
        break;
      case 'out':
        const newOutFrame = Math.max(loopStartFrame + 2, Math.min(targetFrame, data.length));
        setOutFrame(newOutFrame);
        if (newOutFrame <= loopEndFrame) {
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
    
    const duration = audioBuffer.length / audioBuffer.sampleRate;
    const inPoint = (inFrame / audioBuffer.length) * duration;
    const outPoint = (outFrame / audioBuffer.length) * duration;
    const loopStart = (loopStartFrame / audioBuffer.length) * duration;
    const loopEnd = (loopEndFrame / audioBuffer.length) * duration;

    onSave(inPoint, outPoint, loopStart, loopEnd);
    onClose();
  };

  const playSelection = () => {
    if (!audioBuffer) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createBufferSource();
      
      const selectionLength = outFrame - inFrame;
      const selectionBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        selectionLength,
        audioBuffer.sampleRate
      );
      
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const srcData = audioBuffer.getChannelData(ch);
        const dstData = selectionBuffer.getChannelData(ch);
        for (let i = 0; i < selectionLength; i++) {
          dstData[i] = srcData[inFrame + i];
        }
      }
      
      source.buffer = selectionBuffer;
      source.connect(audioContext.destination);
      source.start(0);
    } catch (error) {
      console.error('Error playing selection:', error);
    }
  };

  // Add keyboard handler for 'p' key
  useEffect(() => {
    if (!isOpen || !audioBuffer) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        playSelection();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, audioBuffer, inFrame, outFrame]);

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
          backgroundColor: 'var(--color-bg-primary)',
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
          borderBottom: '1px solid var(--color-border-light)'
        }}>
          <h3 style={{
            margin: '0',
            fontSize: '1.25rem',
            fontWeight: '300',
            color: 'var(--color-text-primary)',
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
          color: 'var(--color-text-secondary)',
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: c.textSecondary, marginBottom: '0.25rem' }}>
              sample start
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: 'var(--color-bg-secondary)',
                border: `1px solid ${c.border}`,
                borderRadius: '3px',
                fontSize: '0.75rem',
                color: 'var(--color-text-primary)',
                minWidth: '60px',
                textAlign: 'center'
              }}>
                {audioBuffer ? `${Math.round(frameToPercentage(inFrame))}%` : '0%'}
              </span>
              <span style={{
                padding: '0.15rem 0.3rem',
                backgroundColor: Math.abs(inValue) < 0.01 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                color: 'var(--color-white)',
                borderRadius: '3px',
                fontSize: '0.65rem',
                minWidth: '35px',
                textAlign: 'center'
              }}>
                {inValue.toFixed(2)}
              </span>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: c.textSecondary, marginBottom: '0.25rem' }}>
              sample end
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: 'var(--color-bg-secondary)',
                border: `1px solid ${c.border}`,
                borderRadius: '3px',
                fontSize: '0.75rem',
                color: 'var(--color-text-primary)',
                minWidth: '60px',
                textAlign: 'center'
              }}>
                {audioBuffer ? `${Math.round(frameToPercentage(outFrame))}%` : '100%'}
              </span>
              <span style={{
                padding: '0.15rem 0.3rem',
                backgroundColor: Math.abs(outValue) < 0.01 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                color: 'var(--color-white)',
                borderRadius: '3px',
                fontSize: '0.65rem',
                minWidth: '35px',
                textAlign: 'center'
              }}>
                {outValue.toFixed(2)}
              </span>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: c.textSecondary, marginBottom: '0.25rem' }}>
              loop start
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: 'var(--color-bg-secondary)',
                border: `1px solid ${c.border}`,
                borderRadius: '3px',
                fontSize: '0.75rem',
                color: 'var(--color-text-primary)',
                minWidth: '60px',
                textAlign: 'center'
              }}>
                {audioBuffer ? `${Math.round(frameToPercentage(loopStartFrame))}%` : '0%'}
              </span>
              <span style={{
                padding: '0.15rem 0.3rem',
                backgroundColor: Math.abs(loopStartValue) < 0.01 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                color: 'var(--color-white)',
                borderRadius: '3px',
                fontSize: '0.65rem',
                minWidth: '35px',
                textAlign: 'center'
              }}>
                {loopStartValue.toFixed(2)}
              </span>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: c.textSecondary, marginBottom: '0.25rem' }}>
              loop end
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: 'var(--color-bg-secondary)',
                border: `1px solid ${c.border}`,
                borderRadius: '3px',
                fontSize: '0.75rem',
                color: 'var(--color-text-primary)',
                minWidth: '60px',
                textAlign: 'center'
              }}>
                {audioBuffer ? `${Math.round(frameToPercentage(loopEndFrame))}%` : '100%'}
              </span>
              <span style={{
                padding: '0.15rem 0.3rem',
                backgroundColor: Math.abs(loopEndValue) < 0.01 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                color: 'var(--color-white)',
                borderRadius: '3px',
                fontSize: '0.65rem',
                minWidth: '35px',
                textAlign: 'center'
              }}>
                {loopEndValue.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button
            onClick={playSelection}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '3px',
              backgroundColor: 'var(--color-text-primary)',
              color: 'var(--color-white)',
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
              e.currentTarget.style.backgroundColor = 'var(--color-text-secondary)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-text-primary)';
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
              border: '1px solid var(--color-border-light)',
              borderRadius: '3px',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-secondary)',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              minWidth: '80px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
              e.currentTarget.style.borderColor = 'var(--color-border-medium)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
              e.currentTarget.style.borderColor = 'var(--color-border-light)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
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
              backgroundColor: 'var(--color-text-primary)',
              color: 'var(--color-white)',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              minWidth: '80px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-text-secondary)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-text-primary)';
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