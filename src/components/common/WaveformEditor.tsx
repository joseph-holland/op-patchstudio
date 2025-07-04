import { useRef, useEffect, useState, useCallback } from 'react';
import { isMobile, isTablet } from 'react-device-detect';

// Import the overlay control functions from App.tsx
// We'll need to create a way to access these functions
let showRotateOverlayGlobal: ((zoomCallback?: () => void) => void) | null = null;

// Function to register the overlay control
export const registerOverlayControl = (showOverlay: (zoomCallback?: () => void) => void) => {
  showRotateOverlayGlobal = showOverlay;
};

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
  onZoomEdit?: () => void;
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
  className = '',
  onZoomEdit
}: WaveformEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragState, setDragState] = useState<{
    type: 'inPoint' | 'outPoint' | 'loopStart' | 'loopEnd' | null;
    startX: number;
  }>({ type: null, startX: 0 });

  const finalOutPoint = outPoint ?? (audioBuffer ? audioBuffer.length - 1 : 0);

  // Check if device is mobile/tablet in portrait mode
  const isMobilePortrait = () => {
    const mobileOrTablet = isMobile || isTablet;
    const isPortraitMode = window.innerHeight > window.innerWidth;
    return mobileOrTablet && isPortraitMode;
  };

  const drawWaveformPath = (ctx: CanvasRenderingContext2D, width: number, height: number, data: Float32Array) => {
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.fillStyle = '#333333'; // Waveform color (OP-XY slate)
    ctx.beginPath();

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;

      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j];
        if (datum < min) {
          min = datum;
        }
        if (datum > max) {
          max = datum;
        }
      }
      // Draw a vertical line from min to max for each pixel column
      ctx.rect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
    ctx.fill();
  };

  // Main drawing function
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;

    // Draw background regions
    const sampleToPixel = (sample: number) => (audioBuffer.length > 1 ? (sample / audioBuffer.length) * width : 0);
    const inX = sampleToPixel(inPoint);
    const outX = sampleToPixel(finalOutPoint);

    // Out-of-bounds area (light grey)
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);

    // In-bounds area (white)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(inX, 0, outX - inX, height);

    const data = audioBuffer.getChannelData(0);

    drawWaveformPath(ctx, width, height, data);
    drawMarkers(ctx, width, height, audioBuffer.length);
  }, [audioBuffer, height, inPoint, finalOutPoint, loopStart, loopEnd, showLoopMarkers]);

  const drawMarkers = (ctx: CanvasRenderingContext2D, width: number, height: number, samples: number) => {
    if (!samples) return;

    // This logic can now be simplified as the waveform drawing handles the scaling correctly.
    // We just need to map sample points to pixels.
    const sampleToPixel = (sample: number) => (samples > 1 ? (sample / samples) * width : 0);
    
    // The rest of drawMarkers remains the same...
    const strokeWidth = 2;
    const halfStroke = strokeWidth / 2;
    
    // Ensure markers stay within canvas bounds by constraining to stroke width
    const inX = Math.max(halfStroke, Math.min(width - halfStroke, sampleToPixel(inPoint)));
    const outX = Math.max(halfStroke, Math.min(width - halfStroke, sampleToPixel(finalOutPoint)));

    // Draw IN marker - simple vertical line
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.moveTo(inX, 0);
    ctx.lineTo(inX, height);
    ctx.stroke();

    // Draw OUT marker - simple vertical line
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.moveTo(outX, 0);
    ctx.lineTo(outX, height);
    ctx.stroke();

    // Draw loop markers if enabled
    if (showLoopMarkers && loopStart !== undefined && loopEnd !== undefined) {
      if (loopStart > 0) {
        const x = Math.max(halfStroke, Math.min(width - halfStroke, sampleToPixel(loopStart)));
        ctx.strokeStyle = '#555555'; // Medium gray
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (loopEnd < samples - 1) {
        const x = Math.max(halfStroke, Math.min(width - halfStroke, sampleToPixel(loopEnd)));
        ctx.strokeStyle = '#555555'; // Medium gray
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  };

  // Handle mouse interactions for dragging markers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!audioBuffer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const samples = audioBuffer.length;
    const canvasWidth = canvas.width / window.devicePixelRatio;
    
    const sampleToPixel = (sample: number) => (samples > 1 ? (sample / samples) * canvasWidth : 0);

    // Determine which marker is closest
    const markers: Array<{ type: 'inPoint' | 'outPoint' | 'loopStart' | 'loopEnd', pos: number, tolerance: number }> = [
      { type: 'inPoint' as const, pos: inPoint, tolerance: 10 },
      { type: 'outPoint' as const, pos: finalOutPoint, tolerance: 10 },
    ];

    if (showLoopMarkers) {
      if (loopStart !== undefined) markers.push({ type: 'loopStart' as const, pos: loopStart, tolerance: 10 });
      if (loopEnd !== undefined) markers.push({ type: 'loopEnd' as const, pos: loopEnd, tolerance: 10 });
    }

    let closestMarker: 'inPoint' | 'outPoint' | 'loopStart' | 'loopEnd' | null = null;
    let closestDistance = Infinity;

    for (const marker of markers) {
      const markerX = sampleToPixel(marker.pos);
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
    const canvasWidth = canvas.width / window.devicePixelRatio;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const samples = audioBuffer.length;
    const newSample = Math.max(0, Math.min(samples - 1, Math.floor((x / canvasWidth) * (samples - 1))));

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
      const container = canvas.parentElement;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      if (rect.width > 0) {
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
        
        drawWaveform();
      }
    };

    const resizeObserver = new ResizeObserver(resizeCanvas);
    
    const container = canvas.parentElement;
    if (container) {
      resizeObserver.observe(container);
    }
    
    window.addEventListener('resize', resizeCanvas);
    
    // Initial resize
    resizeCanvas();
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      resizeObserver.disconnect();
    };
  }, [height, drawWaveform]);

  const handleCanvasClick = (_e: React.MouseEvent) => {
    // If onZoomEdit is provided, the entire waveform is clickable for zooming
    if (onZoomEdit) {
      // Check if we're on mobile in portrait mode
      if (isMobilePortrait()) {
        // Show rotate overlay instead of zoom modal, but store the zoom callback
        if (showRotateOverlayGlobal) {
          showRotateOverlayGlobal(onZoomEdit);
        }
        return;
      }
      
      // Otherwise, proceed with normal zoom functionality
      onZoomEdit();
      return;
    }

    // Fallback or other click functionality if needed
    // For example, could implement play from click position
  };

  if (!audioBuffer) {
    return (
      <div className={`waveform-editor ${className}`} style={{ 
        height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg-secondary)',
        borderRadius: '3px',
        border: '1px solid var(--color-border-subtle)'
      }}>
        <span style={{ 
          color: 'var(--color-text-secondary)', 
          fontSize: '0.9rem' 
        }}>
          no sample
        </span>
      </div>
    );
  }

  return (
    <div className={`waveform-editor ${className}`} style={{ width: '100%', position: 'relative' }}>
      {/* Zoom icon in top-right corner */}
      {audioBuffer && onZoomEdit && (
        <button
          onClick={handleCanvasClick}
          style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            width: '24px',
            height: '24px',
            border: 'none',
            background: 'none',
            borderRadius: '0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-secondary)',
            fontSize: '14px',
            zIndex: 10,
            padding: 0
          }}
          title="zoom and edit"
        >
          <i className="fas fa-search-plus"></i>
        </button>
      )}
      <canvas
        ref={canvasRef}
        style={{ 
          width: '100%', 
          height: height,
          cursor: dragState.type ? 'grabbing' : onZoomEdit && audioBuffer ? 'pointer' : 'grab',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: '3px',
          backgroundColor: '#ffffff',
          display: 'block'
        }}
        onMouseDown={!onZoomEdit ? handleMouseDown : undefined}
        onMouseMove={!onZoomEdit ? handleMouseMove : undefined}
        onMouseUp={!onZoomEdit ? handleMouseUp : undefined}
        onMouseLeave={!onZoomEdit ? handleMouseUp : undefined}
        onClick={handleCanvasClick}
      />
    </div>
  );
}