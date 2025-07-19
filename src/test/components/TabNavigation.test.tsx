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
    
    // Check that all tabs are present
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5); // drum, multisample, library, donate, feedback
    
    // Check that each tab has proper ARIA attributes
    tabs.forEach(tab => {
      expect(tab).toHaveAttribute('aria-selected');
      expect(tab).toHaveAttribute('aria-controls');
      expect(tab).toHaveAttribute('aria-label');
      expect(tab).toHaveAttribute('id');
    });
    
    // Check that drum tab is selected
    const drumTab = screen.getByRole('tab', { name: 'drum tab' });
    expect(drumTab).toHaveAttribute('aria-selected', 'true');
    expect(drumTab).toHaveAttribute('tabindex', '0');
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
    
    vi.clearAllMocks();
    
    // Test left arrow (should wrap to feedback)
    fireEvent.keyDown(drumTab, { key: 'ArrowLeft' });
    expect(mockOnTabChange).toHaveBeenCalledWith('feedback');
  });

  it('should handle Home and End key navigation', () => {
    render(<TabNavigation currentTab="multisample" onTabChange={mockOnTabChange} />);
    
    const multisampleTab = screen.getByRole('tab', { name: 'multisample tab' });
    
    // Test Home key
    fireEvent.keyDown(multisampleTab, { key: 'Home' });
    expect(mockOnTabChange).toHaveBeenCalledWith('drum');
    
    vi.clearAllMocks();
    
    // Test End key
    fireEvent.keyDown(multisampleTab, { key: 'End' });
    expect(mockOnTabChange).toHaveBeenCalledWith('feedback');
  });

  it('should handle Enter and Space key activation', () => {
    render(<TabNavigation currentTab="drum" onTabChange={mockOnTabChange} />);
    
    const multisampleTab = screen.getByRole('tab', { name: 'multisample tab' });
    
    // Test Enter key
    fireEvent.keyDown(multisampleTab, { key: 'Enter' });
    expect(mockOnTabChange).toHaveBeenCalledWith('multisample');
    
    vi.clearAllMocks();
    
    // Test Space key
    fireEvent.keyDown(multisampleTab, { key: ' ' });
    expect(mockOnTabChange).toHaveBeenCalledWith('multisample');
  });

  it('should handle hover effects', () => {
    render(<TabNavigation currentTab="drum" onTabChange={mockOnTabChange} />);
    
    const multisampleTab = screen.getByRole('tab', { name: 'multisample tab' });
    
    // Test hover enter
    fireEvent.mouseEnter(multisampleTab);
    expect(multisampleTab).toHaveStyle({ background: 'var(--color-border-subtle)' });
    expect(multisampleTab).toHaveStyle({ color: 'var(--color-text-primary)' });
    
    // Test hover leave
    fireEvent.mouseLeave(multisampleTab);
    expect(multisampleTab).toHaveStyle({ background: 'var(--color-bg-secondary)' });
    expect(multisampleTab).toHaveStyle({ color: 'var(--color-text-secondary)' });
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
    
    const tabs = screen.getAllByRole('tab');
    tabs.forEach(tab => {
      expect(tab).toHaveStyle({ minHeight: '44px' });
    });
  });

  it('should handle mobile layout', () => {
    // Mock window.innerWidth for mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });
    
    render(<TabNavigation currentTab="drum" onTabChange={mockOnTabChange} />);
    
    const tablist = screen.getByRole('tablist');
    expect(tablist).toHaveStyle({ marginLeft: '8px' });
    expect(tablist).toHaveStyle({ marginRight: '8px' });
    
    // Reset window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });
}); 