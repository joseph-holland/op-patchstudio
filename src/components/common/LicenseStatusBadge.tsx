import { useLicense } from '../../context/LicenseContext';

interface LicenseStatusBadgeProps {
  onClick?: () => void;
  compact?: boolean;
}

export function LicenseStatusBadge({ onClick, compact = false }: LicenseStatusBadgeProps) {
  const { state } = useLicense();

  // Don't show anything while loading
  if (state.isLoading) {
    return null;
  }

  // Licensed users - show pro badge
  if (state.isLicensed) {
    return (
      <div
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: compact ? '0.25rem 0.5rem' : '0.375rem 0.75rem',
          backgroundColor: 'var(--color-interactive-focus)',
          color: 'white',
          borderRadius: '4px',
          fontSize: compact ? '0.7rem' : '0.75rem',
          fontWeight: '600',
          cursor: onClick ? 'pointer' : 'default',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        <i className="fas fa-star" style={{ fontSize: compact ? '0.6rem' : '0.65rem' }}></i>
        pro
      </div>
    );
  }

  // Trial users - show trial status
  const isTrialLow = state.trialDaysRemaining <= 3 || state.trialExportsRemaining <= 3;
  const isTrialExpired = !state.canUsePremiumFeatures;

  if (isTrialExpired) {
    return (
      <div
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: compact ? '0.25rem 0.5rem' : '0.375rem 0.75rem',
          backgroundColor: 'var(--color-accent-primary)',
          color: 'white',
          borderRadius: '4px',
          fontSize: compact ? '0.7rem' : '0.75rem',
          fontWeight: '600',
          cursor: onClick ? 'pointer' : 'default',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        <i className="fas fa-clock" style={{ fontSize: compact ? '0.6rem' : '0.65rem' }}></i>
        trial ended
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: compact ? '0.25rem 0.5rem' : '0.375rem 0.75rem',
        backgroundColor: isTrialLow ? 'var(--color-warning, #f0ad4e)' : 'var(--color-bg-secondary)',
        color: isTrialLow ? 'white' : 'var(--color-text-secondary)',
        borderRadius: '4px',
        fontSize: compact ? '0.7rem' : '0.75rem',
        fontWeight: '500',
        cursor: onClick ? 'pointer' : 'default',
        border: isTrialLow ? 'none' : '1px solid var(--color-border-subtle)',
      }}
      title={`${state.trialDaysRemaining} days, ${state.trialExportsRemaining} exports remaining`}
    >
      <i className="fas fa-hourglass-half" style={{ fontSize: compact ? '0.6rem' : '0.65rem' }}></i>
      {compact ? (
        `${state.trialDaysRemaining}d`
      ) : (
        `trial: ${state.trialDaysRemaining}d / ${state.trialExportsRemaining} exports`
      )}
    </div>
  );
}
