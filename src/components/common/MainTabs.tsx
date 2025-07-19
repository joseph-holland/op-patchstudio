import { useAppContext } from '../../context/AppContext';
import { DrumTool } from '../drum/DrumTool';
import { MultisampleTool } from '../multisample/MultisampleTool';
import { LibraryPage } from '../library/LibraryPage';
import { FeedbackPage } from './FeedbackPage';
import { DonatePage } from './DonatePage';
import { TabNavigation } from './TabNavigation';
import { FEATURE_FLAGS } from '../../utils/constants';

export function MainTabs() {
  const { state, dispatch } = useAppContext();

  const handleTabChange = (tabName: 'drum' | 'multisample' | 'feedback' | 'library' | 'donate') => {
    dispatch({ type: 'SET_TAB', payload: tabName });
  };

  const tabPanelStyle = {
    background: 'var(--color-bg-primary)',
    borderRadius: '15px',
    border: '1px solid var(--color-border-subtle)',
    borderTop: 'none',
    minHeight: '500px',
    overflow: 'hidden'
  };

  return (
    <div 
      role="tabpanel"
      aria-label="main application content"
      style={{ marginBottom: '2rem' }}
    >
      <TabNavigation currentTab={state.currentTab} onTabChange={handleTabChange} />
      
      {/* Tab Content */}
      {state.currentTab === 'drum' && (
        <div 
          role="tabpanel"
          id="drum-tabpanel"
          aria-labelledby="drum-tab"
          aria-label="drum tool content"
          style={tabPanelStyle}
        >
          <DrumTool />
        </div>
      )}
      
      {state.currentTab === 'multisample' && (
        <div 
          role="tabpanel"
          id="multisample-tabpanel"
          aria-labelledby="multisample-tab"
          aria-label="multisample tool content"
          style={tabPanelStyle}
        >
          <MultisampleTool />
        </div>
      )}
      
      {state.currentTab === 'feedback' && (
        <div
          role="tabpanel"
          id="feedback-tabpanel"
          aria-labelledby="feedback-tab"
          aria-label="feedback and support content"
          style={tabPanelStyle}
        >
          <FeedbackPage />
        </div>
      )}
      
      {state.currentTab === 'donate' && FEATURE_FLAGS.DONATE_PAGE && (
        <div
          role="tabpanel"
          id="donate-tabpanel"
          aria-labelledby="donate-tab"
          aria-label="donation and support content"
          style={tabPanelStyle}
        >
          <DonatePage />
        </div>
      )}
      
      {state.currentTab === 'library' && (
        <div
          role="tabpanel"
          id="library-tabpanel"
          aria-labelledby="library-tab"
          aria-label="preset library content"
          style={tabPanelStyle}
        >
          <LibraryPage />
        </div>
      )}
    </div>
  );
}