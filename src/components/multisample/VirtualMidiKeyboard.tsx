import { useState, useCallback, useEffect, useRef } from 'react';
import { EnhancedTooltip } from '../common/EnhancedTooltip';
import { useWebMidi } from '../../hooks/useWebMidi';
import { MidiDeviceSelector } from '../common/MidiDeviceSelector';
import type { MidiEvent } from '../../utils/midi';

interface VirtualMidiKeyboardProps {
  assignedNotes?: number[]; // MIDI note numbers that have samples assigned
  onKeyClick?: (midiNote: number) => void;
  onKeyRelease?: (midiNote: number) => void; // Add release handler for ADSR
  onUnassignedKeyClick?: (midiNote: number) => void;
  onKeyDrop?: (midiNote: number, files: File[]) => void;
  className?: string;
  loadedSamplesCount?: number; // Number of loaded samples
  isPinned: boolean;
  onTogglePin: () => void;
  selectedMidiChannel?: number;
  onMidiChannelChange?: (channel: number) => void;
  isActive?: boolean; // Whether this keyboard should respond to MIDI events
}

export function VirtualMidiKeyboard({ 
  assignedNotes = [], 
  onKeyClick,
  onKeyRelease,
  onUnassignedKeyClick,
  onKeyDrop,
  className = '',
  loadedSamplesCount = 0,
  isPinned,
  onTogglePin,
  selectedMidiChannel,
  onMidiChannelChange,
  isActive = true
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

  const [mousePressedKey, setMousePressedKey] = useState<number | null>(null);
  const { onMidiEvent, state: midiState, initialize, refreshDevices } = useWebMidi();
  const [isMidiSelectorVisible, setIsMidiSelectorVisible] = useState(false);
  const [localSelectedMidiChannel, setLocalSelectedMidiChannel] = useState(selectedMidiChannel || 1);
  const [midiTriggeredKeys, setMidiTriggeredKeys] = useState<Set<string>>(new Set());
  const [midiPressedNotes, setMidiPressedNotes] = useState<Set<number>>(new Set());

  // Auto-initialize MIDI if not already initialized
  useEffect(() => {
    if (!midiState.isInitialized && !midiState.isConnecting) {
      initialize();
    }
  }, [midiState.isInitialized, midiState.isConnecting, initialize]);

  // Refresh MIDI devices when tab becomes visible (helps with device detection)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && midiState.isInitialized) {
        console.log('[MIDI] Tab became visible, refreshing devices...');
        refreshDevices();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [midiState.isInitialized, refreshDevices]);

  // Check if MIDI is connected (initialized and has input devices)
  const inputDevices = midiState.devices.filter(device => device.type === 'input' && device.state === 'connected');
  const isMidiConnected = midiState.isInitialized && inputDevices.length > 0;
  
  // Mouse drag scrolling state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartScrollLeft, setDragStartScrollLeft] = useState(0);
  
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
      if (direction === 'up' && prev < 8) return prev + 1;
      if (direction === 'down' && prev > -2) return prev - 1;
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
        setPressedKeys(prev => new Set([...prev, key]));
        changeOctave('down');
        return;
      }
      if (key === 'x') {
        setPressedKeys(prev => new Set([...prev, key]));
        changeOctave('up');
        return;
      }
      
      // Handle note playing - only respond if there's a sample loaded
      if (key in keyboardMapping && !pressedKeys.has(key) && !midiTriggeredKeys.has(key)) {
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
      if (key in keyboardMapping || key === 'z' || key === 'x') {
        setPressedKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
        
        // Trigger release for assigned notes on keyboard release
        if (key in keyboardMapping) {
          const noteOffset = keyboardMapping[key as keyof typeof keyboardMapping];
          const midiNote = activeOctave * 12 + 24 + noteOffset;
          
          if (midiNote >= 0 && midiNote <= 127 && assignedNotes.includes(midiNote)) {
            onKeyRelease?.(midiNote);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
     }, [activeOctave, pressedKeys, keyboardMapping, changeOctave, assignedNotes, onKeyClick, onUnassignedKeyClick]);

  // Helper function to get computer key for a MIDI note in the active octave
  const getComputerKeyForNote = useCallback((midiNote: number): string | null => {
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
  }, [activeOctave, keyboardMapping]);

  // Function to hide MIDI selector
  const hideMidiSelector = () => {
    setIsMidiSelectorVisible(false);
    const midiSelector = document.querySelector('.virtual-midi-keyboard .midi-device-selector') as HTMLElement;
    if (midiSelector) {
      midiSelector.style.display = 'none';
    }
  };

  // Wrap handleMidiEvent in useCallback so its reference is stable
  const handleMidiEvent = useCallback((event: MidiEvent) => {
    if (event.type === 'noteon' || event.type === 'noteoff') {
      const midiNote = event.note;
      console.log(`[MIDI] Virtual keyboard received note: ${midiNote} (velocity: ${event.velocity}, channel: ${event.channel})`);
      
      if (event.type === 'noteon' && event.velocity > 0) {
        // Note on - only trigger playback for assigned notes, not file browser for unassigned
        if (assignedNotes.includes(midiNote)) {
          onKeyClick?.(midiNote);
        }
        // Don't call onUnassignedKeyClick for MIDI - only mouse clicks should trigger file browser
        
        // Hide MIDI selector when a note is played
        hideMidiSelector();
        
        // Add visual feedback for ALL keys (not just current octave)
        setMidiPressedNotes(prev => new Set([...prev, midiNote]));
        
        // Also handle computer keyboard mapping for current octave
        const computerKey = getComputerKeyForNote(midiNote);
        if (computerKey) {
          const keyLower = computerKey.toLowerCase();
          // Mark this key as MIDI-triggered to prevent keyboard handler from firing
          setMidiTriggeredKeys(prev => new Set([...prev, keyLower]));
          setPressedKeys(prev => new Set([...prev, keyLower]));
        }
        
        // Remove visual feedback after 150ms (same as mouse clicks)
        setTimeout(() => {
          setMidiPressedNotes(prev => {
            const newSet = new Set(prev);
            newSet.delete(midiNote);
            return newSet;
          });
          // Clear computer keyboard mapping after a short delay
          if (computerKey) {
            setTimeout(() => {
              setPressedKeys(prev => {
                const newSet = new Set(prev);
                newSet.delete(computerKey.toLowerCase());
                return newSet;
              });
              setMidiTriggeredKeys(prev => {
                const newSet = new Set(prev);
                newSet.delete(computerKey.toLowerCase());
                return newSet;
              });
            }, 50);
          }
        }, 150);
      } else {
        // Note off - remove visual feedback immediately and trigger release
        setMidiPressedNotes(prev => {
          const newSet = new Set(prev);
          newSet.delete(midiNote);
          return newSet;
        });
        
        // Trigger release for assigned notes on MIDI note off
        if (assignedNotes.includes(midiNote)) {
          onKeyRelease?.(midiNote);
        }
        
        // Also clear computer keyboard mapping
        const computerKey = getComputerKeyForNote(midiNote);
        if (computerKey) {
          const keyLower = computerKey.toLowerCase();
          setPressedKeys(prev => {
            const newSet = new Set(prev);
            newSet.delete(keyLower);
            return newSet;
          });
          setMidiTriggeredKeys(prev => {
            const newSet = new Set(prev);
            newSet.delete(keyLower);
            return newSet;
          });
        }
      }
    }
  }, [assignedNotes, onKeyClick, onUnassignedKeyClick, getComputerKeyForNote, hideMidiSelector]);

  // MIDI event handling for multisample keyboard - only when active
  useEffect(() => {
    if (!midiState.isInitialized) {
      return;
    }

    // Only set up MIDI listener if this keyboard is active
    if (!isActive) {
      return;
    }

    // Set up MIDI event listener
    if (isMidiConnected && localSelectedMidiChannel) {
      const cleanup = onMidiEvent(handleMidiEvent, localSelectedMidiChannel);
      
      return () => {
        cleanup();
      };
    } else if (!isMidiConnected) {
      console.log(`[MIDI] Virtual keyboard: No MIDI devices connected`);
    } else if (!localSelectedMidiChannel) {
      console.log(`[MIDI] Virtual keyboard: No MIDI channel selected`);
    }
  }, [isMidiConnected, localSelectedMidiChannel, onMidiEvent, handleMidiEvent, isActive]);

  // Center the keyboard on the active octave when it changes or on mount
  useEffect(() => {
    centerActiveOctave();
  }, [activeOctave, centerActiveOctave]);

  // Handle unpinning while stuck - reset stuck state without scrolling
  useEffect(() => {
    if (!isPinned && isStuck) {
      setDynamicStyles({});
      setIsStuck(false);
    }
  }, [isPinned, isStuck]);

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
      <h3>
        <i className="fas fa-keyboard" style={{ marginRight: '0.5rem' }}></i>
        keyboard controls
      </h3>
      <p><strong>load:</strong> tap empty keys to browse and select files</p>
      <p><strong>play:</strong> tap keys to play loaded samples</p>
      <p><strong>pin:</strong> use the pin icon to keep the keyboard at the top of the screen</p>
    </>
  ) : (
    <>
      <h3>
        <i className="fas fa-keyboard" style={{ marginRight: '0.5rem' }}></i>
        keyboard controls
      </h3>
      <p><strong>load:</strong> click empty keys to browse files or drag & drop audio onto any key</p>
      <p><strong>play:</strong> use keyboard keys (<strong>A-J, W, E, T, Y, U</strong>) & <strong>Z/X</strong> to change octave</p>
      <p><strong>pin:</strong> keep the keyboard fixed using the pin icon</p>
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

  // Mouse drag handlers for keyboard scrolling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Start dragging on any click in the keyboard area
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartScrollLeft(keyboardScrollRef.current?.scrollLeft || 0);
    e.preventDefault();
  }, []);



  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Global mouse handlers for dragging
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging || !keyboardScrollRef.current) return;
      
      const deltaX = e.clientX - dragStartX;
      keyboardScrollRef.current.scrollLeft = dragStartScrollLeft - deltaX;
      e.preventDefault();
    };

    if (isDragging) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('mousemove', handleGlobalMouseMove);
      return () => {
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('mousemove', handleGlobalMouseMove);
      };
    }
  }, [isDragging, dragStartX, dragStartScrollLeft]);

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
        const isPressed = (computerKey && pressedKeys.has(computerKey.toLowerCase())) || mousePressedKey === midiNote || midiPressedNotes.has(midiNote);
        
        // Define key colors based on state
        const whiteKeyColors = {
          base: isAssigned ? 'var(--color-bg-primary)' : 'var(--color-key-inactive-white-bg)',
          hover: 'var(--color-surface-secondary)',
          pressed: isPressed ? 'linear-gradient(to top, var(--color-border-subtle) 0%, var(--color-bg-primary) 70%, var(--color-bg-primary) 100%)' : 'var(--color-interactive-secondary)',
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
              ...(isDragOver
                ? { backgroundColor: whiteKeyColors.dragOver }
                : isPressed && whiteKeyColors.pressed.startsWith('linear-gradient')
                  ? { background: whiteKeyColors.pressed }
                  : isPressed
                    ? { backgroundColor: whiteKeyColors.pressed }
                    : isHovered
                      ? { backgroundColor: whiteKeyColors.hover }
                      : { backgroundColor: whiteKeyColors.base }),
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
              boxShadow: isHovered ? '0 2px 4px rgba(0,0,0,0.1)' : '0 2px 6px rgba(0,0,0,0.3)',
            }}
            onMouseDown={() => {
              // Don't set pressed key if we're starting to drag
              if (!isDragging) {
                setMousePressedKey(midiNote);
                // Trigger note on mouse down for immediate response
                if (assignedNotes.includes(midiNote)) {
                  onKeyClick?.(midiNote);
                }
              }
            }}
            onMouseUp={() => {
              setMousePressedKey(null);
              // Trigger release for ADSR
              if (assignedNotes.includes(midiNote)) {
                onKeyRelease?.(midiNote);
              }
            }}
            onMouseLeave={() => { 
              setMousePressedKey(null); 
              handleKeyMouseLeave();
              // Trigger release for ADSR when mouse leaves key
              if (assignedNotes.includes(midiNote)) {
                onKeyRelease?.(midiNote);
              }
            }}
            onTouchStart={() => {
              // Trigger note on touch start for immediate response
              if (assignedNotes.includes(midiNote)) {
                onKeyClick?.(midiNote);
              }
            }}
            onTouchEnd={() => {
              // Trigger release for ADSR on touch end
              if (assignedNotes.includes(midiNote)) {
                onKeyRelease?.(midiNote);
              }
            }}

            onMouseEnter={() => handleKeyMouseEnter(midiNote)}
            onDragOver={(e) => handleKeyDragOver(e, midiNote)}
            onDragLeave={handleKeyDragLeave}
            onDrop={(e) => handleKeyDrop(e, midiNote)}
          >
            {/* Octave marker for C notes - always visible, color changes */}
            {noteInOctave === 0 && (
              <span style={{ 
                fontSize: '10px', 
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
        const isPressed = (computerKey && pressedKeys.has(computerKey.toLowerCase())) || mousePressedKey === midiNote || midiPressedNotes.has(midiNote);
        
        // Define key colors based on state
        const blackKeyColors = {
          base: isAssigned ? 'var(--color-interactive-dark)' : 'var(--color-key-inactive-black-bg)',
          hover: 'var(--color-interactive-dark)',
          pressed: isPressed ? 'linear-gradient(to top, var(--color-key-inactive-black-bg) 0%, var(--color-interactive-dark) 70%, var(--color-interactive-dark) 100%)' : 'var(--color-interactive-secondary)',
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
              ...(isDragOver
                ? { backgroundColor: blackKeyColors.dragOver }
                : isPressed && blackKeyColors.pressed.startsWith('linear-gradient')
                  ? { background: blackKeyColors.pressed }
                  : isPressed
                    ? { backgroundColor: blackKeyColors.pressed }
                    : isHovered
                      ? { backgroundColor: blackKeyColors.hover }
                      : { backgroundColor: blackKeyColors.base }),
              border: isDragOver ? '2px solid var(--color-text-secondary)' : `1px solid ${isAssigned ? 'var(--color-interactive-focus)' : 'var(--color-key-inactive-border)'}`,
              borderRadius: '0 0 2px 2px',
              cursor: 'pointer',
              zIndex: 2,
              userSelect: 'none',
              boxShadow: isHovered ? '0 3px 8px rgba(0,0,0,0.5)' : '0 2px 4px rgba(0,0,0,0.3)',
            }}
            onMouseDown={() => {
              // Don't set pressed key if we're starting to drag
              if (!isDragging) {
                setMousePressedKey(midiNote);
                // Trigger note on mouse down for immediate response
                if (assignedNotes.includes(midiNote)) {
                  onKeyClick?.(midiNote);
                }
              }
            }}
            onMouseUp={() => {
              setMousePressedKey(null);
              // Trigger release for ADSR
              if (assignedNotes.includes(midiNote)) {
                onKeyRelease?.(midiNote);
              }
            }}
            onMouseLeave={() => { 
              setMousePressedKey(null); 
              handleKeyMouseLeave();
              // Trigger release for ADSR when mouse leaves key
              if (assignedNotes.includes(midiNote)) {
                onKeyRelease?.(midiNote);
              }
            }}
            onTouchStart={() => {
              // Trigger note on touch start for immediate response
              if (assignedNotes.includes(midiNote)) {
                onKeyClick?.(midiNote);
              }
            }}
            onTouchEnd={() => {
              // Trigger release for ADSR on touch end
              if (assignedNotes.includes(midiNote)) {
                onKeyRelease?.(midiNote);
              }
            }}
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
          padding: '0.7rem 1rem 0.5rem 1rem',
          borderBottom: '1px solid var(--color-border-medium)',
          backgroundColor: 'var(--color-bg-secondary)'
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
            <EnhancedTooltip
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
                          </EnhancedTooltip>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary)'
          }}>
            {!isMobile && (
              <>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  fontWeight: 500
                }}>
                  <i className="fas fa-check-circle" style={{ color: 'var(--color-text-secondary)', fontSize: iconSize }}></i>
                  {loadedSamplesCount} / 24 loaded
                </div>
                <button
                  onClick={() => {
                    setIsMidiSelectorVisible(!isMidiSelectorVisible);
                    const midiSelector = document.querySelector('.virtual-midi-keyboard .midi-device-selector') as HTMLElement;
                    if (midiSelector) {
                      midiSelector.style.display = isMidiSelectorVisible ? 'none' : 'block';
                    }
                  }}
                  style={{
                    background: isMidiSelectorVisible 
                      ? 'var(--color-interactive-focus)' 
                      : midiState.devices.filter(d => d.type === 'input' && d.state === 'connected').length > 0
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.875rem',
                    color: 'var(--color-white)',
                    transition: 'all 0.2s ease',
                    fontFamily: '"Montserrat", "Arial", sans-serif',
                    fontWeight: 500,
                    minHeight: '32px'
                  }}
                  onMouseEnter={e => {
                    const hasConnectedDevices = midiState.devices.filter(d => d.type === 'input' && d.state === 'connected').length > 0;
                    e.currentTarget.style.backgroundColor = isMidiSelectorVisible 
                      ? 'var(--color-interactive-dark)' 
                      : hasConnectedDevices
                        ? 'var(--color-interactive-focus)'
                        : 'var(--color-interactive-focus)';
                  }}
                  onMouseLeave={e => {
                    const hasConnectedDevices = midiState.devices.filter(d => d.type === 'input' && d.state === 'connected').length > 0;
                    e.currentTarget.style.backgroundColor = isMidiSelectorVisible 
                      ? 'var(--color-interactive-focus)' 
                      : hasConnectedDevices
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-secondary)';
                  }}
                  title="connect midi devices"
                >
                  <i className="fas fa-plug" style={{ fontSize: '0.75rem' }}></i>
                  <span>midi</span>
                </button>
              </>
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

        {/* MIDI Device Selector (Hidden by default) */}
        <div 
          className="midi-device-selector"
          style={{ 
            display: isMidiSelectorVisible ? 'block' : 'none',
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--color-bg-primary)',
            borderBottom: '1px solid var(--color-border-light)'
          }}
        >
          <MidiDeviceSelector 
            showInputsOnly={true} 
            onChannelChange={(channel) => {
              setLocalSelectedMidiChannel(channel);
              localStorage.setItem('midi-channel', channel.toString());
              onMidiChannelChange?.(channel);
            }}
          />
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
            position: 'relative',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}>
          
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            minWidth: '1400px', // Ensure enough space for all keys
            height: '120px',
            position: 'relative'
          }}>
            {renderKeys()}

            {/* Compact Indicator Strip Over Keyboard - hidden on mobile and when MIDI is connected */}
            {!isMobile && !isMidiConnected && (() => {
              const octaveWidth = 168;
              const indicatorPadding = 24;
              const firstOctave = -2;
              const lastOctaveWithKeys = 8;
              const lastOctaveKeysWidth = 120; // Keys only render up to G8

              let indicatorLeft, indicatorWidth;
              let letterContainerLeft, letterContainerWidth;

              if (activeOctave === firstOctave) {
                // Lowest octave: flush left, padding on right for 'X'
                indicatorLeft = 0;
                indicatorWidth = octaveWidth + indicatorPadding;
                letterContainerLeft = 0;
                letterContainerWidth = octaveWidth;
              } else if (activeOctave >= lastOctaveWithKeys) {
                // Highest octave(s): padding on left for 'Z', width of last keys
                indicatorLeft = (lastOctaveWithKeys + 2) * octaveWidth - indicatorPadding;
                indicatorWidth = lastOctaveKeysWidth + indicatorPadding;
                letterContainerLeft = indicatorPadding;
                letterContainerWidth = lastOctaveKeysWidth;
              } else {
                // Middle octaves: padding on both sides
                indicatorLeft = (activeOctave + 2) * octaveWidth - indicatorPadding;
                indicatorWidth = octaveWidth + (2 * indicatorPadding);
                letterContainerLeft = indicatorPadding;
                letterContainerWidth = octaveWidth;
              }

              return (
                <div style={{
                  position: 'absolute',
                  left: `${indicatorLeft}px`,
                  top: '10px',
                  width: `${indicatorWidth}px`,
                  height: '24px',
                  backgroundColor: '#fff',
                  border: '2px solid #000',
                  borderRadius: '3px',
                  boxShadow: '0 6px 12px rgba(0, 0, 0, 0.4)',
                  zIndex: 15,
                  pointerEvents: 'none',
                  opacity: loadedSamplesCount > 0 ? 1 : 0,
                  transition: 'left 0.3s ease-in-out, width 0.3s ease-in-out, opacity 0.75s ease-in-out'
                }}>
                  {/* Letter keys container */}
                  <div style={{
                    position: 'absolute',
                    left: `${letterContainerLeft}px`,
                    width: `${letterContainerWidth}px`,
                    height: '100%'
                  }}>
                                      {/* C key - A (white key 0-24px, center at 12px) */}
                  <div style={{
                    position: 'absolute',
                    left: '9px',
                    top: '65%', // Adjusted to be in lower part of rect
                    transform: 'translate(-50%, -50%)',
                    fontSize: '10px',
                    fontWeight: pressedKeys.has('a') ? '700' : '600',
                    color: pressedKeys.has('a') ? 'var(--color-interactive-secondary)' : '#000',
                    letterSpacing: '0.5px',
                    lineHeight: '1',
                    textShadow: pressedKeys.has('a') ? '0 0 2px rgba(51, 51, 51, 0.8)' : 'none',
                    transition: 'all 0.1s ease, opacity 1.5s ease-in-out'
                  }}>
                    A
                  </div>
                  
                  {/* C# key - W (black key at 17px, width 14px, center at 17+7=24px) */}
                  <div style={{
                    position: 'absolute',
                    left: '24px',
                    top: '35%', // Adjusted to be in upper part of rect
                    transform: 'translate(-50%, -50%)',
                    fontSize: '10px',
                    fontWeight: pressedKeys.has('w') ? '700' : '600',
                    color: pressedKeys.has('w') ? 'var(--color-interactive-secondary)' : '#000',
                    letterSpacing: '0.5px',
                    lineHeight: '1',
                    textShadow: pressedKeys.has('w') ? '0 0 2px rgba(51, 51, 51, 0.8)' : 'none',
                    transition: 'all 0.1s ease, opacity 1.5s ease-in-out'
                  }}>
                    W
                  </div>
                  
                  {/* D key - S (white key 24-48px, center at 36px) */}
                  <div style={{
                    position: 'absolute',
                    left: '36px',
                    top: '65%', // Adjusted to be in lower part of rect
                    transform: 'translate(-50%, -50%)',
                    fontSize: '10px',
                    fontWeight: pressedKeys.has('s') ? '700' : '600',
                    color: pressedKeys.has('s') ? 'var(--color-interactive-secondary)' : '#000',
                    letterSpacing: '0.5px',
                    lineHeight: '1',
                    textShadow: pressedKeys.has('s') ? '0 0 2px rgba(51, 51, 51, 0.8)' : 'none',
                    transition: 'all 0.1s ease, opacity 1.5s ease-in-out'
                  }}>
                    S
                  </div>
                  
                  {/* D# key - E (black key at 41px, width 14px, center at 41+7=48px) */}
                  <div style={{
                    position: 'absolute',
                    left: '48px',
                    top: '35%', // Adjusted to be in upper part of rect
                    transform: 'translate(-50%, -50%)',
                    fontSize: '10px',
                    fontWeight: pressedKeys.has('e') ? '700' : '600',
                    color: pressedKeys.has('e') ? 'var(--color-interactive-secondary)' : '#000',
                    letterSpacing: '0.5px',
                    lineHeight: '1',
                    textShadow: pressedKeys.has('e') ? '0 0 2px rgba(51, 51, 51, 0.8)' : 'none',
                    transition: 'all 0.1s ease, opacity 1.5s ease-in-out'
                  }}>
                    E
                  </div>
                  
                  {/* E key - D (white key 48-72px, center at 60px) */}
                  <div style={{
                    position: 'absolute',
                    left: '63px',
                    top: '65%', // Adjusted to be in lower part of rect
                    transform: 'translate(-50%, -50%)',
                    fontSize: '10px',
                    fontWeight: pressedKeys.has('d') ? '700' : '600',
                    color: pressedKeys.has('d') ? 'var(--color-interactive-secondary)' : '#000',
                    letterSpacing: '0.5px',
                    lineHeight: '1',
                    textShadow: pressedKeys.has('d') ? '0 0 2px rgba(51, 51, 51, 0.8)' : 'none',
                    transition: 'all 0.1s ease, opacity 1.5s ease-in-out'
                  }}>
                    D
                  </div>
                  
                  {/* F key - F (white key 72-96px, center at 84px) */}
                  <div style={{
                    position: 'absolute',
                    left: '81px',
                    top: '65%', // Adjusted to be in lower part of rect
                    transform: 'translate(-50%, -50%)',
                    fontSize: '10px',
                    fontWeight: pressedKeys.has('f') ? '700' : '600',
                    color: pressedKeys.has('f') ? 'var(--color-interactive-secondary)' : '#000',
                    letterSpacing: '0.5px',
                    lineHeight: '1',
                    textShadow: pressedKeys.has('f') ? '0 0 2px rgba(51, 51, 51, 0.8)' : 'none',
                    transition: 'all 0.1s ease, opacity 1.5s ease-in-out'
                  }}>
                    F
                  </div>
                  
                  {/* F# key - T (black key at 89px, width 14px, center at 89+7=96px) */}
                  <div style={{
                    position: 'absolute',
                    left: '96px',
                    top: '35%', // Adjusted to be in upper part of rect
                    transform: 'translate(-50%, -50%)',
                    fontSize: '10px',
                    fontWeight: pressedKeys.has('t') ? '700' : '600',
                    color: pressedKeys.has('t') ? 'var(--color-interactive-secondary)' : '#000',
                    letterSpacing: '0.5px',
                    lineHeight: '1',
                    textShadow: pressedKeys.has('t') ? '0 0 2px rgba(51, 51, 51, 0.8)' : 'none',
                    transition: 'all 0.1s ease, opacity 1.5s ease-in-out'
                  }}>
                    T
                  </div>
                  
                  {/* G key - G (white key 96-120px, center at 108px) */}
                  <div style={{
                    position: 'absolute',
                    left: '108px',
                    top: '65%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '10px',
                    fontWeight: pressedKeys.has('g') ? '700' : '600',
                    color: pressedKeys.has('g') ? 'var(--color-interactive-secondary)' : '#000',
                    letterSpacing: '0.5px',
                    lineHeight: '1',
                    textShadow: pressedKeys.has('g') ? '0 0 2px rgba(51, 51, 51, 0.8)' : 'none',
                    transition: 'all 0.1s ease, opacity 1.5s ease-in-out'
                  }}>
                    G
                  </div>
                  
                  {/* Hide subsequent keys on the last octave */}
                  {activeOctave < lastOctaveWithKeys && (
                    <>
                      {/* G# key - Y (black key at 113px, width 14px, center at 113+7=120px) */}
                      <div style={{
                        position: 'absolute',
                        left: '120px',
                        top: '35%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '10px',
                        fontWeight: pressedKeys.has('y') ? '700' : '600',
                        color: pressedKeys.has('y') ? 'var(--color-interactive-secondary)' : '#000',
                        letterSpacing: '0.5px',
                        lineHeight: '1',
                        textShadow: pressedKeys.has('y') ? '0 0 2px rgba(51, 51, 51, 0.8)' : 'none',
                        transition: 'all 0.1s ease, opacity 1.5s ease-in-out'
                      }}>
                        Y
                      </div>
                      
                      {/* A key - H (white key 120-144px, center at 132px) */}
                      <div style={{
                        position: 'absolute',
                        left: '132px',
                        top: '65%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '10px',
                        fontWeight: pressedKeys.has('h') ? '700' : '600',
                        color: pressedKeys.has('h') ? 'var(--color-interactive-secondary)' : '#000',
                        letterSpacing: '0.5px',
                        lineHeight: '1',
                        textShadow: pressedKeys.has('h') ? '0 0 2px rgba(51, 51, 51, 0.8)' : 'none',
                        transition: 'all 0.1s ease, opacity 1.5s ease-in-out'
                      }}>
                        H
                      </div>
                      
                      {/* A# key - U (black key at 137px, width 14px, center at 137+7=144px) */}
                      <div style={{
                        position: 'absolute',
                        left: '144px',
                        top: '35%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '10px',
                        fontWeight: pressedKeys.has('u') ? '700' : '600',
                        color: pressedKeys.has('u') ? 'var(--color-interactive-secondary)' : '#000',
                        letterSpacing: '0.5px',
                        lineHeight: '1',
                        textShadow: pressedKeys.has('u') ? '0 0 2px rgba(51, 51, 51, 0.8)' : 'none',
                        transition: 'all 0.1s ease, opacity 1.5s ease-in-out'
                      }}>
                        U
                      </div>
                      
                      {/* B key - J (white key 144-168px, center at 159px) */}
                      <div style={{
                        position: 'absolute',
                        left: '159px',
                        top: '65%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '10px',
                        fontWeight: pressedKeys.has('j') ? '700' : '600',
                        color: pressedKeys.has('j') ? 'var(--color-interactive-secondary)' : '#000',
                        letterSpacing: '0.5px',
                        lineHeight: '1',
                        textShadow: pressedKeys.has('j') ? '0 0 2px rgba(51, 51, 51, 0.8)' : 'none',
                        transition: 'all 0.1s ease, opacity 1.5s ease-in-out'
                      }}>
                        J
                      </div>
                    </>
                  )}
                  </div> {/* End of letter keys container */}
                  
                  {/* Octave switching controls */}
                  {/* Z key (octave down) - only show on left side if not at lowest octave */}
                  {activeOctave > -2 && (
                    <div style={{
                      position: 'absolute',
                      left: '4px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '10px',
                      fontWeight: pressedKeys.has('z') ? '700' : '600',
                      color: pressedKeys.has('z') ? 'var(--color-interactive-secondary)' : '#000',
                      letterSpacing: '-0.5px',
                      lineHeight: '1',
                      textShadow: pressedKeys.has('z') ? '0 0 2px rgba(51, 51, 51, 0.8)' : 'none',
                      transition: 'all 0.1s ease, opacity 1.5s ease-in-out'
                    }}>
                      Z ◀
                    </div>
                  )}
                  
                  {/* X key (octave up) - only show on right side if not at highest octave */}
                  {activeOctave < 8 && (
                    <div style={{
                      position: 'absolute',
                      right: '4px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '10px',
                      fontWeight: pressedKeys.has('x') ? '700' : '600',
                      color: pressedKeys.has('x') ? 'var(--color-interactive-secondary)' : '#000',
                      letterSpacing: '-0.5px',
                      lineHeight: '1',
                      textShadow: pressedKeys.has('x') ? '0 0 2px rgba(51, 51, 51, 0.8)' : 'none',
                      transition: 'all 0.1s ease, opacity 1.5s ease-in-out'
                    }}>
                      ▶ X
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
} 