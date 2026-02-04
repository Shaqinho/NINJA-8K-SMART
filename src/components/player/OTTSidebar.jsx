import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { ninjaCentral, STORES } from '../services/NinjaCentral';

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

  // ========== ACTIVE CATEGORIES & ITEMS BASED ON TAB ==========
  const activeCategories = useMemo(() => {
    if (activeTab === 'live') return categories;
    if (activeTab === 'movies') return vodCategories;
    if (activeTab === 'series') return seriesCategories;
    return [];
  }, [activeTab, categories, vodCategories, seriesCategories]);

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
    onChannelSelect?.(item);
    // Sidebar stays open
  }, [onChannelSelect]);
  
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
    let items = activeItems.filter(item => String(item.categoryId) === String(currentCategory.category_id));
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(item => {
        const name = (item.name || '').toLowerCase();
        const epg = (item.epg_now || '').toLowerCase();
        return name.includes(q) || epg.includes(q);
      });
    }
    
    return items;
  }, [currentCategory, activeItems, searchQuery]);

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
    const count = getCategoryCount(cat.category_id);
    
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <TickerText style={{ fontSize: '11px', fontWeight: 500, color: '#fff' }}>
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
      >
        <div style={{
          width: '100px',
          height: '25px',
          borderRadius: '4px',
          background: 'rgba(255,255,255,0.08)',
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
          {channel.epg_now && (
            <TickerText style={{ fontSize: '8px', color: '#888' }}>
              {channel.epg_now}
            </TickerText>
          )}
        </div>
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
  }, [filteredItems, selectedChannel, handleItemClick]);

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
          width: '100px',
          height: '25px',
          borderRadius: '4px',
          background: 'rgba(255,255,255,0.08)',
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
            <span style={{ fontSize: '8px', color: '#555' }}>🎬</span>
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
          width: '100px',
          height: '25px',
          borderRadius: '4px',
          background: 'rgba(255,255,255,0.08)',
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
            <span style={{ fontSize: '8px', color: '#555' }}>📺</span>
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
