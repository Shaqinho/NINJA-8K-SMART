import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { THEME } from '../constants/theme';
import { Player } from './player';
import ChannelRow from './ChannelRow';
import FolderRow from './FolderRow';
import ParticleThemes from './ParticleThemes';
import Settings from './Settings';
import EPGSearch from './player/EPGSearch';
import ContextMenu, { getAliases, setAlias, getHiddenItems, setHiddenItem, isEPGEnabled, setEPGEnabled } from './ContextMenu';
import { usePlaylistContext } from '../context/PlaylistContext';
import { XtreamService } from '../services/XtreamService';
import { useGestures } from '../hooks/useGestures';
import { ninjaCentral, STORES } from '../services/NinjaCentral';

// ============================================================================
// HEADER - Sans flèche, icônes sans background pour OLED
// ============================================================================
const Header = ({ onBack, onSearch, onSettings, onOpenHub }) => (
  <header 
    className="flex items-center justify-between px-4 z-50" 
    style={{ 
      background: '#000000',
      paddingTop: 'var(--safe-top)',
      height: 'calc(60px + var(--safe-top))'
    }}
  >
    <div className="flex items-baseline">
      <span className="text-white font-black text-lg">NINJA</span>
      <span className="font-black text-lg ml-1" style={{ color: '#6225ff' }}>8K</span>
    </div>

    <button
      onClick={onOpenHub}
      className="w-10 h-10 flex items-center justify-center active:scale-90 transition-transform"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    </button>

    <div className="flex items-center gap-3">
      <button onClick={onBack} className="w-9 h-9 flex items-center justify-center active:scale-95">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
          <line x1="6" y1="6" x2="6.01" y2="6"/>
          <line x1="6" y1="18" x2="6.01" y2="18"/>
        </svg>
      </button>
      <button onClick={onSearch} className="w-9 h-9 flex items-center justify-center active:scale-95">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
      </button>
      <button onClick={onSettings} className="w-9 h-9 flex items-center justify-center active:scale-95">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>
  </header>
);

// ============================================================================
// TAB NAVIGATION - With Long Press to Reload
// ============================================================================
const TabNav = ({ activeTab, setActiveTab, onLongPress, reloadingTab }) => {
  const tabs = [
    { id: 'live', label: 'Live' },
    { id: 'vod', label: 'Movies' },
    { id: 'series', label: 'Series' },
  ];

  const longPressTimer = useRef(null);
  const isLongPress = useRef(false);

  const handleTouchStart = (tabId) => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress(tabId);
    }, 800); // 800ms pour long press
  };

  const handleTouchEnd = (tabId) => {
    clearTimeout(longPressTimer.current);
    if (!isLongPress.current) {
      setActiveTab(tabId);
    }
  };

  const handleTouchMove = () => {
    clearTimeout(longPressTimer.current);
  };

  return (
    <div className="flex" style={{ background: '#000000' }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onTouchStart={() => handleTouchStart(tab.id)}
          onTouchEnd={() => handleTouchEnd(tab.id)}
          onTouchMove={handleTouchMove}
          onMouseDown={() => handleTouchStart(tab.id)}
          onMouseUp={() => handleTouchEnd(tab.id)}
          onMouseLeave={() => clearTimeout(longPressTimer.current)}
          className="flex-1 py-3.5 text-sm font-semibold relative"
          style={{ color: activeTab === tab.id ? '#ffffff' : '#9ca3af' }}
        >
          {reloadingTab === tab.id ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span>Reloading...</span>
            </div>
          ) : (
            tab.label
          )}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full" style={{ background: THEME.gradients.primary }} />
          )}
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// VIRTUALIZED CHANNEL LIST - Netflix style windowing
// ============================================================================
const VirtualizedChannelList = ({ items, onSelect, onLongPress, onExtraLongPress, selectedItem, height, aliases, hiddenItems }) => {
  const rowHeight = 72;
  
  const visibleItems = useMemo(() => {
    return items.filter(item => {
      const itemId = item.id || item.stream_id;
      return !hiddenItems[itemId];
    });
  }, [items, hiddenItems]);
  
  const Row = useCallback(({ index, style }) => {
    const item = visibleItems[index];
    const itemId = item.id || item.stream_id;
    const alias = aliases[itemId];
    
    return (
      <div style={style}>
        <ChannelRow
          item={item}
          onSelect={onSelect}
          onLongPress={onLongPress}
          onExtraLongPress={onExtraLongPress}
          isPlaying={selectedItem?.id === item.id}
          alias={alias}
        />
      </div>
    );
  }, [visibleItems, onSelect, onLongPress, onExtraLongPress, selectedItem, aliases]);

  return (
    <List
      height={height}
      itemCount={visibleItems.length}
      itemSize={rowHeight}
      width="100%"
      overscanCount={5}
    >
      {Row}
    </List>
  );
};

// ============================================================================
// BUILD CATEGORIES - Uses provider order from API
// ============================================================================
const buildCategories = (items, apiCategories, type) => {
  const systemFolders = [
    { 
      category_id: 'all', 
      category_name: type === 'live' ? 'All Channels' : type === 'vod' ? 'All Movies' : 'All Series',
      count: items.length, 
      isSystem: true,
    },
    { 
      category_id: 'favorites', 
      category_name: 'Favorites',
      count: 0, 
      isFavorite: true,
      isSystem: true,
    },
    { 
      category_id: 'recent', 
      category_name: 'Recent',
      count: 0, 
      isSystem: true,
    },
  ];

  const categoriesWithCounts = (apiCategories || []).map(cat => {
    const count = items.filter(item => 
      String(item.categoryId) === String(cat.category_id)
    ).length;
    return {
      ...cat,
      count,
    };
  });

  return [...systemFolders, ...categoriesWithCounts];
};

// ============================================================================
// SMART COMPONENT - Main Layout with NinjaCentral Integration
// ============================================================================
const Smart = ({ playlist, onPlay, onBack, onLogout, onSwitchToHub, setIsStreaming }) => {
  const { clearPlaylist } = usePlaylistContext();
  
  const [activeTab, setActiveTab] = useState('live');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEPGSearch, setShowEPGSearch] = useState(false);
  const [listHeight, setListHeight] = useState(400);
  const contentListRef = useRef(null);
  const playerContainerRef = useRef(null);
  
  // NinjaCentral data states
  const [liveData, setLiveData] = useState([]);
  const [vodData, setVodData] = useState([]);
  const [seriesData, setSeriesData] = useState([]);
  const [liveCategories, setLiveCategories] = useState([]);
  const [vodCategories, setVodCategories] = useState([]);
  const [seriesCategories, setSeriesCategories] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [reloadingTab, setReloadingTab] = useState(null);
  
  const [epgData, setEpgData] = useState({});
  const [epgLoading, setEpgLoading] = useState(false);
  const epgLoadedCategoriesRef = useRef(new Set());

  const [multiGridItems, setMultiGridItems] = useState([]);
  const [volume, setVolume] = useState(1);

  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuItem, setContextMenuItem] = useState(null);
  
  const [aliases, setAliases] = useState(() => getAliases());
  const [hiddenItems, setHiddenItems] = useState(() => getHiddenItems());
  const [epgEnabled, setEpgEnabledState] = useState(() => isEPGEnabled());

  const [isLandscape, setIsLandscape] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // ========================================
  // GESTURES
  // ========================================
  const gestures = useGestures(playerContainerRef, {
    onSpread: () => {
      console.log('🎯 SPREAD detected - entering fullscreen');
      setIsPlaying(true);
    },
    onPinch: () => {
      console.log('🎯 PINCH detected - exiting fullscreen');
      setIsPlaying(false);
    },
    onVolumeChange: (vol) => {
      setVolume(vol);
    },
  });

  const xtreamService = useMemo(() => {
    if (!playlist?.server || !playlist?.username || !playlist?.password) return null;
    return new XtreamService(playlist.server, playlist.username, playlist.password);
  }, [playlist]);

  // Sync isStreaming with parent for LibVLC transparency
  useEffect(() => {
    if (setIsStreaming) {
      setIsStreaming(isPlaying && !!selectedItem);
    }
  }, [isPlaying, selectedItem, setIsStreaming]);

  // ============================================================================
  // NINJA CENTRAL - Load data from IndexedDB or fetch if needed
  // ============================================================================
  const loadFromNinjaCentral = useCallback(async () => {
    const [live, vod, series, liveCats, vodCats, seriesCats] = await Promise.all([
      ninjaCentral.getAll(STORES.LIVE),
      ninjaCentral.getAll(STORES.VOD),
      ninjaCentral.getAll(STORES.SERIES),
      ninjaCentral.getAll(STORES.LIVE_CATEGORIES),
      ninjaCentral.getAll(STORES.VOD_CATEGORIES),
      ninjaCentral.getAll(STORES.SERIES_CATEGORIES),
    ]);
    
    setLiveData(live);
    setVodData(vod);
    setSeriesData(series);
    setLiveCategories(liveCats);
    setVodCategories(vodCats);
    setSeriesCategories(seriesCats);
    
    console.log(`[NinjaCentral] Loaded: ${live.length} live, ${vod.length} vod, ${series.length} series`);
  }, []);

  const syncAllFromAPI = useCallback(async () => {
    if (!xtreamService) return;
    
    try {
      await ninjaCentral.syncAll(xtreamService, (step, percent) => {
        console.log(`[NinjaCentral] ${step} (${percent}%)`);
      });
      
      await loadFromNinjaCentral();
    } catch (err) {
      console.error('[NinjaCentral] Sync error:', err);
      throw err;
    }
  }, [xtreamService, loadFromNinjaCentral]);

  useEffect(() => {
    const initNinjaCentral = async () => {
      if (!xtreamService || isDataLoaded) return;
      
      try {
        await ninjaCentral.init();
        
        const counts = await ninjaCentral.getCounts();
        console.log('[NinjaCentral] Current counts:', counts);
        
        if (counts.total > 0) {
          console.log('[NinjaCentral] Loading from cache...');
          await loadFromNinjaCentral();
        } else {
          console.log('[NinjaCentral] First sync from API...');
          await syncAllFromAPI();
        }
        
        setIsDataLoaded(true);
      } catch (err) {
        console.error('[NinjaCentral] Init error:', err);
        if (playlist?.data) {
          setLiveData(playlist.data.live || []);
          setVodData(playlist.data.vod || []);
          setSeriesData(playlist.data.series || []);
          setLiveCategories(playlist.data.liveCategories || []);
          setVodCategories(playlist.data.vodCategories || []);
          setSeriesCategories(playlist.data.seriesCategories || []);
          setIsDataLoaded(true);
        }
      }
    };

    initNinjaCentral();
  }, [xtreamService, isDataLoaded, playlist, loadFromNinjaCentral, syncAllFromAPI]);

  // ============================================================================
  // LONG PRESS TAB - Reload specific category
  // ============================================================================
  const handleTabLongPress = useCallback(async (tabId) => {
    if (!xtreamService || reloadingTab) return;
    
    console.log(`[NinjaCentral] Long press - reloading ${tabId}...`);
    setReloadingTab(tabId);
    
    try {
      if (tabId === 'live') {
        const [categories, streams] = await Promise.all([
          xtreamService.getLiveCategories(),
          xtreamService.getLiveStreams(),
        ]);
        const parsed = xtreamService.parseLiveStreams(streams, categories);
        await ninjaCentral.saveItems(STORES.LIVE, parsed);
        await ninjaCentral.saveCategories(STORES.LIVE_CATEGORIES, categories);
        setLiveData(parsed);
        setLiveCategories(categories);
        // Clear EPG cache for this category
        epgLoadedCategoriesRef.current.clear();
        setEpgData({});
        console.log(`[NinjaCentral] Live reloaded: ${parsed.length} channels`);
        
      } else if (tabId === 'vod') {
        const [categories, streams] = await Promise.all([
          xtreamService.getVodCategories(),
          xtreamService.getVodStreams(),
        ]);
        const parsed = xtreamService.parseVodStreams(streams, categories);
        await ninjaCentral.saveItems(STORES.VOD, parsed);
        await ninjaCentral.saveCategories(STORES.VOD_CATEGORIES, categories);
        setVodData(parsed);
        setVodCategories(categories);
        console.log(`[NinjaCentral] VOD reloaded: ${parsed.length} movies`);
        
      } else if (tabId === 'series') {
        const [categories, seriesList] = await Promise.all([
          xtreamService.getSeriesCategories(),
          xtreamService.getSeries(),
        ]);
        const parsed = xtreamService.parseSeries(seriesList, categories);
        await ninjaCentral.saveItems(STORES.SERIES, parsed);
        await ninjaCentral.saveCategories(STORES.SERIES_CATEGORIES, categories);
        setSeriesData(parsed);
        setSeriesCategories(categories);
        console.log(`[NinjaCentral] Series reloaded: ${parsed.length} series`);
      }
      
      // Update last sync time
      await ninjaCentral.setMeta('lastSync', new Date().toISOString());
      
    } catch (err) {
      console.error(`[NinjaCentral] Reload ${tabId} error:`, err);
    } finally {
      setReloadingTab(null);
    }
  }, [xtreamService, reloadingTab]);

  const [particleTheme, setParticleTheme] = useState(() => {
    return localStorage.getItem('ninja_particle_theme') || 'soft';
  });

  const handleSettingsClose = useCallback(() => {
    setShowSettings(false);
    setParticleTheme(localStorage.getItem('ninja_particle_theme') || 'soft');
  }, []);

  // ============================================================================
  // DATA SELECTORS - Read from NinjaCentral states
  // ============================================================================
  const currentItems = useMemo(() => {
    switch (activeTab) {
      case 'live': return liveData;
      case 'vod': return vodData;
      case 'series': return seriesData;
      default: return [];
    }
  }, [activeTab, liveData, vodData, seriesData]);

  const apiCategories = useMemo(() => {
    switch (activeTab) {
      case 'live': return liveCategories;
      case 'vod': return vodCategories;
      case 'series': return seriesCategories;
      default: return [];
    }
  }, [activeTab, liveCategories, vodCategories, seriesCategories]);

  const liveChannels = useMemo(() => liveData, [liveData]);

  const categories = useMemo(() => {
    return buildCategories(currentItems, apiCategories, activeTab);
  }, [currentItems, apiCategories, activeTab]);

  const categoryItems = useMemo(() => {
    if (!selectedCategory) return [];
    
    let items = [];
    
    if (selectedCategory.category_id === 'all') {
      items = currentItems;
    } else if (selectedCategory.subfolders) {
      return selectedCategory.subfolders;
    } else {
      items = currentItems.filter(item => 
        String(item.categoryId) === String(selectedCategory.category_id)
      );
    }
    
    if (activeTab === 'live' && Object.keys(epgData).length > 0) {
      return items.map(item => {
        const epg = epgData[item.id];
        if (epg) {
          return {
            ...item,
            epg_now: epg.epg_now,
            epg_progress: epg.progress,
          };
        }
        return item;
      });
    }
    
    return items;
  }, [selectedCategory, currentItems, activeTab, epgData]);

  const loadEPGForCategory = useCallback(async (categoryId, items) => {
    if (!xtreamService || activeTab !== 'live') return;
    if (epgLoadedCategoriesRef.current.has(categoryId)) return;
    if (items.length === 0) return;
    
    epgLoadedCategoriesRef.current.add(categoryId);
    setEpgLoading(true);
    
    try {
      const streamIds = items.map(item => item.id).filter(Boolean);
      
      if (streamIds.length === 0) {
        setEpgLoading(false);
        return;
      }
      
      console.log(`[EPG] Loading EPG for ${streamIds.length} channels in category ${categoryId}`);
      
      const epgResults = await xtreamService.getShortEPGBatch(streamIds, 2, 100);
      
      setEpgData(prev => ({
        ...prev,
        ...epgResults,
      }));
      
      console.log(`[EPG] Loaded ${Object.keys(epgResults).length} EPG entries`);
    } catch (err) {
      console.error('[EPG] Error loading EPG:', err);
    } finally {
      setEpgLoading(false);
    }
  }, [xtreamService, activeTab]);

  useEffect(() => {
    if (selectedCategory && activeTab === 'live') {
      let items = [];
      if (selectedCategory.category_id === 'all') {
        items = currentItems;
      } else if (!selectedCategory.subfolders) {
        items = currentItems.filter(item => 
          String(item.categoryId) === String(selectedCategory.category_id)
        );
      }
      
      if (items.length > 0) {
        loadEPGForCategory(selectedCategory.category_id, items);
      }
    }
  }, [selectedCategory, activeTab, currentItems, loadEPGForCategory]);

  const handleCategorySelect = useCallback((category) => {
    if (category.subfolders) {
      setSelectedCategory({ ...category, isSubfolder: true });
    } else {
      setSelectedCategory(category);
    }
  }, []);

  const handleItemSelect = useCallback((item) => {
    setSelectedItem(item);
    setIsPlaying(true);
    // Add to recent
    ninjaCentral.addRecent(item, activeTab).catch(console.error);
  }, [activeTab]);

  const handleChannelChange = useCallback((channel) => {
    setSelectedItem(channel);
    setIsPlaying(true);
  }, []);

  const handleLongPress = useCallback((item) => {
    setMultiGridItems(prev => {
      if (prev.some(i => i.id === item.id)) {
        return prev;
      }
      if (prev.length >= 4) {
        return prev;
      }
      return [...prev, item];
    });
  }, []);

  const handleExtraLongPress = useCallback((item) => {
    setContextMenuItem(item);
    setContextMenuVisible(true);
  }, []);

  const handleToggleEPG = useCallback(() => {
    const newValue = !epgEnabled;
    setEpgEnabledState(newValue);
    setEPGEnabled(newValue);
  }, [epgEnabled]);

  const handleToggleHide = useCallback((item) => {
    const itemId = item.id || item.stream_id;
    const isCurrentlyHidden = hiddenItems[itemId];
    setHiddenItem(itemId, !isCurrentlyHidden);
    setHiddenItems(getHiddenItems());
  }, [hiddenItems]);

  const handleRename = useCallback((item, newAlias) => {
    const itemId = item.id || item.stream_id;
    setAlias(itemId, newAlias);
    setAliases(getAliases());
  }, []);

  const handleDragDrop = useCallback((item) => {
    console.log('[DragDrop] Requested for:', item.name);
  }, []);

  const handleEPGSearchSelect = useCallback((channel) => {
    setSelectedItem(channel);
    setIsPlaying(true);
    setShowEPGSearch(false);
  }, []);

  const handleOpenEPGSearch = useCallback(() => {
    setShowEPGSearch(true);
  }, []);

  const handleBack = useCallback(() => {
    if (selectedCategory) {
      setSelectedCategory(null);
    } else if (onBack) {
      onBack();
    }
  }, [selectedCategory, onBack]);

  const handleClearPlaylist = useCallback(async () => {
    // Clear NinjaCentral data too
    await ninjaCentral.clearAll().catch(console.error);
    clearPlaylist();
    onLogout?.();
  }, [clearPlaylist, onLogout]);

  const handleRefresh = useCallback(async () => {
    setShowSettings(false);
    setEpgData({});
    epgLoadedCategoriesRef.current.clear();
    setIsDataLoaded(false);
    // This will trigger re-sync in useEffect
  }, []);

  const updateListHeight = useCallback(() => {
    if (contentListRef.current) {
      const rect = contentListRef.current.getBoundingClientRect();
      const headerOffset = selectedCategory ? 52 : 0;
      setListHeight(rect.height - headerOffset);
    }
  }, [selectedCategory]);

  useEffect(() => {
    updateListHeight();
    window.addEventListener('resize', updateListHeight);
    const timeout = setTimeout(updateListHeight, 100);
    return () => {
      window.removeEventListener('resize', updateListHeight);
      clearTimeout(timeout);
    };
  }, [updateListHeight, selectedCategory]);

  const containerStyle = {
    background: isPlaying ? 'transparent' : '#000000',
    transition: 'background-color 0.3s'
  };

  // Loading state
  if (!isDataLoaded) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#000000' }}>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white text-sm">Loading content...</p>
          <p className="text-gray-500 text-xs mt-1">First load may take a moment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={containerStyle}>
      {/* Edge trigger zone */}
      {isPlaying && (
        <div 
          className="fixed top-0 left-0 right-0 h-8 z-[10001]"
          onTouchStart={() => setHeaderOpen(true)}
          onMouseEnter={() => setHeaderOpen(true)}
        />
      )}

      {/* Header */}
      {isPlaying ? (
        <div 
          className={`fixed top-0 left-0 right-0 z-[10002] transition-transform duration-300 ${headerOpen ? 'translate-y-0' : '-translate-y-full'}`}
          style={{ background: '#000000' }}
          onMouseLeave={() => setHeaderOpen(false)}
          onTouchEnd={() => setTimeout(() => setHeaderOpen(false), 2000)}
        >
          <Header 
            onBack={onBack}
            onSearch={handleOpenEPGSearch}
            onSettings={() => setShowSettings(true)}
            onOpenHub={onSwitchToHub}
          />
        </div>
      ) : (
        <div className="flex-shrink-0 z-40" style={{ background: '#000000' }}>
          <Header 
            onBack={onBack}
            onSearch={handleOpenEPGSearch}
            onSettings={() => setShowSettings(true)}
            onOpenHub={onSwitchToHub}
          />
        </div>
      )}

      {/* Player Area */}
      <div 
        ref={playerContainerRef}
        className="flex-shrink-0 z-30 overflow-hidden transition-all duration-300"
        style={{ 
          maxHeight: selectedItem && isPlaying ? ((isLandscape && isPlaying) ? '100%' : '300px') : '0px',
          opacity: selectedItem && isPlaying ? 1 : 0,
          flex: (isLandscape && isPlaying) ? 1 : 'none',
        }}
      >
        <Player 
          channel={selectedItem}
          channels={liveChannels}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          onChannelChange={handleChannelChange}
          isLive={activeTab === 'live'}
          onSearchEPG={handleOpenEPGSearch}
          multiGridItems={multiGridItems}
          onMultiGridRemove={(index) => {
            setMultiGridItems(prev => prev.filter((_, i) => i !== index));
          }}
          isSmartFullscreen={isLandscape && isPlaying}
          volume={volume}
          onVolumeChange={setVolume}
          invertedGravity={gestures.isInvertedGravity}
          orientation={gestures.orientation}
        />
      </div>

      {/* Tabs with Long Press */}
      {!(isLandscape && isPlaying) && (
        <div className="flex-shrink-0 z-20" style={{ background: '#000000' }}>
          <TabNav 
            activeTab={activeTab} 
            setActiveTab={(tab) => {
              setActiveTab(tab);
              setSelectedCategory(null);
            }}
            onLongPress={handleTabLongPress}
            reloadingTab={reloadingTab}
          />
        </div>
      )}

      {/* Content */}
      {!(isLandscape && isPlaying) && (
        <div 
          ref={contentListRef}
          className="flex-1 overflow-hidden relative"
          style={{ background: '#000000' }}
        >
          {particleTheme !== 'off' && !isPlaying && (
            <div className="absolute inset-0 pointer-events-none z-0">
              <ParticleThemes containerRef={contentListRef} theme={particleTheme} />
            </div>
          )}
          
          <div className="relative z-10 h-full overflow-hidden">
            {selectedCategory ? (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-2 flex-shrink-0" style={{ background: 'transparent' }}>
                  <button onClick={handleBack} className="p-1 -ml-1 active:scale-95">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                      <path d="M15 18l-6-6 6-6"/>
                    </svg>
                  </button>
                  <span className="text-white font-semibold text-sm">{selectedCategory.category_name}</span>
                  <span className="text-gray-500 text-xs">({selectedCategory.count?.toLocaleString() || categoryItems.length})</span>
                  
                  {epgLoading && activeTab === 'live' && (
                    <div className="ml-auto flex items-center gap-1">
                      <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-purple-400 text-xs">EPG</span>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 overflow-hidden">
                  {selectedCategory.isSubfolder ? (
                    <div className="overflow-y-auto h-full">
                      {categoryItems.map((subfolder) => (
                        <FolderRow
                          key={subfolder.category_id}
                          category={subfolder}
                          onSelect={handleCategorySelect}
                        />
                      ))}
                    </div>
                  ) : (
                    <VirtualizedChannelList
                      items={categoryItems}
                      onSelect={handleItemSelect}
                      onLongPress={handleLongPress}
                      onExtraLongPress={handleExtraLongPress}
                      selectedItem={selectedItem}
                      height={listHeight}
                      aliases={aliases}
                      hiddenItems={hiddenItems}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-y-auto h-full">
                {categories.map((category) => (
                  <FolderRow
                    key={category.category_id}
                    category={category}
                    onSelect={handleCategorySelect}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <Settings
        visible={showSettings}
        onClose={handleSettingsClose}
        playlist={playlist}
        onClearPlaylist={handleClearPlaylist}
        onRefresh={handleRefresh}
      />

      {/* EPG Search Modal */}
      <EPGSearch
        visible={showEPGSearch}
        onClose={() => setShowEPGSearch(false)}
        onSelectChannel={handleEPGSearchSelect}
        xtreamService={xtreamService}
      />

      {/* Context Menu */}
      <ContextMenu
        visible={contextMenuVisible}
        item={contextMenuItem}
        onClose={() => setContextMenuVisible(false)}
        onToggleEPG={handleToggleEPG}
        onToggleHide={handleToggleHide}
        onRename={handleRename}
        onDragDrop={handleDragDrop}
        epgEnabled={epgEnabled}
        isHidden={contextMenuItem ? hiddenItems[contextMenuItem.id || contextMenuItem.stream_id] : false}
        currentAlias={contextMenuItem ? aliases[contextMenuItem.id || contextMenuItem.stream_id] : null}
      />

      {/* Styles */}
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        .pulse-bar { animation: pulse-bar 0.8s ease-in-out infinite; }
        .delay-1 { animation-delay: 0.15s; }
        .delay-2 { animation-delay: 0.3s; }
        .pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        @keyframes pulse-bar { 0%, 100% { opacity: 0.4; transform: scaleY(0.7); } 50% { opacity: 1; transform: scaleY(1); } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.4); } 50% { box-shadow: 0 0 30px rgba(139, 92, 246, 0.7); } }
      `}</style>
    </div>
  );
};

export default Smart;
