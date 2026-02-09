import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAndStoreEPG, getProgramsForChannel } from '../../database/ProgramQueries';

// ============================================================================
// EPG GRID FULLSCREEN - Timeline view for all channels in folder
// 
// Features:
// - Fullscreen modal overlay
// - Timeline: 12-24 hours horizontal scroll
// - All channels in folder (vertical scroll)
// - Click program → details
// - Navigation: -2h, NOW, +2h buttons
// - Auto-scroll to current time
// ============================================================================

const EPGGrid = ({ folder, xtreamService, onClose }) => {
  const [channels, setChannels] = useState([]);
  const [epgData, setEpgData] = useState({}); // { streamId: [programs] }
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [timeOffset, setTimeOffset] = useState(0); // Hours offset from NOW
  
  const gridRef = useRef(null);
  
  // ========== LOAD FOLDER CHANNELS ==========
  useEffect(() => {
    const loadChannels = async () => {
      if (!folder || !xtreamService) return;
      
      setLoading(true);
      
      try {
        const categoryId = folder.category_id || folder.id;
        const streams = await xtreamService.getLiveStreams(categoryId);
        
        setChannels(streams || []);
      } catch (err) {
        console.error('❌ Failed to load channels:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadChannels();
  }, [folder, xtreamService]);
  
  // ========== LOAD EPG FOR ALL CHANNELS ==========
  useEffect(() => {
    const loadAllEPG = async () => {
      if (channels.length === 0 || !xtreamService) return;
      
      const newEpgData = {};
      
      // Load EPG for each channel (limit to first 20 channels for performance)
      const channelsToLoad = channels.slice(0, 20);
      
      for (const channel of channelsToLoad) {
        try {
          const streamId = channel.stream_id || channel.id;
          
          // Try to get from DB first
          let programs = await getProgramsForChannel(streamId, true);
          
          // If empty, fetch
          if (programs.length === 0) {
            await fetchAndStoreEPG(xtreamService, streamId, 4);
            programs = await getProgramsForChannel(streamId, true);
          }
          
          newEpgData[streamId] = programs;
        } catch (err) {
          console.warn(`⚠️ Failed to load EPG for channel ${channel.name}`);
        }
      }
      
      setEpgData(newEpgData);
    };
    
    loadAllEPG();
  }, [channels, xtreamService]);
  
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
  
  // ========== NAVIGATION ==========
  const handleNavigate = (hours) => {
    setTimeOffset(prev => prev + hours);
  };
  
  const handleGoToNow = () => {
    setTimeOffset(0);
  };
  
  // ========== GET PROGRAM FOR TIME SLOT ==========
  const getProgramAtTime = (streamId, slotTimestamp) => {
    const programs = epgData[streamId] || [];
    const slotEnd = slotTimestamp + 3600; // +1 hour
    
    return programs.find(prog => 
      prog.start_time <= slotTimestamp && prog.end_time > slotTimestamp
    );
  };
  
  // ========== RENDER ==========
  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>
            📊 GRILLE EPG - {folder?.category_name || 'Dossier'}
          </h2>
          
          {/* Navigation */}
          <div style={styles.nav}>
            <button style={styles.navBtn} onClick={() => handleNavigate(-2)}>
              ◀ -2h
            </button>
            <button style={{...styles.navBtn, ...styles.navBtnNow}} onClick={handleGoToNow}>
              NOW
            </button>
            <button style={styles.navBtn} onClick={() => handleNavigate(2)}>
              +2h ▶
            </button>
          </div>
          
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        
        {/* Grid */}
        <div style={styles.grid} ref={gridRef}>
          {loading ? (
            <div style={styles.loading}>⏳ Chargement...</div>
          ) : (
            <>
              {/* Timeline Header */}
              <div style={styles.timeline}>
                <div style={styles.timelineChannelLabel}>Chaîne</div>
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
                {channels.slice(0, 20).map((channel) => {
                  const streamId = channel.stream_id || channel.id;
                  
                  return (
                    <div key={streamId} style={styles.gridRow}>
                      {/* Channel name */}
                      <div style={styles.gridCellChannel}>
                        <div style={styles.gridChannelName}>
                          {channel.name}
                        </div>
                      </div>
                      
                      {/* Programs */}
                      {timeSlots.map((slot, idx) => {
                        const program = getProgramAtTime(streamId, slot.timestamp);
                        const now = Math.floor(Date.now() / 1000);
                        const isLive = program && program.start_time <= now && program.end_time > now;
                        
                        return (
                          <div 
                            key={idx}
                            style={{
                              ...styles.gridCellProgram,
                              ...(isLive ? styles.gridCellProgramLive : {})
                            }}
                          >
                            {program ? (
                              <>
                                <div style={styles.gridProgramTitle}>
                                  {isLive && '🔴 '}
                                  {program.title || 'Sans titre'}
                                </div>
                                <div style={styles.gridProgramTime}>
                                  {formatTimeShort(program.start_time)} - {formatTimeShort(program.end_time)}
                                </div>
                              </>
                            ) : (
                              <div style={styles.gridProgramEmpty}>—</div>
                            )}
                          </div>
                        );
                      })}
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
            {channels.length} chaînes • {Object.keys(epgData).length} avec EPG
          </span>
          <span style={styles.footerText}>
            Scroll horizontal: Timeline • Scroll vertical: Chaînes
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
    background: '#1a1a1a',
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #333',
  },
  
  // Header
  header: {
    padding: '20px',
    background: '#141414',
    borderBottom: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
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
  },
  navBtnNow: {
    background: 'rgba(34, 197, 94, 0.2)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
    fontWeight: 600,
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
    background: '#0f0f0f',
  },
  timeline: {
    display: 'flex',
    position: 'sticky',
    top: 0,
    background: '#141414',
    borderBottom: '1px solid #333',
    zIndex: 10,
  },
  timelineChannelLabel: {
    minWidth: '150px',
    width: '150px',
    padding: '12px',
    fontWeight: 600,
    fontSize: '12px',
    color: '#fff',
    borderRight: '1px solid #333',
    position: 'sticky',
    left: 0,
    background: '#141414',
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
    borderBottom: '1px solid #1a1a1a',
  },
  gridCellChannel: {
    minWidth: '150px',
    width: '150px',
    padding: '12px',
    background: '#141414',
    borderRight: '1px solid #333',
    position: 'sticky',
    left: 0,
    zIndex: 5,
  },
  gridChannelName: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  gridCellProgram: {
    minWidth: '200px',
    padding: '12px',
    borderRight: '1px solid #1a1a1a',
    background: '#0f0f0f',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  gridCellProgramLive: {
    background: 'rgba(34, 197, 94, 0.05)',
    border: '1px solid rgba(34, 197, 94, 0.2)',
  },
  gridProgramTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '4px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  gridProgramTime: {
    fontSize: '10px',
    color: '#666',
  },
  gridProgramEmpty: {
    fontSize: '12px',
    color: '#444',
    textAlign: 'center',
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
    background: '#141414',
    borderTop: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: '11px',
    color: '#666',
  },
};

export default EPGGrid;
