import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { THEME } from '../constants/theme';
import { ScreenOrientation } from '@capacitor/screen-orientation';

// ============================================================================
// GLASS CARD STYLE
// ============================================================================
const glassCard = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
};

// ============================================================================
// TIME HELPERS
// ============================================================================
const formatTime = (date) => {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (date) => {
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};

const getStartOfHour = (date) => {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
};

// ============================================================================
// EPG GRID COMPONENT - Forced Landscape Mode
// ============================================================================
const EPGGrid = ({
  visible,
  onClose,
  channels = [],
  epgData = {},
  onSelectChannel,
  onLoadEPG,
  isLoading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [startTime, setStartTime] = useState(() => getStartOfHour(new Date()));
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const gridRef = useRef(null);
  const channelListRef = useRef(null);

  // Responsive constants based on screen size
  const HOUR_WIDTH = Math.max(120, dimensions.width / 6); // ~6 hours visible
  const CHANNEL_HEIGHT = 60;
  const CHANNEL_COLUMN_WIDTH = Math.min(100, dimensions.width * 0.15);
  const VISIBLE_HOURS = 12;

  // ============================================================================
  // FORCE LANDSCAPE MODE
  // ============================================================================
  useEffect(() => {
    if (visible) {
      // Lock to landscape when opening
      const lockLandscape = async () => {
        try {
          await ScreenOrientation.lock({ orientation: 'landscape' });
          console.log('🔄 EPG: Locked to landscape');
        } catch (e) {
          console.log('ScreenOrientation not available:', e);
        }
      };
      lockLandscape();

      // Update dimensions
      const handleResize = () => {
        setDimensions({ width: window.innerWidth, height: window.innerHeight });
      };
      handleResize();
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [visible]);

  // Unlock orientation when closing
  const handleClose = useCallback(async () => {
    try {
      await ScreenOrientation.unlock();
      console.log('🔄 EPG: Unlocked orientation');
    } catch (e) {
      console.log('ScreenOrientation unlock failed:', e);
    }
    onClose?.();
  }, [onClose]);

  // Load EPG data on mount
  useEffect(() => {
    if (visible && onLoadEPG && Object.keys(epgData).length === 0) {
      onLoadEPG();
    }
  }, [visible, onLoadEPG, epgData]);

  // Filter channels based on search
  const filteredChannels = useMemo(() => {
    if (!searchQuery) return channels;
    const q = searchQuery.toLowerCase();
    return channels.filter(ch => ch.name?.toLowerCase().includes(q));
  }, [channels, searchQuery]);

  // Generate time slots
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let i = 0; i < VISIBLE_HOURS; i++) {
      const time = new Date(startTime.getTime() + i * 60 * 60 * 1000);
      slots.push(time);
    }
    return slots;
  }, [startTime, VISIBLE_HOURS]);

  // Navigate time
  const navigateTime = useCallback((hours) => {
    setStartTime(prev => new Date(prev.getTime() + hours * 60 * 60 * 1000));
  }, []);

  // Go to now
  const goToNow = useCallback(() => {
    setStartTime(getStartOfHour(new Date()));
  }, []);

  // Sync scroll
  const handleGridScroll = useCallback((e) => {
    if (channelListRef.current) {
      channelListRef.current.scrollTop = e.target.scrollTop;
    }
  }, []);

  // Handle program click
  const handleProgramClick = useCallback((channel, program) => {
    setSelectedProgram({ channel, program });
  }, []);

  // Play channel
  const handlePlayChannel = useCallback(async () => {
    if (selectedProgram?.channel) {
      // Unlock before navigating
      try {
        await ScreenOrientation.unlock();
      } catch (e) {}
      onSelectChannel?.(selectedProgram.channel);
      onClose?.();
    }
    setSelectedProgram(null);
  }, [selectedProgram, onSelectChannel, onClose]);

  // Get programs for a channel
  const getChannelPrograms = useCallback((channelId) => {
    const programs = epgData[channelId] || [];
    const endTime = new Date(startTime.getTime() + VISIBLE_HOURS * 60 * 60 * 1000);
    return programs.filter(prog => {
      const progStart = new Date(prog.start);
      const progEnd = new Date(prog.end);
      return progStart < endTime && progEnd > startTime;
    });
  }, [epgData, startTime, VISIBLE_HOURS]);

  // Calculate program position
  const getProgramStyle = useCallback((program) => {
    const progStart = new Date(program.start);
    const progEnd = new Date(program.end);
    const endTime = new Date(startTime.getTime() + VISIBLE_HOURS * 60 * 60 * 1000);
    
    const visibleStart = progStart < startTime ? startTime : progStart;
    const visibleEnd = progEnd > endTime ? endTime : progEnd;
    
    const startOffset = (visibleStart - startTime) / (60 * 60 * 1000);
    const duration = (visibleEnd - visibleStart) / (60 * 60 * 1000);
    
    const left = startOffset * HOUR_WIDTH;
    const width = Math.max(duration * HOUR_WIDTH - 2, 40);
    
    const now = new Date();
    const isLive = progStart <= now && progEnd > now;
    
    return { left, width, isLive };
  }, [startTime, HOUR_WIDTH, VISIBLE_HOURS]);

  if (!visible) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: THEME.colors.bg }}
    >
      {/* Header - Compact */}
      <div className="flex items-center gap-2 p-2 border-b border-white/10 flex-shrink-0">
        <button 
          onClick={handleClose}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 active:scale-95"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        
        <h1 className="text-white font-bold text-sm">Guide TV</h1>
        <span className="text-gray-400 text-xs">{formatDate(startTime)}</span>
        
        <div className="flex-1" />
        
        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher..."
          className="w-32 sm:w-40 bg-white/10 rounded-full px-3 py-1.5 text-white text-xs outline-none placeholder-gray-500"
        />
        
        {/* Time navigation */}
        <div className="flex items-center gap-1">
          <button 
            onClick={() => navigateTime(-3)}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-white/10 active:scale-95"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          
          <button 
            onClick={goToNow}
            className="px-2 py-1 rounded-full text-[10px] font-bold active:scale-95"
            style={{ background: THEME.gradients.primary, color: 'white' }}
          >
            NOW
          </button>
          
          <button 
            onClick={() => navigateTime(3)}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-white/10 active:scale-95"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-2 border-b border-white/10">
          <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mr-2" />
          <span className="text-gray-400 text-xs">Chargement...</span>
        </div>
      )}

      {/* Grid Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Channel Column */}
        <div 
          ref={channelListRef}
          className="flex-shrink-0 overflow-hidden border-r border-white/10"
          style={{ width: CHANNEL_COLUMN_WIDTH }}
        >
          {/* Time header spacer */}
          <div className="h-8 border-b border-white/10" style={{ background: 'rgba(0,0,0,0.5)' }} />
          
          {/* Channel list */}
          <div className="overflow-y-auto" style={{ height: 'calc(100% - 32px)' }}>
            {filteredChannels.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center gap-1 px-1 border-b border-white/5"
                style={{ height: CHANNEL_HEIGHT }}
              >
                <div className="w-8 h-6 rounded flex items-center justify-center overflow-hidden bg-white/5 flex-shrink-0">
                  {channel.logo ? (
                    <img 
                      src={channel.logo} 
                      alt="" 
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#6B7280">
                      <rect x="2" y="3" width="20" height="14" rx="2"/>
                    </svg>
                  )}
                </div>
                <span className="text-white text-[10px] font-medium truncate flex-1">
                  {channel.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Programs Grid */}
        <div className="flex-1 overflow-hidden">
          {/* Time header */}
          <div 
            className="h-8 border-b border-white/10 flex overflow-x-auto"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <div style={{ width: HOUR_WIDTH * VISIBLE_HOURS, display: 'flex' }}>
              {timeSlots.map((time, i) => (
                <div 
                  key={i}
                  className="flex-shrink-0 flex items-center px-2 border-l border-white/10 first:border-l-0"
                  style={{ width: HOUR_WIDTH }}
                >
                  <span className="text-gray-400 text-[10px] font-medium">
                    {formatTime(time)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Programs */}
          <div 
            ref={gridRef}
            className="overflow-auto"
            style={{ height: 'calc(100% - 32px)' }}
            onScroll={handleGridScroll}
          >
            <div style={{ width: HOUR_WIDTH * VISIBLE_HOURS }}>
              {filteredChannels.map((channel) => {
                const programs = getChannelPrograms(channel.epgChannelId || channel.id);
                
                return (
                  <div
                    key={channel.id}
                    className="relative border-b border-white/5"
                    style={{ height: CHANNEL_HEIGHT }}
                  >
                    {programs.length > 0 ? (
                      programs.map((program, i) => {
                        const style = getProgramStyle(program);
                        return (
                          <button
                            key={i}
                            onClick={() => handleProgramClick(channel, program)}
                            className={`absolute top-1 bottom-1 rounded px-1.5 py-0.5 overflow-hidden transition-all active:scale-[0.98] text-left ${
                              style.isLive ? 'ring-1 ring-purple-500' : ''
                            }`}
                            style={{
                              left: style.left,
                              width: style.width,
                              background: style.isLive 
                                ? 'rgba(98, 37, 255, 0.3)' 
                                : 'rgba(255, 255, 255, 0.08)',
                            }}
                          >
                            <p className="text-white text-[10px] font-medium truncate">
                              {program.title}
                            </p>
                            <p className="text-gray-500 text-[8px] truncate">
                              {formatTime(new Date(program.start))}
                            </p>
                          </button>
                        );
                      })
                    ) : (
                      <div 
                        className="absolute inset-1 rounded flex items-center justify-center"
                        style={{ background: 'rgba(255, 255, 255, 0.03)' }}
                      >
                        <span className="text-gray-600 text-[10px]">Pas de programme</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Now indicator */}
      {(() => {
        const now = new Date();
        const endTime = new Date(startTime.getTime() + VISIBLE_HOURS * 60 * 60 * 1000);
        if (now >= startTime && now <= endTime) {
          const offset = (now - startTime) / (60 * 60 * 1000) * HOUR_WIDTH;
          return (
            <div 
              className="absolute top-[72px] bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
              style={{ left: CHANNEL_COLUMN_WIDTH + offset }}
            />
          );
        }
        return null;
      })()}

      {/* Program Detail Modal */}
      {selectedProgram && (
        <div 
          className="absolute inset-0 z-60 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedProgram(null)}
        >
          <div 
            className="w-full max-w-sm rounded-xl p-4 space-y-3"
            style={glassCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-8 rounded bg-white/10 flex items-center justify-center overflow-hidden">
                {selectedProgram.channel.logo ? (
                  <img src={selectedProgram.channel.logo} alt="" className="max-w-full max-h-full object-contain"/>
                ) : null}
              </div>
              <div>
                <p className="text-white font-bold text-sm">{selectedProgram.channel.name}</p>
                <p className="text-gray-500 text-[10px]">
                  {formatTime(new Date(selectedProgram.program.start))} - {formatTime(new Date(selectedProgram.program.end))}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-white font-bold text-base">{selectedProgram.program.title}</h3>
              {selectedProgram.program.description && (
                <p className="text-gray-400 text-xs mt-1 line-clamp-3">{selectedProgram.program.description}</p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setSelectedProgram(null)}
                className="flex-1 py-2.5 rounded-lg bg-white/10 text-white font-bold text-sm active:scale-95"
              >
                Fermer
              </button>
              <button
                onClick={handlePlayChannel}
                className="flex-1 py-2.5 rounded-lg text-white font-bold text-sm active:scale-95"
                style={{ background: THEME.gradients.primary }}
              >
                Regarder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EPGGrid;
