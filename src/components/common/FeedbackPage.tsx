import { AppHeader } from './AppHeader';
import { Footer } from './Footer';

export function FeedbackPage() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: 'var(--color-surface-tertiary)',
      padding: '1rem',
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
          padding: '1rem',
          marginTop: '2rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--color-border-light)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            width: '100%'
          }}>
            <iframe 
              src="https://docs.google.com/forms/d/e/1FAIpQLSdgfoCaXzmQL6iF4QR08owfFSAwH651jlGChzcnz-pqwsI4Gw/viewform?embedded=true" 
              width="100%" 
              height="3000px" 
              frameBorder="0" 
              marginHeight={0} 
              marginWidth={0}
              
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