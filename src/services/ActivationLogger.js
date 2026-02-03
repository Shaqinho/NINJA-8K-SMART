// src/services/ActivationLogger.js
/**
 * NINJA 8K - Activation Logger
 * Sends activation data to Google Sheets for tracking & anti-piracy
 * 
 * Setup required:
 * 1. Create a Google Sheet
 * 2. Create a Google Apps Script (see instructions below)
 * 3. Deploy as Web App and paste the URL below
 */

import { Device } from '@capacitor/device';
import DeviceService from '../utils/device';

// ============================================================================
// CONFIGURATION - Replace with your Google Apps Script Web App URL
// ============================================================================
const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';

// ============================================================================
// ACTIVATION LOGGER SERVICE
// ============================================================================
export const ActivationLogger = {
  /**
   * Log a premium activation to Google Sheets
   * Call this when user activates premium
   */
  async logActivation(activationCode = '', status = 'activated') {
    try {
      // Get device info
      const { ninjaId, key } = await DeviceService.getPermanentId();
      const deviceInfo = await this.getDeviceInfo();
      
      const payload = {
        timestamp: new Date().toISOString(),
        mac: ninjaId,
        deviceKey: key,
        uuid: deviceInfo.uuid || 'unknown',
        activationCode: activationCode,
        status: status, // 'activated', 'deactivated', 'attempt', 'error'
        platform: deviceInfo.platform || 'unknown',
        model: deviceInfo.model || 'unknown',
        manufacturer: deviceInfo.manufacturer || 'unknown',
        osVersion: deviceInfo.osVersion || 'unknown',
        appVersion: '1.0.0', // Update with your app version
        country: await this.getCountry(),
      };

      console.log('📊 Logging activation:', payload);

      // Send to Google Sheets
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Required for Google Apps Script
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('✅ Activation logged successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to log activation:', error);
      // Don't block the app if logging fails
      return false;
    }
  },

  /**
   * Log app launch (optional - for analytics)
   */
  async logLaunch() {
    return this.logActivation('', 'launch');
  },

  /**
   * Log activation attempt (before validation)
   */
  async logAttempt(activationCode) {
    return this.logActivation(activationCode, 'attempt');
  },

  /**
   * Log successful activation
   */
  async logSuccess(activationCode) {
    return this.logActivation(activationCode, 'activated');
  },

  /**
   * Log deactivation
   */
  async logDeactivation(activationCode) {
    return this.logActivation(activationCode, 'deactivated');
  },

  /**
   * Log error
   */
  async logError(activationCode, errorMessage) {
    return this.logActivation(activationCode, `error: ${errorMessage}`);
  },

  /**
   * Get device information
   */
  async getDeviceInfo() {
    try {
      const info = await Device.getInfo();
      const id = await Device.getId();
      return {
        platform: info.platform,
        model: info.model,
        manufacturer: info.manufacturer,
        osVersion: info.osVersion,
        uuid: id.identifier || id.uuid,
      };
    } catch (error) {
      console.warn('Failed to get device info:', error);
      return {};
    }
  },

  /**
   * Get country from timezone (simple approach, no API needed)
   */
  async getCountry() {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Extract region from timezone (e.g., "Europe/Paris" -> "Europe")
      const region = timezone.split('/')[0];
      return `${region} (${timezone})`;
    } catch {
      return 'unknown';
    }
  },
};

export default ActivationLogger;
