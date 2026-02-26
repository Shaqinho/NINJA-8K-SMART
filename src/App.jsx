import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { deletePlaylist } from './services/NinjaStorage';
import { ServerForm } from './components/ServerForm';
import OTT from './components/OTT';
import { NinjaSplash } from './components/NinjaSplash';
import GestureTutorial, { isTutorialDone } from './components/GestureTutorial';
import { extractLangPrefix } from './database/NinjaLocalDB';
import { insertProgramsBatch, cleanExpiredPrograms } from './database/ProgramQueries';
import XMLTVRefreshService from './services/XMLTVRefreshService';

// ============================================================================
// NINJA 8K — App Root
// Flow: Splash → ServerForm or Player (fullscreen OTT)
// No NinjaCentral — Playlist stored via NinjaStorage (Capacitor Preferences)
// SQLite reserved for EPG only (programs + channels mapping)
//
// EPG Background Sync runs here (access to xtreamService + categories)
// Detects user language from first 30 live categories → syncs only those + VIP
// ============================================================================

// ============================================================================
// DETECT USER LANGUAGES — Top 2 from first 10 categories + VIP if exists
// Uses extractLangPrefix from NinjaLocalDB (single source of truth)
// ============================================================================
const detectUserLangs = (liveCategories) => {
  if (!Array.isArray(liveCategories) || liveCategories.length === 0) return [];

  const first30 = liveCategories.slice(0, 30); // ← Augmenté pour capturer les vrais bouquets
  const langCounts = {};
  let hasVip = false;

  // Count lang prefixes in first 30 categories
  first30.forEach(cat => {
    const prefix = extractLangPrefix(cat.category_name);
    if (prefix === 'VIP') {
      hasVip = true;
    } else if (prefix !== 'OTHER') {
      langCounts[prefix] = (langCounts[prefix] || 0) + 1;
    }
  });

  // Also check all categories for VIP (might not be in top 30)
  if (!hasVip) {
    hasVip = liveCategories.some(cat => extractLangPrefix(cat.category_name) === 'VIP');
  }

  // Sort by frequency, take top 2
  const sorted = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([lang]) => lang);

  // Add VIP as 3rd if it exists
  if (hasVip) {
    sorted.push('VIP');
  }

  return sorted; // e.g. ['FR', 'BE', 'VIP'] or ['DE', 'AT'] (no VIP in abo)
};

const AppContent = () => {
  const [playlist, setPlaylist] = useState(null);
  const [currentPage, setCurrentPage] = useState('splash');
  const [showTutorial, setShowTutorial] = useState(false);
  const [xtreamService, setXtreamService] = useState(null);


  // Detected user languages (for EPG sync + OTTLeft)
  const [userLangs, setUserLangs] = useState([]);

  // EPG background sync state
  const [epgSyncProgress, setEpgSyncProgress] = useState(0);
  const [epgSyncingFolders, setEpgSyncingFolders] = useState(new Set());
  const [epgSyncedFolders, setEpgSyncedFolders] = useState(new Set());
  const epgAbortRef = useRef(null);
  const epgIntervalRef = useRef(null);

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
      try {
        await ScreenOrientation.lock({ orientation: 'landscape' });
      } catch (err) {
        console.log('ScreenOrientation not available:', err);
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
  // SQL ENGINE INIT + PREMIUM LOGOS FETCH
  // ============================================================================
  useEffect(() => {
    const initAppCore = async () => {
      try {
        // 1. Fetch Logos en background
        const LOGOS_URL = 'https://script.google.com/macros/s/AKfycbzVRZLKDPgqtFtDp54eZ9ArmdkvfR6-6Wo8eaga1BId8jtEU5PetqQ4DfW6Jsl3vUg57g/exec';
        const response = await fetch(LOGOS_URL);
        const data = await response.json();
        
        if (data?.channels) {
          localStorage.setItem('premiumLogos', JSON.stringify(data.channels));
          window.dispatchEvent(new Event('logos_ready'));
          console.log(`✅ Premium logos ready (${data.channels.length} channels)`);
        }
      } catch (err) {
        console.error('❌ Logo fetch error:', err);
      }
    };
    initAppCore();
  }, []);

  // ============================================================================
  // PLAYLIST DATA — Detect languages + upgrade logos when playlist arrives
  // ============================================================================
  useEffect(() => {
    if (!playlist?.data) return;
    
    const { live, liveCategories } = playlist.data;

    // Detect user languages from fresh categories
    if (liveCategories?.length > 0) {
      const langs = detectUserLangs(liveCategories);
      setUserLangs(langs);
      console.log('[App] User langs detected:', langs);
    }

    // UPGRADE TO PREMIUM LOGOS (en RAM, ultra rapide)
    if (live?.length > 0) {
      try {
        const premiumLogos = JSON.parse(localStorage.getItem('premiumLogos') || '[]');
        let upgraded = 0;
        
        live.forEach(ch => {
          const match = premiumLogos.find(logo => 
            logo.match_patterns.some(pattern => {
              const p = pattern.toLowerCase();
              const n = (ch.name || '').toLowerCase();
              return n === p || n.includes(p);
            })
          );
          if (match) {
            ch.logo = match.logo_url;
            ch.stream_icon = match.logo_url;
            upgraded++;
          }
        });
        
        if (upgraded > 0) {
          console.log(`✅ [LOGO UPGRADE] Upgraded ${upgraded}/${live.length} channels`);
        }
      } catch (err) {
        console.error('❌ [LOGO UPGRADE] Failed:', err.message);
      }
    }
  }, [playlist?.data]);

  // ============================================================================
  // XMLTV BACKGROUND REFRESH - Every 5 minutes
  // ============================================================================
  useEffect(() => {
    if (!xtreamService) return;
    
    console.log('🔄 Starting XMLTV background refresh service...');
    
    const xmltvRefresh = new XMLTVRefreshService(xtreamService);
    xmltvRefresh.start();
    
    return () => {
      console.log('🛑 Stopping XMLTV background refresh service...');
      xmltvRefresh.stop();
    };
  }, [xtreamService]);

  // ============================================================================
  // EPG BACKGROUND SYNC — First 250 folders, server order, every 30 minutes
  //
  // - Reads categories from playlist.data (localStorage)
  // - Takes first 250 folders
  // - For each folder: fetch EPG for all channels → save to SQLite → next
  // - Progress: folder-level (e.g. 25/250 = 10%)
  // - epgSyncingFolders: Set of category_ids currently syncing
  // - epgSyncedFolders: Set of category_ids fully synced (bars stay visible)
  // - Repeats every 30 minutes
  // ============================================================================
  const runEpgSync = useCallback(async (service) => {
    if (!service) return;

    // Read channels and categories from playlist (localStorage) instead of NinjaCentral
    const allChannels = playlist?.data?.live || [];
    const liveCats = playlist?.data?.liveCategories || [];

    if (allChannels.length === 0 || liveCats.length === 0) {
      console.log('[EPG Sync] No channels or categories, skipping');
      return;
    }

    if (epgAbortRef.current) {
      epgAbortRef.current.abort();
    }
    const abortController = new AbortController();
    epgAbortRef.current = abortController;
    const signal = abortController.signal;

    try {

      const MAX_FOLDERS = 250;
      const targetCats = liveCats.slice(0, MAX_FOLDERS);

      const categoryMap = {};
      targetCats.forEach(cat => {
        categoryMap[String(cat.category_id)] = [];
      });
      allChannels.forEach(ch => {
        const catId = String(ch.categoryId || '');
        if (categoryMap[catId]) {
          categoryMap[catId].push(ch);
        }
      });

      const categoryIds = targetCats.map(cat => String(cat.category_id));
      const totalFolders = categoryIds.length;

      console.log(`[EPG Sync] Starting: ${totalFolders} folders, ${allChannels.length} total channels`);

      try {
        await cleanExpiredPrograms();
      } catch (e) {
        console.warn('[EPG Sync] Cleanup skipped:', e);
      }

      setEpgSyncedFolders(new Set());
      setEpgSyncProgress(0);

      const BATCH_SIZE = 20;
      let foldersProcessed = 0;

      for (const catId of categoryIds) {
        if (signal.aborted) break;

        const catChannels = categoryMap[catId] || [];
        const streamIds = catChannels.map(ch => ch.id || ch.stream_id).filter(Boolean);

        setEpgSyncingFolders(prev => new Set([...prev, catId]));

        for (let i = 0; i < streamIds.length; i += BATCH_SIZE) {
          if (signal.aborted) break;

          const batchIds = streamIds.slice(i, i + BATCH_SIZE);

          try {
            const epgResults = await service.getShortEPGBatch(batchIds, 1, 20);
            if (signal.aborted) break;

            const epgForInsert = {};
            Object.entries(epgResults).forEach(([streamId, data]) => {
              if (data.epg_now) {
                epgForInsert[streamId] = [{
                  title: data.epg_now,
                  start: data.epg_start || '',
                  end: data.epg_end || '',
                  startTimestamp: data.epg_start_timestamp || null,
                  stopTimestamp: data.epg_end_timestamp || null,
                  description: data.epg_description || '',
                }];
              }
            });

            if (Object.keys(epgForInsert).length > 0) {
              await insertProgramsBatch(epgForInsert);
            }
          } catch (batchErr) {
            console.warn(`[EPG Sync] Batch failed (folder ${catId}):`, batchErr);
          }
        }

        setEpgSyncingFolders(prev => {
          const next = new Set(prev);
          next.delete(catId);
          return next;
        });
        setEpgSyncedFolders(prev => new Set([...prev, catId]));

        foldersProcessed++;
        const progress = Math.round((foldersProcessed / totalFolders) * 100);
        setEpgSyncProgress(progress);
      }

      if (!signal.aborted) {
        setEpgSyncProgress(100);
        console.log(`[EPG Sync] Complete: ${foldersProcessed}/${totalFolders} folders`);

        setTimeout(() => {
          if (!signal.aborted) setEpgSyncProgress(0);
        }, 5000);
      }
    } catch (err) {
      if (!signal.aborted) {
        console.error('[EPG Sync] Failed:', err);
        setEpgSyncProgress(0);
      }
    }
  }, [playlist?.data]);

  // Start EPG sync when xtreamService is ready
  useEffect(() => {
    if (!xtreamService) return;

    const initialTimer = setTimeout(() => {
      runEpgSync(xtreamService);
    }, 2000);

    epgIntervalRef.current = setInterval(() => {
      runEpgSync(xtreamService);
    }, 30 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(epgIntervalRef.current);
      if (epgAbortRef.current) epgAbortRef.current.abort();
    };
  }, [xtreamService, runEpgSync]);

  // ============================================================================
  // GESTURES — attached to playerRef
  // ============================================================================
  // ============================================================================
  // NAVIGATION — Splash decides first, then playlist presence
  // ============================================================================
  useEffect(() => {
    if (currentPage === 'splash') return; // NinjaSplash decides alone

    if (!isTutorialDone()) {
      setShowTutorial(true);
      setCurrentPage('tutorial');
    } else if (playlist) {
      setCurrentPage('player');
    } else {
      setCurrentPage('landing');
    }
  }, [playlist, currentPage]);

  const handleTutorialComplete = () => {
    setShowTutorial(false);
    setCurrentPage('splash');
  };

  const handleSplashComplete = useCallback((nextPage, sessionData = null) => {
    if (sessionData) {
      // Splash sent session data (service + playlist from NinjaStorage)
      if (sessionData.service) setXtreamService(sessionData.service);
      
      if (sessionData.playlistData) {
        // Wrap playlist data in the format expected by the rest of the app
        setPlaylist({ data: sessionData.playlistData });
        console.log('✅ Playlist restored from NinjaStorage:', {
          live: sessionData.playlistData.live?.length || 0,
          vod: sessionData.playlistData.vod?.length || 0,
          series: sessionData.playlistData.series?.length || 0,
        });
      }
    }
    setCurrentPage(nextPage);
  }, []);

  const handleNavigateToPlayer = useCallback((data) => {
    setPlaylist(data);
    if (data.service) {
      setXtreamService(data.service);
      console.log('✅ XtreamService stored from ServerForm');
    }
    setCurrentPage('player');
  }, []);

  const handleLogout = useCallback(() => {
    // Stop EPG sync
    if (epgAbortRef.current) epgAbortRef.current.abort();
    clearInterval(epgIntervalRef.current);
    setEpgSyncProgress(0);
    setEpgSyncingFolders(new Set());
    setUserLangs([]);

    setPlaylist(null);
    deletePlaylist();
    setCurrentPage('landing');
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

  if (currentPage === 'splash') {
    return <NinjaSplash onComplete={handleSplashComplete} />;
  }

  if (showTutorial || currentPage === 'tutorial') {
    return <GestureTutorial onComplete={handleTutorialComplete} />;
  }

  if (currentPage === 'serverform') {
    return <ServerForm onNavigateToPlayer={handleNavigateToPlayer} />;
  }

  if (currentPage === 'landing') {
    return <ServerForm onNavigateToPlayer={handleNavigateToPlayer} />;
  }

  // ============================================================================
  // OTT — Fullscreen 3-column interface
  // ============================================================================
  return (
    <OTT
      liveChannels={playlist?.data?.live || []}
      vodItems={playlist?.data?.vod || []}
      seriesItems={playlist?.data?.series || []}
      liveCategories={playlist?.data?.liveCategories || []}
      vodCategories={playlist?.data?.vodCategories || []}
      seriesCategories={playlist?.data?.seriesCategories || []}
      xtreamService={xtreamService}
      epgSyncProgress={epgSyncProgress}
      epgSyncingFolders={epgSyncingFolders}
      epgSyncedFolders={epgSyncedFolders}
      userLangs={userLangs}
      onLogout={handleLogout}
      onReload={() => {
        // Re-fetch playlist from server
        console.log('[OTT] Reload requested');
      }}
      onSettings={() => {
        console.log('[OTT] Settings requested');
      }}
      onExit={() => {
        // Close app (Capacitor)
        try { window.navigator?.app?.exitApp?.(); } catch {}
      }}
    />
  );
};

const App = () => (
  <AppContent />
);

export default App;
