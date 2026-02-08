// ============================================================================
// NINJA AUTH SERVICE - PIN Generation Engine
// ============================================================================
// Algorithme identique au backend PHP pour validation serveur
// Salt: NINJA_SALT_2026 (doit matcher côté serveur)
// ============================================================================

import md5 from 'md5';

/**
 * Génère un PIN à 4 chiffres basé sur le Device ID (ANDROID_ID/UUID)
 * @param {string} hwid - Hardware ID (Device UUID)
 * @returns {string} PIN à 4 chiffres (ex: "0847", "3291")
 */
export const generateNinjaPIN = (hwid) => {
  const salt = 'NINJA_SALT_2026';
  const hash = md5(hwid + salt);
  const pin = (parseInt(hash.substring(0, 4), 16) % 10000).toString().padStart(4, '0');
  return pin;
};
