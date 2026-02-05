import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { FixedSizeList as List, FixedSizeGrid as Grid } from 'react-window';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { usePlaylistContext } from '../context/PlaylistContext';
import { XtreamService } from '../services/XtreamService';
import { ninjaCentral } from '../services/NinjaCentral';
import ParticleThemes from './ParticleThemes';

// ============================================================================
// ROTATION DETECTION - Calculate angle between two touch points
// ============================================================================
const getAngle = (touch1, touch2) => {
  return Math.atan2(touch2.pageY - touch1.pageY, touch2.pageX - touch1.pageX) * 180 / Math.PI;
};

// ============================================================================
// DPAD HOOK - Handles remote control navigation
// ============================================================================
const DPAD_KEYS = {
  UP: ['ArrowUp', 'Dpad-Up'],
  DOWN: ['ArrowDown', 'Dpad-Down'],
  LEFT: ['ArrowLeft', 'Dpad-Left'],
  RIGHT: ['ArrowRight', 'Dpad-Right'],
  OK: ['Enter', 'Dpad-Center', ' '],
  BACK: ['Escape', 'Backspace', 'Dpad-Back'],
};

const DOUBLE_TAP_DELAY = 300; // ms between taps for double/triple
const LONG_PRESS_DELAY = 600; // ms for long press
const EXTRA_LONG_PRESS_DELAY = 2000; // ms for extra long press

const useDpad = ({
  onUp, onDown, onLeft, onRight,
  onOk, onLongPressOk, onExtraLongPressOk,
  onDoubleUp, onDoubleDown, onDoubleLeft, onDoubleRight,
  onTripleLeft, onTripleRight,
  onBack,
  enabled = true,
}) => {
  const lastKeyRef = useRef(null);
  const lastKeyTimeRef = useRef(0);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const extraLongPressTimerRef = useRef(null);
  const isLongPressRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const getDirection = (key) => {
      if (DPAD_KEYS.UP.includes(key)) return 'UP';
      if (DPAD_KEYS.DOWN.includes(key)) return 'DOWN';
      if (DPAD_KEYS.LEFT.includes(key)) return 'LEFT';
      if (DPAD_KEYS.RIGHT.includes(key)) return 'RIGHT';
      if (DPAD_KEYS.OK.includes(key)) return 'OK';
      if (DPAD_KEYS.BACK.includes(key)) return 'BACK';
      return null;
    };

    const handleKeyDown = (e) => {
      const direction = getDirection(e.key);
      if (!direction) return;

      e.preventDefault();
      const now = Date.now();

      // Handle OK with long press detection
      if (direction === 'OK') {
        isLongPressRef.current = false;
        
        // Start long press timer
        longPressTimerRef.current = setTimeout(() => {
          isLongPressRef.current = true;
          onLongPressOk?.();
          
          // Start extra long press timer
          extraLongPressTimerRef.current = setTimeout(() => {
            onExtraLongPressOk?.();
          }, EXTRA_LONG_PRESS_DELAY - LONG_PRESS_DELAY);
        }, LONG_PRESS_DELAY);
        return;
      }

      // Handle BACK
      if (direction === 'BACK') {
        onBack?.();
        return;
      }

      // Handle directional keys with multi-tap detection
      const isSameKey = lastKeyRef.current === direction;
      const isWithinDelay = (now - lastKeyTimeRef.current) < DOUBLE_TAP_DELAY;

      if (isSameKey && isWithinDelay) {
        tapCountRef.current++;
      } else {
        tapCountRef.current = 1;
      }

      lastKeyRef.current = direction;
      lastKeyTimeRef.current = now;

      // Clear previous timer
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);

      // Set timer to execute action after delay (to detect multi-tap)
      tapTimerRef.current = setTimeout(() => {
        const count = tapCountRef.current;
        
        switch (direction) {
          case 'UP':
            if (count >= 2) onDoubleUp?.();
            else onUp?.();
            break;
          case 'DOWN':
            if (count >= 2) onDoubleDown?.();
            else onDown?.();
            break;
          case 'LEFT':
            if (count >= 3) onTripleLeft?.();
            else if (count >= 2) onDoubleLeft?.();
            else onLeft?.();
            break;
          case 'RIGHT':
            if (count >= 3) onTripleRight?.();
            else if (count >= 2) onDoubleRight?.();
            else onRight?.();
            break;
          default:
            break;
        }
        
        tapCountRef.current = 0;
      }, DOUBLE_TAP_DELAY);
    };

    const handleKeyUp = (e) => {
      const direction = getDirection(e.key);
      if (direction === 'OK') {
        // Clear long press timers
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (extraLongPressTimerRef.current) {
          clearTimeout(extraLongPressTimerRef.current);
          extraLongPressTimerRef.current = null;
        }
        
        // If not a long press, trigger normal OK
        if (!isLongPressRef.current) {
          onOk?.();
        }
        isLongPressRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (extraLongPressTimerRef.current) clearTimeout(extraLongPressTimerRef.current);
    };
  }, [enabled, onUp, onDown, onLeft, onRight, onOk, onLongPressOk, onExtraLongPressOk,
      onDoubleUp, onDoubleDown, onDoubleLeft, onDoubleRight, onTripleLeft, onTripleRight, onBack]);
};

// ============================================================================
// CONSTANTS
// ============================================================================
const FALLBACK_IMAGE = '/assets/Ninja8K.png';
const SIDEBAR_WIDTH_PERCENT = 25;
const SIDEBAR_WIDTH_PORTRAIT_PERCENT = 40;
const THUMBNAIL_WIDTH = 112;
const THUMBNAIL_HEIGHT = 168;
const THUMBNAIL_GAP = 4;
const ITEM_WIDTH = THUMBNAIL_WIDTH + THUMBNAIL_GAP;
const CATEGORY_ROW_HEIGHT = 204; // Adjusted for 16px padding
const SIDEBAR_ITEM_HEIGHT = 56;

// Lazy loading constants
const INITIAL_CATEGORIES = 10;
const LOAD_MORE_THRESHOLD = 3;

// Zoom levels for grid
const ZOOM_LEVELS = [3, 4, 5, 6, 8, 10];
const DEFAULT_ZOOM_INDEX = 2; // 5 columns

// ============================================================================
// THUMBNAIL COMPONENT - Multi-finger gestures + DPAD focus
// 2-finger tap = open modal
// 2-finger long press = add to My List
// 3-finger long press = add to Favorites
// ============================================================================
const Thumbnail = React.memo(({ item, onTap, onAddToList, onAddToFavorites, style, isLast, isFirst, showLeftPeek, isFocused }) => {
  const touchStartTime = useRef(0);
  const touchFingers = useRef(0);
  const touchFingersAtStart = useRef(0); // Mémoriser le nombre de doigts au START
  const longPressTimer = useRef(null);
  const [isPressed, setIsPressed] = useState(false);
  const [hasJiggled, setHasJiggled] = useState(false);

  useEffect(() => {
    if (isLast && !hasJiggled) {
      const timer = setTimeout(() => setHasJiggled(true), 100);
      return () => clearTimeout(timer);
    }
  }, [isLast, hasJiggled]);

  const handleTouchStart = useCallback((e) => {
    touchStartTime.current = Date.now();
    touchFingers.current = e.touches.length;
    touchFingersAtStart.current = e.touches.length; // Mémoriser au START
    setIsPressed(true);

    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    // Long press detection - only for 2 or 3 fingers
    if (e.touches.length >= 2) {
      longPressTimer.current = setTimeout(() => {
        const fingers = touchFingersAtStart.current; // Utiliser fingers au START
        if (fingers === 2) {
          // Long press 2 fingers = add to My List
          onAddToList?.(item);
        } else if (fingers === 3) {
          // Long press 3 fingers = add to Favorites
          onAddToFavorites?.(item);
        }
        setIsPressed(false);
      }, 600);
    }
  }, [item, onAddToList, onAddToFavorites]);

  const handleTouchEnd = useCallback((e) => {
    setIsPressed(false);
    const duration = Date.now() - touchStartTime.current;
    
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // 2 finger tap (short) = open modal - ONLY if started with 2 fingers
    if (duration < 600 && touchFingersAtStart.current === 2 && touchFingers.current === 2) {
      onTap?.(item);
    }
    // 1 finger tap = nothing (just scroll)
    // 3 finger = ignore (handled globally for Hub/OTT switch)
  }, [item, onTap]);

  const handleTouchMove = useCallback((e) => {
    touchFingers.current = e.touches.length;
  }, []);

  return (
    <div style={{ ...style, width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT, padding: THUMBNAIL_GAP / 2 }}>
      <div
        className={`w-full h-full rounded-lg overflow-hidden 
          ${isPressed ? 'scale-95' : ''} 
          ${isLast && hasJiggled ? 'animate-jiggle' : ''}
          ${isFirst && showLeftPeek ? 'animate-jiggle-left' : ''}
          transition-transform duration-150 cursor-pointer`}
        style={{ 
          background: 'rgba(255,255,255,0.05)',
          border: isFocused ? '3px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)',
          boxShadow: isFocused ? '0 0 20px rgba(139, 92, 246, 0.5)' : 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchCancel={handleTouchEnd}
      >
        <img
          src={item?.logo || item?.stream_icon || item?.cover || FALLBACK_IMAGE}
          alt={item?.name || ''}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => { e.target.src = FALLBACK_IMAGE; }}
        />
      </div>
    </div>
  );
});

// ============================================================================
// VIRTUALIZED HORIZONTAL ROW WITH SNAP + JIGGLE + LEFT PEEK
// ============================================================================
const VirtualizedSnapRow = React.memo(({ items, onItemSelect, onAddToList, onAddToFavorites, width, totalItems }) => {
  const listRef = useRef(null);
  const touchStartX = useRef(0);
  const scrollStartOffset = useRef(0);
  const fingerCount = useRef(1);
  const currentIndex = useRef(0);
  const [scrolledFromStart, setScrolledFromStart] = useState(false);
  
  // Calculate visible count dynamically based on width
  const visibleCount = Math.floor(width / ITEM_WIDTH);
  // Jiggle on the first thumbnail out of view (the one that peeks)
  const lastVisibleIndex = Math.min(visibleCount, items.length - 1);
  const hasMore = totalItems > visibleCount;

  const Row = useCallback(({ index, style }) => {
    const item = items[index];
    if (!item) return null;
    const isLastVisible = index === lastVisibleIndex && hasMore;
    const isFirstVisible = index === 0 && scrolledFromStart;
    return (
      <Thumbnail 
        item={item} 
        onTap={onItemSelect} 
        onAddToList={onAddToList}
        onAddToFavorites={onAddToFavorites}
        style={style} 
        isLast={isLastVisible}
        isFirst={isFirstVisible}
        showLeftPeek={scrolledFromStart}
      />
    );
  }, [items, onItemSelect, onAddToList, onAddToFavorites, lastVisibleIndex, hasMore, scrolledFromStart]);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length >= 1) {
      fingerCount.current = Math.min(e.touches.length, 3);
      touchStartX.current = e.touches[0].clientX;
      if (listRef.current) {
        scrollStartOffset.current = listRef.current.state?.scrollOffset || 0;
        currentIndex.current = Math.round(scrollStartOffset.current / ITEM_WIDTH);
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const deltaX = touchStartX.current - (e.changedTouches?.[0]?.clientX || touchStartX.current);
    const snapCount = fingerCount.current;
    const threshold = ITEM_WIDTH * 0.7; // Strong magnet - need 70% swipe to snap
    
    let newIndex = currentIndex.current;
    
    if (Math.abs(deltaX) > threshold) {
      if (deltaX > 0) {
        newIndex = currentIndex.current + snapCount;
      } else {
        newIndex = currentIndex.current - snapCount;
      }
    }
    
    newIndex = Math.max(0, Math.min(newIndex, items.length - 1));
    currentIndex.current = newIndex;
    setScrolledFromStart(newIndex > 0);
    
    if (listRef.current) {
      listRef.current.scrollToItem(newIndex, 'start');
    }
  }, [items.length]);

  if (!items || items.length === 0) return null;

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <List
        ref={listRef}
        height={THUMBNAIL_HEIGHT + THUMBNAIL_GAP}
        width={width}
        itemCount={items.length}
        itemSize={ITEM_WIDTH}
        layout="horizontal"
        overscanCount={5}
        style={{ overflowY: 'hidden' }}
      >
        {Row}
      </List>
    </div>
  );
});

// ============================================================================
// CATEGORY ROW WRAPPER - 16px before title, 6px after, count next to name
// ============================================================================
const CategoryRowWrapper = React.memo(({ category, items, totalItems, onItemSelect, onAddToList, onAddToFavorites, onCategoryClick, width, style }) => {
  if (!items || items.length === 0) return null;

  return (
    <div style={{ ...style, paddingTop: 16 }}> {/* 16px before title */}
      <div className="px-4 mb-1.5 flex items-center"> {/* 6px after title */}
        <button 
          onClick={() => onCategoryClick?.(category)}
          className="text-white font-semibold text-base text-left active:opacity-70"
        >
          {category.category_name}
        </button>
        <span className="text-gray-500 text-xs ml-2">({totalItems})</span>
      </div>
      <div className="px-4">
        <VirtualizedSnapRow 
          items={items} 
          totalItems={totalItems}
          onItemSelect={onItemSelect}
          onAddToList={onAddToList}
          onAddToFavorites={onAddToFavorites}
          width={width - 32} 
        />
      </div>
    </div>
  );
});

// ============================================================================
// MARQUEE TEXT for sidebar
// ============================================================================
const MarqueeText = React.memo(({ text, isSelected }) => {
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [scrollDistance, setScrollDistance] = useState(0);

  useEffect(() => {
    if (textRef.current && containerRef.current) {
      const textWidth = textRef.current.scrollWidth;
      const containerWidth = containerRef.current.clientWidth;
      const needsScroll = textWidth > containerWidth;
      setShouldScroll(needsScroll);
      if (needsScroll) {
        setScrollDistance(textWidth - containerWidth + 20); // +20 for padding
      }
    }
  }, [text]);

  return (
    <div ref={containerRef} className="overflow-hidden whitespace-nowrap flex-1">
      <span 
        ref={textRef}
        className="inline-block"
        style={{ 
          color: isSelected ? '#ffffff' : '#9ca3af',
          animation: shouldScroll ? `marquee-scroll 6s linear infinite alternate` : 'none',
          '--scroll-distance': `-${scrollDistance}px`,
        }}
      >
        {text}
      </span>
    </div>
  );
});

// ============================================================================
// SEARCH BAR - Local search in current category
// ============================================================================
const SearchBar = React.memo(({ visible, onClose, onSearch, placeholder }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus();
    }
    if (!visible) {
      setQuery('');
      onSearch?.('');
    }
  }, [visible, onSearch]);

  const handleChange = useCallback((e) => {
    const value = e.target.value;
    setQuery(value);
    onSearch?.(value);
  }, [onSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
    onSearch?.('');
    inputRef.current?.focus();
  }, [onSearch]);

  if (!visible) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2" style={{ background: 'rgba(0,0,0,0.9)' }}>
      <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          placeholder={placeholder || 'Search...'}
          className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500"
        />
        {query && (
          <button onClick={handleClear} className="p-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>
      <button onClick={onClose} className="text-gray-400 text-sm px-2">Cancel</button>
    </div>
  );
});

// ============================================================================
// INFO OVERLAY - Responsive (portrait vs landscape)
// ============================================================================
const InfoOverlay = ({ item, info, loading, onClose, onPlay, onToggleFavorite, onAddToList, isFavorite, isInList, isLandscape }) => {
  if (!item) return null;

  // Landscape = image right, info left
  if (isLandscape) {
    return (
      <div className="fixed inset-0 z-50 flex" style={{ background: '#000' }}>
        <div className="flex-1 flex flex-col p-6 justify-center">
          <button onClick={onClose} className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:scale-95">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
          
          <h1 className="text-white font-bold text-3xl mb-4">{item.name}</h1>
          
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading info...</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {info?.info?.rating && <span className="text-yellow-400 text-sm font-semibold">★ {info.info.rating}</span>}
              {info?.info?.releasedate && <span className="text-gray-400 text-sm">{info.info.releasedate.split('-')[0]}</span>}
              {info?.info?.genre && <span className="text-gray-400 text-sm">{info.info.genre}</span>}
            </div>
          )}

          {info?.info?.plot && <p className="text-gray-300 text-sm mb-4 line-clamp-4">{info.info.plot}</p>}
          {info?.info?.cast && <p className="text-gray-500 text-xs mb-6">Cast: {info.info.cast}</p>}

          <div className="flex gap-3">
            <button 
              onClick={() => onPlay(item)} 
              className="flex-1 py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg, #6225ff 0%, #8b5cf6 100%)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              Play
            </button>
            <button 
              onClick={() => onAddToList?.(item)}
              className="w-14 h-14 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
              style={{ background: isInList ? 'rgba(98, 37, 255, 0.3)' : 'rgba(255,255,255,0.1)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isInList ? '#8b5cf6' : 'white'} strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
            <button 
              onClick={() => onToggleFavorite?.(item)}
              className="w-14 h-14 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill={isFavorite ? '#f43f5e' : 'none'} stroke={isFavorite ? '#f43f5e' : 'white'} strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="w-1/2 relative">
          <img
            src={item.logo || item.stream_icon || item.cover || FALLBACK_IMAGE}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.src = FALLBACK_IMAGE; }}
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #000 0%, transparent 30%)' }} />
        </div>
      </div>
    );
  }

  // Portrait layout
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}>
      <div className="flex items-center justify-between p-4 absolute top-0 left-0 right-0 z-10" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)' }}>
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:scale-95">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <img
          src={item.logo || item.stream_icon || item.cover || FALLBACK_IMAGE}
          alt={item.name}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.src = FALLBACK_IMAGE; }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #000 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.3) 100%)' }} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6" style={{ background: 'linear-gradient(to top, #000 60%, transparent)' }}>
        <h1 className="text-white font-bold text-2xl mb-2">{item.name}</h1>
        
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading info...</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {info?.info?.rating && <span className="text-yellow-400 text-sm font-semibold">★ {info.info.rating}</span>}
            {info?.info?.releasedate && <span className="text-gray-400 text-sm">{info.info.releasedate.split('-')[0]}</span>}
            {info?.info?.genre && <span className="text-gray-400 text-sm">{info.info.genre}</span>}
          </div>
        )}

        {info?.info?.plot && <p className="text-gray-300 text-sm mb-4 line-clamp-3">{info.info.plot}</p>}
        {info?.info?.cast && <p className="text-gray-500 text-xs mb-6">Cast: {info.info.cast}</p>}

        <div className="flex gap-3">
          <button 
            onClick={() => onPlay(item)} 
            className="flex-1 py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, #6225ff 0%, #8b5cf6 100%)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            Play
          </button>
          <button 
            onClick={() => onAddToList?.(item)}
            className="w-14 h-14 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
            style={{ background: isInList ? 'rgba(98, 37, 255, 0.3)' : 'rgba(255,255,255,0.1)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isInList ? '#8b5cf6' : 'white'} strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
          <button 
            onClick={() => onToggleFavorite?.(item)}
            className="w-14 h-14 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill={isFavorite ? '#f43f5e' : 'none'} stroke={isFavorite ? '#f43f5e' : 'white'} strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// HUB VIEW - Portrait/Landscape with pinch/spread zoom + search + DPAD
// ============================================================================
const HubView = ({ 
  activeTab, categories, itemsByCategoryMap, favorites, recents, 
  onItemSelect, onAddToList, onAddToFavorites, onTabChange, onBack, 
  visible, containerWidth, containerHeight, loadedCategories, onLoadMoreCategories,
  isLandscape, isTransitioning, onSwitchToOtt
}) => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [localZoomLevel, setLocalZoomLevel] = useState(null); // null = auto
  const pinchStartDistance = useRef(0);
  
  // DPAD navigation state
  const [focusedRowIndex, setFocusedRowIndex] = useState(0);
  const [focusedColIndex, setFocusedColIndex] = useState(0);
  const [focusedGridIndex, setFocusedGridIndex] = useState(0);
  const listRef = useRef(null);
  const gridRef = useRef(null);
  
  const selectedCategoryItems = useMemo(() => {
    if (!selectedCategory) return [];
    let items = [];
    if (selectedCategory.category_id === 'favorites') items = favorites;
    else if (selectedCategory.category_id === 'recent') items = recents;
    else items = itemsByCategoryMap[String(selectedCategory.category_id)] || [];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => item.name?.toLowerCase().includes(query));
    }
    return items;
  }, [selectedCategory, itemsByCategoryMap, favorites, recents, searchQuery]);

  const rowData = useMemo(() => {
    const rows = [];
    
    if (favorites.length > 0) {
      rows.push({ 
        category: { category_id: 'favorites', category_name: '★ Favorites' }, 
        items: favorites,
        totalItems: favorites.length
      });
    }
    if (recents.length > 0) {
      rows.push({ 
        category: { category_id: 'recent', category_name: '↺ Recent' }, 
        items: recents,
        totalItems: recents.length
      });
    }
    
    const categoriesToShow = categories.slice(0, loadedCategories);
    
    categoriesToShow.forEach(cat => {
      const catItems = itemsByCategoryMap[String(cat.category_id)] || [];
      if (catItems.length > 0) {
        rows.push({ 
          category: cat, 
          items: catItems,
          totalItems: catItems.length
        });
      }
    });
    
    return rows;
  }, [categories, itemsByCategoryMap, favorites, recents, loadedCategories]);

  const handleItemsRendered = useCallback(({ visibleStopIndex }) => {
    if (visibleStopIndex >= rowData.length - LOAD_MORE_THRESHOLD) {
      onLoadMoreCategories();
    }
  }, [rowData.length, onLoadMoreCategories]);

  const handleCategoryClick = useCallback((category) => {
    setSelectedCategory(category);
    setSearchQuery('');
    setShowSearch(false);
  }, []);

  const handleBackFromCategory = useCallback(() => {
    setSelectedCategory(null);
    setSearchQuery('');
    setShowSearch(false);
  }, []);

  useEffect(() => {
    setSelectedCategory(null);
    setSearchQuery('');
    setShowSearch(false);
  }, [activeTab]);

  // Refs for rotation detection
  const pinchStartAngle = useRef(0);
  const rotationTriggered = useRef(false);

  // Pinch/spread detection for category grid zoom + Rotation for orientation
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      pinchStartDistance.current = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      pinchStartAngle.current = getAngle(e.touches[0], e.touches[1]);
      rotationTriggered.current = false;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchStartDistance.current > 0) {
      e.preventDefault(); // Block native pinch zoom
      
      const currentDist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const currentAngle = getAngle(e.touches[0], e.touches[1]);
      const angleDelta = currentAngle - pinchStartAngle.current;
      
      // Normalize angle delta to -180 to 180
      let normalizedAngle = angleDelta;
      if (normalizedAngle > 180) normalizedAngle -= 360;
      if (normalizedAngle < -180) normalizedAngle += 360;
      
      // Rotation detection (threshold: 30 degrees)
      if (Math.abs(normalizedAngle) > 30 && !rotationTriggered.current) {
        rotationTriggered.current = true;
        
        if (normalizedAngle > 0) {
          // Clockwise rotation → landscape-primary (right)
          console.log('🔄 Rotation clockwise → landscape-primary');
          ScreenOrientation.lock({ orientation: 'landscape-primary' }).catch(() => {});
        } else {
          // Counter-clockwise rotation → landscape-secondary (left)
          console.log('🔄 Rotation counter-clockwise → landscape-secondary');
          ScreenOrientation.lock({ orientation: 'landscape-secondary' }).catch(() => {});
        }
        return;
      }
      
      // Pinch/spread for zoom (only in category grid)
      if (selectedCategory && !rotationTriggered.current) {
        const delta = currentDist - pinchStartDistance.current;
        const maxCols = Math.floor(containerWidth / ITEM_WIDTH);
        
        if (Math.abs(delta) > 40) {
          setLocalZoomLevel(prev => {
            const current = prev || maxCols;
            if (delta > 0) {
              // Spread = moins de colonnes (zoom in)
              return Math.max(2, current - 1);
            } else {
              // Pinch = plus de colonnes (zoom out)
              return Math.min(maxCols + 2, current + 1);
            }
          });
          pinchStartDistance.current = currentDist;
        }
      }
    }
  }, [selectedCategory, containerWidth]);

  const handleTouchEnd = useCallback(() => {
    pinchStartDistance.current = 0;
    pinchStartAngle.current = 0;
    rotationTriggered.current = false;
  }, []);

  // Grid for category detail - auto columns based on screen width, adjustable with pinch
  // MUST be defined before DPAD handlers that use them
  const autoColumns = Math.max(2, Math.floor(containerWidth / ITEM_WIDTH));
  const columnCount = localZoomLevel ? Math.min(localZoomLevel, autoColumns + 2) : autoColumns;
  const totalGridWidth = columnCount * ITEM_WIDTH;
  const gridPadding = Math.max(0, (containerWidth - totalGridWidth) / 2);
  const rowCount = Math.ceil(selectedCategoryItems.length / columnCount);

  // DPAD Navigation handlers
  const handleDpadUp = useCallback(() => {
    if (selectedCategory) {
      // In grid: move up
      setFocusedGridIndex(prev => {
        const newIndex = Math.max(0, prev - columnCount);
        const row = Math.floor(newIndex / columnCount);
        gridRef.current?.scrollToItem({ rowIndex: row, columnIndex: 0, align: 'smart' });
        return newIndex;
      });
    } else {
      // In category list: move up
      setFocusedRowIndex(prev => {
        const newIndex = Math.max(0, prev - 1);
        listRef.current?.scrollToItem(newIndex, 'smart');
        return newIndex;
      });
      setFocusedColIndex(0);
    }
  }, [selectedCategory, columnCount]);

  const handleDpadDown = useCallback(() => {
    if (selectedCategory) {
      // In grid: move down
      setFocusedGridIndex(prev => {
        const newIndex = Math.min(selectedCategoryItems.length - 1, prev + columnCount);
        const row = Math.floor(newIndex / columnCount);
        gridRef.current?.scrollToItem({ rowIndex: row, columnIndex: 0, align: 'smart' });
        return newIndex;
      });
    } else {
      // In category list: move down
      setFocusedRowIndex(prev => {
        const newIndex = Math.min(rowData.length - 1, prev + 1);
        listRef.current?.scrollToItem(newIndex, 'smart');
        return newIndex;
      });
      setFocusedColIndex(0);
    }
  }, [selectedCategory, selectedCategoryItems.length, columnCount, rowData.length]);

  const handleDpadLeft = useCallback(() => {
    if (selectedCategory) {
      // In grid: move left
      setFocusedGridIndex(prev => Math.max(0, prev - 1));
    } else {
      // In category row: scroll left
      setFocusedColIndex(prev => Math.max(0, prev - 1));
    }
  }, [selectedCategory]);

  const handleDpadRight = useCallback(() => {
    if (selectedCategory) {
      // In grid: move right
      setFocusedGridIndex(prev => Math.min(selectedCategoryItems.length - 1, prev + 1));
    } else {
      // In category row: scroll right
      const currentRow = rowData[focusedRowIndex];
      const maxCol = (currentRow?.items?.length || 1) - 1;
      setFocusedColIndex(prev => Math.min(maxCol, prev + 1));
    }
  }, [selectedCategory, selectedCategoryItems.length, rowData, focusedRowIndex]);

  const handleDpadOk = useCallback(() => {
    if (selectedCategory) {
      // In grid: open modal for focused item
      const item = selectedCategoryItems[focusedGridIndex];
      if (item) onItemSelect?.(item);
    } else {
      // In category list: enter category
      const row = rowData[focusedRowIndex];
      if (row?.category) {
        setSelectedCategory(row.category);
        setFocusedGridIndex(0);
        setLocalZoomLevel(null);
      }
    }
  }, [selectedCategory, selectedCategoryItems, focusedGridIndex, rowData, focusedRowIndex, onItemSelect]);

  const handleDpadLongPressOk = useCallback(() => {
    if (selectedCategory) {
      // In grid: open context menu (My List / Favorites)
      const item = selectedCategoryItems[focusedGridIndex];
      if (item) {
        // For now, add to list directly - can add menu later
        onAddToList?.(item);
      }
    }
  }, [selectedCategory, selectedCategoryItems, focusedGridIndex, onAddToList]);

  const handleDpadDoubleUp = useCallback(() => {
    if (selectedCategory) {
      // Zoom in (less columns)
      setLocalZoomLevel(prev => {
        const current = prev || autoColumns;
        return Math.max(2, current - 1);
      });
    }
  }, [selectedCategory, autoColumns]);

  const handleDpadDoubleDown = useCallback(() => {
    if (selectedCategory) {
      // Zoom out (more columns)
      setLocalZoomLevel(prev => {
        const current = prev || autoColumns;
        return Math.min(autoColumns + 2, current + 1);
      });
    }
  }, [selectedCategory, autoColumns]);

  const handleDpadDoubleRight = useCallback(() => {
    // Switch to OTT
    onSwitchToOtt?.();
  }, [onSwitchToOtt]);

  const handleDpadBack = useCallback(() => {
    if (selectedCategory) {
      // Exit category grid
      setSelectedCategory(null);
      setLocalZoomLevel(null);
      setShowSearch(false);
      setSearchQuery('');
    } else {
      onBack?.();
    }
  }, [selectedCategory, onBack]);

  // Use DPAD hook
  useDpad({
    onUp: handleDpadUp,
    onDown: handleDpadDown,
    onLeft: handleDpadLeft,
    onRight: handleDpadRight,
    onOk: handleDpadOk,
    onLongPressOk: handleDpadLongPressOk,
    onDoubleUp: handleDpadDoubleUp,
    onDoubleDown: handleDpadDoubleDown,
    onDoubleRight: handleDpadDoubleRight,
    onBack: handleDpadBack,
    enabled: visible,
  });

  const Row = useCallback(({ index, style }) => {
    const data = rowData[index];
    if (!data) return null;
    const isFocused = !selectedCategory && index === focusedRowIndex;
    return (
      <CategoryRowWrapper 
        category={data.category} 
        items={data.items} 
        totalItems={data.totalItems}
        onItemSelect={onItemSelect}
        onAddToList={onAddToList}
        onAddToFavorites={onAddToFavorites}
        onCategoryClick={handleCategoryClick}
        width={containerWidth} 
        style={style}
        isFocused={isFocused}
        focusedColIndex={isFocused ? focusedColIndex : -1}
      />
    );
  }, [rowData, onItemSelect, onAddToList, onAddToFavorites, handleCategoryClick, containerWidth, selectedCategory, focusedRowIndex, focusedColIndex]);

  const GridCell = useCallback(({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * columnCount + columnIndex;
    const item = selectedCategoryItems[index];
    if (!item) return null;
    const isFocused = selectedCategory && index === focusedGridIndex;
    return (
      <Thumbnail 
        item={item} 
        onTap={onItemSelect} 
        onAddToList={onAddToList}
        onAddToFavorites={onAddToFavorites}
        style={style}
        isFocused={isFocused}
      />
    );
  }, [selectedCategoryItems, columnCount, onItemSelect, onAddToList, onAddToFavorites, selectedCategory, focusedGridIndex]);

  // Calculate header height based on whether tabs are separate or in header
  const headerHeight = isLandscape ? 56 : (selectedCategory ? 56 : 108);
  const searchHeight = showSearch ? 52 : 0;

  return (
    <div 
      className="flex flex-col h-full" 
      style={{ 
        display: visible ? 'flex' : 'none',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <header className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: '#000000' }}>
        {selectedCategory ? (
          <>
            <button onClick={handleBackFromCategory} className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-white font-semibold text-sm">{selectedCategory.category_name}</span>
              <span className="text-gray-500 text-xs ml-2">({selectedCategoryItems.length})</span>
            </div>
            {/* Loupe search */}
            <button onClick={() => setShowSearch(!showSearch)} className="w-10 h-10 flex items-center justify-center active:scale-90 transition-transform">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
            </button>
          </>
        ) : (
          <>
            <div className="flex items-baseline">
              <span className="text-white font-black text-lg">NINJA</span>
              <span className="font-black text-lg ml-1" style={{ color: '#6225ff' }}>8K</span>
            </div>
            
            {/* Tabs in header for landscape */}
            {isLandscape && (
              <div className="flex items-center gap-4">
                {['movies', 'series'].map((tab) => (
                  <button 
                    key={tab} 
                    onClick={() => onTabChange(tab)} 
                    className="px-4 py-2 text-sm font-semibold relative"
                    style={{ color: activeTab === tab ? '#ffffff' : '#9ca3af' }}
                  >
                    {tab === 'movies' ? 'Movies' : 'Series'}
                    {activeTab === tab && (
                      <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #6225ff, #8b5cf6)' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
            
            <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-transform">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </button>
          </>
        )}
      </header>

      {/* Search bar */}
      <SearchBar 
        visible={showSearch} 
        onClose={() => { setShowSearch(false); setSearchQuery(''); }}
        onSearch={setSearchQuery}
        placeholder={`Search in ${selectedCategory?.category_name || 'All'}...`}
      />
      
      {/* Tabs below header only for portrait and when no category selected */}
      {!selectedCategory && !isLandscape && (
        <div className="flex flex-shrink-0" style={{ background: '#000000' }}>
          {['movies', 'series'].map((tab) => (
            <button key={tab} onClick={() => onTabChange(tab)} className="flex-1 py-3.5 text-sm font-semibold relative" style={{ color: activeTab === tab ? '#ffffff' : '#9ca3af' }}>
              {tab === 'movies' ? 'Movies' : 'Series'}
              {activeTab === tab && <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #6225ff, #8b5cf6)' }} />}
            </button>
          ))}
        </div>
      )}
      
      <div 
        className="flex-1 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'pan-y' }}
      >
        {selectedCategory ? (
          <div 
            style={{ paddingLeft: gridPadding, paddingRight: gridPadding, touchAction: 'pan-y' }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <Grid 
              ref={gridRef}
              height={containerHeight - 70 - searchHeight} 
              width={totalGridWidth} 
              columnCount={columnCount} 
              rowCount={rowCount} 
              columnWidth={ITEM_WIDTH} 
              rowHeight={THUMBNAIL_HEIGHT + THUMBNAIL_GAP} 
              overscanRowCount={3}
            >
              {GridCell}
            </Grid>
          </div>
        ) : (
          <List 
            ref={listRef}
            height={containerHeight - headerHeight} 
            width={containerWidth} 
            itemCount={rowData.length} 
            itemSize={CATEGORY_ROW_HEIGHT} 
            overscanCount={2}
            onItemsRendered={handleItemsRendered}
          >
            {Row}
          </List>
        )}
      </div>
      
      {!selectedCategory && (
        <div className="absolute bottom-4 left-4 text-gray-600 text-[10px] z-10">
          <span>DPAD: ↑↓←→ OK · 2×→ OTT</span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// OTT VIEW - Landscape/Portrait with windowing + gestures + search
// ============================================================================
const OttView = ({ 
  activeTab, categories, itemsByCategoryMap, countMap, favorites, recents, 
  selectedCategory, sidebarVisible, onItemSelect, onAddToList, onAddToFavorites,
  onTabChange, onCategorySelect, onToggleSidebar, visible, 
  containerWidth, containerHeight, isPortrait, isTransitioning,
  zoomLevel, onSwitchToHub
}) => {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [localZoomLevel, setLocalZoomLevel] = useState(null);
  
  // DPAD state
  const [focusInSidebar, setFocusInSidebar] = useState(true);
  const [focusedSidebarIndex, setFocusedSidebarIndex] = useState(0);
  const [focusedGridIndex, setFocusedGridIndex] = useState(0);
  const sidebarListRef = useRef(null);
  const gridRef = useRef(null);

  const allItems = useMemo(() => {
    return Object.values(itemsByCategoryMap).flat();
  }, [itemsByCategoryMap]);

  const displayItems = useMemo(() => {
    let items = [];
    if (!selectedCategory || selectedCategory === 'all') items = allItems;
    else if (selectedCategory === 'favorites') items = favorites;
    else if (selectedCategory === 'recent') items = recents;
    else items = itemsByCategoryMap[String(selectedCategory)] || [];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => item.name?.toLowerCase().includes(query));
    }
    return items;
  }, [selectedCategory, allItems, itemsByCategoryMap, favorites, recents, searchQuery]);

  const sidebarWidthPercent = isPortrait ? SIDEBAR_WIDTH_PORTRAIT_PERCENT : SIDEBAR_WIDTH_PERCENT;
  const sidebarWidth = sidebarVisible ? containerWidth * sidebarWidthPercent / 100 : 0;
  const gridWidth = containerWidth - sidebarWidth - 16;
  
  // Calculate columns - aim for 5-6 columns minimum in landscape
  const minColumns = isPortrait ? 3 : 5;
  const autoColumns = Math.max(minColumns, Math.floor(gridWidth / ITEM_WIDTH));
  const columnCount = localZoomLevel || zoomLevel || autoColumns;
  const actualItemWidth = gridWidth / columnCount;
  const rowCount = Math.ceil(displayItems.length / columnCount);

  const sidebarData = useMemo(() => {
    const data = [
      { id: 'all', name: 'All', count: allItems.length },
      { id: 'favorites', name: '★ Favorites', count: favorites.length },
      { id: 'recent', name: '↺ Recent', count: recents.length },
    ];
    categories.forEach(cat => data.push({ id: cat.category_id, name: cat.category_name, count: countMap[String(cat.category_id)] || 0 }));
    return data;
  }, [categories, allItems.length, favorites.length, recents.length, countMap]);

  // DPAD handlers for OTT
  const handleDpadUp = useCallback(() => {
    if (focusInSidebar) {
      setFocusedSidebarIndex(prev => {
        const newIndex = Math.max(0, prev - 1);
        sidebarListRef.current?.scrollToItem(newIndex, 'smart');
        return newIndex;
      });
    } else {
      setFocusedGridIndex(prev => {
        const newIndex = Math.max(0, prev - columnCount);
        const row = Math.floor(newIndex / columnCount);
        gridRef.current?.scrollToItem({ rowIndex: row, columnIndex: 0, align: 'smart' });
        return newIndex;
      });
    }
  }, [focusInSidebar, columnCount]);

  const handleDpadDown = useCallback(() => {
    if (focusInSidebar) {
      setFocusedSidebarIndex(prev => {
        const newIndex = Math.min(sidebarData.length - 1, prev + 1);
        sidebarListRef.current?.scrollToItem(newIndex, 'smart');
        return newIndex;
      });
    } else {
      setFocusedGridIndex(prev => {
        const newIndex = Math.min(displayItems.length - 1, prev + columnCount);
        const row = Math.floor(newIndex / columnCount);
        gridRef.current?.scrollToItem({ rowIndex: row, columnIndex: 0, align: 'smart' });
        return newIndex;
      });
    }
  }, [focusInSidebar, sidebarData.length, displayItems.length, columnCount]);

  const handleDpadLeft = useCallback(() => {
    if (focusInSidebar) {
      // Already in sidebar
    } else {
      const col = focusedGridIndex % columnCount;
      if (col === 0 && sidebarVisible) {
        // Move to sidebar
        setFocusInSidebar(true);
      } else {
        setFocusedGridIndex(prev => Math.max(0, prev - 1));
      }
    }
  }, [focusInSidebar, focusedGridIndex, columnCount, sidebarVisible]);

  const handleDpadRight = useCallback(() => {
    if (focusInSidebar) {
      // Move to grid
      setFocusInSidebar(false);
    } else {
      setFocusedGridIndex(prev => Math.min(displayItems.length - 1, prev + 1));
    }
  }, [focusInSidebar, displayItems.length]);

  const handleDpadOk = useCallback(() => {
    if (focusInSidebar) {
      // Select category
      const cat = sidebarData[focusedSidebarIndex];
      if (cat) onCategorySelect?.(cat.id);
    } else {
      // Open modal for item
      const item = displayItems[focusedGridIndex];
      if (item) onItemSelect?.(item);
    }
  }, [focusInSidebar, sidebarData, focusedSidebarIndex, displayItems, focusedGridIndex, onCategorySelect, onItemSelect]);

  const handleDpadLongPressOk = useCallback(() => {
    if (!focusInSidebar) {
      const item = displayItems[focusedGridIndex];
      if (item) onAddToList?.(item);
    }
  }, [focusInSidebar, displayItems, focusedGridIndex, onAddToList]);

  const handleDpadDoubleUp = useCallback(() => {
    // Zoom in
    setLocalZoomLevel(prev => {
      const current = prev || autoColumns;
      return Math.max(2, current - 1);
    });
  }, [autoColumns]);

  const handleDpadDoubleDown = useCallback(() => {
    // Zoom out
    setLocalZoomLevel(prev => {
      const current = prev || autoColumns;
      return Math.min(autoColumns + 2, current + 1);
    });
  }, [autoColumns]);

  const handleDpadDoubleLeft = useCallback(() => {
    // Switch to Hub
    onSwitchToHub?.();
  }, [onSwitchToHub]);

  const handleDpadTripleLeft = useCallback(() => {
    // Hide sidebar
    if (sidebarVisible) onToggleSidebar?.();
  }, [sidebarVisible, onToggleSidebar]);

  const handleDpadTripleRight = useCallback(() => {
    // Show sidebar
    if (!sidebarVisible) onToggleSidebar?.();
  }, [sidebarVisible, onToggleSidebar]);

  // Use DPAD hook
  useDpad({
    onUp: handleDpadUp,
    onDown: handleDpadDown,
    onLeft: handleDpadLeft,
    onRight: handleDpadRight,
    onOk: handleDpadOk,
    onLongPressOk: handleDpadLongPressOk,
    onDoubleUp: handleDpadDoubleUp,
    onDoubleDown: handleDpadDoubleDown,
    onDoubleLeft: handleDpadDoubleLeft,
    onTripleLeft: handleDpadTripleLeft,
    onTripleRight: handleDpadTripleRight,
    enabled: visible,
  });

  // Sidebar row - smaller text in portrait + DPAD focus
  const SidebarRow = useCallback(({ index, style }) => {
    const cat = sidebarData[index];
    if (!cat) return null;
    const isSelected = selectedCategory === cat.id;
    const isFocused = focusInSidebar && index === focusedSidebarIndex;
    
    return (
      <div style={style}>
        <button 
          onClick={() => onCategorySelect(cat.id)} 
          className={`w-full h-full p-2 text-left border-b border-white/5 relative overflow-hidden ${isPortrait ? 'text-[10px]' : 'text-xs'}`}
          style={{ 
            background: isSelected ? 'rgba(98, 37, 255, 0.15)' : 'transparent',
            outline: isFocused ? '2px solid #8b5cf6' : 'none',
            outlineOffset: '-2px',
          }}
        >
          {isSelected && (
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
              style={{ background: 'linear-gradient(180deg, #6225ff, #8b5cf6)' }}
            />
          )}
          <div className="pl-2">
            <div className="flex items-center">
              <MarqueeText text={cat.name} isSelected={isSelected} />
              <span className={`text-gray-500 ml-1 ${isPortrait ? 'text-[8px]' : 'text-[10px]'}`}>({cat.count})</span>
            </div>
          </div>
        </button>
      </div>
    );
  }, [sidebarData, selectedCategory, onCategorySelect, isPortrait, focusInSidebar, focusedSidebarIndex]);

  const TextListRow = useCallback(({ index, style }) => {
    const item = displayItems[index];
    if (!item) return null;
    return (
      <div style={style}>
        <button 
          onClick={() => onItemSelect(item)}
          className={`w-full h-full px-4 py-2 text-left border-b border-white/5 active:bg-white/5 ${isPortrait ? 'text-xs' : 'text-sm'}`}
        >
          <span className="text-white truncate block">{item.name}</span>
        </button>
      </div>
    );
  }, [displayItems, onItemSelect, isPortrait]);

  const GridCell = useCallback(({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * columnCount + columnIndex;
    const item = displayItems[index];
    if (!item) return null;
    const isFocused = !focusInSidebar && index === focusedGridIndex;
    
    const centeredStyle = {
      ...style,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    };
    
    return (
      <div style={centeredStyle}>
        <Thumbnail 
          item={item} 
          onTap={onItemSelect} 
          onAddToList={onAddToList}
          onAddToFavorites={onAddToFavorites}
          style={{ width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT }}
          isFocused={isFocused}
        />
      </div>
    );
  }, [displayItems, columnCount, onItemSelect, onAddToList, onAddToFavorites, focusInSidebar, focusedGridIndex]);

  const currentCategoryName = selectedCategory === 'all' ? 'All' : 
    selectedCategory === 'favorites' ? 'Favorites' : 
    selectedCategory === 'recent' ? 'Recent' : 
    categories.find(c => c.category_id === selectedCategory)?.category_name || 'All';

  const searchHeight = showSearch ? 52 : 0;

  return (
    <div 
      className="flex h-full" 
      style={{ 
        display: visible ? 'flex' : 'none',
      }}
    >
      {/* Sidebar - animation porte gauche (vient de la gauche) */}
      <div 
        className="flex-shrink-0 overflow-hidden border-r border-white/10" 
        style={{ 
          width: sidebarWidth, 
          opacity: sidebarVisible ? 1 : 0, 
          background: 'rgba(0,0,0,0.8)',
          transform: isTransitioning ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 25s ease-out, width 1s, opacity 1s',
        }}
      >
        <div className="flex border-b border-white/10">
          {['movies', 'series'].map((tab) => (
            <button 
              key={tab} 
              onClick={() => onTabChange(tab)} 
              className={`flex-1 py-3 font-bold uppercase ${isPortrait ? 'text-[10px]' : 'text-xs'}`}
              style={{ color: activeTab === tab ? '#6225ff' : '#9ca3af', background: activeTab === tab ? 'rgba(98, 37, 255, 0.1)' : 'transparent' }}
            >
              {tab === 'movies' ? 'Movies' : 'Series'}
            </button>
          ))}
        </div>
        {sidebarVisible && (
          <List 
            ref={sidebarListRef}
            height={containerHeight - 48} 
            width={sidebarWidth} 
            itemCount={sidebarData.length} 
            itemSize={isPortrait ? 44 : SIDEBAR_ITEM_HEIGHT} 
            overscanCount={5}
          >
            {SidebarRow}
          </List>
        )}
      </div>

      <div className="absolute top-1/2 -translate-y-1/2 z-20 transition-all duration-300" style={{ left: sidebarWidth }}>
        <button 
          onClick={onToggleSidebar} 
          className="w-2 h-20 rounded-r-full flex items-center justify-center"
          style={{ background: 'linear-gradient(180deg, rgba(98,37,255,0.3), rgba(139,92,246,0.3))' }}
        />
      </div>

      {/* Content - animation porte droite (vient de la droite) */}
      <div 
        className="flex-1 overflow-hidden flex flex-col"
        style={{
          transform: isTransitioning ? 'translateX(100%)' : 'translateX(0)',
          transition: 'transform 25s ease-out',
        }}
      >
        {/* Header with search icon */}
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex items-center">
            <h2 className="text-white font-bold text-sm uppercase">{currentCategoryName}</h2>
            <span className="text-gray-500 text-xs ml-2">({displayItems.length})</span>
          </div>
          {/* Loupe search */}
          <button onClick={() => setShowSearch(!showSearch)} className="w-8 h-8 flex items-center justify-center active:scale-90 transition-transform">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
        </div>

        {/* Search bar */}
        <SearchBar 
          visible={showSearch} 
          onClose={() => { setShowSearch(false); setSearchQuery(''); }}
          onSearch={setSearchQuery}
          placeholder={`Search in ${currentCategoryName}...`}
        />
        
        <div className="flex-1 overflow-hidden px-2">
          {displayItems.length > 0 ? (
            isPortrait ? (
              <List
                height={containerHeight - 56 - searchHeight}
                width={gridWidth}
                itemCount={displayItems.length}
                itemSize={40}
                overscanCount={10}
              >
                {TextListRow}
              </List>
            ) : (
              <Grid 
                ref={gridRef}
                height={containerHeight - 56 - searchHeight} 
                width={gridWidth} 
                columnCount={columnCount} 
                rowCount={rowCount} 
                columnWidth={actualItemWidth} 
                rowHeight={THUMBNAIL_HEIGHT + THUMBNAIL_GAP + 8} 
                overscanRowCount={2} 
                overscanColumnCount={1}
              >
                {GridCell}
              </Grid>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-gray-500 text-sm">{searchQuery ? 'No results' : 'No content'}</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="absolute bottom-4 right-4 text-gray-600 text-[10px] z-10">
        {isPortrait ? '3-finger spread for landscape' : '3-finger spread to exit'}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN HUB COMPONENT
// ============================================================================
const Hub = ({ onBack, onPlay }) => {
  const { playlist } = usePlaylistContext();
  const [viewMode, setViewMode] = useState('hub');
  const [activeTab, setActiveTab] = useState('movies');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [showInfo, setShowInfo] = useState(null);
  const [infoData, setInfoData] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [recents, setRecents] = useState([]);
  const [myList, setMyList] = useState([]);
  const [selectedIsFavorite, setSelectedIsFavorite] = useState(false);
  const [selectedIsInList, setSelectedIsInList] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [loadedCategories, setLoadedCategories] = useState(INITIAL_CATEGORIES);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const containerRef = useRef(null);
  const ninjaCentralInitialized = useRef(false);
  const lastTouchDistance = useRef(0);
  const lastTouchX = useRef(0);
  const pinchStartDistance = useRef(0);

  const isLandscape = containerSize.width > containerSize.height;
  const isPortrait = !isLandscape;

  const xtreamService = useMemo(() => {
    if (!playlist?.server || !playlist?.username || !playlist?.password) return null;
    return new XtreamService(playlist.server, playlist.username, playlist.password);
  }, [playlist]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const loadUserData = async () => {
      if (ninjaCentralInitialized.current) return;
      try {
        await ninjaCentral.init();
        ninjaCentralInitialized.current = true;
        const type = activeTab === 'movies' ? 'vod' : 'series';
        const favs = await ninjaCentral.getFavorites(type);
        const recs = await ninjaCentral.getRecent(type, 20);
        setFavorites(favs.map(f => f.item));
        setRecents(recs.map(r => r.item));
      } catch (err) {
        console.error('[Hub] Error loading user data:', err);
      }
    };
    const timer = setTimeout(loadUserData, 100);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const items = useMemo(() => {
    const isVod = activeTab === 'movies';
    return isVod ? (playlist?.data?.vod || []) : (playlist?.data?.series || []);
  }, [playlist, activeTab]);

  const itemsByCategoryMap = useMemo(() => {
    const map = {};
    items.forEach(item => {
      const catId = String(item.categoryId);
      if (!map[catId]) map[catId] = [];
      map[catId].push(item);
    });
    return map;
  }, [items]);

  const categories = useMemo(() => {
    const isVod = activeTab === 'movies';
    return isVod ? (playlist?.data?.vodCategories || []) : (playlist?.data?.seriesCategories || []);
  }, [playlist, activeTab]);

  const countMap = useMemo(() => {
    const map = {};
    Object.entries(itemsByCategoryMap).forEach(([catId, catItems]) => {
      map[catId] = catItems.length;
    });
    return map;
  }, [itemsByCategoryMap]);

  const sidebarData = useMemo(() => {
    const data = [
      { id: 'all', name: 'All' },
      { id: 'favorites', name: '★ Favorites' },
      { id: 'recent', name: '↺ Recent' },
    ];
    categories.forEach(cat => data.push({ id: cat.category_id, name: cat.category_name }));
    return data;
  }, [categories]);

  useEffect(() => {
    setLoadedCategories(INITIAL_CATEGORIES);
  }, [activeTab]);

  const handleLoadMoreCategories = useCallback(() => {
    setLoadedCategories(prev => Math.min(prev + INITIAL_CATEGORIES, categories.length));
  }, [categories.length]);

  useEffect(() => {
    const lockOrientation = async () => {
      try {
        if (window.screen.orientation?.lock) {
          await window.screen.orientation.lock(viewMode === 'ott' ? 'landscape' : 'portrait');
        }
      } catch (err) {}
    };
    lockOrientation();
    return () => { window.screen.orientation?.unlock?.(); };
  }, [viewMode]);

  // Global touch handlers for 3-finger gestures
  // Refs for rotation detection in main Hub
  const mainPinchStartAngle = useRef(0);
  const mainRotationTriggered = useRef(false);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 3) {
      lastTouchDistance.current = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      lastTouchX.current = (e.touches[0].pageX + e.touches[1].pageX + e.touches[2].pageX) / 3;
    }
    if (e.touches.length === 2) {
      pinchStartDistance.current = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      mainPinchStartAngle.current = getAngle(e.touches[0], e.touches[1]);
      mainRotationTriggered.current = false;
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 3) {
      const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      const currentX = (e.touches[0].pageX + e.touches[1].pageX + e.touches[2].pageX) / 3;
      const deltaX = currentX - lastTouchX.current;
      
      if (lastTouchDistance.current > 0) {
        if (dist < lastTouchDistance.current - 30) { 
          setIsTransitioning(true);
          ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {});
          setTimeout(() => {
            setViewMode('ott'); 
            setIsTransitioning(false);
          }, 50);
          lastTouchDistance.current = dist; 
        }
        else if (dist > lastTouchDistance.current + 30) { 
          setIsTransitioning(true);
          ScreenOrientation.unlock().catch(() => {});
          setTimeout(() => {
            setViewMode('hub'); 
            setIsTransitioning(false);
          }, 50);
          lastTouchDistance.current = dist; 
        }
      }
      
      if (viewMode === 'ott' && Math.abs(deltaX) > 80) {
        const currentIdx = sidebarData.findIndex(c => c.id === selectedCategory);
        if (deltaX < 0 && currentIdx < sidebarData.length - 1) {
          setSelectedCategory(sidebarData[currentIdx + 1].id);
        } else if (deltaX > 0 && currentIdx > 0) {
          setSelectedCategory(sidebarData[currentIdx - 1].id);
        }
        lastTouchX.current = currentX;
      }
    }
    
    if (e.touches.length === 2 && pinchStartDistance.current > 0) {
      e.preventDefault(); // Block native zoom
      
      const currentDist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const currentAngle = getAngle(e.touches[0], e.touches[1]);
      const angleDelta = currentAngle - mainPinchStartAngle.current;
      
      // Normalize angle delta to -180 to 180
      let normalizedAngle = angleDelta;
      if (normalizedAngle > 180) normalizedAngle -= 360;
      if (normalizedAngle < -180) normalizedAngle += 360;
      
      // Rotation detection (threshold: 30 degrees)
      if (Math.abs(normalizedAngle) > 30 && !mainRotationTriggered.current) {
        mainRotationTriggered.current = true;
        
        if (normalizedAngle > 0) {
          // Clockwise rotation → landscape-primary (right)
          console.log('🔄 Main rotation clockwise → landscape-primary');
          ScreenOrientation.lock({ orientation: 'landscape-primary' }).catch(() => {});
        } else {
          // Counter-clockwise rotation → landscape-secondary (left)
          console.log('🔄 Main rotation counter-clockwise → landscape-secondary');
          ScreenOrientation.lock({ orientation: 'landscape-secondary' }).catch(() => {});
        }
        return;
      }
      
      // Pinch/spread for zoom (only in OTT mode)
      if (viewMode === 'ott' && !mainRotationTriggered.current) {
        const delta = currentDist - pinchStartDistance.current;
        
        if (Math.abs(delta) > 50) {
          if (delta > 0 && zoomIndex > 0) {
            setZoomIndex(prev => Math.max(0, prev - 1));
          } else if (delta < 0 && zoomIndex < ZOOM_LEVELS.length - 1) {
            setZoomIndex(prev => Math.min(ZOOM_LEVELS.length - 1, prev + 1));
          }
          pinchStartDistance.current = currentDist;
        }
      }
    }
  }, [viewMode, selectedCategory, sidebarData, zoomIndex]);

  const handleTouchEnd = useCallback(() => { 
    lastTouchDistance.current = 0; 
    lastTouchX.current = 0; 
    pinchStartDistance.current = 0;
    mainPinchStartAngle.current = 0;
    mainRotationTriggered.current = false;
  }, []);

  const handleItemSelect = useCallback(async (item) => {
    setShowInfo(item);
    setInfoLoading(true);
    setInfoData(null);
    
    if (ninjaCentralInitialized.current) {
      try { 
        await ninjaCentral.addRecent(item, activeTab === 'movies' ? 'vod' : 'series');
        const isFav = await ninjaCentral.isFavorite(item.id || item.stream_id || item.series_id, activeTab === 'movies' ? 'vod' : 'series');
        setSelectedIsFavorite(isFav);
        const inList = myList.some(i => (i.id || i.stream_id || i.series_id) === (item.id || item.stream_id || item.series_id));
        setSelectedIsInList(inList);
      } catch (err) {}
    }
    
    if (xtreamService) {
      try {
        const info = activeTab === 'movies' ? await xtreamService.getVodInfo(item.id || item.stream_id) : await xtreamService.getSeriesInfo(item.id || item.series_id);
        setInfoData(info);
      } catch (err) {}
    }
    setInfoLoading(false);
  }, [xtreamService, activeTab, myList]);

  const handleAddToList = useCallback((item) => {
    const itemId = item.id || item.stream_id || item.series_id;
    const isInList = myList.some(i => (i.id || i.stream_id || i.series_id) === itemId);
    if (isInList) {
      setMyList(prev => prev.filter(i => (i.id || i.stream_id || i.series_id) !== itemId));
      setSelectedIsInList(false);
    } else {
      setMyList(prev => [item, ...prev]);
      setSelectedIsInList(true);
    }
  }, [myList]);

  const handleAddToFavorites = useCallback(async (item) => {
    if (!ninjaCentralInitialized.current) return;
    try {
      const type = activeTab === 'movies' ? 'vod' : 'series';
      const itemId = item.id || item.stream_id || item.series_id;
      const isFav = await ninjaCentral.isFavorite(itemId, type);
      if (isFav) {
        await ninjaCentral.removeFavorite(itemId, type);
        setFavorites(prev => prev.filter(f => (f.id || f.stream_id || f.series_id) !== itemId));
      } else {
        await ninjaCentral.addFavorite(item, type);
        setFavorites(prev => [item, ...prev]);
      }
    } catch (err) {}
  }, [activeTab]);

  const handleToggleFavorite = useCallback(async (item) => {
    if (!ninjaCentralInitialized.current) return;
    try {
      const type = activeTab === 'movies' ? 'vod' : 'series';
      const itemId = item.id || item.stream_id || item.series_id;
      if (selectedIsFavorite) {
        await ninjaCentral.removeFavorite(itemId, type);
        setFavorites(prev => prev.filter(f => (f.id || f.stream_id || f.series_id) !== itemId));
        setSelectedIsFavorite(false);
      } else {
        await ninjaCentral.addFavorite(item, type);
        setFavorites(prev => [item, ...prev]);
        setSelectedIsFavorite(true);
      }
    } catch (err) {}
  }, [activeTab, selectedIsFavorite]);

  const handlePlay = useCallback((item) => { setShowInfo(null); onPlay?.(item); }, [onPlay]);
  const handleTabChange = useCallback((tab) => { setActiveTab(tab); setSelectedCategory('all'); }, []);

  const [particleTheme] = useState(() => localStorage.getItem('ninja_particle_theme') || 'soft');

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 flex flex-col overflow-hidden" 
      style={{ background: 'rgba(0, 0, 0, 0.85)' }} 
      onTouchStart={handleTouchStart} 
      onTouchMove={handleTouchMove} 
      onTouchEnd={handleTouchEnd}
    >
      {particleTheme !== 'off' && <div className="absolute inset-0 pointer-events-none z-0"><ParticleThemes theme={particleTheme} /></div>}
      
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        <HubView 
          activeTab={activeTab} 
          categories={categories} 
          itemsByCategoryMap={itemsByCategoryMap}
          favorites={favorites} 
          recents={recents} 
          onItemSelect={handleItemSelect}
          onAddToList={handleAddToList}
          onAddToFavorites={handleAddToFavorites}
          onTabChange={handleTabChange} 
          onBack={onBack} 
          visible={viewMode === 'hub'} 
          containerWidth={containerSize.width} 
          containerHeight={containerSize.height}
          loadedCategories={loadedCategories}
          onLoadMoreCategories={handleLoadMoreCategories}
          isLandscape={isLandscape}
          isTransitioning={isTransitioning}
          onSwitchToOtt={() => { setIsTransitioning(true); ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {}); setTimeout(() => { setViewMode('ott'); setIsTransitioning(false); }, 800); }}
        />
        <OttView 
          activeTab={activeTab} 
          categories={categories} 
          itemsByCategoryMap={itemsByCategoryMap}
          countMap={countMap} 
          favorites={favorites} 
          recents={recents} 
          selectedCategory={selectedCategory} 
          sidebarVisible={sidebarVisible} 
          onItemSelect={handleItemSelect}
          onAddToList={handleAddToList}
          onAddToFavorites={handleAddToFavorites}
          onTabChange={handleTabChange} 
          onCategorySelect={setSelectedCategory} 
          onToggleSidebar={() => setSidebarVisible(!sidebarVisible)} 
          visible={viewMode === 'ott'} 
          containerWidth={containerSize.width} 
          containerHeight={containerSize.height}
          isPortrait={isPortrait}
          isTransitioning={isTransitioning}
          zoomLevel={ZOOM_LEVELS[zoomIndex]}
          onSwitchToHub={() => { setIsTransitioning(true); ScreenOrientation.unlock().catch(() => {}); setTimeout(() => { setViewMode('hub'); setIsTransitioning(false); }, 800); }}
        />
      </div>
      
      {showInfo && (
        <InfoOverlay 
          item={showInfo} 
          info={infoData} 
          loading={infoLoading} 
          onClose={() => setShowInfo(null)} 
          onPlay={handlePlay} 
          onToggleFavorite={handleToggleFavorite}
          onAddToList={handleAddToList}
          isFavorite={selectedIsFavorite}
          isInList={selectedIsInList}
          isLandscape={isLandscape}
        />
      )}
      
      {/* Animations */}
      <style>{`
        @keyframes jiggle {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(4px); }
          50% { transform: translateX(-4px); }
          75% { transform: translateX(2px); }
        }
        @keyframes jiggle-left {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          50% { transform: translateX(4px); }
          75% { transform: translateX(-2px); }
        }
        @keyframes marquee-scroll {
          0%, 20% { transform: translateX(0); }
          80%, 100% { transform: translateX(var(--scroll-distance, -100px)); }
        }
        @keyframes jiggle {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(4px); }
          50% { transform: translateX(-4px); }
          75% { transform: translateX(2px); }
        }
        @keyframes jiggle-left {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          50% { transform: translateX(4px); }
          75% { transform: translateX(-2px); }
        }
        .animate-jiggle {
          animation: jiggle 0.4s ease-in-out;
        }
        .animate-jiggle-left {
          animation: jiggle-left 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Hub;
