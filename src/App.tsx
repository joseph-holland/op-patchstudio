import { Content, Theme } from '@carbon/react';
import { AppHeader } from './components/common/AppHeader';
import { MainTabs } from './components/common/MainTabs';
import { NotificationSystem } from './components/common/NotificationSystem';
import { AppContextProvider, useAppContext } from './context/AppContext';
import './theme/opxy-theme.scss';
import { useState, useEffect } from 'react';

function AppContent() {
  const { state, dispatch } = useAppContext();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleDismissNotification = (id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  };

  return (
    <Theme theme="white" className="opxy-theme">
      <div style={{ minHeight: '100vh', backgroundColor: '#ececec' }}>
        <Content style={{ 
          padding: isMobile ? '0.5rem' : '2rem',
          backgroundColor: '#ececec',
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
              color: '#aaa'
            }}>
              <div style={{ marginBottom: '1rem', color: '#999', fontSize: '0.85rem' }}>
                OP-PatchStudio is an unofficial tool not affiliated with or endorsed by teenage engineering.<br />
                this software is provided "as is" without warranty of any kind. use at your own risk. for educational and personal use only.
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
                <span style={{ color: '#999' }}>v{__APP_VERSION__}</span>
                <span style={{ color: '#999' }}>|</span>
                <span style={{ color: '#999' }}>proudly open source</span>
                <span style={{ color: '#999' }}>|</span>
                <a 
                  href="https://github.com/joseph-holland/opxy-tools" 
                  target="_blank" 
                  rel="noopener"
                  style={{ color: '#666' }}
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
                  original opxy-drum-tool
                </a>
                {' '} by zeitgeese
              </div>
            </footer>
          </Content>
        </div>
      </Theme>
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
