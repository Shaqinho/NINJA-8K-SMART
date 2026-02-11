import React, { useState, useCallback, useRef, useEffect } from 'react';
import SettingsOverlay from './SettingsOverlay';

// ============================================================================
// PLAYER CONTROLS - Simple & Functional
// ============================================================================

const Icons = {
  Play: () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>,
  Pause: () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>,
  SkipPrev: () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>,
  SkipNext: () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>,
  Volume: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>,
  VolumeMute: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>,
  Fullscreen: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>,
  Minimize: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>,
};

const getResolutionLabel = (width) => {
  if (!width) return null;
  if (width >= 7680) return '8K UHD';
  if (width >= 3840) return '4K UHD';
  if (width >= 1920) return '1080p FHD';
  if (width >= 1280) return '720p HD';
  return 'SD';
};

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const PlayerControls = ({
  playing,
  muted = false,
  volume = 1,
  currentTime = 0,
  duration = 0,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onFullscreenToggle,
  fullscreen = false,
  isLive = true,
  visible = true,
  currentChannel,
  onChannelPrev,
  onChannelNext,
  xtreamService,
  onServers,
  sidebarOpen = false,
  onTapDismiss,
  probeData = null, // Probe video info from VOD
  aspectRatio = 'fit', // Current aspect ratio
  onAspectRatioChange, // Callback to change aspect ratio
  onShowMediaInfo, // Callback to show media info overlay
  onAudioTrackChange, // Callback to change audio track
  onSubtitleChange, // Callback to change subtitle track
  currentAudioTrack = null, // Currently selected audio track
  currentSubtitle = null, // Currently selected subtitle track
}) => {
  const [showSettingsOverlay, setShowSettingsOverlay] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showAudioTracks, setShowAudioTracks] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showRatioMenu, setShowRatioMenu] = useState(false);
  const timelineRef = useRef(null);
  const autoHideTimer = useRef(null);

  // Format channel name
  const channelName = currentChannel?.name || 'No Channel';

  // Auto-hide after 3s
  const resetAutoHide = useCallback(() => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    if (visible && fullscreen && !showSettingsOverlay && !isDragging) {
      autoHideTimer.current = setTimeout(() => {
        onTapDismiss?.();
      }, 3000);
    }
  }, [visible, fullscreen, showSettingsOverlay, isDragging, onTapDismiss]);

  useEffect(() => {
    if (visible && fullscreen) resetAutoHide();
    return () => {
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    };
  }, [visible, fullscreen, resetAutoHide]);

  // Timeline seek
  const handleTimelineClick = useCallback((e) => {
    if (!timelineRef.current || isLive) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percent * duration;
    onSeek?.(newTime);
  }, [duration, onSeek, isLive]);

  const handleTimelineDragStart = useCallback((e) => {
    if (isLive) return;
    setIsDragging(true);
    handleTimelineClick(e);
  }, [handleTimelineClick, isLive]);

  const handleTimelineDragMove = useCallback((e) => {
    if (!isDragging || !timelineRef.current || isLive) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percent * duration;
    onSeek?.(newTime);
  }, [isDragging, duration, onSeek, isLive]);

  const handleTimelineDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleTimelineDragMove);
      window.addEventListener('mouseup', handleTimelineDragEnd);
      window.addEventListener('touchmove', handleTimelineDragMove);
      window.addEventListener('touchend', handleTimelineDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleTimelineDragMove);
        window.removeEventListener('mouseup', handleTimelineDragEnd);
        window.removeEventListener('touchmove', handleTimelineDragMove);
        window.removeEventListener('touchend', handleTimelineDragEnd);
      };
    }
  }, [isDragging, handleTimelineDragMove, handleTimelineDragEnd]);

  if (!visible) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* Settings Overlay */}
      <SettingsOverlay
        visible={showSettingsOverlay}
        onClose={() => setShowSettingsOverlay(false)}
        xtreamService={xtreamService}
        onServers={onServers}
        sidebarOpen={sidebarOpen}
        onEPGGrid={() => {/* EPG Grid déjà géré dans Player */}}
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
            AUDIO ({probeData.audioTracks.length} tracks)
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
            SUBTITLES ({probeData.subtitleTracks.length} tracks)
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

      {/* Controls Container */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: sidebarOpen ? '280px' : 0,
          right: 0,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.9) 0%, transparent 100%)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          transition: 'left 0.3s ease',
          zIndex: 1000,
        }}
        onMouseMove={resetAutoHide}
        onTouchStart={resetAutoHide}
      >
        {/* Logo Ninja 8K (top-left) */}
        <button
          onClick={() => setShowSettingsOverlay(true)}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            background: 'rgba(0,0,0,0.5)',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
          }}
        >
          <span style={{ 
            fontSize: '16px', 
            fontWeight: '800', 
            background: 'linear-gradient(135deg, #6225ff, #a855f7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            NINJA 8K
          </span>
        </button>

        {/* Title + Description (top-left, VOD only) */}
        {!isLive && currentChannel?.name && (
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: '150px',
              color: 'white',
              maxWidth: '400px',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '2px' }}>
              {currentChannel.name}
            </div>
            {currentChannel.description && (
              <div style={{ fontSize: '11px', opacity: 0.7 }}>
                {currentChannel.description}
              </div>
            )}
          </div>
        )}

        {/* Resolution Badge (top-right, VOD only) */}
        {!isLive && probeData?.video?.width && (
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(0,0,0,0.7)',
              border: '1px solid rgba(76,222,128,0.4)',
              borderRadius: '6px',
              padding: '6px 12px',
              backdropFilter: 'blur(10px)',
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

        {/* Top-Right Controls (VOD only): AD | CC | ⓘ | ⋮ */}
        {!isLive && (
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: probeData?.video?.width ? '120px' : '20px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
            }}
          >
            {/* AD - Audio Tracks */}
            <button
              onClick={() => setShowAudioTracks(!showAudioTracks)}
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600',
              }}
              title="Audio Tracks"
            >
              AD
            </button>

            {/* CC - Subtitles */}
            <button
              onClick={() => setShowSubtitles(!showSubtitles)}
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600',
              }}
              title="Subtitles"
            >
              CC
            </button>

            {/* ⓘ - Media Info */}
            <button
              onClick={() => onShowMediaInfo?.()}
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                cursor: 'pointer',
                fontSize: '16px',
              }}
              title="Media Info"
            >
              ⓘ
            </button>

            {/* ⋮ - Settings */}
            <button
              onClick={() => setShowSettingsOverlay(true)}
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                cursor: 'pointer',
                fontSize: '18px',
                lineHeight: '1',
              }}
              title="Settings"
            >
              ⋮
            </button>
          </div>
        )}

        {/* Channel Navigation */}
        {isLive && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
          }}>
            <button
              onClick={onChannelPrev}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                fontSize: '20px',
                fontWeight: '600',
                padding: '8px',
              }}
            >
              ‹
            </button>

            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: 'white',
              textAlign: 'center',
              minWidth: '200px',
            }}>
              {channelName}
            </div>

            <button
              onClick={onChannelNext}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                fontSize: '20px',
                fontWeight: '600',
                padding: '8px',
              }}
            >
              ›
            </button>
          </div>
        )}

        {/* Seekbar (VOD only) */}
        {!isLive && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div
              ref={timelineRef}
              onMouseDown={handleTimelineDragStart}
              onTouchStart={handleTimelineDragStart}
              style={{
                height: '6px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '3px',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <div style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #6225ff, #a855f7)',
                borderRadius: '3px',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  right: '-6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '12px',
                  height: '12px',
                  background: 'white',
                  borderRadius: '50%',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }} />
              </div>
            </div>

            {/* Timestamps */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.6)',
            }}>
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}

        {/* Bottom Controls - VOD Layout */}
        {!isLive && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            {/* Row 1: Skip + Play/Pause */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <button
                onClick={onChannelPrev}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icons.SkipPrev />
              </button>

              <button
                onClick={onPlayPause}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '56px',
                  height: '56px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'white',
                }}
              >
                {playing ? <Icons.Pause /> : <Icons.Play />}
              </button>

              <button
                onClick={onChannelNext}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icons.SkipNext />
              </button>
            </div>

            {/* Row 2: Skip ±15s | Volume | Settings | Ratio */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Skip -15s */}
              <button
                onClick={() => onSeek?.(Math.max(0, currentTime - 15))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  fontSize: '20px',
                }}
                title="Rewind 15s"
              >
                <span>↺</span>
                <span style={{ fontSize: '9px' }}>15</span>
              </button>

              {/* Skip +15s */}
              <button
                onClick={() => onSeek?.(Math.min(duration, currentTime + 15))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  fontSize: '20px',
                }}
                title="Forward 15s"
              >
                <span>↻</span>
                <span style={{ fontSize: '9px' }}>15</span>
              </button>

              {/* Volume */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={onMuteToggle}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {muted || volume === 0 ? <Icons.VolumeMute /> : <Icons.Volume />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={muted ? 0 : volume}
                  onChange={(e) => onVolumeChange?.(parseFloat(e.target.value))}
                  style={{
                    width: '80px',
                    accentColor: '#6225ff',
                  }}
                />
              </div>

              {/* Settings */}
              <button
                onClick={() => setShowSettingsOverlay(true)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}
                title="Settings"
              >
                ⚙️
              </button>

              {/* Aspect Ratio */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowRatioMenu(!showRatioMenu)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: '600',
                  }}
                  title="Aspect Ratio"
                >
                  {aspectRatio.toUpperCase()}
                </button>

                {/* Ratio Menu */}
                {showRatioMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '40px',
                      right: 0,
                      background: 'rgba(0,0,0,0.9)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '6px',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      minWidth: '80px',
                    }}
                  >
                    {['fit', '16:9', '21:9', '16:10', '1:1'].map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => {
                          onAspectRatioChange?.(ratio);
                          setShowRatioMenu(false);
                        }}
                        style={{
                          background: aspectRatio === ratio ? 'rgba(98,37,255,0.3)' : 'none',
                          border: 'none',
                          color: 'white',
                          padding: '6px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          textAlign: 'left',
                          borderRadius: '4px',
                        }}
                      >
                        {ratio.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Controls - LIVE Layout */}
        {isLive && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}>
            {/* Left: Play/Pause */}
            <button
              onClick={onPlayPause}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
              }}
            >
              {playing ? <Icons.Pause /> : <Icons.Play />}
            </button>

            {/* Right: Volume + Fullscreen */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Volume */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={onMuteToggle}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {muted || volume === 0 ? <Icons.VolumeMute /> : <Icons.Volume />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={muted ? 0 : volume}
                  onChange={(e) => onVolumeChange?.(parseFloat(e.target.value))}
                  style={{
                    width: '80px',
                    accentColor: '#6225ff',
                  }}
                />
              </div>

              {/* Fullscreen */}
              <button
                onClick={onFullscreenToggle}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {fullscreen ? <Icons.Minimize /> : <Icons.Fullscreen />}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PlayerControls;
