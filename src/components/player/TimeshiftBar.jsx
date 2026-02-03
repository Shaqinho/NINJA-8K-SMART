import React, { useState, useRef } from 'react';
import { THEME } from '../../constants/theme';

// ============================================================================
// TIMESHIFT BAR - Seek back in live stream
// ============================================================================

export const TimeshiftBar = ({
  enabled,
  isLive,
  currentOffset = 0,
  maxOffset = 7200,
  onSeek,
  onJumpToLive,
  visible = true,
}) => {
  const [dragging, setDragging] = useState(false);
  const barRef = useRef(null);

  const formatOffset = (seconds) => {
    if (seconds === 0) return 'LIVE';
    const absSeconds = Math.abs(seconds);
    const h = Math.floor(absSeconds / 3600);
    const m = Math.floor((absSeconds % 3600) / 60);
    const s = absSeconds % 60;
    if (h > 0) return `-${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `-${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = ((maxOffset - currentOffset) / maxOffset) * 100;

  const handleBarInteraction = (e) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const newOffset = Math.round(maxOffset * (1 - percent));
    onSeek?.(newOffset);
  };

  const markers = [];
  const markerInterval = maxOffset > 3600 ? 1800 : 900;
  for (let i = 0; i <= maxOffset; i += markerInterval) {
    markers.push({ offset: i, label: formatOffset(i), position: ((maxOffset - i) / maxOffset) * 100 });
  }

  if (!visible || !enabled) return null;

  return (
    <div className="px-4 py-3" style={{ background: 'linear-gradient(135deg, #6225FF 0%, #B85CFF 100%)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span className="text-white text-sm font-bold">Timeshift</span>
        </div>
        
        {!isLive && (
          <button onClick={onJumpToLive} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 transition-colors">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-xs font-bold">Jump to Live</span>
          </button>
        )}
      </div>

      <div 
        ref={barRef} 
        className="relative h-10 rounded-xl cursor-pointer" 
        style={{ background: 'transparent' }}
        onClick={handleBarInteraction}
        onMouseDown={() => setDragging(true)}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        onMouseMove={(e) => dragging && handleBarInteraction(e)}
        onTouchStart={() => setDragging(true)}
        onTouchEnd={() => setDragging(false)}
        onTouchMove={(e) => dragging && handleBarInteraction(e)}
      >
        {/* Markers */}
        <div className="absolute inset-0 flex items-end pb-1">
          {markers.map((marker) => (
            <div key={marker.offset} className="absolute bottom-0 flex flex-col items-center" style={{ left: `${marker.position}%`, transform: 'translateX(-50%)' }}>
              <div className="h-2 w-px bg-white/20" />
              <span className="text-[8px] text-gray-500 mt-0.5">{marker.label}</span>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div 
          className="absolute top-0 left-0 h-full rounded-xl transition-all" 
          style={{ width: `${progress}%`, background: `linear-gradient(90deg, rgba(98, 37, 255, 0.3), ${THEME.colors.primary})` }}
        />

        {/* Handle */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg shadow-purple-500/50 transition-all" 
          style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
        >
          <div className="absolute inset-1 rounded-full" style={{ background: THEME.gradients.primary }} />
        </div>

        {/* Current time label */}
        <div className="absolute top-0 -translate-y-full pb-1 transition-all" style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}>
          <div className="px-2 py-1 rounded-lg bg-purple-500 text-white text-xs font-bold">{formatOffset(currentOffset)}</div>
        </div>
      </div>

      {/* Quick seek buttons */}
      <div className="flex items-center justify-center gap-2 mt-3">
        {[-1800, -600, -60, 60, 600, 1800].map((delta) => (
          <button 
            key={delta} 
            onClick={() => onSeek?.(Math.max(0, Math.min(maxOffset, currentOffset - delta)))} 
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition-colors"
          >
            {delta > 0 ? '+' : ''}{Math.abs(delta) >= 60 ? `${Math.abs(delta) / 60}m` : `${Math.abs(delta)}s`}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TimeshiftBar;
