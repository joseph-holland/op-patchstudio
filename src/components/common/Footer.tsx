import { useState, useEffect } from 'react';
import { getAppVersion } from '../../utils/version';
import { useLicense } from '../../context/LicenseContext';
import { getCheckoutUrl } from '../../utils/lemonSqueezy';

export function Footer() {
  const [version, setVersion] = useState<string>('');
  const { state } = useLicense();

  useEffect(() => {
    getAppVersion().then(setVersion);
  }, []);

  const handleUpgradeClick = () => {
    window.open(getCheckoutUrl(), '_blank');
  };

  // Determine what to show in the license status area
  const renderLicenseStatus = () => {
    // Don't show anything while loading
    if (state.isLoading) {
      return null;
    }

    // Pro users - show simple badge
    if (state.isLicensed) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.375rem 0.75rem',
            backgroundColor: 'var(--color-interactive-focus)',
            color: 'white',
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            <i className="fas fa-star" style={{ fontSize: '0.65rem' }}></i>
            pro license active
          </span>
        </div>
      );
    }

    // Trial users - show days remaining and upgrade button
    if (state.isTrialActive) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          marginBottom: '1rem',
          flexWrap: 'wrap',
        }}>
          <span style={{
            color: state.trialDaysRemaining <= 3 ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
            fontSize: '0.85rem',
            fontWeight: state.trialDaysRemaining <= 3 ? '600' : '400',
          }}>
            <i className="fas fa-hourglass-half" style={{ marginRight: '0.375rem' }}></i>
            {state.trialDaysRemaining} {state.trialDaysRemaining === 1 ? 'day' : 'days'} left in free trial
          </span>
          <button
            onClick={handleUpgradeClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--color-interactive-focus)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.8rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-interactive-dark)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-interactive-focus)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <i className="fas fa-arrow-up" style={{ fontSize: '0.7rem' }}></i>
            upgrade to pro
          </button>
        </div>
      );
    }

    // Trial expired - show prominent upgrade prompt
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
      }}>
        <span style={{
          color: 'var(--color-text-secondary)',
          fontSize: '0.85rem',
        }}>
          <i className="fas fa-lock" style={{ marginRight: '0.375rem' }}></i>
          free trial ended - export & save locked
        </span>
        <button
          onClick={handleUpgradeClick}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem 1rem',
            background: 'linear-gradient(135deg, var(--color-interactive-focus) 0%, var(--color-interactive-dark) 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.8rem',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <i className="fas fa-star" style={{ fontSize: '0.7rem' }}></i>
          unlock pro features
        </button>
      </div>
    );
  };

  return (
    <footer style={{
      textAlign: 'center',
      marginTop: '3rem',
      padding: '20px',
      fontSize: '0.9rem',
      color: 'var(--color-text-tertiary)'
    }}>
      {/* License/Trial Status */}
      {renderLicenseStatus()}

      <div style={{ marginBottom: '1rem', color: 'var(--color-text-tertiary)', fontSize: '0.85rem' }}>
        OP-PatchStudio is an unofficial tool not affiliated with or endorsed by teenage engineering.<br />
        this software is provided "as is" without warranty of any kind. use at your own risk. for educational and personal use only.<br />
        OP-XY, OP-1 and OP-Z are registered trademarks of teenage engineering.<br />
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5em',
        fontSize: '0.98em'
      }}>
        <span style={{ color: 'var(--color-text-tertiary)' }}>proudly open source</span>
        <span style={{ color: 'var(--color-text-tertiary)' }}>|</span>
        <a
          href="https://github.com/joseph-holland/op-patchstudio"
          target="_blank"
          rel="noopener"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          github repo
        </a>
        <span style={{ color: 'var(--color-text-tertiary)' }}>|</span>
        {version ? (
          <a
            href="/CHANGELOG.md"
            target="_blank"
            rel="noopener"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            v{version}
          </a>
        ) : (
          <span style={{ color: 'var(--color-text-secondary)' }}>loading version...</span>
        )}

      </div>
      <div style={{ marginTop: '0.5rem' }}>
        crafted with fidelity by{' '}
        <a
          href="https://github.com/joseph-holland"
          target="_blank"
          rel="noopener"
          style={{ color: '#666' }}
        >
          joseph-holland
        </a>
      </div>
      <div style={{ marginTop: '0.5rem' }}>
        inspired by the awesome{' '}
        <a
          href="https://buba447.github.io/opxy-drum-tool/"
          target="_blank"
          rel="noopener"
          style={{ color: '#666' }}
        >
          opxy-drum-tool
        </a>
        {' '} by zeitgeese
      </div>
    </footer>
  );
}
