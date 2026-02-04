import React, { useState, useEffect, useCallback, useRef } from 'react';

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
    maxWidth: '400px',
    maxHeight: '40px',
    width: 'auto',
    height: '40px',
    objectFit: 'contain',
  },
  channelLogoSmall: {
    maxWidth: '200px',
    maxHeight: '28px',
    height: '28px',
  },
  // Channel name
  channelName: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.7)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100px',
  },
  channelNameCurrent: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'white',
    maxWidth: '150px',
  },
  // Volume gauge
  volumeGauge: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(0,0,0,0.6)',
    padding: '10px 16px',
    borderRadius: '25px',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease',
  },
  volumeBar: {
    width: '120px',
    height: '4px',
    background: 'rgba(255,255,255,0.2)',
    borderRadius: '2px',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  volumeLevel: {
    height: '100%',
    background: 'linear-gradient(90deg, #6225ff, #a855f7)',
    borderRadius: '2px',
    transition: 'width 0.15s ease',
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
  timeshiftLiveMarker: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: '10px',
    height: '10px',
    background: '#22c55e',
    borderRadius: '50%',
    boxShadow: '0 0 8px #22c55e, 0 0 15px rgba(34, 197, 94, 0.5)',
  },
};

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
  onPiPToggle,
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
  // Volume display
  showVolumeGauge = false,
}) => {
  const [isHoveringTimeshift, setIsHoveringTimeshift] = useState(false);
  
  // Skip multiplier state
  const [skipBackCount, setSkipBackCount] = useState(0);
  const [skipForwardCount, setSkipForwardCount] = useState(0);
  const skipBackTimerRef = useRef(null);
  const skipForwardTimerRef = useRef(null);
  
  // Skip amounts based on tap count: 1=10s, 2=15s, 3=30s, 4=45s, 5=60s
  const skipAmounts = [10, 15, 30, 45, 60];
  
  // Handle skip back with multiplier
  const handleSkipBack = useCallback(() => {
    // Clear previous timer
    clearTimeout(skipBackTimerRef.current);
    
    // Increment count (max 5)
    const newCount = Math.min(skipBackCount + 1, 5);
    setSkipBackCount(newCount);
    
    // Get skip amount
    const skipAmount = skipAmounts[newCount - 1];
    
    // Apply skip
    if (isLive && onTimeshiftSeek) {
      onTimeshiftSeek(Math.min(maxTimeshiftOffset, timeshiftOffset + skipAmount));
    } else if (onSeek && currentTime !== undefined) {
      onSeek(Math.max(0, currentTime - skipAmount));
    }
    
    // Reset count after 1s of inactivity
    skipBackTimerRef.current = setTimeout(() => {
      setSkipBackCount(0);
    }, 1000);
  }, [skipBackCount, isLive, onTimeshiftSeek, maxTimeshiftOffset, timeshiftOffset, onSeek, currentTime]);
  
  // Handle skip forward with multiplier
  const handleSkipForward = useCallback(() => {
    // Clear previous timer
    clearTimeout(skipForwardTimerRef.current);
    
    // Increment count (max 5)
    const newCount = Math.min(skipForwardCount + 1, 5);
    setSkipForwardCount(newCount);
    
    // Get skip amount
    const skipAmount = skipAmounts[newCount - 1];
    
    // Apply skip
    if (isLive && onTimeshiftSeek) {
      onTimeshiftSeek(Math.max(0, timeshiftOffset - skipAmount));
    } else if (onSeek && duration !== undefined) {
      onSeek(Math.min(duration, currentTime + skipAmount));
    }
    
    // Reset count after 1s of inactivity
    skipForwardTimerRef.current = setTimeout(() => {
      setSkipForwardCount(0);
    }, 1000);
  }, [skipForwardCount, isLive, onTimeshiftSeek, timeshiftOffset, onSeek, currentTime, duration]);
  
  // Cleanup timers
  useEffect(() => {
    return () => {
      clearTimeout(skipBackTimerRef.current);
      clearTimeout(skipForwardTimerRef.current);
    };
  }, []);
  
  // Calculate timeshift progress (100% = live, 0% = max offset)
  const timeshiftProgress = maxTimeshiftOffset > 0 
    ? ((maxTimeshiftOffset - timeshiftOffset) / maxTimeshiftOffset) * 100 
    : 100;
  
  const isAtLive = timeshiftOffset === 0;

  // Format timeshift offset
  const formatOffset = (seconds) => {
    if (seconds === 0) return 'LIVE';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `-${m}:${s.toString().padStart(2, '0')}`;
  };

  // ===========================================
  // MINIMAL MODE (Small player - not fullscreen)
  // ===========================================
  if (!fullscreen) {
    return (
      <div
        className={`absolute bottom-0 left-0 right-0 p-3 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="flex items-center justify-between">
          {/* Left: Play/Pause */}
          <button
            onClick={onPlayPause}
            style={{ ...styles.btnPlay, filter: 'drop-shadow(0 0 4px rgba(0,0,0,1))' }}
          >
            <div className="w-6 h-6 text-white">
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
    >
      {/* ========== TOP ROW ========== */}
      
      {/* Top Center: Logo NINJA 8K */}
      <div
        style={{
          position: 'absolute',
          top: '15px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          opacity: 1,
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: '900', color: 'white', letterSpacing: '-0.5px' }}>
          NINJA
        </span>
        <span style={{ fontSize: '14px', fontWeight: '900', color: '#6225ff', letterSpacing: '-0.5px' }}>
          8K
        </span>
      </div>
      
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
      
      {/* Top Center (below logo): Volume Slider */}
      <div 
        style={{ 
          position: 'absolute', 
          top: '50px', 
          left: '50%', 
          transform: 'translateX(-50%)',
        }}
      >
        <div style={styles.volumeGauge}>
          <button
            onClick={onMuteToggle}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <div className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {muted ? <Icons.VolumeMute /> : <Icons.Volume />}
            </div>
          </button>
          <div 
            style={styles.volumeBar}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              onVolumeChange?.(Math.max(0, Math.min(1, percent)));
            }}
          >
            <div style={{ ...styles.volumeLevel, width: `${muted ? 0 : volume * 100}%` }} />
          </div>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', minWidth: '35px', textAlign: 'right' }}>
            {muted ? '0%' : `${Math.round(volume * 100)}%`}
          </span>
        </div>
      </div>
      
      {/* Top Right: PiP */}
      {onPiPToggle && (
        <button
          onClick={onPiPToggle}
          style={{ ...styles.cornerBtn, position: 'absolute', top: '50px', right: '20px' }}
          title="Picture in Picture"
        >
          <div className="w-5 h-5"><Icons.PiP /></div>
        </button>
      )}

      {/* ========== MIDDLE ROW ========== */}
      
      {/* Middle Left: Search EPG */}
      {isLive && onSearchEPG && (
        <button
          onClick={onSearchEPG}
          style={{ ...styles.cornerBtn, position: 'absolute', bottom: '180px', left: '20px' }}
          title="Search EPG"
        >
          <div className="w-5 h-5"><Icons.Search /></div>
        </button>
      )}
      
      {/* Middle Right: Exit Fullscreen */}
      {onFullscreenToggle && (
        <button
          onClick={onFullscreenToggle}
          style={{ ...styles.cornerBtn, position: 'absolute', bottom: '180px', right: '20px' }}
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
        {/* ROW 1: Play/Pause + Current Channel Logo + Name (centered) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '15px', gap: '8px' }}>
          <button
            onClick={onPlayPause}
            style={styles.btnPlay}
            title={playing ? 'Pause' : 'Play'}
          >
            <div className="w-8 h-8 text-white">
              {playing ? <Icons.Pause /> : <Icons.Play />}
            </div>
          </button>
          
          {/* Current channel logo + name */}
          {isLive && currentChannel && (
            <>
              {currentChannel.logo && (
                <img
                  src={currentChannel.logo}
                  alt=""
                  style={styles.channelLogo}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <span style={{ ...styles.channelName, ...styles.channelNameCurrent }}>
                {currentChannel.name}
              </span>
            </>
          )}
        </div>

        {/* ROW 2: Channel Navigation (prev/next only) */}
        {isLive && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '18px' }}>
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
                <span style={styles.channelName}>{prevChannel.name}</span>
              </div>
            )}

            {/* Button << */}
            <button onClick={onChannelPrev} style={styles.btnSwitch} title="Previous channel">
              ‹‹
            </button>

            {/* Spacer for center alignment */}
            <div style={{ width: '150px' }} />

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
                <span style={styles.channelName}>{nextChannel.name}</span>
                {nextChannel.logo && (
                  <img
                    src={nextChannel.logo}
                    alt=""
                    style={{ ...styles.channelLogo, ...styles.channelLogoSmall }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ROW 3: < Timeshift > with LIVE marker */}
        {isLive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {/* Skip Back < with multiplier */}
            <button
              onClick={handleSkipBack}
              style={{
                ...styles.btnEdge,
                color: skipBackCount > 0 ? 'white' : 'rgba(255,255,255,0.4)',
                position: 'relative',
              }}
              title={`Skip back ${skipAmounts[Math.max(0, skipBackCount - 1)] || 10}s`}
            >
              ‹
              {skipBackCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  fontSize: '9px',
                  background: 'linear-gradient(135deg, #6225ff, #a855f7)',
                  borderRadius: '50%',
                  width: '16px',
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                }}>
                  {skipBackCount}
                </span>
              )}
            </button>

            {/* Timeshift bar */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', minWidth: '45px' }}>
                {formatOffset(timeshiftOffset)}
              </span>
              <div
                style={{
                  ...styles.timeshift,
                  height: isHoveringTimeshift ? '6px' : '4px',
                }}
                onMouseEnter={() => setIsHoveringTimeshift(true)}
                onMouseLeave={() => setIsHoveringTimeshift(false)}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  const newOffset = maxTimeshiftOffset * (1 - percent);
                  onTimeshiftSeek?.(Math.max(0, Math.round(newOffset)));
                }}
              >
                <div style={{ ...styles.timeshiftProgress, width: `${timeshiftProgress}%` }}>
                  <div style={{ 
                    ...styles.timeshiftHandle, 
                    opacity: isHoveringTimeshift ? 1 : 0 
                  }} />
                </div>
                {/* LIVE marker - green */}
                <div style={styles.timeshiftLiveMarker} />
              </div>
            </div>

            {/* Skip Forward > with multiplier */}
            <button
              onClick={handleSkipForward}
              style={{
                ...styles.btnEdge,
                color: skipForwardCount > 0 ? '#22c55e' : (isAtLive ? '#22c55e' : 'rgba(255,255,255,0.4)'),
                position: 'relative',
              }}
              title={isAtLive ? 'At LIVE' : `Skip forward ${skipAmounts[Math.max(0, skipForwardCount - 1)] || 10}s`}
            >
              ›
              {skipForwardCount > 0 && !isAtLive && (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  left: '-5px',
                  fontSize: '9px',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  borderRadius: '50%',
                  width: '16px',
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                }}>
                  {skipForwardCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* VOD Progress bar */}
        {!isLive && duration > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', minWidth: '45px' }}>
              {formatTime(currentTime)}
            </span>
            <div
              style={{
                ...styles.timeshift,
                height: isHoveringTimeshift ? '6px' : '4px',
              }}
              onMouseEnter={() => setIsHoveringTimeshift(true)}
              onMouseLeave={() => setIsHoveringTimeshift(false)}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                onSeek?.(percent * duration);
              }}
            >
              <div style={{ ...styles.timeshiftProgress, width: `${(currentTime / duration) * 100}%` }}>
                <div style={{ 
                  ...styles.timeshiftHandle, 
                  opacity: isHoveringTimeshift ? 1 : 0 
                }} />
              </div>
            </div>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', minWidth: '45px', textAlign: 'right' }}>
              {formatTime(duration)}
            </span>
          </div>
        )}
      </div>
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
