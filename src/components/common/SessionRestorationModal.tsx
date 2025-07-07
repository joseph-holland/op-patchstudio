interface SessionRestorationModalProps {
  isOpen: boolean;
  onLoadSession: () => void;
  onStartNew: () => void;
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
  if (!isOpen) return null;

  const formatSessionInfo = () => {
    if (!sessionInfo) return '';
    
    const date = new Date(sessionInfo.timestamp).toLocaleString();
    const drumCount = sessionInfo.drumSamplesCount;
    const multisampleCount = sessionInfo.multisampleFilesCount;
    
    return `from ${date} with ${drumCount} drum samples and ${multisampleCount} multisample files`;
  };

  return (
    <div 
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
        fontFamily: '"Montserrat", "Arial", sans-serif'
      }}
    >
      <div 
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderRadius: '15px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          maxWidth: '500px',
          width: '90%',
          margin: '0 1rem',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem 1.5rem 1rem 1.5rem',
          borderBottom: '1px solid var(--color-border-light)'
        }}>
          <h3 style={{
            margin: '0',
            fontSize: '1.25rem',
            fontWeight: '300',
            color: 'var(--color-text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <i className="fas fa-clock-rotate-left" style={{ 
              color: 'var(--color-text-primary)', 
              fontSize: '1.25rem' 
            }}></i>
            restore session
          </h3>
        </div>

        {/* Content */}
        <div style={{
          padding: '1.5rem',
          color: 'var(--color-text-secondary)',
          fontSize: '0.95rem',
          lineHeight: '1.5'
        }}>
          <p style={{ margin: '0 0 1rem 0' }}>
            a previous session was found {formatSessionInfo()}.
          </p>
          <p style={{ margin: '0' }}>
            would you like to restore this session or start with a fresh workspace?
          </p>
        </div>

        {/* Actions */}
        <div style={{
          padding: '1rem 1.5rem 1.5rem 1.5rem',
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onStartNew}
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
              minWidth: '100px'
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
              minWidth: '100px'
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
  );
} 