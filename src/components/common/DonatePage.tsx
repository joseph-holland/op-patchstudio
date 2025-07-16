import { AppHeader } from './AppHeader';
import { Footer } from './Footer';

export function DonatePage() {
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
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.7rem 1rem 0.5rem 1rem',
            borderBottom: '1px solid var(--color-border-medium)',
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: '15px 15px 0 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <h3 style={{
                margin: 0,
                color: 'var(--color-text-primary)',
                fontSize: '1.25rem',
                fontWeight: 300,
              }}>
                donate
              </h3>
            </div>
          </div>

          {/* Content */}
          <div style={{ 
            padding: '2rem',
          }}>
            <div style={{
              textAlign: 'center',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              <p style={{
                color: 'var(--color-text-secondary)',
                fontSize: '1.1rem',
                lineHeight: 1.6,
                marginBottom: '2rem'
              }}>
                support the development of OP-PatchStudio and get access to exclusive content, tutorials and early access to new features still in development.
              </p>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                alignItems: 'center'
              }}>
                <a 
                  href="https://www.patreon.com/oppatchstudio"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem 2rem',
                    backgroundColor: 'var(--color-interactive-primary)',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '6px',
                    fontWeight: '500',
                    fontSize: '1.1rem',
                    transition: 'background-color 0.2s ease',
                    minWidth: '200px',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-interactive-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-interactive-primary)';
                  }}
                >
                  <i className="fab fa-patreon" style={{ fontSize: '1.2rem' }}></i>
                  support on patreon
                </a>
                
                <a 
                  href="https://buymeacoffee.com/oppatchstudio"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1rem 2rem',
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-primary)',
                    textDecoration: 'none',
                    borderRadius: '6px',
                    fontWeight: '500',
                    fontSize: '1.1rem',
                    border: '1px solid var(--color-border-light)',
                    transition: 'background-color 0.2s ease',
                    minWidth: '200px',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-border-subtle)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                  }}
                >
                  <i className="fas fa-coffee" style={{ fontSize: '1.2rem' }}></i>
                  buy me a coffee
                </a>
              </div>
              
              <div style={{
                marginTop: '2rem',
                padding: '1rem',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: '6px',
                border: '1px solid var(--color-border-light)'
              }}>
                <p style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.9rem',
                  margin: 0,
                  lineHeight: 1.5
                }}>
                  your support helps keep op-patchstudio free and open source while enabling new features and improvements.
                </p>
              </div>
            </div>
          </div>
          
          <div style={{
            marginTop: '2rem',
            textAlign: 'center',
            padding: '1rem'
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