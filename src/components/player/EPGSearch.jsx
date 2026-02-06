import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import { 
  searchProgramsByCategories, 
  getNowByCategories,
  cleanExpiredPrograms
} from '../../database/ProgramQueries';

const EPGSearch = ({ xtreamService, onChannelSelect, onSelectChannel, onClose, visible }) => {
  const [presets, setPresets] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ninja_epg_presets') || '[]');
    } catch { return []; }
  });

  const [results, setResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [, setLoading] = useState(false);
  const [syncOptions, setSyncOptions] = useState({ includeDesc: false, includeTime: true });
  const [startTimeFilter, setStartTimeFilter] = useState(null);
  const [showPresetConfig, setShowPresetConfig] = useState(false);
  const [allCategories, setAllCategories] = useState([]);
  const [loadingCats, setLoadingCats] = useState(false);

  const searchTimerRef = useRef(null);

  // Save presets to localStorage
  const savePresets = useCallback((newPresets) => {
    setPresets(newPresets);
    localStorage.setItem('ninja_epg_presets', JSON.stringify(newPresets));
  }, []);

  // Load categories for preset config
  const loadCategories = useCallback(async () => {
    if (!xtreamService || allCategories.length > 0) return;
    setLoadingCats(true);
    try {
      const cats = await xtreamService.getLiveCategories();
      setAllCategories(Array.isArray(cats) ? cats : []);
    } catch (e) {
      console.error('EPGSearch: Failed to load categories', e);
    } finally {
      setLoadingCats(false);
    }
  }, [xtreamService, allCategories.length]);

  const toggleCategory = useCallback((cat) => {
    const catId = String(cat.category_id);
    const exists = presets.find(p => p.categoryIds?.includes(catId));
    let newPresets;
    if (exists) {
      newPresets = presets.filter(p => !p.categoryIds?.includes(catId));
    } else {
      newPresets = [...presets, { name: cat.category_name, categoryIds: [catId] }];
    }
    savePresets(newPresets);
  }, [presets, savePresets]);

  const isCategorySelected = useCallback((catId) => {
    return presets.some(p => p.categoryIds?.includes(String(catId)));
  }, [presets]);

  // Auto-cleanup des programmes expirés à l'ouverture
  useEffect(() => {
    cleanExpiredPrograms().catch(() => {});
  }, []);

  const performSearch = useCallback(async (query) => {
    const q = query.trim();
    setLoading(true);
    try {
      const categoryIds = presets.flatMap(p => p.categoryIds);
      if (!categoryIds.length) return;

      let data = q.length >= 2 
        ? await searchProgramsByCategories(q, categoryIds, 150)
        : await getNowByCategories(categoryIds, 150);
      
      // Filter by start time if active
      if (startTimeFilter !== null && data.length) {
        data = data.filter(p => {
          if (!p.start_time) return false;
          const hour = new Date(p.start_time * 1000).getHours();
          return hour >= startTimeFilter && hour < startTimeFilter + 2;
        });
      }
      
      setResults(data);
    } catch (err) {
      console.error("EPG Search Error:", err);
    } finally {
      setLoading(false);
    }
  }, [presets, startTimeFilter]);

  useEffect(() => {
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => performSearch(searchQuery), 350);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery, performSearch]);

  // Re-fetch when panel becomes visible again
  useEffect(() => {
    if (visible !== false) {
      performSearch(searchQuery);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const ProgramRow = ({ index, style }) => {
    const prog = results[index];
    if (!prog) return null;

    const startTime = prog.start_formatted ? prog.start_formatted.split(' ')[1]?.substring(0, 5) : '--:--';

    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 20px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          cursor: 'pointer',
          background: 'transparent',
          transition: 'background 0.2s'
        }}
        onClick={() => {
          const ch = { 
            stream_id: prog.stream_id, 
            id: prog.stream_id, 
            name: prog.channel_name, 
            logo: prog.channel_logo 
          };
          (onChannelSelect || onSelectChannel)?.(ch);
          navigator.vibrate?.(30);
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ width: '45px', height: '30px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <img src={prog.channel_logo} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {prog.title}
          </div>
          <div style={{ fontSize: '10px', color: '#6225ff', fontWeight: 600 }}>
            {startTime} • {prog.channel_name}
          </div>
        </div>
        {prog.is_live === 1 && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff4b4b', boxShadow: '0 0 8px #ff4b4b' }} />}
      </div>
    );
  };

  // When used from Smart.jsx with visible prop
  if (visible === false) return null;

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
    }}>
      
      <div style={{ padding: '25px 20px 15px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <input 
          type="text" 
          placeholder="Recherche (Presets uniquement)..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(98, 37, 255, 0.5)',
            borderRadius: '8px',
            padding: '12px',
            color: '#fff',
            fontSize: '13px',
            outline: 'none',
            marginBottom: '15px'
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={syncOptions.includeDesc} 
                onChange={(e) => setSyncOptions(p => ({ ...p, includeDesc: e.target.checked }))} 
                style={{ accentColor: '#6225ff' }}
              />
              <span style={{ fontSize: '9px', color: '#aaa', fontWeight: 800 }}>PROFOND</span>
            </label>
            <button 
              onClick={() => {
                if (startTimeFilter === null) setStartTimeFilter(20);
                else if (startTimeFilter >= 24) setStartTimeFilter(null);
                else setStartTimeFilter(startTimeFilter + 2);
              }}
              style={{ 
                background: startTimeFilter !== null ? 'rgba(98, 37, 255, 0.4)' : 'rgba(98, 37, 255, 0.2)', 
                border: '1px solid #6225ff', borderRadius: '4px', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '4px 12px',
                cursor: 'pointer',
              }}
            >
              {startTimeFilter !== null ? `${startTimeFilter}h-${startTimeFilter + 2}h` : 'START À...'}
            </button>
            <button 
              onClick={() => {
                setShowPresetConfig(!showPresetConfig);
                if (!showPresetConfig) loadCategories();
              }}
              style={{ 
                background: showPresetConfig ? 'rgba(98, 37, 255, 0.4)' : 'rgba(98, 37, 255, 0.2)', 
                border: '1px solid #6225ff', borderRadius: '4px', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '4px 12px',
                cursor: 'pointer',
              }}
            >
              PRESETS ({presets.length})
            </button>
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 800 }}>{results.length} RESULTS</div>
        </div>
      </div>

      {/* Presets Config Panel */}
      {showPresetConfig && (
        <div style={{ maxHeight: '200px', overflow: 'auto', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px' }}>
          {loadingCats ? (
            <div style={{ fontSize: '10px', color: '#6225ff', fontWeight: 700, textAlign: 'center', padding: '10px' }}>LOADING...</div>
          ) : allCategories.length === 0 ? (
            <div style={{ fontSize: '10px', color: '#666', textAlign: 'center', padding: '10px' }}>No categories available</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {allCategories.map(cat => {
                const selected = isCategorySelected(cat.category_id);
                return (
                  <button
                    key={cat.category_id}
                    onClick={() => toggleCategory(cat)}
                    style={{
                      background: selected ? 'rgba(98,37,255,0.4)' : 'rgba(255,255,255,0.06)',
                      border: selected ? '1px solid #6225ff' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px', padding: '4px 10px', fontSize: '9px', fontWeight: 700,
                      color: selected ? '#fff' : '#888', cursor: 'pointer', transition: 'all 0.2s',
                    }}
                  >
                    {cat.category_name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        <List
          height={window.innerHeight - 150}
          itemCount={results.length}
          itemSize={58}
          width="100%"
        >
          {ProgramRow}
        </List>
      </div>
    </div>
  );
};

export default EPGSearch;
