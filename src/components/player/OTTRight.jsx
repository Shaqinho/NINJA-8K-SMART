import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { getVODItemsPaginated, getVODItemsCount, getSeriesItemsPaginated, getSeriesItemsCount, insertVODItemsChunked, insertSeriesItemsChunked, searchChannelsByName, searchProgramsByTitle, getProgramsForChannel } from '../../database/ProgramQueries';
import { getLangName } from '../../services/ProbeService';

// ============================================================================
// OTT RIGHT - Live Search/Detail + Movies & Series Gallery
// 
// LIVE: Search bar (channels + EPG programs) with ALL/NOW/NEXT filters
//       Channel detail view with EPG (4 quick + SHOW MORE for full day)
// MOVIES: Windowed poster grid → detail with TMDB info, audio/subtitles
// SERIES: Windowed poster grid → detail with seasons tabs, episodes list
// ============================================================================

// Format duration seconds → "1h35"
const formatDuration = (secs) => {
  if (!secs || !isFinite(secs)) return '';
  const s = Number(secs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? m.toString().padStart(2, '0') : ''}`;
  return `${m}min`;
};

// Format Unix timestamp → "14:30"
const formatEpgTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

// Tag pill component
const TagPill = ({ children, color = 'purple' }) => {
  const colors = {
    purple: { bg: 'rgba(98,37,255,0.2)', border: 'rgba(98,37,255,0.4)', text: '#fff' },
    gray: { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)', text: '#ccc' },
  };
  const c = colors[color] || colors.purple;
  return (
    <span style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '3px', padding: '2px 6px', fontSize: '8px', color: c.text, fontWeight: 600 }}>
      {children}
    </span>
  );
};

const OTTRight = ({ 
  items: propsItems = [], // DEPRECATED - now using windowing
  sidebarTab = 'movies', 
  selectedFolder = '__all__', // Category ID for filtering
  xtreamService, 
  videoRef, 
  onItemSelect,
  onToggleFavorite,
  onClose,
  visible = false,
  // Live mode props
  currentChannel = null,      // Channel selected from OTTLeft → show detail
  onShowInFolder,             // Navigate OTTLeft to channel's folder
  onPlayChannel,              // Play a channel from search results
}, ref) => {
  const type = sidebarTab; // 'live', 'movies', or 'series'
  
  // ========== LIVE SEARCH STATES ==========
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [liveSearchFilter, setLiveSearchFilter] = useState('ALL'); // ALL | NOW | NEXT
  const [liveSearchResults, setLiveSearchResults] = useState({ channels: [], programs: [] });
  const [liveSearching, setLiveSearching] = useState(false);
  const [showChannelDetail, setShowChannelDetail] = useState(false);
  const [channelDayPrograms, setChannelDayPrograms] = useState([]);
  const [loadingDayEpg, setLoadingDayEpg] = useState(false);
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  
  // ========== WINDOWING STATES (Infinite Loader) ==========
  const [items, setItems] = useState([]);           // Paginated items
  const [totalCount, setTotalCount] = useState(0);  // Total count from DB
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [probeData, setProbeData] = useState(null);
  const [probing, setProbing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [posterOverlay, setPosterOverlay] = useState(false);
  const [showAllAudio, setShowAllAudio] = useState(false); // Overlay audio tracks
  const [showAllSubs, setShowAllSubs] = useState(false);   // Overlay subtitle tracks
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(0); // 0=Petit(4rows défaut), 1=Moyen, 2=Grand
  const [epgPrograms, setEpgPrograms] = useState([]); // 4 prochains programmes
  const gridRef = useRef(null);

  // Grid layout — 3 crans de zoom
  const ZOOM_CONFIGS = [
    { rows: 4, cols: 6 },  // Petit (défaut) - 24 posters
    { rows: 3, cols: 6 },  // Moyen - 18 posters
    { rows: 2, cols: 4 },  // Grand - 8 posters
  ];
  
  const currentZoom = ZOOM_CONFIGS[zoomLevel];
  const COLUMN_COUNT = currentZoom.cols;
  const ITEM_WIDTH = Math.floor((window.innerWidth - 280) / COLUMN_COUNT);
  const ITEM_HEIGHT = Math.round(ITEM_WIDTH * 1.4); // Réduit de 1.5 à 1.4 pour que tout rentre
  const ROW_COUNT = Math.ceil(items.length / COLUMN_COUNT);

  // Expose zoom methods to parent
  React.useImperativeHandle(ref, () => ({
    zoomIn: () => setZoomLevel(prev => Math.min(2, prev + 1)),   // Spread → cran supérieur (plus grand)
    zoomOut: () => setZoomLevel(prev => Math.max(0, prev - 1)),  // Pinch → cran inférieur (plus petit)
  }));

  // Reset on items change
  useEffect(() => {
    setSelectedItem(null);
    setDetailData(null);
    setProbeData(null);
    setSelectedSeason(1);
  }, [items]);

  // Fetch detail info + probe stream
  const handleThumbnailClick = useCallback(async (item) => {
    const streamId = item.stream_id || item.id;
    
    // 1. On ouvre la fiche et on reset les anciennes langues
    setSelectedItem(item);
    setDetailData(null);
    setProbeData(null);
    setSelectedSeason(1);
    setPosterOverlay(false);
    setLoading(true);

    try {
      if (type === 'movies' && xtreamService) {
        // 2. On appelle la nouvelle méthode qui prépare tout
        const { info, probeUrl } = await xtreamService.getVodDetailsWithProbeUrl(streamId);
        setDetailData(info); // Affiche le synopsis, titre, etc.

        // 3. LANCEMENT DU SCAN AUTOMATIQUE (Le Probe)
        if (videoRef?.current?.probeStream) {
          setProbing(true);
          videoRef.current.probeStream(probeUrl)
            .then(tracks => {
              // 4. Les vraies langues arrivent ici
              setProbeData(tracks);
            })
            .catch(e => console.error("Erreur scan langues:", e))
            .finally(() => setProbing(false));
        }
      } else if (type === 'series' && xtreamService) {
        const info = await xtreamService.getSeriesInfo(streamId);
        setDetailData(info);
      }
    } catch (e) {
      console.error('MediaGallery: Detail fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [type, xtreamService, videoRef]);

  // ========== WINDOWING: Load More Items (Infinite Loader) ==========
  const loadMoreItems = useCallback(async (startIndex, stopIndex) => {
    if (isLoadingMore) return;
    
    setIsLoadingMore(true);
    
    try {
      const limit = stopIndex - startIndex + 1;
      const offset = startIndex;
      
      const newItems = type === 'live'
        ? [] // TODO: getLiveChannelsPaginated not implemented - skip for now
        : type === 'movies' 
          ? await getVODItemsPaginated(selectedFolder, limit, offset)
          : await getSeriesItemsPaginated(selectedFolder, limit, offset);
      
      setItems(prev => {
        const updated = [...prev];
        newItems.forEach((item, i) => {
          updated[startIndex + i] = item;
        });
        return updated;
      });
    } catch (err) {
      console.error('❌ loadMoreItems failed:', err);
    }
    
    setIsLoadingMore(false);
  }, [type, selectedFolder, isLoadingMore]);

  // ========== WINDOWING: Initial Load on Folder/Tab Change ==========
  useEffect(() => {
    const loadInitial = async () => {
      try {
        setLoading(true);
        
        // STEP 1: Check if SQLite has data for this folder
        const sqlCount = type === 'live'
          ? 0 // TODO: getLiveChannelsCount not implemented - always use Xtream API for now
          : type === 'movies' 
            ? await getVODItemsCount(selectedFolder)
            : await getSeriesItemsCount(selectedFolder);
        
        if (sqlCount > 0) {
          // CONDITION: SQL data present → Use paginated local load (FAST)
          console.log(`[OTTRight] SQLite data found (${sqlCount} items), using local DB`);
          setTotalCount(sqlCount);
          setItems(new Array(sqlCount).fill(null)); // Placeholder array
          
          // Load first 100 items
          await loadMoreItems(0, Math.min(99, sqlCount - 1));
          
        } else if (xtreamService) {
          // CONDITION: SQL empty → Fetch from Xtream API (FALLBACK)
          console.log(`[OTTRight] SQLite empty, fetching from Xtream API for folder: ${selectedFolder}`);
          
          let rawData;
          if (type === 'live') {
            rawData = await xtreamService.getLiveStreams();
          } else if (type === 'movies') {
            rawData = await xtreamService.getVodStreams();
          } else {
            rawData = await xtreamService.getSeries();
          }

          // Parse and filter by category
          const parsedData = type === 'live'
            ? xtreamService.parseLiveStreams(rawData)
            : type === 'movies' 
              ? xtreamService.parseVodStreams(rawData)
              : xtreamService.parseSeries(rawData);
          
          // Filter by selected folder (categoryId || category_id for API/SQLite compatibility)
          const filteredData = selectedFolder === '__all__' 
            ? parsedData 
            : parsedData.filter(item => String(item.categoryId || item.category_id) === String(selectedFolder));

          setItems(filteredData);
          setTotalCount(filteredData.length);
          
          // OVERWRITE: Save fetched data to SQLite for next time (background, non-blocking)
          if (parsedData.length > 0) {
            console.log(`[OTTRight] Saving ${parsedData.length} items to SQLite (background)...`);
            const savePromise = type === 'movies' 
              ? insertVODItemsChunked(parsedData)
              : insertSeriesItemsChunked(parsedData);
            
            savePromise
              .then(() => console.log(`[OTTRight] ✅ Background save complete (${parsedData.length} items)`))
              .catch(err => console.error('[OTTRight] ❌ Background save failed:', err));
          }
        } else {
          // No SQLite, no Xtream service
          console.warn('[OTTRight] No data source available');
          setTotalCount(0);
          setItems([]);
        }
      } catch (err) {
        console.error('❌ Hybrid load failed:', err);
        setTotalCount(0);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    
    if (visible) {
      loadInitial();
    }
  }, [selectedFolder, type, visible, xtreamService, loadMoreItems]);

  // ========== INFINITE LOADER HELPERS ==========
  const isItemLoaded = useCallback((index) => !!items[index], [items]);
  
  const handleItemsRendered = useCallback(({ visibleRowStartIndex, visibleRowStopIndex, visibleColumnStartIndex, visibleColumnStopIndex }) => {
    const startIndex = visibleRowStartIndex * COLUMN_COUNT + visibleColumnStartIndex;
    const stopIndex = visibleRowStopIndex * COLUMN_COUNT + visibleColumnStopIndex;
    
    return {
      visibleStartIndex: startIndex,
      visibleStopIndex: stopIndex,
    };
  }, [COLUMN_COUNT]);

  // Charger EPG (4 prochains programmes) quand on sélectionne une chaîne LIVE
  useEffect(() => {
    if (!selectedItem || type !== 'live' || !xtreamService) {
      setEpgPrograms([]);
      return;
    }
    
    const channelId = selectedItem.stream_id || selectedItem.id;
    if (!channelId) return;
    
    xtreamService.getShortEPG(channelId, 4).then(data => {
      const programs = [];
      if (data.epg_now) programs.push({ title: data.epg_now, start: data.epg_start, end: data.epg_end });
      if (data.epg_next) programs.push({ title: data.epg_next, start: data.epg_next_start, end: data.epg_next_end });
      if (data.epg_listings) {
        data.epg_listings.forEach(p => {
          if (programs.length < 4) programs.push({ title: p.title, start: p.start, end: p.stop });
        });
      }
      setEpgPrograms(programs.slice(0, 4));
    }).catch(err => {
      console.warn('EPG fetch failed:', err);
      setEpgPrograms([]);
    });
  }, [selectedItem, type, xtreamService]);

  // ========== LIVE: When currentChannel changes from OTTLeft, show detail ==========
  useEffect(() => {
    if (type !== 'live') return;
    if (currentChannel) {
      setShowChannelDetail(true);
      setChannelDayPrograms([]);
      setShowFullSchedule(false);
      // Load 4 quick programs via existing epgPrograms mechanism (already handled above)
      // Full day only loads on SHOW MORE click
    } else {
      setShowChannelDetail(false);
    }
  }, [currentChannel, type]);

  // ========== LIVE: Load full day EPG (triggered by SHOW MORE) ==========
  const loadFullDayEpg = useCallback(async () => {
    if (!currentChannel) return;
    const streamId = currentChannel.stream_id || currentChannel.id;
    if (!streamId) return;
    setLoadingDayEpg(true);
    try {
      // SQLite first
      const programs = await getProgramsForChannel(streamId, false);
      if (programs.length > 0) {
        setChannelDayPrograms(programs);
      } else if (xtreamService) {
        // Fallback: API with high limit
        const epgList = await xtreamService.getShortEPG(streamId, 20);
        const now = Math.floor(Date.now() / 1000);
        const mapped = (epgList || []).map(p => {
          const st = p.startTimestamp || 0;
          const en = p.stopTimestamp || 0;
          const isLive = (st <= now && en > now) ? 1 : 0;
          return {
            title: p.title,
            description: p.description || '',
            start_time: st,
            end_time: en,
            is_currently_live: isLive,
            progress: isLive && en > st ? Math.min(100, Math.round(((now - st) / (en - st)) * 100)) : 0,
          };
        });
        setChannelDayPrograms(mapped);
      }
    } catch (err) {
      console.warn('Full day EPG load failed:', err);
      setChannelDayPrograms([]);
    } finally {
      setLoadingDayEpg(false);
      setShowFullSchedule(true);
    }
  }, [currentChannel, xtreamService]);

  // ========== LIVE: Debounced search (channels + programs) ==========
  useEffect(() => {
    if (type !== 'live' || showChannelDetail) return;
    if (!liveSearchQuery.trim()) {
      setLiveSearchResults({ channels: [], programs: [] });
      return;
    }
    const debounce = setTimeout(async () => {
      setLiveSearching(true);
      try {
        const q = liveSearchQuery.trim();
        const now = Math.floor(Date.now() / 1000);
        
        // Search channels by name (always)
        const channels = await searchChannelsByName(q, [], true, 50);
        
        // Search programs based on filter
        let programs = [];
        if (liveSearchFilter === 'ALL') {
          programs = await searchProgramsByTitle(q, [], true, true, 50);
        } else if (liveSearchFilter === 'NOW') {
          const allProgs = await searchProgramsByTitle(q, [], true, true, 100);
          programs = allProgs.filter(p => p.is_currently_live === 1);
        } else if (liveSearchFilter === 'NEXT') {
          const allProgs = await searchProgramsByTitle(q, [], true, false, 100);
          programs = allProgs.filter(p => p.start_time > now).slice(0, 50);
        }
        
        setLiveSearchResults({ channels, programs });
      } catch (err) {
        console.error('Live search error:', err);
        setLiveSearchResults({ channels: [], programs: [] });
      } finally {
        setLiveSearching(false);
      }
    }, 250);
    return () => clearTimeout(debounce);
  }, [liveSearchQuery, liveSearchFilter, type, showChannelDetail]);

  // Reset live search when switching tabs
  useEffect(() => {
    if (type !== 'live') {
      setLiveSearchQuery('');
      setLiveSearchResults({ channels: [], programs: [] });
      setShowChannelDetail(false);
      setShowFullSchedule(false);
    }
  }, [type]);

  const handleBack = useCallback(() => {
    setSelectedItem(null);
    setDetailData(null);
    setProbeData(null);
    setPosterOverlay(false);
  }, []);

  const handlePlay = useCallback(() => {
    if (selectedItem) {
      onClose?.(); // Fermer OTT
      onItemSelect?.({ ...selectedItem, seekTime: 0 }); // Lancer à 0
    }
  }, [selectedItem, onItemSelect, onClose]);

  // Play a specific episode
  const handlePlayEpisode = useCallback((episode) => {
    if (!episode || !xtreamService) return;
    const ext = episode.container_extension || 'mp4';
    const epItem = {
      ...episode,
      name: episode.title || `Episode ${episode.episode_num}`,
      streamUrl: `${xtreamService.server}/series/${xtreamService.username}/${xtreamService.password}/${episode.id}.${ext}`,
      type: 'series',
    };
    onItemSelect?.(epItem);
  }, [xtreamService, onItemSelect]);

  // Render for live/movies/series tabs
  if (!visible || (sidebarTab !== 'live' && sidebarTab !== 'movies' && sidebarTab !== 'series')) {
    return null;
  }

  // ========== LIVE: SEARCH VIEW + CHANNEL DETAIL VIEW ==========
  if (type === 'live') {
    const now = Math.floor(Date.now() / 1000);

    // ===== CHANNEL DETAIL VIEW (when channel selected from OTTLeft) =====
    if (showChannelDetail && currentChannel) {
      const ch = currentChannel;
      const channelId = ch.stream_id || ch.id;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'transparent' }}>
          {/* Back arrow + header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px 8px', flexShrink: 0, gap: '10px' }}>
            <button 
              onClick={() => { setShowChannelDetail(false); setShowFullSchedule(false); }} 
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: '#fff', fontSize: '14px' }}
            >
              ←
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                <span style={{ fontSize: '8px', color: '#888', fontFamily: 'monospace' }}>#{ch.num || '—'}</span>
                <span style={{ fontSize: '8px', color: '#6225ff', fontWeight: 700 }}>ID: {channelId}</span>
                {ch.epgChannelId && <span style={{ fontSize: '8px', color: '#555' }}>EPG: {ch.epgChannelId}</span>}
              </div>
            </div>
            <button 
              onClick={() => { onPlayChannel?.(ch); }}
              style={{ background: 'linear-gradient(135deg, #6225ff, #8b5cf6)', border: 'none', borderRadius: '50%', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <span style={{ color: '#fff', fontSize: '13px', marginLeft: '2px' }}>▶</span>
            </button>
          </div>

          {/* Channel info row */}
          <div style={{ padding: '0 16px 10px', display: 'flex', gap: '12px', flexShrink: 0 }}>
            {ch.logo && (
              <img src={ch.logo} alt="" style={{ width: '80px', height: '45px', objectFit: 'contain', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} onError={(e) => { e.target.style.display = 'none'; }} />
            )}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
              {(ch.category || ch.category_name) && <div style={{ fontSize: '9px', color: '#666' }}>📁 {ch.category || ch.category_name}</div>}
              {ch.tvArchive ? <div style={{ fontSize: '9px', color: '#888' }}>📼 Catch-up: {ch.tvArchiveDuration || '?'} days</div> : null}
              <button 
                onClick={() => onShowInFolder?.(ch.categoryId || ch.category_id, channelId)}
                style={{ background: 'rgba(98,37,255,0.12)', border: '1px solid rgba(98,37,255,0.3)', borderRadius: '4px', padding: '3px 8px', fontSize: '8px', color: '#a78bfa', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start', marginTop: '2px' }}
              >
                SHOW IN FOLDER
              </button>
            </div>
          </div>

          {/* Scrollable content area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
            {/* 4 quick EPG programs (from existing epgPrograms state - fast) */}
            {!showFullSchedule && epgPrograms.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                {epgPrograms.map((prog, i) => {
                  const isFirst = i === 0;
                  return (
                    <div key={i} style={{ 
                      padding: isFirst ? '10px 12px' : '8px 12px', 
                      marginBottom: '4px',
                      background: isFirst ? 'rgba(98,37,255,0.12)' : 'rgba(255,255,255,0.03)',
                      border: isFirst ? '1px solid rgba(98,37,255,0.25)' : '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '8px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <span style={{ fontSize: '8px', fontWeight: 800, color: isFirst ? '#8b5cf6' : '#555', letterSpacing: '1px' }}>
                          {isFirst ? 'NOW' : i === 1 ? 'NEXT' : ''}
                        </span>
                        <span style={{ fontSize: '8px', color: '#555' }}>
                          {prog.start ? prog.start.split(' ')[1]?.substring(0, 5) : ''} — {prog.end ? prog.end.split(' ')[1]?.substring(0, 5) : ''}
                        </span>
                      </div>
                      <div style={{ fontSize: isFirst ? '12px' : '10px', fontWeight: isFirst ? 700 : 600, color: isFirst ? '#fff' : '#ccc' }}>{prog.title}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* SHOW MORE button (loads full day schedule) */}
            {!showFullSchedule && (
              <button
                onClick={loadFullDayEpg}
                disabled={loadingDayEpg}
                style={{
                  width: '100%', padding: '8px 0', borderRadius: '6px', fontSize: '9px', fontWeight: 800,
                  letterSpacing: '0.5px', cursor: loadingDayEpg ? 'wait' : 'pointer',
                  background: 'rgba(98,37,255,0.1)', border: '1px solid rgba(98,37,255,0.25)',
                  color: '#8b5cf6', marginBottom: '10px',
                }}
              >
                {loadingDayEpg ? 'LOADING...' : 'SHOW FULL SCHEDULE'}
              </button>
            )}

            {/* Full day schedule (after SHOW MORE) */}
            {showFullSchedule && (
              <>
                <div style={{ fontSize: '9px', fontWeight: 800, color: '#555', letterSpacing: '1px', padding: '4px 0 6px' }}>
                  FULL SCHEDULE ({channelDayPrograms.length})
                </div>
                {channelDayPrograms.length === 0 && !loadingDayEpg && (
                  <div style={{ padding: '15px 0', textAlign: 'center', color: '#444', fontSize: '10px' }}>No EPG data available</div>
                )}
                {channelDayPrograms.map((prog, i) => {
                  const isNow = prog.is_currently_live === 1;
                  const isPast = prog.end_time && prog.end_time < now;
                  return (
                    <div key={i} style={{ 
                      padding: '7px 0', 
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      opacity: isPast ? 0.4 : 1,
                    }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '9px', color: isNow ? '#8b5cf6' : '#555', fontWeight: 700, fontFamily: 'monospace', minWidth: '38px', flexShrink: 0 }}>
                          {formatEpgTime(prog.start_time)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '10px', fontWeight: isNow ? 700 : 500, color: isNow ? '#fff' : '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {isNow && <span style={{ color: '#8b5cf6', marginRight: '4px' }}>●</span>}
                            {prog.title}
                          </div>
                          {prog.description && isNow && (
                            <div style={{ fontSize: '8px', color: '#666', marginTop: '2px', lineHeight: '1.3' }}>{prog.description.substring(0, 120)}</div>
                          )}
                        </div>
                        <span style={{ fontSize: '8px', color: '#444', flexShrink: 0 }}>{formatEpgTime(prog.end_time)}</span>
                      </div>
                      {isNow && prog.progress > 0 && (
                        <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px', marginTop: '4px', marginLeft: '46px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${prog.progress}%`, background: '#6225ff', borderRadius: '1px' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* No EPG at all */}
            {!showFullSchedule && epgPrograms.length === 0 && (
              <div style={{ padding: '15px 0', textAlign: 'center', color: '#444', fontSize: '10px' }}>No EPG data available</div>
            )}
          </div>
        </div>
      );
    }

    // ===== SEARCH VIEW (default live view — no channel selected) =====
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'transparent' }}>
        {/* Search bar */}
        <div style={{ padding: '12px 16px 8px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#555', fontSize: '12px', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              value={liveSearchQuery}
              onChange={(e) => setLiveSearchQuery(e.target.value)}
              placeholder="Search channels & programs..."
              style={{
                width: '100%', padding: '8px 10px 8px 32px', 
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px', color: '#fff', fontSize: '11px', outline: 'none',
                fontWeight: 500,
              }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(98,37,255,0.4)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            />
            {liveSearchQuery && (
              <button 
                onClick={() => setLiveSearchQuery('')} 
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#555', fontSize: '14px', cursor: 'pointer', padding: '0 4px' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter pills: ALL | NOW | NEXT */}
        <div style={{ display: 'flex', gap: '6px', padding: '0 16px 10px', flexShrink: 0 }}>
          {['ALL', 'NOW', 'NEXT'].map(f => (
            <button
              key={f}
              onClick={() => setLiveSearchFilter(f)}
              style={{
                flex: 1, padding: '5px 0', borderRadius: '6px', fontSize: '9px', fontWeight: 800,
                letterSpacing: '0.5px', cursor: 'pointer', transition: 'all 0.2s',
                background: liveSearchFilter === f ? 'rgba(98,37,255,0.25)' : 'rgba(255,255,255,0.03)',
                border: liveSearchFilter === f ? '1px solid rgba(98,37,255,0.5)' : '1px solid rgba(255,255,255,0.06)',
                color: liveSearchFilter === f ? '#fff' : '#666',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          {liveSearching && (
            <div style={{ padding: '15px 0', textAlign: 'center', color: '#6225ff', fontSize: '10px', fontWeight: 700 }}>Searching...</div>
          )}

          {!liveSearchQuery.trim() && !liveSearching && (
            <div style={{ padding: '30px 0', textAlign: 'center', color: '#444', fontSize: '10px' }}>
              Type to search channels & programs
            </div>
          )}

          {/* Channel results */}
          {liveSearchResults.channels.length > 0 && (
            <>
              <div style={{ fontSize: '8px', fontWeight: 800, color: '#555', letterSpacing: '1px', padding: '4px 0 6px' }}>
                CHANNELS ({liveSearchResults.channels.length})
              </div>
              {liveSearchResults.channels.map((ch, i) => (
                <div
                  key={`ch-${ch.stream_id || i}`}
                  onClick={() => {
                    const streamId = ch.stream_id || ch.id;
                    const playItem = {
                      ...ch,
                      id: streamId,
                      stream_id: streamId,
                      name: ch.name,
                      logo: ch.logo,
                      streamUrl: xtreamService ? `${xtreamService.server}/live/${xtreamService.username}/${xtreamService.password}/${streamId}.m3u8` : null,
                      type: 'live',
                    };
                    onPlayChannel?.(playItem);
                  }}
                  style={{
                    display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                  }}
                >
                  {ch.logo ? (
                    <img src={ch.logo} alt="" style={{ width: '36px', height: '24px', objectFit: 'contain', borderRadius: '3px', background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div style={{ width: '36px', height: '24px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0 }}>📺</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</div>
                    {ch.category_name && <div style={{ fontSize: '8px', color: '#555' }}>{ch.category_name}</div>}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowInFolder?.(ch.category_id, ch.stream_id);
                    }}
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '3px', padding: '2px 6px', fontSize: '7px', color: '#666', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                  >
                    📁
                  </button>
                </div>
              ))}
            </>
          )}

          {/* Program results */}
          {liveSearchResults.programs.length > 0 && (
            <>
              <div style={{ fontSize: '8px', fontWeight: 800, color: '#555', letterSpacing: '1px', padding: '8px 0 6px' }}>
                PROGRAMS ({liveSearchResults.programs.length})
              </div>
              {liveSearchResults.programs.map((prog, i) => (
                <div
                  key={`prog-${prog.id || i}`}
                  onClick={() => {
                    const streamId = prog.stream_id;
                    const playItem = {
                      id: streamId,
                      stream_id: streamId,
                      name: prog.channel_name || `Channel ${streamId}`,
                      logo: prog.channel_logo,
                      streamUrl: xtreamService ? `${xtreamService.server}/live/${xtreamService.username}/${xtreamService.password}/${streamId}.m3u8` : null,
                      type: 'live',
                    };
                    onPlayChannel?.(playItem);
                  }}
                  style={{
                    padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    {prog.channel_logo ? (
                      <img src={prog.channel_logo} alt="" style={{ width: '30px', height: '20px', objectFit: 'contain', borderRadius: '3px', background: 'rgba(255,255,255,0.04)', flexShrink: 0, marginTop: '1px' }} onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                      <div style={{ width: '30px', height: '20px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', flexShrink: 0 }}>📺</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prog.title}</div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                        <span style={{ fontSize: '8px', color: '#888' }}>{prog.channel_name}</span>
                        <span style={{ fontSize: '8px', color: '#555' }}>
                          {formatEpgTime(prog.start_time)} — {formatEpgTime(prog.end_time)}
                        </span>
                        {prog.is_currently_live === 1 && (
                          <span style={{ fontSize: '7px', fontWeight: 800, color: '#8b5cf6', background: 'rgba(98,37,255,0.15)', padding: '1px 4px', borderRadius: '2px' }}>LIVE</span>
                        )}
                      </div>
                      {prog.is_currently_live === 1 && prog.progress > 0 && (
                        <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '1px', marginTop: '4px', overflow: 'hidden', maxWidth: '120px' }}>
                          <div style={{ height: '100%', width: `${prog.progress}%`, background: '#6225ff', borderRadius: '1px' }} />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowInFolder?.(prog.category_id, prog.stream_id);
                      }}
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '3px', padding: '2px 6px', fontSize: '7px', color: '#666', fontWeight: 700, cursor: 'pointer', flexShrink: 0, marginTop: '2px' }}
                    >
                      📁
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* No results */}
          {liveSearchQuery.trim() && !liveSearching && liveSearchResults.channels.length === 0 && liveSearchResults.programs.length === 0 && (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#444', fontSize: '10px' }}>No results found</div>
          )}
        </div>
      </div>
    );
  }

  // ========== MOVIES / SERIES DETAIL VIEW ==========
  if (selectedItem && (type === 'movies' || type === 'series')) {
    // GEMINI FIX: Double mapping pour couvrir .info ET .movie_data
    const apiInfo = detailData?.info || {};
    const apiMovie = detailData?.movie_data || {};
    
    // Poster (généralement dans .info)
    const poster = apiInfo.cover || apiInfo.movie_image || selectedItem.logo || selectedItem.cover || selectedItem.stream_icon;
    const posterBig = apiInfo.cover_big || poster;
    
    // Métadonnées (cherche dans les DEUX sources)
    const title = apiMovie.name || apiInfo.name || selectedItem.name || 'Untitled';
    const plot = apiInfo.plot || apiInfo.description || apiMovie.plot || selectedItem.plot || '';
    const cast = apiInfo.cast || apiMovie.cast || selectedItem.cast || '';
    const director = apiInfo.director || apiMovie.director || selectedItem.director || '';
    const genre = apiInfo.genre || apiMovie.genre || selectedItem.category_name || '';
    const rating = apiInfo.rating || apiMovie.rating || selectedItem.rating || '';
    const year = apiInfo.releasedate || apiInfo.release_date || apiMovie.year || selectedItem.year || '';
    const duration = apiInfo.duration || apiMovie.duration || selectedItem.duration || '';
    const video = apiInfo.video || apiMovie.video || selectedItem.video || null;
    const episodeRunTime = apiInfo.episode_run_time || selectedItem.episodeRunTime || null;

    // AUDIO/SUBS depuis PROBE (pas VOD info !)
    const audioTracks = probeData?.audioTracks || [];
    const subtitleTracks = probeData?.subtitleTracks || [];
    
    // RÉSOLUTION depuis PROBE
    const resolution = probeData?.video?.width 
      ? `${probeData.video.width}×${probeData.video.height}` 
      : null;

    // Series-specific
    const seasons = detailData?.seasons || [];
    const episodes = detailData?.episodes || {};
    const currentSeasonEpisodes = episodes[String(selectedSeason)] || [];
    const currentSeasonInfo = seasons.find(s => s.season_number === selectedSeason);
    // Season cover: use season-specific cover if available
    const seasonCover = currentSeasonInfo?.cover || currentSeasonInfo?.cover_big || poster;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', background: 'transparent' }}>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '15px 20px 10px', flexShrink: 0, gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
              {year && <span style={{ fontSize: '10px', color: '#888' }}>{String(year).substring(0, 4)}</span>}
              {genre && <span style={{ fontSize: '9px', color: '#6225ff', fontWeight: 700 }}>{genre}</span>}
              {video && video.width && video.height && <span style={{ fontSize: '9px', color: '#4ade80', fontWeight: 600 }}>{video.width}×{video.height}</span>}
              {rating && <span style={{ fontSize: '9px', color: '#ffd700' }}>★ {rating}</span>}
              {duration && <span style={{ fontSize: '9px', color: '#666' }}>{duration}</span>}
              {type === 'series' && episodeRunTime && <span style={{ fontSize: '9px', color: '#555' }}>~{episodeRunTime} min/ep</span>}
            </div>
          </div>
          <button onClick={handlePlay} style={{ background: 'linear-gradient(135deg, #6225ff, #8b5cf6)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: '14px', marginLeft: '2px' }}>▶</span>
          </button>
          <button onClick={() => onToggleFavorite?.(selectedItem.stream_id || selectedItem.id)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ fontSize: '16px' }}>☆</span>
          </button>
          <button onClick={handleBack} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: '#888', fontSize: '14px' }}>
            ✕
          </button>
        </div>

        {/* Poster + Description */}
        <div style={{ display: 'flex', gap: '16px', padding: '0 20px 15px', flexShrink: 0 }}>
          {(type === 'series' ? seasonCover : poster) && (
            <img
              src={type === 'series' ? seasonCover : poster}
              alt=""
              onClick={() => setPosterOverlay(true)}
              style={{ width: '140px', height: '210px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, cursor: 'pointer' }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {plot && (
              <div style={{ fontSize: '11px', color: '#aaa', lineHeight: '1.5' }}>
                {plot.substring(0, 300)}{plot.length > 300 ? '...' : ''}
              </div>
            )}
            {director && <div style={{ fontSize: '10px', color: '#888' }}><span style={{ fontWeight: 700 }}>Director:</span> {director}</div>}
            {cast && <div style={{ fontSize: '10px', color: '#666' }}><span style={{ fontWeight: 700 }}>Cast:</span> {cast.substring(0, 150)}</div>}
            {resolution && <div style={{ fontSize: '10px', color: '#888' }}><span style={{ fontWeight: 700 }}>Resolution:</span> {resolution}</div>}

            {/* Audio */}
            <div>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#888' }}>
                AUDIO {probing ? '...' : audioTracks.length > 0 ? `(${audioTracks.length})` : ''}
              </span>
              {audioTracks.length > 0 && (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {audioTracks.slice(0, 10).map((track, i) => (
                      <TagPill key={i} color="purple">
                        {getLangName(track.language)} {track.channels ? `(${track.channels}ch)` : ''}
                      </TagPill>
                    ))}
                  </div>
                  {audioTracks.length > 10 && (
                    <button
                      onClick={() => setShowAllAudio(true)}
                      style={{
                        background: 'rgba(98,37,255,0.2)',
                        border: '1px solid rgba(98,37,255,0.4)',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '9px',
                        color: '#a020f0',
                        cursor: 'pointer',
                        marginTop: '6px',
                        fontWeight: 700
                      }}
                    >
                      Show More +{audioTracks.length - 10}
                    </button>
                  )}
                </>
              )}
              {!probing && audioTracks.length === 0 && (
                <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>No audio info</div>
              )}
            </div>

            {/* Subtitles */}
            <div>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#888' }}>
                SUBTITLES {probing ? '...' : subtitleTracks.length > 0 ? `(${subtitleTracks.length})` : ''}
              </span>
              {subtitleTracks.length > 0 && (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {subtitleTracks.slice(0, 10).map((track, i) => (
                      <TagPill key={i} color="gray">{getLangName(track.language)}</TagPill>
                    ))}
                  </div>
                  {subtitleTracks.length > 10 && (
                    <button
                      onClick={() => setShowAllSubs(true)}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '9px',
                        color: '#ccc',
                        cursor: 'pointer',
                        marginTop: '6px',
                        fontWeight: 700
                      }}
                    >
                      Show More +{subtitleTracks.length - 10}
                    </button>
                  )}
                </>
              )}
              {!probing && subtitleTracks.length === 0 && (
                <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>No subtitles</div>
              )}
            </div>
          </div>
        </div>

        {/* ========== SERIES: SEASON TABS + EPISODES ========== */}
        {type === 'series' && seasons.length > 0 && (
          <div style={{ padding: '0 20px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Season tabs */}
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '8px', flexShrink: 0 }}>
              {seasons.map((s) => {
                const isActive = s.season_number === selectedSeason;
                const epCount = (episodes[String(s.season_number)] || []).length;
                return (
                  <button
                    key={s.season_number}
                    onClick={() => setSelectedSeason(s.season_number)}
                    style={{
                      background: isActive ? 'rgba(98,37,255,0.3)' : 'rgba(255,255,255,0.05)',
                      border: isActive ? '1px solid #6225ff' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      padding: '6px 12px',
                      color: isActive ? '#fff' : '#888',
                      fontSize: '9px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    Season {s.season_number} ({epCount})
                  </button>
                );
              })}
            </div>

            {/* Season info */}
            {currentSeasonInfo && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
                {currentSeasonInfo.air_date && <span style={{ fontSize: '8px', color: '#666' }}>📅 {currentSeasonInfo.air_date}</span>}
                {currentSeasonInfo.episode_count && <span style={{ fontSize: '8px', color: '#555' }}>{currentSeasonInfo.episode_count} episodes</span>}
              </div>
            )}

            {/* Episodes list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {currentSeasonEpisodes.map((ep) => {
                const epInfo = ep.info || {};
                const epDuration = epInfo.duration_secs ? formatDuration(epInfo.duration_secs) : (epInfo.duration || '');
                const epVideo = epInfo.video || null;
                const epSubs = epInfo.subtitles || [];

                return (
                  <div
                    key={ep.id || ep.episode_num}
                    onClick={() => handlePlayEpisode(ep)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#6225ff', minWidth: '24px', textAlign: 'center' }}>
                      {ep.episode_num}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ep.title || `Episode ${ep.episode_num}`}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                        {epDuration && <span style={{ fontSize: '8px', color: '#666' }}>{epDuration}</span>}
                        {epVideo && <span style={{ fontSize: '8px', color: '#555' }}>{epVideo.width}×{epVideo.height}</span>}
                        {epSubs.length > 0 && <span style={{ fontSize: '8px', color: '#555' }}>💬 {epSubs.length}</span>}
                      </div>
                    </div>
                    <span style={{ color: '#6225ff', fontSize: '12px', flexShrink: 0 }}>▶</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loading && (
          <div style={{ padding: '10px', textAlign: 'center', color: '#6225ff', fontSize: '11px', fontWeight: 700 }}>LOADING...</div>
        )}

        {/* Poster Overlay — uses cover_big for max quality */}
        {posterOverlay && (posterBig || poster) && (
          <div
            onClick={() => setPosterOverlay(false)}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.9)', zIndex: 99999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <img src={posterBig || poster} alt="" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '12px' }} />
          </div>
        )}

        {/* Audio Tracks Overlay */}
        {showAllAudio && (
          <div
            onClick={() => setShowAllAudio(false)}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.95)', zIndex: 99998,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px', cursor: 'pointer'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#111', border: '2px solid #6225ff', borderRadius: '12px',
                padding: '30px', maxWidth: '700px', width: '100%',
                maxHeight: '80vh', overflow: 'auto', cursor: 'default'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ color: '#6225ff', fontSize: '18px', fontWeight: 800, margin: 0 }}>
                  🔊 AUDIO TRACKS ({audioTracks.length})
                </h3>
                <button
                  onClick={() => setShowAllAudio(false)}
                  style={{
                    background: 'transparent', border: 'none', color: '#fff',
                    fontSize: '24px', cursor: 'pointer', padding: 0, lineHeight: 1
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {audioTracks.map((track, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(98,37,255,0.15)', border: '1px solid rgba(98,37,255,0.4)',
                      borderRadius: '6px', padding: '10px 14px', fontSize: '11px',
                      color: '#fff', fontWeight: 600
                    }}
                  >
                    {getLangName(track.language)} {track.channels ? `(${track.channels}ch)` : ''}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Subtitle Tracks Overlay */}
        {showAllSubs && (
          <div
            onClick={() => setShowAllSubs(false)}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.95)', zIndex: 99998,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px', cursor: 'pointer'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#111', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '12px',
                padding: '30px', maxWidth: '700px', width: '100%',
                maxHeight: '80vh', overflow: 'auto', cursor: 'default'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 800, margin: 0 }}>
                  💬 SUBTITLE TRACKS ({subtitleTracks.length})
                </h3>
                <button
                  onClick={() => setShowAllSubs(false)}
                  style={{
                    background: 'transparent', border: 'none', color: '#fff',
                    fontSize: '24px', cursor: 'pointer', padding: 0, lineHeight: 1
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {subtitleTracks.map((track, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '6px', padding: '10px 14px', fontSize: '11px',
                      color: '#ccc', fontWeight: 600
                    }}
                  >
                    {getLangName(track.language)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========== GRID VIEW ==========
  const Cell = ({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * COLUMN_COUNT + columnIndex;
    if (index >= items.length) return null;
    const item = items[index];
    
    // Placeholder during loading (null items from windowing)
    if (!item) {
      return (
        <div style={{ ...style, padding: '4px' }}>
          <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }} />
        </div>
      );
    }
    
    // ROBUST POSTER MAPPING: API vs SQLite compatibility
    const poster = item.cover || item.movie_image || item.logo || item.stream_icon || item.cover_big;
    
    // Déterminer si c'est la dernière row visible
    const totalRows = Math.ceil(items.length / COLUMN_COUNT);
    const isLastRow = rowIndex === totalRows - 1;

    return (
      <div
        style={{ ...style, padding: '4px', cursor: 'pointer' }}
        onClick={() => handleThumbnailClick(item)}
      >
        <div style={{
          width: '100%', height: '100%',
          borderRadius: isLastRow ? '6px 6px 12px 12px' : '6px',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column',
          transition: 'border-color 0.2s',
          position: 'relative',
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(98,37,255,0.5)'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
        >
          {poster ? (
            <img 
              src={poster} 
              alt="" 
              loading="lazy"
              style={{ width: '100%', flex: 1, objectFit: 'cover' }} 
              onError={(e) => { e.target.src = 'https://via.placeholder.com/150x220?text=No+Poster'; }}
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: '20px' }}>
              🎬
            </div>
          )}
          {/* Rating badge — top left (series only) */}
          {type === 'series' && item.rating && (
            <div style={{
              position: 'absolute', top: '6px', left: '6px',
              background: 'rgba(0,0,0,0.7)', borderRadius: '3px',
              padding: '1px 4px', fontSize: '8px', color: '#ffd700', fontWeight: 700,
            }}>
              ⭐ {item.rating}
            </div>
          )}
          <div style={{ padding: '6px 8px', flexShrink: 0 }}>
            <div style={{
              fontSize: '10px', fontWeight: 700, color: '#fff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {item.name || 'Untitled'}
            </div>
            {item.year && <div style={{ fontSize: '8px', color: '#555' }}>{item.year}</div>}
            {type === 'movies' && item.rating && <div style={{ fontSize: '8px', color: '#ffd700' }}>⭐ {item.rating}</div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        {totalCount > 0 ? (
          <InfiniteLoader
            isItemLoaded={isItemLoaded}
            itemCount={totalCount}
            loadMoreItems={loadMoreItems}
          >
            {({ onItemsRendered, ref: loaderRef }) => (
              <Grid
                ref={(grid) => {
                  gridRef.current = grid;
                  loaderRef(grid);
                }}
                columnCount={COLUMN_COUNT}
                columnWidth={ITEM_WIDTH}
                height={window.innerHeight}
                rowCount={ROW_COUNT}
                rowHeight={ITEM_HEIGHT}
                width={window.innerWidth - 280}
                onItemsRendered={(gridProps) => {
                  const indices = handleItemsRendered(gridProps);
                  onItemsRendered(indices);
                }}
              >
                {Cell}
              </Grid>
            )}
          </InfiniteLoader>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#444', fontSize: '11px' }}>
            {isLoadingMore ? 'Loading...' : 'Select a category'}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.forwardRef(OTTRight);
