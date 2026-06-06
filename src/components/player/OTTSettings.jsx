import React, { useState } from 'react';
import { THEME } from '../../constants/theme';

// ============================================================================
// OTT SETTINGS — Overlay (Playlist, Controls, About)
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
];

const REMOTE_CONTROLS = [
  { key: '↑ ↓ ← →', action: 'Navigate' },
  { key: 'OK / Enter', action: 'Select' },
  { key: 'Back / Escape', action: 'Close or go back' },
  { key: '🔵 Blue', action: 'Settings' },
  { key: '🟡 Yellow', action: 'Favorites' },
  { key: '🟢 Green', action: 'Tab switcher' },
  { key: '🔴 Red', action: 'Toggle OTT panels' },
];

const OTTSettings = ({ visible, onClose, onReload, onLogout }) => {
  const [showControls, setShowControls] = useState(false);
  if (!visible) return null;

  const c = THEME.colors;

  const sectionTitle = { fontSize: '11px', fontWeight: 700, color: c.textSecondary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' };
  const row = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 14px', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px',
    cursor: 'pointer', color: '#fff', fontSize: '13px', fontWeight: 600,
  };
  const legendRow = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
  };
  const legendTitle = { fontSize: '9px', fontWeight: 700, color: c.primary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' };
  const legendBox = { background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '6px 12px' };
  const keyTxt = { fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 };
  const actTxt = { fontSize: '10px', color: 'rgba(255,255,255,0.35)', textAlign: 'right' };

  return (
    <div
      onClick={onClose}
      className="animate-fade-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-up scrollbar-hide"
        style={{
          width: '100%', maxWidth: '440px', maxHeight: '82vh', overflowY: 'auto',
          background: c.card, border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>SETTINGS</span>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', color: '#fff', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* PLAYLIST */}
          <div>
            <div style={sectionTitle}>Playlist</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button style={row} onClick={() => { onReload?.(); onClose?.(); }}>
                <span>Refresh playlist</span>
                <span style={{ color: c.primary, fontSize: '16px' }}>↻</span>
              </button>
              <button style={row} onClick={() => { onLogout?.(); }}>
                <span>Change playlist</span>
                <span style={{ color: c.primary, fontSize: '14px' }}>⤺</span>
              </button>
            </div>
          </div>

          {/* CONTROLS */}
          <div>
            <button onClick={() => setShowControls(v => !v)} style={{ ...sectionTitle, background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
              <span>Controls</span>
              <span style={{ transform: showControls ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', fontSize: '10px' }}>▾</span>
            </button>
            {showControls && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
                <div>
                  <div style={legendTitle}>Touch gestures</div>
                  <div style={legendBox}>
                    {TOUCH_CONTROLS.map((it, i) => (
                      <div key={i} style={legendRow}>
                        <span style={keyTxt}>{it.gesture}</span>
                        <span style={actTxt}>{it.action}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={legendTitle}>Remote / DPAD</div>
                  <div style={legendBox}>
                    {REMOTE_CONTROLS.map((it, i) => (
                      <div key={i} style={legendRow}>
                        <span style={keyTxt}>{it.key}</span>
                        <span style={actTxt}>{it.action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ABOUT */}
          <div>
            <div style={sectionTitle}>About</div>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span style={{ fontSize: '18px', fontWeight: 900, color: '#fff', fontStyle: 'italic' }}>NINJA</span>
              <span style={{ fontSize: '18px', fontWeight: 900, marginLeft: '4px', fontStyle: 'italic', color: c.primary }}>8K</span>
            </div>
            <div style={{ fontSize: '11px', color: c.textMuted, marginTop: '4px' }}>Version 1.0.0</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OTTSettings;
