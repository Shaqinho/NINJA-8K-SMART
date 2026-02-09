import React, { useRef, useState, useEffect, useCallback, memo, useMemo } from 'react';
import { THEME } from '../../constants/theme';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import PlayerControls from './PlayerControls';

import { PlayerSettings } from './PlayerSettings';
import VideoPlayer from './VideoPlayer';
import OTTLeft from './OTTLeft';             // OTTLeft
import OTTRight from './OTTRight';           // OTTRight (live: EPG search, movies/series: poster grid)
import EPGGrid from './EPGGrid';             // EPGGrid fullscreen (Planby temporal proportions)

// ============================================================================
// NINJA 8K PLAYER - Main Component
// OTTLeft = channel list sidebar (280px)
// OTTRight = EPGSearch (live) or MediaGallery (movies/series)
// ============================================================================

const Player = memo(({
  channel,
  isPlaying,
  onTogglePlay,
  onChannelChange,
  isLive = true,
  onSearchEPG,
  isSmartFullscreen = false,
  volume: externalVolume,
  onVolumeChange: externalVolumeChange,
  ottSidebarOpen = false,
  onOttSidebarChange,
  onTabChange,
  xtreamService,
  onServers,
  // EPG sync props from App.jsx
  epgSyncProgress = 0,
  epgSyncingFolders = new Set(),
  userLangs = [],
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const sidebarRef = useRef(null);
  const [sidebarTab, setSidebarTab] = useState('live');

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const volume = externalVolume !== undefined ? externalVolume : 1;
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeshiftOffset, setTimeshiftOffset] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [aspectRatio, setAspectRatio] = useState('Auto');
  
  // EPGGrid state
  const [showEPGGrid, setShowEPGGrid] = useState(false);
  const [favorites, setFavorites] = useState([]);

  const src = channel?.streamUrl || channel?.url || null;

  // ============================================================================
  // CHANNELS LIST — fed by OTTLeft via window globals
  // OTTLeft sets window.__ottChannels when its filtered list changes
  // ============================================================================
  const [ottChannels, setOttChannels] = useState([]);

  useEffect(() => {
    // OTTLeft publishes its channel list
    window.__ottSetChannels = (channels) => setOttChannels(channels);
    return () => { window.__ottSetChannels = null; };
  }, []);

  // Channel navigation from OTTLeft's list
  const currentChannelIndex = ottChannels.findIndex(
    ch => (ch.streamUrl || ch.url) === src || ch.id === channel?.id
  );
  const prevChannel = currentChannelIndex > 0 ? ottChannels[currentChannelIndex - 1] : null;
  const nextChannel = currentChannelIndex < ottChannels.length - 1 ? ottChannels[currentChannelIndex + 1] : null;

  // ============================================================================
  // BUILD currentMedia for PlayerControls (Phase 4)
  // ============================================================================
  const currentMedia = useMemo(() => {
    if (!channel) return null;
    if (isLive) return null; // Live uses channel info directly

    return {
      title: channel.title || channel.name || '',
      type: channel.type === 'series' ? 'series' : 'movie',
      season: channel.season || null,
      episode: channel.episode || channel.episode_num || null,
      duration: channel.duration ? formatDuration(channel.duration) : null,
      resolution: channel.resolution || null,
      audioTracks: channel.audioTracks || 0,
      subtitleTracks: channel.subtitleTracks || 0,
    };
  }, [channel, isLive]);

  // Sync tab change to parent
  useEffect(() => {
    onTabChange?.(sidebarTab);
  }, [sidebarTab, onTabChange]);

  // Sync fullscreen state
  useEffect(() => {
    setIsFullscreen(isSmartFullscreen);
  }, [isSmartFullscreen]);

  // Force VideoPlayer position update when fullscreen changes
  useEffect(() => {
    if (videoRef.current?.updatePosition) {
      setTimeout(() => videoRef.current?.updatePosition?.(), 100);
      setTimeout(() => videoRef.current?.updatePosition?.(), 300);
      setTimeout(() => videoRef.current?.updatePosition?.(), 500);
    }
  }, [isFullscreen, isSmartFullscreen]);

  // Sync volume
  useEffect(() => {
    if (videoRef.current && volume !== undefined) {
      videoRef.current.setVolume(volume);
    }
  }, [volume]);

  // Mute when browsing Movies/Series
  useEffect(() => {
    if (!videoRef.current) return;
    const shouldMute = ottSidebarOpen && sidebarTab !== 'live';
    videoRef.current.setVolume(shouldMute ? 0 : volume);
  }, [ottSidebarOpen, sidebarTab, volume]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      // Pause the video
      if (videoRef.current) {
        videoRef.current.pause();
      }
    } else {
      // Play the video
      if (videoRef.current && src) {
        videoRef.current.play(src);
      }
    }
    // Toggle state
    onTogglePlay?.();
  }, [isPlaying, onTogglePlay, src]);

  const handleStateChange = useCallback((state) => {
    setIsLoading(state === 'buffering');
  }, []);

  const handleError = useCallback((err) => {
    setError(err?.error || 'Playback error');
    setIsLoading(false);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current?.getVideoElement) {
      const video = videoRef.current.getVideoElement();
      if (video) {
        setCurrentTime(video.currentTime);
        setDuration(video.duration || 0);
      }
    }
  }, []);

  const handleSeek = useCallback((time) => {
    if (videoRef.current) {
      videoRef.current.seekTo(time);
      setCurrentTime(time);
    }
  }, []);

  const handleSeekRelative = useCallback((offset) => {
    if (videoRef.current) {
      videoRef.current.seekRelative(offset);
    }
  }, []);

  const handleVolumeChange = useCallback((vol) => {
    if (externalVolumeChange) externalVolumeChange(vol);
    setMuted(vol === 0);
    if (videoRef.current) {
      videoRef.current.setVolume(vol);
    }
  }, [externalVolumeChange]);

  const handleMuteToggle = useCallback(() => {
    const newMuted = !muted;
    setMuted(newMuted);
    if (videoRef.current) {
      if (newMuted) {
        videoRef.current.mute();
      } else {
        videoRef.current.unmute();
        videoRef.current.setVolume(volume);
      }
    }
  }, [muted, volume]);

  const toggleFullscreen = useCallback(async () => {
    if (isSmartFullscreen) {
      try {
        await ScreenOrientation.lock({ orientation: 'portrait' });
      } catch (e) {
        console.log('ScreenOrientation portrait lock failed:', e);
      }
      onTogglePlay?.();
      return;
    }
    
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
        try {
          await ScreenOrientation.lock({ orientation: 'landscape' });
        } catch (e) {
          console.log('ScreenOrientation not available:', e);
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
        try {
          await ScreenOrientation.unlock();
        } catch (e) {
          console.log('ScreenOrientation unlock failed:', e);
        }
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, [isSmartFullscreen, onTogglePlay]);

  useEffect(() => {
    const handleFullscreenChange = async () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
        try { await ScreenOrientation.unlock(); } catch (e) { }
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isFullscreen]);

  const handleTimeshiftSeek = useCallback((offset) => {
    setTimeshiftOffset(offset);
  }, []);

  const handleChannelPrev = useCallback(() => {
    if (prevChannel && onChannelChange) onChannelChange(prevChannel);
  }, [prevChannel, onChannelChange]);

  const handleChannelNext = useCallback(() => {
    if (nextChannel && onChannelChange) onChannelChange(nextChannel);
  }, [nextChannel, onChannelChange]);

  const handleSpeedChange = useCallback((speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current?.getVideoElement) {
      const video = videoRef.current.getVideoElement();
      if (video) video.playbackRate = speed;
    }
  }, []);

  useEffect(() => {
    if (!isPlaying || showSettings) return;
    const timer = setTimeout(() => setShowControls(false), 6000);
    return () => clearTimeout(timer);
  }, [isPlaying, showSettings]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{
        backgroundColor: 'transparent',
      }}
      onClick={() => setShowControls(true)}
    >
      {/* Video */}
      <div className="absolute inset-0">
        {src ? (
          <VideoPlayer
            ref={videoRef}
            src={src}
            isFullScreen={isFullscreen || isSmartFullscreen}
            aspectRatio={aspectRatio.toLowerCase()}
            onStateChange={handleStateChange}
            onError={handleError}
            onTap={() => setShowControls(true)}
            events={{
              onTimeUpdate: handleTimeUpdate,
              onLoadStart: () => setIsLoading(true),
              onCanPlay: () => setIsLoading(false),
              onError: () => setError('Playback error'),
            }}
            className="absolute inset-0"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'transparent' }}>
            <p className="text-gray-600 text-xs">Select content</p>
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-transparent pointer-events-none">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-transparent">
          <div className="text-center p-4">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 px-4 py-2 rounded-lg text-white text-sm"
              style={{ background: THEME.gradients.primary }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div>
        <PlayerControls
          playing={isPlaying}
          muted={muted}
          volume={volume}
          currentTime={currentTime}
          duration={duration}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          onSeekRelative={handleSeekRelative}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={handleMuteToggle}
          onFullscreenToggle={toggleFullscreen}
          fullscreen={isFullscreen}
          onSearchEPG={onSearchEPG}
          visible={showControls}
          isLive={isLive}
          // Channel navigation (from OTTLeft list)
          currentChannel={channel ? {
            name: channel.name,
            logo: channel.logo,
            stream_id: channel.id || channel.stream_id,
            epgChannelId: channel.epgChannelId,
            epg_now: channel.epg_now,
          } : null}
          onChannelPrev={handleChannelPrev}
          onChannelNext={handleChannelNext}
          // Media info (movies/series)
          currentMedia={currentMedia}
          // Timeshift
          timeshiftOffset={timeshiftOffset}
          maxTimeshiftOffset={7200}
          onTimeshiftSeek={handleTimeshiftSeek}
          onJumpToLive={() => setTimeshiftOffset(0)}
          // Sidebar state
          sidebarOpen={ottSidebarOpen}
          // Stream info
          streamInfo={null}
          // Settings overlay
          xtreamService={xtreamService}
          onServers={onServers}
          onTapDismiss={() => setShowControls(false)}
        />
      </div>

      {/* Settings */}
      <PlayerSettings
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        currentSpeed={playbackSpeed}
        onSpeedChange={handleSpeedChange}
        currentAspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
      />

      {/* OTTLeft — Channel list sidebar */}
      {(isFullscreen || isSmartFullscreen) && (
        <OTTLeft
          ref={sidebarRef}
          selectedChannel={channel}
          onChannelSelect={onChannelChange}
          isOpen={ottSidebarOpen}
          onToggle={onOttSidebarChange}
          onTabChange={(tab) => setSidebarTab(tab)}
          xtreamService={xtreamService}
          epgSyncProgress={epgSyncProgress}
          epgSyncingFolders={epgSyncingFolders}
        />
      )}

      {/* OTTRight — EPGSearch (live) or MediaGallery (movies/series) */}
      {(isFullscreen || isSmartFullscreen) && (
        <div style={{
          position: 'absolute',
          top: 0, bottom: 0, left: '280px', right: 0,
          background: 'rgba(0,0,0,0.75)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 10001,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transform: ottSidebarOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: ottSidebarOpen ? 'auto' : 'none',
        }}>
          <OTTRight
            items={sidebarRef.current?.getFilteredItems() || []}
            sidebarTab={sidebarTab}
            xtreamService={xtreamService}
            videoRef={videoRef}
            onItemSelect={onChannelChange}
            visible={ottSidebarOpen}
          />
        </div>
      )}
      
      {/* EPGGrid Fullscreen */}
      {showEPGGrid && (
        <EPGGrid
          folder={null}
          xtreamService={xtreamService}
          currentChannel={channel}
          favorites={favorites}
          onChannelSelect={(ch) => {
            onChannelChange(ch);
            setShowEPGGrid(false);
          }}
          onToggleFavorite={(streamId) => {
            setFavorites(prev => 
              prev.includes(streamId)
                ? prev.filter(id => id !== streamId)
                : [...prev, streamId]
            );
          }}
          onFolderNext={() => {
            // TODO: Implement folder navigation
            console.log('Next folder');
          }}
          onFolderPrev={() => {
            // TODO: Implement folder navigation
            console.log('Prev folder');
          }}
          onClose={() => setShowEPGGrid(false)}
        />
      )}
    </div>
  );
});

Player.displayName = 'Player';

// Helper
const formatDuration = (seconds) => {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m}min`;
};

export default Player;
