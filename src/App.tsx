import { Content, Theme } from '@carbon/react';
import { AppHeader } from './components/common/AppHeader';
import { MainTabs } from './components/common/MainTabs';
import { NotificationSystem } from './components/common/NotificationSystem';
import { AppContextProvider, useAppContext } from './context/AppContext';
import './theme/device-themes.scss';
import { useState, useEffect } from 'react';
import { isMobile, isTablet } from 'react-device-detect';
import { registerOverlayControl } from './components/common/WaveformEditor';

// Global state for overlay control
let setShowRotateOverlayGlobal: ((show: boolean) => void) | null = null;
let pendingZoomCallback: (() => void) | null = null;

// Export function to control overlay from other components
export const triggerRotateOverlay = (zoomCallback?: () => void) => {
  // Add a micro-delay to ensure proper state management timing
  setTimeout(() => {
    if (setShowRotateOverlayGlobal) {
      setShowRotateOverlayGlobal(true);
      if (zoomCallback) {
        pendingZoomCallback = zoomCallback;
      }
    }
  }, 0);
};

export const hideRotateOverlay = () => {
  if (setShowRotateOverlayGlobal) {
    setShowRotateOverlayGlobal(false);
  }
};

function AppContent() {
  const { state, dispatch } = useAppContext();
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showRotateOverlay, setShowRotateOverlay] = useState(false);

  // Set up global control
  useEffect(() => {
    setShowRotateOverlayGlobal = setShowRotateOverlay;
    // Register the overlay control with WaveformEditor
    registerOverlayControl((zoomCallback) => triggerRotateOverlay(zoomCallback));
    return () => {
      setShowRotateOverlayGlobal = null;
    };
  }, []);

  useEffect(() => {
    const checkDeviceAndOrientation = () => {
      // Use react-device-detect for device detection
      const mobileOrTablet = isMobile || isTablet;
      setIsMobileDevice(mobileOrTablet);
      
      // Check orientation using screen orientation API and window dimensions
      const isPortraitMode = window.innerHeight > window.innerWidth;
      
      // Hide overlay when device rotates to landscape and trigger zoom modal if pending
      if (mobileOrTablet && !isPortraitMode && showRotateOverlay) {
        setShowRotateOverlay(false);
        // If there's a pending zoom callback, execute it
        if (pendingZoomCallback) {
          setTimeout(() => {
            pendingZoomCallback?.();
            pendingZoomCallback = null;
          }, 100); // Small delay to ensure overlay is hidden
        }
      }
    };
    
    checkDeviceAndOrientation();
    
    // Listen for orientation changes
    const handleOrientationChange = () => {
      setTimeout(checkDeviceAndOrientation, 100); // Small delay to ensure orientation has changed
    };
    
    const handleResize = () => {
      checkDeviceAndOrientation();
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
    };
  }, [showRotateOverlay]);

  const handleDismissNotification = (id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  };

  return (
    <>
      <Theme theme="white" className="opxy-theme">
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-surface-tertiary)' }}>
          <Content style={{ 
            padding: isMobileDevice ? '0.5rem' : '2rem',
            backgroundColor: 'var(--color-surface-tertiary)',
            maxWidth: '1400px',
            margin: '0 auto'
          }}>
            <AppHeader />
            <MainTabs />
            
            <NotificationSystem 
              notifications={state.notifications}
              onDismiss={handleDismissNotification}
            />
            
            {/* Footer - matching legacy */}
            <footer style={{ 
              textAlign: 'center', 
              marginTop: '3rem', 
              padding: '20px',
              fontSize: '0.9rem',
              color: 'var(--color-text-tertiary)'
            }}>
              <div style={{ marginBottom: '1rem', color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>
                OP-PatchStudio is an unofficial tool not affiliated with or endorsed by teenage engineering.<br />
                this software is provided "as is" without warranty of any kind. use at your own risk. for educational and personal use only.<br />
                OP-XY, OP-1 are a registered trademarks of teenage engineering.<br />
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5em',
                fontSize: '0.98em'
              }}>
                <span style={{ color: 'var(--color-text-tertiary)' }}>v{__APP_VERSION__}</span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>|</span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>proudly open source</span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>|</span>
                <a 
                  href="https://github.com/joseph-holland/op-patchstudio" 
                  target="_blank" 
                  rel="noopener"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  github repo
                </a>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                crafted with fidelity by{' '}
                <a 
                  href="https://github.com/joseph-holland" 
                  target="_blank" 
                  rel="noopener"
                  style={{ color: '#666' }}
                >
                  joseph-holland
                </a>
                {' '} | {' '}
                <a 
                  href="https://buymeacoffee.com/jxavierh" 
                  target="_blank" 
                  rel="noopener"
                  style={{ color: '#666', display: 'inline-flex', alignItems: 'center', gap: '0.3em' }}
                >
                  <i className="fas fa-coffee" style={{ fontSize: '0.9em' }}></i>
                  buy me a coffee
                </a>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                inspired by the awesome{' '}
                <a 
                  href="https://buba447.github.io/opxy-drum-tool/" 
                  target="_blank" 
                  rel="noopener"
                  style={{ color: '#666' }}
                >
                  opxy-drum-tool
                </a>
                {' '} by zeitgeese
              </div>
            </footer>
          </Content>
        </div>
      </Theme>
      <div 
        className="app-block-overlay" 
        style={{ 
          background: 'rgba(102,102,102,0.7)', 
          fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif', 
          flexDirection: 'column',
          opacity: showRotateOverlay ? 1 : 0,
          visibility: showRotateOverlay ? 'visible' : 'hidden',
          transition: 'opacity 0.3s ease-in-out, visibility 0.3s ease-in-out'
        }}
      >
        {/* White background container with border */}
        <div style={{
          background: 'white',
          border: '1px solid var(--color-border-light)',
          borderRadius: '15px',
          padding: '2rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '90vw',
          margin: '0 1rem'
        }}>
          <div style={{ position: 'relative', width: '4em', height: '4em', marginBottom: '2.5rem', display: 'inline-block' }}>
            {/* Upright phone */}
            <i className="fas fa-mobile-alt" style={{ position: 'absolute', right: 0, bottom: 0, fontSize: '4em', color: 'var(--color-interactive-primary, #1a1a1a)', opacity: 0.6 }}></i>
            {/* Rotated phone, shifted left/up by 50% of icon size */}
            <i className="fas fa-mobile-alt" style={{ position: 'absolute', right: 0, bottom: 0, fontSize: '4em', color: 'var(--color-interactive-primary, #1a1a1a)', transform: 'rotate(-90deg) translate(20%, -50%)', transformOrigin: 'bottom right' }}></i>
            {/* Reply arrow centered */}
            <i className="fas fa-reply" style={{ position: 'absolute', left: '10%', top: '40%', fontSize: '2em', color: 'var(--color-interactive-primary, #1a1a1a)', transform: 'translate(-60%, -10%) rotate(-90deg)' }}></i>
          </div>
          <div
            style={{
              fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif',
              fontWeight: 300,
              fontSize: '2.1rem',
              color: 'var(--color-text-primary)',
              textAlign: 'center',
              letterSpacing: '-0.05em',
              lineHeight: 1.1,
              padding: '0 1rem'
            }}
          >
            please rotate your device to landscape mode
          </div>
        </div>
      </div>
    </>
  );
}

function App() {
  return (
    <AppContextProvider>
      <AppContent />
    </AppContextProvider>
  );
}

export default App;
