import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { DrumKeyboard } from './DrumKeyboard';
import { EnhancedTooltip } from '../common/EnhancedTooltip';
import { MidiDeviceSelector } from '../common/MidiDeviceSelector';
import { cookieUtils, COOKIE_KEYS } from '../../utils/cookies';
import { useWebMidi } from '../../hooks/useWebMidi';
import type { MidiEvent } from '../../utils/midi';

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
  const [selectedMidiChannel, setSelectedMidiChannel] = useState(() => {
    const saved = localStorage.getItem('midi-channel');
    const parsed = saved ? parseInt(saved, 10) : NaN;
    // Clamp to 1-16; if invalid, default to 1
    return parsed >= 1 && parsed <= 16 ? parsed : 1;
  });

  // Persist selected MIDI channel to localStorage whenever it changes
  useEffect(() => {
    if (selectedMidiChannel >= 1 && selectedMidiChannel <= 16) {
      localStorage.setItem('midi-channel', selectedMidiChannel.toString());
    }
  }, [selectedMidiChannel]);

  // Pin state with cookie persistence
  const [isDrumKeyboardPinned, setIsDrumKeyboardPinned] = useState(() => {
    const saved = cookieUtils.getCookie(COOKIE_KEYS.DRUM_KEYBOARD_PINNED);
    return saved === 'true';
  });

  // MIDI event handling
  const { onMidiEvent, state: midiState, initialize } = useWebMidi();
  const [isMidiSelectorVisible, setIsMidiSelectorVisible] = useState(false);

  // Auto-initialize MIDI if not already initialized
  useEffect(() => {
    if (!midiState.isInitialized && !midiState.isConnecting) {
      initialize();
    }
  }, [midiState.isInitialized, midiState.isConnecting, initialize]);

  // Function to hide MIDI selector
  const hideMidiSelector = () => {
    setIsMidiSelectorVisible(false);
    const midiSelector = document.querySelector('.midi-device-selector') as HTMLElement;
    if (midiSelector) {
      midiSelector.style.display = 'none';
    }
  };

  // Listen for MIDI note events and hide selector
  useEffect(() => {
    const handleMidiNote = (event: MidiEvent) => {
      if (event.type === 'noteon' && event.velocity > 0) {
        // Hide MIDI selector and collapse panel when a note is played
        hideMidiSelector();
      }
    };

    const cleanup = onMidiEvent(handleMidiNote);
    return () => cleanup();
  }, [onMidiEvent]);

  const loadedSamplesCount = state.drumSamples.filter(sample => sample && sample.isLoaded).length;

  const togglePin = () => {
    const newPinnedState = !isDrumKeyboardPinned;
    setIsDrumKeyboardPinned(newPinnedState);
    
    // If unpinning while stuck, reset stuck state without scrolling
    if (!newPinnedState && isStuck) {
      setDynamicStyles({});
      setIsStuck(false);
    }
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
      <h3>keyboard controls</h3>
      <p><strong>load:</strong> tap empty keys to browse and select files</p>
      <p><strong>play:</strong> tap keys to play loaded samples</p>
      <p><strong>pin:</strong> use the pin icon to keep the keyboard at the top of the screen</p>
    </>
  ) : (
    <>
      <h3>keyboard controls</h3>
      <p><strong>load:</strong> click empty keys to browse files or drag and drop audio files directly onto any key</p>
      <p><strong>play:</strong> use keyboard keys (<strong>A-J, W, E, R, Y, U</strong>) to trigger samples and <strong>Z</strong> / <strong>X</strong> to switch octaves</p>
      <p><strong>pin:</strong> use the pin icon to keep the keyboard at the top of the screen</p>
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
            padding: isMobile ? '0.5rem 1rem 0.5rem 1rem' : '0.7rem 1rem 0.5rem 1rem',
            borderBottom: '1px solid var(--color-border-medium)',
            backgroundColor: 'var(--color-bg-secondary)',
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
              <>
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
                <button
                  onClick={() => {
                    setIsMidiSelectorVisible(!isMidiSelectorVisible);
                    const midiSelector = document.querySelector('.midi-device-selector') as HTMLElement;
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
            key={midiState.devices.length.toString()}
            onChannelChange={(channel) => {
              setSelectedMidiChannel(channel);
              // localStorage update handled in effect
            }}
            showInputsOnly
          />
        </div>

        {/* Keyboard */}
        <DrumKeyboard 
          onFileUpload={onFileUpload}
          selectedMidiChannel={selectedMidiChannel}
          midiState={midiState}
          onMidiEventExternal={onMidiEvent}
        />
      </div>
    </>
  );
}; 