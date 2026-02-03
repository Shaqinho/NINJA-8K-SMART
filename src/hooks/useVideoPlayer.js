import { useState, useRef, useCallback, useEffect } from 'react';

export const useVideoPlayer = (initialSrc = null) => {
  const videoRef = useRef(null);
  const [state, setState] = useState({
    playing: false,
    paused: true,
    muted: false,
    volume: 1,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    fullscreen: false,
    loading: true,
    error: null,
    playbackRate: 1,
    aspectRatio: 'auto', // auto, 16:9, 4:3, fill
  });

  const [src, setSrc] = useState(initialSrc);

  // Play
  const play = useCallback(async () => {
    try {
      await videoRef.current?.play();
      setState(s => ({ ...s, playing: true, paused: false }));
    } catch (err) {
      setState(s => ({ ...s, error: err.message }));
    }
  }, []);

  // Pause
  const pause = useCallback(() => {
    videoRef.current?.pause();
    setState(s => ({ ...s, playing: false, paused: true }));
  }, []);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    state.paused ? play() : pause();
  }, [state.paused, play, pause]);

  // Seek
  const seek = useCallback((time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setState(s => ({ ...s, currentTime: time }));
    }
  }, []);

  // Seek relative (forward/backward)
  const seekRelative = useCallback((delta) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + delta));
      seek(newTime);
    }
  }, [seek]);

  // Set volume
  const setVolume = useCallback((vol) => {
    if (videoRef.current) {
      videoRef.current.volume = vol;
      setState(s => ({ ...s, volume: vol, muted: vol === 0 }));
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setState(s => ({ ...s, muted: !s.muted }));
    }
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await videoRef.current?.parentElement?.requestFullscreen();
        setState(s => ({ ...s, fullscreen: true }));
      } else {
        await document.exitFullscreen();
        setState(s => ({ ...s, fullscreen: false }));
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  // Set playback rate
  const setPlaybackRate = useCallback((rate) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setState(s => ({ ...s, playbackRate: rate }));
    }
  }, []);

  // Set aspect ratio
  const setAspectRatio = useCallback((ratio) => {
    setState(s => ({ ...s, aspectRatio: ratio }));
  }, []);

  // Change source
  const changeSrc = useCallback((newSrc) => {
    setSrc(newSrc);
    setState(s => ({ ...s, loading: true, error: null, currentTime: 0 }));
  }, []);

  // Video event handlers
  const onTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setState(s => ({ ...s, currentTime: videoRef.current.currentTime }));
    }
  }, []);

  const onLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setState(s => ({ ...s, duration: videoRef.current.duration, loading: false }));
    }
  }, []);

  const onProgress = useCallback(() => {
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      const buffered = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      setState(s => ({ ...s, buffered }));
    }
  }, []);

  const onWaiting = useCallback(() => setState(s => ({ ...s, loading: true })), []);
  const onCanPlay = useCallback(() => setState(s => ({ ...s, loading: false })), []);
  const onError = useCallback((e) => setState(s => ({ ...s, error: 'Video failed to load', loading: false })), []);
  const onEnded = useCallback(() => setState(s => ({ ...s, playing: false, paused: true })), []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setState(s => ({ ...s, fullscreen: !!document.fullscreenElement }));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return {
    videoRef,
    src,
    state,
    actions: {
      play,
      pause,
      togglePlay,
      seek,
      seekRelative,
      setVolume,
      toggleMute,
      toggleFullscreen,
      setPlaybackRate,
      setAspectRatio,
      changeSrc,
    },
    events: {
      onTimeUpdate,
      onLoadedMetadata,
      onProgress,
      onWaiting,
      onCanPlay,
      onError,
      onEnded,
    },
  };
};

export default useVideoPlayer;
