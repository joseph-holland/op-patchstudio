import { useRef, useEffect, useState, useCallback } from 'react';

interface WaveformEditorProps {
  audioBuffer: AudioBuffer | null;
  inPoint?: number;
  outPoint?: number;
  loopStart?: number;
  loopEnd?: number;
  onMarkersChange?: (markers: { inPoint: number; outPoint: number; loopStart?: number; loopEnd?: number }) => void;
  showLoopMarkers?: boolean;
  height?: number;
  className?: string;
}

export function WaveformEditor({
  audioBuffer,
  inPoint = 0,
  outPoint,
  loopStart,
  loopEnd,
  onMarkersChange,
  showLoopMarkers = false,
  height = 80,
  className = ''
}: WaveformEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragState, setDragState] = useState<{
    type: 'inPoint' | 'outPoint' | 'loopStart' | 'loopEnd' | null;
    startX: number;
  }>({ type: null, startX: 0 });

  const finalOutPoint = outPoint ?? (audioBuffer ? audioBuffer.length - 1 : 0);

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !audioBuffer) return;

    const width = canvas.width;
    const height = canvas.height;
    const data = audioBuffer.getChannelData(0);
    const samples = data.length;
    const samplesPerPixel = samples / width;

    // Clear canvas
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);

    // Draw waveform
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();

    const centerY = height / 2;
    let hasMovedTo = false;

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

      if (!hasMovedTo) {
        ctx.moveTo(x, minY);
        hasMovedTo = true;
      }
      ctx.lineTo(x, minY);
      ctx.lineTo(x, maxY);
    }

    ctx.stroke();

    // Draw markers
    drawMarkers(ctx, width, height, samples);
  }, [audioBuffer, inPoint, finalOutPoint, loopStart, loopEnd, showLoopMarkers]);

  const drawMarkers = (ctx: CanvasRenderingContext2D, width: number, height: number, samples: number) => {
    if (!samples) return;

    // Helper to convert sample position to pixel
    const sampleToPixel = (sample: number) => (sample / samples) * width;

    // Draw in/out points
    if (inPoint > 0) {
      const x = sampleToPixel(inPoint);
      ctx.strokeStyle = '#2e7d32';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      
      // Label
      ctx.fillStyle = '#2e7d32';
      ctx.font = '10px Arial';
      ctx.fillText('IN', x + 2, 12);
    }

    if (finalOutPoint < samples - 1) {
      const x = sampleToPixel(finalOutPoint);
      ctx.strokeStyle = '#c62828';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      
      // Label
      ctx.fillStyle = '#c62828';
      ctx.font = '10px Arial';
      ctx.fillText('OUT', x + 2, 12);
    }

    // Draw loop markers if enabled
    if (showLoopMarkers && loopStart !== undefined && loopEnd !== undefined) {
      if (loopStart > 0) {
        const x = sampleToPixel(loopStart);
        ctx.strokeStyle = '#1976d2';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = '#1976d2';
        ctx.font = '10px Arial';
        ctx.fillText('LOOP', x + 2, height - 5);
      }

      if (loopEnd < samples - 1) {
        const x = sampleToPixel(loopEnd);
        ctx.strokeStyle = '#1976d2';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Highlight active region
    if (inPoint > 0 || finalOutPoint < samples - 1) {
      const startX = sampleToPixel(inPoint);
      const endX = sampleToPixel(finalOutPoint);
      
      ctx.fillStyle = 'rgba(76, 175, 80, 0.1)';
      ctx.fillRect(startX, 0, endX - startX, height);
    }
  };

  // Handle mouse interactions
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!audioBuffer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const samples = audioBuffer.length;

    // Determine which marker is closest
    const markers: Array<{ type: 'inPoint' | 'outPoint' | 'loopStart' | 'loopEnd', pos: number, tolerance: number }> = [
      { type: 'inPoint' as const, pos: inPoint, tolerance: 10 },
      { type: 'outPoint' as const, pos: finalOutPoint, tolerance: 10 },
    ];

    if (showLoopMarkers) {
      if (loopStart !== undefined) markers.push({ type: 'loopStart' as const, pos: loopStart, tolerance: 10 });
      if (loopEnd !== undefined) markers.push({ type: 'loopEnd' as const, pos: loopEnd, tolerance: 10 });
    }

    let closestMarker = null;
    let closestDistance = Infinity;

    for (const marker of markers) {
      const markerX = (marker.pos / samples) * canvas.width;
      const distance = Math.abs(x - markerX);
      if (distance < marker.tolerance && distance < closestDistance) {
        closestMarker = marker.type;
        closestDistance = distance;
      }
    }

    if (closestMarker) {
      setDragState({ type: closestMarker, startX: x });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.type || !audioBuffer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const samples = audioBuffer.length;
    const newSample = Math.max(0, Math.min(samples - 1, Math.floor((x / canvas.width) * samples)));

    // Update marker position
    const newMarkers = { 
      inPoint, 
      outPoint: finalOutPoint, 
      loopStart, 
      loopEnd 
    };

    switch (dragState.type) {
      case 'inPoint':
        newMarkers.inPoint = Math.min(newSample, finalOutPoint - 1);
        break;
      case 'outPoint':
        newMarkers.outPoint = Math.max(newSample, inPoint + 1);
        break;
      case 'loopStart':
        if (loopEnd !== undefined) {
          newMarkers.loopStart = Math.min(newSample, loopEnd - 1);
        }
        break;
      case 'loopEnd':
        if (loopStart !== undefined) {
          newMarkers.loopEnd = Math.max(newSample, loopStart + 1);
        }
        break;
    }

    onMarkersChange?.(newMarkers);
  };

  const handleMouseUp = () => {
    setDragState({ type: null, startX: 0 });
  };

  // Draw waveform when component mounts or data changes
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = height + 'px';
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
      
      drawWaveform();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [height, drawWaveform]);

  if (!audioBuffer) {
    return (
      <div className={`waveform-editor ${className}`} style={{ 
        height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: '3px',
        border: '1px solid #e0e0e0'
      }}>
        <span style={{ color: '#666', fontSize: '0.9rem' }}>no audio loaded</span>
      </div>
    );
  }

  return (
    <div className={`waveform-editor ${className}`}>
      <canvas
        ref={canvasRef}
        style={{ 
          width: '100%', 
          height: height,
          cursor: dragState.type ? 'grabbing' : 'grab',
          border: '1px solid #e0e0e0',
          borderRadius: '3px',
          backgroundColor: '#fff'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}