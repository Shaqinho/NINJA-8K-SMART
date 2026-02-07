import React, { useRef, useState } from 'react';
import { THEME } from '../constants/theme';
import ParticleThemes from './ParticleThemes';

// ============================================================================
// LOADING SCREEN - Knight Rider KITT Scanner
// Red LED bar bouncing horizontally with glow trail
// ============================================================================

export const LoadingScreen = ({ progress }) => {
  const containerRef = useRef(null);
  
  const [particleTheme] = useState(() => {
    return localStorage.getItem('ninja_particle_theme') || 'ultimate';
  });

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

        {/* KITT Scanner */}
        <div style={{
          width: '200px',
          height: '8px',
          borderRadius: '4px',
          background: 'rgba(255, 255, 255, 0.06)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '32px',
          border: '1px solid rgba(255,0,0,0.1)',
        }}>
          {/* LED bar */}
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '60px',
            borderRadius: '4px',
            background: 'linear-gradient(90deg, transparent, #ef4444, #dc2626, #ef4444, transparent)',
            boxShadow: '0 0 20px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.4), 0 0 60px rgba(239,68,68,0.2)',
            animation: 'kittScan 1.4s ease-in-out infinite',
          }} />
          {/* Trail glow */}
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '100px',
            borderRadius: '4px',
            background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.2), transparent)',
            animation: 'kittScan 1.4s ease-in-out infinite',
            animationDelay: '-0.05s',
          }} />
        </div>
        
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

      {/* KITT Keyframes */}
      <style>{`
        @keyframes kittScan {
          0% { left: -60px; }
          50% { left: calc(100% + 0px); }
          100% { left: -60px; }
        }
      `}</style>
    </div>
  );
};
