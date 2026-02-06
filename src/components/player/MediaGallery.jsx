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
        {/* Back button */}
        <div style={{ padding: '15px 20px', flexShrink: 0 }}>
          <button
            onClick={handleBack}
            style={{ background: 'none', border: 'none', color: '#6225ff', fontSize: '18px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
          >
            ←
          </button>
        </div>

        {/* Poster + Info */}
        <div style={{ display: 'flex', gap: '20px', padding: '0 20px 20px', flexShrink: 0 }}>
          {poster && (
            <img
              src={poster}
              alt=""
              style={{ width: '140px', height: '210px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>{title}</div>
            {year && <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{year}</div>}
            {genre && <div style={{ fontSize: '10px', color: '#6225ff', fontWeight: 700, marginBottom: '4px' }}>{genre}</div>}
            {rating && <div style={{ fontSize: '10px', color: '#ffd700', marginBottom: '4px' }}>⭐ {rating}</div>}
            {duration && <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>{duration}</div>}
            {director && <div style={{ fontSize: '10px', color: '#888' }}>🎬 {director}</div>}
          </div>
        </div>

        {/* Plot */}
        {plot && (
          <div style={{ padding: '0 20px 15px', fontSize: '11px', color: '#aaa', lineHeight: '1.5' }}>
            {plot.substring(0, 300)}{plot.length > 300 ? '...' : ''}
          </div>
        )}

        {/* Cast */}
        {cast && (
          <div style={{ padding: '0 20px 15px', fontSize: '10px', color: '#666' }}>
            🎭 {cast.substring(0, 150)}
          </div>
        )}

        {/* Audio Tracks */}
        <div style={{ padding: '0 20px 10px' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#6225ff', marginBottom: '6px' }}>
            🔊 AUDIO {probing ? '(scanning...)' : probeData ? `(${probeData.audioTracks.length})` : ''}
          </div>
          {probeData?.audioTracks?.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {probeData.audioTracks.map((t, i) => (
                <div key={i} style={{
                  background: 'rgba(98,37,255,0.2)', border: '1px solid rgba(98,37,255,0.4)',
                  borderRadius: '4px', padding: '3px 8px', fontSize: '9px', color: '#fff', fontWeight: 600
                }}>
                  {t.name || `Track ${t.id}`}
                </div>
              ))}
            </div>
          ) : !probing && (
            <div style={{ fontSize: '9px', color: '#444' }}>No tracks detected</div>
          )}
        </div>

        {/* Subtitle Tracks */}
        <div style={{ padding: '0 20px 15px' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#6225ff', marginBottom: '6px' }}>
            💬 SUBTITLES {probing ? '(scanning...)' : probeData ? `(${probeData.subtitleTracks.length})` : ''}
          </div>
          {probeData?.subtitleTracks?.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {probeData.subtitleTracks.map((t, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '4px', padding: '3px 8px', fontSize: '9px', color: '#ccc', fontWeight: 600
                }}>
                  {t.name || `Sub ${t.id}`}
                </div>
              ))}
            </div>
          ) : !probing && (
            <div style={{ fontSize: '9px', color: '#444' }}>No subtitles</div>
          )}
        </div>

        {/* Play Button */}
        <div style={{ padding: '10px 20px 30px' }}>
          <button
            onClick={handlePlay}
            style={{
              width: '100%', padding: '14px',
              background: 'linear-gradient(135deg, #6225ff, #8b5cf6)',
              border: 'none', borderRadius: '8px',
              color: '#fff', fontSize: '14px', fontWeight: 800,
              cursor: 'pointer', letterSpacing: '1px',
            }}
          >
            ▶ PLAY
          </button>
        </div>

        {loading && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#6225ff', fontSize: '11px', fontWeight: 700 }}>
            LOADING...
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
      {/* Header */}
      <div style={{ padding: '20px 20px 15px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 800, color: '#fff', letterSpacing: '1px' }}>
          {type === 'movies' ? '🎬 MOVIES' : '📺 SERIES'}
        </div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, marginTop: '4px' }}>
          {items.length} TITLES
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {items.length > 0 ? (
          <Grid
            ref={gridRef}
            columnCount={COLUMN_COUNT}
            columnWidth={ITEM_WIDTH}
            height={window.innerHeight - 80}
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
