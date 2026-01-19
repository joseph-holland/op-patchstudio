// License storage utilities using IndexedDB
// Stores license information and trial data persistently

import type { LicenseInfo, TrialInfo } from '../types/license';
import { TRIAL_CONSTANTS } from '../types/license';

// Database configuration for license storage
const LICENSE_DB_NAME = 'op-patchstudio-license';
const LICENSE_DB_VERSION = 1;

// Store names
const STORES = {
  LICENSE: 'license',
  TRIAL: 'trial',
} as const;

// Keys for stored data
const KEYS = {
  LICENSE_INFO: 'license-info',
  TRIAL_INFO: 'trial-info',
} as const;

class LicenseStorageManager {
  private db: IDBDatabase | null = null;
  private static instance: LicenseStorageManager;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): LicenseStorageManager {
    if (!LicenseStorageManager.instance) {
      LicenseStorageManager.instance = new LicenseStorageManager();
    }
    return LicenseStorageManager.instance;
  }

  // Initialize database
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(LICENSE_DB_NAME, LICENSE_DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open license IndexedDB:', request.error);
        this.initPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create license store
        if (!db.objectStoreNames.contains(STORES.LICENSE)) {
          db.createObjectStore(STORES.LICENSE, { keyPath: 'key' });
        }

        // Create trial store
        if (!db.objectStoreNames.contains(STORES.TRIAL)) {
          db.createObjectStore(STORES.TRIAL, { keyPath: 'key' });
        }
      };
    });

    return this.initPromise;
  }

  // Ensure database is initialized
  private async ensureInit(): Promise<void> {
    if (!this.db) {
      await this.init();
    }
  }

  // License operations
  async saveLicense(license: LicenseInfo): Promise<void> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.LICENSE], 'readwrite');
      const store = transaction.objectStore(STORES.LICENSE);
      const request = store.put({ key: KEYS.LICENSE_INFO, ...license });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getLicense(): Promise<LicenseInfo | null> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.LICENSE], 'readonly');
      const store = transaction.objectStore(STORES.LICENSE);
      const request = store.get(KEYS.LICENSE_INFO);

      request.onsuccess = () => {
        if (request.result) {
          // Remove the 'key' property before returning
          const { key: _key, ...licenseData } = request.result;
          resolve(licenseData as LicenseInfo);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearLicense(): Promise<void> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.LICENSE], 'readwrite');
      const store = transaction.objectStore(STORES.LICENSE);
      const request = store.delete(KEYS.LICENSE_INFO);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Trial operations
  async saveTrial(trial: TrialInfo): Promise<void> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.TRIAL], 'readwrite');
      const store = transaction.objectStore(STORES.TRIAL);
      const request = store.put({ key: KEYS.TRIAL_INFO, ...trial });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getTrial(): Promise<TrialInfo | null> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.TRIAL], 'readonly');
      const store = transaction.objectStore(STORES.TRIAL);
      const request = store.get(KEYS.TRIAL_INFO);

      request.onsuccess = () => {
        if (request.result) {
          // Remove the 'key' property before returning
          const { key: _key, ...trialData } = request.result;
          resolve(trialData as TrialInfo);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async incrementExportCount(): Promise<TrialInfo> {
    await this.ensureInit();

    let trial = await this.getTrial();

    if (!trial) {
      // Initialize trial if it doesn't exist
      trial = {
        installDate: Date.now(),
        multisampleExportsUsed: 0,
        maxTrialExports: TRIAL_CONSTANTS.MAX_EXPORTS,
        trialDurationDays: TRIAL_CONSTANTS.DURATION_DAYS,
      };
    }

    trial.multisampleExportsUsed += 1;
    await this.saveTrial(trial);

    return trial;
  }

  async initializeTrialIfNeeded(): Promise<TrialInfo> {
    await this.ensureInit();

    let trial = await this.getTrial();

    if (!trial) {
      trial = {
        installDate: Date.now(),
        multisampleExportsUsed: 0,
        maxTrialExports: TRIAL_CONSTANTS.MAX_EXPORTS,
        trialDurationDays: TRIAL_CONSTANTS.DURATION_DAYS,
      };
      await this.saveTrial(trial);
    }

    return trial;
  }

  // Clear all license data (for testing or reset)
  async clearAll(): Promise<void> {
    await this.ensureInit();

    const stores = [STORES.LICENSE, STORES.TRIAL];

    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }
}

// Export singleton instance
export const licenseStorage = LicenseStorageManager.getInstance();

// Helper functions for trial calculations
export function calculateTrialDaysRemaining(trial: TrialInfo): number {
  const now = Date.now();
  const trialEndDate = trial.installDate + (trial.trialDurationDays * 24 * 60 * 60 * 1000);
  const msRemaining = trialEndDate - now;

  if (msRemaining <= 0) return 0;

  return Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
}

export function calculateTrialExportsRemaining(trial: TrialInfo): number {
  return Math.max(0, trial.maxTrialExports - trial.multisampleExportsUsed);
}

export function isTrialExpired(trial: TrialInfo): boolean {
  const daysRemaining = calculateTrialDaysRemaining(trial);
  const exportsRemaining = calculateTrialExportsRemaining(trial);

  return daysRemaining <= 0 || exportsRemaining <= 0;
}
