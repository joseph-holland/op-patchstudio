import { useState, useEffect } from 'react';

export function FeedbackPage() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div style={{
      background: 'var(--color-bg-primary)',
      borderRadius: '15px',
      boxShadow: '0 2px 8px var(--color-shadow-primary)',
      border: '1px solid var(--color-border-subtle)',
      overflow: 'hidden',
      marginBottom: '1rem',
      margin: isMobile ? '0.5rem' : '2rem'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.7rem 1rem 0.5rem 1rem',
        borderBottom: '1px solid var(--color-border-medium)',
        backgroundColor: 'var(--color-bg-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <h3 style={{
            margin: 0,
            color: '#222',
            fontSize: '1.25rem',
            fontWeight: 300,
          }}>
            feedback
          </h3>
        </div>
      </div>

      {/* Content */}
      <div style={{ 
        padding: isMobile ? '1rem' : '2rem',
      }}>
        {/* User note about checking GitHub issues first */}
        <div style={{
          marginBottom: '1.5rem',
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-light)',
          borderRadius: '6px',
          padding: '1rem',
          color: 'var(--color-text-secondary)',
          fontSize: '1rem',
          textAlign: 'center',
          lineHeight: 1.5
        }}>
          <i className="fas fa-info-circle" style={{ marginRight: '0.5rem', color: 'var(--color-text-secondary)' }}></i>
          before submitting an issue,<br/>please <a href="https://github.com/joseph-holland/op-patchstudio/issues" target="_blank" rel="noopener" style={{ color: 'var(--color-text-secondary)', textDecoration: 'underline', wordBreak: 'break-all' }}>check if your bug or request has already been raised here</a>.
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <iframe
            src="https://docs.google.com/forms/d/e/1FAIpQLSdgfoCaXzmQL6iF4QR08owfFSAwH651jlGChzcnz-pqwsI4Gw/viewform?embedded=true"
            width="1200"
            height="1000"
            frameBorder="0"
            marginHeight={0}
            marginWidth={0}
            style={{
              border: 'none',
              borderRadius: '15px',
              maxWidth: '100%',
              minHeight: '800px',
              background: 'white'
            }}
          >
            loading…
          </iframe>
        </div>
      </div>
    </div>
  );
} 