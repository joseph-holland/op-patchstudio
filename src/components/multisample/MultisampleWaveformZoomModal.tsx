import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Modal } from '@carbon/react';

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
      const duration = audioBuffer.length / audioBuffer.sampleRate;
      setInFrame(Math.floor((initialInPoint / duration) * audioBuffer.length));
      setOutFrame(Math.floor((initialOutPoint / duration) * audioBuffer.length));
      setLoopStartFrame(Math.floor((initialLoopStart / duration) * audioBuffer.length));
      setLoopEndFrame(Math.floor((initialLoopEnd / duration) * audioBuffer.length));
    }
  }, [isOpen, audioBuffer, initialInPoint, initialOutPoint, initialLoopStart, initialLoopEnd]);

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

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#ececec';
    ctx.fillRect(0, 0, width, height);

    // Waveform
    ctx.fillStyle = '#333';
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
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }, [audioBuffer]);

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
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(inPos, 0);
    ctx.lineTo(inPos, height);
    ctx.moveTo(outPos, 0);
    ctx.lineTo(outPos, height);
    ctx.stroke();

    // In/Out marker handles - triangles pointing up from bottom
    ctx.fillStyle = '#222';
    const sampleTriangleSize = 15;
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

    // Loop markers (medium grey)
    const triangleSize = 15;
    ctx.fillStyle = '#666';
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 3;

    // Loop start - vertical line and triangle at top
    ctx.beginPath();
    ctx.moveTo(loopStartPos, 0);
    ctx.lineTo(loopStartPos, height);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(loopStartPos - triangleSize / 2, 0);
    ctx.lineTo(loopStartPos + triangleSize / 2, 0);
    ctx.lineTo(loopStartPos, triangleSize);
    ctx.closePath();
    ctx.fill();

    // Loop end - vertical line and triangle at top
    ctx.beginPath();
    ctx.moveTo(loopEndPos, 0);
    ctx.lineTo(loopEndPos, height);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(loopEndPos - triangleSize / 2, 0);
    ctx.lineTo(loopEndPos + triangleSize / 2, 0);
    ctx.lineTo(loopEndPos, triangleSize);
    ctx.closePath();
    ctx.fill();
  }, [audioBuffer, inFrame, outFrame, loopStartFrame, loopEndFrame]);

  const updateDisplay = useCallback(() => {
    drawWaveform();
    drawMarkers();
  }, [drawWaveform, drawMarkers]);

  // Set up canvas when modal opens
  useEffect(() => {
    if (isOpen && audioBuffer) {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = 800;
        canvas.height = 200;
        updateDisplay();
      }
    }
  }, [isOpen, audioBuffer, updateDisplay]);

  // Redraw when markers change
  useEffect(() => {
    if (isOpen && audioBuffer) {
      updateDisplay();
    }
  }, [isOpen, audioBuffer, inFrame, outFrame, loopStartFrame, loopEndFrame, updateDisplay]);

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

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} onRequestClose={onClose} modalHeading="edit waveform markers" size="lg">
      <div style={{ fontFamily: '"Montserrat", "Arial", sans-serif' }}>
        <div style={{ marginBottom: '1rem' }}>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              maxWidth: '800px',
              height: '200px',
              border: `1px solid ${c.border}`,
              borderRadius: '3px',
              cursor: dragging ? 'grabbing' : 'pointer'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: c.textSecondary, marginBottom: '0.25rem' }}>
              sample start
            </label>
            <input
              type="number"
              value={inFrame}
              onChange={(e) => setInFrame(Math.max(0, parseInt(e.target.value) || 0))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: `1px solid ${c.border}`,
                borderRadius: '3px',
                fontSize: '0.8rem'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: c.textSecondary, marginBottom: '0.25rem' }}>
              loop start
            </label>
            <input
              type="number"
              value={loopStartFrame}
              onChange={(e) => setLoopStartFrame(Math.max(0, parseInt(e.target.value) || 0))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: `1px solid ${c.border}`,
                borderRadius: '3px',
                fontSize: '0.8rem'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: c.textSecondary, marginBottom: '0.25rem' }}>
              loop end
            </label>
            <input
              type="number"
              value={loopEndFrame}
              onChange={(e) => setLoopEndFrame(Math.max(0, parseInt(e.target.value) || 0))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: `1px solid ${c.border}`,
                borderRadius: '3px',
                fontSize: '0.8rem'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: c.textSecondary, marginBottom: '0.25rem' }}>
              sample end
            </label>
            <input
              type="number"
              value={outFrame}
              onChange={(e) => setOutFrame(Math.max(0, parseInt(e.target.value) || 0))}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: `1px solid ${c.border}`,
                borderRadius: '3px',
                fontSize: '0.8rem'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: c.text }}>
            <input
              type="checkbox"
              checked={snapToZero}
              onChange={(e) => setSnapToZero(e.target.checked)}
            />
            snap to zero crossing
          </label>
          <button
            onClick={playSelection}
            style={{
              padding: '0.5rem 1rem',
              border: `1px solid ${c.border}`,
              borderRadius: '3px',
              backgroundColor: c.bg,
              color: c.action,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <i className="fas fa-play"></i>
            play selection (P)
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              border: `1px solid ${c.border}`,
              borderRadius: '3px',
              backgroundColor: c.bg,
              color: c.text,
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '3px',
              backgroundColor: c.action,
              color: 'white',
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            save changes
          </button>
        </div>
      </div>
    </Modal>
  );
} 