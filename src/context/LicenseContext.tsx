import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react';
import type { LicenseState, LicenseAction, LicenseInfo, TrialInfo } from '../types/license';
import { TRIAL_CONSTANTS } from '../types/license';
import {
  licenseStorage,
  calculateTrialDaysRemaining,
} from '../utils/licenseStorage';
import {
  activateLicense,
  activationResponseToLicenseInfo,
} from '../utils/lemonSqueezy';

// Initial trial state
const initialTrialState: TrialInfo = {
  installDate: Date.now(),
  multisampleExportsUsed: 0,
  maxTrialExports: TRIAL_CONSTANTS.MAX_EXPORTS,
  trialDurationDays: TRIAL_CONSTANTS.DURATION_DAYS,
};

// Calculate derived state from license and trial info
// Freemium model: 14-day full trial, then basic features free, premium locked
function calculateDerivedState(license: LicenseInfo | null, trial: TrialInfo): {
  isTrialActive: boolean;
  isLicensed: boolean;
  canUsePremiumFeatures: boolean;
  trialDaysRemaining: number;
  trialExportsRemaining: number;
} {
  // License is valid if it exists and has 'active' status
  // Once activated, we trust the local data forever (no re-validation)
  const isLicensed = license !== null && license.status === 'active';
  const trialDaysRemaining = calculateTrialDaysRemaining(trial);
  const isTrialActive = trialDaysRemaining > 0;
  const canUsePremiumFeatures = isLicensed || isTrialActive;

  // Export count no longer matters for freemium - only days
  const trialExportsRemaining = isTrialActive ?
    Math.max(0, trial.maxTrialExports - trial.multisampleExportsUsed) : 0;

  return {
    isTrialActive,
    isLicensed,
    canUsePremiumFeatures,
    trialDaysRemaining,
    trialExportsRemaining,
  };
}

// Initial state
const initialState: LicenseState = {
  license: null,
  trial: initialTrialState,
  ...calculateDerivedState(null, initialTrialState),
  isLoading: true,
  error: null,
};

// Reducer
function licenseReducer(state: LicenseState, action: LicenseAction): LicenseState {
  switch (action.type) {
    case 'SET_LICENSE': {
      const newState = {
        ...state,
        license: action.payload,
        ...calculateDerivedState(action.payload, state.trial),
      };
      return newState;
    }

    case 'SET_TRIAL': {
      const newState = {
        ...state,
        trial: action.payload,
        ...calculateDerivedState(state.license, action.payload),
      };
      return newState;
    }

    case 'INCREMENT_EXPORT_COUNT': {
      const updatedTrial = {
        ...state.trial,
        multisampleExportsUsed: state.trial.multisampleExportsUsed + 1,
      };
      return {
        ...state,
        trial: updatedTrial,
        ...calculateDerivedState(state.license, updatedTrial),
      };
    }

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'RESET_LICENSE':
      return {
        ...initialState,
        trial: state.trial, // Keep trial info
        ...calculateDerivedState(null, state.trial),
        isLoading: false,
      };

    default:
      return state;
  }
}

// Context
interface LicenseContextValue {
  state: LicenseState;
  activateLicenseKey: (licenseKey: string) => Promise<boolean>;
  clearLicense: () => Promise<void>;
  incrementExportCount: () => Promise<void>;
  checkCanExport: () => { allowed: boolean; reason?: string };
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

// Provider component
export function LicenseContextProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(licenseReducer, initialState);

  // Initialize license and trial data on mount
  useEffect(() => {
    async function initializeLicenseData() {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });

        // Initialize trial (creates if doesn't exist)
        const trial = await licenseStorage.initializeTrialIfNeeded();
        dispatch({ type: 'SET_TRIAL', payload: trial });

        // Load existing license - trust it completely, no re-validation
        const license = await licenseStorage.getLicense();
        if (license) {
          dispatch({ type: 'SET_LICENSE', payload: license });
        }
      } catch (error) {
        console.error('Failed to initialize license data:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load license information' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }

    initializeLicenseData();
  }, []);

  // Activate a license key - validates ONCE with LemonSqueezy, then trusts local data forever
  const activateLicenseKey = useCallback(async (licenseKey: string): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await activateLicense(licenseKey);

      if (response.activated && response.instance) {
        const licenseInfo = activationResponseToLicenseInfo(response, licenseKey);
        if (licenseInfo) {
          await licenseStorage.saveLicense(licenseInfo);
          dispatch({ type: 'SET_LICENSE', payload: licenseInfo });
          return true;
        }
      }

      const errorMessage = response.error || 'Failed to activate license';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to activate license';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Clear license locally (for testing or user request)
  const clearLicense = useCallback(async (): Promise<void> => {
    await licenseStorage.clearLicense();
    dispatch({ type: 'RESET_LICENSE' });
  }, []);

  // Increment export count and persist (for analytics, not blocking)
  const incrementExportCount = useCallback(async (): Promise<void> => {
    try {
      const updatedTrial = await licenseStorage.incrementExportCount();
      dispatch({ type: 'SET_TRIAL', payload: updatedTrial });
    } catch (error) {
      console.error('Failed to increment export count:', error);
    }
  }, []);

  // Check if user can use premium features (export/download/save)
  // Freemium model: 14-day trial with full access, then locked
  const checkCanExport = useCallback((): { allowed: boolean; reason?: string } => {
    // Licensed users can always export
    if (state.isLicensed) {
      return { allowed: true };
    }

    // During trial period - full access
    if (state.trialDaysRemaining > 0) {
      return { allowed: true };
    }

    // Trial expired - premium features locked
    return {
      allowed: false,
      reason: 'Your 14-day free trial has ended. Upgrade to Pro to export and save multisamples.',
    };
  }, [state.isLicensed, state.trialDaysRemaining]);

  const value: LicenseContextValue = {
    state,
    activateLicenseKey,
    clearLicense,
    incrementExportCount,
    checkCanExport,
  };

  return (
    <LicenseContext.Provider value={value}>
      {children}
    </LicenseContext.Provider>
  );
}

// Hook to use license context
export function useLicense() {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicense must be used within LicenseContextProvider');
  }
  return context;
}
