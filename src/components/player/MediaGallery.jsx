import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';

// ============================================================================
// MEDIA GALLERY - Thumbnails grid for Movies/Series (right panel)
// 
// - Windowed grid (react-window FixedSizeGrid)
// - Thumbnail click → probe 3s → extract audio/subtitle tracks
// - Detail view with poster, description, tracks
// ============================================================================

const MediaGallery = ({ items = [], type = 'movies', xtreamService, videoRef, onItemSelect }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [probeData, setProbeData] = useState(null);
  const [probing, setProbing] = useState(false);
  const [loading, setLoading] = useState(false);
  const gridRef = useRef(null);

  // Grid layout
  const COLUMN_COUNT = 6;
  const ITEM_WIDTH = Math.floor((window.innerWidth - 280) / COLUMN_COUNT);
  const ITEM_HEIGHT = Math.round(ITEM_WIDTH * 1.5); // Poster ratio
  const ROW_COUNT = Math.ceil(items.length / COLUMN_COUNT);

  // Reset on items change
  useEffect(() => {
    setSelectedItem(null);
    setDetailData(null);
    setProbeData(null);
  }, [items]);

  // Fetch TMDB info + probe stream
  const handleThumbnailClick = useCallback(async (item) => {
    setSelectedItem(item);
    setDetailData(null);
    setProbeData(null);

    // 1. Fetch detail info (TMDB)
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

    // 2. Probe stream for audio/subtitle tracks (fire & forget, non-blocking)
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

  // Back to grid
  const handleBack = useCallback(() => {
    setSelectedItem(null);
    setDetailData(null);
    setProbeData(null);
  }, []);

  // Play button
  const handlePlay = useCallback(() => {
    if (selectedItem) {
      onItemSelect?.(selectedItem);
    }
  }, [selectedItem, onItemSelect]);

  const [posterOverlay, setPosterOverlay] = useState(false);

  // ========== DETAIL VIEW ==========
  if (selectedItem) {
    const info = detailData?.info || detailData?.movie_data || {};
    const poster = info.cover || info.movie_image || selectedItem.logo || selectedItem.cover;
    const title = info.name || selectedItem.name || 'Untitled';
    const plot = info.plot || info.description || selectedItem.plot || '';
    const cast = info.cast || selectedItem.cast || '';
    const director = info.director || selectedItem.director || '';
    const genre = info.genre || selectedItem.genre || '';
    const rating = info.rating || selectedItem.rating || '';
    const year = info.releasedate || info.release_date || selectedItem.year || '';
    const duration = info.duration || selectedItem.duration || '';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto', background: 'rgba(0,0,0,0.75)' }}>

        {/* Title row — title left, play + fav + back right */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '15px 20px 10px', flexShrink: 0, gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
              {year && <span style={{ fontSize: '10px', color: '#888' }}>{year}</span>}
              {genre && <span style={{ fontSize: '9px', color: '#6225ff', fontWeight: 700 }}>{genre}</span>}
              {rating && <span style={{ fontSize: '9px', color: '#ffd700' }}>⭐ {rating}</span>}
              {duration && <span style={{ fontSize: '9px', color: '#666' }}>{duration}</span>}
            </div>
          </div>
          {/* Play button */}
          <button onClick={handlePlay} style={{ background: 'linear-gradient(135deg, #6225ff, #8b5cf6)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: '14px', marginLeft: '2px' }}>▶</span>
          </button>
          {/* Favorite button */}
          <button onClick={() => {/* TODO: toggle favorite */}} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ fontSize: '16px' }}>☆</span>
          </button>
          {/* Back arrow */}
          <button onClick={handleBack} style={{ background: 'none', border: 'none', color: '#6225ff', fontSize: '18px', fontWeight: 700, cursor: 'pointer', padding: '0 0 0 8px', flexShrink: 0 }}>✕</button>
        </div>

        {/* Poster + Description horizontal */}
        <div style={{ display: 'flex', gap: '16px', padding: '0 20px 15px', flexShrink: 0 }}>
          {/* Poster — clickable for overlay */}
          {poster && (
            <img
              src={poster}
              alt=""
              onClick={() => setPosterOverlay(true)}
              style={{ width: '140px', height: '210px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, cursor: 'pointer' }}
            />
          )}
          {/* Right side — plot, cast, director, tracks */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {director && <div style={{ fontSize: '10px', color: '#888' }}>🎬 {director}</div>}
            {plot && (
              <div style={{ fontSize: '11px', color: '#aaa', lineHeight: '1.5' }}>
                {plot.substring(0, 300)}{plot.length > 300 ? '...' : ''}
              </div>
            )}
            {cast && <div style={{ fontSize: '10px', color: '#666' }}>🎭 {cast.substring(0, 150)}</div>}

            {/* Audio Tracks */}
            <div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#6225ff' }}>
                🔊 AUDIO {probing ? '...' : probeData ? `(${probeData.audioTracks.length})` : ''}
              </span>
              {probeData?.audioTracks?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                  {probeData.audioTracks.map((t, i) => (
                    <span key={i} style={{ background: 'rgba(98,37,255,0.2)', border: '1px solid rgba(98,37,255,0.4)', borderRadius: '3px', padding: '2px 6px', fontSize: '8px', color: '#fff', fontWeight: 600 }}>
                      {t.name || `Track ${t.id}`}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Subtitle Tracks */}
            <div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#6225ff' }}>
                💬 SUBTITLES {probing ? '...' : probeData ? `(${probeData.subtitleTracks.length})` : ''}
              </span>
              {probeData?.subtitleTracks?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                  {probeData.subtitleTracks.map((t, i) => (
                    <span key={i} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', padding: '2px 6px', fontSize: '8px', color: '#ccc', fontWeight: 600 }}>
                      {t.name || `Sub ${t.id}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ padding: '10px', textAlign: 'center', color: '#6225ff', fontSize: '11px', fontWeight: 700 }}>LOADING...</div>
        )}

        {/* Poster Overlay — fullscreen image */}
        {posterOverlay && poster && (
          <div
            onClick={() => setPosterOverlay(false)}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.9)', zIndex: 99999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <img src={poster} alt="" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '12px' }} />
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
        style={{
          ...style,
          padding: '4px',
          cursor: 'pointer',
        }}
        onClick={() => handleThumbnailClick(item)}
      >
        <div style={{
          width: '100%', height: '100%',
          borderRadius: '6px', overflow: 'hidden',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column',
          transition: 'border-color 0.2s',
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
          <div style={{ padding: '6px 8px', flexShrink: 0 }}>
            <div style={{
              fontSize: '10px', fontWeight: 700, color: '#fff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>
              {item.name || 'Untitled'}
            </div>
            {item.year && <div style={{ fontSize: '8px', color: '#555' }}>{item.year}</div>}
            {item.rating && <div style={{ fontSize: '8px', color: '#ffd700' }}>⭐ {item.rating}</div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Grid — no header, full space */}
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

export default MediaGallery;
