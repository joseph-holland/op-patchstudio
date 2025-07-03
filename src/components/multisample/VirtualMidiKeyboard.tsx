import { useState, useCallback, useEffect, useRef } from 'react';
import { Tooltip } from '../common/Tooltip';

interface VirtualMidiKeyboardProps {
  assignedNotes?: number[]; // MIDI note numbers that have samples assigned
  onKeyClick?: (midiNote: number) => void;
  onUnassignedKeyClick?: (midiNote: number) => void;
  onKeyDrop?: (midiNote: number, files: File[]) => void;
  className?: string;
  loadedSamplesCount?: number; // Number of loaded samples
  isPinned: boolean;
  onTogglePin: () => void;
}

export function VirtualMidiKeyboard({ 
  assignedNotes = [], 
  onKeyClick,
  onUnassignedKeyClick,
  onKeyDrop,
  className = '',
  loadedSamplesCount = 0,
  isPinned,
  onTogglePin
}: VirtualMidiKeyboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const keyboardScrollRef = useRef<HTMLDivElement>(null);
  
  const [hoveredKey, setHoveredKey] = useState<number | null>(null);
  const [dragOverKey, setDragOverKey] = useState<number | null>(null);
  const [isStuck, setIsStuck] = useState(false);
  const [dynamicStyles, setDynamicStyles] = useState({});
  const [placeholderHeight, setPlaceholderHeight] = useState(0);
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // Keyboard control state
  const [activeOctave, setActiveOctave] = useState(4); // Default to middle C (C4)
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  
  // Keyboard mapping - white keys (bottom row) and black keys (top row)
  const keyboardMapping = {
    // White keys (C, D, E, F, G, A, B)
    'a': 0,  // C
    's': 2,  // D  
    'd': 4,  // E
    'f': 5,  // F
    'g': 7,  // G
    'h': 9,  // A
    'j': 11, // B
    // Black keys (C#, D#, F#, G#, A#)
    'w': 1,  // C#
    'e': 3,  // D#
    't': 6,  // F#
    'y': 8,  // G#
    'u': 10  // A#
  };

  // Octave control functions
  const changeOctave = useCallback((direction: 'up' | 'down') => {
    setActiveOctave(prev => {
      if (direction === 'up' && prev < 9) return prev + 1;
      if (direction === 'down' && prev > -1) return prev - 1;
      return prev;
    });
  }, []);

  // Center the active octave in the viewport
  const centerActiveOctave = useCallback(() => {
    const scrollContainer = keyboardScrollRef.current;
    if (!scrollContainer) return;

    // Each octave is 7 white keys * 24px = 168px wide
    const octaveWidth = 7 * 24;
    const targetOctave = activeOctave + 1; // +1 because our octaves start from -1
    const targetPosition = targetOctave * octaveWidth;
    
    // Center the target octave in the viewport
    const containerWidth = scrollContainer.clientWidth;
    const scrollPosition = targetPosition - (containerWidth / 2) + (octaveWidth / 2);
    
    scrollContainer.scrollTo({
      left: Math.max(0, scrollPosition),
      behavior: 'smooth'
    });
  }, [activeOctave]);

  // Keyboard event handlers
  useEffect(() => {
    const isUserTyping = () => {
      const activeElement = document.activeElement;
      return activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.hasAttribute('contenteditable')
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is typing, don't process keyboard shortcuts
      if (isUserTyping()) {
        return;
      }
      
      const key = e.key.toLowerCase();
      
      // Prevent default for our mapped keys to avoid browser shortcuts
      if (key in keyboardMapping || key === 'z' || key === 'x') {
        e.preventDefault();
      }
      
      // Handle octave switching
      if (key === 'z') {
        changeOctave('down');
        return;
      }
      if (key === 'x') {
        changeOctave('up');
        return;
      }
      
      // Handle note playing - only respond if there's a sample loaded
      if (key in keyboardMapping && !pressedKeys.has(key)) {
        const noteOffset = keyboardMapping[key as keyof typeof keyboardMapping];
        // Fix: Use C3 = 60 convention. C3 is octave 3, so C0 = 60 - (3 * 12) = 24
        const midiNote = activeOctave * 12 + 24 + noteOffset;
        
        if (midiNote >= 0 && midiNote <= 127) {
          // Only trigger actions AND visual feedback if there's a sample assigned to this MIDI note
          if (assignedNotes.includes(midiNote)) {
            setPressedKeys(prev => new Set([...prev, key]));
            onKeyClick?.(midiNote);
          }
          // Do nothing if no sample is loaded - no visual feedback, no action calls
          // This prevents any response when there's nothing to play
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // If user is typing, don't process keyboard shortcuts
      if (isUserTyping()) {
        return;
      }
      
      const key = e.key.toLowerCase();
      if (key in keyboardMapping) {
        setPressedKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
     }, [activeOctave, pressedKeys, keyboardMapping, changeOctave, assignedNotes, onKeyClick, onUnassignedKeyClick]);

  // Center the keyboard on the active octave when it changes or on mount
  useEffect(() => {
    centerActiveOctave();
  }, [activeOctave, centerActiveOctave]);

  useEffect(() => {
    const container = containerRef.current;
    const placeholder = placeholderRef.current;

    const handleScroll = () => {
      if (!isPinned || !container || !placeholder) {
        return;
      }

      // The decision to STICK is based on the container's position.
      // The decision to UNSTICK is based on the placeholder's position.
      if (!isStuck) {
        const rect = container.getBoundingClientRect();
        if (rect.top <= 10) {
          // Time to STICK
          const { height, left, width } = rect;
          setPlaceholderHeight(height);
          setDynamicStyles({
            left: `${left}px`,
            width: `${width}px`,
          });
          setIsStuck(true);
        }
      } else {
        const placeholderRect = placeholder.getBoundingClientRect();
        if (placeholderRect.top > 10) {
          // Time to UNSTICK
          setDynamicStyles({});
          setIsStuck(false);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup on unpin
    if (!isPinned && isStuck) {
      setDynamicStyles({});
      setIsStuck(false);
    }
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isPinned, isStuck]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const iconSize = '18px';

  const tooltipContent = isMobile ? (
    <>
      <strong>load:</strong> tap empty keys to browse and select files<br />
      <strong>play:</strong> tap keys to play loaded samples<br />
      <strong>pin:</strong> use the pin icon to keep the keyboard at the top of the screen
    </>
  ) : (
    <>
      <strong>load:</strong> click empty keys to browse files or drag & drop audio onto any key<br />
      <strong>play:</strong> use keyboard keys (<strong>A-J, W, E, T, Y, U</strong>) & <strong>Z/X</strong> to change octave<br />
      <strong>pin:</strong> keep the keyboard fixed using the pin icon
    </>
  );

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



  // Helper function to get computer key for a MIDI note in the active octave
  const getComputerKeyForNote = (midiNote: number): string | null => {
    // Fix: Use C3 = 60 convention. C3 is octave 3, so C0 = 60 - (3 * 12) = 24
    const noteOctave = Math.floor((midiNote - 24) / 12);
    if (noteOctave !== activeOctave) return null;
    
    const noteInOctave = (midiNote - 24) % 12;
    
    // Find the computer key that maps to this note
    for (const [key, offset] of Object.entries(keyboardMapping)) {
      if (offset === noteInOctave) {
        return key.toUpperCase();
      }
    }
    return null;
  };

  const handleKeyClick = useCallback((midiNote: number) => {
    const isAssigned = assignedNotes.includes(midiNote);
    
    if (isAssigned) {
      onKeyClick?.(midiNote);
    } else {
      onUnassignedKeyClick?.(midiNote);
    }
  }, [assignedNotes, onKeyClick, onUnassignedKeyClick]);

  const handleKeyMouseEnter = useCallback((midiNote: number) => {
    setHoveredKey(midiNote);
  }, []);

  const handleKeyMouseLeave = useCallback(() => {
    setHoveredKey(null);
  }, []);

  const handleKeyDragOver = useCallback((e: React.DragEvent, midiNote: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setDragOverKey(midiNote);
    }
  }, []);

  const handleKeyDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKey(null);
  }, []);

  const handleKeyDrop = useCallback((e: React.DragEvent, midiNote: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverKey(null);
    
    const files = Array.from(e.dataTransfer.files);
    const wavFiles = files.filter(file => 
      file.type === 'audio/wav' || file.name.toLowerCase().endsWith('.wav')
    );
    
    if (wavFiles.length > 0) {
      onKeyDrop?.(midiNote, wavFiles);
    }
  }, [onKeyDrop]);

  // Generate all 128 MIDI keys
  const renderKeys = () => {
    const keys = [];
    
    // Group keys by octave for better layout
    for (let octave = -2; octave <= 8; octave++) {
      const octaveKeys = [];
      
      // White keys for this octave
      const whiteKeyOrder = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B
      
      for (let i = 0; i < whiteKeyOrder.length; i++) {
        const noteInOctave = whiteKeyOrder[i];
        // Fix: Use C3 = 60 convention. C3 is octave 3, so C0 = 60 - (3 * 12) = 24
        const midiNote = octave * 12 + 24 + noteInOctave;
        
        if (midiNote < 0 || midiNote > 127) continue;
        
        const isAssigned = assignedNotes.includes(midiNote);
        const isHovered = hoveredKey === midiNote;
        const isDragOver = dragOverKey === midiNote;
        const computerKey = getComputerKeyForNote(midiNote);
        const isPressed = computerKey && pressedKeys.has(computerKey.toLowerCase());
        
        // Define key colors based on state
        const whiteKeyColors = {
          base: isAssigned ? 'var(--color-bg-primary)' : 'var(--color-key-inactive-white-bg)',
          hover: 'var(--color-surface-secondary)',
          pressed: 'var(--color-interactive-secondary)',
          dragOver: 'var(--color-interactive-focus-ring)',
        };
        
        octaveKeys.push(
          <div
            key={`white-${midiNote}`}
            className="midi-key white-key"
            style={{
              position: 'relative',
              width: '24px',
              height: '120px',
              backgroundColor: isDragOver ? whiteKeyColors.dragOver : isPressed ? whiteKeyColors.pressed : isHovered ? whiteKeyColors.hover : whiteKeyColors.base,
              border: isDragOver ? '2px solid var(--color-text-secondary)' : `1px solid ${isAssigned ? 'var(--color-black)' : 'var(--color-key-inactive-border)'}`,
              borderRadius: '0 0 4px 4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              fontSize: '9px',
              fontWeight: '500',
              color: isAssigned ? 'var(--color-black)' : 'var(--color-key-inactive-white-bg)',
              padding: '2px',
              transition: 'all 0.1s ease',
              userSelect: 'none',
              boxShadow: isHovered ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              transform: isHovered ? 'translateY(-1px)' : 'none'
            }}
            onClick={() => handleKeyClick(midiNote)}
            onMouseEnter={() => handleKeyMouseEnter(midiNote)}
            onMouseLeave={handleKeyMouseLeave}
            onDragOver={(e) => handleKeyDragOver(e, midiNote)}
            onDragLeave={handleKeyDragLeave}
            onDrop={(e) => handleKeyDrop(e, midiNote)}
          >
            {/* Octave marker for C notes - always visible, color changes */}
            {noteInOctave === 0 && (
              <span style={{ 
                fontSize: '9px', 
                fontWeight: '600',
                color: isAssigned ? 'var(--color-black)' : 'var(--color-text-secondary)'
              }}>
                C{octave}
              </span>
            )}
          </div>
        );
      }
      
      // Black keys for this octave (positioned absolutely over white keys)
      const blackKeyPositions = [
        { noteInOctave: 1, position: 17 },   // C# - between C and D
        { noteInOctave: 3, position: 41 },   // D# - between D and E
        { noteInOctave: 6, position: 89 },   // F# - between F and G
        { noteInOctave: 8, position: 113 },  // G# - between G and A
        { noteInOctave: 10, position: 137 }  // A# - between A and B
      ];
      
      for (const { noteInOctave, position } of blackKeyPositions) {
        // Fix: Use C3 = 60 convention. C3 is octave 3, so C0 = 60 - (3 * 12) = 24
        const midiNote = octave * 12 + 24 + noteInOctave;
        
        if (midiNote < 0 || midiNote > 127) continue;
        
        const isAssigned = assignedNotes.includes(midiNote);
        const isHovered = hoveredKey === midiNote;
        const isDragOver = dragOverKey === midiNote;
        const computerKey = getComputerKeyForNote(midiNote);
        const isPressed = computerKey && pressedKeys.has(computerKey.toLowerCase());
        
        // Define key colors based on state
        const blackKeyColors = {
          base: isAssigned ? 'var(--color-interactive-dark)' : 'var(--color-key-inactive-black-bg)',
          hover: 'var(--color-interactive-dark)',
          pressed: 'var(--color-interactive-secondary)',
          dragOver: 'var(--color-interactive-secondary)',
        };
        
        octaveKeys.push(
          <div
            key={`black-${midiNote}`}
            className="midi-key black-key"
            style={{
              position: 'absolute',
              left: `${position}px`,
              top: '0',
              width: '14px',
              height: '75px',
              backgroundColor: isDragOver ? blackKeyColors.dragOver : isPressed ? blackKeyColors.pressed : isHovered ? blackKeyColors.hover : blackKeyColors.base,
              border: isDragOver ? '2px solid var(--color-text-secondary)' : `1px solid ${isAssigned ? 'var(--color-interactive-focus)' : 'var(--color-key-inactive-border)'}`,
              borderRadius: '0 0 2px 2px',
              cursor: 'pointer',
              zIndex: 2,
              transition: 'all 0.1s ease',
              userSelect: 'none',
              boxShadow: isHovered ? '0 2px 6px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.2)',
              transform: isHovered ? 'translateY(-1px)' : 'none'
            }}
            onClick={() => handleKeyClick(midiNote)}
            onMouseEnter={() => handleKeyMouseEnter(midiNote)}
            onMouseLeave={handleKeyMouseLeave}
            onDragOver={(e) => handleKeyDragOver(e, midiNote)}
            onDragLeave={handleKeyDragLeave}
            onDrop={(e) => handleKeyDrop(e, midiNote)}
          />
        );
      }
      
      keys.push(
        <div
          key={`octave-${octave}`}
          style={{
            position: 'relative',
            display: 'flex'
          }}
        >
          {octaveKeys}
        </div>
      );
    }
    
    return keys;
  };

  return (
    <>
      <div 
        ref={placeholderRef}
        style={{
          display: isStuck ? 'block' : 'none',
          height: `${placeholderHeight}px`,
          background: 'var(--color-surface-primary)'
        }}
      />
      <div
        ref={containerRef}
        className={`virtual-midi-keyboard ${isPinned ? 'pinned' : ''} ${className}`}
        style={combinedStyles}
      >
        {/* Left fade overlay */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: '60px', // Start below the header section
          bottom: 0,
          width: '30px',
          background: 'linear-gradient(to right, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0))',
          zIndex: 10,
          pointerEvents: 'none'
        }} />

        {/* Right fade overlay */}
        <div style={{
          position: 'absolute',
          right: 0,
          top: '60px', // Start below the header section
          bottom: 0,
          width: '30px',
          background: 'linear-gradient(to left, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0))',
          zIndex: 10,
          pointerEvents: 'none'
        }} />

        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 1rem 0.5rem 1rem',
          borderBottom: '1px solid var(--color-border-medium)',
          backgroundColor: 'var(--color-bg-primary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <h3 style={{
              margin: 0,
              color: 'var(--color-text-primary)',
              fontSize: '1.25rem',
              fontWeight: 300,
            }}>
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
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary)'
          }}>
            {!isMobile && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                fontWeight: 500
              }}>
                <i className="fas fa-check-circle" style={{ color: 'var(--color-text-secondary)', fontSize: iconSize }}></i>
                {loadedSamplesCount} / 24 loaded
              </div>
            )}
            <button
              onClick={onTogglePin}
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
              title={isPinned ? 'Unpin keyboard' : 'Pin keyboard to top'}
            >
              <i className="fas fa-thumbtack" style={{ 
                fontSize: iconSize,
              }}></i>
            </button>
          </div>
        </div>

        <div 
          ref={keyboardScrollRef}
          className="hide-scrollbar"
          style={{
            backgroundColor: '#fff',
            border: 'none',
            borderRadius: '0',
            padding: '1rem',
            overflowX: 'auto',
            overflowY: 'hidden',
            position: 'relative'
          }}>
          
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            minWidth: '1400px', // Ensure enough space for all keys
            height: '120px',
            position: 'relative'
          }}>
            {renderKeys()}

            {/* Compact Indicator Strip Over Keyboard - hidden on mobile */}
            {!isMobile && (
            <div style={{
              position: 'absolute',
              left: `${(activeOctave + 1) * 168}px`, // Each octave is 7 keys * 24px = 168px
              top: '10px', // Position near the top of the keys
              width: activeOctave === 9 ? '120px' : '168px', // Shorter for top octave
              height: '24px',
              backgroundColor: 'rgba(102, 102, 102, 0.8)', // #666 with 0.8 opacity
              borderRadius: '3px',
              zIndex: 15, // Ensure it's on top of keys and fades
              pointerEvents: 'none', // Make it non-interactive
              transition: 'left 0.3s ease-in-out, width 0.3s ease-in-out' // Smooth transition for position and size
            }}>
              {/* Position letters exactly centered on their corresponding keys */}
              
              {/* C key - A (white key 0-24px, center at 12px) */}
              <div style={{
                position: 'absolute',
                left: '9px',
                top: '65%', // Adjusted to be in lower part of rect
                transform: 'translate(-50%, -50%)',
                fontSize: '9px',
                fontWeight: '600',
                color: pressedKeys.has('a') ? '#ffd700' : '#fff',
                letterSpacing: '0.5px',
                lineHeight: '1',
                textShadow: pressedKeys.has('a') ? '0 0 2px rgba(255, 215, 0, 0.8)' : 'none',
                transition: 'all 0.1s ease'
              }}>
                A
              </div>
              
              {/* C# key - W (black key at 17px, width 14px, center at 17+7=24px) */}
              <div style={{
                position: 'absolute',
                left: '24px',
                top: '35%', // Adjusted to be in upper part of rect
                transform: 'translate(-50%, -50%)',
                fontSize: '9px',
                fontWeight: '600',
                color: pressedKeys.has('w') ? '#ffd700' : '#fff',
                letterSpacing: '0.5px',
                lineHeight: '1',
                textShadow: pressedKeys.has('w') ? '0 0 2px rgba(255, 215, 0, 0.8)' : 'none',
                transition: 'all 0.1s ease'
              }}>
                W
              </div>
              
              {/* D key - S (white key 24-48px, center at 36px) */}
              <div style={{
                position: 'absolute',
                left: '36px',
                top: '65%', // Adjusted to be in lower part of rect
                transform: 'translate(-50%, -50%)',
                fontSize: '9px',
                fontWeight: '600',
                color: pressedKeys.has('s') ? '#ffd700' : '#fff',
                letterSpacing: '0.5px',
                lineHeight: '1',
                textShadow: pressedKeys.has('s') ? '0 0 2px rgba(255, 215, 0, 0.8)' : 'none',
                transition: 'all 0.1s ease'
              }}>
                S
              </div>
              
              {/* D# key - E (black key at 41px, width 14px, center at 41+7=48px) */}
              <div style={{
                position: 'absolute',
                left: '48px',
                top: '35%', // Adjusted to be in upper part of rect
                transform: 'translate(-50%, -50%)',
                fontSize: '9px',
                fontWeight: '600',
                color: pressedKeys.has('e') ? '#ffd700' : '#fff',
                letterSpacing: '0.5px',
                lineHeight: '1',
                textShadow: pressedKeys.has('e') ? '0 0 2px rgba(255, 215, 0, 0.8)' : 'none',
                transition: 'all 0.1s ease'
              }}>
                E
              </div>
              
              {/* E key - D (white key 48-72px, center at 60px) */}
              <div style={{
                position: 'absolute',
                left: '63px',
                top: '65%', // Adjusted to be in lower part of rect
                transform: 'translate(-50%, -50%)',
                fontSize: '9px',
                fontWeight: '600',
                color: pressedKeys.has('d') ? '#ffd700' : '#fff',
                letterSpacing: '0.5px',
                lineHeight: '1',
                textShadow: pressedKeys.has('d') ? '0 0 2px rgba(255, 215, 0, 0.8)' : 'none',
                transition: 'all 0.1s ease'
              }}>
                D
              </div>
              
              {/* F key - F (white key 72-96px, center at 84px) */}
              <div style={{
                position: 'absolute',
                left: '81px',
                top: '65%', // Adjusted to be in lower part of rect
                transform: 'translate(-50%, -50%)',
                fontSize: '9px',
                fontWeight: '600',
                color: pressedKeys.has('f') ? '#ffd700' : '#fff',
                letterSpacing: '0.5px',
                lineHeight: '1',
                textShadow: pressedKeys.has('f') ? '0 0 2px rgba(255, 215, 0, 0.8)' : 'none',
                transition: 'all 0.1s ease'
              }}>
                F
              </div>
              
              {/* F# key - T (black key at 89px, width 14px, center at 89+7=96px) */}
              <div style={{
                position: 'absolute',
                left: '96px',
                top: '35%', // Adjusted to be in upper part of rect
                transform: 'translate(-50%, -50%)',
                fontSize: '9px',
                fontWeight: '600',
                color: pressedKeys.has('t') ? '#ffd700' : '#fff',
                letterSpacing: '0.5px',
                lineHeight: '1',
                textShadow: pressedKeys.has('t') ? '0 0 2px rgba(255, 215, 0, 0.8)' : 'none',
                transition: 'all 0.1s ease'
              }}>
                T
              </div>
              
              {/* G key - G (white key 96-120px, center at 108px) */}
              <div style={{
                position: 'absolute',
                left: activeOctave === 9 ? '111px' : '108px',
                top: '65%', // Adjusted to be in lower part of rect
                transform: 'translate(-50%, -50%)',
                fontSize: '9px',
                fontWeight: '600',
                color: pressedKeys.has('g') ? '#ffd700' : '#fff',
                letterSpacing: '0.5px',
                lineHeight: '1',
                textShadow: pressedKeys.has('g') ? '0 0 2px rgba(255, 215, 0, 0.8)' : 'none',
                transition: 'all 0.1s ease'
              }}>
                G
              </div>
              
              {activeOctave !== 9 && (
                <>
                  {/* G# key - Y (black key at 113px, width 14px, center at 113+7=120px) */}
                  <div style={{
                    position: 'absolute',
                    left: '120px',
                    top: '35%', // Adjusted to be in upper part of rect
                    transform: 'translate(-50%, -50%)',
                    fontSize: '9px',
                    fontWeight: '600',
                    color: pressedKeys.has('y') ? '#ffd700' : '#fff',
                    letterSpacing: '0.5px',
                    lineHeight: '1',
                    textShadow: pressedKeys.has('y') ? '0 0 2px rgba(255, 215, 0, 0.8)' : 'none',
                    transition: 'all 0.1s ease'
                  }}>
                    Y
                  </div>
                  
                  {/* A key - H (white key 120-144px, center at 132px) */}
                  <div style={{
                    position: 'absolute',
                    left: '132px',
                    top: '65%', // Adjusted to be in lower part of rect
                    transform: 'translate(-50%, -50%)',
                    fontSize: '9px',
                    fontWeight: '600',
                    color: pressedKeys.has('h') ? '#ffd700' : '#fff',
                    letterSpacing: '0.5px',
                    lineHeight: '1',
                    textShadow: pressedKeys.has('h') ? '0 0 2px rgba(255, 215, 0, 0.8)' : 'none',
                    transition: 'all 0.1s ease'
                  }}>
                    H
                  </div>
                  
                  {/* A# key - U (black key at 137px, width 14px, center at 137+7=144px) */}
                  <div style={{
                    position: 'absolute',
                    left: '144px',
                    top: '35%', // Adjusted to be in upper part of rect
                    transform: 'translate(-50%, -50%)',
                    fontSize: '9px',
                    fontWeight: '600',
                    color: pressedKeys.has('u') ? '#ffd700' : '#fff',
                    letterSpacing: '0.5px',
                    lineHeight: '1',
                    textShadow: pressedKeys.has('u') ? '0 0 2px rgba(255, 215, 0, 0.8)' : 'none',
                    transition: 'all 0.1s ease'
                  }}>
                    U
                  </div>
                  
                  {/* B key - J (white key 144-168px, center at 159px) */}
                  <div style={{
                    position: 'absolute',
                    left: '159px',
                    top: '65%', // Adjusted to be in lower part of rect
                    transform: 'translate(-50%, -50%)',
                    fontSize: '9px',
                    fontWeight: '600',
                    color: pressedKeys.has('j') ? '#ffd700' : '#fff',
                    letterSpacing: '0.5px',
                    lineHeight: '1',
                    textShadow: pressedKeys.has('j') ? '0 0 2px rgba(255, 215, 0, 0.8)' : 'none',
                    transition: 'all 0.1s ease'
                  }}>
                    J
                  </div>
                </>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
} 