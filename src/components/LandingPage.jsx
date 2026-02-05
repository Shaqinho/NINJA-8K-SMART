import React, { useState, useRef } from 'react';
import { Clipboard } from '@capacitor/clipboard';
import { THEME } from '../constants/theme';
import { XtreamService, parseXtreamUrl, DEMO_CONTENT } from '../services/XtreamService';
import { Icons } from './Icons';
import { LoadingScreen } from './LoadingScreen';
import { ActivationBlock } from './ActivationBlock';
import { PlaylistForm } from './PlaylistForm';
import ParticleThemes from './ParticleThemes';
import { openDatabase } from '../database/NinjaLocalDB';
import { insertChannels, insertProgramsBatch, cleanExpiredPrograms } from '../database/ProgramQueries';

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
    
    // Essayer l'autre protocole
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
// PARTICLE THEME COLORS - Visual feedback on logo
// ============================================================================
const PARTICLE_THEME_COLORS = {
  ultimate: '#8B5CF6',
  soft: '#A855F7',
  off: '#6b7280'
};

// ============================================================================
// LANDING PAGE
// ============================================================================
const LandingPage = ({ onNavigateToSmart, onVerifyActivation }) => {
  const [mode, setMode] = useState('xtream');
  const [form, setForm] = useState({ name: 'My Server', url: '', server: '', username: '', password: '', file: null });
  const [fetchOptions, setFetchOptions] = useState({ live: true, movies: true, series: true });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ step: '', percent: 0 });
  const [error, setError] = useState(null);
  
  const containerRef = useRef(null);
  
  const [particleTheme, setParticleTheme] = useState(() => {
    return localStorage.getItem('ninja_particle_theme') || 'ultimate';
  });

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

          // Clean expired programs before starting
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
              // Fetch real EPG data from server (getShortEPG per channel returns real start/stop)
              const epgResults = await service.getShortEPGBatch(batchIds, 2, 20);

              if (signal.aborted) return;

              // Build insert payload with REAL server timestamps
              const epgForInsert = {};
              Object.entries(epgResults).forEach(([streamId, data]) => {
                const programs = [];
                // Current program
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
                // Next program(s) if available
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
              // Continue with next batch - don't break the whole sync
            }

            batchesDone++;
            window.__epgSyncProgress = Math.round((batchesDone / totalBatches) * 100);

            // Real pause between batches (not on last batch)
            if (i + BATCH_SIZE < streamIds.length && !signal.aborted) {
              await new Promise(r => setTimeout(r, BATCH_DELAY));
            }
          }

          window.__epgSyncProgress = 100;
          console.log(`✅ EPG background sync complete: ${streamIds.length} channels indexed`);
        };

        // Launch in background - non-blocking
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

  const handleAddServer = async () => {
    setError(null);
    setLoading(true);

    try {
      if (mode === 'xtream') {
        console.log('=== XTREAM TAB ===');
        console.log('Server:', form.server);
        console.log('Username:', form.username);
        console.log('Password:', form.password);
        
        if (!form.server || !form.username || !form.password) throw new Error('Please fill all fields');
        
        setProgress({ step: 'Connecting...', percent: 10 });
        const { service, auth, server: connectedServer } = await tryConnect(form.server, form.username, form.password);
        
        const data = await fetchXtreamData(service, auth, connectedServer);

        setTimeout(() => onNavigateToSmart({
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
        console.log('1. Raw URL:', form.url);
        console.log('   URL length:', form.url?.length);
        
        if (!form.url) throw new Error('Please enter M3U URL');
        
        setProgress({ step: 'Parsing URL...', percent: 20 });
        const parsed = parseXtreamUrl(form.url);
        
        console.log('2. Parsed result:', parsed);
        
        if (parsed.hasCredentials) {
          console.log('3. Has credentials!');
          console.log('   Server:', parsed.server);
          console.log('   Username:', parsed.username);
          console.log('   Password:', parsed.password);
          
          setProgress({ step: 'Connecting...', percent: 30 });
          const { service, auth, server: connectedServer } = await tryConnect(parsed.server, parsed.username, parsed.password);
          
          console.log('4. Auth success!');
          
          const data = await fetchXtreamData(service, auth, connectedServer);
          
          console.log('5. Data fetched:', {
            live: data.live?.length,
            vod: data.vod?.length,
            series: data.series?.length,
          });

          setTimeout(() => onNavigateToSmart({
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
          console.log('3. No credentials found!');
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

          setTimeout(() => onNavigateToSmart({
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

  const handleDemo = () => {
    setLoading(true);
    setProgress({ step: 'Loading demo...', percent: 50 });
    setTimeout(() => {
      setProgress({ step: 'Ready!', percent: 100 });
      setTimeout(() => onNavigateToSmart({
        id: Date.now(), 
        name: 'NINJA Demo', 
        type: 'demo', 
        isDemo: true, 
        data: {
          ...DEMO_CONTENT,
          liveCategories: [],
          vodCategories: [
            { category_id: '4k', category_name: '4K Demo' },
            { category_id: 'audio', category_name: 'Audio Demo' },
            { category_id: 'hdr', category_name: 'HDR Demo' },
            { category_id: 'dv', category_name: 'Dolby Vision' },
            { category_id: 'sub', category_name: 'Subtitle Demo' },
          ],
          seriesCategories: [],
        },
        addedAt: new Date().toISOString(), 
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }), 500);
    }, 1000);
  };

  if (loading) return <LoadingScreen progress={progress} />;

  return (
    <div 
      ref={containerRef}
      className="min-h-screen flex flex-col overflow-y-auto pb-8 relative" 
      style={{ 
        background: THEME.colors.bg,
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {particleTheme !== 'off' && (
        <div className="fixed inset-0 pointer-events-none z-0">
          <ParticleThemes containerRef={containerRef} theme={particleTheme} />
        </div>
      )}
      
      <div className="relative z-10">
        <div className="text-center pt-8 pb-4">
          <h1 
            onClick={handleLogoClick}
            className="text-white text-4xl font-black italic tracking-tighter cursor-pointer select-none active:scale-95 transition-transform"
            style={{ 
              textShadow: particleTheme !== 'off' 
                ? `0 0 15px ${PARTICLE_THEME_COLORS[particleTheme]}50` 
                : 'none' 
            }}
          >
            NINJA <span style={{ color: PARTICLE_THEME_COLORS[particleTheme] }}>8K</span>
          </h1>
        </div>

        <div className="max-w-md mx-auto w-full px-4 space-y-4">
          <ActivationBlock onVerifyActivation={onVerifyActivation} />

          <div className="rounded-xl p-3 flex items-center justify-center gap-2" style={{ background: 'rgba(18, 18, 31, 0.5)', border: '1px solid rgba(98, 37, 255, 0.3)' }}>
            <div className="w-3.5 h-3.5 text-gray-500"><Icons.Info/></div>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">We do not provide any content.</p>
          </div>

          {error && (
            <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/30">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          <PlaylistForm 
            mode={mode} setMode={setMode} 
            form={form} setForm={setForm}
            fetchOptions={fetchOptions} setFetchOptions={setFetchOptions}
            onNinjaPaste={handleNinjaPaste} 
            onAddServer={handleAddServer}
          />

          <div className="py-1 space-y-3">
            <div className="flex items-center gap-3 px-4 opacity-30">
              <div className="flex-1 h-px bg-white"></div>
              <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">OR</span>
              <div className="flex-1 h-px bg-white"></div>
            </div>
            <button onClick={handleDemo} className="w-full py-3 rounded-xl text-gray-400 font-bold text-base transition-all active:scale-95" style={{ background: 'rgba(18, 18, 31, 0.5)', border: '1px solid rgba(98, 37, 255, 0.3)' }}>
              7 DAYS DEMO
            </button>
          </div>

          <div className="pt-6 pb-2 text-center">
            <p className="text-gray-600 text-[10px] font-bold">Ninja 8K | All Rights Reserved</p>
            <p className="text-gray-700 text-[9px]">Version 1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
