import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MainTabs } from '../../components/common/MainTabs';
import { AppContextProvider } from '../../context/AppContext';

describe('MainTabs', () => {
  const renderWithContext = () => {
    return render(
      <AppContextProvider>
        <MainTabs />
      </AppContextProvider>
    );
  };

  it('should render with proper ARIA structure', () => {
    renderWithContext();
    
    // Check main container has proper role
    const mainContainer = screen.getByRole('tabpanel', { name: 'main application content' });
    expect(mainContainer).toBeInTheDocument();
    
    // Check tablist container
    const tablist = screen.getByRole('tablist', { name: 'main navigation tabs' });
    expect(tablist).toBeInTheDocument();
    expect(tablist).toHaveAttribute('aria-orientation', 'horizontal');
    
    // Check that all tabs are present with proper ARIA attributes
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5); // drum, multisample, library, donate, feedback
    
    // Check that each tab has proper ARIA attributes
    tabs.forEach(tab => {
      expect(tab).toHaveAttribute('aria-controls');
      expect(tab).toHaveAttribute('aria-selected');
      expect(tab).toHaveAttribute('aria-label');
      expect(tab).toHaveAttribute('id');
    });
    
    // Check that only the active tab (drum) is focusable
    const drumTab = screen.getByRole('tab', { name: 'drum tab' });
    expect(drumTab).toHaveAttribute('tabindex', '0');
    expect(drumTab).toHaveAttribute('aria-selected', 'true');
    
    // Check that inactive tabs are not focusable
    const inactiveTabs = tabs.filter(tab => tab !== drumTab);
    inactiveTabs.forEach(tab => {
      expect(tab).toHaveAttribute('tabindex', '-1');
      expect(tab).toHaveAttribute('aria-selected', 'false');
    });
    
    // Check that the drum tabpanel is present and properly labeled
    // Use getByTestId or find by ID since the aria-label might not be exactly as expected
    const drumPanel = document.getElementById('drum-tabpanel');
    expect(drumPanel).toBeInTheDocument();
    expect(drumPanel).toHaveAttribute('role', 'tabpanel');
    expect(drumPanel).toHaveAttribute('aria-labelledby', 'drum-tab');
    
    // Check that the drum tab controls the drum panel
    expect(drumTab).toHaveAttribute('aria-controls', 'drum-tabpanel');
  });

  it('should have proper tab order and navigation', () => {
    renderWithContext();
    
    const tabs = screen.getAllByRole('tab');
    const expectedTabNames = ['drum tab', 'multisample tab', 'library tab', 'donate tab', 'feedback tab'];
    
    // Check that tabs are in the correct order
    tabs.forEach((tab, index) => {
      expect(tab).toHaveTextContent(expectedTabNames[index].replace(' tab', ''));
    });
  });
}); 