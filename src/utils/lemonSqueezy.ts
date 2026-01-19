// LemonSqueezy License API utilities
// Documentation: https://docs.lemonsqueezy.com/api/license-api

import type {
  LemonSqueezyActivateResponse,
  LemonSqueezyValidateResponse,
  LemonSqueezyDeactivateResponse,
  LicenseInfo,
  LicenseStatus,
} from '../types/license';

// LemonSqueezy License API base URL
const LEMONSQUEEZY_API_URL = 'https://api.lemonsqueezy.com/v1/licenses';

// Get instance name for this device/browser
function getInstanceName(): string {
  // Create a somewhat unique identifier for this browser instance
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  const language = navigator.language;

  // Create a simple hash of browser info
  const browserInfo = `${userAgent}-${platform}-${language}`;
  let hash = 0;
  for (let i = 0; i < browserInfo.length; i++) {
    const char = browserInfo.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return `OP-PatchStudio-Web-${Math.abs(hash).toString(16)}`;
}

/**
 * Activate a license key with LemonSqueezy
 * @param licenseKey The license key to activate
 * @returns Activation response from LemonSqueezy
 */
export async function activateLicense(licenseKey: string): Promise<LemonSqueezyActivateResponse> {
  const instanceName = getInstanceName();

  const response = await fetch(`${LEMONSQUEEZY_API_URL}/activate`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      license_key: licenseKey,
      instance_name: instanceName,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`License activation failed: ${errorText}`);
  }

  return response.json();
}

/**
 * Validate an activated license
 * @param licenseKey The license key to validate
 * @param instanceId The instance ID from activation
 * @returns Validation response from LemonSqueezy
 */
export async function validateLicense(
  licenseKey: string,
  instanceId: string
): Promise<LemonSqueezyValidateResponse> {
  const response = await fetch(`${LEMONSQUEEZY_API_URL}/validate`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      license_key: licenseKey,
      instance_id: instanceId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`License validation failed: ${errorText}`);
  }

  return response.json();
}

/**
 * Deactivate a license instance
 * @param licenseKey The license key to deactivate
 * @param instanceId The instance ID to deactivate
 * @returns Deactivation response from LemonSqueezy
 */
export async function deactivateLicense(
  licenseKey: string,
  instanceId: string
): Promise<LemonSqueezyDeactivateResponse> {
  const response = await fetch(`${LEMONSQUEEZY_API_URL}/deactivate`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      license_key: licenseKey,
      instance_id: instanceId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`License deactivation failed: ${errorText}`);
  }

  return response.json();
}

/**
 * Convert LemonSqueezy status to our LicenseStatus type
 */
function convertStatus(status: string): LicenseStatus {
  switch (status.toLowerCase()) {
    case 'active':
      return 'active';
    case 'inactive':
      return 'inactive';
    case 'expired':
      return 'expired';
    case 'disabled':
      return 'disabled';
    default:
      return 'inactive';
  }
}

/**
 * Convert LemonSqueezy activation response to LicenseInfo
 */
export function activationResponseToLicenseInfo(
  response: LemonSqueezyActivateResponse,
  licenseKey: string
): LicenseInfo | null {
  if (!response.activated || !response.instance) {
    return null;
  }

  return {
    licenseKey,
    instanceId: response.instance.id,
    status: response.license_key ? convertStatus(response.license_key.status) : 'active',
    customerEmail: response.meta?.customer_email,
    customerName: response.meta?.customer_name,
    productName: response.meta?.product_name,
    variantName: response.meta?.variant_name,
    activatedAt: Date.now(),
    lastValidatedAt: Date.now(),
    expiresAt: response.license_key?.expires_at
      ? new Date(response.license_key.expires_at).getTime()
      : undefined,
  };
}

/**
 * Update LicenseInfo from validation response
 */
export function updateLicenseFromValidation(
  currentLicense: LicenseInfo,
  response: LemonSqueezyValidateResponse
): LicenseInfo {
  return {
    ...currentLicense,
    status: response.license_key ? convertStatus(response.license_key.status) :
            (response.valid ? 'active' : 'inactive'),
    lastValidatedAt: Date.now(),
    expiresAt: response.license_key?.expires_at
      ? new Date(response.license_key.expires_at).getTime()
      : currentLicense.expiresAt,
  };
}

/**
 * Check if a license is currently valid
 */
export function isLicenseValid(license: LicenseInfo | null): boolean {
  if (!license) return false;

  // Check status
  if (license.status !== 'active') return false;

  // Check expiration if set
  if (license.expiresAt && license.expiresAt < Date.now()) return false;

  return true;
}

/**
 * Get the LemonSqueezy checkout URL for purchasing a license
 * This should be configured with your actual LemonSqueezy product checkout link
 */
export function getCheckoutUrl(): string {
  // This should be replaced with your actual LemonSqueezy checkout URL
  // You can find this in your LemonSqueezy dashboard under Products > Your Product > Share
  const checkoutUrl = import.meta.env.VITE_LEMONSQUEEZY_CHECKOUT_URL;

  if (!checkoutUrl) {
    // Fallback to a placeholder - this should be configured
    console.warn('LemonSqueezy checkout URL not configured. Set VITE_LEMONSQUEEZY_CHECKOUT_URL');
    return 'https://op-patch.studio/upgrade';
  }

  return checkoutUrl;
}

/**
 * Get the LemonSqueezy customer portal URL for managing subscriptions
 */
export function getCustomerPortalUrl(): string {
  const portalUrl = import.meta.env.VITE_LEMONSQUEEZY_PORTAL_URL;

  if (!portalUrl) {
    console.warn('LemonSqueezy portal URL not configured. Set VITE_LEMONSQUEEZY_PORTAL_URL');
    return 'https://app.lemonsqueezy.com/my-orders';
  }

  return portalUrl;
}
