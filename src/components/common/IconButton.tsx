import React from 'react';

interface IconButtonProps {
  icon: string; // FontAwesome icon class, e.g. 'fas fa-play'
  onClick?: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  title?: string;
  disabled?: boolean;
  color?: string; // CSS color value, defaults to var(--color-text-secondary)
}

export const IconButton: React.FC<IconButtonProps> = ({ icon, onClick, title, disabled, color }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    disabled={disabled}
    style={{
      width: '44px',
      height: '44px',
      minWidth: '44px',
      minHeight: '44px',
      maxWidth: '44px',
      maxHeight: '44px',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px solid var(--color-border-light)',
      borderRadius: '3px',
      backgroundColor: 'var(--color-bg-primary)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      flexShrink: 0,
      color: color || 'var(--color-text-secondary)',
      opacity: disabled ? 0.5 : 1,
      transition: 'opacity 0.2s',
    }}
    aria-label={title}
  >
    <i className={icon} style={{ fontSize: '18px', pointerEvents: 'none' }}></i>
  </button>
); 