import { useState, useCallback, useEffect } from 'react';

export const useCast = () => {
  const [castState, setCastState] = useState({
    available: false,
    connected: false,
    deviceName: null,
    type: null, // 'chromecast' | 'airplay'
  });

  // Check Cast availability
  useEffect(() => {
    // Google Cast
    const checkChromecast = () => {
      if (window.chrome && window.chrome.cast) {
        setCastState(s => ({ ...s, available: true }));
      }
    };

    // AirPlay (Safari)
    const checkAirPlay = () => {
      const video = document.createElement('video');
      if (video.webkitShowPlaybackTargetPicker) {
        setCastState(s => ({ ...s, available: true }));
      }
    };

    // Check after a delay for Cast SDK to load
    setTimeout(() => {
      checkChromecast();
      checkAirPlay();
    }, 1000);

    // Listen for Cast state changes
    window['__onGCastApiAvailable'] = (isAvailable) => {
      if (isAvailable) {
        setCastState(s => ({ ...s, available: true }));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start casting (Chromecast)
  const startChromecast = useCallback(async (mediaUrl, title, thumbnail) => {
    if (!window.chrome?.cast) return;

    try {
      const session = await new Promise((resolve, reject) => {
        window.chrome.cast.requestSession(resolve, reject);
      });

      const mediaInfo = new window.chrome.cast.media.MediaInfo(mediaUrl, 'video/mp4');
      mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
      mediaInfo.metadata.title = title;
      if (thumbnail) mediaInfo.metadata.images = [{ url: thumbnail }];

      const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
      await session.loadMedia(request);

      setCastState(s => ({
        ...s,
        connected: true,
        deviceName: session.receiver.friendlyName,
        type: 'chromecast',
      }));
    } catch (err) {
      console.error('Chromecast error:', err);
    }
  }, []);

  // Start AirPlay
  const startAirPlay = useCallback((videoElement) => {
    if (videoElement?.webkitShowPlaybackTargetPicker) {
      videoElement.webkitShowPlaybackTargetPicker();
    }
  }, []);

  // Stop casting
  const stopCasting = useCallback(() => {
    if (window.chrome?.cast?.Session) {
      const session = window.chrome.cast.Session;
      if (session) session.stop();
    }
    setCastState(s => ({ ...s, connected: false, deviceName: null, type: null }));
  }, []);

  // Open cast picker
  const openCastPicker = useCallback((videoElement, mediaUrl, title, thumbnail) => {
    // Try Chromecast first, then AirPlay
    if (window.chrome?.cast) {
      startChromecast(mediaUrl, title, thumbnail);
    } else if (videoElement?.webkitShowPlaybackTargetPicker) {
      startAirPlay(videoElement);
    }
  }, [startChromecast, startAirPlay]);

  return {
    ...castState,
    startChromecast,
    startAirPlay,
    stopCasting,
    openCastPicker,
  };
};

export default useCast;
