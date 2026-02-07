import React, { useRef, useState, useEffect } from 'react';
import { THEME } from '../constants/theme';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import ParticleThemes from './ParticleThemes';

// ============================================================================
// LOADING SCREEN - Minimal with particles
// ============================================================================

export const LoadingScreen = ({ progress }) => {
  const containerRef = useRef(null);
  
  const [particleTheme] = useState(() => {
    return localStorage.getItem('ninja_particle_theme') || 'ultimate';
  });

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
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        <h1 className="text-white text-4xl font-black italic tracking-tighter mb-10">
          NINJA <span style={{ color: THEME.colors.primary }}>8K</span>
        </h1>

        {/* Status text */}
        <p className="text-gray-400 text-sm mb-4">{progress.step}</p>
        
        {/* Progress bar */}
        <div className="w-64 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.1)' }}>
          <div 
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress.percent}%`, background: THEME.gradients.primary }}
          />
        </div>
        <p className="text-gray-600 text-xs mt-2">{progress.percent}%</p>
      </div>
    </div>
  );
};
