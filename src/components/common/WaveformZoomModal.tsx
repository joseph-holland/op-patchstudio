import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
  onSave,
}: WaveformZoomModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [inFrame, setInFrame] = useState(0);
  const [outFrame, setOutFrame] = useState(0);
  const [snapToZero, setSnapToZero] = useState(true);
  const [dragging, setDragging] = useState<'in' | 'out' | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  // Helper functions for percentage display
  const frameToPercentage = (frame: number): number => {
    if (!audioBuffer) return 0;
    return (frame / audioBuffer.length) * 100;
  };

  // Get sample values at marker positions
  const inValue = useMemo(() => {
    if (!audioBuffer || !audioBuffer.getChannelData(0)) return 0;
    const channelData = audioBuffer.getChannelData(0);
    return inFrame < channelData.length ? channelData[inFrame] : 0;
  }, [audioBuffer, inFrame]);

  const outValue = useMemo(() => {
    if (!audioBuffer || !audioBuffer.getChannelData(0)) return 0;
    const channelData = audioBuffer.getChannelData(0);
    return outFrame < channelData.length ? channelData[outFrame] : 0;
  }, [audioBuffer, outFrame]);

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
    }
  }, [isOpen, audioBuffer, initialInPoint, initialOutPoint]);

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
    const outPos = (outFrame / data.length) * width;

    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(inPos, 0);
    ctx.lineTo(inPos, height);
    ctx.moveTo(outPos, 0);
    ctx.lineTo(outPos, height);
    ctx.stroke();

    ctx.fillStyle = '#333333';
    const sampleTriangleSize = 14;
    const bottomY = height;

    ctx.beginPath();
    ctx.moveTo(inPos - sampleTriangleSize / 2, bottomY);
    ctx.lineTo(inPos + sampleTriangleSize / 2, bottomY);
    ctx.lineTo(inPos, bottomY - sampleTriangleSize);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(outPos - sampleTriangleSize / 2, bottomY);
    ctx.lineTo(outPos + sampleTriangleSize / 2, bottomY);
    ctx.lineTo(outPos, bottomY - sampleTriangleSize);
    ctx.closePath();
    ctx.fill();
  }, [audioBuffer, inFrame, outFrame]);

  // Redraw logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (isOpen && audioBuffer && canvas) {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = 200;
        drawWaveform();
        drawMarkers();
      }
    }
  }, [isOpen, audioBuffer, drawWaveform, drawMarkers, inFrame, outFrame]);

  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        drawWaveform();
        drawMarkers();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, drawWaveform, drawMarkers]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!audioBuffer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = canvas.width;

    const inPos = (inFrame / audioBuffer.length) * width;
    const outPos = (outFrame / audioBuffer.length) * width;

    const tolerance = 20;

    if (Math.abs(x - inPos) < tolerance) {
      setDragging('in');
    } else if (Math.abs(x - outPos) < tolerance) {
      setDragging('out');
    } else {
      const frame = Math.round((x / width) * audioBuffer.length);
      const distanceToIn = Math.abs(x - inPos);
      const distanceToOut = Math.abs(x - outPos);

      let targetFrame = frame;
      if (snapToZero) {
        targetFrame = findNearestZeroCrossing(audioBuffer, frame, 'both', 500);
      }

      if (distanceToIn < distanceToOut) {
        const newInFrame = Math.max(0, Math.min(targetFrame, outFrame - 1));
        setInFrame(newInFrame);
      } else {
        const newOutFrame = Math.max(inFrame + 1, Math.min(targetFrame, audioBuffer.length));
        setOutFrame(newOutFrame);
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
    let frame = Math.round((x / width) * audioBuffer.length);

    if (snapToZero) {
      const direction = frame > (dragging === 'in' ? inFrame : outFrame) ? 1 : -1;
      frame = findNearestZeroCrossing(audioBuffer, frame, direction > 0 ? 'forward' : 'backward', 500);
    }

    if (dragging === 'in') {
      setInFrame(Math.max(0, Math.min(frame, outFrame - 1)));
    } else {
      setOutFrame(Math.max(inFrame + 1, Math.min(frame, audioBuffer.length)));
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
    onSave(inPointSec, outPointSec);
    onClose();
  };

  const playSelection = () => {
    if (!audioBuffer) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    const startOffset = (inFrame / audioBuffer.length) * audioBuffer.duration;
    const endOffset = (outFrame / audioBuffer.length) * audioBuffer.duration;
    const duration = endOffset - startOffset;

    if (duration > 0) {
      source.connect(audioContext.destination);
      source.start(0, startOffset, duration);
    }
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        playSelection();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [isOpen, playSelection]);

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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: c.textSecondary, marginBottom: '0.25rem' }}>
                sample start
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: c.bgAlt,
                  border: `1px solid ${c.border}`,
                  borderRadius: '3px',
                  width: '70px',
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                }}>
                  {frameToPercentage(inFrame).toFixed(1)}%
                </span>
                <span style={{ fontSize: '0.7rem' }}>val: {inValue.toFixed(4)}</span>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: c.textSecondary, marginBottom: '0.25rem' }}>
                sample end
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: c.bgAlt,
                  border: `1px solid ${c.border}`,
                  borderRadius: '3px',
                  width: '70px',
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                }}>
                  {frameToPercentage(outFrame).toFixed(1)}%
                </span>
                <span style={{ fontSize: '0.7rem' }}>val: {outValue.toFixed(4)}</span>
              </div>
            </div>
          </div>
          
          <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: '1rem', marginTop: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={snapToZero}
                onChange={(e) => setSnapToZero(e.target.checked)}
              />
              snap to nearest zero-crossing
            </label>
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