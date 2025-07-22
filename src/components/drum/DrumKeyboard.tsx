import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useWebMidi } from '../../hooks/useWebMidi';
import type { MidiEvent } from '../../utils/midi';
import type { WebMidiState, WebMidiHookReturn } from '../../hooks/useWebMidi';
import { UI_CONSTANTS } from '../../utils/constants';


// Drum key mapping for two octaves (matching legacy)
const drumKeyMap = [
  // Lower octave (octave 0)
  {
    // top row (offset like a real keyboard)
    W: { label: "KD2", idx: 1 }, // index 1 = sample 2
    E: { label: "SD2", idx: 3 }, // index 3 = sample 4
    R: { label: "CLP", idx: 5 }, // index 5 = sample 6
    Y: { label: "CH", idx: 8 },  // index 8 = sample 9
    U: { label: "OH", idx: 10 }, // index 10 = sample 11
    // bottom row
    A: { label: "KD1", idx: 0 },  // index 0 = sample 1
    S: { label: "SD1", idx: 2 },  // index 2 = sample 3
    D: { label: "RIM", idx: 4 },  // index 4 = sample 5
    F: { label: "TB", idx: 6 },   // index 6 = sample 7
    G: { label: "SH", idx: 7 },   // index 7 = sample 8
    H: { label: "CL", idx: 9 },   // index 9 = sample 10
    J: { label: "CAB", idx: 11 }, // index 11 = sample 12
  },
  // Upper octave (octave 1)
  {
    // top row (offset like a real keyboard)
    W: { label: "RC", idx: 12 },  // index 12 = sample 13
    E: { label: "CC", idx: 13 },  // index 13 = sample 14
    R: { label: "COW", idx: 15 }, // index 15 = sample 16
    Y: { label: "LC", idx: 18 },  // index 18 = sample 19
    U: { label: "HC", idx: 19 },  // index 19 = sample 20
    // bottom row
    A: { label: "LT", idx: 14 },  // index 14 = sample 15
    S: { label: "MT", idx: 16 },  // index 16 = sample 17
    D: { label: "HT", idx: 17 },  // index 17 = sample 18
    F: { label: "TRI", idx: 20 }, // index 20 = sample 21
    G: { label: "LT", idx: 21 },  // index 21 = sample 22
    H: { label: "WS", idx: 22 },  // index 22 = sample 23
    J: { label: "GUI", idx: 23 }, // index 23 = sample 24
  },
];

interface DrumKeyboardProps {
  onFileUpload?: (index: number, file: File) => void;
  selectedMidiChannel?: number;
  midiState?: WebMidiState;
  onMidiEventExternal?: WebMidiHookReturn['onMidiEvent'];
}

export function DrumKeyboard({ onFileUpload, selectedMidiChannel, midiState: externalMidiState, onMidiEventExternal }: DrumKeyboardProps = {}) {
  const { state } = useAppContext();
  const [currentOctave, setCurrentOctave] = useState(0);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set()); // Format: "keyChar:octave" e.g., "A:0", "W:1"

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadIndex, setPendingUploadIndex] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const { play } = useAudioPlayer();
  const internalWebMidi = useWebMidi();
  const onMidiEvent = onMidiEventExternal ?? internalWebMidi.onMidiEvent;
  const midiState = externalMidiState ?? internalWebMidi.state;
  
  // Touch/swipe handling for mobile
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;

  // Responsive scaling for mobile keyboard
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Check if user has seen swipe hint before
  useEffect(() => {
    const hasSeenSwipeHint = localStorage.getItem('drum-keyboard-swipe-hint-seen');
    if (!hasSeenSwipeHint && isMobile) {
      setShowSwipeHint(true);
      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setShowSwipeHint(false);
        localStorage.setItem('drum-keyboard-swipe-hint-seen', 'true');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isMobile]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX; // Initialize end position to start position
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = Math.abs(touchStartX.current - touchEndX.current);

    // It's a swipe
    if (distance > minSwipeDistance) {
      const isLeftSwipe = touchStartX.current - touchEndX.current > 0;
      if (isLeftSwipe && currentOctave === 0) {
        setCurrentOctave(1);
      } else if (!isLeftSwipe && currentOctave === 1) {
        setCurrentOctave(0);
      }
    } 
    // It's a tap
    else {
      const touch = e.changedTouches[0];
      const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
      const keyButton = targetElement?.closest('button[data-keychar]');
      
      if (keyButton) {
        const keyChar = keyButton.getAttribute('data-keychar');
        const octaveStr = keyButton.getAttribute('data-octave');
        
        if (keyChar && octaveStr) {
          const octave = parseInt(octaveStr, 10);
          const mapping = drumKeyMap[octave]?.[keyChar as keyof typeof drumKeyMap[0]];
          
          if (mapping) {
            const hasContent = state.drumSamples[mapping.idx]?.isLoaded;
            if (hasContent) {
              playSample(mapping.idx);
            } else {
              openFileBrowser(mapping.idx);
            }

            // brief visual feedback for the tap
            const keyIdentifier = `${keyChar}:${octave}`;
            setPressedKeys(prev => new Set(prev).add(keyIdentifier));
            setTimeout(() => {
              setPressedKeys(prev => {
                const newSet = new Set(prev);
                newSet.delete(keyIdentifier);
                return newSet;
              });
            }, UI_CONSTANTS.VISUAL_FEEDBACK_TIMEOUT);
          }
        }
      }
    }

    // Reset for next touch
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Detect mobile screen size changes
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    let observer: ResizeObserver | null = null;
    if (containerRef.current && 'ResizeObserver' in window) {
      observer = new ResizeObserver(() => handleResize());
      observer.observe(containerRef.current);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer && containerRef.current) observer.disconnect();
    };
  }, [isMobile]);

  // Calculate responsive key width for 7 keys + 6 gaps
  const gap = 1;
  const numKeys = 7;
  const totalGaps = gap * (numKeys - 1); // 6 gaps between 7 keys
  // Use full viewport width for calculation
  const availableWidth = containerWidth;
  const keyWidth = isMobile && containerWidth > 0 ? Math.floor((availableWidth - totalGaps) / numKeys) : 56;

  // Check if MIDI is connected (initialized and has input devices)
  const inputDevices = midiState.devices.filter(device => device.type === 'input' && device.state === 'connected');
  const isMidiConnected = midiState.isInitialized && inputDevices.length > 0;

  const playSample = async (index: number) => {
    const sample = state.drumSamples[index];
    if (!sample?.isLoaded || !sample.audioBuffer) {
      return;
    }
    try {
      await play(sample.audioBuffer, {
        inFrame: sample.inPoint !== undefined ? Math.floor(sample.inPoint * sample.audioBuffer.sampleRate) : 0,
        outFrame: sample.outPoint !== undefined ? Math.floor(sample.outPoint * sample.audioBuffer.sampleRate) : sample.audioBuffer.length,
        playbackRate: Math.pow(2, (sample.tune || 0) / 12),
        gain: sample.gain || 0,
        pan: sample.pan || 0,
        reverse: sample.reverse || false,
      });
    } catch (error) {
      console.error('Error playing sample:', error);
    }
  };

  const getDrumIdxForKey = (key: string) => {
    const mapping = drumKeyMap[currentOctave][key as keyof typeof drumKeyMap[0]];
    return mapping ? mapping.idx : null;
  };

  const openFileBrowser = (index: number) => {
    setPendingUploadIndex(index);
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingUploadIndex !== null && onFileUpload) {
      onFileUpload(pendingUploadIndex, file);
      setPendingUploadIndex(null);
    }
    // Reset the input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).contentEditable === 'true'
      );
      
      if (isTyping) return;

      const key = e.key.toUpperCase();
      
      // Handle octave switching
      if (key === 'Z') {
        setCurrentOctave(0);
        return;
      }
      if (key === 'X') {
        setCurrentOctave(1);
        return;
      }

      // Handle sample playback
      const idx = getDrumIdxForKey(key);
      if (idx !== null && state.drumSamples[idx]) {
        playSample(idx);
        setPressedKeys(prev => new Set(prev).add(`${key}:${currentOctave}`));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      setPressedKeys(prev => {
        const newSet = new Set(prev);
        // Remove the key from both octaves since we don't know which one was pressed
        newSet.delete(`${key}:0`);
        newSet.delete(`${key}:1`);
        return newSet;
      });
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentOctave, state.drumSamples]);

  // MIDI event handling
  const handleMidiEvent = useCallback((event: MidiEvent) => {
    if (event.type === 'noteon' && event.velocity > 0) {
      const note = event.note;

      
      // Map MIDI note to drum sample index
      const drumIndex = getDrumIndexFromMidiNote(note);
      if (drumIndex !== null) {
        // Determine which octave this note belongs to and switch if needed
        const isUpperOctave = drumIndex >= 12;
        if (isUpperOctave && currentOctave !== 1) {
          setCurrentOctave(1);
        } else if (!isUpperOctave && currentOctave !== 0) {
          setCurrentOctave(0);
        }
        playSample(drumIndex);
        // Add visual feedback by finding the key character and octave
        const keyChar = getKeyCharFromDrumIndex(drumIndex);
        if (keyChar) {
          const keyOctave = isUpperOctave ? 1 : 0;
          setPressedKeys(prev => new Set([...prev, `${keyChar}:${keyOctave}`]));
        }
      } else {
        // No drum mapping found for note
      }
    } else if (event.type === 'noteoff') {
      const note = event.note;
      const drumIndex = getDrumIndexFromMidiNote(note);
      if (drumIndex !== null) {
        const keyChar = getKeyCharFromDrumIndex(drumIndex);
        if (keyChar) {
          const keyOctave = drumIndex >= 12 ? 1 : 0;
          setPressedKeys(prev => {
            const newSet = new Set(prev);
            newSet.delete(`${keyChar}:${keyOctave}`);
            return newSet;
          });
        }
      }
    }
  }, [playSample, currentOctave]);

  // Helper function to map MIDI note to drum index
  const getDrumIndexFromMidiNote = (note: number): number | null => {
    // Lower octave (octave 0) - F3 to F4
    const lowerOctaveMap: { [key: number]: number } = {
      53: 0,  // F3  -> KD1 (A key)
      54: 1,  // F#3 -> KD2 (W key) 
      55: 2,  // G3  -> SD1 (S key)
      56: 3,  // G#3 -> SD2 (E key)
      57: 4,  // A3  -> RIM (D key)
      58: 5,  // A#3 -> CLP (R key)
      59: 6,  // B3  -> TB (F key)
      60: 7,  // C4  -> SH (G key) - Middle C
      61: 8,  // C#4 -> CH (Y key)
      62: 9,  // D4  -> CL (H key)
      63: 10, // D#4 -> OH (U key)
      64: 11, // E4  -> CAB (J key)
    };
    
    // Upper octave (octave 1) - F4 to E5
    const upperOctaveMap: { [key: number]: number } = {
      65: 14, // F4  -> LT (A key, octave 1)
      66: 12, // F#4 -> RC (W key, octave 1)
      67: 16, // G4  -> MT (S key, octave 1)
      68: 13, // G#4 -> CC (E key, octave 1)
      69: 17, // A4  -> HT (D key, octave 1)
      70: 15, // A#4 -> COW (R key, octave 1)
      71: 20, // B4  -> TRI (F key, octave 1)
      72: 21, // C5  -> LT (G key, octave 1) - using different LT key to avoid conflict with F
      73: 18, // C#5 -> LC (Y key, octave 1)
      74: 22, // D5  -> WS (H key, octave 1)
      75: 19, // D#5 -> HC (U key, octave 1)
      76: 23, // E5  -> GUI (J key, octave 1)
    };
    
    return lowerOctaveMap[note] ?? upperOctaveMap[note] ?? null;
  };

  // Helper function to get key character from drum index
  const getKeyCharFromDrumIndex = (drumIndex: number): string | null => {
    // Lower octave (octave 0)
    const lowerOctaveKeys: { [key: number]: string } = {
      0: 'A',   // KD1
      1: 'W',   // KD2
      2: 'S',   // SD1
      3: 'E',   // SD2
      4: 'D',   // RIM
      5: 'R',   // CLP
      6: 'F',   // TB
      7: 'G',   // SH
      8: 'Y',   // CH
      9: 'H',   // CL
      10: 'U',  // OH
      11: 'J',  // CAB
    };
    
    // Upper octave (octave 1)
    const upperOctaveKeys: { [key: number]: string } = {
      12: 'W',  // RC
      13: 'E',  // CC
      14: 'A',  // LT
      15: 'R',  // COW
      16: 'S',  // MT
      17: 'D',  // HT
      18: 'Y',  // LC
      19: 'U',  // HC
      20: 'F',  // TRI
      21: 'G',  // LT
      22: 'H',  // WS
      23: 'J',  // GUI
    };
    
    return lowerOctaveKeys[drumIndex] ?? upperOctaveKeys[drumIndex] ?? null;
  };

  // Set up MIDI event listener - only when drum tab is active
  useEffect(() => {
    // Only set up MIDI listener if drum tab is active
    if (state.currentTab !== 'drum') {
      return;
    }

    if (isMidiConnected && selectedMidiChannel) {
      const cleanup = onMidiEvent(handleMidiEvent, selectedMidiChannel); // Listen on selected channel only
      
      // Cleanup function
      return () => {
        cleanup();
      };
    } else if (!isMidiConnected) {
      // No MIDI devices connected
    } else if (!selectedMidiChannel) {
      // No MIDI channel selected
    }
  }, [isMidiConnected, selectedMidiChannel, onMidiEvent, handleMidiEvent, midiState.devices, state.currentTab]);

  // Helper functions to create common OPXYKey props
  const createKeyProps = (keyChar: string, octave: number, isLarge = false, circleOffset: 'left' | 'right' | 'center' = 'center') => {
    const mapping = drumKeyMap[octave][keyChar as keyof typeof drumKeyMap[0]];
    return {
      keyChar,
      mapping,
      octave, // Add the octave to the props
      isPressed: pressedKeys.has(`${keyChar}:${octave}`), // Show pressed state for specific key+octave combination
      isLarge,
      circleOffset,
      isActiveOctave: currentOctave === octave,
      showKeyboardLabels: currentOctave === octave && !isMidiConnected,
      isMobile,
      keyWidth
    };
  };

  const createStandardKeyProps = (keyChar: string, octave: number) => 
    createKeyProps(keyChar, octave, false, 'center');

  const createLargeKeyProps = (keyChar: string, octave: number, circleOffset: 'left' | 'right') => 
    createKeyProps(keyChar, octave, true, circleOffset);

  // OP-XY key component with exact 1:1 and 1:1.5 ratios
  const OPXYKey = ({ 
    keyChar, 
    mapping, 
    octave, // Add octave to the props
    isPressed, 
    isLarge = false,
    circleOffset = 'center', // 'left', 'right', or 'center'
    isActiveOctave = true,
    showKeyboardLabels = true,
    isMobile = false,
    keyWidth = 56
  }: { 
    keyChar: string; 
    mapping?: { label: string; idx: number }; 
    octave: number; // Add octave to the type
    isPressed: boolean;
    isLarge?: boolean;
    circleOffset?: 'left' | 'right' | 'center';
    isActiveOctave?: boolean;
    showKeyboardLabels?: boolean;
    isMobile?: boolean;
    keyWidth?: number;
  }) => {
    const hasContent = mapping && state.drumSamples[mapping.idx]?.isLoaded;
    const isActive = hasContent; // Key is only active when it has content
    
    // This function contains the core action for the key
    const handleActivate = () => {
      if (!mapping) return;
      if (isActive) {
        playSample(mapping.idx);
      } else {
        openFileBrowser(mapping.idx);
      }
    };

    // Use keyWidth for all proportional sizing
    const baseSize = keyWidth;
    const width = isLarge ? baseSize * 1.5 + (keyChar === 'W' || keyChar === 'U' ? 1 : 0) : baseSize;
    const height = baseSize;
    const circleSize = baseSize * (35/56);
    const outerRingSize = baseSize * (52/56); // Scale outer ring too
    
    let circleStyle: React.CSSProperties = {
      position: 'absolute',
      width: `${circleSize}px`,
      height: `${circleSize}px`,
      borderRadius: '50%',
      background: !isActive ? 'var(--color-key-inactive-black-bg)' : (isPressed && isActiveOctave ? 'var(--color-text-secondary)' : 'var(--color-interactive-dark)'),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
      top: '50%',
      transform: 'translateY(-50%)',
      left: '50%',
      marginLeft: `-${circleSize / 2}px` // Half of width to center
    };

    const letterStyle = {
      fontSize: '0.7rem',
      fontWeight: 'bold',
      color: 'var(--color-text-secondary)',
      textAlign: 'center' as const,
      lineHeight: '1',
      userSelect: 'none' as const,
      pointerEvents: 'none' as const,
    };

    // Apply offsets for large keys
    if (isLarge && circleOffset !== 'center') {
      if (circleOffset === 'right') {
        // W and U keys - right aligned
        circleStyle = {
          ...circleStyle,
          left: 'auto',
          right: '2px', // Account for outer ring size
          marginLeft: '0',
          transform: 'translateY(-50%)' // Keep vertical centering
        };
      } else if (circleOffset === 'left') {
        // R and Y keys - left aligned  
        circleStyle = {
          ...circleStyle,
          left: '2px', // Account for outer ring size
          marginLeft: '0',
          transform: 'translateY(-50%)' // Keep vertical centering
        };
      }
    }

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0px'
      }}>
        
        {/* Key button */}
        <button
          // data attributes are used by the mobile touch handler
          data-keychar={keyChar}
          data-octave={octave}
          // an empty onClick is for accessibility, but we prevent double-firing
          onClick={(e) => { e.preventDefault(); }}
          
          // --- MOUSE & PEN EVENTS ---
          onPointerDown={(e) => {
            // This handler is for MOUSE ONLY to preserve press-and-hold.
            // Touch is handled by the container.
            if (e.pointerType !== 'mouse') return;
            handleActivate();
            setPressedKeys(prev => new Set(prev).add(`${keyChar}:${octave}`));
          }}
          onPointerUp={(e) => {
            if (e.pointerType !== 'mouse') return;
            setPressedKeys(prev => {
              const newSet = new Set(prev);
              newSet.delete(`${keyChar}:${octave}`);
              return newSet;
            });
          }}
          onMouseLeave={(e) => {
            // Also clear visual state if mouse leaves while pressed down
            if (e.buttons === 1) { // 1 means left mouse button is down
              setPressedKeys(prev => {
                const newSet = new Set(prev);
                newSet.delete(`${keyChar}:${octave}`);
                return newSet;
              });
            }
          }}
          
          // --- KEYBOARD EVENTS ---
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleActivate();
              setPressedKeys(prev => new Set(prev).add(`${keyChar}:${octave}`));
            }
          }}
          onKeyUp={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setPressedKeys(prev => {
                const newSet = new Set(prev);
                newSet.delete(`${keyChar}:${octave}`);
                return newSet;
              });
            }
          }}
          
          // --- DRAG & DROP AND ACCESSIBILITY ---
          tabIndex={0}
          role="button"
          aria-label={`${mapping ? mapping.label : 'Empty'} drum key ${keyChar.toUpperCase()}`}
          aria-pressed={isPressed}
          aria-describedby={mapping ? `drum-key-${mapping.idx}-${octave}` : undefined}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Add visual feedback for drag over
            e.currentTarget.style.background = 'var(--color-key-inactive-black-bg)';
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
            e.currentTarget.style.borderColor = 'var(--color-black)';
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Remove visual feedback
            e.currentTarget.style.background = !isActive ? 'var(--color-key-inactive-white-bg)' : (isPressed ? '#bdbdbd' : 'var(--color-keyboard-key-active-bg)');
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = isActive ? '0 4px 12px rgba(0, 0, 0, 0.18)' : '0 2px 6px rgba(0, 0, 0, 0.1)';
            e.currentTarget.style.borderColor = !isActive ? 'var(--color-key-inactive-border)' : 'var(--color-black)';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Remove visual feedback
            e.currentTarget.style.background = !isActive ? 'var(--color-key-inactive-white-bg)' : (isPressed ? '#bdbdbd' : 'var(--color-keyboard-key-active-bg)');
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = isActive ? '0 4px 12px rgba(0, 0, 0, 0.18)' : '0 2px 6px rgba(0, 0, 0, 0.1)';
            e.currentTarget.style.borderColor = !isActive ? 'var(--color-key-inactive-border)' : 'var(--color-black)';
            
            const files = Array.from(e.dataTransfer.files);
            const audioFile = files.find(file => 
              file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.wav')
            );
            
            if (audioFile && mapping && onFileUpload) {
              onFileUpload(mapping.idx, audioFile);
            }
          }}
          style={{
            position: 'relative',
            width: `${width}px`,
            height: `${height}px`,
            margin: '0',
            padding: '0',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            transition: 'all 0.1s ease',
            background: !isActive ? 'var(--color-key-inactive-white-bg)' : (isPressed ? '#bdbdbd' : 'var(--color-keyboard-key-active-bg)'),
            boxShadow: isActive ? '0 4px 12px rgba(0, 0, 0, 0.18)' : '0 2px 6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none'
          }}
          onFocus={(e) => {
            // Add focus ring for keyboard navigation
            e.currentTarget.style.outline = '2px solid var(--color-interactive-focus)';
            e.currentTarget.style.outlineOffset = '2px';
          }}
          onBlur={(e) => {
            // Remove focus ring
            e.currentTarget.style.outline = 'none';
          }}
        >
          {/* Outer ring around black circle */}
          <div style={{
            ...circleStyle,
            width: `${outerRingSize}px`,
            height: `${outerRingSize}px`,
            background: 'transparent',
            border: !isActive ? '1px solid var(--color-key-inactive-border)' : '1px solid var(--color-black)',
            marginLeft: circleStyle.marginLeft === '0' ? '0' : `-${outerRingSize / 2}px` // Conditional centering
          }}>
            {/* Inner black circle */}
            <div style={{
              width: `${circleSize}px`,
              height: `${circleSize}px`,
              borderRadius: '50%',
              background: !isActive ? 'var(--color-key-inactive-black-bg)' : 'var(--color-black)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              {/* Computer key label - always visible when active octave */}
              {showKeyboardLabels && !isMobile && (
                <div style={{
                  ...letterStyle,
                  color: !isActive ? 'var(--color-text-secondary)' : '#fff'
                }}>
                  {keyChar.toUpperCase()}
                </div>
              )}
            </div>
          </div>
          
          {/* Drum label overlay - always visible */}
          {mapping && (
            <div style={{
              position: 'absolute',
              top: '2px',
              left: '2px',
              right: '2px',
              bottom: '2px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              pointerEvents: 'none',
              zIndex: 2
            }}>
              <div 
                id={`drum-key-${mapping.idx}-${octave}`}
                style={{
                  backgroundColor: 'var(--color-border-primary)', // slate from theme
                  color: '#fff', // white text
                  fontSize: `${baseSize * (9/56)}px`,
                  fontWeight: '600',
                  padding: `${baseSize * (2/56)}px ${baseSize * (4/56)}px`,
                  borderRadius: '2px',
                  lineHeight: '1',
                  letterSpacing: '0.5px'
                }}
              >
                {mapping.label}
              </div>
            </div>
          )}
        </button>
      </div>
    );
  };

  return (
    <div 
      role="group"
      aria-label="Drum keyboard"
      style={{ 
        fontFamily: '"Montserrat", "Arial", sans-serif',
        userSelect: 'none'
      }}
    >
      {/* Hidden file input for browsing files */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.wav"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      
      {/* Mobile Layout - Single Octave with Swipe */}
      {isMobile ? (
        <>
          <div 
            style={{
              padding: '3px',
              background: 'transparent',
              border: '1px solid #ddd',
              borderRadius: '6px',
              boxSizing: 'border-box',
              width: '100%',
              boxShadow: '0 2px 8px var(--color-shadow-primary)',
              position: 'relative',
              marginBottom: '8px' // even less space for dots below
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Swipe Hint Overlay */}
            {showSwipeHint && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 20,
                borderRadius: '6px'
              }}>
                <div style={{
                  background: 'var(--color-bg-primary)',
                  padding: '16px',
                  borderRadius: '6px',
                  textAlign: 'center',
                  maxWidth: '280px',
                  margin: '0 16px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginBottom: '12px'
                  }}>
                    <span style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem', fontWeight: '500' }}>swipe to change octaves</span>
                  </div>
                  <button
                    onClick={() => {
                      setShowSwipeHint(false);
                      localStorage.setItem('drum-keyboard-swipe-hint-seen', 'true');
                    }}
                    style={{
                      background: 'var(--color-interactive-focus)',
                      color: 'var(--color-bg-primary)',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '3px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    got it
                  </button>
                </div>
              </div>
            )}

            {/* Viewport for clipping */}
            <div 
              ref={containerRef}
              style={{
                position: 'relative',
                overflow: 'hidden',
                width: '100%',
                background: 'transparent'
              }}>
              {/* Sliding track */}
              <div style={{
                display: 'flex',
                width: '200%',
                transform: `translateX(${currentOctave === 0 ? '0' : '-50%'})`,
                transition: 'transform 0.3s ease-out'
              }}>
                {/* Octave 0 Panel */}
                <div 
                  role="group"
                  aria-label="Lower octave drum keys"
                  style={{ width: '50%', flexShrink: 0 }}
                >
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1px'
                  }}>
                    {/* Top row */}
                    <div style={{ display: 'flex', gap: '1px' }}>
                      <OPXYKey {...createLargeKeyProps('W', 0, 'right')} />
                      <OPXYKey {...createStandardKeyProps('E', 0)} />
                      <OPXYKey {...createLargeKeyProps('R', 0, 'left')} />
                      <OPXYKey {...createLargeKeyProps('Y', 0, 'right')} />
                      <OPXYKey {...createLargeKeyProps('U', 0, 'left')} />
                    </div>
                    {/* Bottom row */}
                    <div style={{ display: 'flex', gap: '1px' }}>
                      {['A', 'S', 'D', 'F', 'G', 'H', 'J'].map(key => (
                        <OPXYKey key={`octave0-mobile-${key}`} {...createStandardKeyProps(key, 0)} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Octave 1 Panel */}
                <div 
                  role="group"
                  aria-label="Upper octave drum keys"
                  style={{ width: '50%', flexShrink: 0 }}
                >
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1px'
                  }}>
                    {/* Top row */}
                    <div style={{ display: 'flex', gap: '1px' }}>
                      <OPXYKey {...createLargeKeyProps('W', 1, 'right')} />
                      <OPXYKey {...createStandardKeyProps('E', 1)} />
                      <OPXYKey {...createLargeKeyProps('R', 1, 'left')} />
                      <OPXYKey {...createLargeKeyProps('Y', 1, 'right')} />
                      <OPXYKey {...createLargeKeyProps('U', 1, 'left')} />
                    </div>
                    {/* Bottom row */}
                    <div style={{ display: 'flex', gap: '1px' }}>
                      {['A', 'S', 'D', 'F', 'G', 'H', 'J'].map(key => (
                        <OPXYKey key={`octave1-mobile-${key}`} {...createStandardKeyProps(key, 1)} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Swipe Indicator Dots - now outside the keyboard border */}
          <div style={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: '-2px', // very tight to keyboard border
            marginBottom: '0px',
            zIndex: 1
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: currentOctave === 0 ? 'var(--color-text-secondary)' : 'var(--color-border-light)',
              transition: 'background-color 0.3s ease',
              margin: '0 4px'
            }}></div>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: currentOctave === 1 ? 'var(--color-text-secondary)' : 'var(--color-border-light)',
              transition: 'background-color 0.3s ease',
              margin: '0 4px'
            }}></div>
          </div>
        </>
      ) : (
        /* Desktop Layout - Both Octaves Side by Side */
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          margin: '1px',
          width: 'calc(100% - 2px)',
          padding: '1rem'
        }}>
          <div style={{
            display: 'inline-flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '1px',
            padding: '3px',
            background: '#f8f9fa',
            border: '1px solid #ddd',
            borderRadius: '6px',
            overflow: 'hidden',
            boxSizing: 'border-box',
            boxShadow: '0 2px 8px var(--color-shadow-primary)'
          }}>
          {/* Octave 1 (Lower) */}
          <div 
            role="group"
            aria-label="Lower octave drum keys"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1px',
              position: 'relative'
            }}
          >
            
            {/* Top row */}
            <div style={{ 
              display: 'flex', 
              gap: '1px', 
              alignItems: 'flex-end',
              width: '100%',
              maxWidth: '100%',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              <OPXYKey {...createLargeKeyProps('W', 0, 'right')} />
              <OPXYKey {...createStandardKeyProps('E', 0)} />
              <OPXYKey {...createLargeKeyProps('R', 0, 'left')} />
              <OPXYKey {...createLargeKeyProps('Y', 0, 'right')} />
              <OPXYKey {...createLargeKeyProps('U', 0, 'left')} />
            </div>

            {/* Bottom row */}
            <div style={{ 
              display: 'flex', 
              gap: '1px',
              alignItems: 'flex-start',
              width: '100%',
              maxWidth: '100%',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              {['A', 'S', 'D', 'F', 'G', 'H', 'J'].map(key => (
                <OPXYKey
                  key={`octave0-${key}`}
                  {...createStandardKeyProps(key, 0)}
                />
              ))}
            </div>
          </div>

          {/* Octave 2 (Upper) */}
          <div 
            role="group"
            aria-label="Upper octave drum keys"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1px',
              position: 'relative'
            }}
          >
            
            {/* Top row */}
            <div style={{ 
              display: 'flex', 
              gap: '1px', 
              alignItems: 'flex-end',
              width: '100%',
              maxWidth: '100%',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              <OPXYKey {...createLargeKeyProps('W', 1, 'right')} />
              <OPXYKey {...createStandardKeyProps('E', 1)} />
              <OPXYKey {...createLargeKeyProps('R', 1, 'left')} />
              <OPXYKey {...createLargeKeyProps('Y', 1, 'right')} />
              <OPXYKey {...createLargeKeyProps('U', 1, 'left')} />
            </div>

            {/* Bottom row */}
            <div style={{ 
              display: 'flex', 
              gap: '1px',
              alignItems: 'flex-start',
              width: '100%',
              maxWidth: '100%',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              {['A', 'S', 'D', 'F', 'G', 'H', 'J'].map(key => (
                <OPXYKey
                  key={`octave1-${key}`}
                  {...createStandardKeyProps(key, 1)}
                />
              ))}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
} 