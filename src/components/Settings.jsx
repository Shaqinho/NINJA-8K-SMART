import React, { useState, useEffect } from 'react';
import { getPlayerMode, setPlayerMode } from './player/VideoPlayer';

// ============================================================================
// SETTINGS - Application settings modal
// ============================================================================

const SettingSection = ({ title, children }) => (
  <div className="mb-6">
    <h3 className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3 px-4">{title}</h3>
    <div className="space-y-1">{children}</div>
  </div>
);

const SettingRow = ({ label, value, onClick, selected }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${selected ? 'bg-purple-500/20' : 'active:bg-white/5'}`}
  >
    <span className="text-white text-sm">{label}</span>
    {value && <span className="text-gray-500 text-sm">{value}</span>}
    {selected && (
      <svg className="w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    )}
  </button>
);

const Settings = ({ visible, onClose, playlist, onClearPlaylist, onRefresh }) => {
  const [playerMode, setPlayerModeState] = useState('exoplayer');
  const [showPlayerOptions, setShowPlayerOptions] = useState(false);
  
  // Load current player mode
  useEffect(() => {
    if (visible) {
      setPlayerModeState(getPlayerMode());
    }
  }, [visible]);

  const handlePlayerModeChange = (mode) => {
    setPlayerMode(mode);
    setPlayerModeState(mode);
    setShowPlayerOptions(false);
  };

  const playerModeLabels = {
    exoplayer: 'ExoPlayer (Native)',
    html5: 'HTML5 Video',
    both: 'Both (ExoPlayer + Fallback)',
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      <div 
        className="relative w-full max-w-lg bg-[#0a0a0f] rounded-t-3xl overflow-hidden max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <h2 className="text-white font-bold text-lg">Settings</h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto py-4" style={{ maxHeight: 'calc(80vh - 60px)' }}>
          
          {/* Player Section */}
          <SettingSection title="Player">
            <SettingRow 
              label="Video Player" 
              value={playerModeLabels[playerMode]}
              onClick={() => setShowPlayerOptions(!showPlayerOptions)}
            />
            
            {showPlayerOptions && (
              <div className="bg-white/5 mx-2 rounded-lg overflow-hidden">
                <SettingRow 
                  label="ExoPlayer (Native)" 
                  selected={playerMode === 'exoplayer'}
                  onClick={() => handlePlayerModeChange('exoplayer')}
                />
                <SettingRow 
                  label="HTML5 Video" 
                  selected={playerMode === 'html5'}
                  onClick={() => handlePlayerModeChange('html5')}
                />
                <SettingRow 
                  label="Both (ExoPlayer + Fallback)" 
                  selected={playerMode === 'both'}
                  onClick={() => handlePlayerModeChange('both')}
                />
              </div>
            )}
          </SettingSection>

          {/* Playlist Section */}
          <SettingSection title="Playlist">
            {playlist && (
              <div className="px-4 py-2 bg-white/5 mx-2 rounded-lg mb-2">
                <p className="text-white text-sm font-semibold">{playlist.name || 'Current Playlist'}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {playlist.data?.live?.length || 0} channels · {playlist.data?.vod?.length || 0} movies · {playlist.data?.series?.length || 0} series
                </p>
              </div>
            )}
            
            <SettingRow 
              label="Refresh Playlist" 
              onClick={onRefresh}
            />
            <SettingRow 
              label="Clear Playlist" 
              onClick={onClearPlaylist}
            />
          </SettingSection>

          {/* About Section */}
          <SettingSection title="About">
            <div className="px-4 py-3">
              <div className="flex items-baseline">
                <span className="text-white font-black text-lg">NINJA</span>
                <span className="font-black text-lg ml-1" style={{ color: '#6225ff' }}>8K</span>
              </div>
              <p className="text-gray-500 text-xs mt-1">Version 1.0.0</p>
              <p className="text-gray-600 text-[10px] mt-2">15 years ahead of other streaming apps</p>
            </div>
          </SettingSection>

        </div>
      </div>
    </div>
  );
};

export default Settings;
