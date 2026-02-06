import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';

const EPGSearch = ({ xtreamService, onChannelSelect, onSelectChannel, onClose, visible }) => {
  // ========== PRESETS (localStorage) ==========
  const [presets, setPresets] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ninja_epg_presets') || '[]');
    } catch { return []; }
  });
  const [activePreset, setActivePreset] = useState(null);

  // ========== STATES ==========
  const [results, setResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotLive, setIsNotLive] = useState(false);
  const [epgLimit, setEpgLimit] = useState(1);
  const [startTimeFilter, setStartTimeFilter] = useState(null);

  // ========== CATEGORY SELECTION MODE ==========
  const [showCategorySelect, setShowCategorySelect] = useState(false);
  const [allCategories, setAllCategories] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [fetchingEpg, setFetchingEpg] = useState(false);
  const [fetchProgress, setFetchProgress] = useState('');

  // ========== PRESET MANAGEMENT ==========
  const [showPresetList, setShowPresetList] = useState(false);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');

  const savePresets = useCallback((newPresets) => {
    setPresets(newPresets);
    localStorage.setItem('ninja_epg_presets', JSON.stringify(newPresets));
  }, []);

  // Load categories for selection
  const loadCategories = useCallback(async () => {
    if (!xtreamService) return;
    if (allCategories.length > 0) return;
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

  // Toggle category selection
  const toggleCategorySelection = useCallback((catId) => {
    const id = String(catId);
    setSelectedCategoryIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }, []);

  // ========== CONFIRM: Fetch EPG for selected categories ==========
  const handleConfirmSelection = useCallback(async () => {
    if (!xtreamService || selectedCategoryIds.length === 0) return;
    setFetchingEpg(true);
    setFetchProgress('Loading channels...');
    setShowCategorySelect(false);

    try {
      // Get all streams for selected categories
      let allStreams = [];
      for (let i = 0; i < selectedCategoryIds.length; i++) {
        const catId = selectedCategoryIds[i];
        const catName = allCategories.find(c => String(c.category_id) === catId)?.category_name || catId;
        setFetchProgress(`Loading ${catName}... (${i + 1}/${selectedCategoryIds.length})`);

        const streams = await xtreamService.getLiveStreams(catId);
        if (Array.isArray(streams)) {
          allStreams.push(...streams.map(s => ({
            id: s.stream_id,
            name: s.name,
            logo: s.stream_icon || null,
            categoryName: catName,
          })));
        }
      }

      if (allStreams.length === 0) {
        setFetchProgress('No channels found');
        setFetchingEpg(false);
        return;
      }

      // Fetch EPG
      const streamIds = allStreams.map(s => s.id).filter(Boolean);
      const limit = isNotLive ? epgLimit : 1;
      setFetchProgress(`Fetching EPG for ${streamIds.length} channels (limit=${limit})...`);

      const epgResults = await xtreamService.getShortEPGBatch(streamIds, limit, 50);

      // Build results
      const newResults = [];
      allStreams.forEach(stream => {
        const epg = epgResults[stream.id];
        if (epg) {
          newResults.push({
            stream_id: stream.id,
            channel_name: stream.name,
            channel_logo: stream.logo,
            category_name: stream.categoryName,
            title: epg.epg_now || 'No program info',
            epg_start: epg.epg_start || '',
            epg_end: epg.epg_end || '',
            progress: epg.progress || 0,
            is_live: epg.progress > 0 && epg.progress < 100 ? 1 : 0,
          });
        }
      });

      setResults(newResults);
      setFetchProgress(`${newResults.length} programs loaded`);
      navigator.vibrate?.(30);
    } catch (err) {
      console.error('EPG Fetch Error:', err);
      setFetchProgress('Error: ' + err.message);
    } finally {
      setFetchingEpg(false);
    }
  }, [xtreamService, selectedCategoryIds, allCategories, isNotLive, epgLimit]);

  // ========== SAVE AS PRESET ==========
  const handleSavePreset = useCallback(() => {
    if (!presetName.trim() || selectedCategoryIds.length === 0) return;
    const newPreset = {
      name: presetName.trim(),
      categoryIds: [...selectedCategoryIds],
    };
    savePresets([...presets, newPreset]);
    setPresetName('');
    setShowSavePreset(false);
    navigator.vibrate?.(30);
  }, [presetName, selectedCategoryIds, presets, savePresets]);

  // ========== LOAD PRESET ==========
  const handleLoadPreset = useCallback((preset) => {
    setSelectedCategoryIds(preset.categoryIds || []);
    setActivePreset(preset.name);
    setShowPresetList(false);
  }, []);

  // ========== DELETE PRESET ==========
  const handleDeletePreset = useCallback((index) => {
    const newPresets = presets.filter((_, i) => i !== index);
    savePresets(newPresets);
    if (newPresets.length === 0) setActivePreset(null);
  }, [presets, savePresets]);

  // Auto-confirm when preset is loaded
  useEffect(() => {
    if (activePreset && selectedCategoryIds.length > 0 && !fetchingEpg && results.length === 0) {
      handleConfirmSelection();
    }
  }, [activePreset, selectedCategoryIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // ========== FILTER RESULTS ==========
  const displayResults = useMemo(() => {
    let items = results;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(r =>
        (r.title || '').toLowerCase().includes(q) ||
        (r.channel_name || '').toLowerCase().includes(q)
      );
    }

    if (startTimeFilter !== null) {
      items = items.filter(p => {
        const startStr = p.epg_start;
        if (!startStr) return false;
        const hour = parseInt(startStr.split(':')[0], 10);
        return hour >= startTimeFilter && hour < startTimeFilter + 2;
      });
    }

    return items;
  }, [results, searchQuery, startTimeFilter]);

  const ProgramRow = ({ index, style }) => {
    const prog = displayResults[index];
    if (!prog) return null;

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
          transition: 'background 0.2s',
        }}
        onClick={() => {
          const ch = {
            stream_id: prog.stream_id,
            id: prog.stream_id,
            name: prog.channel_name,
            logo: prog.channel_logo,
          };
          (onChannelSelect || onSelectChannel)?.(ch);
          navigator.vibrate?.(30);
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ width: '45px', height: '30px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {prog.channel_logo && (
            <img src={prog.channel_logo} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {prog.title}
          </div>
          <div style={{ fontSize: '10px', color: '#6225ff', fontWeight: 600 }}>
            {prog.epg_start || '--:--'} • {prog.channel_name}
          </div>
        </div>
        {prog.progress > 0 && (
          <div style={{ width: '40px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }}>
            <div style={{ height: '100%', borderRadius: '2px', background: '#6225ff', width: `${Math.min(100, prog.progress)}%` }} />
          </div>
        )}
        {prog.is_live === 1 && (
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff4b4b', boxShadow: '0 0 8px #ff4b4b', flexShrink: 0 }} />
        )}
      </div>
    );
  };

  if (visible === false) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ========== HEADER ========== */}
      <div style={{ padding: '25px 20px 15px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <input
          type="text"
          placeholder="Search program..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(10,10,10,0.95)',
            border: '1px solid rgba(98, 37, 255, 0.5)',
            borderRadius: '8px',
            padding: '12px',
            color: '#fff',
            fontSize: '13px',
            outline: 'none',
            marginBottom: '10px',
          }}
        />

        {/* Controls Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* IS NOT LIVE toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isNotLive}
                onChange={(e) => setIsNotLive(e.target.checked)}
                style={{ accentColor: '#6225ff' }}
              />
              <span style={{ fontSize: '9px', color: isNotLive ? '#fff' : '#aaa', fontWeight: 800 }}>IS NOT LIVE</span>
            </label>

            {/* EPG Limit dropdown */}
            <select
              value={epgLimit}
              onChange={(e) => setEpgLimit(Number(e.target.value))}
              style={{
                background: 'rgba(98,37,255,0.2)',
                border: '1px solid #6225ff',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '9px',
                fontWeight: 800,
                padding: '4px 6px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value={1}>1 PROG</option>
              <option value={2}>2 PROG</option>
              <option value={3}>3 PROG</option>
              <option value={4}>4 PROG</option>
            </select>

            {/* TIME filter */}
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
              {startTimeFilter !== null ? `${startTimeFilter}h-${startTimeFilter + 2}h` : 'TIME'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* PRESETS */}
            <button
              onClick={() => {
                setShowPresetList(!showPresetList);
                setShowCategorySelect(false);
                setShowSavePreset(false);
              }}
              style={{
                background: showPresetList ? 'rgba(98, 37, 255, 0.4)' : 'rgba(98, 37, 255, 0.2)',
                border: '1px solid #6225ff', borderRadius: '4px', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '4px 12px',
                cursor: 'pointer',
              }}
            >
              PRESETS ({presets.length})
            </button>

            {/* SELECT CATEGORIES */}
            <button
              onClick={() => {
                setShowCategorySelect(!showCategorySelect);
                setShowPresetList(false);
                setShowSavePreset(false);
                if (!showCategorySelect) loadCategories();
              }}
              style={{
                background: showCategorySelect ? 'rgba(98, 37, 255, 0.4)' : 'rgba(98, 37, 255, 0.2)',
                border: '1px solid #6225ff', borderRadius: '4px', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '4px 12px',
                cursor: 'pointer',
              }}
            >
              SELECT ({selectedCategoryIds.length})
            </button>
          </div>
        </div>

        {/* Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <div style={{ fontSize: '9px', color: fetchingEpg ? '#6225ff' : '#555', fontWeight: 700 }}>
            {fetchingEpg ? fetchProgress : activePreset ? `Preset: ${activePreset}` : ''}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 800 }}>
            {displayResults.length} RESULTS
          </div>
        </div>
      </div>

      {/* ========== PRESET LIST ========== */}
      {showPresetList && (
        <div style={{ maxHeight: '150px', overflow: 'auto', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '8px 20px' }}>
          {presets.length === 0 ? (
            <div style={{ fontSize: '10px', color: '#666', textAlign: 'center', padding: '10px' }}>No presets saved</div>
          ) : (
            presets.map((preset, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <button
                  onClick={() => handleLoadPreset(preset)}
                  style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: '4px 0' }}
                >
                  {preset.name} <span style={{ color: '#6225ff', fontSize: '9px' }}>({preset.categoryIds?.length || 0} folders)</span>
                </button>
                <button
                  onClick={() => handleDeletePreset(idx)}
                  style={{ background: 'none', border: 'none', color: '#ff4b4b', fontSize: '10px', cursor: 'pointer', padding: '4px 8px' }}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========== CATEGORY SELECTION ========== */}
      {showCategorySelect && (
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ maxHeight: '200px', overflow: 'auto', padding: '8px 20px' }}>
            {loadingCats ? (
              <div style={{ fontSize: '10px', color: '#6225ff', fontWeight: 700, textAlign: 'center', padding: '10px' }}>LOADING...</div>
            ) : allCategories.length === 0 ? (
              <div style={{ fontSize: '10px', color: '#666', textAlign: 'center', padding: '10px' }}>No categories available</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {allCategories.map(cat => {
                  const selected = selectedCategoryIds.includes(String(cat.category_id));
                  return (
                    <button
                      key={cat.category_id}
                      onClick={() => toggleCategorySelection(cat.category_id)}
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
          {/* CONFIRM + SAVE AS PRESET */}
          <div style={{ display: 'flex', gap: '8px', padding: '8px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              onClick={handleConfirmSelection}
              disabled={selectedCategoryIds.length === 0 || fetchingEpg}
              style={{
                flex: 1,
                background: selectedCategoryIds.length > 0 ? '#6225ff' : 'rgba(255,255,255,0.1)',
                border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '8px',
                cursor: selectedCategoryIds.length > 0 ? 'pointer' : 'not-allowed',
                opacity: fetchingEpg ? 0.5 : 1,
              }}
            >
              {fetchingEpg ? 'FETCHING...' : `CONFIRM (${selectedCategoryIds.length})`}
            </button>
            <button
              onClick={() => setShowSavePreset(!showSavePreset)}
              disabled={selectedCategoryIds.length === 0}
              style={{
                background: 'rgba(98,37,255,0.2)',
                border: '1px solid #6225ff', borderRadius: '6px', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '8px 16px',
                cursor: selectedCategoryIds.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              SAVE AS PRESET
            </button>
          </div>
          {/* Save preset name input */}
          {showSavePreset && (
            <div style={{ display: 'flex', gap: '8px', padding: '0 20px 8px' }}>
              <input
                type="text"
                placeholder="Preset name (e.g. FRANCE SPORT)"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                style={{
                  flex: 1, background: 'rgba(10,10,10,0.95)', border: '1px solid rgba(98,37,255,0.3)',
                  borderRadius: '4px', padding: '6px 10px', color: '#fff', fontSize: '11px', outline: 'none',
                }}
              />
              <button
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
                style={{
                  background: presetName.trim() ? '#6225ff' : 'rgba(255,255,255,0.1)',
                  border: 'none', borderRadius: '4px', color: '#fff', fontSize: '10px', fontWeight: 800, padding: '6px 16px',
                  cursor: presetName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                SAVE
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========== RESULTS LIST ========== */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {displayResults.length > 0 ? (
          <List
            height={window.innerHeight - 150}
            itemCount={displayResults.length}
            itemSize={58}
            width="100%"
          >
            {ProgramRow}
          </List>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '12px' }}>
            {fetchingEpg ? (
              <>
                <div style={{ width: '24px', height: '24px', border: '2px solid #6225ff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <div style={{ fontSize: '10px', color: '#6225ff', fontWeight: 700 }}>{fetchProgress}</div>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#555', fontWeight: 600 }}>
                  {selectedCategoryIds.length > 0 ? 'Press CONFIRM to fetch EPG' : 'Select categories to start'}
                </div>
                <div style={{ fontSize: '9px', color: '#444', marginTop: '4px' }}>
                  Use SELECT to pick folders, or load a PRESET
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default EPGSearch;
