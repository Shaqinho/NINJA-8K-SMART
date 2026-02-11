import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { PlaylistProvider, usePlaylistContext } from './context/PlaylistContext';
import { ServerForm } from './components/ServerForm';
import { Player } from './components/player';
import GestureTutorial, { isTutorialDone } from './components/GestureTutorial';
import ParticleThemes from './components/ParticleThemes';
import { XtreamService } from './services/XtreamService';
import { ninjaCentral, STORES } from './services/NinjaCentral';
import { useGestures } from './hooks/useGestures';
import { openDatabase, extractLangPrefix } from './database/NinjaLocalDB';
import { insertProgramsBatch, cleanExpiredPrograms } from './database/ProgramQueries';
import XMLTVRefreshService from './services/XMLTVRefreshService';

// ============================================================================
// NINJA 8K — App Root
// Flow: Tutorial → ServerForm → Player (fullscreen OTT)
// No more Smart.jsx — Player handles everything with OTTLeft + OTTRight
//
// EPG Background Sync runs here (access to xtreamService + categories)
// Detects user language from first 10 live categories → syncs only those + VIP
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

// ============================================================================
// FILTER CHANNELS BY LANGUAGE — match category lang prefix
// ============================================================================
const filterChannelsByLangs = (channels, categories, langs) => {
  if (!langs || langs.length === 0) return channels;

  // Get category IDs that match our langs
  const matchingCatIds = new Set();
  (categories || []).forEach(cat => {
    const prefix = extractLangPrefix(cat.category_name);
    if (langs.includes(prefix)) {
      matchingCatIds.add(String(cat.category_id));
    }
  });

  return channels.filter(ch => matchingCatIds.has(String(ch.categoryId)));
};

const AppContent = () => {
  const { playlist, setPlaylist, clearPlaylist, isRestored } = usePlaylistContext();
  const [currentPage, setCurrentPage] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);

  // NinjaCentral data (persisted)
  const [liveData, setLiveData] = useState([]);
  const [ninjaReady, setNinjaReady] = useState(false);

  // Detected user languages (for EPG sync + OTTLeft)
  const [userLangs, setUserLangs] = useState([]);

  // EPG background sync state
  const [epgSyncProgress, setEpgSyncProgress] = useState(0);
  const [epgSyncingFolders, setEpgSyncingFolders] = useState(new Set()); // category_ids being synced
  const epgAbortRef = useRef(null);
  const epgIntervalRef = useRef(null);

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
        // 1. Init SQLite
        const db = await openDatabase();
        window.db = db;
        console.log('✅ SQLite ready for search');
        
        // 2. Auto-login: Check if last active server exists
        const { getLastActiveServer } = await import('./utils/NinjaLocalDB');
        const lastServer = await getLastActiveServer();
        
        if (lastServer) {
          console.log('🔐 Auto-login with last server:', lastServer.name || lastServer.url);
          // Créer instance XtreamService avec les credentials sauvegardés
          const XtreamService = (await import('./utils/XtreamService')).default;
          const xtream = new XtreamService(lastServer.url, lastServer.username, lastServer.password);
          setXtreamService(xtream);
          // Passer directement au player (data déjà en DB locale)
          setCurrentPage('player');
        } else {
          // Aucun serveur sauvegardé → afficher ServerForm
          setCurrentPage('serverform');
        }
        
        // 3. Fetch Logos si pas déjà en cache local
        const LOGOS_URL = 'https://script.google.com/macros/s/AKfycbzVRZLKDPgqtFtDp54eZ9ArmdkvfR6-6Wo8eaga1BId8jtEU5PetqQ4DfW6Jsl3vUg57g/exec';
        const response = await fetch(LOGOS_URL);
        const data = await response.json();
        
        if (data?.channels) {
          localStorage.setItem('premiumLogos', JSON.stringify(data.channels));
          // Déclenche un événement personnalisé pour notifier les composants que les logos sont prêts
          window.dispatchEvent(new Event('logos_ready'));
          console.log(`✅ Premium logos ready (${data.channels.length} channels)`);
        }
      } catch (err) {
        console.error('❌ Core Init Error:', err);
        setCurrentPage('serverform'); // Fallback sur erreur
      }
    };
    initAppCore();
  }, []);

  // ============================================================================
  // NINJA CENTRAL — Load persisted data on mount
  // ============================================================================
  useEffect(() => {
    const loadFromNinja = async () => {
      try {
        await ninjaCentral.init();
        const [live, vod, series, liveCats] = await Promise.all([
          ninjaCentral.getAll(STORES.LIVE),
          ninjaCentral.getAll(STORES.VOD),
          ninjaCentral.getAll(STORES.SERIES),
          ninjaCentral.getAll(STORES.LIVE_CATEGORIES),
        ]);
        if (live.length > 0 || vod.length > 0 || series.length > 0) {
          setLiveData(live);
          console.log(`[NinjaCentral] Loaded: ${live.length} live, ${vod.length} vod, ${series.length} series`);

          // Detect user languages from persisted categories
          if (liveCats.length > 0) {
            const langs = detectUserLangs(liveCats);
            setUserLangs(langs);
            console.log('[NinjaCentral] User langs detected:', langs);
          }

          // Auto-play first live channel from NinjaCentral (returning user)
          if (live.length > 0 && !autoPlayedRef.current) {
            autoPlayedRef.current = true;
            setSelectedItem(live[0]);
            setIsPlaying(true);
            console.log('[AutoPlay] From NinjaCentral:', live[0].name);
          }
          
          // UPGRADE TO PREMIUM LOGOS (en RAM, ultra rapide)
          if (live.length > 0) {
            console.log('🎨 [LOGO UPGRADE] Starting upgrade for', live.length, 'channels...');
            
            try {
              const premiumLogosRaw = localStorage.getItem('premiumLogos');
              console.log('📦 [LOGO UPGRADE] localStorage data exists:', !!premiumLogosRaw);
              
              const premiumLogos = JSON.parse(premiumLogosRaw || '[]');
              console.log('🔍 [LOGO UPGRADE] Parsed', premiumLogos.length, 'premium logos');
              
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
              
              console.log(`✅ [LOGO UPGRADE] Upgraded ${upgraded}/${live.length} channels with premium logos`);
              
              if (upgraded > 0) {
                setLiveData([...live]); // Force re-render
              }
            } catch (err) {
              console.error('❌ [LOGO UPGRADE] Failed:', err.message);
            }
          }
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

        // Detect user languages from fresh categories
        if (liveCategories?.length > 0) {
          const langs = detectUserLangs(liveCategories);
          setUserLangs(langs);
          console.log('[App] User langs detected:', langs);
        }

        // Auto-play first live channel
        if (live?.length > 0 && !autoPlayedRef.current) {
          autoPlayedRef.current = true;
          setSelectedItem(live[0]);
          setIsPlaying(true);
          console.log('[AutoPlay] Playing:', live[0].name);
        }
        
        // UPGRADE TO PREMIUM LOGOS (en RAM, ultra rapide)
        if (live?.length > 0) {
          console.log('🎨 [LOGO UPGRADE] Starting upgrade for', live.length, 'channels (playlist.data)...');
          
          try {
            const premiumLogosRaw = localStorage.getItem('premiumLogos');
            console.log('📦 [LOGO UPGRADE] localStorage data exists:', !!premiumLogosRaw);
            
            const premiumLogos = JSON.parse(premiumLogosRaw || '[]');
            console.log('🔍 [LOGO UPGRADE] Parsed', premiumLogos.length, 'premium logos');
            
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
            
            console.log(`✅ [LOGO UPGRADE] Upgraded ${upgraded}/${live.length} channels with premium logos`);
            
            if (upgraded > 0) {
              setLiveData([...live]); // Force re-render
            }
          } catch (err) {
            console.error('❌ [LOGO UPGRADE] Failed:', err.message);
          }
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
  // EPG BACKGROUND SYNC — Concentric, lang-filtered, every 30 minutes
  //
  // - Reads channels from NinjaCentral (no refetch)
  // - Filters by userLangs (top 2 + VIP)
  // - Batches of 20, limit=1, no pause
  // - Stores in SQLite for search
  // - Exposes progress via epgSyncProgress + epgSyncingFolders
  // - Repeats every 30 minutes
  // ============================================================================
  const runEpgSync = useCallback(async (service, langs) => {
    if (!service) return;

    // Abort previous sync if running
    if (epgAbortRef.current) {
      epgAbortRef.current.abort();
    }
    const abortController = new AbortController();
    epgAbortRef.current = abortController;
    const signal = abortController.signal;

    try {
      // Read channels + categories from NinjaCentral
      await ninjaCentral.init();
      const [allChannels, liveCats] = await Promise.all([
        ninjaCentral.getAll(STORES.LIVE),
        ninjaCentral.getAll(STORES.LIVE_CATEGORIES),
      ]);

      if (allChannels.length === 0) {
        console.log('[EPG Sync] No channels in NinjaCentral, skipping');
        return;
      }

      // Filter by user languages
      const channels = langs.length > 0
        ? filterChannelsByLangs(allChannels, liveCats, langs)
        : allChannels;

      console.log(`[EPG Sync] Starting: ${channels.length} channels (filtered from ${allChannels.length}) | Langs: ${langs.join(', ')}`);

      // Group channels by category for folder-level tracking
      const categoryMap = {};
      channels.forEach(ch => {
        const catId = String(ch.categoryId || 'unknown');
        if (!categoryMap[catId]) categoryMap[catId] = [];
        categoryMap[catId].push(ch);
      });
      const categoryIds = Object.keys(categoryMap);

      // Clean expired programs
      try {
        await cleanExpiredPrograms();
      } catch (e) {
        console.warn('[EPG Sync] Cleanup skipped:', e);
      }

      const BATCH_SIZE = 20;
      let totalProcessed = 0;
      const totalChannels = channels.length;

      // Process folder by folder (concentric)
      for (const catId of categoryIds) {
        if (signal.aborted) break;

        const catChannels = categoryMap[catId];
        const streamIds = catChannels.map(ch => ch.id || ch.stream_id).filter(Boolean);

        // Mark folder as syncing
        setEpgSyncingFolders(prev => new Set([...prev, catId]));

        // Batch within folder
        for (let i = 0; i < streamIds.length; i += BATCH_SIZE) {
          if (signal.aborted) break;

          const batchIds = streamIds.slice(i, i + BATCH_SIZE);

          try {
            const epgResults = await service.getShortEPGBatch(batchIds, 1, 20);

            if (signal.aborted) break;

            // Transform for SQLite insert
            const epgForInsert = {};
            Object.entries(epgResults).forEach(([streamId, data]) => {
              if (data.epg_now) {
                epgForInsert[streamId] = [{
                  title: data.epg_now,
                  start: data.epg_start || '',
                  end: data.epg_end || '',
                  startTimestamp: data.epg_start_timestamp || null,
                  stopTimestamp: data.epg_end_timestamp || null,
                  description: '',
                }];
              }
            });

            if (Object.keys(epgForInsert).length > 0) {
              await insertProgramsBatch(epgForInsert);
            }
          } catch (batchErr) {
            console.warn(`[EPG Sync] Batch failed (cat ${catId}):`, batchErr);
          }

          totalProcessed += batchIds.length;
          const progress = Math.round((totalProcessed / totalChannels) * 100);
          setEpgSyncProgress(progress);
        }

        // Unmark folder
        setEpgSyncingFolders(prev => {
          const next = new Set(prev);
          next.delete(catId);
          return next;
        });
      }

      if (!signal.aborted) {
        setEpgSyncProgress(100);
        console.log(`✅ [EPG Sync] Complete: ${totalProcessed} channels indexed`);

        // Reset progress after 3 seconds
        setTimeout(() => {
          if (!signal.aborted) setEpgSyncProgress(0);
        }, 3000);
      }
    } catch (err) {
      if (!signal.aborted) {
        console.error('[EPG Sync] Failed:', err);
        setEpgSyncProgress(0);
      }
    }
  }, []);

  // Start EPG sync when xtreamService + userLangs are ready
  useEffect(() => {
    if (!xtreamService || userLangs.length === 0) return;

    // Initial sync (small delay to let UI settle)
    const initialTimer = setTimeout(() => {
      runEpgSync(xtreamService, userLangs);
    }, 2000);

    // Repeat every 30 minutes
    epgIntervalRef.current = setInterval(() => {
      runEpgSync(xtreamService, userLangs);
    }, 30 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(epgIntervalRef.current);
      if (epgAbortRef.current) epgAbortRef.current.abort();
    };
  }, [xtreamService, userLangs, runEpgSync]);

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
    // Stop EPG sync
    if (epgAbortRef.current) epgAbortRef.current.abort();
    clearInterval(epgIntervalRef.current);
    setEpgSyncProgress(0);
    setEpgSyncingFolders(new Set());
    setUserLangs([]);

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
    return <ServerForm onNavigateToPlayer={handleNavigateToPlayer} />;
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
        epgSyncProgress={epgSyncProgress}
        epgSyncingFolders={epgSyncingFolders}
        userLangs={userLangs}
        liveChannels={playlist?.data?.live || []}
        vodItems={playlist?.data?.vod || []}
        seriesItems={playlist?.data?.series || []}
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
