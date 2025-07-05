import { useState, useEffect } from 'react';

export function AppHeader() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const titleFontSize = isMobile ? '2.1rem' : '2.8rem';
  const badgeFontSize = isMobile ? '0.65rem' : '0.9rem';
  const badgeGap = isMobile ? '12px' : '16px';
  const bottomPosition = isMobile ? '43%' : '45%';

  return (
    <header 
      role="banner"
      style={{
      marginBottom: '2rem'
      }}
    >
      <h1 style={{
        position: 'relative',
        display: 'inline-block',
        fontSize: titleFontSize,
        letterSpacing: '-0.05em',
        fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif',
        fontWeight: 300,
        color: 'var(--color-text-primary)',
        margin: 0,
        lineHeight: 1
      }}>
        OP<span style={{ margin: '0 0.1em' }}>–</span>PatchStudio
        <span 
          aria-label="unofficial version"
          style={{
          position: 'absolute',
          left: `calc(100% + ${badgeGap})`,
          bottom: bottomPosition,
          fontFamily: 'Helvetica, "Helvetica Neue", Arial, sans-serif',
          letterSpacing: '-0.008em',
          fontVariantLigatures: 'none',
          fontFeatureSettings: '"liga" 0',
          fontSize: badgeFontSize,
          fontWeight: 400,
          padding: '0.15rem 0.5rem',
          backgroundColor: 'transparent',
          color: 'var(--color-text-primary)',
          borderRadius: '4px',
          border: '1px solid var(--color-text-primary)',
          lineHeight: '1',
          whiteSpace: 'nowrap'
          }}
        >
          unofficial
        </span>
      </h1>
    </header>
  );
}