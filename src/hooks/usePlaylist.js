import { usePlaylistContext } from '../context/PlaylistContext';

// Shorthand hook for accessing playlist data
export const usePlaylist = () => {
  const context = usePlaylistContext();
  return context;
};

// Hook for Live TV data
export const useLiveTV = () => {
  const { playlist, getByCategory, getCategories } = usePlaylistContext();
  return {
    channels: playlist?.data?.live || [],
    getByCategory: (catId) => getByCategory('live', catId),
    categories: getCategories('live'),
  };
};

// Hook for Movies data
export const useMovies = () => {
  const { playlist, getByCategory, getCategories } = usePlaylistContext();
  return {
    movies: playlist?.data?.vod || [],
    getByCategory: (catId) => getByCategory('vod', catId),
    categories: getCategories('vod'),
  };
};

// Hook for Series data
export const useSeries = () => {
  const { playlist, getByCategory, getCategories } = usePlaylistContext();
  return {
    series: playlist?.data?.series || [],
    getByCategory: (catId) => getByCategory('series', catId),
    categories: getCategories('series'),
  };
};

// Hook for search functionality
export const useSearch = () => {
  const { search } = usePlaylistContext();
  return { search };
};

// Hook for refresh functionality
export const useRefresh = () => {
  const { refreshPlaylist, loading, refreshProgress } = usePlaylistContext();
  return { refreshPlaylist, loading, refreshProgress };
};

export default usePlaylist;
