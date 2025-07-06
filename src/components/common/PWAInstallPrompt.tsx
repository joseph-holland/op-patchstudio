import React, { useState, useEffect } from 'react';
import { Button } from '@carbon/react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
      // Hide the app-provided install promotion
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      // Optionally, send analytics event to track successful installs
      console.log('PWA was installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    setDeferredPrompt(null);
  };

  if (!showInstallPrompt) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border-light)',
        borderRadius: '6px',
        padding: '16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        maxWidth: '300px',
        color: 'var(--color-text-primary)'
      }}
    >
      <div style={{ marginBottom: '12px' }}>
        <strong style={{ display: 'block', marginBottom: '4px' }}>
          install op-patchstudio [unofficial]
        </strong>
        <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          install for offline use and quick access
        </span>
      </div>
      
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button
          size="sm"
          onClick={handleInstallClick}
          style={{ flex: 1 }}
        >
          install
        </Button>
        <Button
          size="sm"
          kind="ghost"
          onClick={handleDismiss}
        >
          dismiss
        </Button>
      </div>
    </div>
  );
};

export default PWAInstallPrompt; 