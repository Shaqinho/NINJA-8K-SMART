import React, { useState, useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { PlaylistProvider, usePlaylistContext } from './context/PlaylistContext';
import LandingPage from './components/LandingPage';
import Smart from './components/Smart';
import Hub from './components/Hub';
import GestureTutorial, { isTutorialDone } from './components/GestureTutorial';
import ParticleThemes from './components/ParticleThemes';

// ============================================================================
// NINJA 8K GLOBAL THEME
// ============================================================================
const NINJA_THEME = {
  background: '#0a0a0f',
  particle: 'purple',
};

const AppContent = () => {
  const { playlist, setPlaylist, clearPlaylist, isRestored } = usePlaylistContext();
  const [currentPage, setCurrentPage] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isHeaderOpen, setIsHeaderOpen] = useState(false);

  // ============================================================================
  // STATUSBAR FULLSCREEN - App passe sous la status bar
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
  // FIX: DYNAMIC TRANSPARENCY
  // ============================================================================
  const isVideoActive = currentPage === 'player' || isStreaming;

  useEffect(() => {
    if (isVideoActive) {
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';
      const root = document.getElementById('root');
      if (root) root.style.backgroundColor = 'transparent';
    } else {
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';
      const root = document.getElementById('root');
      if (root) root.style.backgroundColor = 'transparent';
    }
  }, [isVideoActive]);

  // SQL ENGINE INIT - Use NinjaLocalDB
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

  useEffect(() => {
    if (isRestored) {
      if (!isTutorialDone()) {
        setShowTutorial(true);
        setCurrentPage('tutorial');
      } else if (playlist) {
        setCurrentPage('smart');
      } else {
        setCurrentPage('landing');
      }
    }
  }, [isRestored, playlist]);

  const handleTutorialComplete = () => {
    setShowTutorial(false);
    setCurrentPage(playlist ? 'smart' : 'landing');
  };

  const navigateToSmart = (data) => {
    setPlaylist(data);
    setCurrentPage('smart');
  };

  const navigateToPlayer = () => {
    // Player is handled by Smart component
  };

  const navigateBack = () => {
    if (currentPage === 'hub') {
      setCurrentPage('smart');
    } else {
      clearPlaylist();
      setCurrentPage('landing');
    }
  };

  const navigateToHub = () => setCurrentPage('hub');
  const handleLogout = () => {
    clearPlaylist();
    setCurrentPage('landing');
  };

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

  const appStyle = {
    minHeight: '100vh',
    width: '100vw',
    backgroundColor: 'transparent',
    color: '#ffffff',
    position: 'relative',
    zIndex: isVideoActive ? 0 : 1
  };

  return (
    <div style={appStyle} className={isVideoActive ? '!bg-transparent' : ''}>

      {/* ZONE DE DÉTECTION HAUTE */}
      <div
        className="top-edge-trigger"
        onClick={() => setIsHeaderOpen(true)}
      />

      {/* HEADER TIROIR */}
      <div className={`ninja-header-drawer ${isHeaderOpen ? 'open' : ''}`}>
        <div className="flex items-center justify-between p-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
          <h1 className="text-white text-2xl font-black italic tracking-tighter">
            NINJA <span className="text-[#6225ff]">8K</span>
          </h1>
          <button onClick={() => setIsHeaderOpen(false)} className="p-2 text-white/50">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* PARTICLES - Cachés si vidéo active */}
      {!isVideoActive && (
        <ParticleThemes theme={NINJA_THEME.particle} />
      )}

      {currentPage === 'landing' && <LandingPage onNavigateToSmart={navigateToSmart} />}

      {currentPage === 'smart' && (
        <Smart
          playlist={playlist}
          onPlay={navigateToPlayer}
          onBack={navigateBack}
          onLogout={handleLogout}
          onSwitchToHub={navigateToHub}
          setIsStreaming={setIsStreaming}
        />
      )}

      {currentPage === 'hub' && <Hub onBack={navigateBack} onPlay={navigateToPlayer} />}
    </div>
  );
};

const App = () => (
  <PlaylistProvider>
    <AppContent />
  </PlaylistProvider>
);

export default App;
