import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// USE GESTURES - Centralized gesture handler with absolute priority
// 
// 2 FINGERS:
//   - Up/Down = Volume control
//   - Spread = Enter fullscreen
//   - Pinch = Exit fullscreen
//   - Swipe Left = Previous folder (OTT sidebar)
//   - Swipe Right = Next folder (OTT sidebar)
//
// 3 FINGERS:
//   - Spread = Exit OTT sidebar
//   - Pinch = Open OTT sidebar
//   - Swipe Right = Open OTT sidebar
//   - Swipe Left = Close OTT sidebar
//
// ============================================================================

export const useGestures = (containerRef, callbacks = {}) => {
  // States
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const [initialPinchDistance, setInitialPinchDistance] = useState(null);
  const [initialVolume, setInitialVolume] = useState(1);
  const [orientation, setOrientation] = useState(0);
  const [isInvertedGravity, setIsInvertedGravity] = useState(false);
  const [volume, setVolume] = useState(1);

  // Refs
  const gestureActiveRef = useRef(false);
  const fingerCountRef = useRef(0);
  const containerRefInternal = useRef(containerRef);

  // Keep containerRef in sync
  useEffect(() => {
    containerRefInternal.current = containerRef;
  }, [containerRef]);

  // ========================================
  // ORIENTATION DETECTION
  // ========================================
  useEffect(() => {
    const handleOrientationChange = () => {
      const angle = window.innerWidth > window.innerHeight ? 90 : 0;
      setOrientation(angle);
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
    return {
      x: sumX / touches.length,
      y: sumY / touches.length
    };
  }, []);

  // ========================================
  // TOUCH HANDLERS
  // ========================================
  const handleTouchStart = useCallback((e) => {
    const fingerCount = e.touches.length;
    fingerCountRef.current = fingerCount;

    if (fingerCount === 2 || fingerCount === 3) {
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
    
    // Only process if finger count matches what we started with
    if (fingerCount !== fingerCountRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();

    const center = getTouchCenter(e.touches);

    // ========================================
    // 2 FINGERS - Volume + Fullscreen + Folder Nav
    // ========================================
    if (fingerCount === 2 && touchStartY !== null && initialPinchDistance !== null) {
      const currentDistance = getTouchDistance(e.touches);
      const distanceChange = currentDistance - initialPinchDistance;

      const deltaX = center.x - touchStartX;
      const deltaY = center.y - touchStartY;

      // PINCH/SPREAD detection - 50px threshold
      if (Math.abs(distanceChange) > 50) {
        if (distanceChange > 0) {
          // Spread = enter fullscreen
          callbacks.onSpread?.();
        } else {
          // Pinch = exit fullscreen
          callbacks.onPinch?.();
        }

        // Reset
        setInitialPinchDistance(null);
        setTouchStartY(null);
        setTouchStartX(null);
        gestureActiveRef.current = false;
      }
      // SWIPE detection - horizontal movement > 60px, dominant axis
      else if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX > 0) {
          // Swipe Right = Next folder
          callbacks.onFolderNext?.();
        } else {
          // Swipe Left = Previous folder
          callbacks.onFolderPrev?.();
        }

        // Reset
        setInitialPinchDistance(null);
        setTouchStartY(null);
        setTouchStartX(null);
        gestureActiveRef.current = false;
      }
      // VOLUME - vertical movement (if not pinching or swiping)
      else {
        const volumeChange = (touchStartY - center.y) / 200;
        const newVolume = Math.max(0, Math.min(1, initialVolume + volumeChange));
        
        setVolume(newVolume);
        callbacks.onVolumeChange?.(newVolume);
      }
    }

    // ========================================
    // 3 FINGERS - OTT Sidebar control
    // ========================================
    if (fingerCount === 3 && touchStartX !== null && touchStartY !== null) {
      const currentDistance = getTouchDistance(e.touches);
      const distanceChange = initialPinchDistance ? currentDistance - initialPinchDistance : 0;
      
      const deltaX = center.x - touchStartX;
      const deltaY = center.y - touchStartY;

      // SWIPE detection - horizontal movement > 60px
      if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) {
          // Swipe Right = Open OTT sidebar
          callbacks.onOTTOpen?.();
        } else {
          // Swipe Left = Close OTT sidebar
          callbacks.onOTTClose?.();
        }

        // Reset
        setInitialPinchDistance(null);
        setTouchStartY(null);
        setTouchStartX(null);
        gestureActiveRef.current = false;
      }
      // PINCH/SPREAD detection - 50px threshold
      else if (Math.abs(distanceChange) > 50) {
        if (distanceChange > 0) {
          // 3-finger Spread = Close OTT sidebar
          callbacks.onOTTClose?.();
        } else {
          // 3-finger Pinch = Open OTT sidebar
          callbacks.onOTTOpen?.();
        }

        // Reset
        setInitialPinchDistance(null);
        setTouchStartY(null);
        setTouchStartX(null);
        gestureActiveRef.current = false;
      }
    }
  }, [touchStartY, touchStartX, initialPinchDistance, initialVolume, getTouchDistance, getTouchCenter, callbacks]);

  const handleTouchEnd = useCallback(() => {
    gestureActiveRef.current = false;
    fingerCountRef.current = 0;
    setTouchStartY(null);
    setTouchStartX(null);
    setInitialPinchDistance(null);
  }, []);

  // ========================================
  // ATTACH HANDLERS TO CONTAINER
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
  // RETURN HOOK VALUES
  // ========================================
  return {
    orientation,
    isInvertedGravity,
    volume,
    touchStartY,
    initialPinchDistance,
    gestureActive: gestureActiveRef.current,
  };
};

export default useGestures;
