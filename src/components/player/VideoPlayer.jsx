import React, { forwardRef, useEffect, useRef, useImperativeHandle, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { libVLC } from './libVLC';

export const getPlayerMode = () => localStorage.getItem('ninja_player_mode') || 'both';
export const setPlayerMode = (mode) => localStorage.setItem('ninja_player_mode', mode);

export const VideoPlayer = forwardRef(({ src, onTap, className = '', isFullScreen = false }, ref) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const isAndroid = Capacitor.getPlatform() === 'android';
  const [mode] = useState(getPlayerMode());
  const useNative = isAndroid && (mode === 'libvlc' || mode === 'exoplayer' || mode === 'both');

  const updatePos = useCallback(() => {
    if (!useNative || !containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    libVLC.setPosition(
      Math.round(r.top), Math.round(r.left),
      Math.round(r.width), Math.round(r.height)
    );
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
        libVLC.setVolume(vol);  // Trigger immediately, no await blocking
      } else {
        if (videoRef.current) videoRef.current.volume = vol;
      }
    },
    getVideoElement: () => videoRef.current
  }));

  // Position update on resize
  useEffect(() => {
    if (useNative) {
      const timer = setTimeout(updatePos, 150);
      window.addEventListener('resize', updatePos);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updatePos);
      };
    }
  }, [useNative, updatePos]);

  // AUTO-PLAY when src changes (CRITICAL for native player)
  useEffect(() => {
    if (useNative && src) {
      console.log('[VideoPlayer] Native auto-play:', src);
      libVLC.play(src);
    }

    return () => {
      if (useNative) {
        libVLC.stop();
      }
    };
  }, [useNative, src]);

  // FULLSCREEN sync with native player
  useEffect(() => {
    if (useNative) {
      libVLC.setFullscreen(isFullScreen);
      setTimeout(updatePos, 100);
    }
  }, [useNative, isFullScreen, updatePos]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
      onClick={onTap}
      style={{ background: 'transparent' }}
    >
      {!useNative && (
        <video ref={videoRef} src={src} className="w-full h-full object-contain" playsInline autoPlay />
      )}
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;
