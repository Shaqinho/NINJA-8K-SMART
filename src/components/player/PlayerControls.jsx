import React from 'react';
import { THEME } from '../../constants/theme';

// ============================================================================
// PLAYER CONTROLS - Minimal version
// Small mode: Play/Pause + Fullscreen only (transparent background)
// Fullscreen mode: All controls
// Removed: Skip back/forward, Volume button (volume via gesture)
// ============================================================================

const ControlButton = ({ icon: Icon, active, onClick, size = 'md', label, minimal = false }) => {
  const sizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' };
  const iconSizes = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' };

  // Minimal mode = smaller, fully transparent background
  if (minimal) {
    return (
      <button
        onClick={onClick}
        className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
        style={{ background: 'transparent' }}
        title={label}
      >
        <div className="w-5 h-5 text-white" style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,1))' }}><Icon /></div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`${sizes[size]} rounded-full flex items-center justify-center transition-all active:scale-90`}
      style={{
        background: active ? THEME.gradients.primary : 'transparent',
      }}
      title={label}
    >
      <div className={`${iconSizes[size]} text-white`} style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,1))' }}><Icon /></div>
    </button>
  );
};

const Icons = {
  Play: () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>,
  Pause: () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>,
  SkipBack: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="19 20 9 12 19 4 19 20" /><line x1="5" y1="19" x2="5" y2="5" /></svg>,
  SkipForward: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" /></svg>,
  Volume: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>,
  VolumeMute: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>,
  Search: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>,
  Fullscreen: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>,
  ExitFullscreen: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>,
  MultiGrid: () => <svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
};

const formatTime = (seconds) => {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const PlayerControls = ({
  playing,
  muted = false,
  volume = 1,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onSeekRelative,
  onVolumeChange,
  onMuteToggle,
  onSearchEPG,
  onFullscreenToggle,
  onMultiGridToggle,
  hasMultiGrid = false,
  fullscreen = false,
  isLive = false,
  visible = true,
}) => {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // ===========================================
  // MINIMAL MODE (Small player - not fullscreen)
  // Play/Pause + Search EPG + Fullscreen
  // ===========================================
  if (!fullscreen) {
    return (
      <div
        className={`absolute bottom-0 left-0 right-0 p-3 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Minimal controls - transparent background */}
        <div className="flex items-center justify-between">
          {/* Left: Play/Pause only */}
          <ControlButton
            icon={playing ? Icons.Pause : Icons.Play}
            onClick={onPlayPause}
            label={playing ? 'Pause' : 'Play'}
            minimal
          />

          {/* Right: MultiGrid + Search EPG + Fullscreen */}
          <div className="flex items-center gap-2">
            {/* MultiGrid Button - only if has items */}
            {hasMultiGrid && onMultiGridToggle && (
              <ControlButton
                icon={Icons.MultiGrid}
                onClick={onMultiGridToggle}
                label="Multi-View"
                minimal
              />
            )}

            {/* Search EPG Button - for Live */}
            {isLive && onSearchEPG && (
              <ControlButton
                icon={Icons.Search}
                onClick={onSearchEPG}
                label="Search program"
                minimal
              />
            )}

            {/* Fullscreen */}
            <ControlButton
              icon={Icons.Fullscreen}
              onClick={onFullscreenToggle}
              label="Fullscreen"
              minimal
            />
          </div>
        </div>
      </div>
    );
  }

  // ===========================================
  // FULLSCREEN MODE - Full controls
  // ===========================================
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 p-4 transition-opacity duration-300 z-50 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      style={{
        background: 'transparent'
      }}
    >
      {/* Progress bar (VOD only) - Logique préservée */}
      {!isLive && (
        <div className="mb-4">
          <div
            className="h-1 rounded-full cursor-pointer group"
            style={{ background: 'transparent' }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              onSeek?.(percent * duration);
            }}
          >
            <div
              className="h-full rounded-full relative transition-all"
              style={{ width: `${progress}%`, background: THEME.gradients.primary }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-white/70 text-xs font-bold">{formatTime(currentTime)}</span>
            <span className="text-white/70 text-xs font-bold">{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {/* Full Controls */}
      <div className="flex items-center justify-between">
        {/* Left: Skip back + Play/Pause + Skip forward */}
        <div className="flex items-center gap-3">
          <ControlButton icon={Icons.SkipBack} onClick={() => onSeekRelative?.(-10)} label="Back 10s" />
          <ControlButton icon={playing ? Icons.Pause : Icons.Play} onClick={onPlayPause} size="lg" label={playing ? 'Pause' : 'Play'} />
          <ControlButton icon={Icons.SkipForward} onClick={() => onSeekRelative?.(10)} label="Forward 10s" />
        </div>

        {/* Right: MultiGrid + Search EPG + Exit Fullscreen */}
        <div className="flex items-center gap-3">
          {/* MultiGrid Button - only if has items */}
          {hasMultiGrid && onMultiGridToggle && (
            <ControlButton icon={Icons.MultiGrid} onClick={onMultiGridToggle} label="Multi-View" />
          )}

          {/* Search EPG Button - Only for Live */}
          {isLive && onSearchEPG && (
            <ControlButton icon={Icons.Search} onClick={onSearchEPG} label="Search program" />
          )}

          {/* Exit Fullscreen Button */}
          {onFullscreenToggle && (
            <ControlButton
              icon={Icons.ExitFullscreen}
              onClick={onFullscreenToggle}
              label="Exit Fullscreen"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerControls;
