import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  isVisible: boolean;
}

const TooltipContent: React.FC<{
  content: React.ReactNode;
  parentRef: React.RefObject<HTMLElement | null>;
  isVisible: boolean;
}> = ({ content, parentRef, isVisible }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: -9999, left: -9999 }); // Start off-screen
  const [isPositioned, setIsPositioned] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setIsPositioned(false);
      return;
    }

    const parent = parentRef.current;
    const tooltip = tooltipRef.current;
    if (!parent || !tooltip) return;

    // Give tooltip a moment to render before positioning
    requestAnimationFrame(() => {
      const parentRect = parent.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      // Position tooltip centered above the parent
      let top = parentRect.top - tooltipRect.height - 10; // 10px gap
      let left = parentRect.left + (parentRect.width / 2) - (tooltipRect.width / 2);
      
      // Adjust if tooltip goes off-screen
      if (left < 10) left = 10;
      if (top < 10) top = parentRect.bottom + 10;

      setPosition({ top, left });
      
      // Delay the visibility to allow position to be set first
      requestAnimationFrame(() => {
        setIsPositioned(true);
      });
    });
  }, [content, parentRef, isVisible]);

  return createPortal(
    <div 
      ref={tooltipRef}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        pointerEvents: 'none',
        zIndex: 10000,
        opacity: isPositioned && isVisible ? 1 : 0,
        transition: isPositioned ? 'opacity 0.3s ease, transform 0.3s ease' : 'none',
        transform: isPositioned && isVisible ? 'translateY(0)' : 'translateY(-5px)',
      }}
      className="custom-tooltip-wrapper"
    >
        <div className="custom-tooltip-content">
          {content}
        </div>
        <div className="custom-tooltip-arrow" />
    </div>,
    document.body
  );
};

export const Tooltip: React.FC<TooltipProps> = ({ content, children, isVisible }) => {
  const childRef = useRef<HTMLDivElement>(null);
  
  return (
    <div ref={childRef} style={{ display: 'inline-block' }}>
      {children}
      <TooltipContent content={content} parentRef={childRef} isVisible={isVisible} />
    </div>
  );
}; 