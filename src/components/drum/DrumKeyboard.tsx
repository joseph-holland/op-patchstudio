import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { audioContextManager } from '../../utils/audioContext';

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
}

export function DrumKeyboard({ onFileUpload }: DrumKeyboardProps = {}) {
  const { state } = useAppContext();
  const [currentOctave, setCurrentOctave] = useState(0);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadIndex, setPendingUploadIndex] = useState<number | null>(null);

  const playSample = async (index: number) => {
    const sample = state.drumSamples[index];
    if (!sample?.isLoaded || !sample.audioBuffer) return;

    try {
      const audioContext = await audioContextManager.getAudioContext();
      const source = audioContext.createBufferSource();
      source.buffer = sample.audioBuffer;
      source.connect(audioContext.destination);
      source.start(0);
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
        setPressedKeys(prev => new Set(prev).add(key));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      setPressedKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
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

  // OP-XY key component with exact 1:1 and 1:1.5 ratios
  const OPXYKey = ({ 
    keyChar, 
    mapping, 
    isPressed, 
    isLarge = false,
    circleOffset = 'center', // 'left', 'right', or 'center'
    isActiveOctave = true,
    showKeyboardLabels = true
  }: { 
    keyChar: string; 
    mapping?: { label: string; idx: number }; 
    isPressed: boolean;
    isLarge?: boolean;
    circleOffset?: 'left' | 'right' | 'center';
    isActiveOctave?: boolean;
    showKeyboardLabels?: boolean;
  }) => {
    const hasContent = mapping && state.drumSamples[mapping.idx]?.isLoaded;
    const isActive = hasContent; // Key is only active when it has content
    
    // Key dimensions - using desktop size for all devices
    const baseSize = 56; // Desktop size
    const keyWidth = isLarge ? `${Math.round(baseSize * 1.5) + (keyChar === 'W' || keyChar === 'U' ? 1 : 0)}px` : `${baseSize}px`;
    const keyHeight = `${baseSize}px`;
    
    // Circle positioning based on offset
    const circleSize = 35; // Desktop size
    const fontSize = 21; // Desktop size
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

    let letterStyle: React.CSSProperties = {
      color: '#fff',
      fontSize: `${fontSize}px`,
      fontWeight: 'normal',
      pointerEvents: 'none'
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
          onClick={() => {
            if (mapping) {
              if (isActive) {
                // Play sample if key has content
                playSample(mapping.idx);
              } else {
                // Open file browser if key is empty
                openFileBrowser(mapping.idx);
              }
            }
          }}
          onMouseDown={() => {
            if (!isActive || !mapping) return; // Only simulate key events for active keys with samples
            // Simulate key press for mouse clicks
            const syntheticEvent = new KeyboardEvent('keydown', { key: keyChar });
            document.dispatchEvent(syntheticEvent);
          }}
          onMouseUp={() => {
            if (!isActive || !mapping) return; // Only simulate key events for active keys with samples
            // Simulate key release for mouse clicks
            const syntheticEvent = new KeyboardEvent('keyup', { key: keyChar });
            document.dispatchEvent(syntheticEvent);
          }}
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
            e.currentTarget.style.background = !isActive ? 'var(--color-key-inactive-white-bg)' : (isPressed ? '#bdbdbd' : 'var(--color-text-primary)');
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = isActive ? '0 4px 12px rgba(0, 0, 0, 0.18)' : '0 2px 6px rgba(0, 0, 0, 0.1)';
            e.currentTarget.style.borderColor = !isActive ? 'var(--color-key-inactive-border)' : 'var(--color-black)';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Remove visual feedback
            e.currentTarget.style.background = !isActive ? 'var(--color-key-inactive-white-bg)' : (isPressed ? '#bdbdbd' : 'var(--color-text-primary)');
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
            width: keyWidth,
            height: keyHeight,
            margin: '0',
            padding: '0',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            transition: 'all 0.1s ease',
            background: !isActive ? 'var(--color-key-inactive-white-bg)' : (isPressed ? '#bdbdbd' : 'var(--color-text-primary)'),
            boxShadow: isActive ? '0 4px 12px rgba(0, 0, 0, 0.18)' : '0 2px 6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            if (!isActive || isPressed) return;
            e.currentTarget.style.background = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            if (!isActive || isPressed) return;
            e.currentTarget.style.background = 'var(--color-text-primary)';
          }}
        >
          {/* Outer ring around black circle */}
          <div style={{
            ...circleStyle,
            width: '52px',
            height: '52px',
            background: 'transparent',
            border: !isActive ? '1px solid var(--color-key-inactive-border)' : '1px solid var(--color-black)',
            marginLeft: circleStyle.marginLeft === '0' ? '0' : '-26px' // Conditional centering
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
              {showKeyboardLabels && (
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
              <div style={{
                background: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-light)',
                color: 'var(--color-white)',
                fontSize: '9px',
                fontWeight: '600',
                padding: '2px 4px',
                borderRadius: '2px',
                lineHeight: '1',
                letterSpacing: '0.5px'
              }}>
                {mapping.label}
              </div>
            </div>
          )}
        </button>
      </div>
    );
  };

  return (
    <div style={{ 
      fontFamily: '"Montserrat", "Arial", sans-serif',
      userSelect: 'none'
    }}>
      {/* Hidden file input for browsing files */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.wav"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      {/* OP-XY Keyboard Layout - Always Side by Side */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        margin: '0 auto 0.5rem'
      }}>
        <div style={{
          display: 'inline-flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '1px',
          padding: '3px',
          background: '#f8f9fa',
          border: '1px solid #ddd',
          borderRadius: '6px'
        }}>
        {/* Octave 1 (Lower) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1px',
          position: 'relative'
        }}>
          
          {/* Top row */}
          <div style={{ 
            display: 'flex', 
            gap: '1px', 
            alignItems: 'flex-end'
          }}>
            <OPXYKey
              keyChar="W"
              mapping={drumKeyMap[0].W}
              isPressed={currentOctave === 0 && pressedKeys.has('W')}
              isLarge={true}
              circleOffset="right"
              isActiveOctave={currentOctave === 0}
              showKeyboardLabels={currentOctave === 0}
            />
            <OPXYKey
              keyChar="E"
              mapping={drumKeyMap[0].E}
              isPressed={currentOctave === 0 && pressedKeys.has('E')}
              isActiveOctave={currentOctave === 0}
              showKeyboardLabels={currentOctave === 0}
            />
            <OPXYKey
              keyChar="R"
              mapping={drumKeyMap[0].R}
              isPressed={currentOctave === 0 && pressedKeys.has('R')}
              isLarge={true}
              circleOffset="left"
              isActiveOctave={currentOctave === 0}
              showKeyboardLabels={currentOctave === 0}
            />
            <OPXYKey
              keyChar="Y"
              mapping={drumKeyMap[0].Y}
              isPressed={currentOctave === 0 && pressedKeys.has('Y')}
              isLarge={true}
              circleOffset="left"
              isActiveOctave={currentOctave === 0}
              showKeyboardLabels={currentOctave === 0}
            />
            <OPXYKey
              keyChar="U"
              mapping={drumKeyMap[0].U}
              isPressed={currentOctave === 0 && pressedKeys.has('U')}
              isLarge={true}
              circleOffset="right"
              isActiveOctave={currentOctave === 0}
              showKeyboardLabels={currentOctave === 0}
            />
          </div>

          {/* Bottom row */}
          <div style={{ 
            display: 'flex', 
            gap: '1px',
            alignItems: 'flex-start'
          }}>
            {['A', 'S', 'D', 'F', 'G', 'H', 'J'].map(key => (
              <OPXYKey
                key={`octave0-${key}`}
                keyChar={key}
                mapping={drumKeyMap[0][key as keyof typeof drumKeyMap[0]]}
                isPressed={currentOctave === 0 && pressedKeys.has(key)}
                isActiveOctave={currentOctave === 0}
                showKeyboardLabels={currentOctave === 0}
              />
            ))}
          </div>
        </div>

        {/* Octave 2 (Upper) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1px',
          position: 'relative'
        }}>
          
          {/* Top row */}
          <div style={{ 
            display: 'flex', 
            gap: '1px', 
            alignItems: 'flex-end'
          }}>
            <OPXYKey
              keyChar="W"
              mapping={drumKeyMap[1].W}
              isPressed={currentOctave === 1 && pressedKeys.has('W')}
              isLarge={true}
              circleOffset="right"
              isActiveOctave={currentOctave === 1}
              showKeyboardLabels={currentOctave === 1}
            />
            <OPXYKey
              keyChar="E"
              mapping={drumKeyMap[1].E}
              isPressed={currentOctave === 1 && pressedKeys.has('E')}
              isActiveOctave={currentOctave === 1}
              showKeyboardLabels={currentOctave === 1}
            />
            <OPXYKey
              keyChar="R"
              mapping={drumKeyMap[1].R}
              isPressed={currentOctave === 1 && pressedKeys.has('R')}
              isLarge={true}
              circleOffset="left"
              isActiveOctave={currentOctave === 1}
              showKeyboardLabels={currentOctave === 1}
            />
            <OPXYKey
              keyChar="Y"
              mapping={drumKeyMap[1].Y}
              isPressed={currentOctave === 1 && pressedKeys.has('Y')}
              isLarge={true}
              circleOffset="left"
              isActiveOctave={currentOctave === 1}
              showKeyboardLabels={currentOctave === 1}
            />
            <OPXYKey
              keyChar="U"
              mapping={drumKeyMap[1].U}
              isPressed={currentOctave === 1 && pressedKeys.has('U')}
              isLarge={true}
              circleOffset="right"
              isActiveOctave={currentOctave === 1}
              showKeyboardLabels={currentOctave === 1}
            />
          </div>

          {/* Bottom row */}
          <div style={{ 
            display: 'flex', 
            gap: '1px',
            alignItems: 'flex-start'
          }}>
            {['A', 'S', 'D', 'F', 'G', 'H', 'J'].map(key => (
              <OPXYKey
                key={`octave1-${key}`}
                keyChar={key}
                mapping={drumKeyMap[1][key as keyof typeof drumKeyMap[1]]}
                isPressed={currentOctave === 1 && pressedKeys.has(key)}
                isActiveOctave={currentOctave === 1}
                showKeyboardLabels={currentOctave === 1}
              />
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
} 