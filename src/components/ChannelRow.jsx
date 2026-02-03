import React, { memo, useRef, useEffect, useState, useCallback } from 'react';
import { THEME } from '../constants/theme';

// ============================================================================
// CHANNEL ROW - Single channel/movie/series item
// Tap = Play channel
// Long Press (500ms) = Add to MultiGrid
// Extra Long Press (2s) = Context Menu
// EPG NOW displayed under channel name
// Progress bar absolute at bottom edge
// ============================================================================

// Image cache - OUTSIDE component to persist across renders
const imageCache = new Map();

// Long press duration in ms
const LONG_PRESS_DURATION = 500;
const EXTRA_LONG_PRESS_DURATION = 2000;

const ChannelRow = memo(({ item, onSelect, onLongPress, onExtraLongPress, isPlaying, alias }) => {
  const logo = item.logo || item.stream_icon || item.cover;
  const initialStatus = logo ? (imageCache.get(logo) || 'loading') : 'error';
  
  const [imageStatus, setImageStatus] = useState(initialStatus);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [isExtraLongPressing, setIsExtraLongPressing] = useState(false);
  const longPressTimerRef = useRef(null);
  const extraLongPressTimerRef = useRef(null);
  const isLongPressTriggeredRef = useRef(false);
  const isExtraLongPressTriggeredRef = useRef(false);

  const name = alias || item.name || item.title;
  const epgNow = item.epg_now || item.epgNow;
  const epgProgress = item.epg_progress || item.progress || 0;

  useEffect(() => {
    if (!logo) {
      setImageStatus('error');
      return;
    }
    const cachedStatus = imageCache.get(logo);
    if (cachedStatus) {
      setImageStatus(cachedStatus);
    } else {
      setImageStatus('loading');
    }
  }, [logo]);

  const handleImageLoad = useCallback(() => {
    imageCache.set(logo, 'loaded');
    setImageStatus('loaded');
  }, [logo]);

  const handleImageError = useCallback(() => {
    imageCache.set(logo, 'error');
    setImageStatus('error');
  }, [logo]);

  const startLongPress = useCallback(() => {
    isLongPressTriggeredRef.current = false;
    isExtraLongPressTriggeredRef.current = false;
    
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      setIsLongPressing(true);
      if (navigator.vibrate) navigator.vibrate(50);
      if (onLongPress) onLongPress(item);
      setTimeout(() => setIsLongPressing(false), 300);
    }, LONG_PRESS_DURATION);

    extraLongPressTimerRef.current = setTimeout(() => {
      isExtraLongPressTriggeredRef.current = true;
      setIsExtraLongPressing(true);
      if (navigator.vibrate) navigator.vibrate(100);
      if (onExtraLongPress) onExtraLongPress(item);
      setTimeout(() => setIsExtraLongPressing(false), 300);
    }, EXTRA_LONG_PRESS_DURATION);
  }, [item, onLongPress, onExtraLongPress]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (extraLongPressTimerRef.current) {
      clearTimeout(extraLongPressTimerRef.current);
      extraLongPressTimerRef.current = null;
    }
    setIsLongPressing(false);
    setIsExtraLongPressing(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!isLongPressTriggeredRef.current && !isExtraLongPressTriggeredRef.current) {
      onSelect(item);
    }
    isLongPressTriggeredRef.current = false;
    isExtraLongPressTriggeredRef.current = false;
  }, [item, onSelect]);

  const handleTouchStart = useCallback(() => startLongPress(), [startLongPress]);
  const handleTouchEnd = useCallback(() => cancelLongPress(), [cancelLongPress]);
  const handleMouseDown = useCallback(() => startLongPress(), [startLongPress]);
  const handleMouseUp = useCallback(() => cancelLongPress(), [cancelLongPress]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (extraLongPressTimerRef.current) clearTimeout(extraLongPressTimerRef.current);
    };
  }, []);

  return (
    <button
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      className={`w-full relative flex items-center gap-3 px-4 py-3 transition-all active:scale-[0.995] ${
        isPlaying ? 'bg-white/10' : 'active:bg-white/5'
      }`}
      style={{ 
        background: isExtraLongPressing ? 'rgba(168, 85, 247, 0.4)' : isLongPressing ? 'rgba(139, 92, 246, 0.3)' : isPlaying ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        minHeight: '64px',
      }}
    >
      {/* Logo - Élargi (w-20) et fond transparent */}
      <div 
        className="w-20 h-10 rounded flex items-center justify-center flex-shrink-0 overflow-hidden p-1"
        style={{ background: 'transparent' }}
      >
        {logo && imageStatus !== 'error' ? (
          <img 
            src={logo}
            alt=""
            className="max-w-full max-h-full object-contain"
            onLoad={handleImageLoad} 
            onError={handleImageError} 
            referrerPolicy="no-referrer"
          />
        ) : (
          <img src="/assets/Ninja8K.png" alt="" className="max-w-full max-h-full object-contain opacity-50" />
        )}
      </div>

      {/* Channel Info + EPG Text */}
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate" style={{ color: isPlaying ? '#ffffff' : (THEME.colors.channelText || '#5D28F1') }}>
            {name}
          </p>
        </div>
        {epgNow && <p className="text-xs text-gray-400 truncate mt-0.5">{epgNow}</p>}
      </div>

      {/* Indicators (MultiGrid, Menu, Playing) */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {isLongPressing && !isExtraLongPressing && (
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-purple-500/50">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <span className="text-white text-[10px] font-bold">Multi</span>
          </div>
        )}

        {isExtraLongPressing && (
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-purple-600/60">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <circle cx="12" cy="5" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="12" cy="19" r="2"/>
            </svg>
            <span className="text-white text-[10px] font-bold">Menu</span>
          </div>
        )}

        {isPlaying && !isLongPressing && !isExtraLongPressing && (
          <div className="flex items-center gap-0.5">
            <div className="w-1 h-3 bg-white rounded-full pulse-bar" />
            <div className="w-1 h-4 bg-white rounded-full pulse-bar delay-1" />
            <div className="w-1 h-2 bg-white rounded-full pulse-bar delay-2" />
          </div>
        )}
      </div>

      {/* ============================================================================
          PROGRESS BAR HORIZONTALE - Fine en bas de ligne
          ============================================================================ */}
      {epgProgress > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 overflow-hidden">
          <div 
            className="h-full bg-[#6225ff] transition-all duration-1000 ease-in-out"
            style={{ width: `${Math.min(100, Math.max(0, epgProgress))}%` }}
          />
        </div>
      )}
    </button>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.item?.id === nextProps.item?.id &&
    prevProps.item?.epg_now === nextProps.item?.epg_now &&
    prevProps.item?.epg_progress === nextProps.item?.epg_progress &&
    prevProps.isPlaying === nextProps.isPlaying &&
    prevProps.alias === nextProps.alias &&
    prevProps.onSelect === nextProps.onSelect &&
    prevProps.onLongPress === nextProps.onLongPress &&
    prevProps.onExtraLongPress === nextProps.onExtraLongPress
  );
});

ChannelRow.displayName = 'ChannelRow';

export default ChannelRow;
