import { useRef, useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { audioContextManager } from '../../utils/audioContext';
import { Tooltip } from './Tooltip';
import { isMobile, isTablet } from 'react-device-detect';
import { triggerRotateOverlay } from '../../App';

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
  const modalRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const lastActiveElement = useRef<HTMLElement | null>(null);
  const [inFrame, setInFrame] = useState(0);
  const [outFrame, setOutFrame] = useState(0);
  const [loopStartFrame, setLoopStartFrame] = useState(0);
  const [loopEndFrame, setLoopEndFrame] = useState(0);
  const [snapToZero, setSnapToZero] = useState(true);
  const [dragging, setDragging] = useState<'in' | 'out' | 'loopStart' | 'loopEnd' | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // Check if device is mobile/tablet in portrait mode
  const isMobilePortrait = () => {
    const mobileOrTablet = isMobile || isTablet;
    const isPortraitMode = window.innerHeight > window.innerWidth;
    return mobileOrTablet && isPortraitMode;
  };

  // Check if device is mobile/tablet (any orientation)
  const isMobileDevice = () => {
    return isMobile || isTablet;
  };

  // Check if this is a multisample (has loop points)
  const hasLoopPoints = initialLoopStart !== undefined && initialLoopEnd !== undefined;

  // Check for mobile portrait mode when modal opens
  useEffect(() => {
    if (isOpen && isMobilePortrait()) {
      // Use the global overlay system instead of local state
      triggerRotateOverlay(() => {
        // The modal will open automatically when user rotates to landscape
        // No additional action needed as modal is already trying to open
      });
      // Close the modal since we're showing the rotate overlay
      onClose();
    }
  }, [isOpen, onClose]);

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
        canvas.height = isMobileDevice() ? 120 : 200; // Responsive height
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

  const handleMouseDown = (e: React.MouseEvent | { clientX: number, clientY: number, preventDefault: () => void, stopPropagation: () => void, nativeEvent: any }) => {
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
    // Use larger hit area for touch devices (44x44px square)
    const tolerance = isMobileDevice() ? 44 / 2 : 40;

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

  // Add touch event handlers for mobile marker dragging
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!audioBuffer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    // Reuse mouse logic
    handleMouseDown({
      ...e,
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => e.preventDefault(),
      stopPropagation: () => e.stopPropagation(),
      nativeEvent: e.nativeEvent,
    } as any);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging || !audioBuffer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    // Reuse mouse logic
    handleMouseMove({
      ...e,
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => e.preventDefault(),
      stopPropagation: () => e.stopPropagation(),
      nativeEvent: e.nativeEvent,
    } as any);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    handleMouseUp();
  };

  // Focus trap: focus first button on open, restore focus on close
  useLayoutEffect(() => {
    if (isOpen) {
      lastActiveElement.current = document.activeElement as HTMLElement;
      setTimeout(() => {
        firstButtonRef.current?.focus();
      }, 0);
    } else if (lastActiveElement.current) {
      lastActiveElement.current.focus();
    }
  }, [isOpen]);

  // Focus trap: keep focus inside modal
  useEffect(() => {
    if (!isOpen) return;
    const handleTab = (e: KeyboardEvent) => {
      if (!modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="waveform-zoom-modal-title"
        ref={modalRef}
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
            borderRadius: isMobileDevice() ? '3px' : '6px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            maxWidth: isMobileDevice() ? '100%' : '900px',
            width: isMobileDevice() ? '100%' : '90%',
            height: isMobileDevice() ? '100%' : 'auto',
            margin: isMobileDevice() ? '0' : '0 1rem',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: isMobileDevice() ? '0.75rem 1rem 0.5rem 1rem' : '1.5rem 1.5rem 1rem 1.5rem',
            borderBottom: `1px solid ${c.border}`,
            flexShrink: 0
          }}>
            <h3 id="waveform-zoom-modal-title" style={{
              margin: '0',
              fontSize: isMobileDevice() ? '1rem' : '1.25rem',
              fontWeight: '300',
              color: c.text,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <i className="fas fa-search-plus" style={{
                color: c.textSecondary,
                fontSize: isMobileDevice() ? '1rem' : '1.25rem'
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
                    fontSize: isMobileDevice() ? '0.9rem' : '1rem',
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
            padding: isMobileDevice() ? '0.75rem 1rem' : '1.5rem',
            color: c.textSecondary,
            fontSize: isMobileDevice() ? '0.85rem' : '0.95rem',
            lineHeight: '1.5',
            flex: 1,
            overflow: 'auto'
          }}>
            <div style={{ marginBottom: isMobileDevice() ? '0.75rem' : '1rem' }}>
              <canvas
                ref={canvasRef}
                aria-label="waveform editor: drag markers to set sample and loop points"
                tabIndex={0}
                style={{
                  width: '100%',
                  height: isMobileDevice() ? '120px' : '200px',
                  border: `1px solid ${c.border}`,
                  borderRadius: '3px',
                  cursor: dragging ? 'grabbing' : 'pointer',
                  display: 'block'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />
            </div>

            {/* Marker Display */}
            {hasLoopPoints ? (
              // Multisample layout: Row 1: sample start/end, Row 2: loop start/end
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gridTemplateRows: 'auto auto',
                gap: isMobileDevice() ? '1rem' : '2rem', 
                marginBottom: isMobileDevice() ? '1rem' : '1.5rem' 
              }}>
                {/* Row 1: Sample Start */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: isMobileDevice() ? '0.25rem' : '0.5rem',
                  flexWrap: 'nowrap'
                }}>
                  <span style={{ 
                    minWidth: isMobileDevice() ? '70px' : '80px', 
                    fontSize: isMobileDevice() ? '0.7rem' : '0.75rem', 
                    color: c.textSecondary,
                    flexShrink: 0
                  }}>
                    sample start:
                  </span>
                  <span style={{
                    padding: isMobileDevice() ? '0.2rem 0.4rem' : '0.25rem 0.5rem',
                    backgroundColor: c.bgAlt,
                    border: `1px solid ${c.border}`,
                    borderRadius: '3px',
                    fontSize: isMobileDevice() ? '0.75rem' : '0.8rem',
                    fontWeight: '500',
                    minWidth: isMobileDevice() ? '80px' : '90px',
                    textAlign: 'right',
                    flexShrink: 0
                  }}>
                    {audioBuffer ? inFrame.toLocaleString() : '0'}
                  </span>
                  <span style={{ 
                    fontSize: isMobileDevice() ? '0.7rem' : '0.75rem', 
                    color: c.textSecondary,
                    marginLeft: isMobileDevice() ? '0.25rem' : '0.5rem',
                    flexShrink: 0
                  }}>
                    frames ({audioBuffer ? frameToTime(inFrame).toFixed(3) : '0.000'}s)
                  </span>
                  <span style={{ 
                    fontSize: isMobileDevice() ? '0.65rem' : '0.7rem', 
                    color: isNearZeroCrossing(inFrame) ? '#6b7280' : '#9ca3af',
                    fontWeight: '500',
                    marginLeft: isMobileDevice() ? '0.25rem' : '0.5rem',
                    flexShrink: 0
                  }}>
                    {isNearZeroCrossing(inFrame) ? '✓ zero' : '✗ not zero'}
                  </span>
                </div>

                {/* Row 1: Sample End */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: isMobileDevice() ? '0.25rem' : '0.5rem',
                  flexWrap: 'nowrap'
                }}>
                  <span style={{ 
                    minWidth: isMobileDevice() ? '70px' : '80px', 
                    fontSize: isMobileDevice() ? '0.7rem' : '0.75rem', 
                    color: c.textSecondary,
                    flexShrink: 0
                  }}>
                    sample end:
                  </span>
                  <span style={{
                    padding: isMobileDevice() ? '0.2rem 0.4rem' : '0.25rem 0.5rem',
                    backgroundColor: c.bgAlt,
                    border: `1px solid ${c.border}`,
                    borderRadius: '3px',
                    fontSize: isMobileDevice() ? '0.75rem' : '0.8rem',
                    fontWeight: '500',
                    minWidth: isMobileDevice() ? '80px' : '90px',
                    textAlign: 'right',
                    flexShrink: 0
                  }}>
                    {audioBuffer ? outFrame.toLocaleString() : '0'}
                  </span>
                  <span style={{ 
                    fontSize: isMobileDevice() ? '0.7rem' : '0.75rem', 
                    color: c.textSecondary,
                    marginLeft: isMobileDevice() ? '0.25rem' : '0.5rem',
                    flexShrink: 0
                  }}>
                    frames ({audioBuffer ? frameToTime(outFrame).toFixed(3) : '0.000'}s)
                  </span>
                  <span style={{ 
                    fontSize: isMobileDevice() ? '0.65rem' : '0.7rem', 
                    color: isNearZeroCrossing(outFrame) ? '#6b7280' : '#9ca3af',
                    fontWeight: '500',
                    marginLeft: isMobileDevice() ? '0.25rem' : '0.5rem',
                    flexShrink: 0
                  }}>
                    {isNearZeroCrossing(outFrame) ? '✓ zero' : '✗ not zero'}
                  </span>
                </div>

                {/* Row 2: Loop Start */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: isMobileDevice() ? '0.25rem' : '0.5rem',
                  flexWrap: 'nowrap'
                }}>
                  <span style={{ 
                    minWidth: isMobileDevice() ? '70px' : '80px', 
                    fontSize: isMobileDevice() ? '0.7rem' : '0.75rem', 
                    color: c.textSecondary,
                    flexShrink: 0
                  }}>
                    loop start:
                  </span>
                  <span style={{
                    padding: isMobileDevice() ? '0.2rem 0.4rem' : '0.25rem 0.5rem',
                    backgroundColor: c.bgAlt,
                    border: `1px solid ${c.border}`,
                    borderRadius: '3px',
                    fontSize: isMobileDevice() ? '0.75rem' : '0.8rem',
                    fontWeight: '500',
                    minWidth: isMobileDevice() ? '80px' : '90px',
                    textAlign: 'right',
                    flexShrink: 0
                  }}>
                    {audioBuffer ? loopStartFrame.toLocaleString() : '0'}
                  </span>
                  <span style={{ 
                    fontSize: isMobileDevice() ? '0.7rem' : '0.75rem', 
                    color: c.textSecondary,
                    marginLeft: isMobileDevice() ? '0.25rem' : '0.5rem',
                    flexShrink: 0
                  }}>
                    frames ({audioBuffer ? frameToTime(loopStartFrame).toFixed(3) : '0.000'}s)
                  </span>
                  <span style={{ 
                    fontSize: isMobileDevice() ? '0.65rem' : '0.7rem', 
                    color: isNearZeroCrossing(loopStartFrame) ? '#6b7280' : '#9ca3af',
                    fontWeight: '500',
                    marginLeft: isMobileDevice() ? '0.25rem' : '0.5rem',
                    flexShrink: 0
                  }}>
                    {isNearZeroCrossing(loopStartFrame) ? '✓ zero' : '✗ not zero'}
                  </span>
                </div>

                {/* Row 2: Loop End */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: isMobileDevice() ? '0.25rem' : '0.5rem',
                  flexWrap: 'nowrap'
                }}>
                  <span style={{ 
                    minWidth: isMobileDevice() ? '70px' : '80px', 
                    fontSize: isMobileDevice() ? '0.7rem' : '0.75rem', 
                    color: c.textSecondary,
                    flexShrink: 0
                  }}>
                    loop end:
                  </span>
                  <span style={{
                    padding: isMobileDevice() ? '0.2rem 0.4rem' : '0.25rem 0.5rem',
                    backgroundColor: c.bgAlt,
                    border: `1px solid ${c.border}`,
                    borderRadius: '3px',
                    fontSize: isMobileDevice() ? '0.75rem' : '0.8rem',
                    fontWeight: '500',
                    minWidth: isMobileDevice() ? '80px' : '90px',
                    textAlign: 'right',
                    flexShrink: 0
                  }}>
                    {audioBuffer ? loopEndFrame.toLocaleString() : '0'}
                  </span>
                  <span style={{ 
                    fontSize: isMobileDevice() ? '0.7rem' : '0.75rem', 
                    color: c.textSecondary,
                    marginLeft: isMobileDevice() ? '0.25rem' : '0.5rem',
                    flexShrink: 0
                  }}>
                    frames ({audioBuffer ? frameToTime(loopEndFrame).toFixed(3) : '0.000'}s)
                  </span>
                  <span style={{ 
                    fontSize: isMobileDevice() ? '0.65rem' : '0.7rem', 
                    color: isNearZeroCrossing(loopEndFrame) ? '#6b7280' : '#9ca3af',
                    fontWeight: '500',
                    marginLeft: isMobileDevice() ? '0.25rem' : '0.5rem',
                    flexShrink: 0
                  }}>
                    {isNearZeroCrossing(loopEndFrame) ? '✓ zero' : '✗ not zero'}
                  </span>
                </div>
              </div>
            ) : (
              // Drum sample layout: single row
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: isMobileDevice() ? '1rem' : '2rem', 
                marginBottom: isMobileDevice() ? '1rem' : '1.5rem' 
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: isMobileDevice() ? '0.25rem' : '0.5rem',
                  flexWrap: 'nowrap'
                }}>
                  <span style={{ 
                    minWidth: isMobileDevice() ? '70px' : '80px', 
                    fontSize: isMobileDevice() ? '0.7rem' : '0.75rem', 
                    color: c.textSecondary,
                    flexShrink: 0
                  }}>
                    sample start:
                  </span>
                  <span style={{
                    padding: isMobileDevice() ? '0.2rem 0.4rem' : '0.25rem 0.5rem',
                    backgroundColor: c.bgAlt,
                    border: `1px solid ${c.border}`,
                    borderRadius: '3px',
                    fontSize: isMobileDevice() ? '0.75rem' : '0.8rem',
                    fontWeight: '500',
                    minWidth: isMobileDevice() ? '80px' : '90px',
                    textAlign: 'right',
                    flexShrink: 0
                  }}>
                    {inFrame.toLocaleString()}
                  </span>
                  <span style={{ 
                    fontSize: isMobileDevice() ? '0.7rem' : '0.75rem', 
                    color: c.textSecondary,
                    marginLeft: isMobileDevice() ? '0.25rem' : '0.5rem',
                    flexShrink: 0
                  }}>
                    frames ({frameToTime(inFrame).toFixed(3)}s)
                  </span>
                  <span style={{ 
                    fontSize: isMobileDevice() ? '0.65rem' : '0.7rem', 
                    color: isNearZeroCrossing(inFrame) ? '#6b7280' : '#9ca3af',
                    fontWeight: '500',
                    marginLeft: isMobileDevice() ? '0.25rem' : '0.5rem',
                    flexShrink: 0
                  }}>
                    {isNearZeroCrossing(inFrame) ? '✓ zero' : '✗ not zero'}
                  </span>
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: isMobileDevice() ? '0.25rem' : '0.5rem',
                  flexWrap: 'nowrap'
                }}>
                  <span style={{ 
                    minWidth: isMobileDevice() ? '70px' : '80px', 
                    fontSize: isMobileDevice() ? '0.7rem' : '0.75rem', 
                    color: c.textSecondary,
                    flexShrink: 0
                  }}>
                    sample end:
                  </span>
                  <span style={{
                    padding: isMobileDevice() ? '0.2rem 0.4rem' : '0.25rem 0.5rem',
                    backgroundColor: c.bgAlt,
                    border: `1px solid ${c.border}`,
                    borderRadius: '3px',
                    fontSize: isMobileDevice() ? '0.75rem' : '0.8rem',
                    fontWeight: '500',
                    minWidth: isMobileDevice() ? '80px' : '90px',
                    textAlign: 'right',
                    flexShrink: 0
                  }}>
                    {outFrame.toLocaleString()}
                  </span>
                  <span style={{ 
                    fontSize: isMobileDevice() ? '0.7rem' : '0.75rem', 
                    color: c.textSecondary,
                    marginLeft: isMobileDevice() ? '0.25rem' : '0.5rem',
                    flexShrink: 0
                  }}>
                    frames ({frameToTime(outFrame).toFixed(3)}s)
                  </span>
                  <span style={{ 
                    fontSize: isMobileDevice() ? '0.65rem' : '0.7rem', 
                    color: isNearZeroCrossing(outFrame) ? '#6b7280' : '#9ca3af',
                    fontWeight: '500',
                    marginLeft: isMobileDevice() ? '0.25rem' : '0.5rem',
                    flexShrink: 0
                  }}>
                    {isNearZeroCrossing(outFrame) ? '✓ zero' : '✗ not zero'}
                  </span>
                </div>
              </div>
            )}
            
            <div style={{ 
              borderTop: `1px solid ${c.border}`, 
              paddingTop: isMobileDevice() ? '0.75rem' : '1rem', 
              marginTop: isMobileDevice() ? '0.75rem' : '1rem' 
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: isMobileDevice() ? '0.75rem' : '1rem', 
                marginBottom: isMobileDevice() ? '0.75rem' : '1rem',
                flexWrap: isMobileDevice() ? 'wrap' : 'nowrap'
              }}>
                <button
                  ref={firstButtonRef}
                  onClick={() => playSelection().catch(error => {
                    console.error('Error playing selection:', error);
                  })}
                  style={{
                    padding: isMobileDevice() ? '0.75rem 1.25rem' : '0.65rem 1rem',
                    border: `1px solid ${c.border}`,
                    borderRadius: '3px',
                    background: 'transparent',
                    color: c.textSecondary,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: isMobileDevice() ? '1rem' : '0.875rem',
                    fontWeight: '500',
                    fontFamily: 'inherit',
                    minHeight: isMobileDevice() ? '44px' : undefined
                  }}
                >
                  <i className="fas fa-play" style={{ fontSize: isMobileDevice() ? '0.75rem' : '0.8rem' }}></i>
                  play selection (P)
                </button>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  fontSize: isMobileDevice() ? '0.8rem' : '0.875rem', 
                  fontWeight: '500',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={snapToZero}
                    onChange={(e) => setSnapToZero(e.target.checked)}
                    style={{
                      width: isMobileDevice() ? '14px' : '16px',
                      height: isMobileDevice() ? '14px' : '16px',
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
            padding: isMobileDevice() ? '0.75rem 1rem' : '1rem 1.5rem',
            background: c.bgAlt,
            borderTop: `1px solid ${c.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: isMobileDevice() ? '0.75rem' : '1rem',
            flexShrink: 0
          }}>
            <button
              onClick={onClose}
              style={{
                padding: isMobileDevice() ? '0.75rem 1.25rem' : '0.65rem 1rem',
                border: `1px solid ${c.border}`,
                borderRadius: '3px',
                background: 'transparent',
                color: c.textSecondary,
                cursor: 'pointer',
                fontSize: isMobileDevice() ? '1rem' : '0.875rem',
                minHeight: isMobileDevice() ? '44px' : undefined
              }}
            >
              cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: isMobileDevice() ? '0.75rem 1.25rem' : '0.65rem 1rem',
                border: 'none',
                borderRadius: '3px',
                background: c.action,
                color: '#fff',
                cursor: 'pointer',
                fontSize: isMobileDevice() ? '1rem' : '0.875rem',
                minHeight: isMobileDevice() ? '44px' : undefined
              }}
            >
              save markers
            </button>
          </div>
        </div>
      </div>
  );
} 