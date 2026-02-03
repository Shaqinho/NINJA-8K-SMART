import { useState, useCallback, useMemo } from 'react';

export const useTimeshift = (serverConfig) => {
  const [timeshiftState, setTimeshiftState] = useState({
    enabled: false,
    isLive: true,
    currentOffset: 0, // seconds behind live
    maxOffset: 7200,  // max 2 hours back (server dependent)
    startTime: null,
    pausedAt: null,
  });

  // Build timeshift URL
  // Format: /timeshift/{username}/{password}/{duration}/{start}/{stream_id}.ts
  const buildTimeshiftUrl = useCallback((streamId, offsetSeconds) => {
    if (!serverConfig) return null;
    const { server, username, password } = serverConfig;
    const duration = Math.ceil(offsetSeconds / 60); // Convert to minutes
    const start = new Date(Date.now() - offsetSeconds * 1000);
    const startStr = start.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    
    return `${server}/timeshift/${username}/${password}/${duration}/${startStr}/${streamId}.ts`;
  }, [serverConfig]);

  // Build catchup/archive URL
  // Format: /streaming/timeshift.php?username={}&password={}&stream={}&start={}&duration={}
  const buildCatchupUrl = useCallback((streamId, startTime, duration) => {
    if (!serverConfig) return null;
    const { server, username, password } = serverConfig;
    const startStr = Math.floor(startTime.getTime() / 1000);
    
    return `${server}/streaming/timeshift.php?username=${username}&password=${password}&stream=${streamId}&start=${startStr}&duration=${duration}`;
  }, [serverConfig]);

  // Enable timeshift mode
  const enableTimeshift = useCallback(() => {
    setTimeshiftState(s => ({
      ...s,
      enabled: true,
      startTime: new Date(),
    }));
  }, []);

  // Disable timeshift (back to pure live)
  const disableTimeshift = useCallback(() => {
    setTimeshiftState(s => ({
      ...s,
      enabled: false,
      isLive: true,
      currentOffset: 0,
      startTime: null,
      pausedAt: null,
    }));
  }, []);

  // Pause live (start timeshift)
  const pauseLive = useCallback(() => {
    setTimeshiftState(s => ({
      ...s,
      enabled: true,
      isLive: false,
      pausedAt: new Date(),
    }));
  }, []);

  // Seek in timeshift
  const seekTimeshift = useCallback((offsetSeconds) => {
    const clampedOffset = Math.max(0, Math.min(timeshiftState.maxOffset, offsetSeconds));
    setTimeshiftState(s => ({
      ...s,
      currentOffset: clampedOffset,
      isLive: clampedOffset === 0,
    }));
  }, [timeshiftState.maxOffset]);

  // Seek relative
  const seekRelative = useCallback((deltaSeconds) => {
    seekTimeshift(timeshiftState.currentOffset + deltaSeconds);
  }, [timeshiftState.currentOffset, seekTimeshift]);

  // Jump to live
  const jumpToLive = useCallback(() => {
    setTimeshiftState(s => ({
      ...s,
      isLive: true,
      currentOffset: 0,
      pausedAt: null,
    }));
  }, []);

  // Get current timeshift time
  const getCurrentTime = useMemo(() => {
    if (timeshiftState.isLive) return new Date();
    return new Date(Date.now() - timeshiftState.currentOffset * 1000);
  }, [timeshiftState.isLive, timeshiftState.currentOffset]);

  // Format time offset for display
  const formatOffset = useCallback((seconds) => {
    const absSeconds = Math.abs(seconds);
    const h = Math.floor(absSeconds / 3600);
    const m = Math.floor((absSeconds % 3600) / 60);
    const s = absSeconds % 60;
    
    if (h > 0) return `-${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `-${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  return {
    ...timeshiftState,
    getCurrentTime,
    buildTimeshiftUrl,
    buildCatchupUrl,
    enableTimeshift,
    disableTimeshift,
    pauseLive,
    seekTimeshift,
    seekRelative,
    jumpToLive,
    formatOffset,
  };
};

export default useTimeshift;
