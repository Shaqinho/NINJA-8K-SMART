import React from 'react';

// ============================================================================
// PIP MANAGER - Picture in Picture Mini Player
// 
// Mini lecteur flottant avec seulement:
// - Play/Pause
// - Fullscreen (expand)
// ============================================================================

export const PiPMiniPlayer = ({ 
  visible, 
  channelName,
  channelLogo,
  isPlaying, 
  onPlayPause, 
  onExpand,
}) => {
  if (!visible) return null;

  return (
    <div 
      className="fixed bottom-4 right-4 z-50"
      style={{
        background: 'rgba(0, 0, 0, 0.9)',
        borderRadius: '12px',
        padding: '12px 16px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Channel Logo */}
      {channelLogo && (
        <img 
          src={channelLogo} 
          alt="" 
          style={{
            height: '24px',
            maxWidth: '60px',
            objectFit: 'contain',
          }}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      )}
      
      {/* Channel Name */}
      <span 
        style={{
          color: 'white',
          fontSize: '13px',
          fontWeight: '500',
          maxWidth: '120px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {channelName}
      </span>
      
      {/* Play/Pause Button */}
      <button 
        onClick={onPlayPause}
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>
      
      {/* Fullscreen/Expand Button */}
      <button 
        onClick={onExpand}
        style={{
          background: 'linear-gradient(135deg, #6225ff, #a855f7)',
          border: 'none',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: '0 2px 10px rgba(98, 37, 255, 0.4)',
        }}
        title="Fullscreen"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <polyline points="15 3 21 3 21 9"/>
          <polyline points="9 21 3 21 3 15"/>
          <line x1="21" y1="3" x2="14" y2="10"/>
          <line x1="3" y1="21" x2="10" y2="14"/>
        </svg>
      </button>
    </div>
  );
};

export default PiPMiniPlayer;
