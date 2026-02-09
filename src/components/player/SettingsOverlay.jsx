import React, { useState, useCallback } from 'react';
import { ninjaCentral, STORES } from '../../services/NinjaCentral';

// ============================================================================
// SETTINGS OVERLAY
// Sections: Reload, Toolbox, Servers, Controls (gesture + remote legend)
// ============================================================================

const Icons = {
  All: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>,
  Live: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>,
  Movies: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /><line x1="17" y1="17" x2="22" y2="17" /></svg>,
  Series: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2" /><polyline points="17 2 12 7 7 2" /></svg>,
  Eye: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  DragDrop: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" /><polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" /></svg>,
  Pencil: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
  Servers: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></svg>,
  EPGGrid: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /></svg>,
};

// ============================================================================
// CONTROLS LEGEND DATA
// ============================================================================
const TOUCH_CONTROLS = [
  { gesture: '2 fingers ↕', action: 'Volume' },
  { gesture: '2 fingers pinch', action: 'More thumbnails per row' },
  { gesture: '2 fingers spread', action: 'Bigger thumbnails' },
  { gesture: '2 fingers swipe ←→', action: 'Previous / Next folder' },
  { gesture: '2 fingers rotate ↻', action: 'Next channel' },
  { gesture: '2 fingers rotate ↺', action: 'Previous channel' },
  { gesture: '3 fingers swipe →', action: 'Open OTT panels' },
  { gesture: '3 fingers swipe ←', action: 'Close OTT panels' },
  { gesture: '3 fingers pinch', action: 'Open OTT panels' },
  { gesture: '3 fingers spread', action: 'Close OTT panels' },
];

const REMOTE_CONTROLS = [
  { key: '↑ ↓ ← →', action: 'Navigate' },
  { key: 'OK / Enter', action: 'Select' },
  { key: 'Back / Escape', action: 'Close OTT or go back' },
  { key: '🔵 Blue', action: 'Settings' },
  { key: '🟡 Yellow', action: 'Favorites' },
  { key: '🟢 Green', action: 'Tab switcher (Live/Movies/Series)' },
  { key: '🔴 Red', action: 'Toggle OTT panels' },
  { key: 'Long press →', action: 'Open OTT panels' },
  { key: 'Long press ←', action: 'Close OTT panels' },
  { key: 'Extra long ←', action: 'Settings' },
  { key: 'Extra long →', action: 'Favorites' },
  { key: 'Triple ← or →', action: 'Cycle tabs (Live/Movies/Series)' },
];

const SettingsOverlay = ({ visible, onClose, xtreamService, onServers, sidebarOpen, onEPGGrid }) => {
  const [reloading, setReloading] = useState(null);
  const [showControls, setShowControls] = useState(false);

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

  const leftOffset = sidebarOpen ? 300 : 0;

  const btnStyle = (disabled = false) => ({
    width: '64px', height: '64px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
    background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '0', cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.8)',
    transition: 'all 0.2s', padding: '8px',
  });

  const labelStyle = { fontSize: '9px', fontWeight: '600', letterSpacing: '0.3px', textTransform: 'uppercase' };
  const sectionTitle = { fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' };

  const Spinner = () => (
    <div style={{
      width: '20px', height: '20px',
      border: '2px solid rgba(98, 37, 255, 0.3)', borderTop: '2px solid #6225ff',
      borderRadius: '50%', animation: 'soSpin 0.6s linear infinite',
    }} />
  );

  const rowStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
  };
  const keyStyle = { fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 600, flexShrink: 0 };
  const actionStyle = { fontSize: '10px', color: 'rgba(255,255,255,0.35)', textAlign: 'right' };

  return (
    <div style={{
      position: 'absolute', top: 0, left: leftOffset + 'px', right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.92)', backdropFilter: 'blur(20px)',
      zIndex: 10000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      transition: 'left 0.3s ease',
    }}>
      {/* Close */}
      <button onClick={onClose} style={{
        position: 'absolute', top: '12px', right: '12px',
        background: 'none', border: 'none', width: '28px', height: '28px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Content */}
      <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

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
            <button style={btnStyle()} onClick={onEPGGrid}>
              <Icons.EPGGrid /><span style={labelStyle}>EPG Grid</span>
            </button>
            <button style={btnStyle(true)} disabled><Icons.Eye /><span style={labelStyle}>Eye</span></button>
            <button style={btnStyle(true)} disabled><Icons.DragDrop /><span style={labelStyle}>D&D</span></button>
            <button style={btnStyle(true)} disabled><Icons.Pencil /><span style={labelStyle}>Rename</span></button>
          </div>
        </div>

        {/* SERVERS */}
        <div>
          <div style={sectionTitle}>Servers</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button style={btnStyle()} onClick={onServers}>
              <Icons.Servers /><span style={labelStyle}>Servers</span>
            </button>
          </div>
        </div>

        {/* CONTROLS LEGEND */}
        <div>
          <button
            onClick={() => setShowControls(!showControls)}
            style={{
              ...sectionTitle,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
            }}
          >
            <span>Controls</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"
              style={{ transform: showControls ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showControls && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>

              {/* TOUCH GESTURES */}
              <div>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(98,37,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Touch Gestures
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '0', padding: '8px 10px' }}>
                  {TOUCH_CONTROLS.map((item, i) => (
                    <div key={i} style={rowStyle}>
                      <span style={keyStyle}>{item.gesture}</span>
                      <span style={actionStyle}>{item.action}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* REMOTE / DPAD */}
              <div>
                <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(98,37,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Remote / DPAD
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '0', padding: '8px 10px' }}>
                  {REMOTE_CONTROLS.map((item, i) => (
                    <div key={i} style={rowStyle}>
                      <span style={keyStyle}>{item.key}</span>
                      <span style={actionStyle}>{item.action}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

      </div>

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
