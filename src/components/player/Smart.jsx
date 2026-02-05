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
    }, 800);
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
// VIRTUALIZED CHANNEL LIST
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
// BUILD CATEGORIES
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
    return { ...cat, count };
  });

  return [...systemFolders, ...categoriesWithCounts];
};

// ============================================================================
// SMART COMPONENT
// ============================================================================
const Smart = ({ playlist, onPlay, onBack, onLogout, onSwitchToHub, setIsStreaming }) => {
  const { clearPlaylist, refreshPlaylist } = usePlaylistContext();
  
  const [activeTab, setActiveTab] = useState('live');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEPGSearch, setShowEPGSearch] = useState(false);
  const [listHeight, setListHeight] = useState(400);
  const [reloadingTab, setReloadingTab] = useState(null);
  const contentListRef = useRef(null);
  const playerContainerRef = useRef(null);
  const smartRef = useRef(null);
  const volumeTimerRef = useRef(null);
  const [showVolumeGauge, setShowVolumeGauge] = useState(false);
  
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

  const [particleTheme, setParticleTheme] = useState(() => {
    return localStorage.getItem('ninja_particle_theme') || 'soft';
  });

  // NinjaCentral data states (persiste après rotation/pinch)
  const [liveData, setLiveData] = useState([]);
  const [vodData, setVodData] = useState([]);
  const [seriesData, setSeriesData] = useState([]);
  const [liveCats, setLiveCats] = useState([]);
  const [vodCats, setVodCats] = useState([]);
  const [seriesCats, setSeriesCats] = useState([]);
  const [ninjaReady, setNinjaReady] = useState(false);

  // Charger depuis NinjaCentral au mount
  useEffect(() => {
    const loadFromNinja = async () => {
      try {
        await ninjaCentral.init();
        const [live, vod, series, lc, vc, sc] = await Promise.all([
          ninjaCentral.getAll(STORES.LIVE),
          ninjaCentral.getAll(STORES.VOD),
          ninjaCentral.getAll(STORES.SERIES),
          ninjaCentral.getAll(STORES.LIVE_CATEGORIES),
          ninjaCentral.getAll(STORES.VOD_CATEGORIES),
          ninjaCentral.getAll(STORES.SERIES_CATEGORIES),
        ]);
        if (live.length > 0 || vod.length > 0 || series.length > 0) {
          setLiveData(live);
          setVodData(vod);
          setSeriesData(series);
          setLiveCats(lc);
          setVodCats(vc);
          setSeriesCats(sc);
          console.log(`[NinjaCentral] Loaded: ${live.length} live, ${vod.length} vod, ${series.length} series`);
        }
        setNinjaReady(true);
      } catch (err) {
        console.error('[NinjaCentral] Load error:', err);
        setNinjaReady(true);
      }
    };
    loadFromNinja();
  }, []);

  // Sauvegarder dans NinjaCentral quand playlist.data arrive
  useEffect(() => {
    if (!playlist?.data || !ninjaReady) return;
    
    const saveToNinja = async () => {
      try {
        await ninjaCentral.init();
        const { live, vod, series, liveCategories, vodCategories, seriesCategories } = playlist.data;
        
        if (live?.length > 0) {
          await ninjaCentral.saveItems(STORES.LIVE, live);
          await ninjaCentral.saveCategories(STORES.LIVE_CATEGORIES, liveCategories || []);
          setLiveData(live);
          setLiveCats(liveCategories || []);
        }
        if (vod?.length > 0) {
          await ninjaCentral.saveItems(STORES.VOD, vod);
          await ninjaCentral.saveCategories(STORES.VOD_CATEGORIES, vodCategories || []);
          setVodData(vod);
          setVodCats(vodCategories || []);
        }
        if (series?.length > 0) {
          await ninjaCentral.saveItems(STORES.SERIES, series);
          await ninjaCentral.saveCategories(STORES.SERIES_CATEGORIES, seriesCategories || []);
          setSeriesData(series);
          setSeriesCats(seriesCategories || []);
        }
        console.log('[NinjaCentral] Saved playlist.data');
      } catch (err) {
        console.error('[NinjaCentral] Save error:', err);
      }
    };
    saveToNinja();
  }, [playlist?.data, ninjaReady]);

  // Orientation detection
  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // OTT Sidebar state (controlled by 3-finger gestures)
  const [ottSidebarOpen, setOttSidebarOpen] = useState(false);

  // Gestures
  const gestures = useGestures(smartRef, {
    onSpread: () => setIsPlaying(true),
    onPinch: () => {
      setIsPlaying(false);
      // Force recalcul après que le layout soit stable
      setTimeout(() => {
        if (contentListRef.current) {
          const rect = contentListRef.current.getBoundingClientRect();
          const headerOffset = selectedCategory ? 52 : 0;
          setListHeight(rect.height - headerOffset);
        }
      }, 300);
    },
    onVolumeChange: (vol) => {
      setVolume(vol);
      setShowVolumeGauge(true);
      clearTimeout(volumeTimerRef.current);
      volumeTimerRef.current = setTimeout(() => setShowVolumeGauge(false), 1500);
    },
    // 3-finger gestures for OTT sidebar
    onOTTOpen: () => setOttSidebarOpen(true),
    onOTTClose: () => setOttSidebarOpen(false),
    // 2-finger swipe for folder navigation
    onFolderPrev: () => window.__ottFolderPrev?.(),
    onFolderNext: () => window.__ottFolderNext?.(),
  });

  const xtreamService = useMemo(() => {
    if (!playlist?.server || !playlist?.username || !playlist?.password) return null;
    return new XtreamService(playlist.server, playlist.username, playlist.password);
  }, [playlist]);

  // Sync isStreaming with parent
  useEffect(() => {
    if (setIsStreaming) {
      setIsStreaming(isPlaying && !!selectedItem);
    }
  }, [isPlaying, selectedItem, setIsStreaming]);

  // ============================================================================
  // DATA FROM NinjaCentral (persiste après rotation/pinch)
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
      case 'live': return liveCats;
      case 'vod': return vodCats;
      case 'series': return seriesCats;
      default: return [];
    }
  }, [activeTab, liveCats, vodCats, seriesCats]);

  const liveChannels = useMemo(() => {
    return liveData;
  }, [liveData]);

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
    
    // Add EPG data if available
    if (activeTab === 'live' && Object.keys(epgData).length > 0) {
      return items.map(item => {
        const epg = epgData[item.id];
        if (epg) {
          return { ...item, epg_now: epg.epg_now, epg_progress: epg.progress };
        }
        return item;
      });
    }
    
    return items;
  }, [selectedCategory, currentItems, activeTab, epgData]);

  // ============================================================================
  // LONG PRESS TAB - Reload specific category
  // ============================================================================
  const handleTabLongPress = useCallback(async (tabId) => {
    if (!xtreamService || reloadingTab) return;
    
    console.log(`[Smart] Long press - reloading ${tabId}...`);
    setReloadingTab(tabId);
    
    try {
      await refreshPlaylist({ 
        live: tabId === 'live', 
        movies: tabId === 'vod', 
        series: tabId === 'series' 
      });
      
      // Clear EPG cache if live
      if (tabId === 'live') {
        epgLoadedCategoriesRef.current.clear();
        setEpgData({});
      }
      
      console.log(`[Smart] ${tabId} reloaded`);
    } catch (err) {
      console.error(`[Smart] Reload ${tabId} error:`, err);
    } finally {
      setReloadingTab(null);
    }
  }, [xtreamService, reloadingTab, refreshPlaylist]);

  // ============================================================================
  // EPG LOADING
  // ============================================================================
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
      
      const epgResults = await xtreamService.getShortEPGBatch(streamIds, 2, 100);
      setEpgData(prev => ({ ...prev, ...epgResults }));
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

  // ============================================================================
  // HANDLERS
  // ============================================================================
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
  }, []);

  const handleChannelChange = useCallback((channel) => {
    setSelectedItem(channel);
    setIsPlaying(true);
  }, []);

  const handleLongPress = useCallback((item) => {
    setMultiGridItems(prev => {
      if (prev.some(i => i.id === item.id)) return prev;
      if (prev.length >= 4) return prev;
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

  const handleClearPlaylist = useCallback(() => {
    clearPlaylist();
    onLogout?.();
  }, [clearPlaylist, onLogout]);

  const handleRefresh = useCallback(async () => {
    setShowSettings(false);
    setEpgData({});
    epgLoadedCategoriesRef.current.clear();
    await refreshPlaylist({ live: true, movies: true, series: true });
  }, [refreshPlaylist]);

  const handleSettingsClose = useCallback(() => {
    setShowSettings(false);
    setParticleTheme(localStorage.getItem('ninja_particle_theme') || 'soft');
  }, []);

  // List height calculation - with ResizeObserver for exit FS
  const updateListHeight = useCallback(() => {
    if (contentListRef.current) {
      const rect = contentListRef.current.getBoundingClientRect();
      const headerOffset = selectedCategory ? 52 : 0;
      const newHeight = rect.height - headerOffset;
      // Only update if height is valid (> 100px)
      if (newHeight > 100) {
        setListHeight(newHeight);
      }
    }
  }, [selectedCategory]);

  useEffect(() => {
    updateListHeight();
    window.addEventListener('resize', updateListHeight);
    
    // ResizeObserver pour détecter quand le container change de taille (exit FS via pinch)
    let resizeObserver = null;
    if (contentListRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        setTimeout(updateListHeight, 50);
        setTimeout(updateListHeight, 150);
        setTimeout(updateListHeight, 300);
      });
      resizeObserver.observe(contentListRef.current);
    }
    
    // Multiple delays to catch layout changes
    const t1 = setTimeout(updateListHeight, 100);
    const t2 = setTimeout(updateListHeight, 300);
    const t3 = setTimeout(updateListHeight, 500);
    
    return () => {
      window.removeEventListener('resize', updateListHeight);
      if (resizeObserver) resizeObserver.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [updateListHeight, selectedCategory, isPlaying]);

  const containerStyle = {
    background: isPlaying ? 'transparent' : '#000000',
    transition: 'background-color 0.3s'
  };

  return (
    <div ref={smartRef} className="fixed inset-0 flex flex-col overflow-hidden" style={containerStyle}>
      {/* Vertical Volume Gauge */}
      {showVolumeGauge && (
        <div
          className="fixed z-[10003] pointer-events-none"
          style={{
            right: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          <div style={{
            width: '36px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 0',
            borderRadius: '18px',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(10px)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {volume > 0 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
              {volume > 0.5 && <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />}
            </svg>
            <div style={{
              width: '4px',
              height: '120px',
              borderRadius: '2px',
              background: 'rgba(255,255,255,0.2)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                bottom: 0,
                width: '100%',
                height: `${Math.round(volume * 100)}%`,
                borderRadius: '2px',
                background: '#6225ff',
                transition: 'height 0.1s ease-out',
              }} />
            </div>
            <span style={{
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
            }}>
              {Math.round(volume * 100)}
            </span>
          </div>
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
          categories={apiCategories}
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
          ottSidebarOpen={ottSidebarOpen}
          onOttSidebarChange={setOttSidebarOpen}
          xtreamService={xtreamService}
          onServers={onSwitchToHub}
        />
      </div>

      {/* Tabs */}
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
