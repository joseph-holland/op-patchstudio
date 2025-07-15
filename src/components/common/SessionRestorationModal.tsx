import { useEffect, useRef } from 'react';

interface SessionRestorationModalProps {
  isOpen: boolean;
  onLoadSession: () => void;
  onStartNew: () => Promise<void>;
  sessionInfo?: {
    timestamp: number;
    drumSamplesCount: number;
    multisampleFilesCount: number;
  } | null;
}

export function SessionRestorationModal({ 
  isOpen, 
  onLoadSession, 
  onStartNew,
  sessionInfo 
}: SessionRestorationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const lastButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      // Focus the first button when modal opens
      firstButtonRef.current?.focus();
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Handle keyboard navigation and escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'Escape':
          onStartNew().catch(error => {
            console.error('Failed to start new session:', error);
          });
          break;
        case 'Tab':
          // Trap focus within the modal
          if (event.shiftKey) {
            if (document.activeElement === firstButtonRef.current) {
              event.preventDefault();
              lastButtonRef.current?.focus();
            }
          } else {
            if (document.activeElement === lastButtonRef.current) {
              event.preventDefault();
              firstButtonRef.current?.focus();
            }
          }
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onStartNew]);

  if (!isOpen) return null;

  const formatSessionInfo = () => {
    if (!sessionInfo) return '';
    
    const date = new Date(sessionInfo.timestamp).toLocaleString();
    const drumCount = sessionInfo.drumSamplesCount;
    const multisampleCount = sessionInfo.multisampleFilesCount;
    
    return `from ${date} with ${drumCount} drum samples and ${multisampleCount} multisample files`;
  };

  return (
    <>
      <style>{`
        @media (max-width: 600px) {
          .session-modal-container {
            align-items: center !important;
            padding: 0 !important;
          }
          .session-modal {
            width: 100vw !important;
            max-width: 100vw !important;
            min-height: 40vh;
            max-height: 90vh;
            border-radius: 15px !important;
            margin: 0 !important;
            overflow-y: auto !important;
            box-sizing: border-box;
          }
          @media (max-height: 500px) {
            .session-modal-container {
              align-items: flex-end !important;
            }
            .session-modal {
              border-radius: 15px 15px 0 0 !important;
            }
          }
          .session-modal-header {
            padding: 1rem 1rem 0.75rem 1rem !important;
          }
          .session-modal-content {
            padding: 1rem !important;
            font-size: 1rem !important;
            word-break: break-word !important;
            white-space: normal !important;
          }
          .session-modal-actions {
            flex-direction: column !important;
            gap: 0.5rem !important;
            padding: 1rem 1rem 2rem 1rem !important;
          }
          .session-modal-actions button {
            min-width: 100%;
            font-size: 1.1rem !important;
            padding: 0.85rem 1rem !important;
            min-height: 44px !important;
          }
        }
        @media (max-width: 400px) {
          .session-modal {
            min-height: 50vh;
          }
        }
      `}</style>
      <div 
        className="session-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-restoration-title"
        aria-describedby="session-restoration-description"
        ref={modalRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          fontFamily: '"Montserrat", "Arial", sans-serif',
          padding: 0,
        }}
      >
        <div 
          className="session-modal"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
            borderRadius: '15px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            maxWidth: '500px',
            width: '90%',
            margin: 0,
            overflow: 'hidden',
            minWidth: 0,
            maxHeight: '90vh',
            overflowY: 'auto',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div className="session-modal-header" style={{
            padding: '1.5rem 1.5rem 1rem 1.5rem',
            borderBottom: '1px solid var(--color-border-light)'
          }}>
            <h3 
              id="session-restoration-title"
              style={{
                margin: '0',
                fontSize: '1.25rem',
                fontWeight: '300',
                color: 'var(--color-text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <i 
                className="fas fa-clock-rotate-left" 
                style={{ 
                  color: 'var(--color-text-primary)', 
                  fontSize: '1.25rem' 
                }}
                aria-hidden="true"
              ></i>
              restore session
            </h3>
          </div>

          {/* Content */}
          <div 
            className="session-modal-content"
            id="session-restoration-description"
            style={{
              padding: '1.5rem',
              color: 'var(--color-text-secondary)',
              fontSize: '0.95rem',
              lineHeight: '1.5'
            }}
          >
            <p style={{ margin: '0 0 1rem 0' }}>
              a previous session was found {formatSessionInfo()}.
            </p>
            <p style={{ margin: '0' }}>
              would you like to restore this session or start with a fresh workspace?
            </p>
          </div>

          {/* Actions */}
          <div className="session-modal-actions" style={{
            padding: '1rem 1.5rem 1.5rem 1.5rem',
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'flex-end'
          }}>
            <button
              ref={firstButtonRef}
              onClick={async () => {
                try {
                  await onStartNew();
                } catch (error) {
                  console.error('Failed to start new session:', error);
                }
              }}
              style={{
                padding: '0.625rem 1.25rem',
                border: '1px solid var(--color-border-light)',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-secondary)',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit',
                minWidth: '100px',
                minHeight: '44px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--color-border-light)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                e.currentTarget.style.borderColor = 'var(--color-border-light)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              start new
            </button>
            <button
              ref={lastButtonRef}
              onClick={onLoadSession}
              style={{
                padding: '0.625rem 1.25rem',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: 'var(--color-interactive-focus)',
                color: 'var(--color-white)',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit',
                minWidth: '100px',
                minHeight: '44px',
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
              restore
            </button>
          </div>
        </div>
      </div>
    </>
  );
} 