import React, { useRef, useState, useEffect } from 'react';
import { THEME } from '../constants/theme';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import ParticleThemes from './ParticleThemes';
import { getLastActiveServer, openDatabase } from '../database/NinjaLocalDB';
import { XtreamService } from '../services/XtreamService';

// ============================================================================
// NINJA SPLASH - Auto-login + DB initialization
// ============================================================================

export const NinjaSplash = ({ onComplete }) => {
  const containerRef = useRef(null);
  
  const [particleTheme] = useState(() => {
    return localStorage.getItem('ninja_particle_theme') || 'ultimate';
  });

  const [status, setStatus] = useState('Initialisation SQL...');

  // Lock landscape
  useEffect(() => {
    const lockLandscape = async () => {
      try {
        await ScreenOrientation.lock({ orientation: 'landscape' });
      } catch (e) {
        console.log('ScreenOrientation not available:', e);
      }
    };
    lockLandscape();
  }, []);

  // Auto-login check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 1. Init DB
        setStatus('Initialisation du moteur SQL...');
        const db = await openDatabase();
        window.db = db;
        
        // 2. Check last active server
        setStatus('Vérification des credentials...');
        const lastServer = await getLastActiveServer();
        
        // Small delay for particles animation (professional feel)
        await new Promise(r => setTimeout(r, 1500));
        
        if (lastServer) {
          setStatus('Connexion automatique...');
          const xtream = new XtreamService(lastServer.url, lastServer.username, lastServer.password);
          
          // Complete with player + xtream service
          setTimeout(() => {
            onComplete('player', xtream);
          }, 500);
        } else {
          // No server found → go to login
          setStatus('Aucun serveur trouvé');
          setTimeout(() => {
            onComplete('serverform', null);
          }, 500);
        }
      } catch (err) {
        console.error('❌ Splash init error:', err);
        setStatus('Erreur d\'initialisation');
        setTimeout(() => {
          onComplete('serverform', null);
        }, 1000);
      }
    };
    
    checkAuth();
  }, [onComplete]);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 flex flex-col items-center justify-center z-50" 
      style={{ background: THEME.colors.bg }}
    >
      {/* Particles Background */}
      {particleTheme !== 'off' && (
        <div className="fixed inset-0 pointer-events-none z-0">
          <ParticleThemes containerRef={containerRef} theme={particleTheme} />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center animate-pulse">
        {/* Logo */}
        <h1 className="text-white text-4xl font-black italic tracking-tighter mb-10">
          NINJA <span style={{ color: THEME.colors.primary }}>8K</span>
        </h1>

        {/* Spinner */}
        <div className="mb-6">
          <div 
            className="w-12 h-12 border-4 rounded-full animate-spin"
            style={{ 
              borderColor: 'rgba(98, 37, 255, 0.2)',
              borderTopColor: THEME.colors.primary
            }}
          />
        </div>

        {/* Status text */}
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: THEME.colors.primary }}>
          {status}
        </p>
      </div>
    </div>
  );
};

export default NinjaSplash;
