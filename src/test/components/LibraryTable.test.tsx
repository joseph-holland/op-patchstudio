import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LibraryTable } from '../../components/common/LibraryTable';

describe('LibraryTable', () => {
  it('should render with title', () => {
    render(<LibraryTable title="test section" tableContent={"content"} />);
    
    expect(screen.getByText('test section')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('should render with header content', () => {
    render(
      <LibraryTable 
        title="test section" 
        headerContent={<button>header button</button>}
        tableContent={"content"}
      />
    );
    
    expect(screen.getByText('test section')).toBeInTheDocument();
    expect(screen.getByText('header button')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('should render with footer content', () => {
    render(
      <LibraryTable 
        title="test section" 
        footerContent={<button>footer button</button>}
        tableContent={"content"}
      />
    );
    
    expect(screen.getByText('test section')).toBeInTheDocument();
    expect(screen.getByText('footer button')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('should render with both header and footer content', () => {
    render(
      <LibraryTable 
        title="test section" 
        headerContent={<button>header button</button>}
        footerContent={<button>footer button</button>}
        tableContent={"content"}
      />
    );
    
    expect(screen.getByText('test section')).toBeInTheDocument();
    expect(screen.getByText('header button')).toBeInTheDocument();
    expect(screen.getByText('footer button')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });
}); 