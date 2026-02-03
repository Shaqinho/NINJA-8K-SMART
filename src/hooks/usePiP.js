import { useState, useCallback, useEffect } from 'react';

export const usePiP = (videoRef) => {
  const [isPiP, setIsPiP] = useState(false);
  const [supported, setSupported] = useState(false);

  // Check PiP support
  useEffect(() => {
    setSupported('pictureInPictureEnabled' in document);
  }, []);

  // Enter PiP
  const enterPiP = useCallback(async () => {
    try {
      if (videoRef?.current && document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch (err) {
      console.error('PiP error:', err);
    }
  }, [videoRef]);

  // Exit PiP
  const exitPiP = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      }
    } catch (err) {
      console.error('Exit PiP error:', err);
    }
  }, []);

  // Toggle PiP
  const togglePiP = useCallback(() => {
    isPiP ? exitPiP() : enterPiP();
  }, [isPiP, enterPiP, exitPiP]);

  // Listen for PiP events
  useEffect(() => {
    const video = videoRef?.current;
    if (!video) return;

    const onEnterPiP = () => setIsPiP(true);
    const onLeavePiP = () => setIsPiP(false);

    video.addEventListener('enterpictureinpicture', onEnterPiP);
    video.addEventListener('leavepictureinpicture', onLeavePiP);

    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterPiP);
      video.removeEventListener('leavepictureinpicture', onLeavePiP);
    };
  }, [videoRef]);

  return {
    isPiP,
    supported,
    enterPiP,
    exitPiP,
    togglePiP,
  };
};

export default usePiP;
