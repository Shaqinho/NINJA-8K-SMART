import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { PlaylistProvider, usePlaylistContext } from './context/PlaylistContext';
import LandingPage from './components/LandingPage';
import { Player } from './components/player';
import GestureTutorial, { isTutorialDone } from './components/GestureTutorial';
import ParticleThemes from './components/ParticleThemes';
import { XtreamService } from './services/XtreamService';
import { ninjaCentral, STORES } from './services/NinjaCentral';
import { useGestures } from './hooks/useGestures';

// ============================================================================
// NINJA 8K — App Root
// Flow: Tutorial → Landing → Player (fullscreen OTT)
// No more Smart.jsx — Player handles everything with OTTLeft + OTTRight
// ============================================================================

const AppContent = () => {
  const { playlist, setPlaylist, clearPlaylist, isRestored } = usePlaylistContext();
  const [currentPage, setCurrentPage] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);

  // NinjaCentral data (persisted)
  const [liveData, setLiveData] = useState([]);
  const [ninjaReady, setNinjaReady] = useState(false);

  // Player state
  const [selectedItem, setSelectedItem] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showVolumeGauge, setShowVolumeGauge] = useState(false);
  const [ottSidebarOpen, setOttSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('live');

  // Particle theme
  const [particleTheme] = useState(() => {
    return localStorage.getItem('ninja_particle_theme') || 'ultimate';
  });

  const autoPlayedRef = useRef(false);
  const playerRef = useRef(null);
  const volumeTimerRef = useRef(null);

  // ============================================================================
  // STATUSBAR FULLSCREEN
  // ============================================================================
  useEffect(() => {
    const setupStatusBar = async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#00000000' });
      } catch (err) {
        console.log('StatusBar not available (web?):', err);
      }
    };
    setupStatusBar();
  }, []);

  // ============================================================================
  // TRANSPARENT BACKGROUND
  // ============================================================================
  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    const root = document.getElementById('root');
    if (root) root.style.backgroundColor = 'transparent';
  }, []);

  // ============================================================================
  // SQL ENGINE INIT
  // ============================================================================
  useEffect(() => {
    const initSql = async () => {
      try {
        const { openDatabase } = await import('./database/NinjaLocalDB');
        const db = await openDatabase();
        window.db = db;
        console.log('✅ SQLite ready for search');
      } catch (err) {
        console.warn('⚠️ SQLite not available:', err.message);
      }
    };
    initSql();
  }, []);

  // ============================================================================
  // NINJA CENTRAL — Load persisted data on mount
  // ============================================================================
  useEffect(() => {
    const loadFromNinja = async () => {
      try {
        await ninjaCentral.init();
        const [live, vod, series] = await Promise.all([
          ninjaCentral.getAll(STORES.LIVE),
          ninjaCentral.getAll(STORES.VOD),
          ninjaCentral.getAll(STORES.SERIES),
        ]);
        if (live.length > 0 || vod.length > 0 || series.length > 0) {
          setLiveData(live);
          console.log(`[NinjaCentral] Loaded: ${live.length} live, ${vod.length} vod, ${series.length} series`);
        }
        setNinjaReady(true);
      } catch (err) {
        console.error('[NinjaCentral] Load error:', err);
        setNinjaReady(true);
      }
    };
    loadFromNinja();
  }, []);

  // ============================================================================
  // SAVE TO NINJA CENTRAL when playlist.data arrives
  // ============================================================================
  useEffect(() => {
    if (!playlist?.data || !ninjaReady) return;
    
    const saveToNinja = async () => {
      try {
        await ninjaCentral.init();
        const { live, vod, series, liveCategories, vodCategories, seriesCategories } = playlist.data;
        
        if (live?.length > 0) {
          await ninjaCentral.saveItems(STORES.LIVE, live);
          await ninjaCentral.saveCategories(STORES.LIVE_CATEGORIES, liveCategories || []);
          setLiveData(live);
        }
        if (vod?.length > 0) {
          await ninjaCentral.saveItems(STORES.VOD, vod);
          await ninjaCentral.saveCategories(STORES.VOD_CATEGORIES, vodCategories || []);
        }
        if (series?.length > 0) {
          await ninjaCentral.saveItems(STORES.SERIES, series);
          await ninjaCentral.saveCategories(STORES.SERIES_CATEGORIES, seriesCategories || []);
        }
        console.log('[NinjaCentral] Saved playlist.data');

        // Auto-play first live channel
        if (live?.length > 0 && !autoPlayedRef.current) {
          autoPlayedRef.current = true;
          setSelectedItem(live[0]);
          setIsPlaying(true);
          console.log('[AutoPlay] Playing:', live[0].name);
        }
      } catch (err) {
        console.error('[NinjaCentral] Save error:', err);
      }
    };
    saveToNinja();
  }, [playlist?.data, ninjaReady]);

  // ============================================================================
  // XTREAM SERVICE
  // ============================================================================
  const xtreamService = useMemo(() => {
    if (!playlist?.server || !playlist?.username || !playlist?.password) return null;
    return new XtreamService(playlist.server, playlist.username, playlist.password);
  }, [playlist]);

  // ============================================================================
  // GESTURES — attached to playerRef
  // ============================================================================
  useGestures(playerRef, {
    onVolumeChange: (vol) => {
      setVolume(vol);
      setShowVolumeGauge(true);
      clearTimeout(volumeTimerRef.current);
      volumeTimerRef.current = setTimeout(() => setShowVolumeGauge(false), 1500);
    },
    onOTTOpen: () => setOttSidebarOpen(true),
    onOTTClose: () => setOttSidebarOpen(false),
    onOTTToggle: () => setOttSidebarOpen(prev => !prev),
    onFolderPrev: () => window.__ottFolderPrev?.(),
    onFolderNext: () => window.__ottFolderNext?.(),
    onGridZoomIn: () => window.__gridZoomIn?.(),
    onGridZoomOut: () => window.__gridZoomOut?.(),
    onSettings: () => window.__settingsToggle?.(),
    onFavorites: () => window.__favoritesToggle?.(),
    onTabSwitch: () => window.__tabSwitch?.(),
    onBack: () => {
      if (ottSidebarOpen) {
        setOttSidebarOpen(false);
      }
    },
    onNavigateUp: () => window.__navigateUp?.(),
    onNavigateDown: () => window.__navigateDown?.(),
    onNavigateLeft: () => window.__navigateLeft?.(),
    onNavigateRight: () => window.__navigateRight?.(),
    onSelect: () => window.__navigateSelect?.(),
  });

  // ============================================================================
  // NAVIGATION
  // ============================================================================
  useEffect(() => {
    if (isRestored) {
      if (!isTutorialDone()) {
        setShowTutorial(true);
        setCurrentPage('tutorial');
      } else if (playlist) {
        setCurrentPage('player');
      } else if (ninjaReady && liveData.length > 0) {
        // Data in NinjaCentral but no playlist in context — go to player
        setCurrentPage('player');
      } else {
        setCurrentPage('landing');
      }
    }
  }, [isRestored, playlist, ninjaReady, liveData.length]);

  const handleTutorialComplete = () => {
    setShowTutorial(false);
    setCurrentPage(playlist ? 'player' : 'landing');
  };

  const handleNavigateToPlayer = useCallback((data) => {
    setPlaylist(data);
    setCurrentPage('player');
  }, [setPlaylist]);

  const handleLogout = useCallback(() => {
    clearPlaylist();
    autoPlayedRef.current = false;
    setSelectedItem(null);
    setIsPlaying(false);
    setOttSidebarOpen(false);
    setCurrentPage('landing');
  }, [clearPlaylist]);

  const handleChannelChange = useCallback((channel) => {
    setSelectedItem(channel);
    setIsPlaying(true);
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================
  if (currentPage === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <div className="text-center">
          <h1 className="text-white text-4xl font-black italic tracking-tighter mb-4">
            NINJA <span style={{ color: '#6225ff' }}>8K</span>
          </h1>
          <div className="w-8 h-8 mx-auto border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (showTutorial || currentPage === 'tutorial') {
    return <GestureTutorial onComplete={handleTutorialComplete} />;
  }

  if (currentPage === 'landing') {
    return <LandingPage onNavigateToPlayer={handleNavigateToPlayer} />;
  }

  // ============================================================================
  // PLAYER — Fullscreen OTT mode
  // ============================================================================
  return (
    <div ref={playerRef} className="fixed inset-0 overflow-hidden" style={{ background: 'transparent' }}>
      {/* Particles Background */}
      {particleTheme !== 'off' && (
        <div className="fixed inset-0 pointer-events-none z-0">
          <ParticleThemes containerRef={playerRef} theme={particleTheme} />
        </div>
      )}

      {/* Volume Gauge */}
      {showVolumeGauge && (
        <div
          className="fixed z-[10003] pointer-events-none"
          style={{ right: '20px', top: '50%', transform: 'translateY(-50%)' }}
        >
          <div style={{
            width: '36px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
            padding: '12px 0', borderRadius: '18px',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {volume > 0 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
              {volume > 0.5 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
            </svg>
            <div style={{
              width: '4px', height: '120px', borderRadius: '2px',
              background: 'rgba(255,255,255,0.2)', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', bottom: 0, width: '100%',
                height: `${Math.round(volume * 100)}%`,
                borderRadius: '2px', background: '#6225ff',
                transition: 'height 0.1s ease-out',
              }} />
            </div>
            <span style={{ color: '#fff', fontSize: '10px', fontWeight: 700 }}>
              {Math.round(volume * 100)}
            </span>
          </div>
        </div>
      )}

      {/* Player */}
      <Player
        channel={selectedItem}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onChannelChange={handleChannelChange}
        isLive={sidebarTab === 'live'}
        isSmartFullscreen={true}
        volume={volume}
        onVolumeChange={setVolume}
        ottSidebarOpen={ottSidebarOpen}
        onOttSidebarChange={setOttSidebarOpen}
        onTabChange={setSidebarTab}
        xtreamService={xtreamService}
        onServers={handleLogout}
      />
    </div>
  );
};

const App = () => (
  <PlaylistProvider>
    <AppContent />
  </PlaylistProvider>
);

export default App;
