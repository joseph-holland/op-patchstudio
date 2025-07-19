import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DonatePage } from '../../components/common/DonatePage';

describe('DonatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render donate page with headers', () => {
    render(<DonatePage />);
    
    expect(screen.getByText('support the project')).toBeInTheDocument();
    expect(screen.getByText('latest posts')).toBeInTheDocument();
  });

  it('should render support text and links', () => {
    render(<DonatePage />);
    
    // Check main text content
    expect(screen.getByText(/OP-PatchStudio is a 100% free and/)).toBeInTheDocument();
    
    // Check links
    const githubLink = screen.getByText('open-source');
    expect(githubLink).toHaveAttribute('href', 'https://github.com/joseph-holland/op-patchstudio');
    
    const patreonLink = screen.getByText('project patreon');
    expect(patreonLink).toHaveAttribute('href', 'https://www.patreon.com/c/oppatchstudio');
  });

  it('should render support buttons', () => {
    render(<DonatePage />);
    
    const patreonButton = screen.getByText('support on patreon');
    expect(patreonButton).toHaveAttribute('href', 'https://www.patreon.com/c/oppatchstudio');
    
    const coffeeButton = screen.getByText('buy me a coffee');
    expect(coffeeButton).toHaveAttribute('href', 'https://buymeacoffee.com/jxavierh');
  });

  it('should handle mobile layout', () => {
    // Mock window.innerWidth
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500, // Mobile width
    });
    
    render(<DonatePage />);
    
    // Check if mobile styles are applied to the content divs
    const contentDivs = screen.getAllByText(/support the project|latest posts/)
      .map(heading => heading.closest('div')?.parentElement?.nextElementSibling)
      .filter(Boolean);
    
    contentDivs.forEach(div => {
      expect(div).toHaveStyle({ padding: '1rem' });
    });

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
    
    render(<DonatePage />);
    
    // Check if desktop styles are applied to the content divs
    const contentDivs = screen.getAllByText(/support the project|latest posts/)
      .map(heading => heading.closest('div')?.parentElement?.nextElementSibling)
      .filter(Boolean);
    
    contentDivs.forEach(div => {
      expect(div).toHaveStyle({ padding: '2rem' });
    });

    // Restore window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });
}); 