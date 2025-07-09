import { useAppContext } from '../../context/AppContext';
import { DrumTool } from '../drum/DrumTool';
import { MultisampleTool } from '../multisample/MultisampleTool';
import { LibraryPage } from '../library/LibraryPage';

export function MainTabs() {
  const { state, dispatch } = useAppContext();

  const handleTabChange = (tabName: 'drum' | 'multisample' | 'feedback' | 'library') => {
    dispatch({ type: 'SET_TAB', payload: tabName });
  };

  const handleKeyDown = (e: React.KeyboardEvent, tabName: 'drum' | 'multisample' | 'feedback' | 'library') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTabChange(tabName);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const tabs = ['drum', 'multisample', 'library', 'feedback'] as const;
      const currentIndex = tabs.indexOf(state.currentTab as any);
      const direction = e.key === 'ArrowLeft' ? -1 : 1;
      const newIndex = (currentIndex + direction + tabs.length) % tabs.length;
      handleTabChange(tabs[newIndex]);
    }
  };

  const tabStyle = {
    padding: '0.75rem 1.5rem',
    border: '1px solid var(--color-border-subtle)',
    borderBottom: 'none',
    borderRadius: '15px 15px 0 0',
    background: 'var(--color-bg-secondary)',
    color: 'var(--color-text-secondary)',
    fontWeight: '500',
    fontFamily: '"Montserrat", "Arial", sans-serif',
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginRight: '2px',
    position: 'relative' as const,
    zIndex: 1,
    outline: 'none',
    borderColor: 'var(--color-border-subtle) var(--color-border-subtle) var(--color-border-subtle) var(--color-border-subtle)'
  };

  const drumTabStyle = {
    padding: '0.75rem 1.5rem',
    border: '1px solid var(--color-border-subtle)',
    borderBottom: 'none',
    borderTopLeftRadius: '15px',
    borderTopRightRadius: '15px',
    borderBottomLeftRadius: '0',
    borderBottomRightRadius: '0',
    background: 'var(--color-bg-secondary)',
    color: 'var(--color-text-secondary)',
    fontWeight: '500',
    fontFamily: '"Montserrat", "Arial", sans-serif',
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginRight: '2px',
    position: 'relative' as const,
    zIndex: 1,
    outline: 'none',
    borderColor: 'var(--color-border-subtle) var(--color-border-subtle) var(--color-border-subtle) var(--color-border-subtle)'
  } as React.CSSProperties;

  const activeDrumTabStyle = {
    padding: '0.75rem 1.5rem',
    border: '1px solid var(--color-border-subtle)',
    borderBottom: 'none',
    borderTopLeftRadius: '15px',
    borderTopRightRadius: '15px',
    borderBottomLeftRadius: '0',
    borderBottomRightRadius: '0',
    background: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    borderColor: 'var(--color-border-subtle) var(--color-border-subtle) var(--color-bg-primary)',
    fontWeight: '500',
    fontFamily: '"Montserrat", "Arial", sans-serif',
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginRight: '2px',
    position: 'relative' as const,
    zIndex: 2,
    marginBottom: '-1px',
    outline: 'none'
  };

  const activeTabStyle = {
    ...tabStyle,
    background: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    borderColor: 'var(--color-border-subtle) var(--color-border-subtle) var(--color-bg-primary)',
    zIndex: 2,
    marginBottom: '-1px',
    outline: 'none'
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      {/* Custom Tab Navigation */}
      <div 
        role="tablist"
        aria-label="main navigation tabs"
        className="tab-bar"
        style={{ 
        display: 'flex',
        marginBottom: '0',
        borderBottom: '1px solid var(--color-border-subtle)',
        marginLeft: '16px',
        marginRight: '16px'
        }}
      >
        <button
          id="drum-tab"
          tabIndex={state.currentTab === 'drum' ? 0 : -1}
          aria-controls="drum-tabpanel"
          style={state.currentTab === 'drum' ? activeDrumTabStyle : drumTabStyle}
          onClick={() => handleTabChange('drum')}
          onKeyDown={(e) => handleKeyDown(e, 'drum')}
          onMouseEnter={(e) => {
            if (state.currentTab !== 'drum') {
              e.currentTarget.style.background = 'var(--color-border-subtle)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (state.currentTab !== 'drum') {
              e.currentTarget.style.background = 'var(--color-bg-secondary)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }
          }}
        >
          drum
        </button>
        <button
          id="multisample-tab"
          tabIndex={state.currentTab === 'multisample' ? 0 : -1}
          aria-controls="multisample-tabpanel"
          style={state.currentTab === 'multisample' ? activeTabStyle : tabStyle}
          onClick={() => handleTabChange('multisample')}
          onKeyDown={(e) => handleKeyDown(e, 'multisample')}
          onMouseEnter={(e) => {
            if (state.currentTab !== 'multisample') {
              e.currentTarget.style.background = 'var(--color-border-subtle)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (state.currentTab !== 'multisample') {
              e.currentTarget.style.background = 'var(--color-bg-secondary)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }
          }}
        >
          multisample
        </button>
        <button
          id="library-tab"
          tabIndex={state.currentTab === 'library' ? 0 : -1}
          aria-controls="library-tabpanel"
          style={state.currentTab === 'library' ? activeTabStyle : tabStyle}
          onClick={() => handleTabChange('library')}
          onKeyDown={(e) => handleKeyDown(e, 'library')}
          onMouseEnter={(e) => {
            if (state.currentTab !== 'library') {
              e.currentTarget.style.background = 'var(--color-border-subtle)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (state.currentTab !== 'library') {
              e.currentTarget.style.background = 'var(--color-bg-secondary)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }
          }}
        >
          library
        </button>
        <button
          id="feedback-tab"
          tabIndex={state.currentTab === 'feedback' ? 0 : -1}
          aria-controls="feedback-tabpanel"
          style={state.currentTab === 'feedback' ? activeTabStyle : tabStyle}
          onClick={() => handleTabChange('feedback')}
          onKeyDown={(e) => handleKeyDown(e, 'feedback')}
          onMouseEnter={(e) => {
            if (state.currentTab !== 'feedback') {
              e.currentTarget.style.background = 'var(--color-border-subtle)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (state.currentTab !== 'feedback') {
              e.currentTarget.style.background = 'var(--color-bg-secondary)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }
          }}
        >
          feedback
        </button>
      </div>
      
      {/* Tab Content */}
      <div 
        role="tabpanel"
        id="drum-tabpanel"
        aria-labelledby="drum-tab"
        style={{
          background: 'var(--color-bg-primary)',
          borderRadius: '15px',
          border: '1px solid var(--color-border-subtle)',
          borderTop: 'none',
          minHeight: '500px',
          overflow: 'hidden',
          display: state.currentTab === 'drum' ? 'block' : 'none'
        }}
      >
        <DrumTool />
      </div>
      <div 
        role="tabpanel"
        id="multisample-tabpanel"
        aria-labelledby="multisample-tab"
        style={{
        background: 'var(--color-bg-primary)',
        borderRadius: '15px',
        border: '1px solid var(--color-border-subtle)',
        borderTop: 'none',
        minHeight: '500px',
          overflow: 'hidden',
          display: state.currentTab === 'multisample' ? 'block' : 'none'
        }}
      >
        <MultisampleTool />
      </div>
      <div
        role="tabpanel"
        id="feedback-tabpanel"
        aria-labelledby="feedback-tab"
        style={{
          background: 'var(--color-bg-primary)',
          borderRadius: '15px',
          border: '1px solid var(--color-border-subtle)',
          borderTop: 'none',
          minHeight: '500px',
          overflow: 'hidden',
          display: state.currentTab === 'feedback' ? 'block' : 'none'
        }}
      >
        {/* Feedback Section */}
        <div style={{
          background: 'var(--color-bg-primary)',
          borderRadius: '15px',
          boxShadow: '0 2px 8px var(--color-shadow-primary)',
          border: '1px solid var(--color-border-subtle)',
          overflow: 'hidden',
          marginBottom: '1rem',
          margin: '2rem'
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
            padding: '2rem',
          }}>
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
      </div>
      <div
        role="tabpanel"
        id="library-tabpanel"
        aria-labelledby="library-tab"
        style={{
          background: 'var(--color-bg-primary)',
          borderRadius: '15px',
          border: '1px solid var(--color-border-subtle)',
          borderTop: 'none',
          minHeight: '500px',
          overflow: 'hidden',
          display: state.currentTab === 'library' ? 'block' : 'none'
        }}
      >
        <LibraryPage />
      </div>
    </div>
  );
}