import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle, memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { searchProgramsByTitle } from '../../database/ProgramQueries';
import OTTPlayer from './OTTPlayer';

// ============================================================================
// OTT — Full-screen 3-column OTT interface (TiviMate style)
//
// Layout:  [Navbar]
//          [Folders 20%] [Channels 25%] [Player+EPG 55%]
//
// Data:    Playlist from props (NinjaStorage), SQLite for EPG only
// Player:  libVLC via OTTPlayer component
// Design:  Glassmorphism, gradient #6225FF→#B85CFF, text-only buttons
// ============================================================================

// ========== CSS VARIABLES (inline, matching HTML preview) ==========
const CSS = {
  bg: '#0a0a0f',
  card: 'rgba(14, 14, 22, 0.85)',
  divider: 'rgba(255, 255, 255, 0.06)',
  accent: '#6225ff',
  accentLight: '#B85CFF',
  gradient: 'linear-gradient(135deg, #6225FF 0%, #B85CFF 100%)',
  text: '#ffffff',
  textDim: 'rgba(255, 255, 255, 0.5)',
  textMuted: 'rgba(255, 255, 255, 0.3)',
  green: '#10b981',
  red: '#ef4444',
  barH: 46,
};

// ========== TICKER TEXT (overflow scroll) ==========
// eslint-disable-next-line no-unused-vars
const TickerText = memo(({ children, style = {} }) => {
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const [needsTicker, setNeedsTicker] = useState(false);

  useEffect(() => {
    if (textRef.current && containerRef.current) {
      setNeedsTicker(textRef.current.scrollWidth > containerRef.current.clientWidth);
    }
  }, [children]);

  return (
    <div ref={containerRef} style={{ ...style, overflow: 'hidden', whiteSpace: 'nowrap', position: 'relative' }}>
      <span ref={textRef} style={{ display: 'inline-block', ...(needsTicker ? { animation: 'ottTicker 8s linear infinite', paddingRight: '40px' } : {}) }}>
        {children}
        {needsTicker && <span style={{ paddingLeft: '40px' }}>{children}</span>}
      </span>
    </div>
  );
});

// ========== FOLDER ROW (Column 1) ==========
const FolderRowItem = memo(({ data, index, style }) => {
  const { categories, selectedCategory, getCategoryCount, onCategoryClick, epgSyncingFolders, epgSyncedFolders } = data;
  const cat = categories[index];
  if (!cat) return null;

  const isActive = selectedCategory?.category_id === cat.category_id;
  const count = cat.isSystem ? (cat.count || 0) : getCategoryCount(cat.category_id);
  const catId = String(cat.category_id);
  const isSyncing = epgSyncingFolders?.has(catId);
  const isSynced = epgSyncedFolders?.has(catId);

  return (
    <div
      style={{
        ...style,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 10px',
        cursor: 'pointer',
        borderLeft: isActive ? '3px solid transparent' : '3px solid transparent',
        background: isActive ? CSS.gradient : 'transparent',
        boxShadow: isActive ? '0 0 14px rgba(98,37,255,0.2)' : 'none',
        transition: 'all 0.12s ease',
        position: 'relative',
      }}
      onClick={() => onCategoryClick(cat)}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{
        fontSize: '10px', fontWeight: isActive ? 600 : 500,
        color: isActive ? '#fff' : CSS.textDim,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: 1, marginRight: '8px',
      }}>
        {cat.category_name}
      </span>
      <span style={{
        fontSize: '9px', fontWeight: 600,
        color: isActive ? '#fff' : isSynced ? '#22c55e' : isSyncing ? CSS.accent : CSS.textMuted,
        background: isActive ? 'rgba(255,255,255,0.2)' : isSynced ? 'rgba(34,197,94,0.1)' : isSyncing ? 'rgba(98,37,255,0.15)' : 'rgba(255,255,255,0.05)',
        padding: '2px 7px', borderRadius: 0,
        minWidth: '28px', textAlign: 'center', flexShrink: 0,
        animation: isSyncing ? 'epgPulse 1.5s ease-in-out infinite' : 'none',
      }}>
        {count}
      </span>
    </div>
  );
});

// ========== CHANNEL ROW (Column 2 — Live) ==========
const ChannelRowItem = memo(({ data, index, style }) => {
  const { items, selectedChannel, onItemClick, onItemTouchStart, onItemTouchMove, onItemTouchEnd, favorites, shakingItemId, focusedStreamId } = data;
  const channel = items[index];
  if (!channel) return null;

  const selectedId = String(selectedChannel?.stream_id || selectedChannel?.id || '');
  const currentId = String(channel.stream_id || channel.id || '');
  const isActive = selectedId !== '' && selectedId === currentId;
  const channelId = channel.stream_id || channel.id;
  const isFav = favorites[channelId];

  // EPG: channel prop only (no background fetch)
  const epgTitle = channel.epg_now || null;
  const epgProgress = 0;

  const isShaking = shakingItemId === channelId;
  const isFocused = focusedStreamId === String(channelId);

  return (
    <div
      style={{
        ...style,
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '0 10px',
        cursor: 'pointer',
        borderBottom: '1px solid rgba(255,255,255,0.02)',
        background: isFocused ? 'rgba(98,37,255,0.4)' : isActive ? CSS.gradient : 'transparent',
        boxShadow: isActive ? '0 0 14px rgba(98,37,255,0.2)' : 'none',
        animation: isShaking ? 'ottShake 0.3s ease-in-out infinite' : isFocused ? 'ottFocus 0.5s ease-in-out 3' : 'none',
        transition: 'background 0.12s ease',
      }}
      onClick={() => onItemClick(channel)}
      onTouchStart={(e) => onItemTouchStart(channel, e)}
      onTouchMove={onItemTouchMove}
      onTouchEnd={onItemTouchEnd}
      onMouseDown={(e) => onItemTouchStart(channel, e)}
      onMouseUp={onItemTouchEnd}
      onMouseLeave={onItemTouchEnd}
      onMouseEnter={(e) => { if (!isActive && !isFocused) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
    >
      {/* Number */}
      <span style={{ fontSize: '9px', fontWeight: 600, color: isActive ? 'rgba(255,255,255,0.7)' : CSS.textMuted, minWidth: '20px', textAlign: 'right', flexShrink: 0 }}>
        {channel.num || index + 1}
      </span>
      {/* Logo */}
      <div style={{ width: '24px', height: '24px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
        {channel.logo ? (
          <img src={channel.logo} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
        ) : (
          <span style={{ fontSize: '8px', color: CSS.textMuted }}>TV</span>
        )}
      </div>
      {/* Name + EPG */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '10px', fontWeight: isActive ? 600 : 500, color: isActive ? '#fff' : 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {channel.name}
        </div>
        {epgTitle && (
          <div style={{ fontSize: '8px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
            {epgTitle}
          </div>
        )}
        {epgTitle && epgProgress > 0 && (
          <div style={{ height: '1.5px', borderRadius: '1px', background: 'rgba(255,255,255,0.08)', marginTop: '2px', width: '100%' }}>
            <div style={{ height: '100%', borderRadius: '1px', background: isActive ? CSS.green : CSS.accent, width: `${Math.min(100, epgProgress)}%` }} />
          </div>
        )}
      </div>
      {/* Favorite star */}
      {isFav && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" stroke="none" style={{ flexShrink: 0 }}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      )}
    </div>
  );
});

// ========== MOVIE ROW (Column 2 — Movies) ==========
const MovieRowItem = memo(({ data, index, style }) => {
  const { items, onItemClick } = data;
  const movie = items[index];
  if (!movie) return null;

  const year = movie.year || (movie.release_date ? movie.release_date.substring(0, 4) : '');
  const rating = movie.rating || '';
  const genre = movie.genre || movie.category_name || '';
  const subLine = [year, rating ? `★ ${rating}` : '', genre].filter(Boolean).join(' | ');

  return (
    <div style={{ ...style, display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background 0.12s' }}
      onClick={() => onItemClick(movie)}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {movie.logo || movie.cover ? (
        <img src={movie.logo || movie.cover} alt="" style={{ width: '22px', height: '32px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0, background: 'rgba(255,255,255,0.04)' }} onError={(e) => { e.target.style.display = 'none'; }} />
      ) : (
        <div style={{ width: '22px', height: '32px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0 }}>🎬</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{movie.name}</div>
        {subLine && <div style={{ fontSize: '8px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subLine}</div>}
      </div>
    </div>
  );
});

// ========== SERIES ROW (Column 2 — Series) ==========
const SeriesRowItem = memo(({ data, index, style }) => {
  const { items, onItemClick } = data;
  const series = items[index];
  if (!series) return null;

  const year = series.release_date ? series.release_date.substring(0, 4) : '';
  const rating = series.rating || '';
  const subLine = [year, rating ? `★ ${rating}` : ''].filter(Boolean).join(' | ');

  return (
    <div style={{ ...style, display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background 0.12s' }}
      onClick={() => onItemClick(series)}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {series.cover ? (
        <img src={series.cover} alt="" style={{ width: '22px', height: '32px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0, background: 'rgba(255,255,255,0.04)' }} onError={(e) => { e.target.style.display = 'none'; }} />
      ) : (
        <div style={{ width: '22px', height: '32px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0 }}>📺</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '10px', fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{series.name}</div>
        {subLine && <div style={{ fontSize: '8px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subLine}</div>}
      </div>
    </div>
  );
});

// ========== PROGRAM ROW (Search results) ==========
const ProgramRowItem = memo(({ data, index, style }) => {
  const { items, onProgramClick } = data;
  const prog = items[index];
  if (!prog) return null;

  const now = Math.floor(Date.now() / 1000);
  const isLive = prog.start_time <= now && prog.end_time > now;
  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ ...style, display: 'flex', alignItems: 'center', gap: '6px', padding: '0 10px', cursor: 'pointer', background: isLive ? 'rgba(98,37,255,0.15)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.02)' }}
      onClick={() => onProgramClick(prog)}
    >
      {prog.channel_logo ? (
        <img src={prog.channel_logo} alt="" style={{ width: '24px', height: '16px', objectFit: 'contain', borderRadius: '2px', flexShrink: 0, background: 'rgba(255,255,255,0.04)' }} onError={(e) => { e.target.style.display = 'none'; }} />
      ) : (
        <div style={{ width: '24px', height: '16px', background: 'rgba(255,255,255,0.04)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6px', flexShrink: 0 }}>TV</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isLive && <span style={{ fontSize: '6px', fontWeight: 700, color: '#fff', background: '#e53e3e', borderRadius: '2px', padding: '1px 3px', flexShrink: 0 }}>LIVE</span>}
          <span style={{ fontSize: '9px', fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prog.title}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '8px', color: '#888' }}>{prog.channel_name}</span>
          <span style={{ fontSize: '7px', color: '#666' }}>{formatTime(prog.start_time)}–{formatTime(prog.end_time)}</span>
        </div>
      </div>
    </div>
  );
});


// ============================================================================
// MAIN OTT COMPONENT
// ============================================================================
const OTT = forwardRef(({
  // Data from App.jsx (playlist from NinjaStorage)
  liveChannels = [],
  vodItems = [],
  seriesItems = [],
  liveCategories = [],
  vodCategories = [],
  seriesCategories = [],
  // Services
  xtreamService,
  // EPG sync (from App.jsx)
  epgSyncProgress = 0,
  epgSyncingFolders = new Set(),
  epgSyncedFolders = new Set(),
  userLangs = [],
  // Callbacks
  onLogout,
  onReload,
  onSettings,
  onExit,
}, ref) => {

  // ========== CORE STATE ==========
  const [activeTab, setActiveTab] = useState('live');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [singleColMode, setSingleColMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showExitPopup, setShowExitPopup] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);





  // ========== FAVORITES & RECENT (localStorage) ==========
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ninja_favorites') || '{}'); } catch { return {}; }
  });
  const [recentIds, setRecentIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ninja_recent') || '[]'); } catch { return []; }
  });

  // ========== GESTURE STATE ==========
  const [shakingItemId, setShakingItemId] = useState(null);
  const [focusedStreamId, setFocusedStreamId] = useState(null);
  const [programResults, setProgramResults] = useState([]);
  const itemLongPressRef = useRef(null);
  const itemTapCountRef = useRef(0);
  const itemTapTimerRef = useRef(null);
  const itemTouchStartPos = useRef({ x: 0, y: 0 });
  const focusTimerRef = useRef(null);
  const programSearchTimerRef = useRef(null);

  // ========== REFS ==========
  const folderListRef = useRef(null);
  const channelListRef = useRef(null);
  const searchInputRef = useRef(null);
  const containerRef = useRef(null);

  // ========== ACTIVE ITEMS BASED ON TAB ==========
  const activeItems = useMemo(() => {
    if (activeTab === 'live') return liveChannels;
    if (activeTab === 'movies') return vodItems;
    if (activeTab === 'series') return seriesItems;
    return [];
  }, [activeTab, liveChannels, vodItems, seriesItems]);

  // ========== COMPUTE CATEGORY COUNTS (useMemo — no extra re-render) ==========
  const categoryCounts = useMemo(() => {
    const counts = {};
    liveChannels.forEach(ch => {
      const catId = String(ch.categoryId || ch.category_id);
      counts[`live_${catId}`] = (counts[`live_${catId}`] || 0) + 1;
    });
    vodItems.forEach(item => {
      const catId = String(item.categoryId || item.category_id);
      counts[`vod_${catId}`] = (counts[`vod_${catId}`] || 0) + 1;
    });
    seriesItems.forEach(item => {
      const catId = String(item.categoryId || item.category_id);
      counts[`series_${catId}`] = (counts[`series_${catId}`] || 0) + 1;
    });
    return counts;
  }, [liveChannels, vodItems, seriesItems]);

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

  // ========== ACTIVE CATEGORIES ==========
  const activeCategories = useMemo(() => {
    let cats = [];
    if (activeTab === 'live') cats = liveCategories;
    else if (activeTab === 'movies') cats = vodCategories;
    else if (activeTab === 'series') cats = seriesCategories;
    return [...systemFolders, ...cats];
  }, [activeTab, liveCategories, vodCategories, seriesCategories, systemFolders]);

  // ========== GET COUNT ==========
  const getCategoryCount = useCallback((catId) => {
    if (activeTab === 'live') return categoryCounts[`live_${catId}`] || 0;
    if (activeTab === 'movies') return categoryCounts[`vod_${catId}`] || 0;
    if (activeTab === 'series') return categoryCounts[`series_${catId}`] || 0;
    return 0;
  }, [activeTab, categoryCounts]);

  // ========== FILTERED ITEMS ==========
  const filteredItems = useMemo(() => {
    if (!selectedCategory) return [];

    let items;
    if (selectedCategory.category_id === '__all__') {
      items = [...activeItems].sort((a, b) => (Number(b.added) || 0) - (Number(a.added) || 0));
    } else if (selectedCategory.category_id === '__favorites__') {
      items = activeItems.filter(item => favorites[item.stream_id || item.id || item.series_id]);
    } else if (selectedCategory.category_id === '__recent__') {
      const recentMap = new Map(activeItems.map(item => [item.stream_id || item.id || item.series_id, item]));
      items = recentIds.map(id => recentMap.get(id)).filter(Boolean);
    } else {
      items = activeItems.filter(item => String(item.categoryId || item.category_id) === String(selectedCategory.category_id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(item => {
        const name = (item.name || '').toLowerCase();
        const epg = (item.epg_now || '').toLowerCase();
        return name.includes(q) || epg.includes(q);
      });
    }

    return items;
  }, [selectedCategory, activeItems, searchQuery, favorites, recentIds]);

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







  // ========== PROGRAM SEARCH ==========
  useEffect(() => {
    if (activeTab !== 'live' || !selectedCategory || selectedCategory.category_id === '__all__') {
      setProgramResults([]);
      return;
    }
    const q = searchQuery.trim();
    if (q.length < 2) { setProgramResults([]); return; }
    clearTimeout(programSearchTimerRef.current);
    programSearchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchProgramsByTitle(q, [], true, true, 50);
        setProgramResults(results);
      } catch { setProgramResults([]); }
    }, 300);
    return () => clearTimeout(programSearchTimerRef.current);
  }, [searchQuery, activeTab, selectedCategory]);

  // ========== HANDLERS ==========
  const handleCategoryClick = useCallback((category) => {
    setSelectedCategory(category);
    setSearchQuery('');
    setSearchOpen(false);
  }, []);

  const handleItemClick = useCallback((item) => {
    const itemId = item.stream_id || item.id || item.series_id;

    // Triple-tap → toggle favorite
    itemTapCountRef.current += 1;
    clearTimeout(itemTapTimerRef.current);
    if (itemTapCountRef.current >= 3) {
      toggleFavorite(itemId);
      navigator.vibrate?.(50);
      itemTapCountRef.current = 0;
      return;
    }
    itemTapTimerRef.current = setTimeout(() => { itemTapCountRef.current = 0; }, 500);

    addRecent(itemId);
    setSelectedChannel(item);

    // Auto-play live channels
    if (activeTab === 'live') {
      setIsPlaying(true);
    }
  }, [toggleFavorite, addRecent, activeTab]);

  // Long press → toggle favorite (2s)
  const handleItemTouchStart = useCallback((item, e) => {
    if (e?.touches?.length > 1) {
      if (itemLongPressRef.current) { clearTimeout(itemLongPressRef.current); itemLongPressRef.current = null; setShakingItemId(null); }
      return;
    }
    if (e?.touches?.[0]) itemTouchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    const itemId = item.stream_id || item.id || item.series_id;
    itemTapTimerRef.current = setTimeout(() => setShakingItemId(itemId), 300);
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
      clearTimeout(itemLongPressRef.current); itemLongPressRef.current = null;
      clearTimeout(itemTapTimerRef.current); itemTapTimerRef.current = null;
      setShakingItemId(null);
    }
  }, []);

  const handleItemTouchEnd = useCallback(() => {
    if (itemLongPressRef.current) { clearTimeout(itemLongPressRef.current); itemLongPressRef.current = null; }
    if (itemTapTimerRef.current) { clearTimeout(itemTapTimerRef.current); itemTapTimerRef.current = null; }
    setShakingItemId(null);
  }, []);

  const handleProgramClick = useCallback((program) => {
    const streamId = program.stream_id;
    const channel = liveChannels.find(ch => (ch.stream_id || ch.id) === streamId || String(ch.stream_id || ch.id) === String(streamId));
    if (channel) {
      setSelectedChannel(channel);
      setIsPlaying(true);
    }
  }, [liveChannels]);

  // ========== TAB SWITCH ==========
  const handleTabSwitch = useCallback((tabId) => {
    setActiveTab(tabId);
    setSelectedCategory(null);
    setSelectedChannel(null);
    setSearchQuery('');
    setSearchOpen(false);
    setProgramResults([]);
    setIsPlaying(false);
  }, []);

  // ========== FOLDER NAVIGATION (2-finger swipe) ==========
  const navigateFolder = useCallback((direction) => {
    if (!selectedCategory) return;
    const cats = activeCategories;
    const currentIndex = cats.findIndex(c => String(c.category_id) === String(selectedCategory.category_id));
    if (currentIndex === -1) return;
    const nextIndex = direction === 'next'
      ? Math.min(currentIndex + 1, cats.length - 1)
      : Math.max(currentIndex - 1, 0);
    if (nextIndex !== currentIndex) {
      setSelectedCategory(cats[nextIndex]);
      setSearchQuery('');
      setSearchOpen(false);
    }
  }, [selectedCategory, activeCategories]);

  useEffect(() => {
    window.__ottFolderPrev = () => navigateFolder('prev');
    window.__ottFolderNext = () => navigateFolder('next');
    return () => { delete window.__ottFolderPrev; delete window.__ottFolderNext; };
  }, [navigateFolder]);

  // ========== GLOBAL MULTI-TOUCH: cancel long press ==========
  useEffect(() => {
    const onTouch = (e) => {
      if (e.touches.length >= 2 && itemLongPressRef.current) {
        clearTimeout(itemLongPressRef.current); itemLongPressRef.current = null; setShakingItemId(null);
      }
    };
    window.addEventListener('touchstart', onTouch, { passive: true });
    return () => window.removeEventListener('touchstart', onTouch);
  }, []);

  // ========== AUTO-SELECT ALL ON FIRST LOAD ==========
  useEffect(() => {
    if (!selectedCategory && activeItems.length > 0) {
      setSelectedCategory({ category_id: '__all__', category_name: 'ALL', count: activeItems.length, isSystem: true });
    }
  }, [activeItems, selectedCategory]);

  // ========== EXPOSE METHODS ==========
  useImperativeHandle(ref, () => ({
    scrollToChannel: (streamId) => {
      const sid = String(streamId);
      const index = filteredItems.findIndex(item => String(item.stream_id || item.id) === sid);
      if (index !== -1 && channelListRef.current) {
        channelListRef.current.scrollToItem(index, 'center');
        setFocusedStreamId(sid);
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = setTimeout(() => setFocusedStreamId(null), 2000);
      }
    },
    navigateToFolder: (categoryId, streamId) => {
      const cat = activeCategories.find(c => String(c.category_id) === String(categoryId));
      if (cat) {
        setSelectedCategory(cat);
        if (streamId) {
          setTimeout(() => {
            const sid = String(streamId);
            const items = String(categoryId) === '__all__' ? activeItems : activeItems.filter(item => String(item.categoryId) === String(categoryId));
            const index = items.findIndex(item => String(item.stream_id || item.id) === sid);
            if (index !== -1 && channelListRef.current) {
              channelListRef.current.scrollToItem(index, 'center');
              setFocusedStreamId(sid);
              clearTimeout(focusTimerRef.current);
              focusTimerRef.current = setTimeout(() => setFocusedStreamId(null), 2000);
            }
          }, 300);
        }
      }
    },
    getActiveTab: () => activeTab,
  }), [filteredItems, activeTab, activeCategories, activeItems]);

  // ========== MEMOIZED ROW DATA ==========
  const folderRowData = useMemo(() => ({
    categories: activeCategories,
    selectedCategory,
    getCategoryCount,
    onCategoryClick: handleCategoryClick,
    epgSyncingFolders,
    epgSyncedFolders,
  }), [activeCategories, selectedCategory, getCategoryCount, handleCategoryClick, epgSyncingFolders, epgSyncedFolders]);

  const channelRowData = useMemo(() => ({
    items: filteredItems,
    selectedChannel,
    onItemClick: handleItemClick,
    onItemTouchStart: handleItemTouchStart,
    onItemTouchMove: handleItemTouchMove,
    onItemTouchEnd: handleItemTouchEnd,
    favorites,
    shakingItemId,
    focusedStreamId,
  }), [filteredItems, selectedChannel, handleItemClick, handleItemTouchStart, handleItemTouchMove, handleItemTouchEnd, favorites, shakingItemId, focusedStreamId]);

  const movieRowData = useMemo(() => ({ items: filteredItems, onItemClick: handleItemClick }), [filteredItems, handleItemClick]);
  const seriesRowData = useMemo(() => ({ items: filteredItems, onItemClick: handleItemClick }), [filteredItems, handleItemClick]);
  const programRowData = useMemo(() => ({ items: programResults, onProgramClick: handleProgramClick }), [programResults, handleProgramClick]);

  // ========== DIMENSIONS ==========
  const listHeight = typeof window !== 'undefined' ? window.innerHeight - CSS.barH : 600;

  // ========== RENDER ==========
  return (
    <div ref={containerRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: CSS.bg, display: 'flex', flexDirection: 'column', fontFamily: "'Outfit', -apple-system, sans-serif" }}>

      {/* ========== NAVBAR ========== */}
      <nav style={{ display: 'flex', alignItems: 'stretch', height: CSS.barH, background: 'rgba(8, 8, 14, 0.92)', borderBottom: `1px solid ${CSS.divider}`, zIndex: 100, flexShrink: 0 }}>
        {/* Tabs */}
        {['live', 'movies', 'series'].map(tab => (
          <button key={tab} onClick={() => handleTabSwitch(tab)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 20px',
            border: 'none', borderRight: `1px solid ${CSS.divider}`, borderRadius: 0,
            background: activeTab === tab ? CSS.gradient : 'transparent',
            color: activeTab === tab ? '#fff' : CSS.textDim,
            fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
            letterSpacing: '0.8px', textTransform: 'uppercase',
            cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', userSelect: 'none',
            boxShadow: activeTab === tab ? '0 0 20px rgba(98,37,255,0.3)' : 'none',
          }}>
            {tab.toUpperCase()}
          </button>
        ))}

        {/* Search bar */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 16px', borderRight: `1px solid ${CSS.divider}`, minWidth: 0 }}>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Search channels, movies, series..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: CSS.text, fontFamily: 'inherit', fontSize: '12px', fontWeight: 400, letterSpacing: '0.3px', minWidth: 0 }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '4px', fontSize: '14px' }}>✕</button>
          )}
        </div>

        {/* Right buttons */}
        {[
          { label: singleColMode ? 'TOOLBOX [1]' : 'TOOLBOX', action: () => setSingleColMode(!singleColMode) },
          { label: 'PLAYLIST', action: onLogout },
          { label: 'RELOAD', action: onReload },
          { label: 'SETTINGS', action: onSettings },
        ].map((btn, i) => (
          <button key={i} onClick={btn.action} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 20px', border: 'none', borderRight: `1px solid ${CSS.divider}`, borderRadius: 0,
            background: 'transparent', color: CSS.textDim,
            fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
            letterSpacing: '0.8px', textTransform: 'uppercase',
            cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', userSelect: 'none',
          }}>
            {btn.label}
          </button>
        ))}
        <button onClick={() => setShowExitPopup(true)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 20px', border: 'none', borderRadius: 0,
          background: 'transparent', color: CSS.textDim,
          fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
          letterSpacing: '0.8px', textTransform: 'uppercase',
          cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap', userSelect: 'none',
        }}>
          EXIT
        </button>
      </nav>

      {/* ========== MAIN LAYOUT ========== */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* === COLUMN 1: FOLDERS === */}
        <div style={{
          width: singleColMode ? 0 : '180px',
          minWidth: singleColMode ? 0 : '150px',
          borderRight: singleColMode ? 'none' : `1px solid ${CSS.divider}`,
          display: 'flex', flexDirection: 'column',
          background: 'rgba(8, 8, 14, 0.5)',
          overflow: singleColMode ? 'hidden' : 'hidden',
          opacity: singleColMode ? 0 : 1,
          transition: 'width 0.25s ease, min-width 0.25s ease, opacity 0.2s ease',
        }}>
          <List
            ref={folderListRef}
            height={listHeight}
            itemCount={activeCategories.length}
            itemSize={28}
            width={180}
            overscanCount={25}
            itemData={folderRowData}
          >
            {FolderRowItem}
          </List>
        </div>

        {/* === COLUMN 2: CHANNELS / ITEMS === */}
        <div style={{
          width: singleColMode ? '280px' : '240px',
          minWidth: singleColMode ? '220px' : '190px',
          borderRight: `1px solid ${CSS.divider}`,
          display: 'flex', flexDirection: 'column',
          background: 'rgba(8, 8, 14, 0.3)',
          overflow: 'hidden',
          transition: 'width 0.25s ease',
        }}>
          {/* Category header */}
          {selectedCategory && (
            <div style={{
              padding: '8px 12px',
              borderBottom: `1px solid ${CSS.divider}`,
              display: 'flex', alignItems: 'center', gap: '8px',
              flexShrink: 0,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedCategory.category_name}
                </div>
                <div style={{ fontSize: '9px', color: '#666' }}>
                  {filteredItems.length} {activeTab === 'live' ? 'channels' : activeTab === 'movies' ? 'movies' : 'series'}
                </div>
              </div>
              {/* Search toggle */}
              <button onClick={() => { setSearchOpen(!searchOpen); if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 100); }}
                style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={searchOpen ? CSS.accent : '#888'} strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
              </button>
            </div>
          )}

          {/* Items list */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {programResults.length > 0 ? (
              <List height={listHeight - 50} itemCount={programResults.length} itemSize={40} width={singleColMode ? 280 : 240} overscanCount={10} itemData={programRowData}>
                {ProgramRowItem}
              </List>
            ) : filteredItems.length > 0 ? (
              <List
                ref={channelListRef}
                height={listHeight - 50}
                itemCount={filteredItems.length}
                itemSize={activeTab === 'live' ? 40 : 42}
                width={singleColMode ? 280 : 240}
                overscanCount={25}
                itemData={activeTab === 'movies' ? movieRowData : activeTab === 'series' ? seriesRowData : channelRowData}
              >
                {activeTab === 'movies' ? MovieRowItem : activeTab === 'series' ? SeriesRowItem : ChannelRowItem}
              </List>
            ) : (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: '#444', fontSize: '11px' }}>
                {selectedCategory ? 'No items in this folder' : 'Select a folder'}
              </div>
            )}
          </div>
        </div>

        {/* === COLUMN 3: PLAYER + EPG === */}
        <OTTPlayer
          selectedChannel={selectedChannel}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          activeTab={activeTab}
          xtreamService={xtreamService}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          liveChannels={liveChannels}
          filteredItems={filteredItems}
          onChannelChange={(channel) => {
            setSelectedChannel(channel);
            setIsPlaying(true);
          }}
        />
      </div>

      {/* ========== EXIT POPUP ========== */}
      {showExitPopup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowExitPopup(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'rgba(14,14,22,0.95)', border: `1px solid ${CSS.divider}`, padding: '28px 36px', textAlign: 'center', maxWidth: '360px' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>Quitter NINJA 8K ?</h3>
            <p style={{ fontSize: '12px', color: CSS.textDim, marginBottom: '20px' }}>Êtes-vous sûr de vouloir fermer l'application ?</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setShowExitPopup(false)} style={{
                padding: '9px 24px', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', border: `1px solid ${CSS.divider}`, textTransform: 'uppercase',
                letterSpacing: '0.5px', background: 'rgba(14,14,22,0.9)', color: CSS.text, transition: 'all 0.15s',
              }}>ANNULER</button>
              <button onClick={() => { setShowExitPopup(false); onExit?.(); }} style={{
                padding: '9px 24px', fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', border: '1px solid rgba(239,68,68,0.25)', textTransform: 'uppercase',
                letterSpacing: '0.5px', background: 'rgba(239,68,68,0.12)', color: CSS.red, transition: 'all 0.15s',
              }}>QUITTER</button>
            </div>
          </div>
        </div>
      )}

      {/* ========== KEYFRAMES ========== */}
      <style>{`
        @keyframes ottTicker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes ottShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
        @keyframes ottFocus { 0%, 100% { background: rgba(98, 37, 255, 0.4); } 50% { background: rgba(98, 37, 255, 0.15); } }
        @keyframes epgPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

        /* RESPONSIVE */
        @media (max-width: 900px), (max-height: 440px) and (max-width: 1100px) {
          .ott-col-player { display: none !important; }
          .ott-col-folders { width: 200px !important; min-width: 150px !important; }
          .ott-col-channels { flex: 1 !important; width: auto !important; min-width: 0 !important; }
          .ott-navbar .nav-btn { padding: 0 12px !important; font-size: 10px !important; }
        }
        @media (max-width: 640px) {
          .ott-col-folders { width: 150px !important; min-width: 130px !important; }
        }
        @media (min-width: 1600px) {
          .ott-col-folders { width: 260px !important; }
          .ott-col-channels { width: 320px !important; }
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
      `}</style>
    </div>
  );
});

export default OTT;
