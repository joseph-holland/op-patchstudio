import React, { useState, useCallback, useEffect } from 'react';
import { FourKnobControl } from './FourKnobControl';

interface ADSRValues {
  attack: number;   // 0-32767 (time)
  decay: number;    // 0-32767 (time)
  sustain: number;  // 0-32767 (level)
  release: number;  // 0-32767 (time)
}

interface ADSREnvelopeProps {
  ampEnvelope: ADSRValues;
  filterEnvelope: ADSRValues;
  onAmpEnvelopeChange: (envelope: ADSRValues) => void;
  onFilterEnvelopeChange: (envelope: ADSRValues) => void;
  width?: number;
  height?: number;
}

// ADSR Presets for different instrument types
const ADSR_PRESETS = {
  bass: {
    amp: { attack: 1000, decay: 12000, sustain: 28000, release: 15000 },
    filter: { attack: 0, decay: 8000, sustain: 20000, release: 12000 }
  },
  pad: {
    amp: { attack: 15000, decay: 20000, sustain: 30000, release: 25000 },
    filter: { attack: 4000, decay: 15000, sustain: 25000, release: 20000 }
  },
  keys: {
    amp: { attack: 500, decay: 6000, sustain: 22000, release: 12000 },
    filter: { attack: 0, decay: 5000, sustain: 18000, release: 10000 }
  },
  pluck: {
    amp: { attack: 0, decay: 2000, sustain: 8000, release: 5000 },
    filter: { attack: 0, decay: 3000, sustain: 12000, release: 8000 }
  },
  lead: {
    amp: { attack: 800, decay: 8000, sustain: 20000, release: 12000 },
    filter: { attack: 0, decay: 6000, sustain: 18000, release: 10000 }
  }
};

type PresetType = keyof typeof ADSR_PRESETS | 'random';

// Function to generate random envelope values
const generateRandomEnvelope = (): ADSRValues => {
  return {
    attack: Math.floor(Math.random() * 32767),
    decay: Math.floor(Math.random() * 32767),
    sustain: Math.floor(Math.random() * 32767),
    release: Math.floor(Math.random() * 32767)
  };
};

// Convert 0-32767 to 0-100% for display
const valueToPercent = (value: number): number => Math.round((value / 32767) * 100);

// Convert 0-100% to 0-32767 for storage
const percentToValue = (percent: number): number => Math.round((percent / 100) * 32767);

// Generate mathematically accurate exponential curve points with factor

const generateExponentialCurveWithFactor = (
  startX: number, 
  endX: number, 
  startY: number, 
  endY: number, 
  factor: number, 
  numPoints: number = 20
): Array<{x: number, y: number}> => {
  const points: Array<{x: number, y: number}> = [];
  
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const x = startX + (endX - startX) * t;
    
    // Convex curve with custom factor (fast start, slow finish)
    const exponentialT = Math.exp(-factor * t);
    const y = startY + (endY - startY) * (1 - exponentialT);
    
    points.push({ x, y });
  }
  
  return points;
};



/**
 * ADSREnvelope Component - OP-XY Device Faithful Recreation
 * 
 * This component replicates the exact dimensions and ratios of the OP-XY hardware
 * envelope editor. All measurements are based on physical device specs:
 * 
 * CRITICAL: These ratios must be maintained across ALL functions:
 * - getPhasePositions() for envelope curve positioning  
 * - handleMouseDown() dragging area boundaries
 * - SVG element positioning and sizing
 * - Any future layout modifications
 */
export const ADSREnvelope: React.FC<ADSREnvelopeProps> = ({
  ampEnvelope,
  filterEnvelope,
  onAmpEnvelopeChange,
  onFilterEnvelopeChange,
  width = 480,  // OP-XY outer border: 62mm × 7.74 scale = 480px (2:1 ratio)
  height = 194   // OP-XY inner border: 25mm × 7.74 scale = 194px (removes white space)
}) => {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [activeEnvelope, setActiveEnvelope] = useState<'amp' | 'filter'>('amp');
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<PresetType>('random');

  const currentEnvelope = activeEnvelope === 'amp' ? ampEnvelope : filterEnvelope;
  const inactiveEnvelope = activeEnvelope === 'amp' ? filterEnvelope : ampEnvelope;

  // Initialize with random preset if envelopes are empty
  useEffect(() => {
    const isEnvelopesEmpty = 
      ampEnvelope.attack === 0 && ampEnvelope.decay === 0 && ampEnvelope.sustain === 0 && ampEnvelope.release === 0 &&
      filterEnvelope.attack === 0 && filterEnvelope.decay === 0 && filterEnvelope.sustain === 0 && filterEnvelope.release === 0;
    
    if (isEnvelopesEmpty) {
      const randomAmp = generateRandomEnvelope();
      const randomFilter = generateRandomEnvelope();
      onAmpEnvelopeChange(randomAmp);
      onFilterEnvelopeChange(randomFilter);
    }
  }, [ampEnvelope, filterEnvelope, onAmpEnvelopeChange, onFilterEnvelopeChange]);

  // Handle preset changes
  const handlePresetChange = useCallback((preset: PresetType) => {
    setSelectedPreset(preset);
    
    if (preset === 'random') {
      // Generate random values for both amp and filter envelopes
      const randomAmp = generateRandomEnvelope();
      const randomFilter = generateRandomEnvelope();
      
      onAmpEnvelopeChange(randomAmp);
      onFilterEnvelopeChange(randomFilter);
    } else {
      // Apply predefined preset
      const presetValues = ADSR_PRESETS[preset];
      onAmpEnvelopeChange(presetValues.amp);
      onFilterEnvelopeChange(presetValues.filter);
    }
  }, [onAmpEnvelopeChange, onFilterEnvelopeChange]);

  // Handle knob value changes for the active envelope
  const handleKnobValueChange = useCallback((index: number, value: number) => {
    const convertedValue = percentToValue(value);
    
    // Get the current envelope values fresh
    const targetEnvelope = activeEnvelope === 'amp' ? ampEnvelope : filterEnvelope;
    const newEnvelope = { ...targetEnvelope };
    
    switch (index) {
      case 0: // attack
        newEnvelope.attack = convertedValue;
        break;
      case 1: // decay
        newEnvelope.decay = convertedValue;
        break;
      case 2: // sustain
        newEnvelope.sustain = convertedValue;
        break;
      case 3: // release
        newEnvelope.release = convertedValue;
        break;
    }
    
    // Update the active envelope
    if (activeEnvelope === 'amp') {
      onAmpEnvelopeChange(newEnvelope);
    } else {
      onFilterEnvelopeChange(newEnvelope);
    }
  }, [activeEnvelope, ampEnvelope, filterEnvelope, onAmpEnvelopeChange, onFilterEnvelopeChange]);

  // Calculate fixed positions based on OP-XY exact device constraints
  const getPhasePositions = useCallback((envelope: ADSRValues) => {
    // ═══════════════════════════════════════════════════════════════════════════════
    // OP-XY DEVICE EXACT RATIOS - DO NOT MODIFY WITHOUT UPDATING ALL REFERENCES
    // ═══════════════════════════════════════════════════════════════════════════════
    // Physical device measurements:
    // • Outer border: 62mm × 31mm (6px rounded corners) → 2:1 ratio
    // • Inner border: 55mm × 25mm (square corners) → 2.2:1 ratio  
    // • Envelope area: 46mm × 20mm (drawing area) → 2.3:1 ratio
    //
    // Digital implementation at 7.74x scale factor:
    // • Container: 480px × 240px (62mm × 31mm × 7.74)
    // • Inner: 426px × 194px (55mm × 25mm × 7.74)
    // • Envelope: 356px × 155px (46mm × 20mm × 7.74)
    // ═══════════════════════════════════════════════════════════════════════════════
    const innerWidth = Math.round(55 * 7.74);   // 426px
    const innerHeight = Math.round(25 * 7.74);  // 194px
    const envelopeWidth = Math.round(46 * 7.74); // 356px
    const envelopeHeight = Math.round(20 * 7.74); // 155px
    
    const outerBorderX = (width - innerWidth) / 2;
    const outerBorderY = 0; // Start grey border at top of 194px canvas
    const innerBorderX = (innerWidth - envelopeWidth) / 2;
    const innerBorderY = (innerHeight - envelopeHeight) / 2;
    
    const envelopeLeft = outerBorderX + innerBorderX;
    const envelopeTop = outerBorderY + innerBorderY;
    
    const maxY = envelopeTop;
    const minY = envelopeTop + envelopeHeight;
    const sustainLevel = valueToPercent(envelope.sustain);
    const sustainY = minY - (sustainLevel / 100) * (minY - maxY);
    
    // Attack: constrained to left 28% of canvas, moves along top edge only
    const attackTimePercent = valueToPercent(envelope.attack);
    const maxAttackX = envelopeLeft + envelopeWidth * 0.28; // 28% of envelope width
    const attackX = envelopeLeft + (attackTimePercent / 100) * (maxAttackX - envelopeLeft);
    
    // Decay: 26% max width, starting from attack position
    const decayTimePercent = valueToPercent(envelope.decay);
    const maxDecayWidth = envelopeWidth * 0.26; // 26% of envelope width max
    const decayX = attackX + (decayTimePercent / 100) * maxDecayWidth;
    
    // Release: constrained to right 28% of canvas, controls both sustain level and release time
    const releaseTimePercent = valueToPercent(envelope.release);
    const minReleaseX = (envelopeLeft + envelopeWidth) - envelopeWidth * 0.28; // 28% from right edge
    const releaseX = minReleaseX + ((100 - releaseTimePercent) / 100) * ((envelopeLeft + envelopeWidth) - minReleaseX);
    
    return {
      start: { x: envelopeLeft, y: minY },
      attack: { x: attackX, y: maxY },
      decay: { x: decayX, y: sustainY }, // Defines end of decay and start of sustain
      release: { x: releaseX, y: sustainY }, // Defines end of sustain and start of release
      releaseEnd: { x: envelopeLeft + envelopeWidth, y: minY } // Release curve ends at bottom right
    };
  }, [width, height]);

  // Get handle positions for interactive dragging
  const getHandlePositions = useCallback((envelope: ADSRValues) => {
    const positions = getPhasePositions(envelope);
    
    return {
      attack: positions.attack,     // Moves along top edge only
      decay: positions.decay,       // Controls both decay time (horizontal) and sustain level (vertical)
      release: positions.release    // Controls both sustain level (vertical) and release time (horizontal)
    };
  }, [getPhasePositions]);

  // Generate SVG path using fixed positions
  const generateEnvelopePath = useCallback((envelope: ADSRValues) => {
    // If envelope is all zeros, use some reasonable defaults for visualization
    const workingEnvelope = (envelope.attack === 0 && envelope.decay === 0 && envelope.release === 0 && envelope.sustain === 0) 
      ? { attack: 8000, decay: 10000, sustain: 20000, release: 12000 }
      : envelope;
      
    const p = getPhasePositions(workingEnvelope);

    // 1. Attack — sample exponential for the nice 'knee'
    const attackHeight = p.start.y - p.attack.y;
    const fullCurveHeight = attackHeight / 0.79;
    const virtualEndY = p.start.y - fullCurveHeight;
    const attackSamples = generateExponentialCurveWithFactor(
      p.start.x,
      p.attack.x,
      p.start.y,
      virtualEndY,
      1.5,
      25
    ).map(pt => ({ x: pt.x, y: Math.max(p.attack.y, pt.y) }));

    // Path starts
    let d = `M ${p.start.x} ${p.start.y}`;
    attackSamples.forEach((pt, idx) => {
      if (idx > 0) d += ` L ${pt.x} ${pt.y}`;
    });

    // Force path to the exact attack point before starting decay curve
    d += ` L ${p.attack.x} ${p.attack.y}`;

    // 2. Decay — ONE cubic Bézier that ends flat on sustain line
    const dx = p.decay.x - p.attack.x;
    if (dx > 0) {
      // Use the same robust geometric Bézier logic as the release curve
      // This creates a convex shape and lands flat.
      const delta = 0.07;  // Control point ratios for a convex curve
      const gamma = 0.25;

      const ctrl1 = {
        x: p.attack.x + dx * delta,
        // Drop 80% of the vertical distance quickly to mimic exponential decay
        y: p.attack.y + (p.decay.y - p.attack.y) * 0.8
      };
      const ctrl2 = {
        x: p.decay.x - dx * gamma,
        y: p.decay.y // Ensures a flat landing on the sustain line
      };
      d += ` C ${ctrl1.x} ${ctrl1.y}, ${ctrl2.x} ${ctrl2.y}, ${p.decay.x} ${p.decay.y}`;
    } else {
      // If no decay time, just go straight to decay position
      d += ` L ${p.decay.x} ${p.decay.y}`;
    }

    // 3. Sustain — perfect horizontal line
    d += ` L ${p.release.x} ${p.decay.y}`;

    // 4. Release — single cubic Bézier, convex downward, ends with flat slope on baseline
    const dxR = p.releaseEnd.x - p.release.x;
    if (dxR > 0) {
      const delta = 0.07;  // first control point very close to start for steep initial drop
      const gamma = 0.25;  // second control point further back to keep curvature

      const rCtrl1 = {
        x: p.release.x + dxR * delta,
        // drop 80 % of the vertical distance quickly to mimic exponential decay
        y: p.release.y + (p.releaseEnd.y - p.release.y) * 0.8
      };
      const rCtrl2 = {
        x: p.releaseEnd.x - dxR * gamma,
        y: p.releaseEnd.y // flat at end
      };
      d += ` C ${rCtrl1.x} ${rCtrl1.y}, ${rCtrl2.x} ${rCtrl2.y}, ${p.releaseEnd.x} ${p.releaseEnd.y}`;
    } else {
      // If no release time, just go straight to end
      d += ` L ${p.releaseEnd.x} ${p.releaseEnd.y}`;
    }

    return d;
  }, [getPhasePositions]);

  // Handle mouse and touch interactions
  const handlePointerDown = useCallback((event: React.MouseEvent<SVGElement> | React.TouchEvent<SVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;

    // Get coordinates from mouse or touch event
    const clientX = 'clientX' in event ? event.clientX : event.touches[0].clientX;
    const clientY = 'clientY' in event ? event.clientY : event.touches[0].clientY;

    // Create a point for the screen coordinates
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;

    // Get the transformation matrix from screen to SVG space and transform the point
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const svgP = pt.matrixTransform(ctm.inverse());
    const x = svgP.x;
    const y = svgP.y;
    
    const positions = getHandlePositions(currentEnvelope);
    const handleSize = 20; // Increased hit area for easier grabbing
    
    // Check which handle was clicked
    for (const [handleName, pos] of Object.entries(positions)) {
      if (Math.abs(x - pos.x) <= handleSize && Math.abs(y - pos.y) <= handleSize) {
        setIsDragging(handleName);
        

        
        // Add global mouse and touch event listeners to prevent losing drag when leaving canvas
        const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
          if (!svg) return;

          // Get coordinates from mouse or touch event
          const clientX = 'clientX' in e ? e.clientX : e.touches[0].clientX;
          const clientY = 'clientY' in e ? e.clientY : e.touches[0].clientY;

          // Same transformation for global move
          const pt = svg.createSVGPoint();
          pt.x = clientX;
          pt.y = clientY;
          const ctm = svg.getScreenCTM();
          if (!ctm) return;
          const svgP = pt.matrixTransform(ctm.inverse());
          const globalX = svgP.x;
          const globalY = svgP.y;
          
          const newEnvelope = { ...currentEnvelope };
          // OP-XY exact ratios for dragging area - MUST match getPhasePositions
          // Scale factor: 7.74x (480px / 62mm = 240px / 31mm)
          // Outer: 62×31mm = 480×240px (2:1 ratio)
          // Inner: 55×25mm = 426×194px (2.2:1 ratio)  
          // Envelope: 46×20mm = 356×155px (2.3:1 ratio)
          const innerWidth = Math.round(55 * 7.74);   // 426px
          const innerHeight = Math.round(25 * 7.74);  // 194px
          const envelopeWidth = Math.round(46 * 7.74); // 356px
          const envelopeHeight = Math.round(20 * 7.74); // 155px
          
          const outerBorderX = (width - innerWidth) / 2;
          const outerBorderY = 0; // Start grey border at top of 194px canvas
          const innerBorderX = (innerWidth - envelopeWidth) / 2;
          const innerBorderY = (innerHeight - envelopeHeight) / 2;
          
          const envelopeLeft = outerBorderX + innerBorderX;
          const envelopeTop = outerBorderY + innerBorderY;
          
          const maxY = envelopeTop;
          const minY = envelopeTop + envelopeHeight;
          
          if (handleName === 'attack') {
            // Attack: constrained to move horizontally along top edge, max 28% of canvas width
            const maxAttackX = envelopeLeft + envelopeWidth * 0.28;
            const constrainedX = Math.max(envelopeLeft, Math.min(maxAttackX, globalX));
            const attackPercent = ((constrainedX - envelopeLeft) / (maxAttackX - envelopeLeft)) * 100;
            newEnvelope.attack = percentToValue(attackPercent);
            
                     } else if (handleName === 'decay') {
             // Decay: controls both decay time (horizontal) and sustain level (vertical)
             const positions = getPhasePositions(currentEnvelope);
             
             // Horizontal movement for decay time - 26% max width from attack position
             const maxDecayWidth = envelopeWidth * 0.26;
             const maxDecayX = positions.attack.x + maxDecayWidth;
             const constrainedX = Math.max(positions.attack.x, Math.min(maxDecayX, globalX));
             
             // Calculate decay percentage based on distance from attack
             const decayPercent = maxDecayWidth === 0 ? 0 : ((constrainedX - positions.attack.x) / maxDecayWidth) * 100;
             newEnvelope.decay = percentToValue(decayPercent);
            
            // Vertical movement for sustain level
            const levelPercent = Math.max(0, Math.min(100, (1 - (globalY - maxY) / (minY - maxY)) * 100));
            newEnvelope.sustain = percentToValue(levelPercent);
            
                     } else if (handleName === 'release') {
             // Release: controls both sustain level (vertical) and release time (horizontal)
             // Horizontal movement for release time - constrained to right 28% of canvas
             const minReleaseX = (envelopeLeft + envelopeWidth) - envelopeWidth * 0.28;
             const maxReleaseX = envelopeLeft + envelopeWidth;
             const constrainedX = Math.max(minReleaseX, Math.min(maxReleaseX, globalX));
             // Reverse the percentage calculation: left = 100%, right = 0%
             const releasePercent = 100 - ((constrainedX - minReleaseX) / (maxReleaseX - minReleaseX)) * 100;
             newEnvelope.release = percentToValue(releasePercent);
            
            // Vertical movement for sustain level
            const levelPercent = Math.max(0, Math.min(100, (1 - (globalY - maxY) / (minY - maxY)) * 100));
            newEnvelope.sustain = percentToValue(levelPercent);
          }
          
          // Update the appropriate envelope
          if (activeEnvelope === 'amp') {
            onAmpEnvelopeChange(newEnvelope);
          } else {
            onFilterEnvelopeChange(newEnvelope);
          }
        };
        
        const handleGlobalEnd = () => {
          setIsDragging(null);
          document.removeEventListener('mousemove', handleGlobalMove);
          document.removeEventListener('touchmove', handleGlobalMove);
          document.removeEventListener('mouseup', handleGlobalEnd);
          document.removeEventListener('touchend', handleGlobalEnd);
        };
        
        // Add global listeners for both mouse and touch
        document.addEventListener('mousemove', handleGlobalMove);
        document.addEventListener('touchmove', handleGlobalMove);
        document.addEventListener('mouseup', handleGlobalEnd);
        document.addEventListener('touchend', handleGlobalEnd);
        
        break;
      }
    }
  }, [currentEnvelope, getHandlePositions, activeEnvelope, height, width, onAmpEnvelopeChange, onFilterEnvelopeChange, getPhasePositions]);

  // Simplified mouse move handler for when dragging inside SVG
  const handleMouseMove = useCallback(() => {
    // This is now only for hover effects or other non-drag interactions
    // Actual dragging is handled by global listeners
  }, []);

  const handleMouseUp = useCallback(() => {
    // This is now handled by global listeners, but keep for safety
    setIsDragging(null);
  }, []);

  // Render handles for the active envelope
  const renderHandles = useCallback((envelope: ADSRValues, isActive: boolean = true) => {
    const positions = getHandlePositions(envelope);
    const handleSize = 4; // Smaller square handles
    const hitAreaRadius = 20; // Larger invisible hit area
    
    return Object.entries(positions).map(([name, pos]) => (
      <g key={name}>
        {/* Larger invisible hit area for easier clicking */}
        <circle
          cx={Math.round(pos.x)}
          cy={Math.round(pos.y)}
          r={hitAreaRadius}
          fill="transparent"
          style={{ cursor: 'grab' }}
        />
        {/* Visible handle - small rounded squares */}
        <rect
          x={Math.round(pos.x - handleSize)}
          y={Math.round(pos.y - handleSize)}
          width={handleSize * 2}
          height={handleSize * 2}
          rx="3"
          ry="3"
          fill={isActive ? "#333333" : "#999999"}
          style={{ cursor: 'grab', pointerEvents: 'none' }}
        />
      </g>
    ));
  }, [getHandlePositions]);

  return (
    <div 
      className="adsr-envelope-container"
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1rem',
      }}>
      {/* Header with envelope selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '500' }}>envelopes</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.875rem', color: activeEnvelope === 'amp' ? '#000' : '#999' }}>amp</span>
          <div 
            onClick={() => setActiveEnvelope(activeEnvelope === 'amp' ? 'filter' : 'amp')}
            style={{
              width: '32px',
              height: '16px',
              backgroundColor: '#393939',
              borderRadius: '8px',
              position: 'relative',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                backgroundColor: '#fff',
                borderRadius: '50%',
                position: 'absolute',
                top: '3px',
                left: activeEnvelope === 'filter' ? '19px' : '3px',
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
              }}
            />
          </div>
          <span style={{ fontSize: '0.875rem', color: activeEnvelope === 'filter' ? '#000' : '#999' }}>filter</span>
        </div>
      </div>
      
      {/* SVG envelope display */}
      <svg 
        ref={svgRef}
        width="100%" 
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ 
          cursor: isDragging ? 'grabbing' : 'crosshair'
        }}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Bottom line for envelope area */}
        <line 
          x1={(width - Math.round(55 * 7.74)) / 2 + (Math.round(55 * 7.74) - Math.round(46 * 7.74)) / 2} 
          y1={(Math.round(25 * 7.74) - Math.round(20 * 7.74)) / 2 + Math.round(20 * 7.74)} 
          x2={(width - Math.round(55 * 7.74)) / 2 + (Math.round(55 * 7.74) - Math.round(46 * 7.74)) / 2 + Math.round(46 * 7.74)} 
          y2={(Math.round(25 * 7.74) - Math.round(20 * 7.74)) / 2 + Math.round(20 * 7.74)} 
          stroke="#ddd" 
          strokeWidth="4" 
        />
        
        {/* Vertical guide lines from key points */}
        {(() => {
          const pos = getPhasePositions(currentEnvelope);
          const envelopeTop = (height - Math.round(25 * 7.74)) / 2 + (Math.round(25 * 7.74) - Math.round(20 * 7.74)) / 2;
          const envelopeBottom = envelopeTop + Math.round(20 * 7.74);
          
          return (
            <>
              {/* Attack point vertical line - from marker down */}
              <line 
                x1={pos.attack.x} 
                y1={pos.attack.y} 
                x2={pos.attack.x} 
                y2={envelopeBottom} 
                stroke="#ddd" 
                strokeWidth="4" 
                opacity="0.5"
              />
              
              {/* Decay/Sustain point vertical line - from marker down */}
              <line 
                x1={pos.decay.x} 
                y1={pos.decay.y} 
                x2={pos.decay.x} 
                y2={envelopeBottom} 
                stroke="#ddd" 
                strokeWidth="4" 
                opacity="0.5"
              />
              
              {/* Release point vertical line - from marker down */}
              <line 
                x1={pos.release.x} 
                y1={pos.release.y} 
                x2={pos.release.x} 
                y2={envelopeBottom} 
                stroke="#ddd" 
                strokeWidth="4" 
                opacity="0.5"
              />
            </>
          );
        })()}
        
        {/* Inactive envelope (background) */}
        <path
          d={generateEnvelopePath(inactiveEnvelope)}
          fill="none"
          stroke="#cccccc"
          strokeWidth="4"
          opacity="0.5"
        />
        
        {/* Active envelope (foreground) */}
        <path
          d={generateEnvelopePath(currentEnvelope)}
          fill="none"
          stroke="#333333"
          strokeWidth="4"
        />
        
        {/* Interactive handles for active envelope only */}
        {renderHandles(currentEnvelope, true)}
        
        {/* Envelope type labels positioned like OP-XY */}
        {(() => {
          const ampPos = getHandlePositions(ampEnvelope);
          const filterPos = getHandlePositions(filterEnvelope);
          
          return (
            <>
              {/* Amp label */}
              <text
                x={ampPos.release.x - 19}
                y={ampPos.release.y - 6}
                fontSize="12"
                fontWeight="500"
                fill={activeEnvelope === 'amp' ? "#333" : "#999"}
                textAnchor="middle"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                amp
              </text>
              
              {/* Filter label */}
              <text
                x={filterPos.release.x - 19}
                y={filterPos.release.y - 6}
                fontSize="12"
                fontWeight="500"
                fill={activeEnvelope === 'filter' ? "#333" : "#999"}
                textAnchor="middle"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                filter
              </text>
            </>
          );
        })()}
      </svg>
      
      {/* Preset Dropdown */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1rem'
      }}>
        <span style={{
          fontSize: '0.875rem',
          fontWeight: '500',
          color: 'var(--color-text-primary)',
          userSelect: 'none'
        }}>
          preset
        </span>
        <div style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: '0.25rem',
          width: '100%'
        }}>
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value as PresetType)}
            style={{
              padding: '0.5rem',
              fontSize: '0.875rem',
              border: '1px solid var(--color-border-light)',
              borderRadius: '3px',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              flex: 1,
              height: '36px',
              minHeight: '36px',
              maxHeight: '36px',
              boxSizing: 'border-box',
            }}
          >
            <option value="random">random</option>
            <option value="bass">bass</option>
            <option value="keys">keys</option>
            <option value="lead">lead</option>
            <option value="pad">pad</option>
            <option value="pluck">pluck</option>
          </select>
          <button
            onClick={() => {
              setSelectedPreset('random');
              const randomAmp = generateRandomEnvelope();
              const randomFilter = generateRandomEnvelope();
              onAmpEnvelopeChange(randomAmp);
              onFilterEnvelopeChange(randomFilter);
            }}
            style={{
              width: '36px',
              height: '36px',
              minWidth: '36px',
              minHeight: '36px',
              maxWidth: '36px',
              maxHeight: '36px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--color-border-medium)',
              borderRadius: '3px',
              backgroundColor: 'var(--color-bg-primary)',
              cursor: 'pointer',
              flexShrink: 0
            }}
            title="generate new random values"
          >
            <i className="fas fa-dice" style={{ fontSize: '18px', color: 'var(--color-text-secondary)' }}></i>
          </button>
        </div>
      </div>
      
      {/* ADSR Control Knobs */}
      <FourKnobControl
        knobs={[
          { label: 'attack', value: valueToPercent(currentEnvelope.attack), color: 'black' },
          { label: 'decay', value: valueToPercent(currentEnvelope.decay), color: 'dark' },
          { label: 'sustain', value: valueToPercent(currentEnvelope.sustain), color: 'light' },
          { label: 'release', value: valueToPercent(currentEnvelope.release), color: 'white' }
        ]}
        onValueChange={handleKnobValueChange}
      />
    </div>
  );
}; 