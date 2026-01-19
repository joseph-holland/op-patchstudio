import { useState } from 'react';
import { useLicense } from '../../context/LicenseContext';
import { getCheckoutUrl } from '../../utils/lemonSqueezy';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
}

export function UpgradeModal({ isOpen, onClose, reason }: UpgradeModalProps) {
  const { state, activateLicenseKey } = useLicense();
  const [licenseKey, setLicenseKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [showLicenseInput, setShowLicenseInput] = useState(false);

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setActivationError('Please enter a license key');
      return;
    }

    setIsActivating(true);
    setActivationError(null);

    const success = await activateLicenseKey(licenseKey.trim());

    if (success) {
      setLicenseKey('');
      setShowLicenseInput(false);
      onClose();
    } else {
      setActivationError(state.error || 'Failed to activate license');
    }

    setIsActivating(false);
  };

  const handlePurchase = () => {
    window.open(getCheckoutUrl(), '_blank');
  };

  const handleClose = () => {
    setLicenseKey('');
    setActivationError(null);
    setShowLicenseInput(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: '"Montserrat", "Arial", sans-serif',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderRadius: '15px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          maxWidth: '480px',
          width: '90%',
          margin: '0 1rem',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem 1.5rem 1rem 1.5rem',
            borderBottom: '1px solid var(--color-border-subtle)',
            background: 'linear-gradient(135deg, var(--color-interactive-focus) 0%, var(--color-interactive-dark) 100%)',
          }}
        >
          <h3
            style={{
              margin: '0',
              fontSize: '1.35rem',
              fontWeight: '400',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <i className="fas fa-star" style={{ fontSize: '1.25rem' }}></i>
            upgrade to pro
          </h3>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Reason message */}
          {reason && (
            <div
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: '6px',
                padding: '1rem',
                marginBottom: '1.5rem',
                color: 'var(--color-text-secondary)',
                fontSize: '0.95rem',
                lineHeight: '1.5',
              }}
            >
              {reason}
            </div>
          )}

          {/* Trial status - only show if trial is active or recently expired */}
          {state.trialDaysRemaining > 0 ? (
            <div
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: '6px',
                padding: '1rem',
                marginBottom: '1.5rem',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  color: state.trialDaysRemaining <= 3 ? 'var(--color-accent-primary)' : 'var(--color-interactive-focus)',
                }}
              >
                {state.trialDaysRemaining} {state.trialDaysRemaining === 1 ? 'day' : 'days'}
              </div>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--color-text-secondary)',
                  marginTop: '0.25rem',
                }}
              >
                remaining in your free trial
              </div>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: '6px',
                padding: '1rem',
                marginBottom: '1.5rem',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '1rem',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <i className="fas fa-clock" style={{ marginRight: '0.5rem' }}></i>
                your 14-day free trial has ended
              </div>
            </div>
          )}

          {/* What's locked */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4
              style={{
                margin: '0 0 0.75rem 0',
                fontSize: '0.95rem',
                fontWeight: '500',
                color: 'var(--color-text-primary)',
              }}
            >
              pro unlocks:
            </h4>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.25rem',
                color: 'var(--color-text-secondary)',
                fontSize: '0.9rem',
                lineHeight: '1.8',
              }}
            >
              <li>export & download multisample presets</li>
              <li>save multisamples to library</li>
              <li>send presets to OP-XY</li>
              <li>file manager & backup features</li>
              <li>future pro features as they're added</li>
            </ul>
          </div>

          {/* Free forever note */}
          <div
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: '6px',
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              fontSize: '0.85rem',
              color: 'var(--color-text-secondary)',
            }}
          >
            <i className="fas fa-check-circle" style={{ color: 'var(--color-interactive-focus)', marginRight: '0.5rem' }}></i>
            basic multisample editing & drum tool remain <strong>free forever</strong>
          </div>

          {/* License activation section */}
          {showLicenseInput ? (
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  color: 'var(--color-text-secondary)',
                  marginBottom: '0.5rem',
                }}
              >
                enter your license key:
              </label>
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                disabled={isActivating}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: activationError ? '1px solid var(--color-accent-primary)' : '1px solid var(--color-border-medium)',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  fontFamily: 'monospace',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  boxSizing: 'border-box',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isActivating) {
                    handleActivate();
                  }
                }}
              />
              {activationError && (
                <div
                  style={{
                    color: 'var(--color-accent-primary)',
                    fontSize: '0.8rem',
                    marginTop: '0.5rem',
                  }}
                >
                  {activationError}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div
          style={{
            padding: '1rem 1.5rem 1.5rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {showLicenseInput ? (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => {
                  setShowLicenseInput(false);
                  setLicenseKey('');
                  setActivationError(null);
                }}
                disabled={isActivating}
                style={{
                  flex: 1,
                  padding: '0.75rem 1.25rem',
                  border: '1px solid var(--color-border-medium)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-bg-primary)',
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  cursor: isActivating ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                }}
              >
                back
              </button>
              <button
                onClick={handleActivate}
                disabled={isActivating || !licenseKey.trim()}
                style={{
                  flex: 2,
                  padding: '0.75rem 1.25rem',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: isActivating || !licenseKey.trim() ? 'var(--color-border-medium)' : 'var(--color-interactive-focus)',
                  color: 'white',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  cursor: isActivating || !licenseKey.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                {isActivating && <i className="fas fa-spinner fa-spin"></i>}
                {isActivating ? 'activating...' : 'activate license'}
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handlePurchase}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.25rem',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, var(--color-interactive-focus) 0%, var(--color-interactive-dark) 100%)',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <i className="fas fa-shopping-cart"></i>
                purchase pro license
              </button>
              <div
                style={{
                  textAlign: 'center',
                  fontSize: '0.8rem',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                14-day money back guarantee
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setShowLicenseInput(true)}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1.25rem',
                    border: '1px solid var(--color-border-medium)',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-bg-primary)',
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                  }}
                >
                  i have a license key
                </button>
                <button
                  onClick={handleClose}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1.25rem',
                    border: '1px solid var(--color-border-medium)',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-bg-primary)',
                    color: 'var(--color-text-secondary)',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-primary)';
                  }}
                >
                  maybe later
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
