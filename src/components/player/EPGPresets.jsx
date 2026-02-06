import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { ninjaCentral, STORES } from '../../services/NinjaCentral';
import { getNowByCategories, searchProgramsByCategories, getStreamIdsByCategories, insertProgramsBatch } from '../../database/ProgramQueries';

// ============================================================================
// EPG PRESETS - Preset-based EPG Search
//
// Views: PRESETS LIST → CREATE/EDIT → ACTIVE (NOW + Search)
// Storage: localStorage 'ninja_epg_presets'
// Data: SQLite first → xtreamService fallback
// ============================================================================

const MAX_CATEGORIES = 150;
const STORAGE_KEY = 'ninja_epg_presets';

const loadPresets = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
};
const savePresetsToStorage = (presets) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
};

// ========== PRESET LIST VIEW ==========
const PresetListView = ({ presets, onActivate, onCreate, onEdit, onDelete }) => {
  const longPressRef = useRef(null);
  const touchMovedRef = useRef(false);
  const [menuPresetId, setMenuPresetId] = useState(null);

  const handleTouchStart = useCallback((preset) => {
    touchMovedRef.current = false;
    longPressRef.current = setTimeout(() => {
      setMenuPresetId(prev => prev === preset.id ? null : preset.id);
      navigator.vibrate?.(30);
      longPressRef.current = null;
    }, 800);
  }, []);

  const handleTouchMove = useCallback(() => {
    touchMovedRef.current = true;
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', padding: '0 4px' }}>
      {presets.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5" style={{ margin: '0 auto 12px' }}>
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <div style={{ fontSize: '12px', marginBottom: '4px' }}>No presets yet</div>
          <div style={{ fontSize: '10px', color: '#555' }}>Create a preset to search EPG across selected folders</div>
        </div>
      )}

      {presets.map((preset) => (
        <div key={preset.id} style={{ position: 'relative' }}>
          <div
            onClick={() => { if (!touchMovedRef.current && menuPresetId !== preset.id) onActivate(preset); }}
            onTouchStart={() => handleTouchStart(preset)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              padding: '12px 14px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{preset.name}</div>
              <div style={{
                fontSize: '9px', fontWeight: 700, color: '#a78bfa',
                background: 'rgba(167,139,250,0.15)', borderRadius: '4px', padding: '2px 6px',
              }}>
                {preset.categoryIds.length} folders
              </div>
            </div>
            {preset.categoryNames?.length > 0 && (
              <div style={{ fontSize: '9px', color: '#666', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {preset.categoryNames.slice(0, 5).join(' · ')}{preset.categoryNames.length > 5 ? ` +${preset.categoryNames.length - 5}` : ''}
              </div>
            )}
          </div>

          {menuPresetId === preset.id && (
            <div style={{
              position: 'absolute', top: '100%', right: '8px', marginTop: '4px',
              background: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', overflow: 'hidden', zIndex: 10, minWidth: '120px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              <button onClick={() => { onEdit(preset); setMenuPresetId(null); }}
                style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}>
                Edit
              </button>
              <button onClick={() => { onDelete(preset.id); setMenuPresetId(null); }}
                style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={onCreate}
        style={{
          width: '100%', padding: '14px', borderRadius: '10px',
          background: 'rgba(98, 37, 255, 0.15)', border: '1px dashed rgba(98, 37, 255, 0.4)',
          color: '#a78bfa', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New Preset
      </button>
    </div>
  );
};

// ========== CREATE / EDIT VIEW ==========
const PresetEditorView = ({ preset, allCategories, onSave, onCancel }) => {
  const [name, setName] = useState(preset?.name || '');
  const [selectedIds, setSelectedIds] = useState(() => new Set(preset?.categoryIds || []));
  const [folderSearch, setFolderSearch] = useState('');

  const filteredCategories = useMemo(() => {
    if (!folderSearch.trim()) return allCategories;
    const q = folderSearch.toLowerCase();
    return allCategories.filter(c => (c.category_name || '').toLowerCase().includes(q));
  }, [allCategories, folderSearch]);

  const toggleCategory = useCallback((catId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else if (next.size < MAX_CATEGORIES) {
        next.add(catId);
      }
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const cat of filteredCategories) {
        if (next.size >= MAX_CATEGORIES) break;
        next.add(String(cat.category_id));
      }
      return next;
    });
  }, [filteredCategories]);

  const deselectAllFiltered = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const cat of filteredCategories) {
        next.delete(String(cat.category_id));
      }
      return next;
    });
  }, [filteredCategories]);

  const handleSave = useCallback(() => {
    if (!name.trim() || selectedIds.size === 0) return;
    const categoryIds = Array.from(selectedIds);
    const categoryNames = categoryIds.map(id => {
      const cat = allCategories.find(c => String(c.category_id) === String(id));
      return cat?.category_name || id;
    });
    onSave({
      id: preset?.id || `preset_${Date.now()}`,
      name: name.trim(),
      categoryIds,
      categoryNames,
    });
  }, [name, selectedIds, allCategories, preset, onSave]);

  const count = selectedIds.size;
  const countColor = count >= MAX_CATEGORIES ? '#ef4444' : count >= 120 ? '#f59e0b' : count >= 80 ? '#eab308' : '#a78bfa';

  const CategoryRow = useCallback(({ index, style }) => {
    const cat = filteredCategories[index];
    if (!cat) return null;
    const catId = String(cat.category_id);
    const checked = selectedIds.has(catId);

    return (
      <div
        style={{
          ...style,
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '0 12px', cursor: 'pointer',
        }}
        onClick={() => toggleCategory(catId)}
      >
        <div style={{
          width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
          border: checked ? '2px solid #6225ff' : '2px solid rgba(255,255,255,0.15)',
          background: checked ? '#6225ff' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}>
          {checked && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px', color: '#fff' }}>
          {cat.category_name}
        </div>
      </div>
    );
  }, [filteredCategories, selectedIds, toggleCategory]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Name input + Save button */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Preset name"
          maxLength={40}
          style={{
            flex: 1, padding: '10px 12px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff', fontSize: '13px', fontWeight: 600, outline: 'none',
          }}
        />
        <button onClick={handleSave}
          disabled={!name.trim() || count === 0}
          style={{
            padding: '10px 16px', borderRadius: '8px', flexShrink: 0,
            background: (!name.trim() || count === 0) ? 'rgba(98,37,255,0.1)' : '#6225ff',
            border: 'none', color: (!name.trim() || count === 0) ? '#666' : '#fff',
            fontSize: '12px', fontWeight: 700, cursor: (!name.trim() || count === 0) ? 'not-allowed' : 'pointer',
          }}>
          {preset ? 'Save' : 'Create'}
        </button>
      </div>

      {/* Folder search + counter */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '0 10px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={folderSearch}
            onChange={(e) => setFolderSearch(e.target.value)}
            placeholder="Search folders..."
            style={{
              flex: 1, padding: '8px 0', background: 'transparent', border: 'none',
              color: '#fff', fontSize: '11px', outline: 'none',
            }}
          />
          {folderSearch && (
            <button onClick={() => setFolderSearch('')}
              style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '2px' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div style={{
          fontSize: '11px', fontWeight: 700, color: countColor,
          minWidth: '55px', textAlign: 'right', transition: 'color 0.3s',
        }}>
          {count}/{MAX_CATEGORIES}
        </div>
      </div>

      {/* Select all / deselect */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={selectAllFiltered}
          style={{ flex: 1, padding: '6px', borderRadius: '6px', background: 'rgba(98,37,255,0.1)', border: '1px solid rgba(98,37,255,0.2)', color: '#a78bfa', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>
          Select all{folderSearch ? ' filtered' : ''}
        </button>
        <button onClick={deselectAllFiltered}
          style={{ flex: 1, padding: '6px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#888', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>
          Deselect{folderSearch ? ' filtered' : ''}
        </button>
      </div>

      {/* Categories list */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <List
          height={200}
          itemCount={filteredCategories.length}
          itemSize={36}
          width="100%"
          overscanCount={15}
        >
          {CategoryRow}
        </List>
      </div>

    </div>
  );
};

// ========== ACTIVE PRESET VIEW (NOW + Search) ==========
const PresetActiveView = ({ preset, xtreamService, onBack, onChannelSelect }) => {
  const [programs, setPrograms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const searchTimerRef = useRef(null);

  // Load NOW programs on mount + fallback fetch
  useEffect(() => {
    let cancelled = false;
    const loadNow = async () => {
      setLoading(true);
      try {
        // SQLite first
        const results = await getNowByCategories(preset.categoryIds, 200);
        if (!cancelled) setPrograms(results);

        // If SQLite has few results, try xtreamService fallback
        if (results.length < 5 && xtreamService) {
          if (!cancelled) setSyncing(true);
          try {
            const streamIds = await getStreamIdsByCategories(preset.categoryIds);
            if (streamIds.length > 0 && !cancelled) {
              // Batch fetch in chunks of 100
              for (let i = 0; i < streamIds.length && !cancelled; i += 100) {
                const chunk = streamIds.slice(i, i + 100);
                const epgResults = await xtreamService.getShortEPGBatch(chunk, 2, 100);
                const epgForInsert = {};
                Object.entries(epgResults).forEach(([sid, data]) => {
                  if (data.epg_now) {
                    epgForInsert[sid] = [{
                      title: data.epg_now,
                      start: data.epg_start || '',
                      end: data.epg_end || '',
                      startTimestamp: data.epg_start_timestamp || null,
                      stopTimestamp: data.epg_end_timestamp || null,
                      description: data.epg_description || '',
                    }];
                  }
                });
                if (Object.keys(epgForInsert).length > 0) {
                  await insertProgramsBatch(epgForInsert);
                }
              }
              // Re-read from SQLite
              if (!cancelled) {
                const updated = await getNowByCategories(preset.categoryIds, 200);
                setPrograms(updated);
              }
            }
          } catch (err) {
            console.warn('[EPGPresets] Fallback fetch error:', err);
          } finally {
            if (!cancelled) setSyncing(false);
          }
        }
      } catch (err) {
        console.warn('[EPGPresets] Load NOW error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadNow();
    return () => { cancelled = true; };
  }, [preset.categoryIds, xtreamService]);

  // Search text debounce
  useEffect(() => {
    clearTimeout(searchTimerRef.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      // Reload NOW
      getNowByCategories(preset.categoryIds, 200).then(setPrograms).catch(() => {});
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchProgramsByCategories(q, preset.categoryIds, 100);
        setPrograms(results);
      } catch (err) {
        console.warn('[EPGPresets] Search error:', err);
      }
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery, preset.categoryIds]);

  const ProgramRow = useCallback(({ index, style }) => {
    const prog = programs[index];
    if (!prog) return null;
    const now = Math.floor(Date.now() / 1000);
    const isLive = prog.start_time <= now && prog.end_time > now;
    const isFuture = prog.start_time > now;
    const minutesUntil = isFuture ? Math.round((prog.start_time - now) / 60) : 0;
    const startTime = prog.start_formatted ? prog.start_formatted.split(' ')[1]?.substring(0, 5) : '';
    const endTime = prog.end_formatted ? prog.end_formatted.split(' ')[1]?.substring(0, 5) : '';

    return (
      <div
        style={{
          ...style,
          padding: '4px 12px',
          display: 'flex', alignItems: 'center', gap: '8px',
          cursor: 'pointer',
          background: isLive ? 'rgba(98, 37, 255, 0.12)' : 'transparent',
          borderLeft: isLive ? '3px solid #6225ff' : '3px solid transparent',
        }}
        onClick={() => onChannelSelect?.({ stream_id: prog.stream_id, id: prog.stream_id, name: prog.channel_name, logo: prog.channel_logo })}
      >
        {/* Logo */}
        <div style={{ width: '40px', height: '26px', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {prog.channel_logo ? (
            <img src={prog.channel_logo} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <span style={{ fontSize: '7px', color: '#555' }}>TV</span>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isLive ? (
              <span style={{ fontSize: '7px', fontWeight: 700, color: '#fff', background: '#e53e3e', borderRadius: '2px', padding: '1px 4px', flexShrink: 0 }}>LIVE</span>
            ) : isFuture ? (
              <span style={{ fontSize: '7px', fontWeight: 600, color: '#a78bfa', background: 'rgba(167,139,250,0.15)', borderRadius: '2px', padding: '1px 4px', flexShrink: 0 }}>
                {minutesUntil < 60 ? `${minutesUntil}min` : startTime}
              </span>
            ) : null}
            <div style={{ fontSize: '10px', fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {prog.title}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '8px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prog.channel_name}</span>
            {startTime && endTime && (
              <span style={{ fontSize: '7px', color: '#666', flexShrink: 0 }}>{startTime}–{endTime}</span>
            )}
          </div>
          {isLive && prog.progress > 0 && (
            <div style={{ height: '2px', borderRadius: '1px', background: 'rgba(255,255,255,0.08)', marginTop: '2px', width: '100%' }}>
              <div style={{ height: '100%', borderRadius: '1px', background: '#6225ff', width: `${prog.progress}%`, transition: 'width 0.3s' }} />
            </div>
          )}
        </div>
      </div>
    );
  }, [programs, onChannelSelect]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px', display: 'flex' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{preset.name}</div>
          <div style={{ fontSize: '9px', color: '#666' }}>{preset.categoryIds.length} folders · {programs.length} programs</div>
        </div>
        {syncing && (
          <div style={{ width: '14px', height: '14px', border: '2px solid rgba(98,37,255,0.3)', borderTop: '2px solid #6225ff', borderRadius: '50%', animation: 'epgSpin 0.6s linear infinite' }} />
        )}
      </div>

      {/* Search bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '0 10px',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search programs..."
          style={{ flex: 1, padding: '8px 0', background: 'transparent', border: 'none', color: '#fff', fontSize: '11px', outline: 'none' }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')}
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '2px' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Mode indicator */}
      <div style={{ fontSize: '9px', color: '#555', paddingLeft: '2px' }}>
        {searchQuery.trim().length >= 2 ? 'Search results' : 'Now playing'}
      </div>

      {/* Results */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', border: '2px solid rgba(98,37,255,0.3)', borderTop: '2px solid #6225ff', borderRadius: '50%', animation: 'epgSpin 0.6s linear infinite' }} />
            <span style={{ fontSize: '11px', color: '#888' }}>Loading EPG...</span>
          </div>
        ) : programs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 20px', color: '#666', fontSize: '11px' }}>
            {searchQuery.trim().length >= 2 ? 'No programs found' : 'No programs currently airing'}
          </div>
        ) : (
          <List
            height={350}
            itemCount={programs.length}
            itemSize={52}
            width="100%"
            overscanCount={10}
          >
            {ProgramRow}
          </List>
        )}
      </div>
    </div>
  );
};

// ========== MAIN COMPONENT ==========
const EPGPresets = ({ onClose, xtreamService, onChannelSelect }) => {
  const [view, setView] = useState('list'); // list | editor | active
  const [presets, setPresets] = useState(loadPresets);
  const [editingPreset, setEditingPreset] = useState(null);
  const [activePreset, setActivePreset] = useState(null);
  const [allCategories, setAllCategories] = useState([]);

  // Load live categories from NinjaCentral
  useEffect(() => {
    const load = async () => {
      try {
        const cats = await ninjaCentral.getAll(STORES.LIVE_CATEGORIES);
        setAllCategories(cats || []);
      } catch (err) {
        console.warn('[EPGPresets] Failed to load categories:', err);
      }
    };
    load();
  }, []);

  const handleSavePreset = useCallback((preset) => {
    setPresets(prev => {
      const exists = prev.findIndex(p => p.id === preset.id);
      const next = exists >= 0 ? prev.map(p => p.id === preset.id ? preset : p) : [...prev, preset];
      savePresetsToStorage(next);
      return next;
    });
    setView('list');
    setEditingPreset(null);
  }, []);

  const handleDeletePreset = useCallback((presetId) => {
    setPresets(prev => {
      const next = prev.filter(p => p.id !== presetId);
      savePresetsToStorage(next);
      return next;
    });
  }, []);

  const handleActivate = useCallback((preset) => {
    setActivePreset(preset);
    setView('active');
  }, []);

  const handleEdit = useCallback((preset) => {
    setEditingPreset(preset);
    setView('editor');
  }, []);

  const handleCreate = useCallback(() => {
    setEditingPreset(null);
    setView('editor');
  }, []);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.92)',
      backdropFilter: 'blur(20px)',
      zIndex: 10001,
      display: 'flex', flexDirection: 'column',
      padding: '16px 20px',
    }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
          {view === 'list' ? 'EPG Presets' : view === 'editor' ? (editingPreset ? 'Edit Preset' : 'New Preset') : ''}
        </div>
        <button onClick={view === 'list' ? onClose : () => setView('list')}
          style={{ background: 'none', border: 'none', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Views */}
      {view === 'list' && (
        <PresetListView
          presets={presets}
          onActivate={handleActivate}
          onCreate={handleCreate}
          onEdit={handleEdit}
          onDelete={handleDeletePreset}
        />
      )}

      {view === 'editor' && (
        <PresetEditorView
          preset={editingPreset}
          allCategories={allCategories}
          onSave={handleSavePreset}
          onCancel={() => { setView('list'); setEditingPreset(null); }}
        />
      )}

      {view === 'active' && activePreset && (
        <PresetActiveView
          preset={activePreset}
          xtreamService={xtreamService}
          onBack={() => setView('list')}
          onChannelSelect={onChannelSelect}
        />
      )}

      <style>{`
        @keyframes epgSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default EPGPresets;
