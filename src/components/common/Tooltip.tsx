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
}> = ({ content, parentRef }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const parent = parentRef.current;
    const tooltip = tooltipRef.current;
    if (!parent || !tooltip) return;

    const parentRect = parent.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Position tooltip centered above the parent
    let top = parentRect.top - tooltipRect.height - 10; // 10px gap
    let left = parentRect.left + (parentRect.width / 2) - (tooltipRect.width / 2);
    
    // Adjust if tooltip goes off-screen
    if (left < 10) left = 10;
    if (top < 10) top = parentRect.bottom + 10;

    setPosition({ top, left });
  }, [content, parentRef]);

  return createPortal(
    <div 
      ref={tooltipRef}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        pointerEvents: 'none',
        zIndex: 10000,
        opacity: position.top === 0 ? 0 : 1, // Hide until positioned
        transition: 'opacity 0.2s ease, top 0.2s ease',
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
      {isVisible && <TooltipContent content={content} parentRef={childRef} />}
    </div>
  );
}; 