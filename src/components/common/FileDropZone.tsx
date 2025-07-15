import React, { useRef } from 'react';
import { Button } from '@carbon/react';
import type { DragEvent, ChangeEvent } from 'react';

interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function FileDropZone({
  onFilesSelected,
  accept = "audio/*,.wav,.aif,.aiff,.mp3,.m4a,.ogg,.flac",
  multiple = false,
  disabled = false,
  children,
  className,
  style
}: FileDropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;
    
    const files = Array.from(e.dataTransfer.files);
    const audioFiles = files.filter(file => 
      file.type.startsWith('audio/') || 
      file.name.toLowerCase().endsWith('.wav') ||
      file.name.toLowerCase().endsWith('.aif') ||
      file.name.toLowerCase().endsWith('.aiff') ||
      file.name.toLowerCase().endsWith('.mp3') ||
      file.name.toLowerCase().endsWith('.m4a') ||
      file.name.toLowerCase().endsWith('.ogg') ||
      file.name.toLowerCase().endsWith('.flac')
    );
    
    if (audioFiles.length > 0) {
      onFilesSelected(audioFiles);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesSelected(Array.from(files));
    }
    // Reset input
    e.target.value = '';
  };

  const openFileDialog = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const defaultStyle: React.CSSProperties = {
    background: 'var(--color-bg-secondary)',
    border: '2px dashed var(--color-border-medium)',
    borderRadius: '6px',
    padding: '3rem 2rem',
    textAlign: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    opacity: disabled ? 0.6 : 1,
    ...style
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!disabled) {
      e.currentTarget.style.background = 'var(--color-border-subtle)';
      e.currentTarget.style.borderColor = 'var(--color-text-info)';
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!disabled) {
      e.currentTarget.style.background = 'var(--color-bg-secondary)';
      e.currentTarget.style.borderColor = 'var(--color-border-medium)';
    }
  };

  return (
    <>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        ref={fileInputRef}
        onChange={handleFileSelect}
        disabled={disabled}
      />
      <div
        className={className}
        style={defaultStyle}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFileDialog}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children || (
          <>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '1.1rem', marginBottom: '1rem' }}>
              {disabled ? 'processing files...' : 'drop audio files here or click to browse'}
            </div>
            <Button 
              kind="secondary"
              disabled={disabled}
            >
              {disabled ? 'loading...' : 'browse files'}
            </Button>
          </>
        )}
      </div>
    </>
  );
} 