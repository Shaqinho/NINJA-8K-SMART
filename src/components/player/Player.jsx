import React, { useRef, useState, useEffect, useCallback, memo } from 'react';
import { Capacitor } from '@capacitor/core';
import { THEME } from '../../constants/theme';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import PlayerControls from './PlayerControls';
import PlayerOverlay from './PlayerOverlay';
import TimeshiftBar from './TimeshiftBar';
import { PlayerSettings } from './PlayerSettings';
import VideoPlayer from './VideoPlayer';
import MultiGrid from './MultiGrid';

// ============================================================================
// NINJA 8K PLAYER - Main Component
// ============================================================================

const Player = memo(({
  channel,
  channels = [],
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
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const isNative = Capacitor.getPlatform() === 'android';

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
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

  const [touchStartY, setTouchStartY] = useState(null);
  const [initialPinchDistance, setInitialPinchDistance] = useState(null);
  const [initialVolume, setInitialVolume] = useState(1);

  const [isInvertedGravity, setIsInvertedGravity] = useState(false);

  const src = channel?.streamUrl || channel?.url || null;

  void channels;

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
    setVolume(vol);
    setMuted(vol === 0);
    if (videoRef.current) {
      videoRef.current.setVolume(vol);
    }
  }, []);

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
  }, []);

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

  const getTouchDistance = (touches) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const avgY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setTouchStartY(avgY);
      setInitialVolume(volume);
      setInitialPinchDistance(getTouchDistance(e.touches));
    }
  }, [volume]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && touchStartY !== null && initialPinchDistance !== null) {
      e.preventDefault();

      const currentDistance = getTouchDistance(e.touches);
      const distanceChange = currentDistance - initialPinchDistance;

      if (Math.abs(distanceChange) > 50) {
        if (distanceChange > 0 && !isFullscreen) {
          toggleFullscreen();
          setInitialPinchDistance(null);
        } else if (distanceChange < 0 && isFullscreen) {
          toggleFullscreen();
          setInitialPinchDistance(null);
        }
      } else {
        const avgY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const deltaY = touchStartY - avgY;
        const volumeChange = deltaY / 200;
        const newVolume = Math.max(0, Math.min(1, initialVolume + volumeChange));
        handleVolumeChange(newVolume);
      }
    }
  }, [touchStartY, initialPinchDistance, initialVolume, isFullscreen, toggleFullscreen, handleVolumeChange]);

  const handleTouchEnd = useCallback(() => {
    setTouchStartY(null);
    setInitialPinchDistance(null);
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'none' }}
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

      {/* Volume indicator during gesture */}
      {touchStartY !== null && (
        <div className="absolute top-4 right-4 px-3 py-2 rounded-lg bg-transparent flex items-center gap-2 pointer-events-none">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
          <span className="text-white font-bold">{Math.round(volume * 100)}%</span>
        </div>
      )}

      {/* Overlay */}
      <div style={{ transform: isInvertedGravity ? 'scaleY(-1)' : 'none' }}>
        <PlayerOverlay
          title={channel?.name}
          subtitle={channel?.category}
          logo={channel?.logo}
          visible={showControls}
        />
      </div>

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
        />
      </div>

      {/* Timeshift */}
      {isLive && timeshiftOffset > 0 && (
        <TimeshiftBar
          enabled={true}
          isLive={timeshiftOffset === 0}
          currentOffset={timeshiftOffset}
          maxOffset={7200}
          onSeek={handleTimeshiftSeek}
          onJumpToLive={() => setTimeshiftOffset(0)}
          visible={showControls}
        />
      )}

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
    </div>
  );
});

Player.displayName = 'Player';

export default Player;
