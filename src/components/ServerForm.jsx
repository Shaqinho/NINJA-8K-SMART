import React, { useRef, useState, useEffect } from 'react';
import { Clipboard } from '@capacitor/clipboard';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { XtreamService, parseXtreamUrl } from '../services/XtreamService';
import { generateNinjaPIN } from '../services/ninjaAuth';
import { getDeviceId } from '../services/NinjaAPI';
import { THEME } from '../constants/theme';
import { Icons } from './Icons';
import { LoadingScreen } from './LoadingScreen';
import ParticleThemes from './ParticleThemes';
import { 
  insertChannels, 
  insertLiveCategories,
  insertVODCategories,
  insertSeriesCategories,
  insertVODItems,
  insertSeriesItems,
  insertVODItemsChunked,
  insertSeriesItemsChunked,
  loadXMLTV 
} from '../database/ProgramQueries';

// ============================================================================
// GLASS STYLES - Transparent pour voir les particules
// ============================================================================
const glassCard = {
  background: 'rgba(18, 18, 31, 0.5)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(98, 37, 255, 0.3)',
};

const glassInput = {
  background: '#0a0a0f',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
};

const glassInputFocus = {
  background: '#0a0a0f',
  border: '1px solid rgba(139, 92, 246, 0.4)',
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
// SERVER FORM (Landscape 500px) - STANDALONE VERSION
// ============================================================================
export const ServerForm = ({ onNavigateToPlayer }) => {
  const [mode, setMode] = useState('xtream');
  const [form, setForm] = useState({ 
    name: 'My Server', 
    url: '', 
    server: '', 
    username: '', 
    password: '', 
    file: null 
  });
  const [fetchOptions, setFetchOptions] = useState({ live: true, movies: true, series: true });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ step: '', percent: 0 });
  const [error, setError] = useState(null);
  const [ninjaPin, setNinjaPin] = useState('----');
  const [deviceId, setDeviceId] = useState('loading...');
  const [selectedFile, setSelectedFile] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
  
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  
  const [particleTheme, setParticleTheme] = useState(() => {
    return localStorage.getItem('ninja_particle_theme') || 'ultimate';
  });

  // ============================================================================
  // INIT - Lock landscape + Device ID + NINJA PIN + Particle theme
  // ============================================================================
  useEffect(() => {
    const lockLandscape = async () => {
      try {
        await ScreenOrientation.lock({ orientation: 'landscape' });
      } catch (e) {
        console.log('ScreenOrientation not available:', e);
      }
    };
    lockLandscape();

    const loadDeviceId = async () => {
      const id = await getDeviceId();
      setDeviceId(id);
      
      const pin = generateNinjaPIN(id);
      setNinjaPin(pin);
      
      console.log('🔑 [Device ID]', id);
      console.log('🔐 [NINJA PIN]', pin);
    };
    loadDeviceId();
  }, []);

  // ============================================================================
  // LOGO CLICK - Cycle particle themes
  // ============================================================================
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
  // CLIPBOARD PASTE - Fixed using Capacitor
  // ============================================================================
  const fieldPaste = async (field) => {
    try {
      const { value } = await Clipboard.read();
      if (value) {
        setForm(f => ({ ...f, [field]: value.trim() }));
      }
    } catch (e) {
      try {
        const text = await navigator.clipboard.readText();
        if (text) setForm(f => ({ ...f, [field]: text.trim() }));
      } catch (e2) {
        console.error('Clipboard paste failed:', e2);
        const manual = window.prompt(`Paste ${field} here:`);
        if (manual) setForm(f => ({ ...f, [field]: manual.trim() }));
      }
    }
  };

  // ============================================================================
  // NINJA PASTE - Auto-parse clipboard
  // ============================================================================
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

    // PARALLÉLISATION : Lancer XMLTV en background immédiatement
    let xmltvPromise = null;
    if (fetchOptions.live) {
      xmltvPromise = loadXMLTV(service).catch(err => {
        console.warn('⚠️ Background XMLTV load failed:', err);
        return { success: false };
      });
      console.log('🔄 XMLTV loading started in background...');
    }

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

    // STORE IN SQLITE FOR SEARCH
    try {
      setProgress({ step: 'Indexing for search...', percent: 85 });
      
      if (window.db) {
        await Promise.race([
          Promise.all([
            mappedLive.length > 0 && insertChannels(mappedLive),
            liveCategories.length > 0 && insertLiveCategories(liveCategories),
            mappedVod.length > 0 && insertVODItems(mappedVod),
            mappedSeries.length > 0 && insertSeriesItems(mappedSeries),
            vodCategories.length > 0 && insertVODCategories(vodCategories),
            seriesCategories.length > 0 && insertSeriesCategories(seriesCategories)
          ].filter(Boolean)),
          new Promise(resolve => setTimeout(resolve, 8000))
        ]);
        console.log("✅ Indexation terminée via instance partagée");
      } else {
        console.warn('⚠️ window.db not available, skipping indexation');
      }
      
      // XMLTV EPG LOADING - Récupérer le résultat du background load
      if (mappedLive.length > 0 && xmltvPromise) {
        setProgress({ step: 'Loading XMLTV EPG...', percent: 90 });
        
        const xmltvResult = await xmltvPromise;
        
        if (xmltvResult.success) {
          console.log(`✅ XMLTV loaded: ${xmltvResult.channelsCount} channels, ${xmltvResult.programsCount} programs in ${xmltvResult.elapsed}s`);
        } else {
          console.warn('⚠️ XMLTV load failed, EPG will be fetched on-demand');
        }
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
        
        // Store expected totals for integrity check
        localStorage.setItem('ninja_expected_live', data.live.length);
        localStorage.setItem('ninja_expected_vod', data.vod.length);
        localStorage.setItem('ninja_expected_series', data.series.length);
        
        // Launch background save with tracking
        if (window.db) {
          localStorage.setItem('ninja_save_status', 'incomplete'); // Set incomplete at start
          window.__ninjaSavePromise = (async () => {
            try {
              console.log('💾 Starting background save...');
              
              // Save server + categories first (for auto-login)
              const { saveServer } = await import('../database/NinjaLocalDB');
              await saveServer({ 
                name: form.name || 'My Server', 
                url: connectedServer, 
                username: form.username, 
                password: form.password 
              });
              
              await Promise.all([
                insertLiveCategories(data.liveCategories),
                insertVODCategories(data.vodCategories),
                insertSeriesCategories(data.seriesCategories),
                insertChannels(data.live),
              ]);
              
              console.log('✅ Priority data saved (server + categories + channels)');
              
              // VOD/Series with chunking (sequential to avoid DB lock)
              await insertVODItemsChunked(data.vod);
              await insertSeriesItemsChunked(data.series);
              
              console.log('✅ Background save complete');
              localStorage.setItem('ninja_save_status', 'complete');
            } catch (err) {
              console.error('❌ Background save failed:', err);
              localStorage.setItem('ninja_save_status', 'incomplete');
              throw err;
            }
          })();
        }

        setTimeout(() => onNavigateToPlayer({
          id: Date.now(), 
          name: form.name || 'My Server', 
          type: 'xtream',
          server: connectedServer, 
          username: form.username, 
          password: form.password,
          data,
          service,  // ← PASS THE SERVICE!
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
          
          // Store expected totals for integrity check
          localStorage.setItem('ninja_expected_live', data.live.length);
          localStorage.setItem('ninja_expected_vod', data.vod.length);
          localStorage.setItem('ninja_expected_series', data.series.length);
          
          // Launch background save with tracking
          if (window.db) {
            window.__ninjaSavePromise = (async () => {
              try {
                console.log('💾 Starting background save...');
                
                const { saveServer } = await import('../database/NinjaLocalDB');
                await saveServer({ 
                  name: form.name || 'My Server', 
                  url: connectedServer, 
                  username: parsed.username, 
                  password: parsed.password 
                });
                
                await Promise.all([
                  insertLiveCategories(data.liveCategories),
                  insertVODCategories(data.vodCategories),
                  insertSeriesCategories(data.seriesCategories),
                  insertChannels(data.live),
                ]);
                
                console.log('✅ Priority data saved');
                
                await insertVODItemsChunked(data.vod);
                await insertSeriesItemsChunked(data.series);
                
                console.log('✅ Background save complete');
                localStorage.setItem('ninja_save_status', 'complete');
              } catch (err) {
                console.error('❌ Background save failed:', err);
                localStorage.setItem('ninja_save_status', 'incomplete');
                throw err;
              }
            })();
          }

          setTimeout(() => onNavigateToPlayer({
            id: Date.now(), 
            name: form.name || 'My Server', 
            type: 'xtream',
            server: connectedServer, 
            username: parsed.username, 
            password: parsed.password,
            data,
            service,  // ← PASS THE SERVICE!
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
          
          // Store expected totals for integrity check
          localStorage.setItem('ninja_expected_live', data.live.length);
          localStorage.setItem('ninja_expected_vod', data.vod.length);
          localStorage.setItem('ninja_expected_series', data.series.length);
          
          // Launch background save with tracking
          if (window.db) {
            window.__ninjaSavePromise = (async () => {
              try {
                console.log('💾 Starting background save...');
                
                const { saveServer } = await import('../database/NinjaLocalDB');
                await saveServer({ 
                  name: form.name || form.file.name, 
                  url: connectedServer, 
                  username: parsed.username, 
                  password: parsed.password 
                });
                
                await Promise.all([
                  insertLiveCategories(data.liveCategories),
                  insertVODCategories(data.vodCategories),
                  insertSeriesCategories(data.seriesCategories),
                  insertChannels(data.live),
                ]);
                
                console.log('✅ Priority data saved');
                
                await insertVODItemsChunked(data.vod);
                await insertSeriesItemsChunked(data.series);
                
                console.log('✅ Background save complete');
                localStorage.setItem('ninja_save_status', 'complete');
              } catch (err) {
                console.error('❌ Background save failed:', err);
                localStorage.setItem('ninja_save_status', 'incomplete');
                throw err;
              }
            })();
          }

          setTimeout(() => onNavigateToPlayer({
            id: Date.now(), 
            name: form.name || form.file.name, 
            type: 'xtream',
            server: connectedServer, 
            username: parsed.username, 
            password: parsed.password,
            data,
            service,  // ← PASS THE SERVICE!
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

  // ============================================================================
  // FILE HANDLING
  // ============================================================================
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && (file.name.endsWith('.m3u') || file.name.endsWith('.m3u8'))) {
      setSelectedFile(file);
      setForm(f => ({ ...f, file }));
    }
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  const getInputStyle = (field) => ({
    ...glassInput,
    ...(focusedField === field ? glassInputFocus : {}),
    transition: 'all 0.2s ease',
  });

  // ============================================================================
  // RENDER
  // ============================================================================
  if (loading) return <LoadingScreen progress={progress} />;

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 flex overflow-y-auto relative z-50" 
      style={{ background: THEME.colors.bg, minHeight: '100vh' }}
    >
      {/* Particles */}
      {particleTheme !== 'off' && (
        <div className="fixed inset-0 h-screen w-screen pointer-events-none z-0">
          <ParticleThemes containerRef={containerRef} theme={particleTheme} />
        </div>
      )}
      
      {/* Main Content - Centered */}
      <div className="relative z-10 flex w-full min-h-full items-center justify-center px-6 py-6" style={{ paddingTop: '15px' }}>
        <div style={{ width: '500px', maxHeight: 'none', overflowY: 'visible' }}>
          
          {/* Error Banner */}
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

          {/* Form Card */}
          <div className="space-y-2">
            {/* ROW 1 - NINJA 8K Logo */}
            <div className="flex items-center justify-center">
              <h1 
                onClick={handleLogoClick}
                className="text-white font-black italic tracking-tighter cursor-pointer select-none active:scale-95 transition-transform"
                style={{ 
                  fontSize: '20px', 
                  textShadow: particleTheme !== 'off' 
                    ? `0 0 12px ${PARTICLE_THEME_COLORS[particleTheme]}50` 
                    : 'none' 
                }}
              >
                NINJA <span style={{ color: PARTICLE_THEME_COLORS[particleTheme] }}>8K</span>
              </h1>
            </div>

            {/* ROW 2 - NINJA ID | NINJA PIN */}
            <div className="grid grid-cols-2 gap-2">
              {/* NINJA ID */}
              <div>
                <p className="uppercase tracking-widest font-bold mb-1" style={{ color: '#6225ff', fontSize: '7px' }}>
                  NINJA ID
                </p>
                <input
                  type="text"
                  value={deviceId || 'loading...'}
                  readOnly
                  style={{
                    width: '100%',
                    height: '32px',
                    padding: '0 6px',
                    background: '#0a0a0f',
                    border: '1px solid rgba(98, 37, 255, 0.3)',
                    borderRadius: '4px',
                    color: '#888',
                    fontSize: '7px',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    textAlign: 'center',
                    outline: 'none',
                    cursor: 'default',
                  }}
                />
              </div>
              {/* NINJA PIN */}
              <div>
                <p className="uppercase tracking-widest font-bold mb-1" style={{ color: '#6225ff', fontSize: '7px' }}>
                  NINJA PIN
                </p>
                <input
                  type="text"
                  value={ninjaPin || '----'}
                  readOnly
                  style={{
                    width: '100%',
                    height: '32px',
                    padding: '0 6px',
                    background: '#0a0a0f',
                    border: '1px solid rgba(98, 37, 255, 0.3)',
                    borderRadius: '4px',
                    color: '#888',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    fontWeight: 900,
                    letterSpacing: '2px',
                    textAlign: 'center',
                    outline: 'none',
                    cursor: 'default',
                  }}
                />
              </div>
            </div>

            {/* ROW 3 - Mode Tabs */}
            <div className="flex gap-1 p-1 rounded-xl" style={glassCard}>
              {[
                { id: 'url', label: 'M3U', icon: Icons.Link },
                { id: 'xtream', label: 'XTREAM', icon: Icons.Server },
                { id: 'file', label: 'FILE', icon: Icons.Upload }
              ].map(t => (
                <button 
                  key={t.id} 
                  onClick={() => setMode(t.id)} 
                  className={`flex-1 py-2 rounded-lg text-[9px] font-black flex items-center justify-center gap-1 transition-all ${
                    mode === t.id 
                      ? 'text-white shadow-lg shadow-purple-500/20' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`} 
                  style={{ 
                    background: mode === t.id ? THEME.gradients.primary : 'transparent' 
                  }}
                >
                  <div className="w-3 h-3"><t.icon/></div>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ROW 4 - My Server Input */}
            <div className="relative">
              <input 
                type="text" 
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})} 
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                placeholder="My Server" 
                className="w-full px-3 py-2 rounded-xl text-white text-xs outline-none font-medium placeholder-gray-600" 
                style={getInputStyle('name')}
              />
              <button 
                onClick={() => setForm({...form, name: 'NINJA | 8K'})} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-500 uppercase tracking-tight hover:text-purple-400 transition-colors"
              >
                Auto
              </button>
            </div>

            {/* ROW 5 - Ninja Paste */}
            <button 
              onClick={handleNinjaPaste} 
              className="w-full py-2 rounded-xl text-[10px] font-black text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              style={{ 
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(168, 85, 247, 0.3))',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                boxShadow: '0 4px 20px rgba(139, 92, 246, 0.2)',
              }}
            >
              🥷 Ninja Paste
            </button>

            {/* ROW 6 - URL / User / Password Inputs */}
            {mode === 'xtream' ? (
              <div className="grid grid-cols-3 gap-2">
                <div className="relative">
                  <input 
                    type="text" 
                    value={form.server} 
                    onChange={e => setForm({...form, server: e.target.value})} 
                    onFocus={() => setFocusedField('server')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="http:// or https://" 
                    className="w-full px-3 py-2 rounded-xl text-white text-xs pr-10 outline-none placeholder-gray-600" 
                    style={getInputStyle('server')}
                  />
                  <button 
                    onClick={() => fieldPaste('server')} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors"
                  >
                    <div className="w-3.5 h-3.5"><Icons.Copy/></div>
                  </button>
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    value={form.username} 
                    onChange={e => setForm({...form, username: e.target.value})} 
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="User" 
                    className="w-full px-3 py-2 rounded-xl text-white text-xs pr-10 outline-none placeholder-gray-600" 
                    style={getInputStyle('username')}
                  />
                  <button 
                    onClick={() => fieldPaste('username')} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors"
                  >
                    <div className="w-3.5 h-3.5"><Icons.Copy/></div>
                  </button>
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    value={form.password} 
                    onChange={e => setForm({...form, password: e.target.value})} 
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Password" 
                    className="w-full px-3 py-2 rounded-xl text-white text-xs pr-10 outline-none placeholder-gray-600" 
                    style={getInputStyle('password')}
                  />
                  <button 
                    onClick={() => fieldPaste('password')} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors"
                  >
                    <div className="w-3.5 h-3.5"><Icons.Copy/></div>
                  </button>
                </div>
              </div>
            ) : mode === 'url' ? (
              <div className="relative">
                <input 
                  type="text" 
                  value={form.url} 
                  onChange={e => setForm({...form, url: e.target.value})} 
                  onFocus={() => setFocusedField('url')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="http:// or https://" 
                  className="w-full px-3 py-2 rounded-xl text-white text-xs pr-10 outline-none placeholder-gray-600" 
                  style={getInputStyle('url')}
                />
                <button 
                  onClick={() => fieldPaste('url')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors"
                >
                  <div className="w-3.5 h-3.5"><Icons.Clipboard/></div>
                </button>
              </div>
            ) : (
              <div>
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  accept=".m3u,.m3u8" 
                  onChange={handleFileSelect} 
                  className="hidden"
                />
                <button 
                  onClick={triggerFileInput} 
                  className="w-full py-3 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all hover:border-purple-500/40 active:scale-[0.98]" 
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.02)', 
                    borderColor: selectedFile ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)' 
                  }}
                >
                  <div className={`w-6 h-6 ${selectedFile ? 'text-purple-400' : 'text-gray-600'}`}>
                    <Icons.Upload/>
                  </div>
                  {selectedFile ? (
                    <div className="text-center">
                      <p className="text-white text-xs font-bold">{selectedFile.name}</p>
                      <p className="text-gray-500 text-[9px]">Tap to change file</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-gray-400 text-xs font-medium">Upload M3U File</p>
                      <p className="text-gray-600 text-[9px]">.m3u or .m3u8</p>
                    </div>
                  )}
                </button>
              </div>
            )}

            {/* ROW 7 - Content Options */}
            <div className="flex gap-2">
              {[
                { id: 'live', label: 'Live', icon: Icons.Tv },
                { id: 'movies', label: 'Movies', icon: Icons.Film },
                { id: 'series', label: 'Series', icon: Icons.Popcorn }
              ].map(opt => (
                <button 
                  key={opt.id} 
                  onClick={() => setFetchOptions(p => ({...p, [opt.id]: !p[opt.id]}))} 
                  className={`flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1 transition-all active:scale-95 ${
                    fetchOptions[opt.id] 
                      ? 'opacity-100' 
                      : 'opacity-40'
                  }`}
                  style={{
                    background: fetchOptions[opt.id] 
                      ? 'rgba(139, 92, 246, 0.15)' 
                      : 'rgba(255, 255, 255, 0.03)',
                    border: fetchOptions[opt.id] 
                      ? '1px solid rgba(139, 92, 246, 0.4)' 
                      : '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div className="w-3 h-3 text-white flex-shrink-0"><opt.icon/></div>
                  <span className="text-[8px] font-black text-white uppercase">{opt.label}</span>
                  {fetchOptions[opt.id] && (
                    <div className="w-3 h-3 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 text-white"><Icons.Check/></div>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* ROW 8 - Add Server Button */}
            <button 
              onClick={handleAddServer} 
              className="w-full py-3 rounded-xl text-white font-black text-xs flex items-center justify-center active:scale-[0.98] transition-all"
              style={{ 
                background: THEME.gradients.primary,
                boxShadow: '0 8px 32px rgba(139, 92, 246, 0.35)',
              }}
            >
              ADD SERVER
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
