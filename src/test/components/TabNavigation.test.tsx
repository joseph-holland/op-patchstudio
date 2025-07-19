import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TabNavigation } from '../../components/common/TabNavigation';
import { FEATURE_FLAGS } from '../../utils/constants';

// Mock FEATURE_FLAGS
vi.mock('../../utils/constants', () => ({
  FEATURE_FLAGS: {
    DONATE_PAGE: true
  }
}));

describe('TabNavigation', () => {
  const mockOnTabChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all tabs with proper ARIA attributes', () => {
    render(<TabNavigation currentTab="drum" onTabChange={mockOnTabChange} />);
    
    // Check tablist container
    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveAttribute('aria-label', 'main navigation tabs');
    expect(tablist).toHaveAttribute('aria-orientation', 'horizontal');
    
    // Check individual tabs
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5); // drum, multisample, library, donate, feedback
    
    // Check first tab (drum) is selected
    const drumTab = screen.getByRole('tab', { name: 'drum tab' });
    expect(drumTab).toHaveAttribute('aria-selected', 'true');
    expect(drumTab).toHaveAttribute('aria-controls', 'drum-tabpanel');
    expect(drumTab).toHaveAttribute('tabindex', '0');
    
    // Check other tabs are not selected
    const multisampleTab = screen.getByRole('tab', { name: 'multisample tab' });
    expect(multisampleTab).toHaveAttribute('aria-selected', 'false');
    expect(multisampleTab).toHaveAttribute('tabindex', '-1');
  });

  it('should handle tab clicks', () => {
    render(<TabNavigation currentTab="drum" onTabChange={mockOnTabChange} />);
    
    const multisampleTab = screen.getByRole('tab', { name: 'multisample tab' });
    fireEvent.click(multisampleTab);
    
    expect(mockOnTabChange).toHaveBeenCalledWith('multisample');
  });

  it('should handle keyboard navigation with arrow keys', () => {
    render(<TabNavigation currentTab="drum" onTabChange={mockOnTabChange} />);
    
    const drumTab = screen.getByRole('tab', { name: 'drum tab' });
    
    // Test right arrow
    fireEvent.keyDown(drumTab, { key: 'ArrowRight' });
    expect(mockOnTabChange).toHaveBeenCalledWith('multisample');
    
    // Test left arrow (should wrap to last tab)
    fireEvent.keyDown(drumTab, { key: 'ArrowLeft' });
    expect(mockOnTabChange).toHaveBeenCalledWith('feedback');
  });

  it('should handle Home and End key navigation', () => {
    render(<TabNavigation currentTab="feedback" onTabChange={mockOnTabChange} />);
    
    const feedbackTab = screen.getByRole('tab', { name: 'feedback tab' });
    
    // Test Home key
    fireEvent.keyDown(feedbackTab, { key: 'Home' });
    expect(mockOnTabChange).toHaveBeenCalledWith('drum');
    
    // Test End key
    fireEvent.keyDown(feedbackTab, { key: 'End' });
    expect(mockOnTabChange).toHaveBeenCalledWith('feedback');
  });

  it('should handle Enter and Space key activation', () => {
    render(<TabNavigation currentTab="drum" onTabChange={mockOnTabChange} />);
    
    const multisampleTab = screen.getByRole('tab', { name: 'multisample tab' });
    
    // Test Enter key
    fireEvent.keyDown(multisampleTab, { key: 'Enter' });
    expect(mockOnTabChange).toHaveBeenCalledWith('multisample');
    
    // Test Space key
    fireEvent.keyDown(multisampleTab, { key: ' ' });
    expect(mockOnTabChange).toHaveBeenCalledWith('multisample');
  });

  it('should show focus indicators', () => {
    render(<TabNavigation currentTab="drum" onTabChange={mockOnTabChange} />);
    
    const multisampleTab = screen.getByRole('tab', { name: 'multisample tab' });
    
    // Focus the tab
    fireEvent.focus(multisampleTab);
    expect(multisampleTab).toHaveStyle({ outline: '2px solid var(--color-interactive-focus)' });
    
    // Blur the tab
    fireEvent.blur(multisampleTab);
    expect(multisampleTab).toHaveStyle({ outline: 'none' });
  });

  it('should handle hover effects', () => {
    render(<TabNavigation currentTab="drum" onTabChange={mockOnTabChange} />);
    
    const multisampleTab = screen.getByRole('tab', { name: 'multisample tab' });
    
    // Mouse enter
    fireEvent.mouseEnter(multisampleTab);
    expect(multisampleTab).toHaveStyle({ background: 'var(--color-border-subtle)' });
    
    // Mouse leave
    fireEvent.mouseLeave(multisampleTab);
    expect(multisampleTab).toHaveStyle({ background: 'var(--color-bg-secondary)' });
  });

  it('should respect feature flags for donate page', () => {
    // Mock FEATURE_FLAGS to disable donate page
    (vi.mocked(FEATURE_FLAGS) as any).DONATE_PAGE = false;
    
    render(<TabNavigation currentTab="drum" onTabChange={mockOnTabChange} />);
    
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4); // drum, multisample, library, feedback (no donate)
    
    // Check that donate tab is not present
    expect(screen.queryByRole('tab', { name: 'donate tab' })).not.toBeInTheDocument();
    
    // Reset mock
    (vi.mocked(FEATURE_FLAGS) as any).DONATE_PAGE = true;
  });

  it('should ensure minimum touch target size', () => {
    render(<TabNavigation currentTab="drum" onTabChange={mockOnTabChange} />);
    
    const drumTab = screen.getByRole('tab', { name: 'drum tab' });
    expect(drumTab).toHaveStyle({ minHeight: '44px' });
  });

  it('should handle mobile layout', () => {
    // Mock window.innerWidth for mobile
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });
    
    render(<TabNavigation currentTab="drum" onTabChange={mockOnTabChange} />);
    
    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveStyle({ marginLeft: '8px', marginRight: '8px' });
    
    // Restore window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });
}); 