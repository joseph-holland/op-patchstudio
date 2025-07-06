import { AppHeader } from './AppHeader';
import { Footer } from './Footer';

export function FeedbackPage() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: 'var(--color-surface-tertiary)',
      padding: '2rem',
      maxWidth: '1400px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      <div>
        <AppHeader />
        <div style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderRadius: '15px',
          padding: '2rem',
          marginTop: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--color-border-light)'
        }}>
          <h2 style={{
            margin: '0 0 1.5rem 0',
            fontSize: '1.5rem',
            fontWeight: '300',
            color: 'var(--color-text-primary)',
            textAlign: 'center'
          }}>
            bugs and feature suggestions
          </h2>
          <p style={{
            margin: '0 0 2rem 0',
            fontSize: '0.95rem',
            color: 'var(--color-text-secondary)',
            textAlign: 'center',
            lineHeight: '1.5'
          }}>
            let me know below!
          </p>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            width: '100%'
          }}>
            <iframe 
              src="https://docs.google.com/forms/d/e/1FAIpQLSdgfoCaXzmQL6iF4QR08owfFSAwH651jlGChzcnz-pqwsI4Gw/viewform?embedded=true" 
              width={640} 
              height={852} 
              frameBorder="0" 
              marginHeight={0} 
              marginWidth={0}
              style={{
                border: '1px solid var(--color-border-light)',
                borderRadius: '6px',
                maxWidth: '100%',
                height: 'auto',
                minHeight: '600px'
              }}
            >
              loading…
            </iframe>
          </div>
          <div style={{
            marginTop: '2rem',
            textAlign: 'center'
          }}>
            <a 
              href="#/"
              style={{
                color: 'var(--color-text-secondary)',
                textDecoration: 'none',
                fontSize: '0.9rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <i className="fas fa-arrow-left"></i>
              back to op-patchstudio
            </a>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
} 