import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { libVLC } from './libVLC';
import { insertProgramsBatch } from '../../database/ProgramQueries';
import ProbeService from '../../services/ProbeService';
import { getLangName } from '../../services/ProbeService';

// ============================================================================
// OTT PLAYER — Column 3: Player + EPG + VOD/Series detail
//
// LIVE:    libVLC player + controls + EPG bar (NOW/NEXT)
// MOVIES:  Detail view (poster, synopsis, probe audio/subs, PLAY button)
// SERIES:  Detail view (seasons tabs, episodes list, PLAY button)
// ============================================================================

const CSS = {
  accent: '#6225ff',
  gradient: 'linear-gradient(135deg, #6225FF 0%, #B85CFF 100%)',
  divider: 'rgba(255, 255, 255, 0.06)',
  textDim: 'rgba(255, 255, 255, 0.5)',
  textMuted: 'rgba(255, 255, 255, 0.3)',
  green: '#10b981',
  red: '#ef4444',
};

// Format time
const formatEpgTime = (ts) => {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const formatDuration = (secs) => {
  if (!secs || !isFinite(secs)) return '';
  const s = Number(secs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? m.toString().padStart(2, '0') : ''}`;
  return `${m}min`;
};

// Decode Base64 with proper UTF-8 support (accents, special chars)
const decodeBase64UTF8 = (str) => {
  if (!str) return '';
  try {
    const binaryStr = atob(str);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return str;
  }
};

// Tag pill
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


const OTTPlayer = memo(({
  selectedChannel,
  isPlaying,
  onTogglePlay,
  activeTab,
  xtreamService,
  favorites = {},
  onToggleFavorite,
  liveChannels = [],
  filteredItems = [],
  onChannelChange,
}) => {

  // ========== PLAYER STATE ==========
  const [showControls, setShowControls] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoAreaRef = useRef(null);
  const controlsTimerRef = useRef(null);

  // ========== LIBVLC NATIVE POSITION ==========
  const updateNativePosition = useCallback(() => {
    if (!videoAreaRef.current) return;
    const r = videoAreaRef.current.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      libVLC.setPosition(Math.round(r.top), Math.round(r.left), Math.round(r.width), Math.round(r.height));
    }
  }, []);

  const setFullscreenPosition = useCallback(() => {
    const w = window.innerWidth || screen.width;
    const h = window.innerHeight || screen.height;
    libVLC.setPosition(0, 0, w, h);
  }, []);

  useEffect(() => {
    if (!videoAreaRef.current) return;
    const timer = setTimeout(updateNativePosition, 150);
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (!isFullscreen) {
          setTimeout(updateNativePosition, 50);
          setTimeout(updateNativePosition, 150);
        }
      });
      resizeObserver.observe(videoAreaRef.current);
    }
    return () => {
      clearTimeout(timer);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [updateNativePosition, isFullscreen]);

  // ========== EPG STATE ==========
  const [epgPrograms, setEpgPrograms] = useState([]);
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const [loadingDayEpg, setLoadingDayEpg] = useState(false);

  // ========== VOD/SERIES DETAIL STATE ==========
  const [detailData, setDetailData] = useState(null);
  const [probeData, setProbeData] = useState(null);
  const [probing, setProbing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [posterOverlay, setPosterOverlay] = useState(false);
  const [showAllAudio, setShowAllAudio] = useState(false);
  const [showAllSubs, setShowAllSubs] = useState(false);

  // ========== BUILD STREAM URL ==========
  const getStreamUrl = useCallback((item) => {
    if (!item || !xtreamService) return null;
    const streamId = item.stream_id || item.id;
    if (activeTab === 'live') {
      return `${xtreamService.server}/live/${xtreamService.username}/${xtreamService.password}/${streamId}.m3u8`;
    } else if (activeTab === 'movies') {
      const ext = item.container_extension || 'mp4';
      return `${xtreamService.server}/movie/${xtreamService.username}/${xtreamService.password}/${streamId}.${ext}`;
    }
    return null;
  }, [xtreamService, activeTab]);

  // ========== PLAY CHANNEL VIA LIBVLC ==========
  useEffect(() => {
    if (!selectedChannel || !isPlaying) return;
    const url = getStreamUrl(selectedChannel);
    if (!url) return;

    const play = async () => {
      try {
        await libVLC.play(url);
        console.log('[OTTPlayer] Playing:', selectedChannel.name);
        setTimeout(updateNativePosition, 200);
        setTimeout(updateNativePosition, 500);
      } catch (err) {
        console.error('[OTTPlayer] Play failed:', err);
      }
    };
    play();

    return () => {
      // Don't stop on cleanup — let it keep playing when switching UI
    };
  }, [selectedChannel, isPlaying, getStreamUrl]);

  // ========== LOAD EPG FOR LIVE CHANNEL ==========
  useEffect(() => {
    if (activeTab !== 'live' || !selectedChannel || !xtreamService) {
      setEpgPrograms([]);
      setShowFullSchedule(false);
      return;
    }

    const channelId = selectedChannel.stream_id || selectedChannel.id;
    if (!channelId) return;

    xtreamService.getShortEPG(channelId, 4).then(data => {
      const listings = Array.isArray(data) ? data : [];
      const now = Math.floor(Date.now() / 1000);
      const programs = listings.slice(0, 4).map(p => ({
        title: p.title || '',
        description: p.description || '',
        start: p.start || '',
        end: p.end || '',
        start_time: p.startTimestamp || 0,
        end_time: p.stopTimestamp || 0,
        is_currently_live: (p.startTimestamp <= now && p.stopTimestamp > now) ? 1 : 0,
        progress: (p.startTimestamp <= now && p.stopTimestamp > now && p.stopTimestamp > p.startTimestamp)
          ? Math.min(100, Math.round(((now - p.startTimestamp) / (p.stopTimestamp - p.startTimestamp)) * 100)) : 0,
      }));
      setEpgPrograms(programs);

      // Save to DB
      if (programs.length > 0) {
        const epgForInsert = {};
        epgForInsert[channelId] = programs.map(p => ({ title: p.title, start: p.start, end: p.end, startTimestamp: p.start_time, stopTimestamp: p.end_time, description: p.description }));
        insertProgramsBatch(epgForInsert).catch(() => {});
      }
    }).catch(() => setEpgPrograms([]));
  }, [selectedChannel, activeTab, xtreamService]);

  // ========== LOAD FULL DAY EPG ==========
  const loadFullDayEpg = useCallback(async () => {
    if (!selectedChannel || !xtreamService) return;
    const streamId = selectedChannel.stream_id || selectedChannel.id;
    if (!streamId) return;
    setLoadingDayEpg(true);
    try {
      const rawData = await xtreamService.getFullEPG(streamId);
      const now = Math.floor(Date.now() / 1000);
      const listings = rawData?.epg_listings || [];
      const programs = listings.map(p => {
        const st = parseInt(p.start_timestamp) || 0;
        const en = parseInt(p.stop_timestamp) || 0;
        const isLive = (st <= now && en > now) ? 1 : 0;
        return {
          title: decodeBase64UTF8(p.title),
          description: decodeBase64UTF8(p.description),
          start: p.start || '', end: p.end || '',
          start_time: st, end_time: en,
          is_currently_live: isLive,
          progress: isLive && en > st ? Math.min(100, Math.round(((now - st) / (en - st)) * 100)) : 0,
        };
      });
      setEpgPrograms(programs);
      if (programs.length > 0) {
        const epgForInsert = {};
        epgForInsert[streamId] = programs.map(p => ({ title: p.title, start: p.start, end: p.end, startTimestamp: p.start_time, stopTimestamp: p.end_time, description: p.description }));
        insertProgramsBatch(epgForInsert).catch(() => {});
      }
    } catch (err) { console.warn('Full EPG failed:', err); }
    finally { setLoadingDayEpg(false); setShowFullSchedule(true); }
  }, [selectedChannel, xtreamService]);

  // ========== LOAD VOD/SERIES DETAIL ==========
  useEffect(() => {
    if (activeTab === 'live' || !selectedChannel || !xtreamService) {
      setDetailData(null); setProbeData(null);
      return;
    }

    const streamId = selectedChannel.stream_id || selectedChannel.id;
    setDetailData(null); setProbeData(null); setSelectedSeason(1);
    setLoading(true); setProbing(true);

    (async () => {
      try {
        if (activeTab === 'movies') {
          const credentials = { server: xtreamService.server, username: xtreamService.username, password: xtreamService.password };
          const [details, probeResult] = await Promise.all([
            xtreamService.getVodInfo(streamId),
            ProbeService.probeTracks(credentials, selectedChannel, 'vod'),
          ]);
          setDetailData(details);
          if (probeResult.success) {
            setProbeData({ audioTracks: probeResult.audioTracks, subtitleTracks: probeResult.subtitleTracks, video: probeResult.technical });
          }
        } else if (activeTab === 'series') {
          const info = await xtreamService.getSeriesInfo(streamId);
          setDetailData(info);
        }
      } catch (e) { console.error('Detail fetch failed:', e); }
      finally { setLoading(false); setProbing(false); }
    })();
  }, [selectedChannel, activeTab, xtreamService]);

  // ========== CONTROLS ==========
  const handlePrevChannel = useCallback(() => {
    if (!selectedChannel || !filteredItems.length) return;
    const idx = filteredItems.findIndex(ch => (ch.stream_id || ch.id) === (selectedChannel.stream_id || selectedChannel.id));
    if (idx > 0) onChannelChange?.(filteredItems[idx - 1]);
  }, [selectedChannel, filteredItems, onChannelChange]);

  const handleNextChannel = useCallback(() => {
    if (!selectedChannel || !filteredItems.length) return;
    const idx = filteredItems.findIndex(ch => (ch.stream_id || ch.id) === (selectedChannel.stream_id || selectedChannel.id));
    if (idx < filteredItems.length - 1) onChannelChange?.(filteredItems[idx + 1]);
  }, [selectedChannel, filteredItems, onChannelChange]);

  const handlePause = useCallback(async () => {
    if (isPaused) { await libVLC.resume(); setIsPaused(false); }
    else { await libVLC.pause(); setIsPaused(true); }
  }, [isPaused]);

  const handleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await libVLC.setFullscreen(false);
      setIsFullscreen(false);
      setTimeout(updateNativePosition, 100);
      setTimeout(updateNativePosition, 200);
      setTimeout(updateNativePosition, 400);
    } else {
      await libVLC.setFullscreen(true);
      setIsFullscreen(true);
      setFullscreenPosition();
    }
  }, [isFullscreen, updateNativePosition, setFullscreenPosition]);

  const handleVideoAreaClick = useCallback(() => {
    setShowControls(prev => !prev);
    clearTimeout(controlsTimerRef.current);
    if (!showControls) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 5000);
    }
  }, [showControls]);

  // ========== PLAY VOD/SERIES ==========
  const handlePlayVod = useCallback(() => {
    if (!selectedChannel || !xtreamService) return;
    const url = getStreamUrl(selectedChannel);
    if (url) { libVLC.play(url); setTimeout(updateNativePosition, 200); }
  }, [selectedChannel, xtreamService, getStreamUrl, updateNativePosition]);

  const handlePlayEpisode = useCallback((episode) => {
    if (!episode || !xtreamService) return;
    const ext = episode.container_extension || 'mp4';
    const url = `${xtreamService.server}/series/${xtreamService.username}/${xtreamService.password}/${episode.id}.${ext}`;
    libVLC.play(url);
    setTimeout(updateNativePosition, 200);
  }, [xtreamService, updateNativePosition]);

  // ========== LIVE: EPG NOW data ==========
  const nowProgram = epgPrograms.find(p => p.is_currently_live === 1);
  const channelId = selectedChannel ? (selectedChannel.stream_id || selectedChannel.id) : null;
  const isFav = channelId ? favorites[channelId] : false;

  // ========== FULLSCREEN OVERLAY ==========
  if (isFullscreen) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'transparent' }}
        onClick={handleVideoAreaClick}
      >
        {showControls && (
          <div onClick={(e) => e.stopPropagation()} style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.88) 40%)',
            padding: '36px 18px 12px',
            display: 'flex', flexDirection: 'column', gap: '6px',
          }}>
            {nowProgram && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '10px', color: CSS.textDim, fontVariantNumeric: 'tabular-nums' }}>
                <span>{formatEpgTime(nowProgram.start_time)}</span>
                <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.12)', borderRadius: '2px', position: 'relative' }}>
                  <div style={{ height: '100%', background: CSS.accent, borderRadius: '2px', width: `${nowProgram.progress}%`, boxShadow: '0 0 6px rgba(98,37,255,0.4)' }} />
                </div>
                <span>{formatEpgTime(nowProgram.end_time)}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              {selectedChannel?.logo && (
                <img src={selectedChannel.logo} alt="" style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '4px' }} onError={(e) => { e.target.style.display = 'none'; }} />
              )}
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{selectedChannel?.name}</span>
              {nowProgram && <span style={{ fontSize: '10px', color: '#aaa' }}>{nowProgram.title}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button onClick={() => {}} style={ctrlBtnStyle}>SUBS</button>
                <button onClick={() => {}} style={ctrlBtnStyle}>AUDIO</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                <button onClick={handlePrevChannel} style={ctrlBtnStyle}>PREV</button>
                <button onClick={() => libVLC.seekTo(-15000)} style={ctrlBtnStyle}>REW</button>
                <button onClick={handlePause} style={{ ...ctrlBtnStyle, padding: '10px 20px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', fontSize: '11px' }}>
                  {isPaused ? 'PLAY' : 'PAUSE'}
                </button>
                <button onClick={() => libVLC.seekTo(15000)} style={ctrlBtnStyle}>FWD</button>
                <button onClick={handleNextChannel} style={ctrlBtnStyle}>NEXT</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button onClick={handleFullscreen} style={{ ...ctrlBtnStyle, color: '#fff', fontWeight: 700 }}>MINIMIZE</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========== NO CHANNEL SELECTED — PLACEHOLDER ==========
  if (!selectedChannel) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.4)', position: 'relative', minWidth: 0 }}>
        <div style={{ flex: 1, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: CSS.textMuted }}>
            <div style={{ fontSize: '26px', fontWeight: 900, fontStyle: 'italic', letterSpacing: '-1px', marginBottom: '6px' }}>
              NINJA <span style={{ color: CSS.accent }}>8K</span>
            </div>
            <div style={{ fontSize: '13px' }}>Select a channel to start watching</div>
          </div>
        </div>
      </div>
    );
  }

  // ========== MOVIES / SERIES DETAIL VIEW ==========
  if (activeTab === 'movies' || activeTab === 'series') {
    const apiInfo = detailData?.info || {};
    const apiMovie = detailData?.movie_data || {};
    const poster = apiInfo.cover || apiInfo.movie_image || selectedChannel.logo || selectedChannel.cover;
    const posterBig = apiInfo.cover_big || poster;
    const title = apiMovie.name || apiInfo.name || selectedChannel.name || 'Untitled';
    const plot = apiInfo.plot || apiInfo.description || apiMovie.plot || '';
    const cast = apiInfo.cast || apiMovie.cast || '';
    const director = apiInfo.director || apiMovie.director || '';
    const genre = apiInfo.genre || apiMovie.genre || selectedChannel.category_name || '';
    const rating = apiInfo.rating || apiMovie.rating || selectedChannel.rating || '';
    const year = apiInfo.releasedate || apiInfo.release_date || apiMovie.year || selectedChannel.year || '';
    const duration = apiInfo.duration || apiMovie.duration || '';
    const video = apiInfo.video || apiMovie.video || null;
    const audioTracks = probeData?.audioTracks || [];
    const subtitleTracks = probeData?.subtitleTracks || [];
    const resolution = probeData?.video?.width ? `${probeData.video.width}×${probeData.video.height}` : null;
    const seasons = detailData?.seasons || [];
    const episodes = detailData?.episodes || {};
    const currentSeasonEpisodes = episodes[String(selectedSeason)] || [];
    const currentSeasonInfo = seasons.find(s => s.season_number === selectedSeason);
    const seasonCover = currentSeasonInfo?.cover || currentSeasonInfo?.cover_big || poster;

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', background: 'rgba(0,0,0,0.4)', minWidth: 0 }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '15px 20px 10px', flexShrink: 0, gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
              {year && <span style={{ fontSize: '10px', color: '#888' }}>{String(year).substring(0, 4)}</span>}
              {genre && <span style={{ fontSize: '9px', color: CSS.accent, fontWeight: 700 }}>{genre}</span>}
              {video?.width && <span style={{ fontSize: '9px', color: '#4ade80', fontWeight: 600 }}>{video.width}×{video.height}</span>}
              {rating && <span style={{ fontSize: '9px', color: '#ffd700' }}>★ {rating}</span>}
              {duration && <span style={{ fontSize: '9px', color: '#666' }}>{duration}</span>}
            </div>
          </div>
          <button onClick={handlePlayVod} style={{ background: CSS.gradient, border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: '14px', marginLeft: '2px' }}>▶</span>
          </button>
          <button onClick={() => onToggleFavorite?.(channelId)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ fontSize: '16px' }}>{isFav ? '★' : '☆'}</span>
          </button>
        </div>

        {/* Poster + Description */}
        <div style={{ display: 'flex', gap: '16px', padding: '0 20px 15px', flexShrink: 0 }}>
          {(activeTab === 'series' ? seasonCover : poster) && (
            <img src={activeTab === 'series' ? seasonCover : poster} alt="" onClick={() => setPosterOverlay(true)}
              style={{ width: '140px', height: '210px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, cursor: 'pointer' }} />
          )}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {plot && <div style={{ fontSize: '11px', color: '#aaa', lineHeight: '1.5' }}>{plot.substring(0, 300)}{plot.length > 300 ? '...' : ''}</div>}
            {director && <div style={{ fontSize: '10px', color: '#888' }}><span style={{ fontWeight: 700 }}>Director:</span> {director}</div>}
            {cast && <div style={{ fontSize: '10px', color: '#666' }}><span style={{ fontWeight: 700 }}>Cast:</span> {cast.substring(0, 150)}</div>}
            {resolution && <div style={{ fontSize: '10px', color: '#888' }}><span style={{ fontWeight: 700 }}>Resolution:</span> {resolution}</div>}

            {/* Audio */}
            <div>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#888' }}>AUDIO {probing ? '...' : audioTracks.length > 0 ? `(${audioTracks.length})` : ''}</span>
              {audioTracks.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                  {audioTracks.slice(0, 10).map((track, i) => (
                    <TagPill key={i} color="purple">{getLangName(track.language)} {track.channels ? `(${track.channels}ch)` : ''}</TagPill>
                  ))}
                  {audioTracks.length > 10 && (
                    <button onClick={() => setShowAllAudio(true)} style={{ background: 'rgba(98,37,255,0.2)', border: '1px solid rgba(98,37,255,0.4)', borderRadius: '4px', padding: '4px 8px', fontSize: '9px', color: '#a020f0', cursor: 'pointer', fontWeight: 700 }}>
                      Show More +{audioTracks.length - 10}
                    </button>
                  )}
                </div>
              )}
              {!probing && audioTracks.length === 0 && <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>No audio info</div>}
            </div>

            {/* Subtitles */}
            <div>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#888' }}>SUBTITLES {probing ? '...' : subtitleTracks.length > 0 ? `(${subtitleTracks.length})` : ''}</span>
              {subtitleTracks.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                  {subtitleTracks.slice(0, 10).map((track, i) => (
                    <TagPill key={i} color="gray">{getLangName(track.language)}</TagPill>
                  ))}
                  {subtitleTracks.length > 10 && (
                    <button onClick={() => setShowAllSubs(true)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '4px 8px', fontSize: '9px', color: '#ccc', cursor: 'pointer', fontWeight: 700 }}>
                      Show More +{subtitleTracks.length - 10}
                    </button>
                  )}
                </div>
              )}
              {!probing && subtitleTracks.length === 0 && <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>No subtitles</div>}
            </div>
          </div>
        </div>

        {/* Series: Season tabs + episodes */}
        {activeTab === 'series' && seasons.length > 0 && (
          <div style={{ padding: '0 20px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '8px', flexShrink: 0 }}>
              {seasons.map(s => {
                const isActive = s.season_number === selectedSeason;
                const epCount = (episodes[String(s.season_number)] || []).length;
                return (
                  <button key={s.season_number} onClick={() => setSelectedSeason(s.season_number)} style={{
                    background: isActive ? 'rgba(98,37,255,0.3)' : 'rgba(255,255,255,0.05)',
                    border: isActive ? '1px solid #6225ff' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px', padding: '6px 12px', color: isActive ? '#fff' : '#888',
                    fontSize: '9px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    Season {s.season_number} ({epCount})
                  </button>
                );
              })}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {currentSeasonEpisodes.map(ep => {
                const epInfo = ep.info || {};
                const epDuration = epInfo.duration_secs ? formatDuration(epInfo.duration_secs) : (epInfo.duration || '');
                return (
                  <div key={ep.id || ep.episode_num} onClick={() => handlePlayEpisode(ep)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: CSS.accent, minWidth: '24px', textAlign: 'center' }}>{ep.episode_num}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.title || `Episode ${ep.episode_num}`}</div>
                      {epDuration && <span style={{ fontSize: '8px', color: '#666' }}>{epDuration}</span>}
                    </div>
                    <span style={{ color: CSS.accent, fontSize: '12px', flexShrink: 0 }}>▶</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loading && <div style={{ padding: '10px', textAlign: 'center', color: CSS.accent, fontSize: '11px', fontWeight: 700 }}>LOADING...</div>}

        {/* Poster overlay */}
        {posterOverlay && (posterBig || poster) && (
          <div onClick={() => setPosterOverlay(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <img src={posterBig || poster} alt="" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '12px' }} />
          </div>
        )}

        {/* Audio overlay */}
        {showAllAudio && (
          <div onClick={() => setShowAllAudio(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 99998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', cursor: 'pointer' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#111', border: '2px solid #6225ff', borderRadius: '12px', padding: '30px', maxWidth: '700px', width: '100%', maxHeight: '80vh', overflow: 'auto', cursor: 'default' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ color: CSS.accent, fontSize: '18px', fontWeight: 800, margin: 0 }}>AUDIO TRACKS ({audioTracks.length})</h3>
                <button onClick={() => setShowAllAudio(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {audioTracks.map((track, i) => (
                  <div key={i} style={{ background: 'rgba(98,37,255,0.15)', border: '1px solid rgba(98,37,255,0.4)', borderRadius: '6px', padding: '10px 14px', fontSize: '11px', color: '#fff', fontWeight: 600 }}>
                    {getLangName(track.language)} {track.channels ? `(${track.channels}ch)` : ''}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Subs overlay */}
        {showAllSubs && (
          <div onClick={() => setShowAllSubs(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 99998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', cursor: 'pointer' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#111', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '12px', padding: '30px', maxWidth: '700px', width: '100%', maxHeight: '80vh', overflow: 'auto', cursor: 'default' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: 800, margin: 0 }}>SUBTITLE TRACKS ({subtitleTracks.length})</h3>
                <button onClick={() => setShowAllSubs(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {subtitleTracks.map((track, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '10px 14px', fontSize: '11px', color: '#ccc', fontWeight: 600 }}>
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

  // ========== LIVE: PLAYER + EPG BAR ==========

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.4)', position: 'relative', minWidth: 0 }}>

      {/* Video area — transparent so libVLC native renders behind */}
      <div ref={videoAreaRef} onClick={handleVideoAreaClick} style={{ flex: 1, background: 'transparent', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer' }}>

        {/* Controls overlay */}
        {showControls && (
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.88) 40%)', padding: '36px 18px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Timeline */}
            {nowProgram && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '10px', color: CSS.textDim, fontVariantNumeric: 'tabular-nums' }}>
                <span>{formatEpgTime(nowProgram.start_time)}</span>
                <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.12)', borderRadius: '2px', position: 'relative', cursor: 'pointer' }}>
                  <div style={{ height: '100%', background: CSS.accent, borderRadius: '2px', width: `${nowProgram.progress}%`, boxShadow: '0 0 6px rgba(98,37,255,0.4)' }} />
                  <div style={{ position: 'absolute', top: '50%', left: `${nowProgram.progress}%`, transform: 'translate(-50%, -50%)', width: '10px', height: '10px', background: '#fff', borderRadius: '50%', boxShadow: '0 0 4px rgba(0,0,0,0.5)' }} />
                </div>
                <span>{formatEpgTime(nowProgram.end_time)}</span>
              </div>
            )}

            {/* Controls row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button onClick={() => {}} style={ctrlBtnStyle}>SUBS</button>
                <button onClick={() => {}} style={ctrlBtnStyle}>AUDIO</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                <button onClick={handlePrevChannel} style={ctrlBtnStyle}>PREV</button>
                <button onClick={() => libVLC.seekTo(-15000)} style={ctrlBtnStyle}>REW</button>
                <button onClick={handlePause} style={{ ...ctrlBtnStyle, padding: '10px 20px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', fontSize: '11px' }}>
                  {isPaused ? 'PLAY' : 'PAUSE'}
                </button>
                <button onClick={() => libVLC.seekTo(15000)} style={ctrlBtnStyle}>FWD</button>
                <button onClick={handleNextChannel} style={ctrlBtnStyle}>NEXT</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button onClick={handleFullscreen} style={ctrlBtnStyle}>FULLSCREEN</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* EPG Bar */}
      <div style={{ background: 'rgba(10, 10, 16, 0.95)', borderTop: `1px solid ${CSS.divider}`, padding: '12px 16px', flexShrink: 0 }}>
        {/* Channel info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {selectedChannel.logo ? (
              <img src={selectedChannel.logo} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <span style={{ fontSize: '8px', color: CSS.textMuted }}>TV</span>
            )}
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>{selectedChannel.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              {nowProgram && <span style={{ fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '2px', background: CSS.red, color: '#fff', letterSpacing: '0.5px' }}>LIVE</span>}
            </div>
          </div>
        </div>

        {/* Programs list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {epgPrograms.slice(0, showFullSchedule ? epgPrograms.length : 4).map((prog, i) => {
            const isNow = prog.is_currently_live === 1;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: isNow ? CSS.green : CSS.textDim, fontWeight: isNow ? 600 : 400 }}>
                <span style={{ minWidth: '85px', fontVariantNumeric: 'tabular-nums' }}>{formatEpgTime(prog.start_time)} — {formatEpgTime(prog.end_time)}</span>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prog.title}</span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        {nowProgram && (
          <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: CSS.accent, borderRadius: '2px', width: `${nowProgram.progress}%`, boxShadow: '0 0 8px rgba(98,37,255,0.4)' }} />
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
          <button onClick={() => onToggleFavorite?.(channelId)} style={epgActionStyle}>
            {isFav ? '★ FAVORITE' : 'FAVORITE'}
          </button>
          {showFullSchedule ? (
            <button onClick={() => setShowFullSchedule(false)} style={epgActionStyle}>
              CLOSE GUIDE
            </button>
          ) : (
            <button onClick={loadFullDayEpg} disabled={loadingDayEpg} style={epgActionStyle}>
              {loadingDayEpg ? 'LOADING...' : 'EPG GUIDE'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// ========== BUTTON STYLES ==========
const ctrlBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '8px 12px', border: 'none', borderRadius: 0,
  background: 'transparent', color: 'rgba(255,255,255,0.6)',
  fontFamily: "'Outfit', sans-serif", fontSize: '10px', fontWeight: 600,
  letterSpacing: '0.5px', textTransform: 'uppercase',
  cursor: 'pointer', transition: 'all 0.15s',
};

const epgActionStyle = {
  display: 'flex', alignItems: 'center',
  padding: '7px 14px',
  border: `1px solid ${CSS.divider}`, borderRadius: 0,
  background: 'rgba(14,14,22,0.8)',
  color: CSS.textDim,
  fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 600,
  letterSpacing: '0.5px', textTransform: 'uppercase',
  cursor: 'pointer', transition: 'all 0.15s',
};

export default OTTPlayer;
