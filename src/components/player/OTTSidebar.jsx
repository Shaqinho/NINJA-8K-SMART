import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { ninjaCentral, STORES } from '../../services/NinjaCentral';

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

const OTTSidebar = ({ 
  categories = [], 
  channels = [],
  selectedCategory,
  selectedChannel,
  onCategorySelect,
  onChannelSelect,
  onClose,
  isOpen: externalIsOpen,
  onToggle: externalOnToggle,
  xtreamService,
}) => {
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
  
  // Tab-specific data from NinjaCentral
  const [vodCategories, setVodCategories] = useState([]);
  const [seriesCategories, setSeriesCategories] = useState([]);
  const [vodItems, setVodItems] = useState([]);
  const [seriesItems, setSeriesItems] = useState([]);
  const [seriesSeasons, setSeriesSeasons] = useState({});
  
  // EPG lazy-load
  const [epgData, setEpgData] = useState({});
  const epgLoadingRef = useRef(new Set());
  
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

  // ========== EPG LAZY-LOAD ==========
  const loadEpgForItems = useCallback(async (items) => {
    if (!xtreamService || activeTab !== 'live') return;
    const toLoad = items.filter(item => {
      const id = item.stream_id || item.id;
      return id && epgData[id] === undefined && !epgLoadingRef.current.has(id);
    }).slice(0, 25);
    
    if (toLoad.length === 0) return;
    
    toLoad.forEach(item => epgLoadingRef.current.add(item.stream_id || item.id));
    
    try {
      const results = {};
      const batches = [];
      for (let i = 0; i < toLoad.length; i += 5) {
        batches.push(toLoad.slice(i, i + 5));
      }
      for (const batch of batches) {
        await Promise.all(batch.map(async (item) => {
          const id = item.stream_id || item.id;
          try {
            const epg = await xtreamService.getShortEPG(id, 1);
            const listings = epg?.epg_listings || [];
            if (listings.length > 0) {
              const title = listings[0].title ? atob(listings[0].title) : '';
              results[id] = title;
            } else {
              results[id] = '';
            }
          } catch {
            results[id] = '';
          }
        }));
      }
      setEpgData(prev => ({ ...prev, ...results }));
    } catch (err) {
      console.warn('EPG load error:', err);
    }
  }, [xtreamService, activeTab, epgData]);

  // Trigger EPG load when filtered items change
  useEffect(() => {
    if (activeTab === 'live' && showItems && filteredItems.length > 0) {
      loadEpgForItems(filteredItems.slice(0, 25));
    }
  }, [activeTab, showItems, filteredItems, loadEpgForItems]);

  // ========== ACTIVE CATEGORIES WITH SYSTEM FOLDERS ==========
  const activeCategories = useMemo(() => {
    let cats = [];
    if (activeTab === 'live') cats = categories;
    else if (activeTab === 'movies') cats = vodCategories;
    else if (activeTab === 'series') cats = seriesCategories;
    return [...systemFolders, ...cats];
  }, [activeTab, categories, vodCategories, seriesCategories, systemFolders]);

  const activeItems = useMemo(() => {
    if (activeTab === 'live') return channels;
    if (activeTab === 'movies') return vodItems;
    if (activeTab === 'series') return seriesItems;
    return [];
  }, [activeTab, channels, vodItems, seriesItems]);

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
    const deltaX = e.changedTouches[0].clientX - swipeStartRef.current.x;
    if (deltaX < -50) {
      if (showItems) {
        setShowItems(false);
        setCurrentCategory(null);
        setSearchQuery('');
        setSearchOpen(false);
      } else {
        closeSidebar();
      }
    }
  }, [showItems, closeSidebar]);
  
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

  // Long press on item = toggle favorite
  const handleItemTouchStart = useCallback((item) => {
    const itemId = item.stream_id || item.id || item.series_id;
    itemLongPressRef.current = setTimeout(() => {
      toggleFavorite(itemId);
      itemLongPressRef.current = null;
    }, 3000);
  }, [toggleFavorite]);

  const handleItemTouchEnd = useCallback(() => {
    if (itemLongPressRef.current) {
      clearTimeout(itemLongPressRef.current);
      itemLongPressRef.current = null;
    }
  }, []);
  
  const handleBackToCategories = useCallback(() => {
    setShowItems(false);
    setCurrentCategory(null);
    setSearchQuery('');
    setSearchOpen(false);
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
        const epg = (epgData[item.stream_id || item.id] || item.epg_now || '').toLowerCase();
        return name.includes(q) || epg.includes(q);
      });
    }
    
    return items;
  }, [currentCategory, activeItems, searchQuery, favorites, recentIds, epgData]);

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

  // ========== TAB SWITCH ==========
  const handleTabSwitch = useCallback((tabId) => {
    setActiveTab(tabId);
    setShowItems(false);
    setCurrentCategory(null);
    setSearchQuery('');
    setSearchOpen(false);
  }, []);

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

  // ========== VIRTUALIZED LIVE ROW ==========
  const LiveRow = useCallback(({ index, style }) => {
    const channel = filteredItems[index];
    if (!channel) return null;
    const isActive = selectedChannel?.id === channel.id;
    const channelId = channel.stream_id || channel.id;
    const isFav = favorites[channelId];
    
    return (
      <div
        style={{
          ...style,
          padding: '4px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          background: isActive ? 'rgba(98, 37, 255, 0.25)' : 'transparent',
          borderLeft: isActive ? '3px solid #6225ff' : '3px solid transparent',
        }}
        onClick={() => handleItemClick(channel)}
        onTouchStart={() => handleItemTouchStart(channel)}
        onTouchEnd={handleItemTouchEnd}
        onMouseDown={() => handleItemTouchStart(channel)}
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
          {(epgData[channel.stream_id || channel.id] || channel.epg_now) && (
            <TickerText style={{ fontSize: '8px', color: '#888' }}>
              {epgData[channel.stream_id || channel.id] || channel.epg_now}
            </TickerText>
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
  }, [filteredItems, selectedChannel, handleItemClick, handleItemTouchStart, handleItemTouchEnd, favorites, epgData]);

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
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
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
  const searchBarHeight = searchOpen ? 44 : 0;
  const listHeight = window.innerHeight - 100 - searchBarHeight;

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

        {/* Search Bar (bottom) */}
        {searchOpen && showItems && (
          <div style={{
            height: '44px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: '8px',
            flexShrink: 0,
            background: 'rgba(0,0,0,0.5)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in folder..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: '11px',
                padding: 0,
              }}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '4px' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Search Toggle Button (bottom-right) */}
        {showItems && (
          <button
            onClick={() => {
              setSearchOpen(prev => !prev);
              if (!searchOpen) {
                setTimeout(() => searchInputRef.current?.focus(), 100);
              } else {
                setSearchQuery('');
              }
            }}
            style={{
              position: 'absolute',
              bottom: searchOpen ? '52px' : '12px',
              right: '12px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: searchOpen ? '#6225ff' : 'rgba(255,255,255,0.15)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
              transition: 'all 0.2s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </button>
        )}
      </div>

      {/* Ticker animation */}
      <style>{`
        @keyframes ottTicker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </>
  );
};

export default OTTSidebar;
