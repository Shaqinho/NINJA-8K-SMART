import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import { THEME } from '../../constants/theme';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import PlayerControls from './PlayerControls';

import { PlayerSettings } from './PlayerSettings';
import VideoPlayer from './VideoPlayer';
import MultiGrid from './MultiGrid';
import OTTSidebar from './OTTSidebar';
import EPGSearch from './EPGSearch';
import MediaGallery from './MediaGallery';

// ============================================================================
// NINJA 8K PLAYER - Main Component
// ============================================================================

const Player = memo(({
  channel,
  channels = [],
  categories = [],
  isPlaying,
  onTogglePlay,
  onChannelChange,
  isLive = true,
  onSearchEPG,
  multiGridItems = [],
  onMultiGridAdd,
  onMultiGridRemove,
  showMultiGrid = false,
  onMultiGridToggle,
  isSmartFullscreen = false,
  volume: externalVolume,
  onVolumeChange: externalVolumeChange,
  ottSidebarOpen = false,
  onOttSidebarChange,
  xtreamService,
  onServers,
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

  const [internalMultiGridItems, setInternalMultiGridItems] = useState([]);
  const [internalShowMultiGrid, setInternalShowMultiGrid] = useState(false);
  const [multiGridActiveIndex, setMultiGridActiveIndex] = useState(0);
  const [multiGridSize, setMultiGridSize] = useState(2);

  const actualMultiGridItems = multiGridItems.length > 0 ? multiGridItems : internalMultiGridItems;
  const actualShowMultiGrid = showMultiGrid !== undefined ? showMultiGrid : internalShowMultiGrid;

  const [isInvertedGravity, setIsInvertedGravity] = useState(false);

  const src = channel?.streamUrl || channel?.url || null;

  // ============================================================================
  // CALCULATE PREV/NEXT CHANNELS AND CATEGORIES
  // ============================================================================
  
  // Find current channel index in the channels list
  const currentChannelIndex = channels.findIndex(
    ch => (ch.streamUrl || ch.url) === src || ch.id === channel?.id || ch.name === channel?.name
  );
  
  // Get prev/next channels
  const prevChannel = currentChannelIndex > 0 ? channels[currentChannelIndex - 1] : null;
  const nextChannel = currentChannelIndex < channels.length - 1 ? channels[currentChannelIndex + 1] : null;
  
  // Find current category
  const currentCategoryName = channel?.category || channel?.group;
  const currentCategoryIndex = categories.findIndex(cat => cat.name === currentCategoryName);
  
  // Get channels in current category for count
  const channelsInCurrentCategory = channels.filter(
    ch => (ch.category || ch.group) === currentCategoryName
  );
  
  // Get prev/next categories with channel counts
  const prevCategoryData = currentCategoryIndex > 0 ? categories[currentCategoryIndex - 1] : null;
  const nextCategoryData = currentCategoryIndex < categories.length - 1 ? categories[currentCategoryIndex + 1] : null;
  
  const getChannelCountForCategory = (categoryName) => {
    return channels.filter(ch => (ch.category || ch.group) === categoryName).length;
  };
  
  const currentCategory = currentCategoryName ? {
    name: currentCategoryName,
    count: channelsInCurrentCategory.length,
  } : null;
  
  const prevCategory = prevCategoryData ? {
    name: prevCategoryData.name,
    count: getChannelCountForCategory(prevCategoryData.name),
  } : null;
  
  const nextCategory = nextCategoryData ? {
    name: nextCategoryData.name,
    count: getChannelCountForCategory(nextCategoryData.name),
  } : null;

  // Sync fullscreen state with Smart's isSmartFullscreen
  useEffect(() => {
    setIsFullscreen(isSmartFullscreen);
  }, [isSmartFullscreen]);

  // Force VideoPlayer position update when fullscreen changes
  useEffect(() => {
    if (videoRef.current?.updatePosition) {
      // Multiple delays for layout stabilization
      setTimeout(() => videoRef.current?.updatePosition?.(), 100);
      setTimeout(() => videoRef.current?.updatePosition?.(), 300);
      setTimeout(() => videoRef.current?.updatePosition?.(), 500);
    }
  }, [isFullscreen, isSmartFullscreen]);

  // Sync volume prop to video element
  useEffect(() => {
    if (videoRef.current && volume !== undefined) {
      videoRef.current.setVolume(volume);
    }
  }, [volume]);

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
    // If in Smart fullscreen (landscape mode), just force portrait — video keeps playing
    if (isSmartFullscreen) {
      try {
        await ScreenOrientation.lock({ orientation: 'portrait' });
      } catch (e) {
        console.log('ScreenOrientation portrait lock failed:', e);
      }
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
  }, [isSmartFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = async () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
        try {
          await ScreenOrientation.unlock();
        } catch (e) { }
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isFullscreen]);

  useEffect(() => {
    const handleOrientationChange = () => {
      const angle = window.innerWidth > window.innerHeight ? 
        (window.orientation || 90) : 
        (window.orientation || 0);
      
      setIsInvertedGravity(angle === 180 || angle === 270);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    handleOrientationChange();

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  const handleMultiGridToggle = useCallback(() => {
    if (onMultiGridToggle) {
      onMultiGridToggle();
    } else {
      setInternalShowMultiGrid(!internalShowMultiGrid);
    }
  }, [onMultiGridToggle, internalShowMultiGrid]);

  const handleMultiGridSelect = useCallback((index) => {
    setMultiGridActiveIndex(index);
    const item = actualMultiGridItems[index];
    if (item) {
      onChannelChange?.(item);
    }
  }, [actualMultiGridItems, onChannelChange]);

  const handleMultiGridRemove = useCallback((index) => {
    if (onMultiGridRemove) {
      onMultiGridRemove(index);
    } else {
      setInternalMultiGridItems(prev => prev.filter((_, i) => i !== index));
    }
  }, [onMultiGridRemove]);

  const handleMultiGridAdd = useCallback(() => {
    if (onMultiGridToggle) {
      onMultiGridToggle();
    } else {
      setInternalShowMultiGrid(false);
    }
  }, [onMultiGridToggle]);

  void onMultiGridAdd;

  const renderMultiGridVideo = useCallback((item, index) => {
    const itemSrc = item?.streamUrl || item?.url;
    if (!itemSrc) return null;

    void index;

    return (
      <VideoPlayer
        src={itemSrc}
        aspectRatio="auto"
        className="w-full h-full"
      />
    );
  }, []);

  const handleTimeshiftSeek = useCallback((offset) => {
    setTimeshiftOffset(offset);
  }, []);

  // Channel navigation handlers
  const handleChannelPrev = useCallback(() => {
    if (prevChannel && onChannelChange) {
      onChannelChange(prevChannel);
    }
  }, [prevChannel, onChannelChange]);

  const handleChannelNext = useCallback(() => {
    if (nextChannel && onChannelChange) {
      onChannelChange(nextChannel);
    }
  }, [nextChannel, onChannelChange]);

  // Category navigation handlers
  const handleCategoryPrev = useCallback(() => {
    if (prevCategoryData && onChannelChange) {
      // Find first channel in previous category
      const firstChannelInCategory = channels.find(
        ch => (ch.category || ch.group) === prevCategoryData.name
      );
      if (firstChannelInCategory) {
        onChannelChange(firstChannelInCategory);
      }
    }
  }, [prevCategoryData, channels, onChannelChange]);

  const handleCategoryNext = useCallback(() => {
    if (nextCategoryData && onChannelChange) {
      // Find first channel in next category
      const firstChannelInCategory = channels.find(
        ch => (ch.category || ch.group) === nextCategoryData.name
      );
      if (firstChannelInCategory) {
        onChannelChange(firstChannelInCategory);
      }
    }
  }, [nextCategoryData, channels, onChannelChange]);

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
      className="relative w-full"
      style={{
        aspectRatio: isFullscreen ? 'auto' : '16/9',
        height: isFullscreen ? '100%' : 'auto',
        backgroundColor: 'transparent',
      }}
      onClick={() => setShowControls(true)}
    >
      {/* Video Player - CRITICAL: Pass isFullScreen prop */}
      <div
        className="absolute inset-0"
      >
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
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: 'transparent' }}
          >
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
              onClick={() => { setError(null); }}
              className="mt-2 px-4 py-2 rounded-lg text-white text-sm"
              style={{ background: THEME.gradients.primary }}
            >
              Retry
            </button>
          </div>
        </div>
      )}


      {/* Controls */}
      <div style={{ transform: isInvertedGravity ? 'scaleY(-1)' : 'none' }}>
        <PlayerControls
          playing={isPlaying}
          muted={muted}
          volume={volume}
          currentTime={currentTime}
          duration={duration}
          onPlayPause={onTogglePlay}
          onSeek={handleSeek}
          onSeekRelative={handleSeekRelative}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={handleMuteToggle}
          onFullscreenToggle={toggleFullscreen}
          fullscreen={isFullscreen}
          onSearchEPG={onSearchEPG}
          onMultiGridToggle={actualMultiGridItems.length > 0 ? handleMultiGridToggle : undefined}
          hasMultiGrid={actualMultiGridItems.length > 0}
          visible={showControls}
          isLive={isLive}
          // Channel navigation
          currentChannel={channel ? { name: channel.name, logo: channel.logo } : null}
          prevChannel={prevChannel ? { name: prevChannel.name, logo: prevChannel.logo } : null}
          nextChannel={nextChannel ? { name: nextChannel.name, logo: nextChannel.logo } : null}
          onChannelPrev={handleChannelPrev}
          onChannelNext={handleChannelNext}
          // Category navigation
          currentCategory={currentCategory}
          prevCategory={prevCategory}
          nextCategory={nextCategory}
          onCategoryPrev={handleCategoryPrev}
          onCategoryNext={handleCategoryNext}
          // Timeshift
          timeshiftOffset={timeshiftOffset}
          maxTimeshiftOffset={7200}
          onTimeshiftSeek={handleTimeshiftSeek}
          onJumpToLive={() => setTimeshiftOffset(0)}
          // Sidebar state
          sidebarOpen={ottSidebarOpen}
          // Stream info (TODO: get from VideoPlayer when available)
          streamInfo={null}
          // Settings overlay
          xtreamService={xtreamService}
          onServers={onServers}
        />
      </div>

      {/* MultiGrid Overlay */}
      <MultiGrid
        visible={actualShowMultiGrid}
        onClose={handleMultiGridToggle}
        items={actualMultiGridItems}
        activeIndex={multiGridActiveIndex}
        gridSize={multiGridSize}
        onSelect={handleMultiGridSelect}
        onRemove={handleMultiGridRemove}
        onAdd={handleMultiGridAdd}
        onGridSizeChange={setMultiGridSize}
        renderVideo={renderMultiGridVideo}
      />

      {/* Settings Modal */}
      <PlayerSettings
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        currentSpeed={playbackSpeed}
        onSpeedChange={handleSpeedChange}
        currentAspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
      />

      {/* OTT Sidebar - Only in fullscreen/landscape mode */}
      {(isFullscreen || isSmartFullscreen) && isLive && (
        <OTTSidebar
          ref={sidebarRef}
          categories={categories}
          channels={channels}
          selectedChannel={channel}
          onChannelSelect={onChannelChange}
          isOpen={ottSidebarOpen}
          onToggle={onOttSidebarChange}
          onTabChange={setSidebarTab}
          xtreamService={xtreamService}
        />
      )}

      {/* Right panel — slide from RIGHT (porte d'ascenseur) */}
      {(isFullscreen || isSmartFullscreen) && isLive && (
        <div style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '280px',
          right: 0,
          background: 'rgba(255, 255, 255, 0.10)',
          backdropFilter: 'blur(25px) saturate(150%)',
          WebkitBackdropFilter: 'blur(25px) saturate(150%)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 10001,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transform: ottSidebarOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: ottSidebarOpen ? 'auto' : 'none',
        }}>
          {sidebarTab === 'live' ? (
            <EPGSearch
              xtreamService={xtreamService}
              onChannelSelect={(ch) => {
                onChannelChange?.(ch);
                sidebarRef.current?.scrollToChannel(ch.stream_id);
              }}
            />
          ) : (
            <MediaGallery
              items={sidebarRef.current?.getFilteredItems() || []}
              type={sidebarTab}
              xtreamService={xtreamService}
              videoRef={videoRef}
              onItemSelect={(item) => {
                onChannelChange?.(item);
                sidebarRef.current?.scrollToChannel(item.stream_id || item.id);
              }}
            />
          )}
        </div>
      )}

    </div>
  );
});

Player.displayName = 'Player';

export default Player;
