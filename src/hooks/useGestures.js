import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// USE GESTURES - Centralized gesture + DPAD handler
// 
// 2 FINGERS:
//   - Up/Down = Volume control
//   - Pinch = Grid zoom out (more thumbnails per row)
//   - Spread = Grid zoom in (bigger thumbnails)
//   - Swipe Left = Next folder (OTTLeft)
//   - Swipe Right = Previous folder (OTTLeft)
//
// 3 FINGERS:
//   - Swipe Right = Open OTTLeft + OTTRight
//   - Swipe Left = Close OTTLeft + OTTRight
//   - Pinch = Open OTTLeft + OTTRight
//   - Spread = Close OTTLeft + OTTRight
//
// DPAD / REMOTE:
//   - Arrows = Navigation
//   - OK/Enter = Select
//   - Back/Escape = Close OTT or go back
//   - Blue (F1) = SettingsOverlay
//   - Yellow (F2) = Favorites
//   - Green (F3) = Tab switcher (LIVE → MOVIES → SERIES)
//   - Red (F4) = OTTLeft + OTTRight toggle
//   - Long press → = OTT open
//   - Long press ← = OTT close
//   - Extra long press ← = SettingsOverlay
//   - Extra long press → = Favorites
//   - Triple ← or → = Cycle tabs (LIVE/MOVIES/SERIES)
//
// ============================================================================

const DPAD_KEYS = {
  UP: ['ArrowUp'],
  DOWN: ['ArrowDown'],
  LEFT: ['ArrowLeft'],
  RIGHT: ['ArrowRight'],
  OK: ['Enter', ' '],
  BACK: ['Escape', 'Backspace', 'GoBack'],
  BLUE: ['F1', 'ColorF0Blue', 'b', 'B'],
  YELLOW: ['F2', 'ColorF1Yellow', 'y', 'Y'],
  GREEN: ['F3', 'ColorF2Green', 'g', 'G'],
  RED: ['F4', 'ColorF3Red', 'r', 'R'],
};

const LONG_PRESS_MS = 600;
const EXTRA_LONG_PRESS_MS = 1500;
const TRIPLE_PRESS_MS = 400;

export const useGestures = (containerRef, callbacks = {}) => {
  // Touch states
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const [initialPinchDistance, setInitialPinchDistance] = useState(null);
  const [initialVolume, setInitialVolume] = useState(1);
  const [volume, setVolume] = useState(1);

  // Touch refs
  const gestureActiveRef = useRef(false);
  const fingerCountRef = useRef(0);
  const containerRefInternal = useRef(containerRef);

  // DPAD refs
  const longPressTimerRef = useRef(null);
  const extraLongPressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const extraLongPressFiredRef = useRef(false);
  const triplePressCountRef = useRef(0);
  const triplePressDirRef = useRef(null);
  const triplePressTimerRef = useRef(null);
  const currentKeyRef = useRef(null);

  useEffect(() => {
    containerRefInternal.current = containerRef;
  }, [containerRef]);

  // ========================================
  // GESTURE HELPERS
  // ========================================
  const getTouchDistance = useCallback((touches) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const getTouchCenter = useCallback((touches) => {
    let sumX = 0, sumY = 0;
    for (let i = 0; i < touches.length; i++) {
      sumX += touches[i].clientX;
      sumY += touches[i].clientY;
    }
    return { x: sumX / touches.length, y: sumY / touches.length };
  }, []);

  // ========================================
  // TOUCH HANDLERS
  // ========================================
  const handleTouchStart = useCallback((e) => {
    const fingerCount = e.touches.length;
    fingerCountRef.current = fingerCount;

    if (fingerCount === 2 || fingerCount === 3) {
      e.preventDefault();
      e.stopPropagation();
      gestureActiveRef.current = true;
      
      const center = getTouchCenter(e.touches);
      setTouchStartY(center.y);
      setTouchStartX(center.x);
      setInitialVolume(volume);
      
      if (fingerCount >= 2) {
        setInitialPinchDistance(getTouchDistance(e.touches));
      }
    }
  }, [volume, getTouchDistance, getTouchCenter]);

  const handleTouchMove = useCallback((e) => {
    if (!gestureActiveRef.current) return;
    
    const fingerCount = e.touches.length;
    if (fingerCount !== fingerCountRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();

    const center = getTouchCenter(e.touches);

    // ========================================
    // 2 FINGERS — Volume + Grid Zoom + Folder Nav
    // ========================================
    if (fingerCount === 2 && touchStartY !== null && initialPinchDistance !== null) {
      const currentDistance = getTouchDistance(e.touches);
      const distanceChange = currentDistance - initialPinchDistance;
      const deltaX = center.x - touchStartX;
      const deltaY = center.y - touchStartY;

      // PINCH/SPREAD → Grid zoom
      if (Math.abs(distanceChange) > 50) {
        if (distanceChange > 0) {
          callbacks.onGridZoomIn?.();
        } else {
          callbacks.onGridZoomOut?.();
        }
        setInitialPinchDistance(null);
        setTouchStartY(null);
        setTouchStartX(null);
        gestureActiveRef.current = false;
      }
      // SWIPE horizontal → Folder navigation
      else if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX > 0) {
          callbacks.onFolderPrev?.();
        } else {
          callbacks.onFolderNext?.();
        }
        setInitialPinchDistance(null);
        setTouchStartY(null);
        setTouchStartX(null);
        gestureActiveRef.current = false;
      }
      // VOLUME — vertical
      else {
        const volumeChange = (touchStartY - center.y) / 200;
        const newVolume = Math.max(0, Math.min(1, initialVolume + volumeChange));
        setVolume(newVolume);
        callbacks.onVolumeChange?.(newVolume);
      }
    }

    // ========================================
    // 3 FINGERS — OTTLeft + OTTRight control
    // ========================================
    if (fingerCount === 3 && touchStartX !== null && touchStartY !== null) {
      const currentDistance = getTouchDistance(e.touches);
      const distanceChange = initialPinchDistance ? currentDistance - initialPinchDistance : 0;
      const deltaX = center.x - touchStartX;
      const deltaY = center.y - touchStartY;

      // SWIPE horizontal
      if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) {
          callbacks.onOTTOpen?.();
        } else {
          callbacks.onOTTClose?.();
        }
        setInitialPinchDistance(null);
        setTouchStartY(null);
        setTouchStartX(null);
        gestureActiveRef.current = false;
      }
      // PINCH/SPREAD
      else if (Math.abs(distanceChange) > 50) {
        if (distanceChange > 0) {
          callbacks.onOTTClose?.();
        } else {
          callbacks.onOTTOpen?.();
        }
        setInitialPinchDistance(null);
        setTouchStartY(null);
        setTouchStartX(null);
        gestureActiveRef.current = false;
      }
    }
  }, [touchStartY, touchStartX, initialPinchDistance, initialVolume, getTouchDistance, getTouchCenter, callbacks]);

  const handleTouchEnd = useCallback((e) => {
    if (gestureActiveRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
    gestureActiveRef.current = false;
    fingerCountRef.current = 0;
    setTouchStartY(null);
    setTouchStartX(null);
    setInitialPinchDistance(null);
  }, []);

  // ========================================
  // DPAD / REMOTE CONTROL
  // ========================================
  const clearDpadTimers = useCallback(() => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (extraLongPressTimerRef.current) clearTimeout(extraLongPressTimerRef.current);
    longPressTimerRef.current = null;
    extraLongPressTimerRef.current = null;
  }, []);

  const matchKey = useCallback((key, group) => {
    return DPAD_KEYS[group]?.includes(key);
  }, []);

  const handleKeyDown = useCallback((e) => {
    const key = e.key;
    if (e.repeat) return;

    // Color buttons (instant)
    if (matchKey(key, 'BLUE')) { e.preventDefault(); callbacks.onSettings?.(); return; }
    if (matchKey(key, 'YELLOW')) { e.preventDefault(); callbacks.onFavorites?.(); return; }
    if (matchKey(key, 'GREEN')) { e.preventDefault(); callbacks.onTabSwitch?.(); return; }
    if (matchKey(key, 'RED')) { e.preventDefault(); callbacks.onOTTToggle?.(); return; }

    // Back
    if (matchKey(key, 'BACK')) { e.preventDefault(); callbacks.onBack?.(); return; }

    // OK / Enter
    if (matchKey(key, 'OK')) { e.preventDefault(); callbacks.onSelect?.(); return; }

    // Up / Down (instant)
    if (matchKey(key, 'UP')) { e.preventDefault(); callbacks.onNavigateUp?.(); return; }
    if (matchKey(key, 'DOWN')) { e.preventDefault(); callbacks.onNavigateDown?.(); return; }

    // Left / Right — triple + long + extra long press
    const isLeft = matchKey(key, 'LEFT');
    const isRight = matchKey(key, 'RIGHT');

    if (isLeft || isRight) {
      e.preventDefault();
      const dir = isLeft ? 'left' : 'right';
      currentKeyRef.current = dir;
      longPressFiredRef.current = false;
      extraLongPressFiredRef.current = false;

      // Triple press detection
      if (triplePressDirRef.current === dir) {
        triplePressCountRef.current++;
        if (triplePressTimerRef.current) clearTimeout(triplePressTimerRef.current);

        if (triplePressCountRef.current >= 3) {
          callbacks.onTabSwitch?.();
          triplePressCountRef.current = 0;
          triplePressDirRef.current = null;
          clearDpadTimers();
          return;
        }
      } else {
        triplePressCountRef.current = 1;
        triplePressDirRef.current = dir;
      }

      triplePressTimerRef.current = setTimeout(() => {
        triplePressCountRef.current = 0;
        triplePressDirRef.current = null;
      }, TRIPLE_PRESS_MS);

      // Long press → OTT
      clearDpadTimers();
      longPressTimerRef.current = setTimeout(() => {
        longPressFiredRef.current = true;
        if (dir === 'right') {
          callbacks.onOTTOpen?.();
        } else {
          callbacks.onOTTClose?.();
        }
      }, LONG_PRESS_MS);

      // Extra long press → Settings / Favorites
      extraLongPressTimerRef.current = setTimeout(() => {
        extraLongPressFiredRef.current = true;
        if (dir === 'left') {
          callbacks.onSettings?.();
        } else {
          callbacks.onFavorites?.();
        }
      }, EXTRA_LONG_PRESS_MS);
    }
  }, [callbacks, matchKey, clearDpadTimers]);

  const handleKeyUp = useCallback((e) => {
    const key = e.key;
    const isLeft = matchKey(key, 'LEFT');
    const isRight = matchKey(key, 'RIGHT');

    if (isLeft || isRight) {
      clearDpadTimers();

      // Regular press → navigate
      if (!longPressFiredRef.current && !extraLongPressFiredRef.current) {
        if (isLeft) {
          callbacks.onNavigateLeft?.();
        } else {
          callbacks.onNavigateRight?.();
        }
      }

      currentKeyRef.current = null;
      longPressFiredRef.current = false;
      extraLongPressFiredRef.current = false;
    }
  }, [callbacks, matchKey, clearDpadTimers]);

  // ========================================
  // ATTACH TOUCH HANDLERS
  // ========================================
  useEffect(() => {
    const container = containerRefInternal.current?.current;
    if (!container) return;

    const options = { passive: false, capture: true };
    container.addEventListener('touchstart', handleTouchStart, options);
    container.addEventListener('touchmove', handleTouchMove, options);
    container.addEventListener('touchend', handleTouchEnd, options);
    container.style.touchAction = 'none';

    return () => {
      container.removeEventListener('touchstart', handleTouchStart, options);
      container.removeEventListener('touchmove', handleTouchMove, options);
      container.removeEventListener('touchend', handleTouchEnd, options);
      container.style.touchAction = 'auto';
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // ========================================
  // ATTACH DPAD HANDLERS
  // ========================================
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearDpadTimers();
      if (triplePressTimerRef.current) clearTimeout(triplePressTimerRef.current);
    };
  }, [handleKeyDown, handleKeyUp, clearDpadTimers]);

  return {
    volume,
    touchStartY,
    initialPinchDistance,
    gestureActive: gestureActiveRef.current,
  };
};

export default useGestures;
