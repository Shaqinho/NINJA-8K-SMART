import React, { useState, useRef, useEffect } from 'react';
import { Clipboard } from '@capacitor/clipboard';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { THEME } from '../constants/theme';
import { XtreamService, parseXtreamUrl } from '../services/XtreamService';
import { Icons } from './Icons';
import { LoadingScreen } from './LoadingScreen';
import { PlaylistForm } from './PlaylistForm';
import ParticleThemes from './ParticleThemes';
import { openDatabase } from '../database/NinjaLocalDB';
import { insertChannels, insertProgramsBatch, cleanExpiredPrograms } from '../database/ProgramQueries';
import { getDeviceId } from '../services/NinjaAPI';

// ============================================================================
// URL NORMALIZER - Auto-add http/https
// ============================================================================
const normalizeServerUrl = (url) => {
  let server = url.trim();
  if (server.startsWith('http://') || server.startsWith('https://')) {
    return server;
  }
  server = server.replace(/^(https?:\/\/)+/i, '');
  return 'http://' + server;
};

// ============================================================================
// TRY CONNECT - Essaie HTTP et HTTPS dans les deux sens
// ============================================================================
const tryConnect = async (server, username, password) => {
  const normalizedServer = normalizeServerUrl(server);
  
  console.log('🔌 tryConnect:', normalizedServer);
  
  try {
    const service = new XtreamService(normalizedServer, username, password);
    const auth = await service.authenticate();
    console.log('✅ Connected with:', normalizedServer);
    return { service, auth, server: normalizedServer };
  } catch (err) {
    console.log('❌ Failed with:', normalizedServer, err.message);
    
    let altServer;
    if (normalizedServer.startsWith('http://')) {
      altServer = normalizedServer.replace('http://', 'https://');
    } else if (normalizedServer.startsWith('https://')) {
      altServer = normalizedServer.replace('https://', 'http://');
    }
    
    if (altServer) {
      console.log('🔄 Retrying with:', altServer);
      try {
        const service = new XtreamService(altServer, username, password);
        const auth = await service.authenticate();
        console.log('✅ Connected with:', altServer);
        return { service, auth, server: altServer };
      } catch (altErr) {
        console.log('❌ Also failed with:', altServer, altErr.message);
        throw err;
      }
    }
    throw err;
  }
};

// ============================================================================
// PARTICLE THEME COLORS
// ============================================================================
const PARTICLE_THEME_COLORS = {
  ultimate: '#8B5CF6',
  soft: '#A855F7',
  off: '#6b7280'
};

// ============================================================================
// LANDING PAGE
// ============================================================================
const LandingPage = ({ onNavigateToPlayer }) => {
  const [mode, setMode] = useState('xtream');
  const [form, setForm] = useState({ name: 'My Server', url: '', server: '', username: '', password: '', file: null });
  const [fetchOptions, setFetchOptions] = useState({ live: true, movies: true, series: true });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ step: '', percent: 0 });
  const [error, setError] = useState(null);
  const [token, setToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  
  const containerRef = useRef(null);
  
  const [particleTheme, setParticleTheme] = useState(() => {
    return localStorage.getItem('ninja_particle_theme') || 'ultimate';
  });

  const [deviceId, setDeviceId] = useState('loading...');

  // Lock landscape + log Device ID
  useEffect(() => {
    const lockLandscape = async () => {
      try {
        await ScreenOrientation.lock({ orientation: 'landscape' });
      } catch (e) {
        console.log('ScreenOrientation not available:', e);
      }
    };
    lockLandscape();

    // Device ID debug — visible on screen
    const loadDeviceId = async () => {
      const id = await getDeviceId();
      setDeviceId(id);
      console.log('🔑 [Device ID]', id);
    };
    loadDeviceId();
  }, []);

  const handleLogoClick = () => {
    setParticleTheme(current => {
      let next;
      if (current === 'ultimate') next = 'soft';
      else if (current === 'soft') next = 'off';
      else next = 'ultimate';
      
      localStorage.setItem('ninja_particle_theme', next);
      return next;
    });
  };

  // ============================================================================
  // TOKEN LOGIN — Authenticate via Ninja CMS
  // ============================================================================
  const handleTokenConnect = async () => {
    if (!token.trim()) {
      setError('Enter your activation token');
      return;
    }
    setTokenLoading(true);
    setError(null);
    try {
      const { authWithToken } = await import('../services/NinjaAPI');
      const data = await authWithToken(token.trim());
      const xtream = data.xtream_info;
      
      console.log('✅ [CMS Auth] Success:', xtream.host, xtream.username);
      console.log('📊 [CMS Auth] Devices:', data.active_devices, '/', data.device_limit);

      // Inject into existing flow — same as Xtream manual connect
      const server = normalizeServerUrl(xtream.host);
      setForm(prev => ({
        ...prev,
        server: server,
        username: xtream.username,
        password: xtream.password,
        name: xtream.playlist_name || 'NINJA 8K',
      }));

      // Auto-connect with received credentials
      const service = new XtreamService(server, xtream.username, xtream.password);
      const auth = await service.authenticate();
      if (!auth?.user?.status === 'Active') throw new Error('Account not active');

      // Save token for subscription checks
      localStorage.setItem('ninja_cms_token', token.trim());

      // Fetch data using existing flow
      setTokenLoading(false);
      setLoading(true);
      const fetchedData = await fetchXtreamData(service, fetchOptions);
      
      setTimeout(() => onNavigateToPlayer({
        name: xtream.playlist_name || 'NINJA 8K',
        type: 'xtream',
        server: server,
        username: xtream.username,
        password: xtream.password,
        data: fetchedData,
        userInfo: auth.user,
        expirationDate: xtream.exp_date || auth.expirationDate,
        addedAt: new Date().toISOString(),
      }), 500);

    } catch (err) {
      console.error('❌ [CMS Auth] Error:', err);
      setError(err.message || 'Token authentication failed');
      setTokenLoading(false);
    }
  };

  const handleNinjaPaste = async () => {
    try {
      const { value } = await Clipboard.read();
      
      if (!value) {
        alert("Presse-papier vide");
        return;
      }

      const res = parseXtreamUrl(value);
      
      if (res.hasCredentials) {
        setForm(f => ({ 
          ...f, 
          server: res.server, 
          username: res.username, 
          password: res.password 
        }));
        setMode('xtream');
      } else if (value.toLowerCase().includes('.m3u')) {
        setForm(f => ({ ...f, url: value.trim() }));
        setMode('url');
      } else {
        alert("Lien non reconnu (Lien Xtream ou M3U requis)");
      }
    } catch (err) {
      console.error("Erreur Clipboard:", err);
      const manual = window.prompt("Collez votre lien ici :");
      if (manual) {
        const res = parseXtreamUrl(manual);
        if (res.hasCredentials) {
          setForm(f => ({...f, server: res.server, username: res.username, password: res.password}));
          setMode('xtream');
        } else if (manual.toLowerCase().includes('.m3u')) {
          setForm(f => ({ ...f, url: manual.trim() }));
          setMode('url');
        }
      }
    }
  };

  // ============================================================================
  // FETCH XTREAM DATA - Stores categories in provider order
  // ============================================================================
  const fetchXtreamData = async (service, auth, connectedServer) => {
    let mappedLive = [], mappedVod = [], mappedSeries = [];
    let liveCategories = [], vodCategories = [], seriesCategories = [];

    if (fetchOptions.live) {
      setProgress({ step: 'Fetching Live TV...', percent: 30 });
      const [cats, streams] = await Promise.all([
        service.getLiveCategories(), 
        service.getLiveStreams()
      ]);
      liveCategories = cats || [];
      mappedLive = service.parseLiveStreams(streams, cats);
    }
    
    if (fetchOptions.movies) {
      setProgress({ step: 'Fetching Movies...', percent: 50 });
      const [cats, streams] = await Promise.all([
        service.getVodCategories(), 
        service.getVodStreams()
      ]);
      vodCategories = cats || [];
      mappedVod = service.parseVodStreams(streams, cats);
    }
    
    if (fetchOptions.series) {
      setProgress({ step: 'Fetching Series...', percent: 70 });
      const [cats, list] = await Promise.all([
        service.getSeriesCategories(), 
        service.getSeries()
      ]);
      seriesCategories = cats || [];
      mappedSeries = service.parseSeries(list, cats);
    }

    setProgress({ step: 'Done!', percent: 100 });

    // ========== STORE IN SQLITE FOR SEARCH ==========
    try {
      setProgress({ step: 'Indexing for search...', percent: 95 });
      await openDatabase();
      if (mappedLive.length > 0) {
        await insertChannels(mappedLive);
        console.log(`✅ Indexed ${mappedLive.length} live channels for search`);
        
        // ============================================================
        // BACKGROUND EPG SYNC - Gaming Style (Cercle 2)
        // Batching 20ch max, 1000ms pause, vrais timestamps serveur
        // ============================================================
        const epgAbortController = new AbortController();
        window.__epgAbortController = epgAbortController;
        window.__epgSyncProgress = 0;

        const startEpgBackgroundSync = async (allChannels, signal) => {
          const BATCH_SIZE = 20;
          const BATCH_DELAY = 1000;
          const streamIds = allChannels.map(ch => ch.id || ch.stream_id).filter(Boolean);
          const totalBatches = Math.ceil(streamIds.length / BATCH_SIZE);
          let batchesDone = 0;

          try {
            await cleanExpiredPrograms();
          } catch (cleanErr) {
            console.warn('⚠️ EPG cleanup skipped:', cleanErr);
          }

          for (let i = 0; i < streamIds.length; i += BATCH_SIZE) {
            if (signal.aborted) {
              console.log('🛑 EPG sync aborted');
              return;
            }

            const batchIds = streamIds.slice(i, i + BATCH_SIZE);

            try {
              const epgResults = await service.getShortEPGBatch(batchIds, 2, 20);

              if (signal.aborted) return;

              const epgForInsert = {};
              Object.entries(epgResults).forEach(([streamId, data]) => {
                const programs = [];
                if (data.epg_now) {
                  programs.push({
                    title: data.epg_now,
                    start: data.epg_start || '',
                    end: data.epg_end || '',
                    startTimestamp: data.epg_start_timestamp || null,
                    stopTimestamp: data.epg_end_timestamp || null,
                    description: data.epg_description || '',
                  });
                }
                if (data.epg_next) {
                  programs.push({
                    title: data.epg_next,
                    start: data.epg_next_start || '',
                    end: data.epg_next_end || '',
                    startTimestamp: data.epg_next_start_timestamp || null,
                    stopTimestamp: data.epg_next_end_timestamp || null,
                    description: data.epg_next_description || '',
                  });
                }
                if (programs.length > 0) {
                  epgForInsert[streamId] = programs;
                }
              });

              if (Object.keys(epgForInsert).length > 0) {
                await insertProgramsBatch(epgForInsert);
              }
            } catch (batchErr) {
              console.warn(`⚠️ EPG batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, batchErr);
            }

            batchesDone++;
            window.__epgSyncProgress = Math.round((batchesDone / totalBatches) * 100);

            if (i + BATCH_SIZE < streamIds.length && !signal.aborted) {
              await new Promise(r => setTimeout(r, BATCH_DELAY));
            }
          }

          window.__epgSyncProgress = 100;
          console.log(`✅ EPG background sync complete: ${streamIds.length} channels indexed`);
        };

        startEpgBackgroundSync(mappedLive, epgAbortController.signal).catch(err => {
          if (!epgAbortController.signal.aborted) {
            console.warn('⚠️ Background EPG sync failed:', err);
          }
        });
      }
    } catch (dbErr) {
      console.warn('⚠️ SQLite indexing failed (search may not work):', dbErr);
    }
    
    return {
      live: mappedLive,
      liveCategories,
      vod: mappedVod,
      vodCategories,
      series: mappedSeries,
      seriesCategories,
    };
  };

  // ============================================================================
  // HANDLE ADD SERVER — navigates to Player on success
  // ============================================================================
  const handleAddServer = async () => {
    setError(null);
    setLoading(true);

    try {
      if (mode === 'xtream') {
        console.log('=== XTREAM TAB ===');
        if (!form.server || !form.username || !form.password) throw new Error('Please fill all fields');
        
        setProgress({ step: 'Connecting...', percent: 10 });
        const { service, auth, server: connectedServer } = await tryConnect(form.server, form.username, form.password);
        
        const data = await fetchXtreamData(service, auth, connectedServer);

        setTimeout(() => onNavigateToPlayer({
          id: Date.now(), 
          name: form.name || 'My Server', 
          type: 'xtream',
          server: connectedServer, 
          username: form.username, 
          password: form.password,
          data,
          userInfo: auth.user, 
          expirationDate: auth.expirationDate, 
          addedAt: new Date().toISOString(),
        }), 500);

      } else if (mode === 'url') {
        console.log('=== M3U TAB ===');
        if (!form.url) throw new Error('Please enter M3U URL');
        
        setProgress({ step: 'Parsing URL...', percent: 20 });
        const parsed = parseXtreamUrl(form.url);
        
        if (parsed.hasCredentials) {
          setProgress({ step: 'Connecting...', percent: 30 });
          const { service, auth, server: connectedServer } = await tryConnect(parsed.server, parsed.username, parsed.password);
          
          const data = await fetchXtreamData(service, auth, connectedServer);

          setTimeout(() => onNavigateToPlayer({
            id: Date.now(), 
            name: form.name || 'My Server', 
            type: 'xtream',
            server: connectedServer, 
            username: parsed.username, 
            password: parsed.password,
            data,
            userInfo: auth.user, 
            expirationDate: auth.expirationDate, 
            addedAt: new Date().toISOString(),
          }), 500);
        } else {
          throw new Error('URL must contain Xtream credentials (username & password)');
        }

      } else if (mode === 'file') {
        if (!form.file) throw new Error('Please select a file');
        
        setProgress({ step: 'Reading file...', percent: 20 });
        const content = await form.file.text();
        
        setProgress({ step: 'Parsing...', percent: 30 });
        const parsed = parseXtreamUrl(content);
        
        if (parsed.hasCredentials) {
          setProgress({ step: 'Connecting...', percent: 40 });
          const { service, auth, server: connectedServer } = await tryConnect(parsed.server, parsed.username, parsed.password);
          
          const data = await fetchXtreamData(service, auth, connectedServer);

          setTimeout(() => onNavigateToPlayer({
            id: Date.now(), 
            name: form.name || form.file.name, 
            type: 'xtream',
            server: connectedServer, 
            username: parsed.username, 
            password: parsed.password,
            data,
            userInfo: auth.user, 
            expirationDate: auth.expirationDate, 
            addedAt: new Date().toISOString(),
          }), 500);
        } else {
          throw new Error('File must contain Xtream credentials (username & password)');
        }
      }
    } catch (err) {
      console.error('❌ Error:', err);
      setError(err.message || 'Failed to add server');
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen progress={progress} />;

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 flex overflow-hidden relative" 
      style={{ background: THEME.colors.bg }}
    >
      {/* Particles */}
      {particleTheme !== 'off' && (
        <div className="fixed inset-0 pointer-events-none z-0">
          <ParticleThemes containerRef={containerRef} theme={particleTheme} />
        </div>
      )}
      
      <div className="relative z-10 flex w-full h-full items-center justify-center gap-8 px-8">
        {/* Left — Logo + Token Login */}
        <div className="flex flex-col items-center justify-center" style={{ minWidth: '280px', maxWidth: '320px' }}>
          <h1 
            onClick={handleLogoClick}
            className="text-white text-4xl font-black italic tracking-tighter cursor-pointer select-none active:scale-95 transition-transform mb-6"
            style={{ 
              textShadow: particleTheme !== 'off' 
                ? `0 0 15px ${PARTICLE_THEME_COLORS[particleTheme]}50` 
                : 'none' 
            }}
          >
            NINJA <span style={{ color: PARTICLE_THEME_COLORS[particleTheme] }}>8K</span>
          </h1>

          {/* Token Login Card */}
          <div 
            className="w-full rounded-xl p-4"
            style={{ 
              background: 'rgba(18, 18, 31, 0.45)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(98, 37, 255, 0.2)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <p className="text-[9px] uppercase tracking-widest font-bold mb-3" style={{ color: '#6225ff' }}>
              ACTIVATION TOKEN
            </p>
            <input
              type="text"
              placeholder="26-02-XXXXXX"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              style={{
                width: '100%', padding: '12px', background: '#0a0a0f',
                border: '1px solid rgba(98, 37, 255, 0.3)', borderRadius: '6px',
                color: '#fff', fontSize: '14px', fontFamily: 'monospace',
                fontWeight: 800, letterSpacing: '2px', textAlign: 'center',
                outline: 'none',
              }}
            />
            <button
              onClick={handleTokenConnect}
              disabled={tokenLoading || !token.trim()}
              style={{
                width: '100%', marginTop: '10px', padding: '12px',
                background: token.trim() ? 'linear-gradient(135deg, #6225ff 0%, #a020f0 100%)' : 'rgba(255,255,255,0.06)',
                color: '#fff', border: 'none', borderRadius: '6px',
                fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px',
                fontSize: '11px', cursor: token.trim() ? 'pointer' : 'not-allowed',
                opacity: tokenLoading ? 0.5 : 1,
              }}
            >
              {tokenLoading ? 'CONNECTING...' : 'ENTER SYSTEM'}
            </button>
          </div>

          {/* Disclaimer */}
          <div 
            className="w-full rounded-xl p-2 flex items-center justify-center gap-2 mt-3"
            style={{ 
              background: 'rgba(18, 18, 31, 0.3)',
              border: '1px solid rgba(98, 37, 255, 0.1)',
            }}
          >
            <div className="w-3 h-3 text-gray-600"><Icons.Info/></div>
            <p className="text-gray-600 text-[9px] font-bold uppercase tracking-wider">We do not provide any content.</p>
          </div>

          <p className="text-gray-600 text-[10px] font-bold mt-4">Ninja 8K | All Rights Reserved</p>
          <p className="text-gray-700 text-[9px]">Version 2.0</p>
          <p className="text-gray-700 text-[8px] mt-1 font-mono" style={{ opacity: 0.4 }}>ID: {deviceId}</p>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '60%', background: 'rgba(98, 37, 255, 0.15)' }} />

        {/* Right — Manual / Advanced */}
        <div style={{ width: '380px', maxHeight: '90vh', overflowY: 'auto' }}>
          {/* Error */}
          {error && (
            <div 
              className="rounded-xl p-3 mb-3"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                boxShadow: '0 4px 20px rgba(239, 68, 68, 0.1)',
              }}
            >
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          {/* Playlist Form */}
          <PlaylistForm 
            mode={mode} setMode={setMode} 
            form={form} setForm={setForm}
            fetchOptions={fetchOptions} setFetchOptions={setFetchOptions}
            onNinjaPaste={handleNinjaPaste} 
            onAddServer={handleAddServer}
          />
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
