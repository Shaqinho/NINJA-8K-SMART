import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';

// ============================================================================
// OTT RIGHT - Movies & Series Gallery
// 
// - Windowed grid (react-window FixedSizeGrid)
// - Movies: poster grid → detail with TMDB info, trailer, audio/subtitles
// - Series: poster grid → detail with seasons tabs, episodes list
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

const OTTRight = ({ 
  items = [], 
  sidebarTab = 'movies', 
  xtreamService, 
  videoRef, 
  onItemSelect,
  onClose,
  visible = false,
}, ref) => {
  const type = sidebarTab; // 'movies' or 'series'
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [probeData, setProbeData] = useState(null);
  const [probing, setProbing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [posterOverlay, setPosterOverlay] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [columnCount, setColumnCount] = useState(4); // Dynamic grid zoom
  const gridRef = useRef(null);

  // Grid layout — dynamic columns
  const COLUMN_COUNT = columnCount;
  const ITEM_WIDTH = Math.floor((window.innerWidth - 280) / COLUMN_COUNT);
  const ITEM_HEIGHT = Math.round(ITEM_WIDTH * 1.5);
  const ROW_COUNT = Math.ceil(items.length / COLUMN_COUNT);

  // Expose zoom methods to parent
  React.useImperativeHandle(ref, () => ({
    zoomIn: () => setColumnCount(prev => Math.max(3, prev - 1)),   // Spread → bigger
    zoomOut: () => setColumnCount(prev => Math.min(6, prev + 1)),  // Pinch → smaller
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
    setSelectedItem(item);
    setDetailData(null);
    setProbeData(null);
    setSelectedSeason(1);
    setPosterOverlay(false);

    setLoading(true);
    try {
      if (type === 'movies' && xtreamService) {
        const info = await xtreamService.getVodInfo(item.stream_id || item.id);
        setDetailData(info);
      } else if (type === 'series' && xtreamService) {
        const info = await xtreamService.getSeriesInfo(item.series_id || item.id);
        setDetailData(info);
      }
    } catch (e) {
      console.error('MediaGallery: Detail fetch failed:', e);
    } finally {
      setLoading(false);
    }

    // Probe stream (fire & forget)
    if (item.streamUrl && videoRef?.current?.probeStream) {
      setProbing(true);
      try {
        const tracks = await videoRef.current.probeStream(item.streamUrl);
        setProbeData(tracks);
      } catch (e) {
        console.error('MediaGallery: Probe failed:', e);
      } finally {
        setProbing(false);
      }
    }
  }, [type, xtreamService, videoRef]);

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

  // Extract audio tracks: probe > JSON fallback
  const getAudioTracks = useCallback((info) => {
    if (probeData?.audioTracks?.length > 0) {
      return probeData.audioTracks.map(t => {
        const lang = getLangName(t.language || t.name || 'unknown');
        const channels = t.channels ? `${t.channels === 6 ? '5.1' : t.channels === 2 ? 'Stereo' : `${t.channels}ch`}` : '';
        return channels ? `${lang} (${channels})` : lang;
      });
    }
    if (info?.audio?.tags?.language) {
      const lang = getLangName(info.audio.tags.language);
      const channels = info.audio.channels ? `${info.audio.channels === 6 ? '5.1' : info.audio.channels === 2 ? 'Stereo' : `${info.audio.channels}ch`}` : '';
      return channels ? [`${lang} (${channels})`] : [lang];
    }
    return [];
  }, [probeData]);

  // Extract subtitle tracks: JSON info > probe fallback
  const getSubtitleTracks = useCallback((info) => {
    if (info?.subtitles?.length > 0) return info.subtitles.map(s => getLangName(s.language));
    if (probeData?.subtitleTracks?.length > 0) return probeData.subtitleTracks.map(t => getLangName(t.language || t.name));
    return [];
  }, [probeData]);

  // Only render for movies/series tabs
  if (!visible || (sidebarTab !== 'movies' && sidebarTab !== 'series')) {
    return null;
  }

  // ========== LIVE DETAIL VIEW ==========
  if (selectedItem && type === 'live') {
    const channelId = selectedItem.stream_id || selectedItem.id;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', background: 'transparent' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '15px 20px 10px', flexShrink: 0, gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>{selectedItem.name}</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '9px', color: '#888', fontFamily: 'monospace' }}>#{selectedItem.num || '—'}</span>
              <span style={{ fontSize: '9px', color: '#6225ff', fontWeight: 700 }}>ID: {channelId}</span>
              {selectedItem.epgChannelId && <span style={{ fontSize: '9px', color: '#888' }}>EPG: {selectedItem.epgChannelId}</span>}
            </div>
          </div>
          <button onClick={handlePlay} style={{ background: 'linear-gradient(135deg, #6225ff, #8b5cf6)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: '14px', marginLeft: '2px' }}>▶</span>
          </button>
          <button onClick={handleBack} style={{ background: 'none', border: 'none', color: '#6225ff', fontSize: '18px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ padding: '0 20px 15px', display: 'flex', gap: '16px' }}>
          {selectedItem.logo && (
            <img src={selectedItem.logo} alt="" style={{ width: '120px', height: '60px', objectFit: 'contain', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} onError={(e) => { e.target.style.display = 'none'; }} />
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {selectedItem.epg_now && (
              <div>
                <span style={{ fontSize: '9px', fontWeight: 800, color: '#6225ff' }}>NOW</span>
                <div style={{ fontSize: '11px', color: '#fff', marginTop: '2px' }}>{selectedItem.epg_now}</div>
                {selectedItem.epg_progress > 0 && (
                  <div style={{ height: '2px', borderRadius: '1px', background: 'rgba(255,255,255,0.1)', marginTop: '4px', width: '100%' }}>
                    <div style={{ height: '100%', borderRadius: '1px', background: '#6225ff', width: `${Math.min(100, selectedItem.epg_progress)}%` }} />
                  </div>
                )}
              </div>
            )}
            {selectedItem.category && <div style={{ fontSize: '9px', color: '#666' }}>📁 {selectedItem.category}</div>}
            {selectedItem.tvArchive && <div style={{ fontSize: '9px', color: '#888' }}>📼 Catch-up: {selectedItem.tvArchiveDuration || '?'} days</div>}
          </div>
        </div>
      </div>
    );
  }

  // ========== MOVIES / SERIES DETAIL VIEW ==========
  if (selectedItem && (type === 'movies' || type === 'series')) {
    const info = detailData?.info || detailData?.movie_data || {};
    const poster = info.cover || info.movie_image || selectedItem.logo || selectedItem.cover;
    const posterBig = info.cover_big || poster;
    const title = info.name || selectedItem.name || 'Untitled';
    const plot = info.plot || info.description || selectedItem.plot || '';
    const cast = info.cast || selectedItem.cast || '';
    const director = info.director || selectedItem.director || '';
    const genre = info.genre || selectedItem.genre || '';
    const rating = info.rating || selectedItem.rating || '';
    const year = info.releasedate || info.release_date || selectedItem.releaseDate || selectedItem.year || '';
    const duration = info.duration || selectedItem.duration || '';
    const country = info.country || '';
    const trailer = info.youtube_trailer || '';
    const video = info.video || selectedItem.video || null;
    const lastModified = info.last_modified || selectedItem.lastModified || null;
    const episodeRunTime = info.episode_run_time || selectedItem.episodeRunTime || null;

    const audioTracks = getAudioTracks(info);
    const subtitleTracks = getSubtitleTracks(info);

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
          {trailer && (
            <button onClick={() => window.open(`https://www.youtube.com/watch?v=${trailer}`, '_blank')} style={{ background: 'rgba(255,0,0,0.2)', border: '1px solid rgba(255,0,0,0.4)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <span style={{ color: '#ff4444', fontSize: '10px', fontWeight: 800 }}>YT</span>
            </button>
          )}
          <button onClick={() => {/* TODO: toggle favorite */}} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ fontSize: '16px' }}>☆</span>
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

            {/* Audio */}
            <div>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#888' }}>
                AUDIO {probing ? '...' : audioTracks.length > 0 ? `(${audioTracks.length})` : ''}
              </span>
              {audioTracks.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                  {audioTracks.map((name, i) => <TagPill key={i} color="purple">{name}</TagPill>)}
                </div>
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                  {subtitleTracks.map((name, i) => <TagPill key={i} color="gray">{name}</TagPill>)}
                </div>
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
      </div>
    );
  }

  // ========== GRID VIEW ==========
  const Cell = ({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * COLUMN_COUNT + columnIndex;
    if (index >= items.length) return null;
    const item = items[index];
    const poster = item.logo || item.cover || item.stream_icon;

    return (
      <div
        style={{ ...style, padding: '4px', cursor: 'pointer' }}
        onClick={() => handleThumbnailClick(item)}
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
          {poster ? (
            <img src={poster} alt="" style={{ width: '100%', flex: 1, objectFit: 'cover' }} />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: '10px' }}>
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
        {items.length > 0 ? (
          <Grid
            ref={gridRef}
            columnCount={COLUMN_COUNT}
            columnWidth={ITEM_WIDTH}
            height={window.innerHeight}
            rowCount={ROW_COUNT}
            rowHeight={ITEM_HEIGHT}
            width={window.innerWidth - 280}
          >
            {Cell}
          </Grid>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#444', fontSize: '11px' }}>
            Select a category
          </div>
        )}
      </div>
    </div>
  );
};

export default React.forwardRef(OTTRight);
