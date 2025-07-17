import React from 'react';
import { formatFileSize } from '../../utils/audio';

interface FileDetailsBadgesProps {
  duration?: number;
  fileSize?: number;
  channels?: number;
  bitDepth?: number;
  sampleRate?: number;
  isFloat?: boolean;
}

export function FileDetailsBadges({ 
  duration, 
  fileSize, 
  channels, 
  bitDepth, 
  sampleRate,
  isFloat = false
}: FileDetailsBadgesProps) {
  if (!duration || !fileSize || !channels || !bitDepth || !sampleRate) {
    return null;
  }

  const formatDuration = (seconds: number): string => {
    if (seconds < 1) {
      return `${Math.round(seconds * 1000)}ms`;
    }
    return `${seconds.toFixed(2)}s`;
  };

  const formatSampleRate = (rate: number): string => {
    return `${(rate / 1000).toFixed(1)}khz`;
  };

  const formatChannels = (channelCount: number): string => {
    return channelCount === 1 ? 'mono' : 'stereo';
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.2rem',
    background: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border-light)',
    borderRadius: '3px',
    padding: '0.1rem 0.25rem',
    fontSize: '0.7rem',
    color: 'var(--color-text-secondary)',
    fontWeight: '500',
    marginRight: '0.2rem',
    marginBottom: '0.1rem',
    whiteSpace: 'nowrap'
  };

  const iconStyle: React.CSSProperties = {
    fontSize: '0.6rem',
    opacity: 0.8
  };

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.1rem',
      alignItems: 'center'
    }}>
      {/* File Size */}
      <span style={badgeStyle}>
        <i className="fa fa-hdd" style={iconStyle}></i>
        {formatFileSize(fileSize)}
      </span>

      {/* Duration */}
      <span style={badgeStyle}>
        <i className="fa fa-clock" style={iconStyle}></i>
        {formatDuration(duration)}
      </span>

      {/* Bit Depth */}
      <span style={badgeStyle}>
        <i className="fa fa-database" style={iconStyle}></i>
        {bitDepth === 32 && isFloat ? '32-bit float' : `${bitDepth}-bit`}
      </span>

      {/* Sample Rate */}
      <span style={badgeStyle}>
        <i className="fa fa-tachometer-alt" style={iconStyle}></i>
        {formatSampleRate(sampleRate)}
      </span>

      {/* Channels */}
      <span style={badgeStyle}>
        <i className={`fa ${channels === 1 ? 'fa-volume-down' : 'fa-volume-up'}`} style={iconStyle}></i>
        {formatChannels(channels)}
      </span>
    </div>
  );
} 