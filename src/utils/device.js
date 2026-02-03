// src/utils/device.js
/**
 * NINJA 8K - Device Service
 * Generates and manages permanent device identifier
 * 
 * CRITICAL: MAC address must be DETERMINISTIC and survive app reinstalls
 * Uses Capacitor Preferences (persistent) instead of localStorage (cleared on uninstall)
 */

import { Preferences } from '@capacitor/preferences';
import { Device } from '@capacitor/device';

const PREF_DEVICE_ID = 'ninja_permanent_device_id';
const PREF_DEVICE_KEY = 'ninja_device_key';

export const DeviceService = {
  /**
   * Get permanent device ID and security key
   * These MUST persist across reinstalls
   */
  async getPermanentId() {
    const ninjaId = await this.getNinjaId();
    const key = await this.getDeviceKey();
    return { ninjaId, key };
  },

  /**
   * Generate a DETERMINISTIC pseudo-MAC based on device UUID
   * The MAC will be the same for the same device, even after reinstall
   */
  async getNinjaId() {
    // First, check if we already have a stored MAC
    const stored = await this.getStoredDeviceId();
    if (stored) {
      console.log('📱 Using stored device ID:', stored);
      return stored;
    }

    // Generate new deterministic MAC based on device UUID
    let deviceUUID = null;

    try {
      // Get device UUID from Capacitor
      const info = await Device.getId();
      deviceUUID = info.identifier || info.uuid;
      console.log('📱 Device UUID:', deviceUUID);
    } catch (error) {
      console.warn('Failed to get device UUID:', error);
    }

    // Generate MAC address
    let macAddress;
    if (deviceUUID) {
      // DETERMINISTIC: Same UUID = Same MAC (survives reinstall)
      macAddress = this.generateDeterministicMac(deviceUUID);
    } else {
      // Fallback: Random but stored (won't survive reinstall if storage cleared)
      macAddress = this.generateRandomMac();
    }

    // Store for future use
    await this.storeDeviceId(macAddress);
    console.log('📱 Generated new device ID:', macAddress);

    return macAddress;
  },

  /**
   * Generate DETERMINISTIC MAC from UUID
   * Same UUID always produces same MAC
   */
  generateDeterministicMac(uuid) {
    const str = uuid.toLowerCase().replace(/[^a-f0-9]/g, '');
    
    // Generate 6 bytes deterministically from UUID
    const bytes = [];
    for (let i = 0; i < 6; i++) {
      let byteValue = 0;
      for (let j = 0; j < str.length; j++) {
        const charCode = str.charCodeAt(j);
        byteValue = ((byteValue << 5) - byteValue + charCode * (i + 1)) & 0xFF;
      }
      bytes.push(byteValue);
    }

    // Ensure first byte is valid (unicast, locally administered)
    bytes[0] = (bytes[0] & 0xFC) | 0x02;

    // Format as MAC address
    const mac = bytes.map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
    return mac;
  },

  /**
   * Generate random MAC (fallback)
   */
  generateRandomMac() {
    const bytes = [];
    for (let i = 0; i < 6; i++) {
      bytes.push(Math.floor(Math.random() * 256));
    }
    // Set locally administered bit
    bytes[0] = (bytes[0] & 0xFC) | 0x02;
    return bytes.map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
  },

  /**
   * Get stored device ID from Capacitor Preferences (persistent)
   */
  async getStoredDeviceId() {
    try {
      const { value } = await Preferences.get({ key: PREF_DEVICE_ID });
      return value || null;
    } catch (error) {
      console.warn('Failed to get stored device ID:', error);
      // Fallback to localStorage
      return localStorage.getItem(PREF_DEVICE_ID) || null;
    }
  },

  /**
   * Store device ID in Capacitor Preferences (persistent)
   */
  async storeDeviceId(deviceId) {
    try {
      await Preferences.set({ key: PREF_DEVICE_ID, value: deviceId });
      // Also store in localStorage as backup
      localStorage.setItem(PREF_DEVICE_ID, deviceId);
    } catch (error) {
      console.warn('Failed to store device ID in Preferences:', error);
      localStorage.setItem(PREF_DEVICE_ID, deviceId);
    }
  },

  /**
   * Get or generate the 6-digit security key
   * This key is generated once and stored permanently
   */
  async getDeviceKey() {
    // Try Capacitor Preferences first
    try {
      const { value } = await Preferences.get({ key: PREF_DEVICE_KEY });
      if (value) return value;
    } catch (error) {
      console.warn('Failed to get device key from Preferences:', error);
    }

    // Try localStorage
    let key = localStorage.getItem(PREF_DEVICE_KEY);
    if (key) return key;

    // Generate new key
    key = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in both places
    try {
      await Preferences.set({ key: PREF_DEVICE_KEY, value: key });
    } catch (error) {
      console.warn('Failed to store device key in Preferences:', error);
    }
    localStorage.setItem(PREF_DEVICE_KEY, key);

    return key;
  },

  /**
   * Format any string as MAC address (legacy support)
   */
  formatAsMac(id) {
    const clean = id
      .replace(/[^a-fA-F0-9]/g, '')
      .substring(0, 12)
      .padEnd(12, '0');

    return clean
      .match(/.{1,2}/g)
      .join(':')
      .toUpperCase();
  },

  /**
   * Get device info for debugging
   */
  async getDeviceInfo() {
    try {
      const info = await Device.getInfo();
      const id = await Device.getId();
      return {
        platform: info.platform,
        model: info.model,
        osVersion: info.osVersion,
        manufacturer: info.manufacturer,
        uuid: id.identifier || id.uuid,
      };
    } catch (error) {
      return { error: error.message };
    }
  },

  /**
   * Reset device ID (for debugging only)
   * WARNING: This will cause activation issues!
   */
  async reset() {
    console.warn('⚠️ Resetting device ID - this may cause activation issues!');
    try {
      await Preferences.remove({ key: PREF_DEVICE_ID });
      await Preferences.remove({ key: PREF_DEVICE_KEY });
    } catch (error) {
      console.warn('Failed to remove from Preferences:', error);
    }
    localStorage.removeItem(PREF_DEVICE_ID);
    localStorage.removeItem(PREF_DEVICE_KEY);
  },
};

export default DeviceService;
