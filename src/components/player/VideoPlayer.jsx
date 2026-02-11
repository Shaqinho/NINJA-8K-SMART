import React, { forwardRef, useEffect, useRef, useImperativeHandle, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { libVLC } from './libVLC';
import ParticleThemes from '../ParticleThemes';

export const getPlayerMode = () => localStorage.getItem('ninja_player_mode') || 'both';
export const setPlayerMode = (mode) => localStorage.setItem('ninja_player_mode', mode);

export const VideoPlayer = forwardRef(({ src, onTap, className = '', isFullScreen = false, aspectRatio = 'auto' }, ref) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const isAndroid = Capacitor.getPlatform() === 'android';
  const [mode] = useState(getPlayerMode());
  const useNative = isAndroid && (mode === 'libvlc' || mode === 'exoplayer' || mode === 'both');
  const prevFullscreenRef = useRef(isFullScreen);

  const updatePos = useCallback(() => {
    if (!useNative || !containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    
    // Only update if we have valid dimensions
    if (r.width > 0 && r.height > 0) {
      console.log('[VideoPlayer] updatePos:', r.top, r.left, r.width, r.height);
      libVLC.setPosition(
        Math.round(r.top), Math.round(r.left),
        Math.round(r.width), Math.round(r.height)
      );
    }
  }, [useNative]);

  useImperativeHandle(ref, () => ({
    updatePosition: updatePos,
    play: async (url) => {
      if (useNative) await libVLC.play(url);
      else if (videoRef.current) { videoRef.current.src = url; videoRef.current.play(); }
    },
    pause: () => useNative ? libVLC.pause() : videoRef.current?.pause(),
    stop: () => useNative ? libVLC.stop() : null,
    setVolume: (vol) => {
      if (useNative) {
        libVLC.setVolume(vol);
      } else {
        if (videoRef.current) videoRef.current.volume = vol;
      }
    },
    getVideoElement: () => videoRef.current,

    /**
     * Probe stream: play 3s silently, extract audio/subtitle tracks, then pause
     * Returns { audioTracks: [{ id, name }], subtitleTracks: [{ id, name }] }
     */
    probeStream: async (url) => {
      try {
        if (useNative) {
          await libVLC.setVolume(0);
          await libVLC.play(url);
          await new Promise(r => setTimeout(r, 3000));
          const audio = await libVLC.getAudioTracks();
          const subs = await libVLC.getSubtitleTracks();
          await libVLC.pause();
          await libVLC.setVolume(0.5);
          return {
            audioTracks: audio?.tracks || [],
            subtitleTracks: subs?.tracks || [],
          };
        }
        return { audioTracks: [], subtitleTracks: [] };
      } catch (e) {
        console.error('[VideoPlayer] probeStream failed:', e);
        return { audioTracks: [], subtitleTracks: [] };
      }
    },

    getAudioTracks: async () => {
      if (useNative) return await libVLC.getAudioTracks();
      return { count: 0, tracks: [] };
    },
    getSubtitleTracks: async () => {
      if (useNative) return await libVLC.getSubtitleTracks();
      return { count: 0, tracks: [] };
    },
  }));

  // Position update on resize + ResizeObserver pour exit FS
  useEffect(() => {
    if (useNative) {
      const timer = setTimeout(updatePos, 150);
      window.addEventListener('resize', updatePos);
      
      // ResizeObserver pour détecter quand le container change de taille (exit FS via pinch)
      let resizeObserver = null;
      if (containerRef.current && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          setTimeout(updatePos, 50);
          setTimeout(updatePos, 150);
          setTimeout(updatePos, 300);
        });
        resizeObserver.observe(containerRef.current);
      }
      
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updatePos);
        if (resizeObserver) resizeObserver.disconnect();
      };
    }
  }, [useNative, updatePos]);

  // AUTO-PLAY when src changes
  useEffect(() => {
    if (useNative && src) {
      console.log('[VideoPlayer] Native auto-play:', src);
      libVLC.play(src);
      // Update position after play starts
      setTimeout(updatePos, 200);
    }

    return () => {
      if (useNative) {
        libVLC.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useNative, src]); // updatePos intentionally excluded — called inline, not as trigger

  // FULLSCREEN sync with native player - CRITICAL FIX
  useEffect(() => {
    if (!useNative) return;
    
    const wasFullscreen = prevFullscreenRef.current;
    prevFullscreenRef.current = isFullScreen;
    
    libVLC.setFullscreen(isFullScreen);
    
    // Exiting fullscreen needs more time for layout to stabilize
    if (wasFullscreen && !isFullScreen) {
      console.log('[VideoPlayer] Exiting fullscreen - scheduling position updates');
      // Multiple delays to catch layout stabilization
      setTimeout(updatePos, 100);
      setTimeout(updatePos, 200);
      setTimeout(updatePos, 300);
      setTimeout(updatePos, 500);
      setTimeout(updatePos, 800);
    } else {
      // Entering fullscreen or initial
      setTimeout(updatePos, 100);
      setTimeout(updatePos, 300);
    }
  }, [useNative, isFullScreen, updatePos]);

  // Get container style based on aspect ratio
  const getContainerStyle = () => {
    const baseStyle = { background: 'transparent' };
    
    if (aspectRatio === '16:9') {
      return { ...baseStyle, aspectRatio: '16/9' };
    } else if (aspectRatio === '1:1') {
      return { ...baseStyle, aspectRatio: '1/1' };
    } else {
      // 'auto' or 'fill' - use full container
      return baseStyle;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
      onClick={onTap}
      style={getContainerStyle()}
    >
      {/* Particles quand pas de vidéo */}
      {!src && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <ParticleThemes containerRef={containerRef} theme="soft" />
        </div>
      )}
      
      {!useNative && (
        <video 
          ref={videoRef} 
          src={src} 
          className="w-full h-full"
          style={{
            objectFit: aspectRatio === 'fill' ? 'cover' : 'contain',
            position: 'relative',
            zIndex: 1,
          }}
          playsInline 
          autoPlay 
        />
      )}
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;
