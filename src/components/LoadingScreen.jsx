import React, { useRef, useState } from 'react';
import { THEME } from '../constants/theme';
import ParticleThemes from './ParticleThemes';

export const LoadingScreen = ({ progress }) => {
  const containerRef = useRef(null);
  
  // Particle theme from localStorage (default: ultimate)
  const [particleTheme] = useState(() => {
    return localStorage.getItem('ninja_particle_theme') || 'ultimate';
  });

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 flex flex-col items-center justify-center z-50" 
      style={{ background: THEME.colors.bg }}
    >
      {/* Particle Effects Background - CONDITIONAL */}
      {particleTheme !== 'off' && (
        <div className="fixed inset-0 pointer-events-none z-0">
          <ParticleThemes containerRef={containerRef} theme={particleTheme} />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        <h1 className="text-white text-4xl font-black italic tracking-tighter mb-8">
          NINJA <span style={{ color: THEME.colors.primary }}>8K</span>
        </h1>
        
        <div className="w-16 h-16 mb-6">
          <svg className="animate-spin text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/>
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
          </svg>
        </div>
        
        <p className="text-gray-400 text-sm mb-4">{progress.step}</p>
        
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
