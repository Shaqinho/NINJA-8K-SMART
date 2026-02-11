import React, { useState, useEffect, useCallback, useRef } from 'react';
import SettingsOverlay from './SettingsOverlay';

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

// Format time helper
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Resolution label helper
const getResolutionLabel = (width) => {
  if (!width) return null;
  if (width >= 7680) return '8K UHD';
  if (width >= 3840) return '4K UHD';
  if (width >= 1920) return '1080p FHD';
  if (width >= 1280) return '720p HD';
  return 'SD';
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
  fullscreen = false,
  isLive = true,
  visible = true,
  // Channel navigation
  currentChannel,
  onChannelPrev,
  onChannelNext,
  // Timeshift
  timeshiftOffset = 0,
  maxTimeshiftOffset = 7200,
  onTimeshiftSeek,
  onJumpToLive,
  // Stream info
  streamInfo = null, // { category: 'FR| SPORT', resolution: '1080p', codec: 'HEVC', fps: '50fps', bitrate: '8.5 Mbps' }
  // Media info (movie/series detail from parent)
  currentMedia = null, // { title, season, episode, duration, resolution, audioTracks, subtitleTracks, type }
  // Settings overlay
  xtreamService,
  onServers,
  onTapDismiss,
  // Sidebar state
  sidebarOpen = false,
  // Probe data (VOD only)
  probeData = null,
  onAudioTrackChange,
  onSubtitleChange,
  currentAudioTrack = null,
  currentSubtitle = null,
}) => {
  const [isHoveringTimeshift, setIsHoveringTimeshift] = useState(false);
  const [showSettingsOverlay, setShowSettingsOverlay] = useState(false);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const [showAudioTracks, setShowAudioTracks] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const timelineRef = useRef(null);
  const vodTimelineRef = useRef(null);
  const autoHideTimerRef = useRef(null);

  // ========== AUTO-HIDE CONTROLS (2s inactivity) ==========
  const resetAutoHideTimer = useCallback(() => {
    if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    if (visible && fullscreen && !showSettingsOverlay && !isDraggingTimeline) {
      autoHideTimerRef.current = setTimeout(() => {
        onTapDismiss?.();
      }, 2000);
    }
  }, [visible, fullscreen, showSettingsOverlay, isDraggingTimeline, onTapDismiss]);

  // Start/reset timer when controls become visible
  useEffect(() => {
    if (visible && fullscreen) {
      resetAutoHideTimer();
    } else {
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    }
    return () => {
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    };
  }, [visible, fullscreen, resetAutoHideTimer]);

  // Pause auto-hide during drag or settings overlay
  useEffect(() => {
    if (isDraggingTimeline || showSettingsOverlay) {
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    } else if (visible && fullscreen) {
      resetAutoHideTimer();
    }
  }, [isDraggingTimeline, showSettingsOverlay, visible, fullscreen, resetAutoHideTimer]);
  
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
  // OTT SIDEBAR OPEN - Hide controls completely
  // ===========================================
  if (sidebarOpen) return null;

  // ===========================================
  // ===========================================
  // FULLSCREEN MODE - OTT Design (ALWAYS)
  // ===========================================
  return (
    <div
      className={`absolute inset-0 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
      onTouchStart={() => resetAutoHideTimer()}
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

      {/* Resolution Badge (top-left, VOD only) */}
      {!isLive && probeData?.video?.width && (
        <div
          style={{
            position: 'absolute',
            top: '15px',
            left: '15px',
            background: 'rgba(0,0,0,0.7)',
            border: '1px solid rgba(76,222,128,0.4)',
            borderRadius: '6px',
            padding: '6px 12px',
            backdropFilter: 'blur(10px)',
            zIndex: 10001,
          }}
        >
          <span style={{ 
            fontSize: '11px', 
            fontWeight: '700', 
            color: '#4ade80',
          }}>
            {getResolutionLabel(probeData.video.width)}
          </span>
        </div>
      )}

      {/* AUDIO + SUBTITLES buttons (top-right, VOD only) */}
      {!isLive && probeData && (
        <div
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            display: 'flex',
            gap: '8px',
            zIndex: 10001,
          }}
        >
          {/* AUDIO */}
          <button
            onClick={() => setShowAudioTracks(!showAudioTracks)}
            style={{
              background: 'rgba(0,0,0,0.7)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              padding: '6px 12px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '600',
              backdropFilter: 'blur(10px)',
            }}
          >
            AUDIO
          </button>

          {/* SUBTITLES */}
          <button
            onClick={() => setShowSubtitles(!showSubtitles)}
            style={{
              background: 'rgba(0,0,0,0.7)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              padding: '6px 12px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '600',
              backdropFilter: 'blur(10px)',
            }}
          >
            SUBTITLES
          </button>
        </div>
      )}

      {/* Top Right: Play/Pause */}
      <button
        onClick={onPlayPause}
        style={{
          position: 'absolute',
          top: '12px',
          right: '16px',
          ...styles.cornerBtn,
          zIndex: 10001,
        }}
        title={playing ? 'Pause' : 'Play'}
      >
        <div className="w-5 h-5 text-white">
          {playing ? <Icons.Pause /> : <Icons.Play />}
        </div>
      </button>
      
      {/* ========== MIDDLE TAP ZONE (tap to dismiss) ========== */}
      <div
        style={{
          position: 'absolute',
          top: '60px',
          left: 0,
          right: 0,
          bottom: '180px',
          zIndex: 10000,
        }}
        onClick={() => onTapDismiss?.()}
      />

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
        {/* ROW 1: Channel Navigation */}
        {isLive && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={onChannelPrev} style={styles.btnSwitch} title="Previous channel">
                ‹‹
              </button>
            </div>
            {currentChannel && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '4px 8px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {currentChannel.logo && (
                    <img src={currentChannel.logo} alt="" style={styles.channelLogo} onError={(e) => { e.target.style.display = 'none'; }} />
                  )}
                  <span style={{ ...styles.channelName, ...styles.channelNameCurrent, display: 'block', maxWidth: '50vw' }}>
                    {currentChannel.name}
                  </span>
                </div>
                {/* EPG now + metadata */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {currentChannel.epg_now && (
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', maxWidth: '40vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {currentChannel.epg_now}
                    </span>
                  )}
                  {currentChannel.stream_id && (
                    <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
                      ID:{currentChannel.stream_id}
                    </span>
                  )}
                  {currentChannel.epgChannelId && (
                    <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
                      {currentChannel.epgChannelId}
                    </span>
                  )}
                  {streamInfo?.resolution && (
                    <span style={{ fontSize: '7px', color: 'rgba(98,37,255,0.6)', fontWeight: 700 }}>
                      {streamInfo.resolution}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
              <button onClick={onChannelNext} style={styles.btnSwitch} title="Next channel">
                ››
              </button>
            </div>
          </div>
        )}

        {/* ROW 3: < Timeshift > + Minimize */}
        {isLive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
            {/* Skip Back < */}
            <button
              onClick={() => handleSkip('back')}
              style={{
                ...styles.btnEdge,
                color: 'white',
                padding: '8px 0px',
              }}
            >
              ‹
            </button>

            {/* Timeshift bar */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '35%', position: 'relative' }}>
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
                padding: '8px 0px',
              }}
            >
              ›
            </button>
          </div>
        )}

        {/* VOD/Series Media Info */}
        {!isLive && currentMedia && (
          <div style={{ marginBottom: '8px' }}>
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {currentMedia.type === 'series' && currentMedia.season && currentMedia.episode
                  ? `S${currentMedia.season}E${currentMedia.episode} — ${currentMedia.title || ''}`
                  : (currentMedia.title || '')
                }
              </span>
              {currentMedia.duration && (
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', flexShrink: 0 }}>
                  {currentMedia.duration}
                </span>
              )}
            </div>
            {/* Tech row */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              {currentMedia.resolution && (
                <span style={{ fontSize: '8px', color: 'rgba(98,37,255,0.7)', fontWeight: 700, background: 'rgba(98,37,255,0.15)', padding: '1px 5px', borderRadius: '3px' }}>
                  {currentMedia.resolution}
                </span>
              )}
              {currentMedia.audioTracks > 0 && (
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)' }}>
                  🔊 {currentMedia.audioTracks} tracks
                </span>
              )}
              {currentMedia.subtitleTracks > 0 && (
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)' }}>
                  💬 {currentMedia.subtitleTracks} subs
                </span>
              )}
            </div>
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

      {/* Audio Tracks Overlay */}
      {showAudioTracks && probeData?.audioTracks && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            background: 'rgba(0,0,0,0.95)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '12px',
            minWidth: '220px',
            maxHeight: '400px',
            overflowY: 'auto',
            zIndex: 10002,
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ 
            fontSize: '12px', 
            fontWeight: '700', 
            color: '#6225ff', 
            marginBottom: '8px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: '8px',
          }}>
            AUDIO ({probeData.audioTracks.length})
          </div>
          {probeData.audioTracks.map((track, index) => {
            const isActive = currentAudioTrack === index || (currentAudioTrack === null && index === 0);
            const lang = track.language || track.name || `Track ${index + 1}`;
            const channels = track.channels ? (track.channels === 6 ? '5.1' : track.channels === 2 ? 'Stereo' : `${track.channels}ch`) : '';
            
            return (
              <button
                key={index}
                onClick={() => {
                  onAudioTrackChange?.(index);
                  setShowAudioTracks(false);
                }}
                style={{
                  width: '100%',
                  background: isActive ? 'rgba(98,37,255,0.3)' : 'transparent',
                  border: 'none',
                  color: 'white',
                  padding: '8px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  textAlign: 'left',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px',
                }}
                onMouseEnter={(e) => !isActive && (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={(e) => !isActive && (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: '14px', opacity: isActive ? 1 : 0 }}>✓</span>
                <span style={{ flex: 1 }}>{lang.toUpperCase()}</span>
                {channels && <span style={{ fontSize: '9px', opacity: 0.7 }}>{channels}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Subtitles Overlay */}
      {showSubtitles && probeData?.subtitleTracks && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            background: 'rgba(0,0,0,0.95)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '12px',
            minWidth: '220px',
            maxHeight: '400px',
            overflowY: 'auto',
            zIndex: 10002,
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ 
            fontSize: '12px', 
            fontWeight: '700', 
            color: '#6225ff', 
            marginBottom: '8px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: '8px',
          }}>
            SUBTITLES ({probeData.subtitleTracks.length})
          </div>
          
          {/* None option */}
          <button
            onClick={() => {
              onSubtitleChange?.(null);
              setShowSubtitles(false);
            }}
            style={{
              width: '100%',
              background: currentSubtitle === null ? 'rgba(98,37,255,0.3)' : 'transparent',
              border: 'none',
              color: 'white',
              padding: '8px',
              cursor: 'pointer',
              fontSize: '11px',
              textAlign: 'left',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px',
            }}
            onMouseEnter={(e) => currentSubtitle !== null && (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={(e) => currentSubtitle !== null && (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: '14px', opacity: currentSubtitle === null ? 1 : 0 }}>✓</span>
            <span>NONE</span>
          </button>

          {probeData.subtitleTracks.map((track, index) => {
            const isActive = currentSubtitle === index;
            const lang = track.language || track.name || `Track ${index + 1}`;
            
            return (
              <button
                key={index}
                onClick={() => {
                  onSubtitleChange?.(index);
                  setShowSubtitles(false);
                }}
                style={{
                  width: '100%',
                  background: isActive ? 'rgba(98,37,255,0.3)' : 'transparent',
                  border: 'none',
                  color: 'white',
                  padding: '8px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  textAlign: 'left',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px',
                }}
                onMouseEnter={(e) => !isActive && (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={(e) => !isActive && (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: '14px', opacity: isActive ? 1 : 0 }}>✓</span>
                <span>{lang.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      )}

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

export default PlayerControls;
