import React from 'react';

interface ErrorDisplayProps {
  message: string;
  style?: React.CSSProperties;
}

export function ErrorDisplay({ message, style }: ErrorDisplayProps) {
  if (!message) return null;

  const defaultStyle: React.CSSProperties = {
    background: 'var(--color-bg-panel)',
    border: '1px solid var(--color-border-light)',
    borderRadius: '3px',
    padding: '1rem',
    marginBottom: '1rem',
    color: 'var(--color-text-secondary)',
    fontSize: '0.9rem',
    ...style
  };

  return (
    <div style={defaultStyle}>
              <i className="fas fa-exclamation-triangle" style={{ marginRight: '0.5rem', color: 'var(--color-text-secondary)' }}></i>
      {message}
    </div>
  );
} 