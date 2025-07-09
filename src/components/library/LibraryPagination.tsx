interface LibraryPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isMobile: boolean;
}

export function LibraryPagination({
  currentPage,
  totalPages,
  onPageChange,
  isMobile
}: LibraryPaginationProps) {
  const baseButtonStyle = {
    minHeight: '44px',
    minWidth: '44px',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    boxSizing: 'border-box',
  } as const;

  const nextButtonStyle = {
    ...baseButtonStyle,
    backgroundColor: 'var(--color-interactive-focus)',
    color: 'var(--color-white)',
    border: 'none',
    opacity: 1,
  } as const;

  const previousButtonStyle = (disabled: boolean) => ({
    ...baseButtonStyle,
    backgroundColor: 'var(--color-bg-primary)',
    color: 'var(--color-interactive-secondary)',
    border: '1px solid var(--color-interactive-focus-ring)',
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  } as const);

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const isPreviousDisabled = currentPage === 1;
  const isNextDisabled = currentPage === totalPages || totalPages === 0;

  if (isMobile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', margin: '1rem 0' }}>
        <button
          onClick={handlePrevious}
          disabled={isPreviousDisabled}
          style={isPreviousDisabled ? previousButtonStyle(isPreviousDisabled) : previousButtonStyle(false)}
          onMouseEnter={e => {
            if (!isPreviousDisabled) {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
              e.currentTarget.style.borderColor = 'var(--color-border-medium)';
              e.currentTarget.style.color = 'var(--color-interactive-dark)';
            }
          }}
          onMouseLeave={e => {
            if (!isPreviousDisabled) {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
              e.currentTarget.style.borderColor = 'var(--color-interactive-focus-ring)';
              e.currentTarget.style.color = 'var(--color-interactive-secondary)';
            }
          }}
        >
          Previous
        </button>
        <span style={{ alignSelf: 'center', color: 'var(--color-text-secondary)', fontSize: '1rem' }}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={handleNext}
          disabled={isNextDisabled}
          style={nextButtonStyle}
          onMouseEnter={e => {
            if (!isNextDisabled) {
              e.currentTarget.style.backgroundColor = 'var(--color-interactive-dark)';
            }
          }}
          onMouseLeave={e => {
            if (!isNextDisabled) {
              e.currentTarget.style.backgroundColor = 'var(--color-interactive-focus)';
            }
          }}
        >
          Next
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        background: 'var(--color-bg-primary)',
        borderTop: '1px solid var(--color-border-light)',
        padding: '1.75rem',
        minHeight: 0,
        margin: 0,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <button
        onClick={handlePrevious}
        disabled={isPreviousDisabled}
        style={previousButtonStyle(isPreviousDisabled)}
        onMouseEnter={e => {
          if (!isPreviousDisabled) {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
            e.currentTarget.style.borderColor = 'var(--color-border-medium)';
            e.currentTarget.style.color = 'var(--color-interactive-dark)';
          }
        }}
        onMouseLeave={e => {
          if (!isPreviousDisabled) {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
            e.currentTarget.style.borderColor = 'var(--color-interactive-focus-ring)';
            e.currentTarget.style.color = 'var(--color-interactive-secondary)';
          }
        }}
      >
        Previous
      </button>
      <span style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', margin: '0 1.5rem' }}>
        Page {currentPage} of {totalPages}
      </span>
      <button
        onClick={handleNext}
        disabled={isNextDisabled}
        style={nextButtonStyle}
        onMouseEnter={e => {
          if (!isNextDisabled) {
            e.currentTarget.style.backgroundColor = 'var(--color-interactive-dark)';
          }
        }}
        onMouseLeave={e => {
          if (!isNextDisabled) {
            e.currentTarget.style.backgroundColor = 'var(--color-interactive-focus)';
          }
        }}
      >
        Next
      </button>
    </div>
  );
} 