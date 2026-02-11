import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAndStoreEPG, getProgramsForChannel } from '../../database/ProgramQueries';

// ============================================================================
// EPG GRID FULLSCREEN - Planby Style with Temporal Proportions
// 
// FEATURES:
// - Temporal proportions (width = duration, like Music Festival)
// - Position absolue calculée (left = start - baseTime)
// - 1 box per program (no split across cells)
// - Favorites filter
// - Fetch missing EPG
// - NOW line vertical
// - DPAD + 2-finger gestures
// 
// DPAD Controls:
// - F1 (Blue): Toggle EPGGrid open/close
// - F2 (Yellow): Toggle favorites filter
// - ArrowUp/Down: Navigate channels
// - ArrowLeft/Right: Timeline -2h/+2h
// - Enter short: Select channel & close
// - OK Long Press (2s): Toggle favorite on selected channel
// - Escape: Close
//
// Touch Gestures (2-fingers):
// - Swipe Right: Next folder
// - Swipe Left: Previous folder
// ============================================================================

const EPGGrid = ({ 
  folder, 
  xtreamService, 
  currentChannel,
  favorites = [],
  onChannelSelect,
  onToggleFavorite,
  onFolderNext,
  onFolderPrev,
  onClose 
}) => {
  const [channels, setChannels] = useState([]);
  const [epgData, setEpgData] = useState({}); // { streamId: [programs] }
  const [loading, setLoading] = useState(false);
  const [fetchingMissing, setFetchingMissing] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [timeOffset, setTimeOffset] = useState(0); // Hours offset from NOW
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedChannelIndex, setSelectedChannelIndex] = useState(0);
  
  const gridRef = useRef(null);
  const channelRefs = useRef({});
  const okPressTimerRef = useRef(null);
  const okLongPressedRef = useRef(false);
  
  // Touch gesture states
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const gestureActiveRef = useRef(false);
  
  // PLANBY CONFIG
  const HOUR_WIDTH = 200; // 1 hour = 200px
  const CHANNEL_HEIGHT = 80;
  
  // ========== LOAD FOLDER CHANNELS ==========
  useEffect(() => {
    const loadChannels = async () => {
      if (!folder || !xtreamService) return;
      
      setLoading(true);
      
      try {
        const categoryId = folder.category_id || folder.id;
        const streams = await xtreamService.getLiveStreams(categoryId);
        
        setChannels(streams || []);
        
        // Set initial selected channel
        if (currentChannel) {
          const idx = (streams || []).findIndex(ch => 
            (ch.stream_id || ch.id) === (currentChannel.stream_id || currentChannel.id)
          );
          if (idx >= 0) setSelectedChannelIndex(idx);
        }
      } catch (err) {
        console.error('Failed to load channels:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadChannels();
  }, [folder, xtreamService, currentChannel]);
  
  // ========== FILTERED CHANNELS ==========
  const filteredChannels = useCallback(() => {
    if (!showFavoritesOnly) return channels;
    return channels.filter(ch => 
      favorites.includes(ch.stream_id || ch.id)
    );
  }, [channels, showFavoritesOnly, favorites]);
  
  const visibleChannels = filteredChannels();
  
  // ========== LOAD EPG FOR VISIBLE CHANNELS ==========
  useEffect(() => {
    const loadAllEPG = async () => {
      if (visibleChannels.length === 0 || !xtreamService) return;
      
      const newEpgData = {};
      
      // Load EPG for visible channels (limit to first 30 for performance)
      const channelsToLoad = visibleChannels.slice(0, 30);
      
      for (const channel of channelsToLoad) {
        try {
          const streamId = channel.stream_id || channel.id;
          
          // Try to get from ninjalocaldb first
          let programs = await getProgramsForChannel(streamId, true);
          
          // If empty, fetch from XMLTV
          if (programs.length === 0) {
            await fetchAndStoreEPG(xtreamService, streamId, 4);
            programs = await getProgramsForChannel(streamId, true);
          }
          
          newEpgData[streamId] = programs;
        } catch (err) {
          console.warn(`Failed to load EPG for channel ${channel.name}`);
        }
      }
      
      setEpgData(newEpgData);
    };
    
    loadAllEPG();
  }, [visibleChannels, xtreamService]);
  
  // ========== FETCH MISSING EPG ==========
  const handleFetchMissingEPG = async () => {
    if (fetchingMissing || !xtreamService) return;
    
    setFetchingMissing(true);
    
    try {
      // Find channels with no EPG
      const missingChannels = visibleChannels.filter(ch => {
        const streamId = ch.stream_id || ch.id;
        return !epgData[streamId] || epgData[streamId].length === 0;
      });
      
      console.log(`Fetching EPG for ${missingChannels.length} channels...`);
      
      const newEpgData = { ...epgData };
      
      for (const channel of missingChannels) {
        try {
          const streamId = channel.stream_id || channel.id;
          await fetchAndStoreEPG(xtreamService, streamId, 4);
          const programs = await getProgramsForChannel(streamId, true);
          newEpgData[streamId] = programs;
        } catch (err) {
          console.warn(`Failed to fetch EPG for ${channel.name}`);
        }
      }
      
      setEpgData(newEpgData);
      console.log('EPG fetch complete');
    } catch (err) {
      console.error('Failed to fetch missing EPG:', err);
    } finally {
      setFetchingMissing(false);
    }
  };
  
  // ========== UPDATE CURRENT TIME ==========
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);
  
  // ========== GENERATE TIME SLOTS ==========
  const generateTimeSlots = useCallback(() => {
    const slots = [];
    const baseTime = new Date(currentTime);
    baseTime.setHours(baseTime.getHours() + timeOffset);
    baseTime.setMinutes(0);
    baseTime.setSeconds(0);
    baseTime.setMilliseconds(0);
    
    // Generate 12 hours (1-hour slots)
    for (let i = 0; i < 12; i++) {
      const slotTime = new Date(baseTime.getTime() + (i * 3600000));
      slots.push({
        time: slotTime,
        timestamp: Math.floor(slotTime.getTime() / 1000),
        label: `${String(slotTime.getHours()).padStart(2, '0')}:00`,
        isNow: i === 0 && timeOffset === 0,
      });
    }
    
    return slots;
  }, [currentTime, timeOffset]);
  
  const timeSlots = generateTimeSlots();
  
  // ========== CALCULATE BASE TIMESTAMP ==========
  const getBaseTimestamp = useCallback(() => {
    const baseTime = new Date(currentTime);
    baseTime.setHours(baseTime.getHours() + timeOffset);
    baseTime.setMinutes(0);
    baseTime.setSeconds(0);
    baseTime.setMilliseconds(0);
    return Math.floor(baseTime.getTime() / 1000);
  }, [currentTime, timeOffset]);
  
  // ========== NAVIGATION ==========
  const handleNavigate = (hours) => {
    setTimeOffset(prev => prev + hours);
  };
  
  const handleGoToNow = () => {
    setTimeOffset(0);
  };
  
  const handleToggleFavorites = () => {
    setShowFavoritesOnly(prev => !prev);
    setSelectedChannelIndex(0); // Reset selection
  };
  
  // ========== GET PROGRAMS FOR CHANNEL IN TIME RANGE ==========
  const getProgramsInRange = (streamId) => {
    const programs = epgData[streamId] || [];
    const baseTimestamp = getBaseTimestamp();
    const endTimestamp = baseTimestamp + (12 * 3600); // 12 hours
    
    // Filter programs that overlap with visible time range
    return programs.filter(prog => 
      prog.start_time < endTimestamp && prog.end_time > baseTimestamp
    );
  };
  
  // ========== CALCULATE PROGRAM POSITION & WIDTH (PLANBY STYLE) ==========
  const calculateProgramStyle = (program) => {
    const baseTimestamp = getBaseTimestamp();
    
    // Start position (seconds from base time)
    const startOffset = Math.max(0, program.start_time - baseTimestamp);
    const left = (startOffset / 3600) * HOUR_WIDTH;
    
    // Duration calculation
    const visibleStart = Math.max(program.start_time, baseTimestamp);
    const visibleEnd = Math.min(program.end_time, baseTimestamp + (12 * 3600));
    const visibleDuration = visibleEnd - visibleStart;
    const width = (visibleDuration / 3600) * HOUR_WIDTH;
    
    return { left, width };
  };
  
  // ========== 2-FINGER TOUCH GESTURES ==========
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      gestureActiveRef.current = true;
      const center = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      setTouchStartX(center.x);
      setTouchStartY(center.y);
    }
  }, []);
  
  const handleTouchMove = useCallback((e) => {
    if (!gestureActiveRef.current || e.touches.length !== 2) return;
    
    e.preventDefault();
    
    const center = {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
    };
    
    const deltaX = center.x - touchStartX;
    const deltaY = center.y - touchStartY;
    
    // Swipe horizontal
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX > 0) {
        onFolderNext?.();
      } else {
        onFolderPrev?.();
      }
      gestureActiveRef.current = false;
      setTouchStartX(null);
      setTouchStartY(null);
    }
  }, [touchStartX, touchStartY, onFolderNext, onFolderPrev]);
  
  const handleTouchEnd = useCallback(() => {
    gestureActiveRef.current = false;
    setTouchStartX(null);
    setTouchStartY(null);
  }, []);
  
  // ========== DPAD NAVIGATION ==========
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return;
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setSelectedChannelIndex(prev => Math.max(0, prev - 1));
          break;
        
        case 'ArrowDown':
          e.preventDefault();
          setSelectedChannelIndex(prev => Math.min(visibleChannels.length - 1, prev + 1));
          break;
        
        case 'ArrowLeft':
          e.preventDefault();
          handleNavigate(-2);
          break;
        
        case 'ArrowRight':
          e.preventDefault();
          handleNavigate(2);
          break;
        
        case 'Enter':
        case ' ':
          e.preventDefault();
          // Start long press timer
          okLongPressedRef.current = false;
          okPressTimerRef.current = setTimeout(() => {
            // Long press = toggle favorite
            okLongPressedRef.current = true;
            if (visibleChannels[selectedChannelIndex]) {
              const streamId = visibleChannels[selectedChannelIndex].stream_id || 
                             visibleChannels[selectedChannelIndex].id;
              onToggleFavorite?.(streamId);
            }
          }, 2000); // 2 seconds
          break;
        
        case 'Escape':
        case 'Backspace':
        case 'GoBack':
          e.preventDefault();
          onClose?.();
          break;
        
        case 'F2': // Yellow - Toggle favorites filter
        case 'ColorF1Yellow':
        case 'y':
        case 'Y':
          e.preventDefault();
          handleToggleFavorites();
          break;
        
        case 'F1': // Blue - Toggle EPGGrid
        case 'ColorF0Blue':
        case 'b':
        case 'B':
          e.preventDefault();
          onClose?.();
          break;
        
        default:
          break;
      }
    };
    
    const handleKeyUp = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        // Clear long press timer
        if (okPressTimerRef.current) {
          clearTimeout(okPressTimerRef.current);
          okPressTimerRef.current = null;
        }
        
        // If not long pressed = select channel
        if (!okLongPressedRef.current && visibleChannels[selectedChannelIndex]) {
          onChannelSelect?.(visibleChannels[selectedChannelIndex]);
        }
        
        okLongPressedRef.current = false;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (okPressTimerRef.current) clearTimeout(okPressTimerRef.current);
    };
  }, [selectedChannelIndex, visibleChannels, onChannelSelect, onClose, onToggleFavorite]);
  
  // ========== AUTO SCROLL TO SELECTED CHANNEL ==========
  useEffect(() => {
    const selectedRef = channelRefs.current[selectedChannelIndex];
    if (selectedRef) {
      selectedRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedChannelIndex]);
  
  // ========== ATTACH TOUCH HANDLERS ==========
  useEffect(() => {
    const container = gridRef.current;
    if (!container) return;
    
    const options = { passive: false };
    container.addEventListener('touchstart', handleTouchStart, options);
    container.addEventListener('touchmove', handleTouchMove, options);
    container.addEventListener('touchend', handleTouchEnd, options);
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);
  
  // ========== GET NOW LINE POSITION ==========
  const getNowLinePosition = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    const baseTimestamp = getBaseTimestamp();
    
    // Position relative to base time
    const offset = (now - baseTimestamp) / 3600; // Hours from base
    
    // Calculate position (200px channel column + offset)
    const position = 200 + (offset * HOUR_WIDTH);
    
    return position;
  }, [currentTime, timeOffset, getBaseTimestamp]);
  
  const nowLinePosition = getNowLinePosition();
  const showNowLine = timeOffset === 0 && nowLinePosition > 200; // Only show on NOW view
  
  // ========== RENDER ==========
  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>
            EPG GRID - {folder?.category_name || 'Folder'}
          </h2>
          
          {/* Favorites Toggle */}
          <button 
            style={{
              ...styles.navBtn,
              ...(showFavoritesOnly ? styles.navBtnActive : {})
            }}
            onClick={handleToggleFavorites}
          >
            {showFavoritesOnly ? 'All Channels' : 'Favorites Only'}
          </button>
          
          {/* Fetch Missing EPG */}
          <button 
            style={{
              ...styles.navBtn,
              ...(fetchingMissing ? { opacity: 0.5, cursor: 'not-allowed' } : {})
            }}
            onClick={handleFetchMissingEPG}
            disabled={fetchingMissing}
          >
            {fetchingMissing ? 'Fetching...' : 'Fetch Missing EPG'}
          </button>
          
          {/* Navigation */}
          <div style={styles.nav}>
            <button style={styles.navBtn} onClick={() => handleNavigate(-2)}>
              -2h
            </button>
            <button style={{...styles.navBtn, ...styles.navBtnNow}} onClick={handleGoToNow}>
              NOW
            </button>
            <button style={styles.navBtn} onClick={() => handleNavigate(2)}>
              +2h
            </button>
          </div>
          
          <button style={styles.closeBtn} onClick={onClose}>
            X
          </button>
        </div>
        
        {/* Grid */}
        <div style={styles.grid} ref={gridRef}>
          {loading ? (
            <div style={styles.loading}>Loading...</div>
          ) : visibleChannels.length === 0 ? (
            <div style={styles.loading}>
              {showFavoritesOnly ? 'No favorites in this folder' : 'No channels found'}
            </div>
          ) : (
            <>
              {/* NOW Line (vertical) */}
              {showNowLine && (
                <div style={{
                  ...styles.nowLine,
                  left: `${nowLinePosition}px`,
                }} />
              )}
              
              {/* Timeline Header */}
              <div style={styles.timeline}>
                <div style={styles.timelineChannelLabel}>Channel</div>
                {timeSlots.map((slot, idx) => (
                  <div 
                    key={idx}
                    style={{
                      ...styles.timelineSlot,
                      ...(slot.isNow ? styles.timelineSlotNow : {})
                    }}
                  >
                    {slot.label}
                  </div>
                ))}
              </div>
              
              {/* Channels Grid */}
              <div style={styles.gridBody}>
                {visibleChannels.map((channel, channelIdx) => {
                  const streamId = channel.stream_id || channel.id;
                  const isSelected = channelIdx === selectedChannelIndex;
                  const isFavorite = favorites.includes(streamId);
                  const programs = getProgramsInRange(streamId);
                  
                  return (
                    <div 
                      key={streamId} 
                      ref={el => channelRefs.current[channelIdx] = el}
                      style={{
                        ...styles.gridRow,
                        ...(isSelected ? styles.gridRowSelected : {})
                      }}
                      onClick={() => {
                        setSelectedChannelIndex(channelIdx);
                      }}
                    >
                      {/* Channel name */}
                      <div style={styles.gridCellChannel}>
                        <div style={styles.gridChannelName}>
                          {isFavorite && <span style={styles.favoriteStar}>* </span>}
                          {channel.name}
                        </div>
                      </div>
                      
                      {/* Programs Container - PLANBY STYLE */}
                      <div style={styles.programsContainer}>
                        {programs.map((program) => {
                          const style = calculateProgramStyle(program);
                          const now = Math.floor(Date.now() / 1000);
                          const isLive = program.start_time <= now && program.end_time > now;
                          
                          return (
                            <div 
                              key={program.id}
                              style={{
                                ...styles.programBox,
                                left: `${style.left}px`,
                                width: `${style.width}px`,
                                ...(isLive ? styles.programBoxLive : {}),
                                ...(isSelected ? styles.programBoxSelected : {})
                              }}
                            >
                              <div style={styles.programTitle}>
                                {isLive && 'LIVE '}
                                {program.title || 'Untitled'}
                              </div>
                              <div style={styles.programTime}>
                                {formatTimeShort(program.start_time)} - {formatTimeShort(program.end_time)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        
        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.footerText}>
            {visibleChannels.length} channels - {Object.keys(epgData).length} with EPG
            {showFavoritesOnly && ` - Favorites only`}
          </span>
          <span style={styles.footerText}>
            F1/Blue: Close - F2/Yellow: Filter - Up/Down: Navigate - Enter: Select - OK 2s: Favorite - ESC: Close
          </span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// HELPERS
// ============================================================================

const formatTimeShort = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  container: {
    width: '95vw',
    height: '95vh',
    background: 'transparent',
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #333',
  },
  
  // Header
  header: {
    padding: '20px',
    background: 'rgba(20,20,20,0.95)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    margin: 0,
    flex: 1,
    color: '#fff',
  },
  nav: {
    display: 'flex',
    gap: '8px',
  },
  navBtn: {
    padding: '8px 16px',
    background: 'rgba(98, 37, 255, 0.2)',
    border: '1px solid rgba(98, 37, 255, 0.4)',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  },
  navBtnNow: {
    background: 'rgba(34, 197, 94, 0.2)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
    fontWeight: 600,
  },
  navBtnActive: {
    background: 'rgba(255, 215, 0, 0.3)',
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '20px',
    width: '40px',
    height: '40px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  
  // Grid
  grid: {
    flex: 1,
    overflow: 'auto',
    background: 'transparent',
    position: 'relative',
  },
  
  // NOW Line (vertical)
  nowLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '2px',
    background: 'rgba(34, 197, 94, 0.8)',
    boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)',
    zIndex: 20,
    pointerEvents: 'none',
  },
  
  timeline: {
    display: 'flex',
    position: 'sticky',
    top: 0,
    background: 'rgba(20,20,20,0.95)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid #333',
    zIndex: 10,
  },
  timelineChannelLabel: {
    minWidth: '200px',
    width: '200px',
    padding: '12px',
    fontWeight: 600,
    fontSize: '12px',
    color: '#fff',
    borderRight: '1px solid #333',
    position: 'sticky',
    left: 0,
    background: 'rgba(20,20,20,0.95)',
    backdropFilter: 'blur(12px)',
    zIndex: 11,
  },
  timelineSlot: {
    minWidth: '200px',
    padding: '12px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#888',
    borderRight: '1px solid #222',
    fontWeight: 600,
  },
  timelineSlotNow: {
    background: 'rgba(34, 197, 94, 0.1)',
    color: '#22c55e',
  },
  
  // Grid Body
  gridBody: {
    minWidth: 'fit-content',
  },
  gridRow: {
    display: 'flex',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    cursor: 'pointer',
    transition: 'background 0.2s',
    height: '80px',
    position: 'relative',
  },
  gridRowSelected: {
    background: 'rgba(98, 37, 255, 0.15)',
    borderTop: '1px solid rgba(98, 37, 255, 0.4)',
    borderBottom: '1px solid rgba(98, 37, 255, 0.4)',
  },
  gridCellChannel: {
    minWidth: '200px',
    width: '200px',
    padding: '12px',
    background: 'rgba(20,20,20,0.8)',
    backdropFilter: 'blur(8px)',
    borderRight: '1px solid #333',
    position: 'sticky',
    left: 0,
    zIndex: 5,
    display: 'flex',
    alignItems: 'center',
  },
  gridChannelName: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  favoriteStar: {
    color: '#ffd700',
  },
  
  // PLANBY STYLE - Programs Container
  programsContainer: {
    position: 'relative',
    flex: 1,
    height: '100%',
  },
  
  // PLANBY STYLE - Program Box (temporal proportions)
  programBox: {
    position: 'absolute',
    top: '8px',
    bottom: '8px',
    borderRadius: '4px',
    background: 'linear-gradient(135deg, #002eb3, #002360)',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '8px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  programBoxLive: {
    background: 'linear-gradient(135deg, #2C7A7B, #234E52)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    boxShadow: '0 0 8px rgba(34, 197, 94, 0.2)',
  },
  programBoxSelected: {
    background: 'linear-gradient(135deg, #6225ff, #8b5cf6)',
    border: '1px solid rgba(98, 37, 255, 0.6)',
  },
  programTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '4px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  programTime: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.6)',
  },
  
  // Loading
  loading: {
    padding: '60px',
    textAlign: 'center',
    color: '#888',
    fontSize: '16px',
  },
  
  // Footer
  footer: {
    padding: '12px 20px',
    background: 'rgba(20,20,20,0.95)',
    backdropFilter: 'blur(12px)',
    borderTop: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '8px',
  },
  footerText: {
    fontSize: '11px',
    color: '#666',
  },
};

export default EPGGrid;
