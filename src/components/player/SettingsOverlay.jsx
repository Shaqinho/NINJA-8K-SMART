import React, { useState, useCallback } from 'react';
import { ninjaCentral, STORES } from '../../services/NinjaCentral';
import EPGPresets from './EPGPresets';

// ============================================================================
// SETTINGS OVERLAY - App settings panel over player
// 
// 95% screen, centered, video continues playing behind
// Opened/closed via NINJA 8K logo toggle in PlayerControls
// ============================================================================

// Icons for buttons
const Icons = {
  All: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  ),
  Live: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  Movies: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /><line x1="17" y1="17" x2="22" y2="17" />
    </svg>
  ),
  Series: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2" /><polyline points="17 2 12 7 7 2" />
    </svg>
  ),
  Eye: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  DragDrop: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" /><polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" />
    </svg>
  ),
  Pencil: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  EPG: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Servers: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  ),
};

const SettingsOverlay = ({ visible, onClose, xtreamService, onServers, onChannelSelect }) => {
  const [reloading, setReloading] = useState(null);
  const [showEPGPresets, setShowEPGPresets] = useState(false);

  const handleReload = useCallback(async (type) => {
    if (!xtreamService || reloading) return;
    setReloading(type);
    console.log(`[SettingsOverlay] Reloading ${type}...`);

    try {
      await ninjaCentral.init();

      const doLive = type === 'all' || type === 'live';
      const doMovies = type === 'all' || type === 'movies';
      const doSeries = type === 'all' || type === 'series';

      if (doLive) {
        const [live, liveCats] = await Promise.all([
          xtreamService.getLiveStreams(),
          xtreamService.getLiveCategories(),
        ]);
        await ninjaCentral.saveItems(STORES.LIVE, live);
        await ninjaCentral.saveCategories(STORES.LIVE_CATEGORIES, liveCats);
        console.log(`[SettingsOverlay] Live reloaded: ${live.length} streams`);
      }

      if (doMovies) {
        const [vod, vodCats] = await Promise.all([
          xtreamService.getVodStreams(),
          xtreamService.getVodCategories(),
        ]);
        await ninjaCentral.saveItems(STORES.VOD, vod);
        await ninjaCentral.saveCategories(STORES.VOD_CATEGORIES, vodCats);
        console.log(`[SettingsOverlay] Movies reloaded: ${vod.length} items`);
      }

      if (doSeries) {
        const [series, seriesCats] = await Promise.all([
          xtreamService.getSeries(),
          xtreamService.getSeriesCategories(),
        ]);
        await ninjaCentral.saveItems(STORES.SERIES, series);
        await ninjaCentral.saveCategories(STORES.SERIES_CATEGORIES, seriesCats);
        console.log(`[SettingsOverlay] Series reloaded: ${series.length} items`);
      }

      console.log(`[SettingsOverlay] ${type} reload complete`);
    } catch (err) {
      console.error(`[SettingsOverlay] Reload ${type} error:`, err);
    } finally {
      setReloading(null);
    }
  }, [xtreamService, reloading]);

  if (!visible) return null;

  const btnStyle = (disabled = false) => ({
    width: '64px',
    height: '64px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.8)',
    transition: 'all 0.2s',
    padding: '8px',
  });

  const labelStyle = {
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
  };

  const sectionTitle = {
    fontSize: '11px',
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '8px',
  };

  const Spinner = () => (
    <div style={{
      width: '20px',
      height: '20px',
      border: '2px solid rgba(98, 37, 255, 0.3)',
      borderTop: '2px solid #6225ff',
      borderRadius: '50%',
      animation: 'soSpin 0.6s linear infinite',
    }} />
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '95%',
        height: '95%',
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'rgba(255, 255, 255, 0.1)',
          border: 'none',
          borderRadius: '50%',
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 1,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Content */}
      <div style={{
        flex: 1,
        padding: '20px 24px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>

        {/* RELOAD */}
        <div>
          <div style={sectionTitle}>Reload</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button style={btnStyle()} onClick={() => handleReload('all')}>
              {reloading === 'all' ? <Spinner /> : <Icons.All />}
              <span style={labelStyle}>All</span>
            </button>
            <button style={btnStyle()} onClick={() => handleReload('live')}>
              {reloading === 'live' || reloading === 'all' ? <Spinner /> : <Icons.Live />}
              <span style={labelStyle}>Live</span>
            </button>
            <button style={btnStyle()} onClick={() => handleReload('movies')}>
              {reloading === 'movies' || reloading === 'all' ? <Spinner /> : <Icons.Movies />}
              <span style={labelStyle}>Movies</span>
            </button>
            <button style={btnStyle()} onClick={() => handleReload('series')}>
              {reloading === 'series' || reloading === 'all' ? <Spinner /> : <Icons.Series />}
              <span style={labelStyle}>Series</span>
            </button>
          </div>
        </div>

        {/* TOOLBOX */}
        <div>
          <div style={sectionTitle}>Toolbox</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button style={btnStyle(true)} disabled>
              <Icons.Eye />
              <span style={labelStyle}>Eye</span>
            </button>
            <button style={btnStyle(true)} disabled>
              <Icons.DragDrop />
              <span style={labelStyle}>D&D</span>
            </button>
            <button style={btnStyle(true)} disabled>
              <Icons.Pencil />
              <span style={labelStyle}>Rename</span>
            </button>
          </div>
        </div>

        {/* EPG */}
        <div>
          <div style={sectionTitle}>EPG</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button style={btnStyle()} onClick={() => setShowEPGPresets(true)}>
              <Icons.EPG />
              <span style={labelStyle}>EPG</span>
            </button>
          </div>
        </div>

        {/* SERVERS */}
        <div>
          <div style={sectionTitle}>Servers</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button style={btnStyle()} onClick={onServers}>
              <Icons.Servers />
              <span style={labelStyle}>Servers</span>
            </button>
          </div>
        </div>

      </div>

      {/* EPG Presets Panel */}
      {showEPGPresets && (
        <EPGPresets
          onClose={() => setShowEPGPresets(false)}
          xtreamService={xtreamService}
          onChannelSelect={(channel) => {
            setShowEPGPresets(false);
            onChannelSelect?.(channel);
          }}
        />
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes soSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SettingsOverlay;
