import React, { useState, useEffect } from 'react';
import { Clipboard } from '@capacitor/clipboard';
import { THEME } from '../constants/theme';
import { Icons } from './Icons';
import { getDeviceId } from '../services/NinjaAPI';
import { generateNinjaPIN } from '../utils/generateNinjaPIN';

// ============================================================================
// PLAYLIST DIV — Landscape layout (Left: Identity / Right: Form)
// ============================================================================
export const PlaylistDiv = ({
  mode, setMode,
  form, setForm,
  fetchOptions, setFetchOptions,
  onNinjaPaste,
  onAddServer,
  error,
}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
  const [deviceId, setDeviceId] = useState('loading...');
  const [ninjaPIN, setNinjaPIN] = useState('----');
  const [copyLabel, setCopyLabel] = useState('COPY');
  const fileInputRef = React.useRef(null);

  // Load device identity
  useEffect(() => {
    const loadIdentity = async () => {
      const id = await getDeviceId();
      setDeviceId(id);
      const pin = generateNinjaPIN(id);
      setNinjaPIN(pin);
    };
    loadIdentity();
  }, []);

  // Clipboard paste for individual fields
  const fieldPaste = async (field) => {
    try {
      const { value } = await Clipboard.read();
      if (value) setForm(f => ({ ...f, [field]: value.trim() }));
    } catch (e) {
      try {
        const text = await navigator.clipboard.readText();
        if (text) setForm(f => ({ ...f, [field]: text.trim() }));
      } catch (e2) {
        const manual = window.prompt(`Paste ${field} here:`);
        if (manual) setForm(f => ({ ...f, [field]: manual.trim() }));
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && (file.name.endsWith('.m3u') || file.name.endsWith('.m3u8'))) {
      setSelectedFile(file);
      setForm(f => ({ ...f, file }));
    }
  };

  // Copy NINJA ID + PIN as paragraph
  const handleCopyAll = async () => {
    const text = `NINJA ID :\n${deviceId}\nNINJA PIN :\n${ninjaPIN}`;
    try {
      await Clipboard.write({ string: text });
    } catch {
      try { await navigator.clipboard.writeText(text); } catch { /* fallback */ }
    }
    setCopyLabel('COPIED!');
    setTimeout(() => setCopyLabel('COPY'), 1500);
  };

  // Format PIN with spaces: "4827" → "4 8 2 7"
  const formatPIN = (pin) => pin.split('').join(' ');

  return (
    <div className="flex items-start gap-9" style={{ maxWidth: '500px', width: '100%' }}>

      {/* ================================================================ */}
      {/* LEFT — Identity Panel                                           */}
      {/* ================================================================ */}
      <div className="flex flex-col gap-4 flex-shrink-0" style={{ width: '216px' }}>

        {/* NINJA ID */}
        <div>
          <p className="text-center text-[9px] font-bold uppercase tracking-widest mb-1"
             style={{ color: 'rgba(98, 37, 255, 0.5)' }}>
            NINJA ID
          </p>
          <div className="w-full rounded text-center font-mono text-[9px] font-bold text-white py-3 px-2.5"
               style={{ background: '#000', border: '1px solid rgba(98, 37, 255, 0.12)', wordBreak: 'break-all', lineHeight: 1.4, letterSpacing: '0.2px' }}>
            {deviceId}
          </div>
        </div>

        {/* NINJA PIN */}
        <div>
          <p className="text-center text-[9px] font-bold uppercase tracking-widest mb-1"
             style={{ color: 'rgba(98, 37, 255, 0.5)' }}>
            NINJA PIN
          </p>
          <div className="w-full rounded text-center font-mono text-xl font-black text-white py-3 px-2.5"
               style={{ background: '#000', border: '1px solid rgba(98, 37, 255, 0.12)', letterSpacing: '6px' }}>
            {formatPIN(ninjaPIN)}
          </div>
        </div>

        {/* COPY Button */}
        <button
          onClick={handleCopyAll}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md active:scale-95 transition-all"
          style={{
            background: 'rgba(98, 37, 255, 0.04)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(98, 37, 255, 0.15)',
          }}
        >
          <svg viewBox="0 0 24 24" className="w-3 h-3" style={{ stroke: '#8B5CF6', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
          </svg>
          <span className="text-[9px] font-bold" style={{ color: '#8B5CF6', letterSpacing: '1px' }}>{copyLabel}</span>
        </button>

        {/* Playlist Link */}
        <a
          href="https://ninja-apps.io/playlist"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md no-underline active:scale-95 transition-all"
          style={{
            background: 'rgba(98, 37, 255, 0.04)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(98, 37, 255, 0.15)',
            textDecoration: 'none',
          }}
        >
          <svg viewBox="0 0 24 24" className="w-3 h-3" style={{ stroke: '#8B5CF6', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          <span className="text-[9px] font-bold" style={{ color: '#8B5CF6', letterSpacing: '1px' }}>ninja-apps.io/playlist</span>
        </a>

        {/* Disclaimer */}
        <p className="text-center text-[9px] font-bold" style={{ color: 'rgba(98, 37, 255, 0.2)', letterSpacing: '0.5px' }}>
          We do not provide any content
        </p>

        {/* Version */}
        <p className="text-center text-[11px] font-bold" style={{ color: 'rgba(98, 37, 255, 0.25)', letterSpacing: '0.5px' }}>
          Ninja 8K · v1.0
        </p>
      </div>

      {/* ================================================================ */}
      {/* RIGHT — Form Panel                                              */}
      {/* ================================================================ */}
      <div className="flex flex-col gap-[7px]" style={{ width: '216px', flexShrink: 0 }}>

        {/* Error */}
        {error && (
          <div className="rounded-lg p-2 mb-1"
               style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <p className="text-red-400 text-[10px] text-center font-medium">{error}</p>
          </div>
        )}

        {/* Tabs — M3U | Xtream | File */}
        <div className="flex gap-1">
          {[
            { id: 'url', label: 'M3U', icon: Icons.Link },
            { id: 'xtream', label: 'XTREAM', icon: Icons.Server },
            { id: 'file', label: 'FILE', icon: Icons.Upload }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              className="flex-1 py-[5px] px-2.5 rounded text-[9px] font-bold uppercase text-center transition-all"
              style={{
                background: mode === t.id ? 'rgba(98,37,255,0.15)' : 'rgba(98,37,255,0.04)',
                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                border: mode === t.id ? '1px solid rgba(98,37,255,0.35)' : '1px solid rgba(98,37,255,0.12)',
                color: mode === t.id ? '#fff' : 'rgba(98,37,255,0.4)',
                letterSpacing: '0.5px',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Server Name + Auto-fill */}
        <div className="relative">
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
            placeholder="My Server"
            className="w-full py-2.5 px-3 rounded text-white text-[11px] font-semibold outline-none"
            style={{
              background: '#000',
              border: `1px solid ${focusedField === 'name' ? 'rgba(98,37,255,0.4)' : 'rgba(98,37,255,0.12)'}`,
              fontFamily: "'SF Mono', monospace",
              transition: 'all 0.2s',
            }}
          />
          <button
            onClick={() => setForm({ ...form, name: 'NINJA | 8K' })}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black uppercase transition-colors"
            style={{ background: 'none', border: 'none', color: 'rgba(98,37,255,0.4)', letterSpacing: '0.5px', cursor: 'pointer', fontFamily: 'inherit' }}
            onMouseEnter={e => e.target.style.color = '#8B5CF6'}
            onMouseLeave={e => e.target.style.color = 'rgba(98,37,255,0.4)'}
          >
            Auto-fill
          </button>
        </div>

        {/* NINJA PASTE — Only for Xtream mode */}
        {mode === 'xtream' && (
          <button
            onClick={onNinjaPaste}
            className="w-full py-2.5 rounded-lg text-[10px] font-black text-white flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(168, 85, 247, 0.15))',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              letterSpacing: '0.5px',
            }}
          >
            🥷 NINJA PASTE
          </button>
        )}

        {/* Dynamic Form based on Mode */}
        {mode === 'xtream' ? (
          <>
            {/* Server URL */}
            <div className="relative">
              <input
                type="text"
                value={form.server}
                onChange={e => setForm({ ...form, server: e.target.value })}
                onFocus={() => setFocusedField('server')}
                onBlur={() => setFocusedField(null)}
                placeholder="http:// optional"
                className="w-full py-2.5 px-3 rounded text-white text-[11px] pr-8 outline-none"
                style={{
                  background: '#000',
                  border: `1px solid ${focusedField === 'server' ? 'rgba(98,37,255,0.4)' : 'rgba(98,37,255,0.12)'}`,
                  fontFamily: "'SF Mono', monospace", fontWeight: 600, transition: 'all 0.2s',
                  '::placeholder': { color: 'rgba(98,37,255,0.25)' },
                }}
              />
              <button
                onClick={() => fieldPaste('server')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <div className="w-3.5 h-3.5"><Icons.Copy/></div>
              </button>
            </div>

            {/* User & Password */}
            <div className="flex gap-1.5">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="User"
                  className="w-full py-2.5 px-3 rounded text-white text-[11px] pr-8 outline-none"
                  style={{
                    background: '#000',
                    border: `1px solid ${focusedField === 'username' ? 'rgba(98,37,255,0.4)' : 'rgba(98,37,255,0.12)'}`,
                    fontFamily: "'SF Mono', monospace", fontWeight: 600, transition: 'all 0.2s',
                  }}
                />
                <button
                  onClick={() => fieldPaste('username')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <div className="w-3.5 h-3.5"><Icons.Copy/></div>
                </button>
              </div>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Password"
                  className="w-full py-2.5 px-3 rounded text-white text-[11px] pr-8 outline-none"
                  style={{
                    background: '#000',
                    border: `1px solid ${focusedField === 'password' ? 'rgba(98,37,255,0.4)' : 'rgba(98,37,255,0.12)'}`,
                    fontFamily: "'SF Mono', monospace", fontWeight: 600, transition: 'all 0.2s',
                  }}
                />
                <button
                  onClick={() => fieldPaste('password')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <div className="w-3.5 h-3.5"><Icons.Copy/></div>
                </button>
              </div>
            </div>
          </>
        ) : mode === 'url' ? (
          <div className="relative">
            <input
              type="text"
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
              onFocus={() => setFocusedField('url')}
              onBlur={() => setFocusedField(null)}
              placeholder="http://example.com/playlist.m3u"
              className="w-full py-2.5 px-3 rounded text-white text-[11px] pr-8 outline-none"
              style={{
                background: '#000',
                border: `1px solid ${focusedField === 'url' ? 'rgba(98,37,255,0.4)' : 'rgba(98,37,255,0.12)'}`,
                fontFamily: "'SF Mono', monospace", fontWeight: 600, transition: 'all 0.2s',
              }}
            />
            <button
              onClick={() => fieldPaste('url')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
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
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                borderColor: selectedFile ? 'rgba(139, 92, 246, 0.4)' : 'rgba(98, 37, 255, 0.12)',
              }}
            >
              <div className={`w-6 h-6 ${selectedFile ? 'text-purple-400' : 'text-gray-600'}`}><Icons.Upload/></div>
              {selectedFile ? (
                <div className="text-center">
                  <p className="text-white text-[10px] font-bold">{selectedFile.name}</p>
                  <p className="text-gray-500 text-[8px]">Tap to change file</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-gray-400 text-[10px] font-medium">Upload M3U File</p>
                  <p className="text-gray-600 text-[8px]">.m3u or .m3u8</p>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Fetch Options — Live / Movies / Series */}
        <div className="flex gap-[5px]">
          {[
            { id: 'live', label: 'Live', icon: Icons.Tv },
            { id: 'movies', label: 'Movies', icon: Icons.Film },
            { id: 'series', label: 'Series', icon: Icons.Popcorn }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setFetchOptions(p => ({ ...p, [opt.id]: !p[opt.id] }))}
              className="flex-1 py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 transition-all active:scale-95"
              style={{
                background: fetchOptions[opt.id] ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                border: fetchOptions[opt.id] ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid rgba(98, 37, 255, 0.08)',
                opacity: fetchOptions[opt.id] ? 1 : 0.4,
              }}
            >
              <div className="w-[11px] h-[11px] text-white flex-shrink-0"><opt.icon/></div>
              <span className="text-[9px] font-black text-white uppercase" style={{ letterSpacing: '0.3px' }}>{opt.label}</span>
              {fetchOptions[opt.id] && (
                <div className="w-3 h-3 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#8B5CF6' }}>
                  <div className="w-2 h-2 text-white"><Icons.Check/></div>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* ADD SERVER */}
        <button
          onClick={onAddServer}
          className="w-full py-2.5 rounded-lg text-white font-black text-[11px] uppercase flex items-center justify-center active:scale-[0.98] transition-all"
          style={{
            background: THEME.gradients.primary,
            boxShadow: '0 2px 10px rgba(139, 92, 246, 0.08)',
            letterSpacing: '0.5px',
          }}
        >
          ADD SERVER
        </button>
      </div>
    </div>
  );
};

export default PlaylistDiv;
