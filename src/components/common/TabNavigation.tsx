import { FEATURE_FLAGS } from '../../utils/constants';
import { useEffect, useState } from 'react';

type TabName = 'drum' | 'multisample' | 'feedback' | 'library' | 'donate';

interface TabNavigationProps {
  currentTab: TabName;
  onTabChange: (tab: TabName) => void;
}

export function TabNavigation({ currentTab, onTabChange }: TabNavigationProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent, tabName: TabName) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTabChange(tabName);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const baseTabs = ['drum', 'multisample', 'library'] as const;
      const tabs = FEATURE_FLAGS.DONATE_PAGE ? [...baseTabs, 'donate', 'feedback'] : [...baseTabs, 'feedback'];
      const currentIndex = tabs.indexOf(currentTab as any);
      const direction = e.key === 'ArrowLeft' ? -1 : 1;
      const newIndex = (currentIndex + direction + tabs.length) % tabs.length;
      onTabChange(tabs[newIndex] as TabName);
    } else if (e.key === 'Home') {
      e.preventDefault();
      const baseTabs = ['drum', 'multisample', 'library'] as const;
      const tabs = FEATURE_FLAGS.DONATE_PAGE ? [...baseTabs, 'donate', 'feedback'] : [...baseTabs, 'feedback'];
      onTabChange(tabs[0] as TabName);
    } else if (e.key === 'End') {
      e.preventDefault();
      const baseTabs = ['drum', 'multisample', 'library'] as const;
      const tabs = FEATURE_FLAGS.DONATE_PAGE ? [...baseTabs, 'donate', 'feedback'] : [...baseTabs, 'feedback'];
      onTabChange(tabs[tabs.length - 1] as TabName);
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
    borderColor: 'var(--color-border-subtle) var(--color-border-subtle) var(--color-border-subtle) var(--color-border-subtle)',
    minHeight: '44px', // Ensure minimum touch target size
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
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

  const renderTab = (name: TabName, label: string) => {
    const isActive = currentTab === name;
    
    return (
      <button
        id={`${name}-tab`}
        role="tab"
        aria-selected={isActive}
        aria-controls={`${name}-tabpanel`}
        aria-label={`${label} tab`}
        tabIndex={isActive ? 0 : -1}
        style={isActive ? activeTabStyle : tabStyle}
        onClick={() => onTabChange(name)}
        onKeyDown={(e) => handleKeyDown(e, name)}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'var(--color-border-subtle)';
            e.currentTarget.style.color = 'var(--color-text-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'var(--color-bg-secondary)';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div 
      role="tablist"
      aria-label="main navigation tabs"
      aria-orientation="horizontal"
      className="tab-bar"
      style={{ 
        display: 'flex',
        marginBottom: '0',
        borderBottom: '1px solid var(--color-border-subtle)',
        marginLeft: isMobile ? '8px' : '16px',
        marginRight: isMobile ? '8px' : '16px'
      }}
    >
      {renderTab('drum', 'drum')}
      {renderTab('multisample', 'multisample')}
      {renderTab('library', 'library')}
      {FEATURE_FLAGS.DONATE_PAGE && renderTab('donate', 'donate')}
      {renderTab('feedback', 'feedback')}
    </div>
  );
} 