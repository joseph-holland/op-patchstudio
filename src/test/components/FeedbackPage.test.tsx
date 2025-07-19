import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackPage } from '../../components/common/FeedbackPage';

describe('FeedbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render feedback page with header', () => {
    render(<FeedbackPage />);
    
    expect(screen.getByText('feedback')).toBeInTheDocument();
  });

  it('should render GitHub issues link', () => {
    render(<FeedbackPage />);
    
    const link = screen.getByText(/check if your bug or request has already been raised here/i);
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute(
      'href',
      'https://github.com/joseph-holland/op-patchstudio/issues'
    );
  });

  it('should render feedback form iframe', () => {
    render(<FeedbackPage />);
    
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.src).toBe('https://docs.google.com/forms/d/e/1FAIpQLSdgfoCaXzmQL6iF4QR08owfFSAwH651jlGChzcnz-pqwsI4Gw/viewform?embedded=true');
  });

  it('should handle mobile layout', () => {
    // Mock window.innerWidth
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500, // Mobile width
    });
    
    render(<FeedbackPage />);
    
    // Check if mobile styles are applied to the content div
    const contentDiv = screen.getByText('feedback').closest('div')?.parentElement?.nextElementSibling;
    expect(contentDiv).toHaveStyle({ padding: '1rem' });

    // Restore window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('should handle desktop layout', () => {
    // Mock window.innerWidth
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024, // Desktop width
    });
    
    render(<FeedbackPage />);
    
    // Check if desktop styles are applied to the content div
    const contentDiv = screen.getByText('feedback').closest('div')?.parentElement?.nextElementSibling;
    expect(contentDiv).toHaveStyle({ padding: '2rem' });

    // Restore window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });
}); 