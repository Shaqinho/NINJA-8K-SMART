// src/utils/security.js
/**
 * NINJA 8K - Security Service
 * Protection Anti-Rebrand et validation d'intégrité
 */

import { App } from '@capacitor/app';

export const SecurityService = {
  // Package ID officiel (ne jamais modifier)
  OFFICIAL_PACKAGE: 'io.ninja.ninja8k',
  OFFICIAL_BRANDING: 'NINJA 8K',

  /**
   * Vérifie l'intégrité de l'application
   * Bloque si le package a été modifié (rebrand)
   */
  async validateAppIntegrity() {
    try {
      const info = await App.getInfo();
      
      if (info.id !== this.OFFICIAL_PACKAGE) {
        throw new Error('LOGICIEL CONTREFAIT : Accès refusé.');
      }
      
      return { valid: true };
    } catch (error) {
      if (error.message.includes('CONTREFAIT')) {
        throw error;
      }
      // Si Capacitor n'est pas dispo (web), on laisse passer
      console.warn('Security check skipped (web mode)');
      return { valid: true, mode: 'web' };
    }
  },

  /**
   * Vérifie la réponse serveur pour le branding
   */
  validateServerResponse(response) {
    if (response.branding && response.branding !== this.OFFICIAL_BRANDING) {
      throw new Error('BRANDING_MISMATCH: Server response invalid');
    }
    return true;
  },

  /**
   * Vérifie si l'appareil est banni
   */
  checkBanStatus(response) {
    if (response.status === 'banned' || response.status === 'BANNED') {
      return {
        banned: true,
        reason: response.reason || 'Violation des conditions d\'utilisation'
      };
    }
    return { banned: false };
  },

  /**
   * Génère une signature de requête (anti-tampering)
   */
  generateRequestSignature(ninjaId, timestamp) {
    // Simple hash pour validation basique
    // En production, utiliser un vrai HMAC avec secret
    const data = `${ninjaId}:${timestamp}:${this.OFFICIAL_PACKAGE}`;
    return btoa(data).substring(0, 32);
  },

  /**
   * Prépare les headers sécurisés pour les requêtes API
   */
  getSecureHeaders(ninjaId) {
    const timestamp = Date.now();
    return {
      'X-Ninja-ID': ninjaId,
      'X-Package-ID': this.OFFICIAL_PACKAGE,
      'X-Timestamp': timestamp.toString(),
      'X-Signature': this.generateRequestSignature(ninjaId, timestamp),
    };
  },
};

export default SecurityService;
