import React, { useState, useEffect, useCallback } from 'react';
import { THEME } from '../constants/theme';

// ============================================================================
// CONTEXT MENU - Extra long press menu (2s)
// Options: EPG Now Toggle, Drag & Drop, Hide/Show, Alias (Rename)
// ============================================================================

// Icons
const Icons = {
  EPG: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2"/>
      <path d="M3 10h18M9 4v16"/>
    </svg>
  ),
  DragDrop: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M2 12h20M7 7l5-5 5 5M7 17l5 5 5-5M17 7l5 5-5 5M7 7l-5 5 5 5"/>
    </svg>
  ),
  Hide: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  Show: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Rename: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Close: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
};

// ============================================================================
// STORAGE HELPERS
// ============================================================================
const STORAGE_KEYS = {
  ALIASES: 'ninja_aliases',
  HIDDEN: 'ninja_hidden',
  EPG_ENABLED: 'ninja_epg_enabled',
};

export const getAliases = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.ALIASES) || '{}');
  } catch {
    return {};
  }
};

export const setAlias = (itemId, alias) => {
  const aliases = getAliases();
  if (alias) {
    aliases[itemId] = alias;
  } else {
    delete aliases[itemId];
  }
  localStorage.setItem(STORAGE_KEYS.ALIASES, JSON.stringify(aliases));
};

export const getHiddenItems = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.HIDDEN) || '{}');
  } catch {
    return {};
  }
};

export const setHiddenItem = (itemId, hidden) => {
  const hiddenItems = getHiddenItems();
  if (hidden) {
    hiddenItems[itemId] = true;
  } else {
    delete hiddenItems[itemId];
  }
  localStorage.setItem(STORAGE_KEYS.HIDDEN, JSON.stringify(hiddenItems));
};

export const isEPGEnabled = () => {
  const stored = localStorage.getItem(STORAGE_KEYS.EPG_ENABLED);
  return stored === null ? true : stored === 'true';
};

export const setEPGEnabled = (enabled) => {
  localStorage.setItem(STORAGE_KEYS.EPG_ENABLED, String(enabled));
};

// ============================================================================
// CONTEXT MENU COMPONENT
// ============================================================================
const ContextMenu = ({ 
  visible, 
  item, 
  onClose,
  onToggleEPG,
  onToggleHide,
  onRename,
  onDragDrop,
  epgEnabled,
  isHidden,
  currentAlias,
}) => {
  const [showRenameInput, setShowRenameInput] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // Reset rename input when menu opens
  useEffect(() => {
    if (visible && item) {
      setShowRenameInput(false);
      setRenameValue(currentAlias || item.name || '');
    }
  }, [visible, item, currentAlias]);

  const handleRenameClick = useCallback(() => {
    setShowRenameInput(true);
  }, []);

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim();
    // If same as original name, remove alias
    if (trimmed === item?.name || trimmed === '') {
      onRename?.(item, null);
    } else {
      onRename?.(item, trimmed);
    }
    setShowRenameInput(false);
    onClose();
  }, [renameValue, item, onRename, onClose]);

  const handleRenameCancel = useCallback(() => {
    setShowRenameInput(false);
    setRenameValue(currentAlias || item?.name || '');
  }, [currentAlias, item]);

  if (!visible || !item) return null;

  const itemName = currentAlias || item.name || item.title || 'Unknown';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" />
      
      {/* Menu */}
      <div 
        className="relative w-full max-w-md mx-4 mb-8 rounded-2xl overflow-hidden animate-slide-up"
        style={{ 
          background: 'rgba(18, 18, 31, 0.95)',
          border: '1px solid rgba(98, 37, 255, 0.3)',
          backdropFilter: 'blur(20px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Item logo */}
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ background: THEME.colors.row }}
            >
              {item.logo ? (
                <img 
                  src={item.logo} 
                  alt="" 
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => e.target.src = '/assets/Ninja8K.png'}
                />
              ) : (
                <img src="/assets/Ninja8K.png" alt="" className="max-w-full max-h-full object-contain" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">{itemName}</p>
              {currentAlias && (
                <p className="text-gray-500 text-xs truncate">Original: {item.name}</p>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 active:scale-95"
          >
            <div className="w-4 h-4 text-gray-400"><Icons.Close /></div>
          </button>
        </div>

        {/* Options */}
        <div className="p-2">
          {/* EPG Now Toggle - Top */}
          <button
            onClick={() => { onToggleEPG?.(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl active:bg-white/10 transition-colors"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(139, 92, 246, 0.2)' }}>
              <div className="w-5 h-5 text-purple-400"><Icons.EPG /></div>
            </div>
            <div className="flex-1 text-left">
              <p className="text-white text-sm font-medium">EPG Now</p>
              <p className="text-gray-500 text-xs">Show current program info</p>
            </div>
            <div 
              className={`w-12 h-7 rounded-full p-1 transition-colors ${epgEnabled ? 'bg-purple-500' : 'bg-white/10'}`}
            >
              <div 
                className={`w-5 h-5 rounded-full bg-white transition-transform ${epgEnabled ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </div>
          </button>

          {/* Divider */}
          <div className="h-px bg-white/5 my-1" />

          {/* Rename / Alias */}
          {showRenameInput ? (
            <div className="px-4 py-3">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Enter new name..."
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none placeholder-gray-500"
                style={{ 
                  background: '#0a0a0f',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') handleRenameCancel();
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleRenameCancel}
                  className="flex-1 py-2 rounded-lg text-gray-400 text-sm font-medium bg-white/5 active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRenameSubmit}
                  className="flex-1 py-2 rounded-lg text-white text-sm font-medium active:scale-95"
                  style={{ background: THEME.gradients.primary }}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleRenameClick}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl active:bg-white/10 transition-colors"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(59, 130, 246, 0.2)' }}>
                <div className="w-5 h-5 text-blue-400"><Icons.Rename /></div>
              </div>
              <div className="flex-1 text-left">
                <p className="text-white text-sm font-medium">Rename</p>
                <p className="text-gray-500 text-xs">Set custom alias (local only)</p>
              </div>
              {currentAlias && (
                <div className="w-5 h-5 text-green-400"><Icons.Check /></div>
              )}
            </button>
          )}

          {/* Hide/Show */}
          <button
            onClick={() => { onToggleHide?.(item); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl active:bg-white/10 transition-colors"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: isHidden ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)' }}>
              <div className={`w-5 h-5 ${isHidden ? 'text-green-400' : 'text-red-400'}`}>
                {isHidden ? <Icons.Show /> : <Icons.Hide />}
              </div>
            </div>
            <div className="flex-1 text-left">
              <p className="text-white text-sm font-medium">{isHidden ? 'Show' : 'Hide'}</p>
              <p className="text-gray-500 text-xs">{isHidden ? 'Make visible again' : 'Hide from list'}</p>
            </div>
          </button>

          {/* Drag & Drop */}
          <button
            onClick={() => { onDragDrop?.(item); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl active:bg-white/10 transition-colors"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(251, 191, 36, 0.2)' }}>
              <div className="w-5 h-5 text-yellow-400"><Icons.DragDrop /></div>
            </div>
            <div className="flex-1 text-left">
              <p className="text-white text-sm font-medium">Reorder</p>
              <p className="text-gray-500 text-xs">Drag to change position</p>
            </div>
          </button>
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-white/5">
          <p className="text-gray-600 text-[10px] text-center">Changes are saved locally on this device</p>
        </div>
      </div>

      {/* Animation */}
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ContextMenu;
