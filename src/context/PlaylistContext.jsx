import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { XtreamService } from '../services/XtreamService';

const PlaylistContext = createContext(null);

// Storage key
const PLAYLIST_STORAGE_KEY = 'ninja_playlist';

export const PlaylistProvider = ({ children }) => {
  const [playlist, setPlaylistState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState({ step: '', percent: 0 });
  const [isRestored, setIsRestored] = useState(false);

  // ============================================================================
  // AUTO-LOAD: Restaure la playlist sauvegardée au démarrage
  // ============================================================================
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PLAYLIST_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('✅ Playlist restored:', parsed.name);
        console.log('   Server:', parsed.server);
        console.log('   Username:', parsed.username);
        console.log('   Has password:', !!parsed.password);
        setPlaylistState(parsed);
      } else {
        console.log('ℹ️ No saved playlist found');
      }
    } catch (err) {
      console.error('❌ Failed to restore playlist:', err);
      localStorage.removeItem(PLAYLIST_STORAGE_KEY);
    } finally {
      setIsRestored(true);
    }
  }, []);

  // ============================================================================
  // SET PLAYLIST: Sauvegarde automatiquement dans localStorage
  // ============================================================================
  const setPlaylist = useCallback((data) => {
    setPlaylistState(data);
    
    // Auto-save to localStorage
    if (data) {
      try {
        localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(data));
        console.log('💾 Playlist saved:', data.name);
      } catch (err) {
        console.error('❌ Failed to save playlist:', err);
      }
    }
  }, []);

  // ============================================================================
  // CLEAR PLAYLIST: Efface la playlist et le localStorage
  // ============================================================================
  const clearPlaylist = useCallback(() => {
    localStorage.removeItem(PLAYLIST_STORAGE_KEY);
    setPlaylistState(null);
    console.log('🗑️ Playlist cleared');
  }, []);

  // ============================================================================
  // REFRESH: Actualise les données depuis le serveur
  // ============================================================================
  const refreshPlaylist = useCallback(async (options = { live: true, movies: true, series: true }) => {
    console.log('🔄 Refresh requested');
    console.log('   Playlist:', playlist?.name);
    console.log('   Type:', playlist?.type);
    console.log('   Server:', playlist?.server);
    console.log('   Username:', playlist?.username);
    console.log('   Has password:', !!playlist?.password);

    if (!playlist) {
      console.error('❌ Cannot refresh: No playlist');
      return;
    }

    if (playlist.type !== 'xtream') {
      console.error('❌ Cannot refresh: Not an Xtream playlist');
      return;
    }

    if (!playlist.server || !playlist.username || !playlist.password) {
      console.error('❌ Cannot refresh: Missing credentials');
      console.log('   server:', playlist.server);
      console.log('   username:', playlist.username);
      console.log('   password:', playlist.password ? '[SET]' : '[MISSING]');
      return;
    }

    setLoading(true);
    try {
      console.log('🔌 Creating XtreamService...');
      const service = new XtreamService(playlist.server, playlist.username, playlist.password);
      
      // First authenticate to make sure credentials are still valid
      console.log('🔐 Authenticating...');
      await service.authenticate();
      console.log('✅ Auth successful');

      let newData = { ...playlist.data };

      if (options.live) {
        setRefreshProgress({ step: 'Refreshing Live TV...', percent: 20 });
        console.log('📺 Fetching Live TV...');
        const [cats, streams] = await Promise.all([
          service.getLiveCategories(),
          service.getLiveStreams()
        ]);
        newData.live = service.parseLiveStreams(streams, cats);
        newData.liveCategories = cats || [];
        console.log('   Live channels:', newData.live?.length);
      }

      if (options.movies) {
        setRefreshProgress({ step: 'Refreshing Movies...', percent: 50 });
        console.log('🎬 Fetching Movies...');
        const [cats, streams] = await Promise.all([
          service.getVodCategories(),
          service.getVodStreams()
        ]);
        newData.vod = service.parseVodStreams(streams, cats);
        newData.vodCategories = cats || [];
        console.log('   Movies:', newData.vod?.length);
      }

      if (options.series) {
        setRefreshProgress({ step: 'Refreshing Series...', percent: 80 });
        console.log('📺 Fetching Series...');
        const [cats, list] = await Promise.all([
          service.getSeriesCategories(),
          service.getSeries()
        ]);
        newData.series = service.parseSeries(list, cats);
        newData.seriesCategories = cats || [];
        console.log('   Series:', newData.series?.length);
      }

      setRefreshProgress({ step: 'Done!', percent: 100 });
      
      const updatedPlaylist = { 
        ...playlist, 
        data: newData, 
        updatedAt: new Date().toISOString() 
      };
      
      setPlaylistState(updatedPlaylist);
      
      // Auto-save updated playlist
      try {
        localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(updatedPlaylist));
        console.log('💾 Playlist updated & saved');
      } catch (err) {
        console.error('❌ Failed to save updated playlist:', err);
      }

      return true; // Success

    } catch (err) {
      console.error('❌ Refresh failed:', err);
      console.error('   Error message:', err.message);
      throw err; // Re-throw so caller can handle
    } finally {
      setLoading(false);
      setTimeout(() => setRefreshProgress({ step: '', percent: 0 }), 1000);
    }
  }, [playlist]);

  // Get items by category
  const getByCategory = useCallback((type, categoryId) => {
    if (!playlist?.data) return [];
    const data = type === 'live' ? playlist.data.live : 
                 type === 'vod' ? playlist.data.vod : playlist.data.series;
    if (!categoryId) return data || [];
    return (data || []).filter(item => item.categoryId === categoryId);
  }, [playlist]);

  // Get unique categories
  const getCategories = useCallback((type) => {
    if (!playlist?.data) return [];
    const data = type === 'live' ? playlist.data.live : 
                 type === 'vod' ? playlist.data.vod : playlist.data.series;
    const cats = {};
    (data || []).forEach(item => {
      if (!cats[item.categoryId]) {
        cats[item.categoryId] = { id: item.categoryId, name: item.category, count: 0 };
      }
      cats[item.categoryId].count++;
    });
    return Object.values(cats).sort((a, b) => a.name.localeCompare(b.name));
  }, [playlist]);

  // Search across all content
  const search = useCallback((query, type = 'all') => {
    if (!playlist?.data || !query) return [];
    const q = query.toLowerCase();
    let results = [];

    if (type === 'all' || type === 'live') {
      results = [...results, ...(playlist.data.live || []).filter(i => i.name.toLowerCase().includes(q))];
    }
    if (type === 'all' || type === 'vod') {
      results = [...results, ...(playlist.data.vod || []).filter(i => i.name.toLowerCase().includes(q))];
    }
    if (type === 'all' || type === 'series') {
      results = [...results, ...(playlist.data.series || []).filter(i => i.name.toLowerCase().includes(q))];
    }

    return results.slice(0, 100); // Limit results
  }, [playlist]);

  // Get counts
  const getCounts = useCallback(() => ({
    live: playlist?.data?.live?.length || 0,
    vod: playlist?.data?.vod?.length || 0,
    series: playlist?.data?.series?.length || 0,
  }), [playlist]);

  const value = {
    playlist,
    loading,
    refreshProgress,
    isRestored,
    setPlaylist,
    clearPlaylist,
    refreshPlaylist,
    getByCategory,
    getCategories,
    search,
    getCounts,
  };

  return (
    <PlaylistContext.Provider value={value}>
      {children}
    </PlaylistContext.Provider>
  );
};

export const usePlaylistContext = () => {
  const context = useContext(PlaylistContext);
  if (!context) throw new Error('usePlaylistContext must be used within PlaylistProvider');
  return context;
};

export default PlaylistContext;
