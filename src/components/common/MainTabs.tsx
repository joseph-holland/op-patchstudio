import { useAppContext } from '../../context/AppContext';
import { DrumTool } from '../drum/DrumTool';
import { MultisampleTool } from '../multisample/MultisampleTool';

export function MainTabs() {
  const { state, dispatch } = useAppContext();

  const handleTabChange = (tabName: 'drum' | 'multisample') => {
    dispatch({ type: 'SET_TAB', payload: tabName });
  };

  const handleKeyDown = (e: React.KeyboardEvent, tabName: 'drum' | 'multisample') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTabChange(tabName);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const tabs = ['drum', 'multisample'] as const;
      const currentIndex = tabs.indexOf(state.currentTab);
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
    outline: 'none'
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
    outline: 'none'
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
          style={{
            ...(state.currentTab === 'drum' ? activeDrumTabStyle : drumTabStyle)
          }}
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
    </div>
  );
}