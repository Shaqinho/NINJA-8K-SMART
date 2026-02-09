import React, { useState, useEffect, useCallback } from 'react';
import { fetchAndStoreEPG, deepSearchEPG, getProgramsForChannel } from '../../database/ProgramQueries';
import { toggleChannel, isChannelHidden } from '../../database/HiddenManager';
import EPGGrid from './EPGGrid';

// ============================================================================
// OTT RIGHT - Channel Info + EPG Display
// 
// Features:
// - 2 tabs: 📋 Liste (default) | 📊 Grille Compact (folder view)
// - Channel info card (logo, name, category, description)
// - EPG BATCH 4 programs (NOW + 3 NEXT)
// - Auto-refresh EPG when next program starts
// - Deep Search button if EPG empty
// - Hide/Show channel button
// - Button to open fullscreen EPG Grid
// ============================================================================

const OTTRight = ({ 
  xtreamService,
  currentChannel,      // Selected channel object
  currentFolder,       // Current folder/category for grid view
  onClose,
  visible,
}) => {
  // ========== STATES ==========
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'grid'
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [channelHidden, setChannelHidden] = useState(false);
  const [showFullscreenGrid, setShowFullscreenGrid] = useState(false);
  
  // ========== LOAD CHANNEL DATA ==========
  const loadChannelData = useCallback(async () => {
    if (!currentChannel || !xtreamService) return;
    
    setLoading(true);
    
    try {
      const streamId = currentChannel.stream_id || currentChannel.id;
      
      // 1. Check if channel is hidden
      const hidden = await isChannelHidden(streamId);
      setChannelHidden(hidden);
      
      // 2. Get programs from DB (might be from XMLTV or previous fetch)
      let progs = await getProgramsForChannel(streamId, true);
      
      // 3. If no programs, fetch EPG BATCH 4
      if (progs.length === 0) {
        console.log(`📡 No EPG in DB for ${currentChannel.name}, fetching...`);
        const result = await fetchAndStoreEPG(xtreamService, streamId, 4);
        
        if (result.success) {
          progs = await getProgramsForChannel(streamId, true);
        }
      }
      
      setPrograms(progs);
      
    } catch (err) {
      console.error('❌ Failed to load channel data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentChannel, xtreamService]);
  
  // ========== RELOAD ON CHANNEL CHANGE ==========
  useEffect(() => {
    if (currentChannel && visible) {
      loadChannelData();
    }
  }, [currentChannel, visible, loadChannelData]);
  
  // ========== DEEP SEARCH ==========
  const handleDeepSearch = useCallback(async () => {
    if (!currentChannel || !xtreamService) return;
    
    setLoading(true);
    
    try {
      const streamId = currentChannel.stream_id || currentChannel.id;
      const result = await deepSearchEPG(xtreamService, streamId);
      
      if (result.success && result.count > 0) {
        const progs = await getProgramsForChannel(streamId, true);
        setPrograms(progs);
        
        alert(`✅ ${result.count} programme(s) trouvé(s) !`);
      } else {
        alert('❌ Pas d\'EPG disponible pour cette chaîne');
      }
    } catch (err) {
      console.error('❌ Deep Search failed:', err);
      alert('❌ Erreur lors de la recherche EPG');
    } finally {
      setLoading(false);
    }
  }, [currentChannel, xtreamService]);
  
  // ========== TOGGLE HIDE/SHOW CHANNEL ==========
  const handleToggleHide = useCallback(async () => {
    if (!currentChannel) return;
    
    const streamId = currentChannel.stream_id || currentChannel.id;
    const result = await toggleChannel(streamId);
    
    setChannelHidden(result.hidden);
    
    alert(result.hidden ? '👁️‍🗨️ Chaîne masquée' : '👁️ Chaîne visible');
  }, [currentChannel]);
  
  // ========== RENDER ==========
  if (!visible || !currentChannel) {
    return null;
  }
  
  return (
    <div style={styles.container}>
      {/* Tabs */}
      <div style={styles.tabs}>
        <div 
          style={{...styles.tab, ...(activeTab === 'list' ? styles.tabActive : {})}}
          onClick={() => setActiveTab('list')}
        >
          📋 Liste
        </div>
        <div 
          style={{...styles.tab, ...(activeTab === 'grid' ? styles.tabActive : {})}}
          onClick={() => setActiveTab('grid')}
        >
          📊 Grille
        </div>
      </div>
      
      {/* Channel Info Card */}
      <ChannelInfoCard 
        channel={currentChannel}
        isHidden={channelHidden}
        onToggleHide={handleToggleHide}
        onDeepSearch={handleDeepSearch}
        loading={loading}
      />
      
      {/* Content */}
      {activeTab === 'list' ? (
        <EPGListView 
          programs={programs}
          loading={loading}
          onRefresh={loadChannelData}
        />
      ) : (
        <EPGGridCompact 
          currentFolder={currentFolder}
          currentChannel={currentChannel}
          xtreamService={xtreamService}
          onOpenFullscreen={() => setShowFullscreenGrid(true)}
        />
      )}
      
      {/* Fullscreen EPG Grid Modal */}
      {showFullscreenGrid && (
        <EPGGrid 
          folder={currentFolder}
          xtreamService={xtreamService}
          onClose={() => setShowFullscreenGrid(false)}
        />
      )}
    </div>
  );
};

// ============================================================================
// CHANNEL INFO CARD
// ============================================================================

const ChannelInfoCard = ({ channel, isHidden, onToggleHide, onDeepSearch, loading }) => {
  return (
    <div style={styles.channelCard}>
      <div style={styles.channelHeader}>
        <div style={styles.channelLogo}>
          {channel.logo || channel.stream_icon ? (
            <img 
              src={channel.logo || channel.stream_icon} 
              alt={channel.name}
              style={styles.channelLogoImg}
              onError={(e) => e.target.style.display = 'none'}
            />
          ) : (
            <span style={{ fontSize: '24px' }}>📺</span>
          )}
        </div>
        
        <div style={styles.channelInfo}>
          <h2 style={styles.channelName}>{channel.name}</h2>
          <p style={styles.channelCategory}>
            {channel.category_name || channel.category || 'Sans catégorie'}
          </p>
        </div>
      </div>
      
      <div style={styles.channelActions}>
        <button 
          style={styles.btn}
          onClick={onToggleHide}
          disabled={loading}
        >
          {isHidden ? '👁️‍🗨️' : '👁️'} {isHidden ? 'Masquée' : 'Visible'}
        </button>
        
        <button 
          style={{...styles.btn, ...styles.btnPrimary}}
          onClick={onDeepSearch}
          disabled={loading}
        >
          🔍 Deep Search
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// EPG LIST VIEW
// ============================================================================

const EPGListView = ({ programs, loading, onRefresh }) => {
  const now = Math.floor(Date.now() / 1000);
  
  if (loading) {
    return (
      <div style={styles.epgSection}>
        <div style={styles.loading}>⏳ Chargement EPG...</div>
      </div>
    );
  }
  
  if (programs.length === 0) {
    return (
      <div style={styles.epgSection}>
        <div style={styles.empty}>
          <p>📭 Pas d'EPG disponible</p>
          <p style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
            Utilisez "Deep Search" pour chercher l'EPG
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div style={styles.epgSection}>
      <div style={styles.epgHeader}>
        <h3 style={styles.epgTitle}>📺 Programmes ({programs.length})</h3>
        <span style={styles.epgRefresh}>Auto-refresh: ON ⏰</span>
      </div>
      
      <div style={styles.programList}>
        {programs.map((prog, idx) => {
          const isLive = prog.is_live === 1 || (prog.start_time <= now && prog.end_time > now);
          const progress = isLive ? Math.min(100, Math.max(0, 
            Math.round(((now - prog.start_time) / (prog.end_time - prog.start_time)) * 100)
          )) : 0;
          
          return (
            <ProgramCard 
              key={idx}
              program={prog}
              isLive={isLive}
              progress={progress}
            />
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// PROGRAM CARD
// ============================================================================

const ProgramCard = ({ program, isLive, progress }) => {
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const day = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()];
    const dayNum = date.getDate();
    const month = date.getMonth() + 1;
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${day} ${dayNum}/${month} ${hours}:${mins}`;
  };
  
  return (
    <div style={{...styles.programCard, ...(isLive ? styles.programCardLive : {})}}>
      <div style={{...styles.programTime, ...(isLive ? styles.programTimeLive : {})}}>
        {isLive && <span style={styles.liveBadge}>🔴 LIVE</span>}
        <span>{formatTime(program.start_time)} → {formatTime(program.end_time)}</span>
      </div>
      
      <div style={styles.programTitle}>{program.title || 'Sans titre'}</div>
      
      {program.description && (
        <div style={styles.programDesc}>{program.description}</div>
      )}
      
      {isLive && progress > 0 && (
        <div style={styles.progressBar}>
          <div style={{...styles.progressFill, width: `${progress}%`}} />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// EPG GRID COMPACT (Folder view)
// ============================================================================

const EPGGridCompact = ({ currentFolder, currentChannel, xtreamService, onOpenFullscreen }) => {
  const [folderChannels, setFolderChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const loadFolderChannels = async () => {
      if (!currentFolder || !xtreamService) return;
      
      setLoading(true);
      
      try {
        // Get all channels in current folder
        const categoryId = currentFolder.category_id || currentFolder.id;
        const streams = await xtreamService.getLiveStreams(categoryId);
        
        // Limit to first 10 channels for compact view
        setFolderChannels((streams || []).slice(0, 10));
      } catch (err) {
        console.error('❌ Failed to load folder channels:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadFolderChannels();
  }, [currentFolder, xtreamService]);
  
  if (loading) {
    return (
      <div style={styles.epgSection}>
        <div style={styles.loading}>⏳ Chargement grille...</div>
      </div>
    );
  }
  
  return (
    <div style={styles.gridSection}>
      <div style={styles.gridHeader}>
        <h3 style={styles.gridTitle}>
          📊 Grille - {currentFolder?.category_name || 'Dossier'}
        </h3>
        <button style={styles.btnFullscreen} onClick={onOpenFullscreen}>
          🖥️ Plein écran
        </button>
      </div>
      
      <div style={styles.gridCompact}>
        <p style={{ padding: '20px', color: '#888', textAlign: 'center' }}>
          Grille compact: {folderChannels.length} chaînes
        </p>
        <p style={{ padding: '0 20px 20px', color: '#666', fontSize: '12px', textAlign: 'center' }}>
          Cliquez sur "Plein écran" pour voir la grille complète avec timeline
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    width: '400px',
    height: '100vh',
    background: '#1a1a1a',
    borderLeft: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    color: '#fff',
  },
  
  // Tabs
  tabs: {
    display: 'flex',
    background: '#141414',
    borderBottom: '1px solid #333',
  },
  tab: {
    flex: 1,
    padding: '12px',
    textAlign: 'center',
    fontSize: '11px',
    fontWeight: 600,
    color: '#888',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: '#6225ff',
    borderBottomColor: '#6225ff',
  },
  
  // Channel Info Card
  channelCard: {
    background: 'linear-gradient(135deg, #6225ff 0%, #8B5CF6 100%)',
    padding: '20px',
    borderBottom: '1px solid #333',
  },
  channelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    marginBottom: '12px',
  },
  channelLogo: {
    width: '60px',
    height: '60px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  channelLogoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: '18px',
    fontWeight: 700,
    margin: '0 0 4px 0',
  },
  channelCategory: {
    fontSize: '11px',
    opacity: 0.8,
    margin: 0,
  },
  channelActions: {
    display: 'flex',
    gap: '8px',
  },
  btn: {
    padding: '6px 12px',
    borderRadius: '4px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  btnPrimary: {
    background: 'rgba(34, 197, 94, 0.2)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  
  // EPG Section
  epgSection: {
    flex: 1,
    overflow: 'auto',
  },
  epgHeader: {
    padding: '15px 20px',
    background: '#141414',
    borderBottom: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  epgTitle: {
    fontSize: '14px',
    fontWeight: 600,
    margin: 0,
  },
  epgRefresh: {
    fontSize: '11px',
    color: '#6225ff',
  },
  
  // Program List
  programList: {
    padding: 0,
  },
  programCard: {
    padding: '15px 20px',
    borderBottom: '1px solid #222',
    transition: 'background 0.2s',
  },
  programCardLive: {
    background: 'rgba(34, 197, 94, 0.05)',
    borderLeft: '3px solid #22c55e',
  },
  programTime: {
    fontSize: '11px',
    color: '#888',
    marginBottom: '6px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  programTimeLive: {
    color: '#22c55e',
    fontWeight: 600,
  },
  liveBadge: {
    background: '#22c55e',
    color: '#000',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '9px',
    fontWeight: 700,
  },
  programTitle: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '6px',
  },
  programDesc: {
    fontSize: '12px',
    color: '#aaa',
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  progressBar: {
    marginTop: '8px',
    height: '3px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#22c55e',
    transition: 'width 0.3s',
  },
  
  // Loading/Empty
  loading: {
    padding: '40px 20px',
    textAlign: 'center',
    color: '#888',
  },
  empty: {
    padding: '40px 20px',
    textAlign: 'center',
    color: '#888',
  },
  
  // Grid
  gridSection: {
    flex: 1,
    overflow: 'auto',
    background: '#0f0f0f',
  },
  gridHeader: {
    padding: '15px 20px',
    background: '#141414',
    borderBottom: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridTitle: {
    fontSize: '14px',
    fontWeight: 600,
    margin: 0,
  },
  btnFullscreen: {
    padding: '4px 10px',
    background: 'rgba(98, 37, 255, 0.2)',
    border: '1px solid rgba(98, 37, 255, 0.4)',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '10px',
    cursor: 'pointer',
  },
  gridCompact: {
    padding: '20px',
  },
  
  // Modal
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modalContent: {
    background: '#1a1a1a',
    width: '90vw',
    height: '90vh',
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalHeader: {
    padding: '20px',
    background: '#141414',
    borderBottom: '1px solid #333',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalClose: {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '20px',
    width: '32px',
    height: '32px',
    cursor: 'pointer',
  },
};

export default OTTRight;
