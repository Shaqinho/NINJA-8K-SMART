import React, { useRef, useState } from 'react';
import { Clipboard } from '@capacitor/clipboard';
import { THEME } from '../constants/theme';
import { Icons } from './Icons';

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
// PLAYLIST FORM
// ============================================================================
export const PlaylistForm = ({ 
  mode, setMode, 
  form, setForm, 
  fetchOptions, setFetchOptions,
  onNinjaPaste, 
  onAddServer 
}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
  const fileInputRef = useRef(null);

  // Fixed clipboard paste using Capacitor
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

  return (
    <>
      {/* Mode Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={glassCard}>
        {[
          { id: 'url', label: 'M3U', icon: Icons.Link },
          { id: 'xtream', label: 'XTREAM', icon: Icons.Server },
          { id: 'file', label: 'FILE', icon: Icons.Upload }
        ].map(t => (
          <button 
            key={t.id} 
            onClick={() => setMode(t.id)} 
            className={`flex-1 py-2.5 rounded-lg text-[10px] font-black flex items-center justify-center gap-1.5 transition-all ${
              mode === t.id 
                ? 'text-white shadow-lg shadow-purple-500/20' 
                : 'text-gray-500 hover:text-gray-300'
            }`} 
            style={{ 
              background: mode === t.id ? THEME.gradients.primary : 'transparent' 
            }}
          >
            <div className="w-3.5 h-3.5"><t.icon/></div>
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Form Card */}
      <div className="rounded-2xl p-5 space-y-4" style={glassCard}>
        
        {/* Server Name */}
        <div>
          <div className="relative">
            <input 
              type="text" 
              value={form.name} 
              onChange={e => setForm({...form, name: e.target.value})} 
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              placeholder="My Server" 
              className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none font-medium placeholder-gray-600" 
              style={getInputStyle('name')}
            />
            <button 
              onClick={() => setForm({...form, name: 'NINJA | 8K'})} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-gray-500 uppercase tracking-tight hover:text-purple-400 transition-colors"
            >
              Auto
            </button>
          </div>
        </div>

        {/* Ninja Paste - Only for XTREAM mode */}
        {mode === 'xtream' && (
          <button 
            onClick={onNinjaPaste} 
            className="w-full py-3 rounded-xl text-[11px] font-black text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            style={{ 
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.4), rgba(168, 85, 247, 0.3))',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              boxShadow: '0 4px 20px rgba(139, 92, 246, 0.2)',
            }}
          >
            🥷 Ninja Paste
          </button>
        )}

        {/* Dynamic Form based on Mode */}
        {mode === 'xtream' ? (
          <div className="space-y-3">
            {/* Server URL */}
            <div className="relative">
              <input 
                type="text" 
                value={form.server} 
                onChange={e => setForm({...form, server: e.target.value})} 
                onFocus={() => setFocusedField('server')}
                onBlur={() => setFocusedField(null)}
                placeholder="example.com:8080 (http:// optional)" 
                className="w-full px-4 py-3 rounded-xl text-white text-sm pr-10 outline-none placeholder-gray-600" 
                style={getInputStyle('server')}
              />
              <button 
                onClick={() => fieldPaste('server')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors"
              >
                <div className="w-4 h-4"><Icons.Copy/></div>
              </button>
            </div>
            
            {/* User & Password */}
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <input 
                  type="text" 
                  value={form.username} 
                  onChange={e => setForm({...form, username: e.target.value})} 
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="User" 
                  className="w-full px-4 py-3 rounded-xl text-white text-sm pr-10 outline-none placeholder-gray-600" 
                  style={getInputStyle('username')}
                />
                <button 
                  onClick={() => fieldPaste('username')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors"
                >
                  <div className="w-4 h-4"><Icons.Copy/></div>
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
                  className="w-full px-4 py-3 rounded-xl text-white text-sm pr-10 outline-none placeholder-gray-600" 
                  style={getInputStyle('password')}
                />
                <button 
                  onClick={() => fieldPaste('password')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors"
                >
                  <div className="w-4 h-4"><Icons.Copy/></div>
                </button>
              </div>
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
              placeholder="http://example.com/playlist.m3u" 
              className="w-full px-4 py-3 rounded-xl text-white text-sm pr-10 outline-none placeholder-gray-600" 
              style={getInputStyle('url')}
            />
            <button 
              onClick={() => fieldPaste('url')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors"
            >
              <div className="w-4 h-4"><Icons.Clipboard/></div>
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
              className="w-full py-5 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all hover:border-purple-500/40 active:scale-[0.98]" 
              style={{ 
                background: 'rgba(255, 255, 255, 0.02)', 
                borderColor: selectedFile ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)' 
              }}
            >
              <div className={`w-8 h-8 ${selectedFile ? 'text-purple-400' : 'text-gray-600'}`}>
                <Icons.Upload/>
              </div>
              {selectedFile ? (
                <div className="text-center">
                  <p className="text-white text-sm font-bold">{selectedFile.name}</p>
                  <p className="text-gray-500 text-[10px]">Tap to change file</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-gray-400 text-sm font-medium">Upload M3U File</p>
                  <p className="text-gray-600 text-[10px]">.m3u or .m3u8</p>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Content Options */}
        <div>
          <div className="flex gap-2">
            {[
              { id: 'live', label: 'Live', icon: Icons.Tv },
              { id: 'movies', label: 'Movies', icon: Icons.Film },
              { id: 'series', label: 'Series', icon: Icons.Popcorn }
            ].map(opt => (
              <button 
                key={opt.id} 
                onClick={() => setFetchOptions(p => ({...p, [opt.id]: !p[opt.id]}))} 
                className={`flex-1 py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
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
                <div className="w-3.5 h-3.5 text-white flex-shrink-0"><opt.icon/></div>
                <span className="text-[9px] font-black text-white uppercase">{opt.label}</span>
                {fetchOptions[opt.id] && (
                  <div className="w-3.5 h-3.5 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 text-white"><Icons.Check/></div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Add Server Button */}
        <button 
          onClick={onAddServer} 
          className="w-full py-4 rounded-xl text-white font-black text-sm flex items-center justify-center active:scale-[0.98] transition-all"
          style={{ 
            background: THEME.gradients.primary,
            boxShadow: '0 8px 32px rgba(139, 92, 246, 0.35)',
          }}
        >
          ADD SERVER
        </button>
      </div>
    </>
  );
};
