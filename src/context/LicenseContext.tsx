import { createContext, useContext, useReducer, useEffect, useCallback, type ReactNode } from 'react';
import type { LicenseState, LicenseAction, LicenseInfo, TrialInfo } from '../types/license';
import { TRIAL_CONSTANTS } from '../types/license';
import {
  licenseStorage,
  calculateTrialDaysRemaining,
  calculateTrialExportsRemaining,
  isTrialExpired,
} from '../utils/licenseStorage';
import {
  activateLicense,
  validateLicense,
  deactivateLicense,
  activationResponseToLicenseInfo,
  updateLicenseFromValidation,
  isLicenseValid,
} from '../utils/lemonSqueezy';

// Initial trial state
const initialTrialState: TrialInfo = {
  installDate: Date.now(),
  multisampleExportsUsed: 0,
  maxTrialExports: TRIAL_CONSTANTS.MAX_EXPORTS,
  trialDurationDays: TRIAL_CONSTANTS.DURATION_DAYS,
};

// Calculate derived state from license and trial info
function calculateDerivedState(license: LicenseInfo | null, trial: TrialInfo): {
  isTrialActive: boolean;
  isLicensed: boolean;
  canUsePremiumFeatures: boolean;
  trialDaysRemaining: number;
  trialExportsRemaining: number;
} {
  const isLicensed = isLicenseValid(license);
  const trialDaysRemaining = calculateTrialDaysRemaining(trial);
  const trialExportsRemaining = calculateTrialExportsRemaining(trial);
  const isTrialActive = !isTrialExpired(trial);
  const canUsePremiumFeatures = isLicensed || isTrialActive;

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
  validateCurrentLicense: () => Promise<boolean>;
  deactivateCurrentLicense: () => Promise<boolean>;
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

        // Load existing license
        const license = await licenseStorage.getLicense();
        if (license) {
          dispatch({ type: 'SET_LICENSE', payload: license });

          // Validate license in background (don't block initialization)
          // Only validate if license was last validated more than 24 hours ago
          const dayInMs = 24 * 60 * 60 * 1000;
          if (Date.now() - license.lastValidatedAt > dayInMs) {
            validateLicense(license.licenseKey, license.instanceId)
              .then((response) => {
                if (response.valid) {
                  const updatedLicense = updateLicenseFromValidation(license, response);
                  dispatch({ type: 'SET_LICENSE', payload: updatedLicense });
                  licenseStorage.saveLicense(updatedLicense);
                } else {
                  // License no longer valid
                  dispatch({ type: 'SET_LICENSE', payload: { ...license, status: 'inactive' } });
                }
              })
              .catch((error) => {
                console.warn('Background license validation failed:', error);
                // Don't invalidate license on network errors
              });
          }
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

  // Activate a license key
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

  // Validate current license
  const validateCurrentLicense = useCallback(async (): Promise<boolean> => {
    if (!state.license) return false;

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await validateLicense(state.license.licenseKey, state.license.instanceId);

      if (response.valid) {
        const updatedLicense = updateLicenseFromValidation(state.license, response);
        await licenseStorage.saveLicense(updatedLicense);
        dispatch({ type: 'SET_LICENSE', payload: updatedLicense });
        return true;
      } else {
        const errorMessage = response.error || 'License is no longer valid';
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        // Update status to inactive
        const updatedLicense = { ...state.license, status: 'inactive' as const };
        await licenseStorage.saveLicense(updatedLicense);
        dispatch({ type: 'SET_LICENSE', payload: updatedLicense });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to validate license';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.license]);

  // Deactivate current license
  const deactivateCurrentLicense = useCallback(async (): Promise<boolean> => {
    if (!state.license) return false;

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await deactivateLicense(state.license.licenseKey, state.license.instanceId);

      if (response.deactivated) {
        await licenseStorage.clearLicense();
        dispatch({ type: 'RESET_LICENSE' });
        return true;
      } else {
        const errorMessage = response.error || 'Failed to deactivate license';
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to deactivate license';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.license]);

  // Increment export count and persist
  const incrementExportCount = useCallback(async (): Promise<void> => {
    try {
      const updatedTrial = await licenseStorage.incrementExportCount();
      dispatch({ type: 'SET_TRIAL', payload: updatedTrial });
    } catch (error) {
      console.error('Failed to increment export count:', error);
    }
  }, []);

  // Check if user can export (for UI blocking)
  const checkCanExport = useCallback((): { allowed: boolean; reason?: string } => {
    // Licensed users can always export
    if (state.isLicensed) {
      return { allowed: true };
    }

    // Check trial status
    if (state.trialDaysRemaining <= 0) {
      return {
        allowed: false,
        reason: 'Your 14-day free trial has ended. Please upgrade to continue exporting multisamples.',
      };
    }

    if (state.trialExportsRemaining <= 0) {
      return {
        allowed: false,
        reason: `You've used all ${state.trial.maxTrialExports} trial exports. Please upgrade to continue.`,
      };
    }

    return { allowed: true };
  }, [state.isLicensed, state.trialDaysRemaining, state.trialExportsRemaining, state.trial.maxTrialExports]);

  const value: LicenseContextValue = {
    state,
    activateLicenseKey,
    validateCurrentLicense,
    deactivateCurrentLicense,
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
