import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { FixedSizeList as List } from 'react-window';
import { ninjaCentral, STORES } from '../../services/NinjaCentral';
import { searchProgramsByTitle, getProgramsForChannel, insertProgramsBatch, syncEmptyChannels } from '../../database/ProgramQueries';

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

const OTTLeft = forwardRef(({ 
  selectedCategory,
  selectedChannel,
  onCategorySelect,
  onChannelSelect,
  onClose,
  isOpen: externalIsOpen,
  onToggle: externalOnToggle,
  onTabChange,
  xtreamService,
  epgSyncProgress: externalEpgSyncProgress = 0,
  epgSyncingFolders = new Set(),
  onOpenEPGGrid,
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
  
  // Tab-specific data (all fetched from Xtream directly)
  const [liveChannels, setLiveChannels] = useState([]);
  const [liveCategories, setLiveCategories] = useState([]);
  const [vodCategories, setVodCategories] = useState([]);
  const [seriesCategories, setSeriesCategories] = useState([]);
  const [vodItems, setVodItems] = useState([]);
  const [seriesItems, setSeriesItems] = useState([]);
  const [seriesSeasons, setSeriesSeasons] = useState({});
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // EPG lazy-load
  const [epgData, setEpgData] = useState({});
  
  // ========== CERCLE 1 - SQLite EPG + On-demand fetch ==========
  const [sqliteEpg, setSqliteEpg] = useState({}); // { streamId: { title, progress } }
  const circle1FetchingRef = useRef(new Set()); // IDs currently being fetched
  const circle1ErrorCacheRef = useRef(new Map()); // ID → timestamp (TTL 60s)
  
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
  
  // ========== BACKGROUND SYNC EMPTY CHANNELS (folders 1-150) ==========
  useEffect(() => {
    if (!dataLoaded || !xtreamService || liveCategories.length === 0) return;
    
    // Start background sync 5 seconds after data loaded
    const timer = setTimeout(async () => {
      console.log('🔄 Starting background sync for empty channels (folders 1-150)...');
      
      try {
        const result = await syncEmptyChannels(xtreamService, liveCategories);
        
        if (result) {
          console.log(`✅ Background sync complete: ${result.synced} channels synced, ${result.skipped} skipped`);
        }
      } catch (err) {
        console.error('❌ Background sync failed:', err);
      }
    }, 5000); // 5 seconds delay
    
    return () => clearTimeout(timer);
  }, [dataLoaded, xtreamService, liveCategories]);
  
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
    if (activeTab === 'live') return liveChannels;
    if (activeTab === 'movies') return vodItems;
    if (activeTab === 'series') return seriesItems;
    return [];
  }, [activeTab, liveChannels, vodItems, seriesItems]);

  // ========== SYSTEM FOLDERS ==========
  const systemFolders = useMemo(() => {
    const totalCount = activeItems.length;
    const favCount = activeItems.filter(item => favorites[item.stream_id || item.id || item.series_id]).length;
    const recentCount = activeItems.filter(item => recentIds.includes(item.stream_id || item.id || item.series_id)).length;
    const folders = [
      { category_id: '__all__', category_name: 'ALL', count: totalCount, isSystem: true },
    ];
    // NEW folder supprimé - ALL affiche les derniers ajouts par défaut
    folders.push(
      { category_id: '__favorites__', category_name: 'FAVORITES', count: favCount, isSystem: true },
      { category_id: '__recent__', category_name: 'RECENT', count: recentCount, isSystem: true },
    );
    return folders;
  }, [activeItems, favorites, recentIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // ========== EPG BATCH LOAD (same method as Smart) ==========
  const epgLoadedCategoriesRef = useRef(new Set());

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

      // limit=1 for fast fetch (current program only), concurrency=50
      const epgResults = await xtreamService.getShortEPGBatch(streamIds, 1, 50);
      setEpgData(prev => ({ ...prev, ...epgResults }));
    } catch (err) {
      console.warn('EPG batch load error:', err);
    }
  }, [xtreamService, activeTab]);

  // ========== ACTIVE CATEGORIES WITH SYSTEM FOLDERS ==========
  const activeCategories = useMemo(() => {
    let cats = [];
    if (activeTab === 'live') cats = liveCategories;
    else if (activeTab === 'movies') cats = vodCategories;
    else if (activeTab === 'series') cats = seriesCategories;
    return [...systemFolders, ...cats];
  }, [activeTab, liveCategories, vodCategories, seriesCategories, systemFolders]);

  // ========== LOAD DATA: NinjaCentral FIRST → Xtream fallback ==========
  useEffect(() => {
    if (!xtreamService || dataLoaded) return;

    const loadData = async () => {
      try {
        // STEP 1: Try NinjaCentral first (instant, already populated by App.jsx)
        await ninjaCentral.init();
        const counts = {};

        const [live, vod, series, lc, vc, sc] = await Promise.all([
          ninjaCentral.getAll(STORES.LIVE),
          ninjaCentral.getAll(STORES.VOD),
          ninjaCentral.getAll(STORES.SERIES),
          ninjaCentral.getAll(STORES.LIVE_CATEGORIES),
          ninjaCentral.getAll(STORES.VOD_CATEGORIES),
          ninjaCentral.getAll(STORES.SERIES_CATEGORIES),
        ]);

        if (live.length > 0 || vod.length > 0 || series.length > 0) {
          live.forEach(ch => { counts[`live_${String(ch.categoryId)}`] = (counts[`live_${String(ch.categoryId)}`] || 0) + 1; });
          vod.forEach(item => { counts[`vod_${String(item.categoryId)}`] = (counts[`vod_${String(item.categoryId)}`] || 0) + 1; });
          series.forEach(item => { counts[`series_${String(item.categoryId)}`] = (counts[`series_${String(item.categoryId)}`] || 0) + 1; });

          setLiveChannels(live);
          setLiveCategories(lc);
          setVodItems(vod);
          setVodCategories(vc);
          setSeriesItems(series);
          setSeriesCategories(sc);
          setCategoryCounts(counts);
          setDataLoaded(true);
          console.log(`[OTT] NinjaCentral: ${live.length} live, ${vod.length} vod, ${series.length} series`);
          return; // Done — no Xtream fetch needed
        }

        // STEP 2: NinjaCentral empty → fallback to Xtream fetch
        console.log('[OTT] NinjaCentral empty, fetching from Xtream...');
        const [
          rawLive, rawLiveCats,
          rawVod, rawVodCats,
          rawSeries, rawSeriesCats,
        ] = await Promise.all([
          xtreamService.getLiveStreams(),
          xtreamService.getLiveCategories(),
          xtreamService.getVodStreams(),
          xtreamService.getVodCategories(),
          xtreamService.getSeries(),
          xtreamService.getSeriesCategories(),
        ]);

        // Parse live
        const liveCats = Array.isArray(rawLiveCats) ? rawLiveCats : [];
        const liveParsed = xtreamService.parseLiveStreams(rawLive, liveCats);
        liveParsed.forEach(ch => {
          const catId = String(ch.categoryId);
          counts[`live_${catId}`] = (counts[`live_${catId}`] || 0) + 1;
        });
        setLiveChannels(liveParsed);
        setLiveCategories(liveCats);

        // Parse VOD
        const vodCats = Array.isArray(rawVodCats) ? rawVodCats : [];
        const vodParsed = xtreamService.parseVodStreams(rawVod, vodCats);
        vodParsed.forEach(item => {
          const catId = String(item.categoryId);
          counts[`vod_${catId}`] = (counts[`vod_${catId}`] || 0) + 1;
        });
        setVodItems(vodParsed);
        setVodCategories(vodCats);

        // Parse Series
        const seriesCats = Array.isArray(rawSeriesCats) ? rawSeriesCats : [];
        const seriesParsed = xtreamService.parseSeries(rawSeries, seriesCats);
        seriesParsed.forEach(item => {
          const catId = String(item.categoryId);
          counts[`series_${catId}`] = (counts[`series_${catId}`] || 0) + 1;
        });
        setSeriesItems(seriesParsed);
        setSeriesCategories(seriesCats);

        setCategoryCounts(counts);
        setDataLoaded(true);
        console.log(`[OTT] Xtream fallback: ${liveParsed.length} live, ${vodParsed.length} vod, ${seriesParsed.length} series`);

        // Save to NinjaCentral in background (non-blocking)
        ninjaCentral.init().then(async () => {
          try {
            await Promise.all([
              ninjaCentral.saveItems(STORES.LIVE, liveParsed),
              ninjaCentral.saveCategories(STORES.LIVE_CATEGORIES, liveCats),
              ninjaCentral.saveItems(STORES.VOD, vodParsed),
              ninjaCentral.saveCategories(STORES.VOD_CATEGORIES, vodCats),
              ninjaCentral.saveItems(STORES.SERIES, seriesParsed),
              ninjaCentral.saveCategories(STORES.SERIES_CATEGORIES, seriesCats),
            ]);
            console.log('[OTT] Saved to NinjaCentral');
          } catch (e) {
            console.warn('[OTT] NinjaCentral save failed:', e);
          }
        });

      } catch (err) {
        console.error('[OTT] Load failed:', err);
      }
    };

    loadData();
  }, [xtreamService, dataLoaded]);

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
      // Trier par date d'ajout (les plus récents en premier)
      items = [...activeItems].sort((a, b) => {
        const aAdded = Number(a.added) || 0;
        const bAdded = Number(b.added) || 0;
        return bAdded - aAdded; // Décroissant (les plus récents d'abord)
      });
    } else if (currentCategory.category_id === '__new__') {
      items = [...activeItems].filter(item => item.added).sort((a, b) => Number(b.added) - Number(a.added));
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
    // Only trigger program search in specific folders (not ALL) on live tab
    if (activeTab !== 'live' || !showItems || !currentCategory || currentCategory.category_id === '__all__') {
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
    const channel = filteredItems.find(ch => 
      (ch.stream_id || ch.id) === streamId || 
      String(ch.stream_id || ch.id) === String(streamId)
    );
    if (channel) {
      onChannelSelect?.(channel);
    }
  }, [filteredItems, onChannelSelect]);

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
    setSearchQuery('');
    setSearchOpen(false);
    setProgramResults([]);
    setShowKeyboard(false);
    onTabChange?.(tabId);
    // Movies & Series: open ALL folder by default (triés par derniers ajouts)
    if (tabId === 'movies' || tabId === 'series') {
      setCurrentCategory({ category_id: '__all__', category_name: 'ALL', isSystem: true });
      setShowItems(true);
    } else {
      setShowItems(false);
      setCurrentCategory(null);
    }
  }, [onTabChange]);

  // ========== VIRTUALIZED CATEGORY ROW ==========
  const CategoryRow = useCallback(({ index, style }) => {
    const cat = activeCategories[index];
    if (!cat) return null;
    const isActive = selectedCategory?.category_id === cat.category_id;
    const count = cat.isSystem ? (cat.count || 0) : getCategoryCount(cat.category_id);
    
    const systemIcon = cat.category_id === '__all__' ? (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
    ) : cat.category_id === '__new__' ? (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TickerText style={{ fontSize: '8px', color: '#888', flex: 1, minWidth: 0 }}>
                {epgTitle}
              </TickerText>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenEPGGrid?.(channel);
                }}
                style={{
                  background: 'rgba(98, 37, 255, 0.2)',
                  border: '1px solid rgba(98, 37, 255, 0.4)',
                  borderRadius: '3px',
                  padding: '1px 4px',
                  fontSize: '7px',
                  color: '#b85cff',
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontWeight: 600,
                }}
              >
                EPG
              </button>
            </div>
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
        {channel.num && (
          <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.2)', fontWeight: 600, flexShrink: 0, fontFamily: 'monospace' }}>
            {channel.num}
          </span>
        )}
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
  }, [filteredItems, selectedChannel, handleItemClick, handleItemTouchStart, handleItemTouchMove, handleItemTouchEnd, favorites, epgData, sqliteEpg, shakingItemId, focusedStreamId, onOpenEPGGrid]);

  // ========== VIRTUALIZED MOVIE ROW ==========
  const MovieRow = useCallback(({ index, style }) => {
    const movie = filteredItems[index];
    if (!movie) return null;
    
    const year = movie.year || (movie.release_date ? movie.release_date.substring(0, 4) : '');
    const rating = movie.rating || '';
    const genre = movie.genre || movie.category_name || movie.category || '';
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
        <div style={{ flex: 1, minWidth: 0, marginLeft: '5px' }}>
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
        <div style={{ flex: 1, minWidth: 0, marginLeft: '5px' }}>
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
    background: 'rgba(0,0,0,0.75)',
    transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    zIndex: 10000,
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
              {/* EPG NOW button (manual fetch, always from Xtream) */}
              {activeTab === 'live' && (
                <button
                  ref={(el) => { if (el) el.__forceEpgBtn = true; }}
                  disabled={currentCategory && epgSyncingFolders.has(String(currentCategory.category_id))}
                  onClick={async (e) => {
                    if (!xtreamService || !filteredItems.length) return;
                    if (currentCategory && epgSyncingFolders.has(String(currentCategory.category_id))) return;
                    const btn = e.currentTarget;
                    const originalText = btn.textContent;
                    btn.textContent = 'LOADING...';
                    try {
                      const streamIds = filteredItems.map(item => item.stream_id || item.id).filter(Boolean);
                      if (streamIds.length === 0) {
                        btn.textContent = originalText;
                        return;
                      }
                      console.log('[EPG NOW] Fetching for', streamIds.length, 'channels');
                      
                      const epgResults = await xtreamService.getShortEPGBatch(streamIds, 2, 50);
                      console.log('[EPG NOW] Got results:', epgResults ? Object.keys(epgResults).length : 0);
                      
                      if (epgResults && Object.keys(epgResults).length > 0) {
                        setEpgData(prev => ({ ...prev, ...epgResults }));
                        navigator.vibrate?.(30);
                        console.log('[EPG NOW] Loaded', Object.keys(epgResults).length, 'programs');
                      }
                    } catch (err) {
                      console.warn('[EPG NOW] Error:', err);
                    } finally {
                      btn.textContent = originalText;
                    }
                  }}
                  style={{
                    background: currentCategory && epgSyncingFolders.has(String(currentCategory.category_id))
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(98,37,255,0.25)',
                    border: currentCategory && epgSyncingFolders.has(String(currentCategory.category_id))
                      ? '1px solid rgba(255,255,255,0.1)'
                      : '1px solid #6225ff',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    color: currentCategory && epgSyncingFolders.has(String(currentCategory.category_id))
                      ? '#666'
                      : '#fff',
                    fontSize: '9px',
                    fontWeight: 800,
                    cursor: currentCategory && epgSyncingFolders.has(String(currentCategory.category_id))
                      ? 'not-allowed'
                      : 'pointer',
                    flexShrink: 0,
                    boxShadow: currentCategory && epgSyncingFolders.has(String(currentCategory.category_id))
                      ? 'none'
                      : '0 0 10px rgba(98, 37, 255, 0.3)',
                    opacity: currentCategory && epgSyncingFolders.has(String(currentCategory.category_id))
                      ? 0.5
                      : 1,
                  }}
                >
                  {currentCategory && epgSyncingFolders.has(String(currentCategory.category_id))
                    ? 'LOADING...'
                    : 'EPG NOW'}
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
            background: 'rgba(0,0,0,0.75)',
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
                  placeholder={currentCategory?.category_id === '__all__' && activeTab === 'live' ? "Search channels..." : "Search channels & programs..."}
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
        {externalEpgSyncProgress > 0 && externalEpgSyncProgress < 100 && (
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
              width: `${externalEpgSyncProgress}%`,
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

export default OTTLeft;
