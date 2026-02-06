import React, { useState, useEffect, useCallback, useRef } from 'react';
import SettingsOverlay from './SettingsOverlay';

// ============================================================================
// PLAYER CONTROLS - OTT Design
// 
// LAYOUT FULLSCREEN:
// ┌─────────────────────────────────────────────────────────────────────────┐
// │                          NINJA 8K                                        │
// │                                                                          │
// │ ⊞ MultiGrid          🔊━━━━ Volume ━━━━          🖼️ PiP                │
// │ (top left)           (top center)                 (top right)           │
// │                                                                          │
// │                                                                          │
// │ 🔍 Search                                         ✕ Exit Fullscreen     │
// │ (bottom left)                                     (bottom right)        │
// │                                                                          │
// │                              ▶️                                          │
// │                           (play/pause)                                   │
// │                                                                          │
// │ [Logo] Prev   ‹‹   [LOGO] CURRENT   ››   Next [Logo]                   │
// │                                                                          │
// │ ‹    [-0:30 ═══════════════════|───🟢]    ›                             │
// │ (skip back with multiplier)        (skip forward with multiplier)       │
// │                                                                          │
// │ Skip multiplier: 1x=10s, 2x=15s, 3x=30s, 4x=45s, 5x=60s                │
// └─────────────────────────────────────────────────────────────────────────┘
//
// LAYOUT MINIMAL (Small player):
// Play/Pause + Fullscreen only
// ============================================================================

// Icons
const Icons = {
  Play: () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>,
  Pause: () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>,
  SkipPrev: () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 19l-7-7 7-7v14zm7-14v14l-7-7 7-7z"/></svg>,
  SkipNext: () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19V5l7 7-7 7zm7-14v14l7-7-7-7z"/></svg>,
  Volume: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>,
  VolumeMute: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>,
  Search: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>,
  Fullscreen: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>,
  Minimize: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>,
  MultiGrid: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  PiP: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><rect x="11" y="9" width="9" height="6" rx="1" fill="currentColor" opacity="0.3"/></svg>,
};

// Styles
const styles = {
  // Corner button
  cornerBtn: {
    background: 'rgba(0,0,0,0.4)',
    border: 'none',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    padding: '10px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.2s',
  },
  // Channel switch buttons << >>
  btnSwitch: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    padding: '5px 8px',
    fontSize: '18px',
    fontWeight: '600',
    transition: 'all 0.2s',
  },
  // Edge buttons < >
  btnEdge: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    padding: '8px',
    fontSize: '22px',
    fontWeight: '300',
    lineHeight: 1,
    transition: 'all 0.2s',
  },
  // Play button
  btnPlay: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.8)',
    cursor: 'pointer',
    padding: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  // Channel info
  channelInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    opacity: 0.5,
    cursor: 'pointer',
    padding: '8px 12px',
    borderRadius: '8px',
    transition: 'all 0.2s',
  },
  channelInfoCurrent: {
    opacity: 1,
    cursor: 'default',
  },
  // Channel logo
  channelLogo: {
    width: '100px',
    height: '25px',
    objectFit: 'contain',
    background: 'transparent',
  },
  channelLogoSmall: {
    width: '80px',
    height: '20px',
  },
  // Channel name
  channelName: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.7)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '140px',
  },
  channelNameCurrent: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'white',
    maxWidth: '180px',
  },
  // Timeshift
  timeshift: {
    flex: 1,
    height: '4px',
    background: 'rgba(255,255,255,0.15)',
    borderRadius: '4px',
    position: 'relative',
    cursor: 'pointer',
    transition: 'height 0.2s',
  },
  timeshiftProgress: {
    height: '100%',
    background: 'linear-gradient(90deg, #6225ff, #a855f7)',
    borderRadius: '4px',
    position: 'relative',
  },
  timeshiftHandle: {
    position: 'absolute',
    right: '-6px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '14px',
    height: '14px',
    background: 'white',
    borderRadius: '50%',
    boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
    opacity: 0,
    transition: 'opacity 0.2s',
  },
};

// Skip amounts: 1x=5s, 2x=15s, 3x=30s


export const PlayerControls = ({
  playing,
  muted = false,
  volume = 1,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onSearchEPG,
  onFullscreenToggle,
  onMultiGridToggle,
  hasMultiGrid = false,
  fullscreen = false,
  isLive = true,
  visible = true,
  // Channel navigation
  currentChannel,
  prevChannel,
  nextChannel,
  onChannelPrev,
  onChannelNext,
  // Timeshift
  timeshiftOffset = 0,
  maxTimeshiftOffset = 7200,
  onTimeshiftSeek,
  onJumpToLive,
  // Stream info
  streamInfo = null, // { category: 'FR| SPORT', resolution: '1080p', codec: 'HEVC', fps: '50fps', bitrate: '8.5 Mbps' }
  // Settings overlay
  xtreamService,
  onServers,
  onTapDismiss,
  // Sidebar state
  sidebarOpen = false,
}) => {
  const [isHoveringTimeshift, setIsHoveringTimeshift] = useState(false);
  const [showSettingsOverlay, setShowSettingsOverlay] = useState(false);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const timelineRef = useRef(null);
  const vodTimelineRef = useRef(null);
  
  // Fix : Saut de 15 secondes fixe pour < et >
  const handleSkip = useCallback((direction) => {
    const amount = 15;
    if (isLive && onTimeshiftSeek) {
      onTimeshiftSeek(direction === 'back' ? Math.min(maxTimeshiftOffset, timeshiftOffset + amount) : Math.max(0, timeshiftOffset - amount));
    } else if (onSeek) {
      onSeek(direction === 'back' ? Math.max(0, currentTime - amount) : Math.min(duration, currentTime + amount));
    }
  }, [isLive, onTimeshiftSeek, maxTimeshiftOffset, timeshiftOffset, onSeek, currentTime, duration]);
  
  // Cleanup timers
  useEffect(() => {
    return () => {
    };
  }, []);

  // ========== TIMELINE DRAG (Live Timeshift) ==========
  const handleTimelineTouchStart = useCallback((e) => {
    e.stopPropagation();
    setIsDraggingTimeline(true);
    setIsHoveringTimeshift(true);
    const touch = e.touches?.[0] || e;
    const rect = timelineRef.current?.getBoundingClientRect();
    if (rect) {
      const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
      const newOffset = maxTimeshiftOffset * (1 - percent);
      onTimeshiftSeek?.(Math.max(0, Math.round(newOffset)));
    }
  }, [maxTimeshiftOffset, onTimeshiftSeek]);

  const handleTimelineTouchMove = useCallback((e) => {
    if (!isDraggingTimeline) return;
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches?.[0] || e;
    const rect = timelineRef.current?.getBoundingClientRect();
    if (rect) {
      const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
      const newOffset = maxTimeshiftOffset * (1 - percent);
      onTimeshiftSeek?.(Math.max(0, Math.round(newOffset)));
    }
  }, [isDraggingTimeline, maxTimeshiftOffset, onTimeshiftSeek]);

  const handleTimelineTouchEnd = useCallback((e) => {
    e?.stopPropagation();
    setIsDraggingTimeline(false);
    setIsHoveringTimeshift(false);
  }, []);

  // ========== TIMELINE DRAG (VOD Seekbar) ==========
  const handleVodTouchStart = useCallback((e) => {
    e.stopPropagation();
    setIsDraggingTimeline(true);
    setIsHoveringTimeshift(true);
    const touch = e.touches?.[0] || e;
    const rect = vodTimelineRef.current?.getBoundingClientRect();
    if (rect && duration > 0) {
      const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
      onSeek?.(percent * duration);
    }
  }, [duration, onSeek]);

  const handleVodTouchMove = useCallback((e) => {
    if (!isDraggingTimeline) return;
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches?.[0] || e;
    const rect = vodTimelineRef.current?.getBoundingClientRect();
    if (rect && duration > 0) {
      const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
      onSeek?.(percent * duration);
    }
  }, [isDraggingTimeline, duration, onSeek]);

  const handleVodTouchEnd = useCallback((e) => {
    e?.stopPropagation();
    setIsDraggingTimeline(false);
    setIsHoveringTimeshift(false);
  }, []);

  // Global touchmove/touchend for drag (in case finger leaves the bar)
  useEffect(() => {
    if (!isDraggingTimeline) return;
    const handleGlobalMove = (e) => {
      const touch = e.touches?.[0];
      if (!touch) return;
      // Check which timeline is active
      if (timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
        if (isLive) {
          const newOffset = maxTimeshiftOffset * (1 - percent);
          onTimeshiftSeek?.(Math.max(0, Math.round(newOffset)));
        }
      }
      if (vodTimelineRef.current) {
        const rect = vodTimelineRef.current.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
        if (!isLive && duration > 0) {
          onSeek?.(percent * duration);
        }
      }
    };
    const handleGlobalEnd = () => {
      setIsDraggingTimeline(false);
      setIsHoveringTimeshift(false);
    };
    window.addEventListener('touchmove', handleGlobalMove, { passive: false });
    window.addEventListener('touchend', handleGlobalEnd);
    return () => {
      window.removeEventListener('touchmove', handleGlobalMove);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [isDraggingTimeline, isLive, maxTimeshiftOffset, onTimeshiftSeek, duration, onSeek]);
  
  // Calculate timeshift progress (100% = live, 0% = max offset)
  const timeshiftProgress = maxTimeshiftOffset > 0 
    ? ((maxTimeshiftOffset - timeshiftOffset) / maxTimeshiftOffset) * 100 
    : 100;

  // ===========================================
  // MINIMAL MODE (Small player - not fullscreen)
  // ===========================================
  if (!fullscreen) {
    return (
      <div
        className={`absolute top-0 left-0 right-0 p-3 flex justify-between z-50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Left: Play/Pause */}
        <button
          onClick={onPlayPause}
          style={{ ...styles.btnPlay, filter: 'drop-shadow(0 0 4px rgba(0,0,0,1))' }}
        >
          <div className="w-5 h-5 text-white">
            {playing ? <Icons.Pause /> : <Icons.Play />}
          </div>
        </button>

        {/* Right: Fullscreen */}
        <button
          onClick={onFullscreenToggle}
          style={{ ...styles.btnPlay, filter: 'drop-shadow(0 0 4px rgba(0,0,0,1))' }}
        >
          <div className="w-5 h-5 text-white">
            <Icons.Fullscreen />
          </div>
        </button>
      </div>
    );
  }

  // ===========================================
  // FULLSCREEN MODE - OTT Design
  // ===========================================
  return (
    <div
      className={`absolute inset-0 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
      onClick={(e) => {
        // Tap on empty area = dismiss controls
        if (e.target === e.currentTarget && onPlayPause) {
          // Don't actually play/pause, just signal parent to hide controls
          onTapDismiss?.();
        }
      }}
    >
      {/* ========== TOP ROW ========== */}
      
      {/* Top Center: Logo NINJA 8K - clickable toggle SettingsOverlay */}
      <button
        onClick={() => setShowSettingsOverlay(!showSettingsOverlay)}
        style={{
          position: 'absolute',
          top: '15px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '6px 12px',
          borderRadius: '8px',
          zIndex: 10001,
          animation: 'logoPulse 2.5s ease-in-out infinite',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: '900', color: 'white', letterSpacing: '-0.5px' }}>
          NINJA
        </span>
        <span style={{ fontSize: '14px', fontWeight: '900', color: '#6225ff', letterSpacing: '-0.5px' }}>
          8K
        </span>
      </button>
      
      {/* Top Left: MultiGrid */}
      {hasMultiGrid && onMultiGridToggle && (
        <button
          onClick={onMultiGridToggle}
          style={{ ...styles.cornerBtn, position: 'absolute', top: '50px', left: '20px' }}
          title="MultiGrid"
        >
          <div className="w-5 h-5"><Icons.MultiGrid /></div>
        </button>
      )}
      
      {/* ========== MIDDLE ROW ========== */}
      
      {/* Middle Right: Exit Fullscreen (portrait + exit) */}
      {onFullscreenToggle && (
        <button
          onClick={onFullscreenToggle}
          style={{ ...styles.cornerBtn, position: 'absolute', bottom: '170px', right: '20px', zIndex: 100 }}
          title="Exit Fullscreen"
        >
          <div className="w-5 h-5"><Icons.Minimize /></div>
        </button>
      )}

      {/* ========== BOTTOM CONTROLS ========== */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '20px 25px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.95))',
        }}
      >
        {/* ROW 1: Play/Pause centered */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
          <button
            onClick={onPlayPause}
            style={styles.btnPlay}
            title={playing ? 'Pause' : 'Play'}
          >
            <div className="w-8 h-8 text-white">
              {playing ? <Icons.Pause /> : <Icons.Play />}
            </div>
          </button>
        </div>
          
        {/* ROW 2: Channel Navigation (prev + current + next on same line) */}
        {isLive && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '12px' }}>
            {/* Previous channel - clickable */}
            {prevChannel && (
              <div
                onClick={onChannelPrev}
                style={styles.channelInfo}
                role="button"
                tabIndex={0}
              >
                {prevChannel.logo && (
                  <img
                    src={prevChannel.logo}
                    alt=""
                    style={{ ...styles.channelLogo, ...styles.channelLogoSmall }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <span style={{ ...styles.channelName, display: 'block', maxWidth: 'min(140px, 20vw)' }}>{prevChannel.name}</span>
              </div>
            )}

            {/* Button << */}
            <button onClick={onChannelPrev} style={styles.btnSwitch} title="Previous channel">
              ‹‹
            </button>

            {/* Current channel (center) - logo left of name */}
            {currentChannel && (
              <div 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  gap: '8px',
                  padding: '4px 8px',
                  borderRadius: '8px',
                }}
              >
                {currentChannel.logo && (
                  <img
                    src={currentChannel.logo}
                    alt=""
                    style={styles.channelLogo}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <span style={{ ...styles.channelName, ...styles.channelNameCurrent, display: 'block', maxWidth: 'min(200px, 30vw)' }}>
                    {currentChannel.name}
                  </span>
              </div>
            )}

            {/* Button >> */}
            <button onClick={onChannelNext} style={styles.btnSwitch} title="Next channel">
              ››
            </button>

            {/* Next channel - clickable */}
            {nextChannel && (
              <div
                onClick={onChannelNext}
                style={styles.channelInfo}
                role="button"
                tabIndex={0}
              >
                {nextChannel.logo && (
                  <img
                    src={nextChannel.logo}
                    alt=""
                    style={{ ...styles.channelLogo, ...styles.channelLogoSmall }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <span style={{ ...styles.channelName, display: 'block', maxWidth: 'min(140px, 20vw)' }}>{nextChannel.name}</span>
              </div>
            )}
          </div>
        )}

        {/* ROW 3: < Timeshift > */}
        {isLive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Skip Back < */}
            <button
              onClick={() => handleSkip('back')}
              style={{
                ...styles.btnEdge,
                color: 'white',
                padding: '8px 4px',
              }}
            >
              ‹
            </button>

            {/* Timeshift bar - 90% width centered */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '60%', position: 'relative' }}>
              {/* Touch zone élargie (44px) pour faciliter le tap et drag */}
              <div
                ref={timelineRef}
                style={{
                  position: 'relative',
                  padding: '20px 0',
                  margin: '-20px 0',
                  cursor: 'pointer',
                  touchAction: 'none',
                }}
                onTouchStart={handleTimelineTouchStart}
                onTouchMove={handleTimelineTouchMove}
                onTouchEnd={handleTimelineTouchEnd}
                onClick={(e) => {
                  const rect = timelineRef.current?.getBoundingClientRect();
                  if (rect) {
                    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const newOffset = maxTimeshiftOffset * (1 - percent);
                    onTimeshiftSeek?.(Math.max(0, Math.round(newOffset)));
                  }
                }}
              >
              <div
                style={{
                  ...styles.timeshift,
                  height: (isHoveringTimeshift || isDraggingTimeline) ? '6px' : '4px',
                }}
              >
                <div style={{ ...styles.timeshiftProgress, width: `${timeshiftProgress}%` }}>
                  <div style={{ 
                    ...styles.timeshiftHandle, 
                    opacity: 1,
                  }} />
                </div>
              </div>
              </div>
              </div>
            </div>

            {/* Skip Forward > */}
            <button
              onClick={() => handleSkip('forward')}
              style={{
                ...styles.btnEdge,
                color: 'white',
                padding: '8px 4px',
              }}
            >
              ›
            </button>
          </div>
        )}

        {/* VOD Progress bar */}
        {!isLive && duration > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', minWidth: '45px' }}>
              {formatTime(currentTime)}
            </span>
            {/* Touch zone élargie (44px) pour faciliter le tap et drag */}
            <div
              ref={vodTimelineRef}
              style={{
                flex: 1,
                position: 'relative',
                padding: '20px 0',
                margin: '-20px 0',
                cursor: 'pointer',
                touchAction: 'none',
              }}
              onTouchStart={handleVodTouchStart}
              onTouchMove={handleVodTouchMove}
              onTouchEnd={handleVodTouchEnd}
              onClick={(e) => {
                const rect = vodTimelineRef.current?.getBoundingClientRect();
                if (rect && duration > 0) {
                  const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  onSeek?.(percent * duration);
                }
              }}
            >
            <div
              style={{
                ...styles.timeshift,
                height: (isHoveringTimeshift || isDraggingTimeline) ? '6px' : '4px',
              }}
            >
              <div style={{ ...styles.timeshiftProgress, width: `${(currentTime / duration) * 100}%` }}>
                <div style={{ 
                  ...styles.timeshiftHandle, 
                  opacity: 1,
                }} />
              </div>
            </div>
            </div>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', minWidth: '45px', textAlign: 'right' }}>
              {formatTime(duration)}
            </span>
          </div>
        )}
      </div>

      {/* SettingsOverlay */}
      <SettingsOverlay
        visible={showSettingsOverlay}
        onClose={() => setShowSettingsOverlay(false)}
        xtreamService={xtreamService}
        onServers={onServers}
        sidebarOpen={sidebarOpen}
      />

      {/* Keyframes */}
      <style>{`
        @keyframes logoPulse {
          0%, 100% { opacity: 0.85; filter: drop-shadow(0 0 0px transparent); }
          50% { opacity: 1; filter: drop-shadow(0 0 8px rgba(98, 37, 255, 0.6)); }
        }
      `}</style>
    </div>
  );
};

// Helper function
const formatTime = (seconds) => {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default PlayerControls;
