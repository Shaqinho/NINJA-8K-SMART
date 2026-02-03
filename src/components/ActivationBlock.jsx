import React, { useState, useEffect } from 'react';
import { THEME } from '../constants/theme';
import { ActivationLogger } from '../services/ActivationLogger';
import DeviceService from '../utils/device';

// ============================================================================
// ICONS
// ============================================================================
const Icons = {
  Copy: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  RefreshCw: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  ),
  Crown: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.5 19h19v2h-19v-2zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06l-4.23 1.14-3.29-4.17c-.32-.41-.79-.55-1.26-.55-.47 0-.94.14-1.26.55l-3.29 4.17-4.23-1.14c-.8-.22-1.63.26-1.84 1.06-.11.4-.02.82.24 1.15l5.51 6.83h9.86l5.51-6.83c.26-.33.35-.75.12-1.15z"/>
    </svg>
  ),
};

const CopyButton = ({ onClick, copied }) => (
  <button 
    onClick={onClick} 
    className="w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all"
    style={{ background: '#0a0a0f' }}
  >
    {copied ? (
      <div className="w-4 h-4 text-green-400"><Icons.Check/></div>
    ) : (
      <div className="w-4 h-4 text-gray-500"><Icons.Copy/></div>
    )}
  </button>
);

// ============================================================================
// ACTIVATION BLOCK - Affiche MAC + KEY, gère l'activation premium
// ============================================================================
export const ActivationBlock = ({ onVerifyActivation, isPremium = false }) => {
  const [ninjaId, setNinjaId] = useState('Chargement...');
  const [deviceKey, setDeviceKey] = useState('------');
  const [copied, setCopied] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activationStatus, setActivationStatus] = useState(null); // 'success', 'error', null

  useEffect(() => {
    // Charger l'identité du device
    const loadIdentity = async () => {
      try {
        // Utilise DeviceService pour obtenir MAC déterministe
        const { ninjaId: mac, key } = await DeviceService.getPermanentId();
        
        setNinjaId(mac);
        setDeviceKey(key);
        
        // Stocker aussi dans localStorage pour compatibilité
        localStorage.setItem('ninja_mac_address', mac);
        localStorage.setItem('ninja_device_key', key);
        
        // Log le lancement (optionnel - pour analytics)
        // await ActivationLogger.logLaunch();
        
      } catch (error) {
        console.error('Failed to load device identity:', error);
        // Fallback sur localStorage
        const mac = localStorage.getItem('ninja_mac_address');
        const key = localStorage.getItem('ninja_device_key');
        if (mac) setNinjaId(mac);
        if (key) setDeviceKey(key);
      }
    };

    loadIdentity();
  }, []);

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // Fallback
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleVerifyActivation = async () => {
    setIsVerifying(true);
    setActivationStatus(null);
    
    try {
      // Log la tentative de vérification
      await ActivationLogger.logAttempt('verify_check');
      
      // Appeler la fonction de vérification parent
      if (onVerifyActivation) {
        const result = await onVerifyActivation();
        
        if (result?.success || result === true) {
          // Log le succès
          await ActivationLogger.logSuccess('premium_verified');
          setActivationStatus('success');
        } else {
          // Log l'échec
          await ActivationLogger.logError('verify_check', 'Not premium');
          setActivationStatus('error');
        }
      }
    } catch (error) {
      console.error('Verification failed:', error);
      await ActivationLogger.logError('verify_check', error.message);
      setActivationStatus('error');
    } finally {
      setIsVerifying(false);
      // Reset status after 3 seconds
      setTimeout(() => setActivationStatus(null), 3000);
    }
  };

  return (
    <div className="rounded-2xl p-4 relative overflow-hidden" 
         style={{ 
           background: isPremium 
             ? 'linear-gradient(135deg, rgba(98, 37, 255, 0.2), rgba(168, 85, 247, 0.1))'
             : 'rgba(18, 18, 31, 0.5)', 
           backdropFilter: 'blur(20px)', 
           WebkitBackdropFilter: 'blur(20px)', 
           border: isPremium 
             ? '1px solid rgba(168, 85, 247, 0.5)'
             : '1px solid rgba(98, 37, 255, 0.3)' 
         }}>
      
      {/* Premium Badge */}
      {isPremium && (
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full"
             style={{ background: THEME.gradients.primary }}>
          <div className="w-3 h-3 text-yellow-300"><Icons.Crown/></div>
          <span className="text-[9px] font-bold text-white">PREMIUM</span>
        </div>
      )}

      {/* NINJA ID (MAC) */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-gray-500 text-[9px] uppercase tracking-widest font-bold mb-1">NINJA ID (MAC)</p>
          <span className="font-mono text-sm font-bold tracking-wide" style={{ color: THEME.colors.primary }}>
            {ninjaId}
          </span>
        </div>
        <CopyButton onClick={() => copyToClipboard(ninjaId, 'mac')} copied={copied === 'mac'} />
      </div>

      <div className="h-px bg-white/5 my-3"/>

      {/* DEVICE KEY */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <p className="text-gray-500 text-[9px] uppercase tracking-widest font-bold mb-1">DEVICE KEY</p>
          <span className="font-mono text-xl font-black tracking-widest" style={{ color: THEME.colors.primary }}>
            {deviceKey}
          </span>
        </div>
        <CopyButton onClick={() => copyToClipboard(deviceKey, 'key')} copied={copied === 'key'} />
      </div>

      {/* Verify Button */}
      <button 
        onClick={handleVerifyActivation}
        disabled={isVerifying}
        className={`w-full flex items-center justify-center gap-2 py-2.5 mt-3 rounded-xl text-xs font-bold border active:scale-95 transition-all ${
          activationStatus === 'success' 
            ? 'border-green-500/50 text-green-400 bg-green-500/10'
            : activationStatus === 'error'
            ? 'border-red-500/50 text-red-400 bg-red-500/10'
            : 'border-white/10 text-gray-400 bg-transparent'
        }`}
      >
        {isVerifying ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/>
            VERIFYING...
          </>
        ) : activationStatus === 'success' ? (
          <>
            <div className="w-3.5 h-3.5"><Icons.Check/></div>
            ACTIVATED!
          </>
        ) : activationStatus === 'error' ? (
          <>
            NOT ACTIVATED
          </>
        ) : (
          <>
            <div className="w-3.5 h-3.5"><Icons.RefreshCw/></div>
            VERIFY ACTIVATION
          </>
        )}
      </button>
      
      {/* Link */}
      <a 
        href="https://ninja-apps.io/playlist" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="block text-[9px] font-bold tracking-wider text-center mt-2 hover:opacity-80 transition-opacity" 
        style={{ color: THEME.colors.primary }}
      >
        ninja-apps.io/playlist
      </a>
    </div>
  );
};

export default ActivationBlock;
