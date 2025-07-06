import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Storage keys for tracking user behavior
const STORAGE_KEYS = {
  INSTALL_DISMISSED: 'pwa_install_dismissed',
  INSTALL_ACCEPTED: 'pwa_install_accepted',
  VISIT_COUNT: 'pwa_visit_count',
  LAST_PROMPT_DATE: 'pwa_last_prompt_date'
};

// Configuration
const PROMPT_CONFIG = {
  FIRST_VISIT_DELAY: 3000, // 3 seconds after first visit
  REPROMPT_INTERVAL: 7 * 24 * 60 * 60 * 1000, // 7 days
  VISIT_THRESHOLD: 6, // Show again after 6 visits
  MOBILE_DELAY: 2000, // Shorter delay for mobile
  DESKTOP_DELAY: 5000 // Longer delay for desktop
};

const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if user should see the prompt
  const shouldShowPrompt = (): boolean => {
    // Don't show if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return false;
    }

    // Don't show if user already accepted
    if (localStorage.getItem(STORAGE_KEYS.INSTALL_ACCEPTED)) {
      return false;
    }

    // Check if user recently dismissed
    const dismissedDate = localStorage.getItem(STORAGE_KEYS.INSTALL_DISMISSED);
    if (dismissedDate) {
      const lastDismissed = new Date(dismissedDate).getTime();
      const now = new Date().getTime();
      
      // If dismissed recently, check visit count and time interval
      if (now - lastDismissed < PROMPT_CONFIG.REPROMPT_INTERVAL) {
        const visitCount = parseInt(localStorage.getItem(STORAGE_KEYS.VISIT_COUNT) || '0');
        return visitCount >= PROMPT_CONFIG.VISIT_THRESHOLD;
      }
    }

    return true;
  };

  // Track visit count
  const trackVisit = () => {
    const currentCount = parseInt(localStorage.getItem(STORAGE_KEYS.VISIT_COUNT) || '0');
    localStorage.setItem(STORAGE_KEYS.VISIT_COUNT, (currentCount + 1).toString());
  };

  // Check device type
  const checkDeviceType = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    setIsMobile(isMobileDevice);
  };

  useEffect(() => {
    checkDeviceType();
    trackVisit();

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after delay if conditions are met
      if (shouldShowPrompt()) {
        const delay = isMobile ? PROMPT_CONFIG.MOBILE_DELAY : PROMPT_CONFIG.DESKTOP_DELAY;
        setTimeout(() => {
          setShowInstallPrompt(true);
          // Trigger fade in animation
          setTimeout(() => setIsVisible(true), 10);
          localStorage.setItem(STORAGE_KEYS.LAST_PROMPT_DATE, new Date().toISOString());
        }, delay);
      }
    };

    const handleAppInstalled = () => {
      // Hide the app-provided install promotion
      handleFadeOut();
      // Mark as accepted
      localStorage.setItem(STORAGE_KEYS.INSTALL_ACCEPTED, new Date().toISOString());
      console.log('PWA was installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isMobile]);

  const handleFadeOut = () => {
    setIsVisible(false);
    setTimeout(() => {
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    }, 200); // Match transition duration
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      localStorage.setItem(STORAGE_KEYS.INSTALL_ACCEPTED, new Date().toISOString());
    } else {
      console.log('User dismissed the install prompt');
      localStorage.setItem(STORAGE_KEYS.INSTALL_DISMISSED, new Date().toISOString());
    }

    // Clear the deferredPrompt
    handleFadeOut();
  };

  const handleDismiss = () => {
    handleFadeOut();
    localStorage.setItem(STORAGE_KEYS.INSTALL_DISMISSED, new Date().toISOString());
  };

  const handleRemindLater = () => {
    handleFadeOut();
    // Reset visit count to show again after threshold
    localStorage.setItem(STORAGE_KEYS.VISIT_COUNT, '0');
  };

  if (!showInstallPrompt) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: isMobile ? '10px' : '20px',
        right: isMobile ? '10px' : '20px',
        left: isMobile ? '10px' : 'auto',
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-light)',
        borderRadius: '6px',
        padding: isMobile ? '12px' : '16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        maxWidth: isMobile ? 'none' : '300px',
        color: 'var(--color-text-primary)',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        fontFamily: '"Montserrat", "Arial", sans-serif'
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <strong style={{ 
          display: 'block', 
          marginBottom: '4px',
          fontSize: '0.95rem',
          fontWeight: '500',
          color: 'var(--color-text-primary)'
        }}>
          install op-patchstudio offline?
        </strong>
        <span style={{ 
          fontSize: '0.875rem', 
          color: 'var(--color-text-secondary)',
          lineHeight: '1.4'
        }}>
          {isMobile 
            ? 'install as app for quick access'
            : 'install as app for offline use and quick access'
          }
        </span>
      </div>
      
      <div style={{ 
        display: 'flex', 
        gap: '8px',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={handleRemindLater}
          style={{
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--color-border-medium)',
            borderRadius: '3px',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-secondary)',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'inherit',
            minWidth: '80px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
            e.currentTarget.style.borderColor = 'var(--color-border-medium)';
            e.currentTarget.style.color = 'var(--color-interactive-dark)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
            e.currentTarget.style.borderColor = 'var(--color-border-medium)';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          later
        </button>
        <button
          onClick={handleDismiss}
          style={{
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--color-border-medium)',
            borderRadius: '3px',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-secondary)',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'inherit',
            minWidth: '80px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
            e.currentTarget.style.borderColor = 'var(--color-border-medium)';
            e.currentTarget.style.color = 'var(--color-interactive-dark)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
            e.currentTarget.style.borderColor = 'var(--color-border-medium)';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          dismiss
        </button>
        <button
          onClick={handleInstallClick}
          style={{
            padding: '0.5rem 0.75rem',
            border: 'none',
            borderRadius: '3px',
            backgroundColor: 'var(--color-interactive-focus)',
            color: 'var(--color-white)',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'inherit',
            minWidth: '80px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-interactive-dark)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-interactive-focus)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          install
        </button>
      </div>
    </div>
  );
};

export default PWAInstallPrompt; 