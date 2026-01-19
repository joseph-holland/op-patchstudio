// License types for LemonSqueezy integration

export type LicenseStatus = 'active' | 'inactive' | 'expired' | 'disabled';

export interface LicenseInfo {
  // License key provided by user
  licenseKey: string;
  // Instance ID from LemonSqueezy activation
  instanceId: string;
  // License status from validation
  status: LicenseStatus;
  // Customer email (if provided by API)
  customerEmail?: string;
  // Customer name (if provided by API)
  customerName?: string;
  // Product name from LemonSqueezy
  productName?: string;
  // Variant name (e.g., "Personal", "Commercial")
  variantName?: string;
  // When the license was activated locally
  activatedAt: number;
  // When the license was last validated
  lastValidatedAt: number;
  // Expiration date (if subscription)
  expiresAt?: number;
}

export interface TrialInfo {
  // When the app was first installed/used
  installDate: number;
  // Number of multisample exports/saves used
  multisampleExportsUsed: number;
  // Maximum exports allowed during trial
  maxTrialExports: number;
  // Trial duration in days
  trialDurationDays: number;
}

export interface LicenseState {
  // Current license info (null if not licensed)
  license: LicenseInfo | null;
  // Trial information
  trial: TrialInfo;
  // Whether user is in valid trial period
  isTrialActive: boolean;
  // Whether user has valid license
  isLicensed: boolean;
  // Whether user can use premium features (licensed or trial active)
  canUsePremiumFeatures: boolean;
  // Days remaining in trial (0 if expired)
  trialDaysRemaining: number;
  // Exports remaining in trial (0 if exhausted)
  trialExportsRemaining: number;
  // Loading state for license operations
  isLoading: boolean;
  // Error message from license operations
  error: string | null;
}

// LemonSqueezy API response types
export interface LemonSqueezyActivateResponse {
  activated: boolean;
  error?: string;
  license_key?: {
    id: number;
    status: string;
    key: string;
    activation_limit: number;
    activation_usage: number;
    created_at: string;
    expires_at: string | null;
  };
  instance?: {
    id: string;
    name: string;
    created_at: string;
  };
  meta?: {
    store_id: number;
    order_id: number;
    order_item_id: number;
    product_id: number;
    product_name: string;
    variant_id: number;
    variant_name: string;
    customer_id: number;
    customer_name: string;
    customer_email: string;
  };
}

export interface LemonSqueezyValidateResponse {
  valid: boolean;
  error?: string;
  license_key?: {
    id: number;
    status: string;
    key: string;
    activation_limit: number;
    activation_usage: number;
    created_at: string;
    expires_at: string | null;
  };
  instance?: {
    id: string;
    name: string;
    created_at: string;
  };
  meta?: {
    store_id: number;
    order_id: number;
    order_item_id: number;
    product_id: number;
    product_name: string;
    variant_id: number;
    variant_name: string;
    customer_id: number;
    customer_name: string;
    customer_email: string;
  };
}

export interface LemonSqueezyDeactivateResponse {
  deactivated: boolean;
  error?: string;
}

// License context actions
export type LicenseAction =
  | { type: 'SET_LICENSE'; payload: LicenseInfo | null }
  | { type: 'SET_TRIAL'; payload: TrialInfo }
  | { type: 'INCREMENT_EXPORT_COUNT' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_LICENSE' };

// Trial constants
export const TRIAL_CONSTANTS = {
  MAX_EXPORTS: 10,
  DURATION_DAYS: 14,
} as const;
