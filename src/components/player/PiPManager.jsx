import React from 'react';

// ============================================================================
// PIP BUTTON & MINI CONTROLLER - Picture in Picture
// ============================================================================

export const PiPButton = ({ supported, active, onClick }) => {
  if (!supported) return null;

  return (
    <button 
      onClick={onClick} 
      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${active ? 'bg-purple-500' : 'bg-white/10 hover:bg-white/20'}`} 
      title={active ? 'Exit Picture in Picture' : 'Picture in Picture'}
    >
      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <rect x="11" y="9" width="9" height="6" rx="1" fill={active ? 'currentColor' : 'none'}/>
      </svg>
    </button>
  );
};

export const PiPMiniController = ({ visible, title, isPlaying, onPlayPause, onClose, onExpand }) => {
  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: 'transparent' }}>
      <button onClick={onPlayPause} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
        {isPlaying ? (
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        ) : (
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        )}
      </button>
      <span className="text-white text-sm font-medium truncate max-w-32">{title}</span>
      <button onClick={onExpand} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
        </svg>
      </button>
      <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
};

export default PiPButton;
