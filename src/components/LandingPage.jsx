import React, { useState, useRef, useEffect } from 'react';
import { Clipboard } from '@capacitor/clipboard';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { XtreamService, parseXtreamUrl } from '../services/XtreamService';
import { generateNinjaPIN } from '../services/ninjaAuth';
import { Icons } from './Icons';
import { LoadingScreen } from './LoadingScreen';
import { PlaylistForm } from './PlaylistForm';
import ParticleThemes from './ParticleThemes';
import { openDatabase } from '../database/NinjaLocalDB';
import { 
  insertChannels, 
  insertLiveCategories,
  insertVODCategories,
  insertSeriesCategories,
  insertVODItems,
  insertSeriesItems,
  loadXMLTV 
} from '../database/ProgramQueries';
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
  // const [token, setToken] = useState('');
  // const [tokenLoading, setTokenLoading] = useState(false);
  const [ninjaPin, setNinjaPin] = useState('----');
  
  const containerRef = useRef(null);
  
  const [particleTheme, setParticleTheme] = useState(() => {
    return localStorage.getItem('ninja_particle_theme') || 'ultimate';
  });

  // Lock landscape + log Device ID + Calculate PIN
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
      
      // Calculate NINJA PIN
      const pin = generateNinjaPIN(id);
      setNinjaPin(pin);
      
      console.log('🔑 [Device ID]', id);
      console.log('🔐 [NINJA PIN]', pin);
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
  /* DISABLED - Uncomment when needed
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
  */

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
      setProgress({ step: 'Indexing for search...', percent: 85 });
      await openDatabase();
      
      // ========== SAVE LIVE CHANNELS & CATEGORIES ==========
      if (mappedLive.length > 0) {
        await insertChannels(mappedLive);
        console.log(`✅ Indexed ${mappedLive.length} live channels for search`);
      }
      
      if (liveCategories.length > 0) {
        await insertLiveCategories(liveCategories);
        console.log(`✅ Saved ${liveCategories.length} live categories`);
      }
      
      // ========== SAVE VOD ITEMS & CATEGORIES ==========
      if (mappedVod.length > 0) {
        await insertVODItems(mappedVod);
        console.log(`✅ Saved ${mappedVod.length} VOD items`);
      }
      
      if (vodCategories.length > 0) {
        await insertVODCategories(vodCategories);
        console.log(`✅ Saved ${vodCategories.length} VOD categories`);
      }
      
      // ========== SAVE SERIES ITEMS & CATEGORIES ==========
      if (mappedSeries.length > 0) {
        await insertSeriesItems(mappedSeries);
        console.log(`✅ Saved ${mappedSeries.length} series items`);
      }
      
      if (seriesCategories.length > 0) {
        await insertSeriesCategories(seriesCategories);
        console.log(`✅ Saved ${seriesCategories.length} series categories`);
      }
      
      // ============================================================
      // XMLTV EPG LOADING - Fast bulk load (34s for 70-80% channels)
      // ============================================================
      if (mappedLive.length > 0) {
        setProgress({ step: 'Loading XMLTV EPG...', percent: 90 });
        
        const xmltvResult = await loadXMLTV(service);
        
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
      
      <div className="relative z-10 flex w-full h-full items-center justify-center gap-6 px-6">
        {/* Left — Logo + Token Login */}
        <div className="flex flex-col items-center justify-center" style={{ minWidth: '240px', maxWidth: '260px' }}>
          <h1 
            onClick={handleLogoClick}
            className="text-white text-3xl font-black italic tracking-tighter cursor-pointer select-none active:scale-95 transition-transform mb-3"
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
            className="w-full rounded-lg p-3"
            style={{ 
              background: 'rgba(18, 18, 31, 0.45)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(98, 37, 255, 0.2)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <p className="text-[8px] uppercase tracking-widest font-bold mb-2" style={{ color: '#6225ff' }}>
              NINJA ID
            </p>
            <input
              type="text"
              value={deviceId}
              readOnly
              style={{
                width: '100%', padding: '8px', background: '#0a0a0f',
                border: '1px solid rgba(98, 37, 255, 0.3)', borderRadius: '4px',
                color: '#888', fontSize: '9px', fontFamily: 'monospace',
                fontWeight: 700, letterSpacing: '0.5px', textAlign: 'center',
                outline: 'none', cursor: 'default',
              }}
            />
            <div style={{ marginTop: '8px' }}>
              <p className="text-[8px] uppercase tracking-widest font-bold mb-2" style={{ color: '#6225ff' }}>
                SECURITY PIN
              </p>
              <input
                type="text"
                value={ninjaPin}
                readOnly
                style={{
                  width: '100%', padding: '10px', background: '#0a0a0f',
                  border: '1px solid rgba(98, 37, 255, 0.3)', borderRadius: '4px',
                  color: '#4ade80', fontSize: '18px', fontFamily: 'monospace',
                  fontWeight: 900, letterSpacing: '6px', textAlign: 'center',
                  outline: 'none', cursor: 'default',
                }}
              />
            </div>
          </div>

          {/* Disclaimer */}
          <div 
            className="w-full rounded-lg p-1.5 flex items-center justify-center gap-1.5 mt-2"
            style={{ 
              background: 'rgba(18, 18, 31, 0.3)',
              border: '1px solid rgba(98, 37, 255, 0.1)',
            }}
          >
            <div className="w-2.5 h-2.5 text-gray-600"><Icons.Info/></div>
            <p className="text-gray-600 text-[8px] font-bold uppercase tracking-wider">We do not provide any content.</p>
          </div>

          <p className="text-gray-600 text-[9px] font-bold mt-2">Ninja 8K | All Rights Reserved</p>
          <p className="text-gray-700 text-[8px]">Version 2.0</p>
          <p
            className="text-gray-500 text-[9px] mt-1 font-mono font-bold cursor-pointer active:scale-95 transition-transform"
            onClick={async () => {
              try {
                await Clipboard.write({ string: deviceId });
                const el = document.getElementById('device-id-label');
                if (el) { el.textContent = 'COPIED!'; setTimeout(() => { el.textContent = `ID: ${deviceId}`; }, 1500); }
              } catch { /* fallback */ }
            }}
          >
            <span id="device-id-label">ID: {deviceId}</span>
          </p>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '55%', background: 'rgba(98, 37, 255, 0.15)' }} />

        {/* Right — Manual / Advanced */}
        <div style={{ width: '360px', maxHeight: 'none', overflowY: 'visible' }}>
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
