import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// USE GESTURES - Centralized gesture handler with absolute priority
// All touch events captured here BEFORE reaching other layers
// Handles: 2-finger volume, pinch/spread fullscreen, orientation detection
// ============================================================================

export const useGestures = (containerRef, callbacks = {}) => {
  // States
  const [touchStartY, setTouchStartY] = useState(null);
  const [initialPinchDistance, setInitialPinchDistance] = useState(null);
  const [initialVolume, setInitialVolume] = useState(1);
  const [orientation, setOrientation] = useState(0);
  const [isInvertedGravity, setIsInvertedGravity] = useState(false);
  const [volume, setVolume] = useState(1);

  // Refs to prevent memory leaks
  const gestureActiveRef = useRef(false);
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
      
      console.log('🔄 Orientation changed:', angle, 'Inverted gravity:', angle === 180 || angle === 270);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    handleOrientationChange(); // Initial check

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

  // ========================================
  // TOUCH HANDLERS - ABSOLUTE PRIORITY
  // ========================================
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      gestureActiveRef.current = true;
      const avgY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setTouchStartY(avgY);
      setInitialVolume(volume);
      setInitialPinchDistance(getTouchDistance(e.touches));
      
      console.log('👆 2-finger touch START, distance:', getTouchDistance(e.touches));
    }
  }, [volume, getTouchDistance]);

  const handleTouchMove = useCallback((e) => {
    if (!gestureActiveRef.current || e.touches.length !== 2) return;
    
    e.preventDefault(); // CRITICAL - prevent default behavior
    e.stopPropagation(); // CRITICAL - stop propagation to child elements

    if (touchStartY !== null && initialPinchDistance !== null) {
      const currentDistance = getTouchDistance(e.touches);
      const distanceChange = currentDistance - initialPinchDistance;

      console.log('👆 2-finger MOVE, distanceChange:', distanceChange, 'threshold: 50');

      // PINCH/SPREAD detection - 50px threshold
      if (Math.abs(distanceChange) > 50) {
        console.log('🎯 PINCH/SPREAD detected!', distanceChange > 0 ? 'SPREAD' : 'PINCH');
        
        // Spread = enter fullscreen
        if (distanceChange > 0) {
          callbacks.onSpread?.();
        }
        // Pinch = exit fullscreen
        else if (distanceChange < 0) {
          callbacks.onPinch?.();
        }

        // Reset to prevent multiple triggers
        setInitialPinchDistance(null);
        setTouchStartY(null);
        gestureActiveRef.current = false;
      }
      // VOLUME detection - vertical movement
      else {
        const avgY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const deltaY = touchStartY - avgY;
        const volumeChange = deltaY / 200;
        const newVolume = Math.max(0, Math.min(1, initialVolume + volumeChange));
        
        setVolume(newVolume);
        callbacks.onVolumeChange?.(newVolume);
        
        console.log('🔊 Volume gesture, deltaY:', deltaY, 'newVolume:', newVolume);
      }
    }
  }, [touchStartY, initialPinchDistance, initialVolume, getTouchDistance, callbacks]);

  const handleTouchEnd = useCallback(() => {
    gestureActiveRef.current = false;
    setTouchStartY(null);
    setInitialPinchDistance(null);
    
    console.log('👆 2-finger touch END');
  }, []);

  // ========================================
  // ATTACH HANDLERS TO CONTAINER
  // ========================================
  useEffect(() => {
    const container = containerRefInternal.current?.current;
    if (!container) return;

    // CRITICAL: passive: false allows preventDefault()
    const options = { passive: false, capture: true };

    container.addEventListener('touchstart', handleTouchStart, options);
    container.addEventListener('touchmove', handleTouchMove, options);
    container.addEventListener('touchend', handleTouchEnd, options);

    // Prevent default touch behaviors
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
