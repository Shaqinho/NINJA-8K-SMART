import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import { FixedSizeGrid as Grid } from 'react-window';

// ============================================================================
// EPG SEARCH — In-Memory Smart Search with Cascading Filters
//
// All EPG data lives in React state. Every JSON field becomes a filter.
// No SQLite dependency — pure JS filtering on fetched results.
//
// Filters (AND logic, all combined):
//   TEXT    → search in title, channel_name, description
//   LANG    → filter by channel language prefix (FR, EN, AR...)
//   LIVE    → show only currently airing / show upcoming
//   TIME    → filter by time slot (20h-22h, etc.)
//   LIMIT   → number of programs per channel to fetch
//
// Flow: SELECT categories → CONFIRM → fetch EPG → filter in memory
// ============================================================================

// Extract language prefix from channel name (e.g. "FR| TF1 HD" → "FR")
const extractLang = (name) => {
  if (!name) return 'OTHER';
  const m = name.match(/^([A-Z]{2,3})[\s|:]/i);
  if (m) return m[1].toUpperCase();
  if (name.toUpperCase().startsWith('VIP')) return 'VIP';
  return 'OTHER';
};

// Normalize text for search (lowercase, no accents)
const normalize = (text) => {
  if (!text) return '';
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').trim();
};

// Common language filters
const LANG_OPTIONS = ['FR', 'EN', 'AR', 'ES', 'DE', 'TR', 'IT', 'PT', 'NL'];

// ============================================================================
// MEDIA GALLERY — Thumbnails grid + Detail views for Movies/Series/Live
// (merged from MediaGallery.jsx)
// ============================================================================

// Language code mapping (ISO 639-2/3 → display name)
const LANG_MAP = {
  fre: 'FRENCH', fra: 'FRENCH', fr: 'FRENCH',
  eng: 'ENGLISH', en: 'ENGLISH',
  ara: 'ARABIC', ar: 'ARABIC',
  spa: 'SPANISH', es: 'SPANISH',
  ger: 'GERMAN', deu: 'GERMAN', de: 'GERMAN',
  ita: 'ITALIAN', it: 'ITALIAN',
  por: 'PORTUGUESE', pt: 'PORTUGUESE',
  rus: 'RUSSIAN', ru: 'RUSSIAN',
  tur: 'TURKISH', tr: 'TURKISH',
  pol: 'POLISH', pl: 'POLISH',
  dut: 'DUTCH', nld: 'DUTCH', nl: 'DUTCH',
  jpn: 'JAPANESE', ja: 'JAPANESE',
  kor: 'KOREAN', ko: 'KOREAN',
  chi: 'CHINESE', zho: 'CHINESE', zh: 'CHINESE',
  hin: 'HINDI', hi: 'HINDI',
  und: 'UNDEFINED',
};

const getLangName = (code) => LANG_MAP[(code || '').toLowerCase()] || (code || 'UNKNOWN').toUpperCase();

// Format duration seconds → "1h35"
const formatDuration = (secs) => {
  if (!secs || !isFinite(secs)) return '';
  const s = Number(secs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? m.toString().padStart(2, '0') : ''}`;
  return `${m}min`;
};

// Format "Updated X days ago"
const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  const now = Date.now() / 1000;
  const ts = Number(timestamp);
  if (!ts || !isFinite(ts)) return '';
  const diffDays = Math.floor((now - ts) / 86400);
  if (diffDays < 1) return 'Updated today';
  if (diffDays === 1) return 'Updated yesterday';
  if (diffDays < 30) return `Updated ${diffDays} days ago`;
  if (diffDays < 365) return `Updated ${Math.floor(diffDays / 30)} months ago`;
  return `Updated ${Math.floor(diffDays / 365)} years ago`;
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

const OTTRight = ({ xtreamService, onChannelSelect, onSelectChannel, onClose, visible, currentChannel,
  // MediaGallery props
  sidebarTab = 'live', items = [], videoRef, onItemSelect, epgData = {},
}) => {
  // ========== PRESETS (localStorage) ==========
  const [presets, setPresets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ninja_epg_presets') || '[]'); }
    catch { return []; }
  });
  const [activePreset, setActivePreset] = useState(null);

  // ========== RAW DATA ==========
  const [rawResults, setRawResults] = useState([]); // Full fetched EPG results (unfiltered)

  // ========== FILTER STATES ==========
  const [searchQuery, setSearchQuery] = useState('');
  const [isLiveOnly, setIsLiveOnly] = useState(false);
  const [isNotLive, setIsNotLive] = useState(false);
  const [epgLimit, setEpgLimit] = useState(1);
  const [startTimeFilter, setStartTimeFilter] = useState(null);
  const [langFilters, setLangFilters] = useState([]); // e.g. ['FR', 'EN']
  const [showLangBar, setShowLangBar] = useState(false);

  // ========== CATEGORY SELECTION MODE ==========
  const [showCategorySelect, setShowCategorySelect] = useState(false);
  const [allCategories, setAllCategories] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [fetchingEpg, setFetchingEpg] = useState(false);
  const [fetchProgress, setFetchProgress] = useState('');

  // ========== PRESET UI ==========
  const [showPresetList, setShowPresetList] = useState(false);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');

  const savePresets = useCallback((newPresets) => {
    setPresets(newPresets);
    localStorage.setItem('ninja_epg_presets', JSON.stringify(newPresets));
  }, []);

  // Load categories
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

  const toggleCategorySelection = useCallback((catId) => {
    const id = String(catId);
    setSelectedCategoryIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  }, []);

  const toggleLangFilter = useCallback((lang) => {
    setLangFilters(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]);
  }, []);

  // ========== CONFIRM: Fetch EPG for selected categories ==========
  const handleConfirmSelection = useCallback(async () => {
    if (!xtreamService || selectedCategoryIds.length === 0) return;
    setFetchingEpg(true);
    setFetchProgress('Loading channels...');
    setShowCategorySelect(false);

    try {
      // Get streams for selected categories
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
            categoryId: catId,
            lang: extractLang(s.name),
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

      // Build results — store ALL available fields
      const newResults = [];
      allStreams.forEach(stream => {
        const epg = epgResults[stream.id];
        if (epg) {
          // If multiple programs per channel (limit > 1), epg might have .programs array
          const programs = epg.programs || [epg];
          programs.forEach((prog, idx) => {
            const title = prog.title || prog.epg_now || 'No program info';
            newResults.push({
              stream_id: stream.id,
              channel_name: stream.name,
              channel_logo: stream.logo,
              category_name: stream.categoryName,
              category_id: stream.categoryId,
              lang: stream.lang,
              title: title,
              title_normalized: normalize(title),
              description: prog.description || prog.epg_description || '',
              description_normalized: normalize(prog.description || prog.epg_description || ''),
              epg_start: prog.epg_start || prog.start || '',
              epg_end: prog.epg_end || prog.end || '',
              start_timestamp: prog.epg_start_timestamp || prog.startTimestamp || 0,
              end_timestamp: prog.epg_end_timestamp || prog.stopTimestamp || prog.endTimestamp || 0,
              progress: prog.progress || (idx === 0 ? (epg.progress || 0) : 0),
              is_live: 0, // will be calculated below
            });
          });
        }
      });

      // Calculate is_live
      const now = Math.floor(Date.now() / 1000);
      newResults.forEach(r => {
        if (r.start_timestamp && r.end_timestamp) {
          r.is_live = (r.start_timestamp <= now && r.end_timestamp > now) ? 1 : 0;
          if (r.is_live && !r.progress) {
            r.progress = Math.min(100, Math.max(0, Math.round(((now - r.start_timestamp) / (r.end_timestamp - r.start_timestamp)) * 100)));
          }
        } else if (r.progress > 0 && r.progress < 100) {
          r.is_live = 1;
        }
      });

      setRawResults(newResults);
      setFetchProgress(`${newResults.length} programs loaded`);
      navigator.vibrate?.(30);
    } catch (err) {
      console.error('EPG Fetch Error:', err);
      setFetchProgress('Error: ' + err.message);
    } finally {
      setFetchingEpg(false);
    }
  }, [xtreamService, selectedCategoryIds, allCategories, isNotLive, epgLimit]);

  // ========== PRESETS ==========
  const handleSavePreset = useCallback(() => {
    if (!presetName.trim() || selectedCategoryIds.length === 0) return;
    savePresets([...presets, { name: presetName.trim(), categoryIds: [...selectedCategoryIds] }]);
    setPresetName('');
    setShowSavePreset(false);
    navigator.vibrate?.(30);
  }, [presetName, selectedCategoryIds, presets, savePresets]);

  const handleLoadPreset = useCallback((preset) => {
    setSelectedCategoryIds(preset.categoryIds || []);
    setActivePreset(preset.name);
    setShowPresetList(false);
  }, []);

  const handleDeletePreset = useCallback((index) => {
    const newPresets = presets.filter((_, i) => i !== index);
    savePresets(newPresets);
    if (newPresets.length === 0) setActivePreset(null);
  }, [presets, savePresets]);

  // Auto-confirm when preset is loaded
  useEffect(() => {
    if (activePreset && selectedCategoryIds.length > 0 && !fetchingEpg && rawResults.length === 0) {
      handleConfirmSelection();
    }
  }, [activePreset, selectedCategoryIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // ========== CASCADING FILTERS (all AND) ==========
  const displayResults = useMemo(() => {
    let items = rawResults;

    // TEXT filter — search in title, channel_name, description
    if (searchQuery.trim()) {
      const q = normalize(searchQuery);
      items = items.filter(r =>
        r.title_normalized.includes(q) ||
        (r.channel_name || '').toLowerCase().includes(q) ||
        r.description_normalized.includes(q)
      );
    }

    // LANG filter
    if (langFilters.length > 0) {
      items = items.filter(r => langFilters.includes(r.lang));
    }

    // LIVE ONLY filter
    if (isLiveOnly) {
      items = items.filter(r => r.is_live === 1);
    }

    // IS NOT LIVE filter (show upcoming only)
    if (isNotLive) {
      items = items.filter(r => r.is_live === 0);
    }

    // TIME SLOT filter
    if (startTimeFilter !== null) {
      items = items.filter(r => {
        const startStr = r.epg_start;
        if (!startStr) return false;
        const hour = parseInt(startStr.split(':')[0], 10);
        return !isNaN(hour) && hour >= startTimeFilter && hour < startTimeFilter + 2;
      });
    }

    // Sort: live first, then by start time
    items.sort((a, b) => {
      if (a.is_live !== b.is_live) return b.is_live - a.is_live;
      return (a.start_timestamp || 0) - (b.start_timestamp || 0);
    });

    return items;
  }, [rawResults, searchQuery, langFilters, isLiveOnly, isNotLive, startTimeFilter]);

  // ========== AVAILABLE LANGUAGES (from fetched data) ==========
  const availableLangs = useMemo(() => {
    const counts = {};
    rawResults.forEach(r => {
      counts[r.lang] = (counts[r.lang] || 0) + 1;
    });
    // Sort by count desc, keep only langs that exist
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([lang, count]) => ({ lang, count }));
  }, [rawResults]);

  // ========== ACTIVE FILTERS COUNT ==========
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (langFilters.length > 0) count++;
    if (isLiveOnly) count++;
    if (isNotLive) count++;
    if (startTimeFilter !== null) count++;
    return count;
  }, [searchQuery, langFilters, isLiveOnly, isNotLive, startTimeFilter]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setLangFilters([]);
    setIsLiveOnly(false);
    setIsNotLive(false);
    setStartTimeFilter(null);
  }, []);

  // ========== RESULT ROW ==========
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
          const ch = { stream_id: prog.stream_id, id: prog.stream_id, name: prog.channel_name, logo: prog.channel_logo };
          (onChannelSelect || onSelectChannel)?.(ch);
          navigator.vibrate?.(30);
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        {/* Logo */}
        <div style={{ width: '45px', height: '30px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {prog.channel_logo && (
            <img src={prog.channel_logo} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
          )}
        </div>
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {prog.title}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '1px' }}>
            <span style={{ fontSize: '10px', color: '#6225ff', fontWeight: 600 }}>
              {prog.epg_start || '--:--'}
            </span>
            <span style={{ fontSize: '9px', color: '#888' }}>•</span>
            <span style={{ fontSize: '10px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {prog.channel_name}
            </span>
            <span style={{ fontSize: '8px', color: '#555' }}>
              {prog.category_name}
            </span>
          </div>
        </div>
        {/* Lang badge */}
        <span style={{ fontSize: '7px', fontWeight: 800, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
          {prog.lang}
        </span>
        {/* Progress bar */}
        {prog.progress > 0 && (
          <div style={{ width: '40px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }}>
            <div style={{ height: '100%', borderRadius: '2px', background: '#6225ff', width: `${Math.min(100, prog.progress)}%` }} />
          </div>
        )}
        {/* Live dot */}
        {prog.is_live === 1 && (
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff4b4b', boxShadow: '0 0 8px #ff4b4b', flexShrink: 0 }} />
        )}
      </div>
    );
  };

  // ============================================================================
  // MEDIA GALLERY STATE (movies/series tabs)
  // ============================================================================
  const [mgSelectedItem, setMgSelectedItem] = useState(null);
  const [mgDetailData, setMgDetailData] = useState(null);
  const [mgProbeData, setMgProbeData] = useState(null);
  const [mgProbing, setMgProbing] = useState(false);
  const [mgLoading, setMgLoading] = useState(false);
  const [mgPosterOverlay, setMgPosterOverlay] = useState(false);
  const [mgSelectedSeason, setMgSelectedSeason] = useState(1);
  const mgGridRef = useRef(null);

  // Grid layout — responsive columns
  const MG_COLUMN_COUNT = useMemo(() => {
    const w = window.innerWidth - 280;
    if (w < 500) return 3;
    if (w < 800) return 4;
    return 6;
  }, []);
  const MG_ITEM_WIDTH = Math.floor((window.innerWidth - 280) / MG_COLUMN_COUNT);
  const MG_ITEM_HEIGHT = Math.round(MG_ITEM_WIDTH * 1.5);
  const MG_ROW_COUNT = Math.ceil(items.length / MG_COLUMN_COUNT);

  // Reset on items change
  useEffect(() => {
    setMgSelectedItem(null);
    setMgDetailData(null);
    setMgProbeData(null);
    setMgSelectedSeason(1);
  }, [items]);

  // Fetch detail info + probe stream
  const handleMgThumbnailClick = useCallback(async (item) => {
    setMgSelectedItem(item);
    setMgDetailData(null);
    setMgProbeData(null);
    setMgSelectedSeason(1);
    setMgPosterOverlay(false);

    setMgLoading(true);
    try {
      if (sidebarTab === 'movies' && xtreamService) {
        const info = await xtreamService.getVodInfo(item.stream_id || item.id);
        setMgDetailData(info);
      } else if (sidebarTab === 'series' && xtreamService) {
        const info = await xtreamService.getSeriesInfo(item.series_id || item.id);
        setMgDetailData(info);
      }
    } catch (e) {
      console.error('OTTRight MediaGallery: Detail fetch failed:', e);
    } finally {
      setMgLoading(false);
    }

    // Probe stream (fire & forget)
    if (item.streamUrl && videoRef?.current?.probeStream) {
      setMgProbing(true);
      try {
        const tracks = await videoRef.current.probeStream(item.streamUrl);
        setMgProbeData(tracks);
      } catch (e) {
        console.error('OTTRight MediaGallery: Probe failed:', e);
      } finally {
        setMgProbing(false);
      }
    }
  }, [sidebarTab, xtreamService, videoRef]);

  const handleMgBack = useCallback(() => {
    setMgSelectedItem(null);
    setMgDetailData(null);
    setMgProbeData(null);
    setMgPosterOverlay(false);
  }, []);

  const handleMgPlay = useCallback(() => {
    if (mgSelectedItem) onItemSelect?.(mgSelectedItem);
  }, [mgSelectedItem, onItemSelect]);

  // Play a specific episode
  const handleMgPlayEpisode = useCallback((episode) => {
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

  // Extract audio tracks: JSON info > probe fallback
  const getMgAudioTracks = useCallback((info) => {
    if (mgProbeData?.audioTracks?.length > 0) return mgProbeData.audioTracks.map(t => getLangName(t.language || t.name));
    if (info?.audio) return [`${getLangName(info.audio.codec_name || '')} (${info.audio.channels || '?'}ch)`];
    return [];
  }, [mgProbeData]);

  // Extract subtitle tracks: JSON info > probe fallback
  const getMgSubtitleTracks = useCallback((info) => {
    if (info?.subtitles?.length > 0) return info.subtitles.map(s => getLangName(s.language));
    if (mgProbeData?.subtitleTracks?.length > 0) return mgProbeData.subtitleTracks.map(t => getLangName(t.language || t.name));
    return [];
  }, [mgProbeData]);

  if (visible === false) return null;

  // ============================================================================
  // MEDIA GALLERY RENDER (movies/series tabs)
  // ============================================================================
  if (sidebarTab === 'movies' || sidebarTab === 'series') {
    const mgType = sidebarTab;

    // ========== LIVE DETAIL VIEW (from MediaGallery) ==========
    if (mgSelectedItem && mgType === 'live') {
      const channelId = mgSelectedItem.stream_id || mgSelectedItem.id;
      const epg = epgData[channelId] || epgData[String(channelId)];

      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', background: 'rgba(0,0,0,0.75)' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '15px 20px 10px', flexShrink: 0, gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>{mgSelectedItem.name}</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '9px', color: '#888', fontFamily: 'monospace' }}>#{mgSelectedItem.num || '—'}</span>
                <span style={{ fontSize: '9px', color: '#6225ff', fontWeight: 700 }}>ID: {channelId}</span>
                {mgSelectedItem.epgChannelId && <span style={{ fontSize: '9px', color: '#888' }}>EPG: {mgSelectedItem.epgChannelId}</span>}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // ========== MOVIE/SERIES DETAIL VIEW ==========
    if (mgSelectedItem && (mgType === 'movies' || mgType === 'series')) {
      const info = mgDetailData?.info || mgDetailData || {};
      const poster = info.cover || info.movie_image || mgSelectedItem.logo || mgSelectedItem.cover || mgSelectedItem.stream_icon || '';
      const posterBig = info.cover_big || info.movie_image || poster;
      const backdrop = info.backdrop_path?.[0] ? `https://image.tmdb.org/t/p/w780${info.backdrop_path[0]}` : null;
      const title = info.name || info.title || mgSelectedItem.name || '';
      const year = info.releasedate ? info.releasedate.substring(0, 4) : (info.year || mgSelectedItem.year || '');
      const rating = info.rating || info.rating_5based ? `${(info.rating_5based * 2).toFixed(1)}/10` : (mgSelectedItem.rating || '');
      const genre = info.genre || mgSelectedItem.genre || '';
      const plot = info.plot || info.description || '';
      const director = info.director || '';
      const cast = info.cast || info.actors || '';
      const duration = info.duration_secs ? formatDuration(info.duration_secs) : (info.duration || '');
      const lastModified = info.last_modified ? formatTimeAgo(info.last_modified) : '';

      // Video info
      const videoInfo = info.video || null;
      const resolution = videoInfo ? `${videoInfo.width || '?'}×${videoInfo.height || '?'}` : '';
      const codec = videoInfo?.codec_name || '';

      // Audio & subtitle tracks
      const audioTracks = getMgAudioTracks(info);
      const subtitleTracks = getMgSubtitleTracks(info);

      // Series-specific
      const seasons = mgDetailData?.seasons || [];
      const episodes = mgDetailData?.episodes || {};
      const currentSeasonInfo = seasons.find(s => s.season_number === mgSelectedSeason);
      const currentSeasonEpisodes = episodes[String(mgSelectedSeason)] || [];

      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', background: 'rgba(0,0,0,0.75)' }}>
          {/* Header with back button + poster + info */}
          <div style={{ padding: '15px 20px 10px', flexShrink: 0 }}>
            {/* Back button */}
            <button onClick={handleMgBack} style={{ background: 'none', border: 'none', color: '#888', fontSize: '11px', cursor: 'pointer', padding: '4px 0', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              Back
            </button>

            <div style={{ display: 'flex', gap: '14px' }}>
              {/* Poster thumbnail — tap for full overlay */}
              {poster && (
                <div
                  onClick={() => setMgPosterOverlay(true)}
                  style={{ width: '80px', flexShrink: 0, cursor: 'pointer', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <img src={poster} alt="" style={{ width: '100%', objectFit: 'cover' }} />
                </div>
              )}

              {/* Title + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{title}</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {year && <TagPill>{year}</TagPill>}
                  {rating && <TagPill>⭐ {rating}</TagPill>}
                  {duration && <TagPill>{duration}</TagPill>}
                  {resolution && <TagPill color="gray">{resolution}</TagPill>}
                  {codec && <TagPill color="gray">{codec}</TagPill>}
                </div>
                {genre && <div style={{ fontSize: '9px', color: '#888', marginTop: '6px' }}>{genre}</div>}
                {lastModified && <div style={{ fontSize: '8px', color: '#555', marginTop: '2px' }}>{lastModified}</div>}

                {/* Play button */}
                {mgType === 'movies' && (
                  <button onClick={handleMgPlay} style={{
                    marginTop: '10px', background: '#6225ff', border: 'none', borderRadius: '6px',
                    padding: '8px 20px', color: '#fff', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    PLAY
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Plot */}
          {plot && (
            <div style={{ padding: '0 20px 10px', fontSize: '10px', color: '#999', lineHeight: 1.5 }}>{plot}</div>
          )}

          {/* Director / Cast */}
          {(director || cast) && (
            <div style={{ padding: '0 20px 10px', fontSize: '9px', color: '#666' }}>
              {director && <div>Director: {director}</div>}
              {cast && <div style={{ marginTop: '2px' }}>Cast: {cast}</div>}
            </div>
          )}

          {/* Audio & Subtitles */}
          {(audioTracks.length > 0 || subtitleTracks.length > 0) && (
            <div style={{ padding: '0 20px 10px' }}>
              {audioTracks.length > 0 && (
                <div style={{ marginBottom: '4px' }}>
                  <span style={{ fontSize: '8px', color: '#555', fontWeight: 700, marginRight: '6px' }}>🔊 AUDIO</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {audioTracks.map((name, i) => <TagPill key={i}>{name}</TagPill>)}
                  </div>
                </div>
              )}
              {subtitleTracks.length > 0 && (
                <div>
                  <span style={{ fontSize: '8px', color: '#555', fontWeight: 700, marginRight: '6px' }}>💬 SUBS</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {subtitleTracks.map((name, i) => <TagPill key={i} color="gray">{name}</TagPill>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== SERIES: SEASON TABS + EPISODES ========== */}
          {mgType === 'series' && seasons.length > 0 && (
            <div style={{ padding: '0 20px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {/* Season tabs */}
              <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '8px', flexShrink: 0 }}>
                {seasons.map((s) => {
                  const isActive = s.season_number === mgSelectedSeason;
                  const epCount = (episodes[String(s.season_number)] || []).length;
                  return (
                    <button
                      key={s.season_number}
                      onClick={() => setMgSelectedSeason(s.season_number)}
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
                      onClick={() => handleMgPlayEpisode(ep)}
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

          {mgLoading && (
            <div style={{ padding: '10px', textAlign: 'center', color: '#6225ff', fontSize: '11px', fontWeight: 700 }}>LOADING...</div>
          )}

          {/* Poster Overlay — uses cover_big for max quality */}
          {mgPosterOverlay && (posterBig || poster) && (
            <div
              onClick={() => setMgPosterOverlay(false)}
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
        </div>
      );
    }

    // ========== GRID VIEW (movies/series) ==========
    const MgCell = ({ columnIndex, rowIndex, style }) => {
      const index = rowIndex * MG_COLUMN_COUNT + columnIndex;
      if (index >= items.length) return null;
      const item = items[index];
      const cellPoster = item.logo || item.cover || item.stream_icon;

      return (
        <div
          style={{ ...style, padding: '4px', cursor: 'pointer' }}
          onClick={() => handleMgThumbnailClick(item)}
        >
          <div style={{
            width: '100%', height: '100%',
            borderRadius: '6px', overflow: 'hidden',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: 'column',
            transition: 'border-color 0.2s',
            position: 'relative',
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(98,37,255,0.5)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
          >
            {cellPoster ? (
              <img src={cellPoster} alt="" style={{ width: '100%', flex: 1, objectFit: 'cover' }} />
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: '10px' }}>
                🎬
              </div>
            )}
            {/* Rating badge — top left (series only) */}
            {mgType === 'series' && item.rating && (
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
              {mgType === 'movies' && item.rating && <div style={{ fontSize: '8px', color: '#ffd700' }}>⭐ {item.rating}</div>}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(0,0,0,0.75)' }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          {items.length > 0 ? (
            <Grid
              ref={mgGridRef}
              columnCount={MG_COLUMN_COUNT}
              columnWidth={MG_ITEM_WIDTH}
              height={window.innerHeight}
              rowCount={MG_ROW_COUNT}
              rowHeight={MG_ITEM_HEIGHT}
              width={window.innerWidth - 280}
            >
              {MgCell}
            </Grid>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#444', fontSize: '11px' }}>
              Select a category
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // EPG SEARCH RENDER (live tab — original code below)
  // ============================================================================

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(0,0,0,0.75)' }}>
      {/* ========== HEADER ========== */}
      <div style={{ padding: '25px 20px 15px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>

        {/* ========== CURRENT CHANNEL INFO (default view) ========== */}
        {currentChannel && !searchQuery && rawResults.length === 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            marginBottom: '12px', padding: '10px',
            background: 'rgba(98,37,255,0.1)',
            border: '1px solid rgba(98,37,255,0.25)',
            borderRadius: '8px',
          }}>
            {/* Channel logo */}
            {currentChannel.logo && (
              <div style={{
                width: '60px', height: '36px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', borderRadius: '4px',
              }}>
                <img
                  src={currentChannel.logo}
                  alt=""
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            )}
            {/* Channel name + EPG now */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '13px', fontWeight: 700, color: '#fff',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {currentChannel.name}
              </div>
              {currentChannel.epg_now && (
                <div style={{
                  fontSize: '11px', color: '#a78bfa', marginTop: '2px',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  <span style={{
                    fontSize: '8px', fontWeight: 700, color: '#fff',
                    background: '#e53e3e', borderRadius: '2px',
                    padding: '1px 4px', marginRight: '6px',
                  }}>NOW</span>
                  {currentChannel.epg_now}
                </div>
              )}
              {currentChannel.epg_next && (
                <div style={{
                  fontSize: '10px', color: '#666', marginTop: '2px',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  <span style={{
                    fontSize: '8px', fontWeight: 600, color: '#888',
                    marginRight: '6px',
                  }}>NEXT</span>
                  {currentChannel.epg_next}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search input */}
        <input
          type="text"
          placeholder="Search title, channel, description..."
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

        {/* Controls Row 1: Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* LIVE ONLY toggle */}
            <button
              onClick={() => { setIsLiveOnly(!isLiveOnly); if (!isLiveOnly) setIsNotLive(false); }}
              style={{
                background: isLiveOnly ? 'rgba(255,75,75,0.3)' : 'rgba(255,255,255,0.06)',
                border: isLiveOnly ? '1px solid #ff4b4b' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px', color: isLiveOnly ? '#ff4b4b' : '#888', fontSize: '9px', fontWeight: 800, padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              🔴 LIVE
            </button>

            {/* NOT LIVE toggle */}
            <button
              onClick={() => { setIsNotLive(!isNotLive); if (!isNotLive) setIsLiveOnly(false); }}
              style={{
                background: isNotLive ? 'rgba(98,37,255,0.3)' : 'rgba(255,255,255,0.06)',
                border: isNotLive ? '1px solid #6225ff' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px', color: isNotLive ? '#fff' : '#888', fontSize: '9px', fontWeight: 800, padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              UPCOMING
            </button>

            {/* EPG Limit */}
            <select
              value={epgLimit}
              onChange={(e) => setEpgLimit(Number(e.target.value))}
              style={{
                background: 'rgba(98,37,255,0.2)', border: '1px solid #6225ff',
                borderRadius: '4px', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '4px 6px',
                cursor: 'pointer', outline: 'none',
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
                background: startTimeFilter !== null ? 'rgba(98, 37, 255, 0.4)' : 'rgba(255,255,255,0.06)',
                border: startTimeFilter !== null ? '1px solid #6225ff' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px', color: startTimeFilter !== null ? '#fff' : '#888', fontSize: '9px', fontWeight: 800, padding: '4px 12px',
                cursor: 'pointer',
              }}
            >
              {startTimeFilter !== null ? `${startTimeFilter}h-${startTimeFilter + 2}h` : '⏰ TIME'}
            </button>

            {/* LANG toggle */}
            <button
              onClick={() => setShowLangBar(!showLangBar)}
              style={{
                background: langFilters.length > 0 ? 'rgba(98, 37, 255, 0.4)' : 'rgba(255,255,255,0.06)',
                border: langFilters.length > 0 ? '1px solid #6225ff' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px', color: langFilters.length > 0 ? '#fff' : '#888', fontSize: '9px', fontWeight: 800, padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              🌐 LANG {langFilters.length > 0 ? `(${langFilters.length})` : ''}
            </button>

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                style={{
                  background: 'rgba(255,75,75,0.15)', border: '1px solid rgba(255,75,75,0.3)',
                  borderRadius: '4px', color: '#ff4b4b', fontSize: '8px', fontWeight: 800, padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                ✕ CLEAR ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Right side: PRESETS + SELECT */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => { setShowPresetList(!showPresetList); setShowCategorySelect(false); setShowSavePreset(false); }}
              style={{
                background: showPresetList ? 'rgba(98, 37, 255, 0.4)' : 'rgba(98, 37, 255, 0.2)',
                border: '1px solid #6225ff', borderRadius: '4px', color: '#fff', fontSize: '9px', fontWeight: 800, padding: '4px 12px',
                cursor: 'pointer',
              }}
            >
              PRESETS ({presets.length})
            </button>
            <button
              onClick={() => { setShowCategorySelect(!showCategorySelect); setShowPresetList(false); setShowSavePreset(false); if (!showCategorySelect) loadCategories(); }}
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

        {/* LANG BAR — shown when toggled */}
        {showLangBar && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
            {/* Known languages first, then others from data */}
            {[...LANG_OPTIONS, ...availableLangs.filter(l => !LANG_OPTIONS.includes(l.lang)).map(l => l.lang)].map(lang => {
              const active = langFilters.includes(lang);
              const data = availableLangs.find(l => l.lang === lang);
              const count = data?.count || 0;
              if (count === 0 && !active) return null; // Hide langs not in data
              return (
                <button
                  key={lang}
                  onClick={() => toggleLangFilter(lang)}
                  style={{
                    background: active ? 'rgba(98,37,255,0.4)' : 'rgba(255,255,255,0.05)',
                    border: active ? '1px solid #6225ff' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '3px', padding: '3px 8px', fontSize: '8px', fontWeight: 700,
                    color: active ? '#fff' : '#666', cursor: 'pointer',
                  }}
                >
                  {lang} {count > 0 ? `(${count})` : ''}
                </button>
              );
            })}
          </div>
        )}

        {/* Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <div style={{ fontSize: '9px', color: fetchingEpg ? '#6225ff' : '#555', fontWeight: 700 }}>
            {fetchingEpg ? fetchProgress : activePreset ? `Preset: ${activePreset}` : ''}
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 800 }}>
            {displayResults.length}{rawResults.length !== displayResults.length ? ` / ${rawResults.length}` : ''} RESULTS
          </div>
        </div>
      </div>

      {/* ========== PRESET LIST ========== */}
      {showPresetList && (
        <div style={{ maxHeight: '150px', overflow: 'auto', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '8px 20px' }}>
          {presets.length === 0 ? (
            <div style={{ fontSize: '10px', color: '#666', textAlign: 'center', padding: '10px' }}>No presets saved</div>
          ) : presets.map((preset, idx) => (
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
          ))}
        </div>
      )}

      {/* ========== CATEGORY SELECTION ========== */}
      {showCategorySelect && (
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', maxHeight: 'calc(100vh - 280px)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ maxHeight: '200px', overflow: 'auto', padding: '8px 20px', flex: '1 1 auto' }}>
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
          <div style={{ display: 'flex', gap: '8px', padding: '8px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
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
                  {rawResults.length > 0 && displayResults.length === 0
                    ? 'No results match current filters'
                    : selectedCategoryIds.length > 0
                      ? 'Press CONFIRM to fetch EPG'
                      : 'Select categories to start'}
                </div>
                <div style={{ fontSize: '9px', color: '#444', marginTop: '4px' }}>
                  {rawResults.length > 0 && displayResults.length === 0
                    ? 'Try adjusting your filters or press CLEAR'
                    : 'Use SELECT to pick folders, or load a PRESET'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default OTTRight;
