import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

const Native = registerPlugin('MacAddressPlugin');

/**
 * ============================================================================
 * NINJA 8K - MAC Address Service
 * ============================================================================
 * 
 * Récupère la vraie adresse MAC WiFi de l'appareil Android.
 * Stocke en localStorage pour éviter les appels répétés.
 * 
 * Usage:
 *   import { getMacAddress, getDeviceKey } from './services/macAddress';
 *   const mac = await getMacAddress();
 *   const key = await getDeviceKey();
 * 
 * ============================================================================
 */

const STORAGE_KEY_MAC = 'ninja_mac_address';
const STORAGE_KEY_DEVICE = 'ninja_device_key';

/**
 * Génère un code à 6 chiffres basé sur la MAC address
 */
const generateDeviceKey = (mac) => {
  if (!mac) return '000000';
  
  // Hash simple de la MAC
  let hash = 0;
  const cleanMac = mac.replace(/[:-]/g, '').toUpperCase();
  
  for (let i = 0; i < cleanMac.length; i++) {
    const char = cleanMac.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convertir en 6 chiffres positifs
  const positive = Math.abs(hash);
  const sixDigits = (positive % 900000) + 100000;
  
  return sixDigits.toString();
};

/**
 * Récupère l'adresse MAC de l'appareil
 * @returns {Promise<string>} MAC address au format XX:XX:XX:XX:XX:XX
 */
export const getMacAddress = async () => {
  // Check cache first
  const cached = localStorage.getItem(STORAGE_KEY_MAC);
  if (cached && cached !== 'null' && cached.includes(':')) {
    return cached;
  }
  
  // Si pas Android, générer une MAC fictive basée sur un ID unique
  if (Capacitor.getPlatform() !== 'android') {
    const webMac = generateWebMac();
    localStorage.setItem(STORAGE_KEY_MAC, webMac);
    localStorage.setItem(STORAGE_KEY_DEVICE, generateDeviceKey(webMac));
    return webMac;
  }
  
  try {
    const result = await Native.getMacAddress();
    
    if (result && result.mac) {
      const mac = result.mac.toUpperCase();
      localStorage.setItem(STORAGE_KEY_MAC, mac);
      localStorage.setItem(STORAGE_KEY_DEVICE, generateDeviceKey(mac));
      console.log(`[MacAddress] Retrieved: ${mac} (method: ${result.method})`);
      return mac;
    }
  } catch (error) {
    console.error('[MacAddress] Plugin error:', error);
  }
  
  // Fallback: générer une MAC persistante
  const fallbackMac = generateFallbackMac();
  localStorage.setItem(STORAGE_KEY_MAC, fallbackMac);
  localStorage.setItem(STORAGE_KEY_DEVICE, generateDeviceKey(fallbackMac));
  return fallbackMac;
};

/**
 * Récupère le code appareil à 6 chiffres
 * @returns {Promise<string>} Code à 6 chiffres
 */
export const getDeviceKey = async () => {
  // Check cache first
  const cached = localStorage.getItem(STORAGE_KEY_DEVICE);
  if (cached && cached.length === 6) {
    return cached;
  }
  
  // Get MAC first (will populate device key)
  await getMacAddress();
  
  return localStorage.getItem(STORAGE_KEY_DEVICE) || '000000';
};

/**
 * Génère une MAC fictive pour le web (persistante)
 */
const generateWebMac = () => {
  const stored = localStorage.getItem('ninja_web_mac_seed');
  let seed = stored;
  
  if (!seed) {
    seed = Date.now().toString(36) + Math.random().toString(36).substring(2);
    localStorage.setItem('ninja_web_mac_seed', seed);
  }
  
  // Générer MAC basée sur le seed
  const bytes = [];
  for (let i = 0; i < 6; i++) {
    const charCode = seed.charCodeAt(i % seed.length);
    bytes.push(((charCode * (i + 1) * 17) % 256).toString(16).padStart(2, '0').toUpperCase());
  }
  
  return bytes.join(':');
};

/**
 * Génère une MAC fallback persistante pour Android si le plugin échoue
 */
const generateFallbackMac = () => {
  const stored = localStorage.getItem('ninja_fallback_mac');
  if (stored && stored.includes(':')) {
    return stored;
  }
  
  // Générer une MAC aléatoire mais persistante
  const bytes = [];
  for (let i = 0; i < 6; i++) {
    bytes.push(Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase());
  }
  
  // Préfixe "NJ" pour identifier comme Ninja
  bytes[0] = 'NJ'.charCodeAt(0).toString(16).toUpperCase().substring(0, 2);
  
  const mac = bytes.join(':');
  localStorage.setItem('ninja_fallback_mac', mac);
  return mac;
};

/**
 * Force le rafraîchissement de la MAC (clear cache)
 */
export const refreshMacAddress = async () => {
  localStorage.removeItem(STORAGE_KEY_MAC);
  localStorage.removeItem(STORAGE_KEY_DEVICE);
  return getMacAddress();
};

/**
 * Vérifie si on a une vraie MAC ou une MAC générée
 */
export const isRealMac = () => {
  const mac = localStorage.getItem(STORAGE_KEY_MAC);
  if (!mac) return false;
  
  // Les MAC générées commencent par NJ ou sont du web
  if (mac.startsWith('4E:4A')) return false; // NJ en hex
  if (mac.startsWith('NJ')) return false;
  
  return true;
};

export default {
  getMacAddress,
  getDeviceKey,
  refreshMacAddress,
  isRealMac,
};
