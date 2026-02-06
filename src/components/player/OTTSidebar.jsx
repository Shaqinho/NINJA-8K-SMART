import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { FixedSizeList as List } from 'react-window';
import { ninjaCentral, STORES } from '../../services/NinjaCentral';
import { searchProgramsByTitle, getProgramsForChannel, insertProgramsBatch } from '../../database/ProgramQueries';

// ============================================================================
// OTT SIDEBAR - Composant autonome pour mode paysage/fullscreen
// 
// Features:
// - Pill discrète avec animation jiggle à l'entrée
// - Respiration subtile (pulse blanc 20%)
// - Auto-hide après 3s d'inactivité
// - Combo: Tap (bounce) + Swipe → = ouvre sidebar
// - Long press = toggle sidebar
// - Swipe ← sur sidebar = ferme
// - Tabs LIVE | MOVIES | SERIES
// - Windowing pour performance (400+ dossiers, 47K+ channels)
// - Fond translucide avec particles visibles
// - Ticker text for overflowing content
// - 2-finger swipe folder navigation
// - Search within current folder
// - Lazy-load series season count
// ============================================================================

// ========== TICKER TEXT COMPONENT ==========
const TickerText = ({ children, style = {} }) => {
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const [needsTicker, setNeedsTicker] = useState(false);

  useEffect(() => {
    if (textRef.current && containerRef.current) {
      setNeedsTicker(textRef.current.scrollWidth > containerRef.current.clientWidth);
    }
  }, [children]);

  return (
    <div
      ref={containerRef}
      style={{
        ...style,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        position: 'relative',
      }}
    >
      <span
        ref={textRef}
        style={{
          display: 'inline-block',
          ...(needsTicker ? {
            animation: 'ottTicker 8s linear infinite',
            paddingRight: '40px',
          } : {}),
        }}
      >
        {children}
        {needsTicker && <span style={{ paddingLeft: '40px' }}>{children}</span>}
      </span>
    </div>
  );
};

// ========== NINJA KEYBOARD (QWERTY/AZERTY + Numpad + Special Chars + Draggable) ==========
const LAYOUTS = {
  qwerty: {
    nums: ['1','2','3','4','5','6','7','8','9','0'],
    rows: [
      ['Q','W','E','R','T','Y','U','I','O','P'],
      ['A','S','D','F','G','H','J','K','L'],
      ['Z','X','C','V','B','N','M'],
    ],
  },
  azerty: {
    nums: ['1','2','3','4','5','6','7','8','9','0'],
    rows: [
      ['A','Z','E','R','T','Y','U','I','O','P'],
      ['Q','S','D','F','G','H','J','K','L'],
      ['W','X','C','V','B','N','M'],
    ],
  },
};
const SPECIAL_CHARS = [':','@','-','_','*','+','/','=','.'];
const SHORTCUTS = ['http://','https://'];
const detectDefaultLayout = () => /^(fr|be)/i.test(navigator.language || '') ? 'azerty' : 'qwerty';

const NinjaKeyboard = ({ position, onPositionChange, onInput, onBackspace, onClose, searchQuery }) => {
  const dragRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const isDraggingRef = useRef(false);
  const [layout, setLayout] = useState(detectDefaultLayout);
  const [pressedKey, setPressedKey] = useState(null);
  const pressTimerRef = useRef(null);

  const handleDragStart = useCallback((e) => {
    const touch = e.touches?.[0] || e;
    dragStartRef.current = { x: touch.clientX, y: touch.clientY, posX: position.x, posY: position.y };
    isDraggingRef.current = true;
  }, [position]);

  const handleDragMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const touch = e.touches?.[0] || e;
    const dx = touch.clientX - dragStartRef.current.x;
    const dy = touch.clientY - dragStartRef.current.y;
    onPositionChange({
      x: Math.max(0, Math.min(window.innerWidth - 380, dragStartRef.current.posX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - 200, dragStartRef.current.posY + dy)),
    });
  }, [onPositionChange]);

  const handleDragEnd = useCallback(() => { isDraggingRef.current = false; }, []);

  useEffect(() => {
    if (!isDraggingRef.current) return;
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
    return () => {
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [handleDragMove, handleDragEnd]);

  useEffect(() => () => clearTimeout(pressTimerRef.current), []);

  const handleKeyPress = useCallback((char, keyId) => {
    onInput(char);
    setPressedKey(keyId);
    clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => setPressedKey(null), 150);
  }, [onInput]);

  const handleBackspacePress = useCallback(() => {
    onBackspace();
    setPressedKey('⌫');
    clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => setPressedKey(null), 150);
  }, [onBackspace]);

  const currentLayout = LAYOUTS[layout];

  const keyBase = {
    minWidth: '30px', height: '34px', borderRadius: '6px', border: 'none',
    color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent', position: 'relative', padding: 0,
  };

  const getKeyStyle = (keyId) => ({
    ...keyBase,
    background: pressedKey === keyId ? '#6225ff' : 'rgba(255,255,255,0.12)',
    transform: pressedKey === keyId ? 'scale(1.05)' : 'scale(1)',
    transition: 'background 0.08s, transform 0.08s',
  });

  const ZoomPopup = ({ keyId, children }) => {
    if (pressedKey !== keyId) return null;
    return (
      <div style={{
        position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
        background: '#6225ff', color: '#fff', fontSize: '18px', fontWeight: 700,
        borderRadius: '8px', padding: '4px 10px', minWidth: '32px', textAlign: 'center',
        boxShadow: '0 4px 16px rgba(98,37,255,0.5)', pointerEvents: 'none', zIndex: 10,
        whiteSpace: 'nowrap',
      }}>
        {children}
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', left: `${position.x}px`, top: `${position.y}px`, zIndex: 10002,
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)', userSelect: 'none', touchAction: 'none',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Drag Handle */}
      <div ref={dragRef} onTouchStart={handleDragStart} onMouseDown={handleDragStart}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 10px', cursor: 'grab', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
        <div style={{ width: '24px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)' }} />
        <div style={{ fontSize: '10px', color: '#888', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {searchQuery || '...'}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Layout toggle */}
          <button onClick={() => setLayout(l => l === 'qwerty' ? 'azerty' : 'qwerty')}
            style={{ background: 'rgba(98,37,255,0.2)', border: '1px solid rgba(98,37,255,0.3)', borderRadius: '4px', padding: '2px 6px', color: '#a78bfa', fontSize: '9px', fontWeight: 700, cursor: 'pointer' }}>
            {layout === 'qwerty' ? 'QWE' : 'AZE'}
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      {/* Main content: Keys left + Special right */}
      <div style={{ display: 'flex', gap: '6px', padding: '6px 8px 8px' }}>
        {/* Left: Main keyboard */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* Numbers row */}
          <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
            {currentLayout.nums.map(key => (
              <button key={`n${key}`} onClick={() => handleKeyPress(key, `n${key}`)} style={{ ...getKeyStyle(`n${key}`), minWidth: '26px', fontSize: '11px', color: '#aaa' }}>
                <ZoomPopup keyId={`n${key}`}>{key}</ZoomPopup>
                {key}
              </button>
            ))}
          </div>
          {/* Letter rows */}
          <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
            {currentLayout.rows[0].map(key => (
              <button key={key} onClick={() => handleKeyPress(key.toLowerCase(), key)} style={getKeyStyle(key)}>
                <ZoomPopup keyId={key}>{key}</ZoomPopup>
                {key}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', paddingLeft: '10px', paddingRight: '10px' }}>
            {currentLayout.rows[1].map(key => (
              <button key={key} onClick={() => handleKeyPress(key.toLowerCase(), key)} style={getKeyStyle(key)}>
                <ZoomPopup keyId={key}>{key}</ZoomPopup>
                {key}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
            {currentLayout.rows[2].map(key => (
              <button key={key} onClick={() => handleKeyPress(key.toLowerCase(), key)} style={getKeyStyle(key)}>
                <ZoomPopup keyId={key}>{key}</ZoomPopup>
                {key}
              </button>
            ))}
            <button onClick={handleBackspacePress} style={{ ...getKeyStyle('⌫'), minWidth: '42px', background: pressedKey === '⌫' ? '#ef4444' : 'rgba(255,80,80,0.2)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
              </svg>
            </button>
          </div>
          {/* Space row */}
          <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
            <button onClick={() => handleKeyPress(' ', 'space')} style={{ ...getKeyStyle('space'), flex: 1, minWidth: '160px', color: '#888' }}>
              <ZoomPopup keyId="space">␣</ZoomPopup>
              space
            </button>
          </div>
        </div>

        {/* Right: Special chars + shortcuts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '6px' }}>
          {/* Special characters in 3-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}>
            {SPECIAL_CHARS.map(ch => (
              <button key={ch} onClick={() => handleKeyPress(ch, `sp_${ch}`)} style={{ ...getKeyStyle(`sp_${ch}`), minWidth: '28px', fontSize: '12px', color: '#ccc' }}>
                <ZoomPopup keyId={`sp_${ch}`}>{ch}</ZoomPopup>
                {ch}
              </button>
            ))}
          </div>
          {/* URL shortcuts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
            {SHORTCUTS.map(sc => (
              <button key={sc} onClick={() => handleKeyPress(sc, `sc_${sc}`)}
                style={{
                  ...getKeyStyle(`sc_${sc}`), minWidth: '80px', fontSize: '8px', fontWeight: 600,
                  color: '#a78bfa', background: pressedKey === `sc_${sc}` ? '#6225ff' : 'rgba(98,37,255,0.12)',
                  padding: '0 4px', whiteSpace: 'nowrap',
                }}>
                {sc}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const OTTSidebar = forwardRef(({ 
  categories = [], 
  channels = [],
  selectedCategory,
  selectedChannel,
  onCategorySelect,
  onChannelSelect,
  onClose,
  isOpen: externalIsOpen,
  onToggle: externalOnToggle,
  onTabChange,
  xtreamService,
}, ref) => {
  // States
  const [isVisible, setIsVisible] = useState(true);
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(false);
  const [isBouncing, setIsBouncing] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [activeTab, setActiveTab] = useState('live');
  const [categoryCounts, setCategoryCounts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [programResults, setProgramResults] = useState([]);
  const [, setProgramSearching] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardPos, setKeyboardPos] = useState({ x: 290, y: 60 });
  
  // Tab-specific data from NinjaCentral
  const [vodCategories, setVodCategories] = useState([]);
  const [seriesCategories, setSeriesCategories] = useState([]);
  const [vodItems, setVodItems] = useState([]);
  const [seriesItems, setSeriesItems] = useState([]);
  const [seriesSeasons, setSeriesSeasons] = useState({});
  
  // EPG lazy-load
  const [epgData, setEpgData] = useState({});
  
  // ========== CERCLE 1 - SQLite EPG + On-demand fetch ==========
  const [sqliteEpg, setSqliteEpg] = useState({}); // { streamId: { title, progress } }
  const circle1FetchingRef = useRef(new Set()); // IDs currently being fetched
  const circle1ErrorCacheRef = useRef(new Map()); // ID → timestamp (TTL 60s)
  const [epgSyncProgress, setEpgSyncProgress] = useState(0);
  
  // Favorites (persisted in localStorage)
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ninja_favorites') || '{}'); } catch { return {}; }
  });
  
  // Recent channels
  const [recentIds, setRecentIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ninja_recent') || '[]'); } catch { return []; }
  });
  
  // Long press / triple tap for favorites
  const itemLongPressRef = useRef(null);
  const itemTapCountRef = useRef(0);
  const itemTapTimerRef = useRef(null);
  const itemTouchStartPos = useRef({ x: 0, y: 0 });
  const [shakingItemId, setShakingItemId] = useState(null);

  // Global multi-touch: cancel long press if 2+ fingers detected anywhere
  useEffect(() => {
    const onTouch = (e) => {
      if (e.touches.length >= 2 && itemLongPressRef.current) {
        clearTimeout(itemLongPressRef.current);
        itemLongPressRef.current = null;
        setShakingItemId(null);
      }
    };
    window.addEventListener('touchstart', onTouch, { passive: true });
    return () => window.removeEventListener('touchstart', onTouch);
  }, []);
  
  // Use external control if provided, otherwise internal
  const isSidebarOpen = externalIsOpen !== undefined ? externalIsOpen : internalSidebarOpen;
  const setSidebarOpen = externalOnToggle || setInternalSidebarOpen;
  
  // Refs
  const pillRef = useRef(null);
  const sidebarRef = useRef(null);
  const hideTimerRef = useRef(null);
  const swipeStartRef = useRef({ x: 0, y: 0 });
  const longPressTimerRef = useRef(null);
  const listRef = useRef(null);
  const searchInputRef = useRef(null);

  // Focus visuel : chaîne qui clignote après scroll depuis EPGSearch
  const [focusedStreamId, setFocusedStreamId] = useState(null);
  const focusTimerRef = useRef(null);

  // ========== FAVORITES ==========
  const toggleFavorite = useCallback((itemId) => {
    setFavorites(prev => {
      const next = { ...prev };
      if (next[itemId]) delete next[itemId];
      else next[itemId] = true;
      localStorage.setItem('ninja_favorites', JSON.stringify(next));
      return next;
    });
  }, []);

  // ========== RECENT TRACKER ==========
  const addRecent = useCallback((itemId) => {
    setRecentIds(prev => {
      const next = [itemId, ...prev.filter(id => id !== itemId)].slice(0, 50);
      localStorage.setItem('ninja_recent', JSON.stringify(next));
      return next;
    });
  }, []);

  // ========== ACTIVE ITEMS BASED ON TAB ==========
  const activeItems = useMemo(() => {
    if (activeTab === 'live') return channels;
    if (activeTab === 'movies') return vodItems;
    if (activeTab === 'series') return seriesItems;
    return [];
  }, [activeTab, channels, vodItems, seriesItems]);

  // ========== SYSTEM FOLDERS ==========
  const systemFolders = useMemo(() => {
    const totalCount = activeItems.length;
    const favCount = activeItems.filter(item => favorites[item.stream_id || item.id || item.series_id]).length;
    const recentCount = activeItems.filter(item => recentIds.includes(item.stream_id || item.id || item.series_id)).length;
    return [
      { category_id: '__all__', category_name: 'ALL', count: totalCount, isSystem: true },
      { category_id: '__favorites__', category_name: 'FAVORITES', count: favCount, isSystem: true },
      { category_id: '__recent__', category_name: 'RECENT', count: recentCount, isSystem: true },
    ];
  }, [activeItems, favorites, recentIds]);

  // ========== EPG BATCH LOAD (same method as Smart) ==========
  const epgLoadedCategoriesRef = useRef(new Set());

  // ========== SYNC PROGRESS POLLING ==========
  useEffect(() => {
    const interval = setInterval(() => {
      const progress = window.__epgSyncProgress || 0;
      setEpgSyncProgress(prev => prev !== progress ? progress : prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // ========== CERCLE 1: SQLite READ for visible channels ==========
  const loadSqliteEpgForItems = useCallback(async (items) => {
    if (!items?.length || activeTab !== 'live') return;
    const ERROR_TTL = 60000; // 60s cache for failed fetches
    const newEpg = {};
    const needsFetch = []; // IDs that are empty in SQLite and need network

    for (const item of items) {
      const streamId = item.stream_id || item.id;
      if (!streamId) continue;

      try {
        const programs = await getProgramsForChannel(streamId, true);
        if (programs.length > 0) {
          const current = programs.find(p => p.is_currently_live) || programs[0];
          newEpg[streamId] = {
            title: current.title,
            progress: current.progress || 0,
            start_time: current.start_time,
            end_time: current.end_time,
          };
        } else {
          // SQLite empty → candidate for Cercle 1 fetch
          const errorTs = circle1ErrorCacheRef.current.get(streamId);
          const isCoolingDown = errorTs && (Date.now() - errorTs < ERROR_TTL);
          const isFetching = circle1FetchingRef.current.has(streamId);
          if (!isCoolingDown && !isFetching) {
            needsFetch.push(streamId);
          }
        }
      } catch {
        // SQLite not ready yet, skip silently
      }
    }

    if (Object.keys(newEpg).length > 0) {
      setSqliteEpg(prev => ({ ...prev, ...newEpg }));
    }

    // Cercle 1: On-demand fetch for missing channels (batch)
    if (needsFetch.length > 0 && xtreamService) {
      // Mark as fetching
      needsFetch.forEach(id => circle1FetchingRef.current.add(id));

      // Fire and forget - don't block rendering
      (async () => {
        try {
          const epgResults = await xtreamService.getShortEPGBatch(needsFetch, 2, 20);
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
            // Re-read from SQLite to update UI
            const updatedEpg = {};
            for (const sid of Object.keys(epgForInsert)) {
              try {
                const progs = await getProgramsForChannel(parseInt(sid), true);
                if (progs.length > 0) {
                  const cur = progs.find(p => p.is_currently_live) || progs[0];
                  updatedEpg[sid] = {
                    title: cur.title,
                    progress: cur.progress || 0,
                    start_time: cur.start_time,
                    end_time: cur.end_time,
                  };
                }
              } catch { /* skip */ }
            }
            if (Object.keys(updatedEpg).length > 0) {
              setSqliteEpg(prev => ({ ...prev, ...updatedEpg }));
            }
          }
        } catch {
          // Mark all as errored with TTL
          needsFetch.forEach(id => circle1ErrorCacheRef.current.set(id, Date.now()));
        } finally {
          needsFetch.forEach(id => circle1FetchingRef.current.delete(id));
        }
      })();
    }
  }, [activeTab, xtreamService]);

  const loadEpgForCategory = useCallback(async (categoryId, items) => {
    if (!xtreamService || activeTab !== 'live') return;
    if (epgLoadedCategoriesRef.current.has(categoryId)) return;
    if (items.length === 0) return;

    epgLoadedCategoriesRef.current.add(categoryId);

    try {
      const streamIds = items.map(item => item.stream_id || item.id).filter(Boolean);
      if (streamIds.length === 0) return;

      const epgResults = await xtreamService.getShortEPGBatch(streamIds, 2, 100);
      setEpgData(prev => ({ ...prev, ...epgResults }));
    } catch (err) {
      console.warn('EPG batch load error:', err);
    }
  }, [xtreamService, activeTab]);

  // ========== ACTIVE CATEGORIES WITH SYSTEM FOLDERS ==========
  const activeCategories = useMemo(() => {
    let cats = [];
    if (activeTab === 'live') cats = categories;
    else if (activeTab === 'movies') cats = vodCategories;
    else if (activeTab === 'series') cats = seriesCategories;
    return [...systemFolders, ...cats];
  }, [activeTab, categories, vodCategories, seriesCategories, systemFolders]);

  // ========== LOAD DATA FROM NINJACENTRAL ==========
  useEffect(() => {
    const loadData = async () => {
      try {
        const counts = {};

        // Live counts
        const liveChannels = await ninjaCentral.getAll(STORES.LIVE);
        liveChannels.forEach(channel => {
          const catId = String(channel.categoryId);
          counts[`live_${catId}`] = (counts[`live_${catId}`] || 0) + 1;
        });

        // VOD data
        const vod = await ninjaCentral.getAll(STORES.VOD);
        const vodCats = await ninjaCentral.getAll(STORES.VOD_CATEGORIES);
        vod.forEach(item => {
          const catId = String(item.categoryId);
          counts[`vod_${catId}`] = (counts[`vod_${catId}`] || 0) + 1;
        });
        setVodItems(vod);
        setVodCategories(vodCats);

        // Series data
        const series = await ninjaCentral.getAll(STORES.SERIES);
        const seriesCats = await ninjaCentral.getAll(STORES.SERIES_CATEGORIES);
        series.forEach(item => {
          const catId = String(item.categoryId);
          counts[`series_${catId}`] = (counts[`series_${catId}`] || 0) + 1;
        });
        setSeriesItems(series);
        setSeriesCategories(seriesCats);

        setCategoryCounts(counts);
      } catch (err) {
        console.warn('OTTSidebar: Could not load data from NinjaCentral', err);
      }
    };
    
    if (isSidebarOpen) {
      loadData();
    }
  }, [isSidebarOpen]);

  // ========== LAZY-LOAD SERIES SEASONS ==========
  const loadSeriesSeasons = useCallback(async (seriesId) => {
    if (seriesSeasons[seriesId] !== undefined || !xtreamService) return;
    try {
      const info = await xtreamService.getSeriesInfo(seriesId);
      const seasonCount = info?.episodes ? Object.keys(info.episodes).length : 0;
      setSeriesSeasons(prev => ({ ...prev, [seriesId]: seasonCount }));
    } catch {
      setSeriesSeasons(prev => ({ ...prev, [seriesId]: 0 }));
    }
  }, [seriesSeasons, xtreamService]);

  // ========== GET COUNT FOR CATEGORY ==========
  const getCategoryCount = useCallback((catId) => {
    if (activeTab === 'live') return categoryCounts[`live_${catId}`] || 0;
    if (activeTab === 'movies') return categoryCounts[`vod_${catId}`] || 0;
    if (activeTab === 'series') return categoryCounts[`series_${catId}`] || 0;
    return 0;
  }, [activeTab, categoryCounts]);

  // ========== COUNT LABEL ==========
  const getCountLabel = useCallback((count) => {
    if (activeTab === 'live') return `${count} channels`;
    if (activeTab === 'movies') return `${count} movies`;
    if (activeTab === 'series') return `${count} series`;
    return `${count}`;
  }, [activeTab]);

  // ========== AUTO-HIDE LOGIC ==========
  const startHideTimer = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    if (!isSidebarOpen) {
      hideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 3000);
    }
  }, [isSidebarOpen]);
  
  const showPill = useCallback(() => {
    setIsVisible(true);
    startHideTimer();
  }, [startHideTimer]);
  
  useEffect(() => {
    const handleTouch = () => showPill();
    window.addEventListener('touchstart', handleTouch);
    window.addEventListener('mousemove', handleTouch);
    startHideTimer();
    return () => {
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('mousemove', handleTouch);
      clearTimeout(hideTimerRef.current);
    };
  }, [showPill, startHideTimer]);
  
  // ========== SIDEBAR CONTROLS ==========
  const openSidebar = useCallback(() => {
    setSidebarOpen(true);
    setIsBouncing(false);
    clearTimeout(hideTimerRef.current);
  }, [setSidebarOpen]);
  
  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    setShowItems(false);
    setCurrentCategory(null);
    setSearchQuery('');
    setSearchOpen(false);
    setProgramResults([]);
    setShowKeyboard(false);
    startHideTimer();
    onClose?.();
  }, [setSidebarOpen, startHideTimer, onClose]);
  
  // ========== PILL GESTURES ==========
  const triggerBounce = useCallback(() => {
    if (!isBouncing && !isSidebarOpen) {
      setIsBouncing(true);
      setTimeout(() => setIsBouncing(false), 600);
    }
  }, [isBouncing, isSidebarOpen]);
  
  const handlePillTouchStart = useCallback((e) => {
    e.stopPropagation();
    showPill();
    swipeStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
    triggerBounce();
    longPressTimerRef.current = setTimeout(() => {
      if (isSidebarOpen) {
        closeSidebar();
      } else {
        openSidebar();
      }
    }, 500);
  }, [showPill, triggerBounce, isSidebarOpen, openSidebar, closeSidebar]);
  
  const handlePillTouchMove = useCallback((e) => {
    if (isBouncing) {
      const deltaX = e.touches[0].clientX - swipeStartRef.current.x;
      const deltaY = Math.abs(e.touches[0].clientY - swipeStartRef.current.y);
      if (deltaX > 30 && deltaY < 50) {
        e.preventDefault();
        clearTimeout(longPressTimerRef.current);
        openSidebar();
      }
    }
  }, [isBouncing, openSidebar]);
  
  const handlePillTouchEnd = useCallback(() => {
    clearTimeout(longPressTimerRef.current);
  }, []);
  
  // ========== SIDEBAR GESTURES ==========
  const handleSidebarTouchStart = useCallback((e) => {
    swipeStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  }, []);
  
  const handleSidebarTouchEnd = useCallback((e) => {
    // Logique de swipe gauche supprimée pour éviter les fermetures accidentelles
  }, []);
  
  // ========== CATEGORY/ITEM SELECTION ==========
  const handleCategoryClick = useCallback((category) => {
    setCurrentCategory(category);
    setShowItems(true);
    setSearchQuery('');
    setSearchOpen(false);
    onCategorySelect?.(category);
  }, [onCategorySelect]);
  
  const handleItemClick = useCallback((item) => {
    const itemId = item.stream_id || item.id || item.series_id;
    
    // Triple-tap detection
    itemTapCountRef.current += 1;
    clearTimeout(itemTapTimerRef.current);
    
    if (itemTapCountRef.current >= 3) {
      toggleFavorite(itemId);
      navigator.vibrate?.(50);
      itemTapCountRef.current = 0;
      return;
    }
    
    itemTapTimerRef.current = setTimeout(() => {
      itemTapCountRef.current = 0;
    }, 500);
    
    // Track recent
    addRecent(itemId);
    
    // Select channel
    onChannelSelect?.(item);
    // Sidebar stays open
  }, [onChannelSelect, toggleFavorite, addRecent]);

  // Long press on item = toggle favorite (2s, with vibration + shake)
  const handleItemTouchStart = useCallback((item, e) => {
    // Cancel if multi-touch (2-finger swipe for folder nav)
    if (e?.touches?.length > 1) {
      if (itemLongPressRef.current) {
        clearTimeout(itemLongPressRef.current);
        itemLongPressRef.current = null;
        setShakingItemId(null);
      }
      if (itemTapTimerRef.current) {
        clearTimeout(itemTapTimerRef.current);
        itemTapTimerRef.current = null;
      }
      return;
    }
    // Store touch start position
    if (e?.touches?.[0]) {
      itemTouchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    const itemId = item.stream_id || item.id || item.series_id;
    // Delay shake start by 300ms (prevents shake on scroll)
    itemTapTimerRef.current = setTimeout(() => {
      setShakingItemId(itemId);
    }, 300);
    itemLongPressRef.current = setTimeout(() => {
      toggleFavorite(itemId);
      navigator.vibrate?.(50);
      setShakingItemId(null);
      itemLongPressRef.current = null;
    }, 2000);
  }, [toggleFavorite]);

  const handleItemTouchMove = useCallback((e) => {
    if (!itemLongPressRef.current) return;
    const touch = e.touches?.[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - itemTouchStartPos.current.x);
    const dy = Math.abs(touch.clientY - itemTouchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      clearTimeout(itemLongPressRef.current);
      itemLongPressRef.current = null;
      clearTimeout(itemTapTimerRef.current);
      itemTapTimerRef.current = null;
      setShakingItemId(null);
    }
  }, []);

  const handleItemTouchEnd = useCallback(() => {
    if (itemLongPressRef.current) {
      clearTimeout(itemLongPressRef.current);
      itemLongPressRef.current = null;
    }
    if (itemTapTimerRef.current) {
      clearTimeout(itemTapTimerRef.current);
      itemTapTimerRef.current = null;
    }
    setShakingItemId(null);
  }, []);
  
  const handleBackToCategories = useCallback(() => {
    setShowItems(false);
    setCurrentCategory(null);
    setSearchQuery('');
    setSearchOpen(false);
    setProgramResults([]);
    setShowKeyboard(false);
  }, []);

  // ========== FOLDER NAVIGATION (2-finger swipe from useGestures) ==========
  const navigateFolder = useCallback((direction) => {
    if (!showItems || !currentCategory) return;
    const cats = activeCategories;
    const currentIndex = cats.findIndex(c => String(c.category_id) === String(currentCategory.category_id));
    if (currentIndex === -1) return;
    
    const nextIndex = direction === 'next' 
      ? Math.min(currentIndex + 1, cats.length - 1)
      : Math.max(currentIndex - 1, 0);
    
    if (nextIndex !== currentIndex) {
      const nextCat = cats[nextIndex];
      setCurrentCategory(nextCat);
      setSearchQuery('');
      setSearchOpen(false);
      onCategorySelect?.(nextCat);
    }
  }, [showItems, currentCategory, activeCategories, onCategorySelect]);

  // Expose folder navigation globally for useGestures callbacks
  useEffect(() => {
    window.__ottFolderPrev = () => navigateFolder('prev');
    window.__ottFolderNext = () => navigateFolder('next');
    return () => {
      delete window.__ottFolderPrev;
      delete window.__ottFolderNext;
    };
  }, [navigateFolder]);

  // ========== FILTERED DATA ==========
  const filteredItems = useMemo(() => {
    if (!currentCategory) return [];
    
    let items;
    if (currentCategory.category_id === '__all__') {
      items = [...activeItems];
    } else if (currentCategory.category_id === '__favorites__') {
      items = activeItems.filter(item => favorites[item.stream_id || item.id || item.series_id]);
    } else if (currentCategory.category_id === '__recent__') {
      const recentMap = new Map(activeItems.map(item => [item.stream_id || item.id || item.series_id, item]));
      items = recentIds.map(id => recentMap.get(id)).filter(Boolean);
    } else {
      items = activeItems.filter(item => String(item.categoryId) === String(currentCategory.category_id));
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(item => {
        const name = (item.name || '').toLowerCase();
        const epg = (epgData[item.stream_id || item.id]?.epg_now || item.epg_now || '').toLowerCase();
        return name.includes(q) || epg.includes(q);
      });
    }
    
    return items;
  }, [currentCategory, activeItems, searchQuery, favorites, recentIds, epgData]);

  // Expose scrollToChannel au parent via ref (après filteredItems)
  useImperativeHandle(ref, () => ({
    scrollToChannel: (streamId) => {
      const sid = String(streamId);
      const index = filteredItems.findIndex(item => String(item.stream_id || item.id) === sid);
      if (index !== -1 && listRef.current) {
        listRef.current.scrollToItem(index, 'center');
        setFocusedStreamId(sid);
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = setTimeout(() => setFocusedStreamId(null), 2000);
      }
    },
    getActiveTab: () => activeTab,
    getFilteredItems: () => filteredItems,
  }), [filteredItems, activeTab]);

  // Trigger EPG load when entering a category
  useEffect(() => {
    if (activeTab === 'live' && showItems && currentCategory && filteredItems.length > 0) {
      loadEpgForCategory(currentCategory.category_id, filteredItems);
    }
  }, [activeTab, showItems, currentCategory, filteredItems, loadEpgForCategory]);

  // ========== CERCLE 1: Trigger SQLite EPG read for visible items ==========
  useEffect(() => {
    if (activeTab !== 'live' || !showItems || !filteredItems.length) return;
    // Debounce to avoid hammering SQLite during fast scrolling
    const timer = setTimeout(() => {
      loadSqliteEpgForItems(filteredItems.slice(0, 50)); // First 50 visible
    }, 200);
    return () => clearTimeout(timer);
  }, [filteredItems, activeTab, showItems, loadSqliteEpgForItems]);

  // ========== LAZY-LOAD SERIES SEASONS FOR VISIBLE ITEMS ==========
  useEffect(() => {
    if (activeTab !== 'series' || !showItems || !xtreamService) return;
    filteredItems.forEach(item => {
      const id = item.series_id || item.id;
      if (id && seriesSeasons[id] === undefined) {
        loadSeriesSeasons(id);
      }
    });
  }, [activeTab, showItems, filteredItems, xtreamService, seriesSeasons, loadSeriesSeasons]);

  // ========== PROGRAM SEARCH (SQLite - title + description) ==========
  const programSearchTimerRef = useRef(null);
  
  useEffect(() => {
    // Only trigger program search in ALL folder on live tab
    if (activeTab !== 'live' || !showItems || !currentCategory || currentCategory.category_id !== '__all__') {
      setProgramResults([]);
      return;
    }
    
    const q = searchQuery.trim();
    if (q.length < 2) {
      setProgramResults([]);
      return;
    }
    
    clearTimeout(programSearchTimerRef.current);
    programSearchTimerRef.current = setTimeout(async () => {
      setProgramSearching(true);
      try {
        const results = await searchProgramsByTitle(q, [], true, true, 50);
        setProgramResults(results);
      } catch (err) {
        console.warn('Program search error:', err);
        setProgramResults([]);
      } finally {
        setProgramSearching(false);
      }
    }, 300);
    
    return () => clearTimeout(programSearchTimerRef.current);
  }, [searchQuery, activeTab, showItems, currentCategory]);

  // Handle program result click → find channel in NinjaCentral and select
  const handleProgramClick = useCallback((program) => {
    const streamId = program.stream_id;
    // Find the channel in the live channels list
    const channel = channels.find(ch => 
      (ch.stream_id || ch.id) === streamId || 
      String(ch.stream_id || ch.id) === String(streamId)
    );
    if (channel) {
      onChannelSelect?.(channel);
    }
  }, [channels, onChannelSelect]);

  // ========== KEYBOARD HANDLERS ==========
  const handleKeyboardInput = useCallback((char) => {
    setSearchQuery(prev => prev + char);
  }, []);

  const handleKeyboardBackspace = useCallback(() => {
    setSearchQuery(prev => prev.slice(0, -1));
  }, []);

  const handleKeyboardClose = useCallback(() => {
    setShowKeyboard(false);
  }, []);

  // ========== TAB SWITCH ==========
  const handleTabSwitch = useCallback((tabId) => {
    setActiveTab(tabId);
    setShowItems(false);
    setCurrentCategory(null);
    setSearchQuery('');
    setSearchOpen(false);
    setProgramResults([]);
    setShowKeyboard(false);
    onTabChange?.(tabId);
  }, [onTabChange]);

  // ========== VIRTUALIZED CATEGORY ROW ==========
  const CategoryRow = useCallback(({ index, style }) => {
    const cat = activeCategories[index];
    if (!cat) return null;
    const isActive = selectedCategory?.category_id === cat.category_id;
    const count = cat.isSystem ? (cat.count || 0) : getCategoryCount(cat.category_id);
    
    const systemIcon = cat.category_id === '__all__' ? (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
    ) : cat.category_id === '__favorites__' ? (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    ) : cat.category_id === '__recent__' ? (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    ) : null;
    
    return (
      <div
        style={{
          ...style,
          padding: '4px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          background: isActive ? 'rgba(98, 37, 255, 0.25)' : 'transparent',
          borderLeft: isActive ? '3px solid #6225ff' : '3px solid transparent',
        }}
        onClick={() => handleCategoryClick(cat)}
      >
        {systemIcon && (
          <span style={{ fontSize: '12px', flexShrink: 0 }}>{systemIcon}</span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <TickerText style={{ fontSize: '11px', fontWeight: cat.isSystem ? 700 : 500, color: cat.isSystem ? '#a855f7' : '#fff' }}>
            {cat.category_name}
          </TickerText>
          <div style={{ fontSize: '9px', color: '#666' }}>
            {getCountLabel(count)}
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2" style={{ flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    );
  }, [activeCategories, selectedCategory, getCategoryCount, getCountLabel, handleCategoryClick]);

  // ========== VIRTUALIZED LIVE ROW (SQLite-first, Cercle 1) ==========
  const LiveRow = useCallback(({ index, style }) => {
    const channel = filteredItems[index];
    if (!channel) return null;
    const isActive = selectedChannel?.id === channel.id;
    const channelId = channel.stream_id || channel.id;
    const isFav = favorites[channelId];
    
    // Priority: network (xtream) > SQLite > channel prop
    const sqlite = sqliteEpg[channelId] || sqliteEpg[String(channelId)];
    const network = epgData[channelId] || epgData[String(channelId)];
    const epgTitle = network?.epg_now || sqlite?.title || channel.epg_now || null;
    const epgProgress = network?.progress || sqlite?.progress || 0;
    
    const isShaking = shakingItemId === channelId;
    const isFocused = focusedStreamId === String(channelId);
    
    return (
      <div
        style={{
          ...style,
          padding: '4px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          background: isFocused ? 'rgba(98, 37, 255, 0.4)' : isActive ? 'rgba(98, 37, 255, 0.25)' : 'transparent',
          borderLeft: (isActive || isFocused) ? '3px solid #6225ff' : '3px solid transparent',
          animation: isShaking ? 'ottShake 0.3s ease-in-out infinite' : isFocused ? 'ottFocus 0.5s ease-in-out 3' : 'none',
        }}
        onClick={() => handleItemClick(channel)}
        onTouchStart={(e) => handleItemTouchStart(channel, e)}
        onTouchMove={handleItemTouchMove}
        onTouchEnd={handleItemTouchEnd}
        onMouseDown={(e) => handleItemTouchStart(channel, e)}
        onMouseUp={handleItemTouchEnd}
        onMouseLeave={handleItemTouchEnd}
      >
        <div style={{
          width: '75px',
          height: '25px',
          borderRadius: '4px',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
          marginLeft: '-5px',
        }}>
          {channel.logo ? (
            <img 
              src={channel.logo} 
              alt="" 
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <span style={{ fontSize: '8px', color: '#555' }}>TV</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TickerText style={{ fontSize: '10px', fontWeight: 500, color: '#fff' }}>
            {channel.name}
          </TickerText>
          {/* EPG under channel name (vertical layout) */}
          {epgTitle && (
            <TickerText style={{ fontSize: '8px', color: '#888' }}>
              {epgTitle}
            </TickerText>
          )}
          {/* Mini progress bar for live program */}
          {epgTitle && epgProgress > 0 && (
            <div style={{
              height: '1.5px', borderRadius: '1px',
              background: 'rgba(255,255,255,0.08)',
              marginTop: '2px', width: '100%',
            }}>
              <div style={{
                height: '100%', borderRadius: '1px',
                background: '#6225ff',
                width: `${Math.min(100, epgProgress)}%`,
              }} />
            </div>
          )}
        </div>
        {isFav && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" stroke="none" style={{ flexShrink: 0 }}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        )}
        {isActive && (
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#6225ff',
            boxShadow: '0 0 8px rgba(98, 37, 255, 0.5)',
            flexShrink: 0,
          }} />
        )}
      </div>
    );
  }, [filteredItems, selectedChannel, handleItemClick, handleItemTouchStart, handleItemTouchMove, handleItemTouchEnd, favorites, epgData, sqliteEpg, shakingItemId, focusedStreamId]);

  // ========== VIRTUALIZED MOVIE ROW ==========
  const MovieRow = useCallback(({ index, style }) => {
    const movie = filteredItems[index];
    if (!movie) return null;
    
    const year = movie.release_date ? movie.release_date.substring(0, 4) : '';
    const rating = movie.rating || '';
    const genre = movie.category_name || movie.category || '';
    const subLine = [year, rating ? `★ ${rating}` : '', genre].filter(Boolean).join(' | ');
    
    return (
      <div
        style={{
          ...style,
          padding: '4px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          background: 'transparent',
          borderLeft: '3px solid transparent',
        }}
        onClick={() => handleItemClick(movie)}
      >
        <div style={{
          width: '75px',
          height: '25px',
          borderRadius: '4px',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
          marginLeft: '-5px',
        }}>
          {movie.stream_icon || movie.logo ? (
            <img 
              src={movie.stream_icon || movie.logo} 
              alt="" 
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TickerText style={{ fontSize: '10px', fontWeight: 500, color: '#fff' }}>
            {movie.name}
          </TickerText>
          {subLine && (
            <TickerText style={{ fontSize: '8px', color: '#888' }}>
              {subLine}
            </TickerText>
          )}
        </div>
      </div>
    );
  }, [filteredItems, handleItemClick]);

  // ========== VIRTUALIZED SERIES ROW ==========
  const SeriesRow = useCallback(({ index, style }) => {
    const series = filteredItems[index];
    if (!series) return null;
    
    const seriesId = series.series_id || series.id;
    const year = series.release_date ? series.release_date.substring(0, 4) : '';
    const rating = series.rating || '';
    const seasonCount = seriesSeasons[seriesId];
    const seasonLabel = seasonCount !== undefined ? `${seasonCount} Season${seasonCount !== 1 ? 's' : ''}` : '';
    const subLine = [year, rating ? `★ ${rating}` : '', seasonLabel].filter(Boolean).join(' | ');
    
    return (
      <div
        style={{
          ...style,
          padding: '4px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          background: 'transparent',
          borderLeft: '3px solid transparent',
        }}
        onClick={() => handleItemClick(series)}
      >
        <div style={{
          width: '75px',
          height: '25px',
          borderRadius: '4px',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
          marginLeft: '-5px',
        }}>
          {series.cover || series.logo ? (
            <img 
              src={series.cover || series.logo} 
              alt="" 
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TickerText style={{ fontSize: '10px', fontWeight: 500, color: '#fff' }}>
            {series.name}
          </TickerText>
          {subLine && (
            <TickerText style={{ fontSize: '8px', color: '#888' }}>
              {subLine}
            </TickerText>
          )}
        </div>
      </div>
    );
  }, [filteredItems, seriesSeasons, handleItemClick]);

  // ========== VIRTUALIZED PROGRAM RESULT ROW ==========
  const ProgramRow = useCallback(({ index, style }) => {
    const prog = programResults[index];
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
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          background: isLive ? 'rgba(98, 37, 255, 0.15)' : 'transparent',
          borderLeft: isLive ? '3px solid #6225ff' : '3px solid transparent',
        }}
        onClick={() => handleProgramClick(prog)}
      >
        {/* Channel logo */}
        <div style={{
          width: '40px',
          height: '25px',
          borderRadius: '3px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {prog.channel_logo ? (
            <img src={prog.channel_logo} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            <span style={{ fontSize: '7px', color: '#555' }}>TV</span>
          )}
        </div>
        
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* LIVE badge or time */}
            {isLive ? (
              <span style={{
                fontSize: '7px', fontWeight: 700, color: '#fff',
                background: '#e53e3e', borderRadius: '2px',
                padding: '1px 4px', flexShrink: 0,
              }}>LIVE</span>
            ) : isFuture ? (
              <span style={{
                fontSize: '7px', fontWeight: 600, color: '#a78bfa',
                background: 'rgba(167,139,250,0.15)', borderRadius: '2px',
                padding: '1px 4px', flexShrink: 0,
              }}>{minutesUntil < 60 ? `${minutesUntil}min` : `${startTime}`}</span>
            ) : null}
            <TickerText style={{ fontSize: '10px', fontWeight: 500, color: '#fff' }}>
              {prog.title}
            </TickerText>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '8px', color: '#888', flexShrink: 0 }}>
              {prog.channel_name}
            </span>
            {startTime && endTime && (
              <span style={{ fontSize: '7px', color: '#666' }}>
                {startTime}–{endTime}
              </span>
            )}
          </div>
          {/* Progress bar for live programs */}
          {isLive && prog.progress > 0 && (
            <div style={{
              height: '2px', borderRadius: '1px',
              background: 'rgba(255,255,255,0.1)',
              marginTop: '2px', width: '100%',
            }}>
              <div style={{
                height: '100%', borderRadius: '1px',
                background: '#6225ff',
                width: `${prog.progress}%`,
                transition: 'width 0.3s',
              }} />
            </div>
          )}
        </div>
      </div>
    );
  }, [programResults, handleProgramClick]);

  // ========== CHOOSE ROW RENDERER ==========
  const ItemRow = useMemo(() => {
    if (activeTab === 'movies') return MovieRow;
    if (activeTab === 'series') return SeriesRow;
    return LiveRow;
  }, [activeTab, MovieRow, SeriesRow, LiveRow]);

  // ========== STYLES ==========
  const pillStyle = {
    position: 'absolute',
    left: isSidebarOpen ? '280px' : 0,
    top: '50%',
    transform: `translateY(-50%)${isBouncing ? ' translateX(25px)' : ''}`,
    width: isBouncing ? '6px' : '3px',
    height: '120px',
    background: `linear-gradient(180deg, 
      transparent 0%, 
      rgba(255, 255, 255, ${isBouncing ? 0.3 : 0.1}) 20%,
      rgba(255, 255, 255, ${isBouncing ? 0.4 : 0.2}) 50%,
      rgba(255, 255, 255, ${isBouncing ? 0.3 : 0.1}) 80%,
      transparent 100%
    )`,
    borderRadius: '0 3px 3px 0',
    cursor: 'pointer',
    opacity: isVisible ? 1 : 0,
    transition: isBouncing 
      ? 'transform 0.15s ease-out, width 0.15s ease-out, background 0.15s ease-out, left 0.3s ease' 
      : 'opacity 0.5s ease, left 0.3s ease, transform 0.3s ease',
    zIndex: 10001,
    pointerEvents: isVisible ? 'auto' : 'none',
  };
  
  const sidebarStyle = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '280px',
    background: 'rgba(0, 0, 0, 0.10)',
    backdropFilter: 'blur(15px) saturate(150%)',
    WebkitBackdropFilter: 'blur(15px) saturate(150%)',
    transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    zIndex: 10000,
    borderRight: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  // ========== TABS ==========
  const tabs = [
    { id: 'live', label: 'LIVE', enabled: true },
    { id: 'movies', label: 'MOVIES', enabled: true },
    { id: 'series', label: 'SERIES', enabled: true },
  ];

  // Calculate list height
  const searchBarHeight = showItems ? (searchOpen ? 36 : 28) : 0;
  const headerHeight = showItems ? 48 : 52;
  const listHeight = window.innerHeight - headerHeight - searchBarHeight;

  return (
    <>
      {/* Pill */}
      <div
        ref={pillRef}
        style={pillStyle}
        onTouchStart={handlePillTouchStart}
        onTouchMove={handlePillTouchMove}
        onTouchEnd={handlePillTouchEnd}
        onClick={(e) => {
          e.stopPropagation();
          triggerBounce();
        }}
      />
      
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        style={sidebarStyle}
        onTouchStart={handleSidebarTouchStart}
        onTouchEnd={handleSidebarTouchEnd}
      >
        {/* Header with Tabs */}
        <div style={{ 
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          {/* Back button when showing items */}
          {showItems && (
            <div style={{ 
              padding: '8px 16px 6px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px' 
            }}>
              <button
                onClick={handleBackToCategories}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <TickerText style={{ fontSize: '10px', color: '#fff', fontWeight: 500 }}>
                  {currentCategory?.category_name}
                </TickerText>
                <div style={{ fontSize: '8px', color: '#666' }}>
                  {filteredItems.length} {activeTab === 'live' ? 'channels' : activeTab === 'movies' ? 'movies' : 'series'}
                </div>
              </div>
              {/* EPG force fetch button */}
              {activeTab === 'live' && (
                <button
                  onClick={async () => {
                    if (!xtreamService || !filteredItems.length) return;
                    try {
                      const streamIds = filteredItems.map(item => item.stream_id || item.id).filter(Boolean);
                      if (streamIds.length === 0) return;
                      
                      const epgResults = await xtreamService.getShortEPGBatch(streamIds, 2, 100);
                      
                      if (epgResults && Object.keys(epgResults).length > 0) {
                        setEpgData(prev => ({ ...prev, ...epgResults }));
                        
                        const epgForInsert = {};
                        const newSqliteUpdate = {};
                        
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
                            newSqliteUpdate[sid] = {
                              title: data.epg_now,
                              progress: data.epg_start_timestamp && data.epg_end_timestamp ? 
                                Math.round(((Math.floor(Date.now()/1000) - data.epg_start_timestamp) / (data.epg_end_timestamp - data.epg_start_timestamp)) * 100) : 0
                            };
                          }
                        });
                        
                        setSqliteEpg(prev => ({ ...prev, ...newSqliteUpdate }));
                        if (Object.keys(epgForInsert).length > 0) {
                          await insertProgramsBatch(epgForInsert);
                        }
                        navigator.vibrate?.(30);
                        console.log('[EPG Force] Loaded', Object.keys(epgResults).length, 'channels');
                      }
                    } catch (err) {
                      console.warn('[EPG Force] Erreur critique:', err);
                    }
                  }}
                  style={{
                    background: 'rgba(98,37,255,0.25)',
                    border: '1px solid #6225ff',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    color: '#fff',
                    fontSize: '9px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    flexShrink: 0,
                    boxShadow: '0 0 10px rgba(98, 37, 255, 0.3)',
                  }}
                >
                  FORCE EPG
                </button>
              )}
            </div>
          )}
          
          {/* Tabs */}
          {!showItems && (
            <div style={{ 
              display: 'flex', 
              width: '100%',
              padding: '8px 0 0 0',
            }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => tab.enabled && handleTabSwitch(tab.id)}
                  disabled={!tab.enabled}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    background: 'none',
                    border: 'none',
                    color: !tab.enabled ? '#444' : activeTab === tab.id ? '#fff' : '#888',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: tab.enabled ? 'pointer' : 'not-allowed',
                    opacity: tab.enabled ? 1 : 0.5,
                    borderBottom: activeTab === tab.id ? '2px solid #6225ff' : '2px solid transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* List */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {!showItems ? (
            <List
              ref={listRef}
              height={listHeight}
              itemCount={activeCategories.length}
              itemSize={40}
              width="100%"
              overscanCount={25}
            >
              {CategoryRow}
            </List>
          ) : programResults.length > 0 ? (
            /* Program search results from SQLite */
            <List
              height={listHeight}
              itemCount={programResults.length}
              itemSize={52}
              width="100%"
              overscanCount={10}
            >
              {ProgramRow}
            </List>
          ) : (
            <List
              height={listHeight}
              itemCount={filteredItems.length}
              itemSize={40}
              width="100%"
              overscanCount={25}
            >
              {ItemRow}
            </List>
          )}
        </div>

        {/* Search Bar (compact, bottom) */}
        {showItems && (
          <div style={{
            height: searchOpen ? '36px' : '28px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: '8px',
            flexShrink: 0,
            background: 'rgba(0,0,0,0.5)',
          }}>
            <button
              onClick={() => {
                if (!searchOpen) {
                  setSearchOpen(true);
                  setShowKeyboard(true);
                } else {
                  setSearchOpen(false);
                  setShowKeyboard(false);
                  setSearchQuery('');
                  setProgramResults([]);
                }
              }}
              style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex', flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={searchOpen ? '#6225ff' : '#888'} strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
            </button>
            {searchOpen ? (
              <>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  readOnly
                  onFocus={() => setShowKeyboard(true)}
                  onClick={() => setShowKeyboard(true)}
                  placeholder={currentCategory?.category_id === '__all__' && activeTab === 'live' ? "Search channels & programs..." : "Search in folder..."}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    color: '#fff', fontSize: '11px', padding: 0, caretColor: '#6225ff',
                  }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}
                    style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '4px' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* ========== EPG SYNC PROGRESS BAR (2px, bottom) ========== */}
        {epgSyncProgress > 0 && epgSyncProgress < 100 && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'rgba(255,255,255,0.05)',
            zIndex: 11,
          }}>
            <div style={{
              height: '100%',
              width: `${epgSyncProgress}%`,
              background: '#6225ff',
              borderRadius: '0 1px 1px 0',
              transition: 'width 0.5s ease-out',
            }} />
          </div>
        )}
      </div>

      {/* ========== NINJA KEYBOARD (Custom Alpha Compact) ========== */}
      {showKeyboard && searchOpen && (
        <NinjaKeyboard
          position={keyboardPos}
          onPositionChange={setKeyboardPos}
          onInput={handleKeyboardInput}
          onBackspace={handleKeyboardBackspace}
          onClose={handleKeyboardClose}
          searchQuery={searchQuery}
        />
      )}

      {/* Ticker animation */}
      <style>{`
        @keyframes ottTicker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes ottShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
        @keyframes ottFocus {
          0%, 100% { background: rgba(98, 37, 255, 0.4); }
          50% { background: rgba(98, 37, 255, 0.15); }
        }
      `}</style>
    </>
  );
});

export default OTTSidebar;
