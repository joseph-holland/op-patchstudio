import React, { useState, useCallback, useRef } from 'react';

interface KnobConfig {
  label: string;
  value: number; // 0-100
  color: string; // knob color: '#000', '#666', '#bbb', '#fff'
}

interface FourKnobControlProps {
  knobs: [KnobConfig, KnobConfig, KnobConfig, KnobConfig];
  onValueChange: (index: number, value: number) => void;
  title?: string;
}

export const FourKnobControl: React.FC<FourKnobControlProps> = ({
  knobs,
  onValueChange,
  title
}) => {
  const [isDragging, setIsDragging] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((event: React.MouseEvent | React.TouchEvent, knobIndex: number) => {
    event.preventDefault();
    setIsDragging(knobIndex);
    
    // Get coordinates from mouse or touch event
    const startY = 'clientY' in event ? event.clientY : event.touches[0].clientY;
    const startValue = knobs[knobIndex].value;

    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      // Get coordinates from mouse or touch event
      const currentY = 'clientY' in e ? e.clientY : e.touches[0].clientY;
      
      // Calculate the drag distance in pixels
      const deltaY = startY - currentY; // Inverted: up = positive
      
      // Convert to percentage change (adjust sensitivity as needed)
      const sensitivity = 0.5; // 1 pixel = 0.5% change
      const deltaPercent = deltaY * sensitivity;
      
      // Calculate new value
      const newValue = Math.max(0, Math.min(100, startValue + deltaPercent));
      
      onValueChange(knobIndex, Math.round(newValue));
    };

    const handleGlobalEnd = () => {
      setIsDragging(null);
      document.removeEventListener('mousemove', handleGlobalMove);
      document.removeEventListener('touchmove', handleGlobalMove);
      document.removeEventListener('mouseup', handleGlobalEnd);
      document.removeEventListener('touchend', handleGlobalEnd);
    };

    document.addEventListener('mousemove', handleGlobalMove);
    document.addEventListener('touchmove', handleGlobalMove);
    document.addEventListener('mouseup', handleGlobalEnd);
    document.addEventListener('touchend', handleGlobalEnd);
  }, [knobs, onValueChange]);

  const renderKnob = useCallback((knob: KnobConfig, index: number) => {
    const isBeingDragged = isDragging === index;
    
    return (
      <div 
        key={index}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}
      >
        <div
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            border: '1px solid var(--color-text-primary)',
            backgroundColor: 'var(--color-bg-primary)',
            cursor: isBeingDragged ? 'grabbing' : 'grab',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: isBeingDragged ? 'scale(1.05)' : 'scale(1)',
            transition: isBeingDragged ? 'none' : 'transform 0.1s ease'
          }}
          onMouseDown={(e) => handlePointerDown(e, index)}
          onTouchStart={(e) => handlePointerDown(e, index)}
        >
          {/* Inner thin circle close to colored center */}
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: '1px solid var(--color-text-primary)',
              backgroundColor: 'transparent',
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* Colored center circle */}
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: knob.color,
                border: knob.color === '#fff' ? '1px solid #000' : 'none'
              }}
            />
          </div>
          

        </div>
        
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', userSelect: 'none' }}>
          {knob.label}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-subtle)', userSelect: 'none' }}>
          {Math.round(knob.value)}%
        </span>
      </div>
    );
  }, [isDragging, handlePointerDown]);

  return (
    <div 
      ref={containerRef}
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1rem',
        padding: '1rem',
        border: '1px solid var(--color-border-light)',
        borderRadius: '4px',
        backgroundColor: 'var(--color-bg-panel)'
      }}
    >
      {title && (
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '500' }}>
          {title}
        </h3>
      )}
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-around', 
        alignItems: 'center',
        padding: '0 1rem'
      }}>
        {knobs.map((knob, index) => renderKnob(knob, index))}
      </div>
    </div>
  );
}; 