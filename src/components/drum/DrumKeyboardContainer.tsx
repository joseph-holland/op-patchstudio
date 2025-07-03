import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { DrumKeyboard } from './DrumKeyboard';
import { Tooltip } from '../common/Tooltip';
import { cookieUtils, COOKIE_KEYS } from '../../utils/cookies';

interface DrumKeyboardContainerProps {
  onFileUpload?: (index: number, file: File) => void;
}

/**
 * DrumKeyboardContainer – visually matches the VirtualMidiKeyboard container and
 * provides identical pin / sticky behaviour while keeping the existing
 * DrumKeyboard component unchanged.
 */
export const DrumKeyboardContainer: React.FC<DrumKeyboardContainerProps> = ({ onFileUpload }) => {
  const { state } = useAppContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [isStuck, setIsStuck] = useState(false);
  const [dynamicStyles, setDynamicStyles] = useState({});
  const [placeholderHeight, setPlaceholderHeight] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Pin state with cookie persistence
  const [isDrumKeyboardPinned, setIsDrumKeyboardPinned] = useState(() => {
    const saved = cookieUtils.getCookie(COOKIE_KEYS.DRUM_KEYBOARD_PINNED);
    return saved === 'true';
  });

  const loadedSamplesCount = state.drumSamples.filter(sample => sample.isLoaded).length;

  const togglePin = () => {
    setIsDrumKeyboardPinned(!isDrumKeyboardPinned);
  };

  // Save pin state to cookie
  useEffect(() => {
    try {
      cookieUtils.setCookie(COOKIE_KEYS.DRUM_KEYBOARD_PINNED, isDrumKeyboardPinned.toString(), 365);
    } catch (error) {
      console.warn('Failed to save drum keyboard pin state to cookie:', error);
    }
  }, [isDrumKeyboardPinned]);

  const iconSize = '18px';

  const tooltipContent = isMobile ? (
    <>
      <strong>load:</strong> tap empty keys to browse and select files<br />
      <strong>play:</strong> tap keys to play loaded samples<br />
      <strong>pin:</strong> use the pin icon to keep the keyboard at the top of the screen
    </>
  ) : (
    <>
      <strong>load:</strong> click empty keys to browse files or drag and drop audio files directly onto any key<br />
      <strong>play:</strong> use keyboard keys (<strong>A-J, W, E, R, Y, U</strong>) to trigger samples and <strong>Z</strong> / <strong>X</strong> to switch octaves<br />
      <strong>pin:</strong> use the pin icon to keep the keyboard at the top of the screen
    </>
  );

  // Add resize listener for mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Scroll handling for stick / unstick
  useEffect(() => {
    const container = containerRef.current;
    const placeholder = placeholderRef.current;

    const handleScroll = () => {
      if (!isDrumKeyboardPinned || !container || !placeholder) return;

      if (!isStuck) {
        const rect = container.getBoundingClientRect();
        if (rect.top <= 10) {
          // Stick
          setPlaceholderHeight(rect.height);
          setDynamicStyles({ left: `${rect.left}px`, width: `${rect.width}px` });
          setIsStuck(true);
        }
      } else {
        const rect = placeholder.getBoundingClientRect();
        if (rect.top > 10) {
          // Unstick
          setDynamicStyles({});
          setIsStuck(false);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isDrumKeyboardPinned, isStuck]);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-tooltip]')) {
        setIsTooltipVisible(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const combinedStyles: React.CSSProperties = {
    border: '1px solid var(--color-border-subtle)',
    borderRadius: '15px',
    backgroundColor: 'var(--color-bg-primary)',
    boxShadow: '0 2px 8px var(--color-shadow-primary)',
    overflow: 'hidden',
    position: isStuck ? 'fixed' : 'relative',
    top: isStuck ? '10px' : undefined,
    zIndex: isStuck ? 1000 : undefined,
    ...dynamicStyles,
  };

  return (
    <>
      {/* Placeholder to avoid layout shift */}
      <div
        ref={placeholderRef}
        style={{ display: isStuck ? 'block' : 'none', height: `${placeholderHeight}px`, background: '#fff' }}
      />

      {/* Actual Keyboard Container */}
      <div
        ref={containerRef}
        className={`virtual-midi-keyboard ${isDrumKeyboardPinned ? 'pinned' : ''}`}
        style={combinedStyles}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1rem 0.5rem 1rem',
            borderBottom: '1px solid var(--color-border-medium)',
            backgroundColor: 'var(--color-bg-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <h3
              style={{
                margin: 0,
                color: '#222',
                fontSize: '1.25rem',
                fontWeight: 300,
              }}
            >
              load and play samples
            </h3>
            <Tooltip
              isVisible={isTooltipVisible}
              content={tooltipContent}
            >
              <span
                style={{ display: 'flex' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTooltipVisible(!isTooltipVisible);
                }}
                onMouseEnter={() => setIsTooltipVisible(true)}
                onMouseLeave={() => setIsTooltipVisible(false)}
              >
                <i 
                  className="fas fa-question-circle" 
                  style={{ 
                    fontSize: iconSize, 
                    color: 'var(--color-text-secondary)',
                    cursor: 'help'
                  }}
                />
              </span>
            </Tooltip>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              fontSize: '0.875rem',
              color: 'var(--color-text-secondary)',
            }}
          >
            {!isMobile && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 500,
                }}
              >
                <i className="fas fa-check-circle" style={{ color: 'var(--color-text-secondary)', fontSize: iconSize }}></i>
                {loadedSamplesCount} / 24 loaded
              </div>
            )}
            <button
              onClick={togglePin}
              className="pin-button"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              title={isDrumKeyboardPinned ? 'Unpin keyboard' : 'Pin keyboard to top'}
            >
              <i className="fas fa-thumbtack" style={{ 
                fontSize: iconSize,
              }}></i>
            </button>
          </div>
        </div>

        {/* Keyboard */}
        <div style={{ 
          padding: '1rem 0.5rem',
          backgroundColor: 'var(--color-bg-primary)',
          overflow: 'visible'
        }}>
          <DrumKeyboard onFileUpload={onFileUpload} />
        </div>
      </div>
    </>
  );
}; 