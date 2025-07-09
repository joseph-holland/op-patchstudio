import React from 'react';

interface LibraryTableProps {
  title: string;
  headerContent?: React.ReactNode;
  footerContent?: React.ReactNode;
  style?: React.CSSProperties;
  headerStyle?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  footerStyle?: React.CSSProperties;
  isLoading?: boolean;
  loadingState?: React.ReactNode;
  emptyState?: React.ReactNode;
  tableContent?: React.ReactNode;
}

export function LibraryTable({ 
  title, 
  headerContent, 
  footerContent,
  style,
  headerStyle,
  contentStyle,
  footerStyle,
  isLoading,
  loadingState,
  emptyState,
  tableContent
}: LibraryTableProps) {
  const c = {
    bg: 'var(--color-bg-primary)',
    bgAlt: 'var(--color-bg-secondary)',
    border: 'var(--color-border-light)',
    text: 'var(--color-text-primary)',
    textSecondary: 'var(--color-text-secondary)',
    action: 'var(--color-interactive-focus)',
  };

  return (
    <div style={{
      backgroundColor: c.bg,
      borderRadius: '15px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      border: `1px solid ${c.border}`,
      overflow: 'hidden',
      fontFamily: '"Montserrat", "Arial", sans-serif',
      ...style
    }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '1rem',
        padding: '1rem',
        background: c.bgAlt,
        borderBottom: `1px solid ${c.border}`,
        alignItems: 'center',
        position: 'relative',
        ...headerStyle
      }}>
        <h2 style={{
          margin: 0,
          color: '#222',
          fontSize: '1.25rem',
          fontWeight: 300,
        }}>
          {title}
        </h2>
        
        {headerContent && (
          <div style={{ justifySelf: 'end' }}>
            {headerContent}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{
        minHeight: '400px',
        ...contentStyle
      }}>
        {isLoading
          ? (loadingState || <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: c.textSecondary }}><i className="fas fa-spinner fa-spin" style={{ marginRight: '0.5rem' }}></i>loading...</div>)
          : tableContent && tableContent
            ? tableContent
            : (emptyState || <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '200px', color: c.textSecondary, textAlign: 'center' }}><i className="fas fa-folder-open" style={{ fontSize: '2rem', marginBottom: '1rem' }}></i><p>no data found</p></div>)}
      </div>

      {/* Footer - Optional */}
      {footerContent && (
        <div style={{
          padding: '0',
          background: c.bgAlt,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '0.75rem',
          ...footerStyle
        }}>
          {footerContent}
        </div>
      )}
    </div>
  );
} 