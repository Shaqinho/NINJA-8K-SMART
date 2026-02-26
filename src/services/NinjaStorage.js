// ============================================================================
// NINJA STORAGE — Playlist persistence via Capacitor Preferences
// ============================================================================
// Stores the complete playlist (live, vod, series, categories) as JSON
// Uses Capacitor Preferences (native SharedPreferences / UserDefaults)
// No size limit on Android/iOS (unlike localStorage's ~5-10MB cap)
//
// Location: src/services/NinjaStorage.js
//
// Usage:
//   import { savePlaylist, loadPlaylist, hasPlaylist, deletePlaylist } from './NinjaStorage';
//   await savePlaylist(data);
//   const data = await loadPlaylist();
// ============================================================================

import { Preferences } from '@capacitor/preferences';

const PLAYLIST_KEY = 'ninja_playlist';
const PLAYLIST_META_KEY = 'ninja_playlist_meta';

// ============================================================================
// SAVE PLAYLIST — Stores complete playlist data
// ============================================================================
export const savePlaylist = async (data) => {
  try {
    if (!data) throw new Error('No data to save');

    await Preferences.set({
      key: PLAYLIST_KEY,
      value: JSON.stringify(data),
    });

    // Save metadata (timestamp + counts for quick checks)
    const meta = {
      savedAt: new Date().toISOString(),
      liveCount: data.live?.length || 0,
      vodCount: data.vod?.length || 0,
      seriesCount: data.series?.length || 0,
      liveCategoriesCount: data.liveCategories?.length || 0,
      vodCategoriesCount: data.vodCategories?.length || 0,
      seriesCategoriesCount: data.seriesCategories?.length || 0,
    };

    await Preferences.set({
      key: PLAYLIST_META_KEY,
      value: JSON.stringify(meta),
    });

    console.log(`✅ [NinjaStorage] Playlist saved: ${meta.liveCount} live, ${meta.vodCount} vod, ${meta.seriesCount} series`);
    return true;
  } catch (err) {
    console.error('❌ [NinjaStorage] Save failed:', err);
    return false;
  }
};

// ============================================================================
// LOAD PLAYLIST — Retrieves complete playlist data
// ============================================================================
export const loadPlaylist = async () => {
  try {
    const { value } = await Preferences.get({ key: PLAYLIST_KEY });
    if (!value) return null;

    const data = JSON.parse(value);
    console.log(`✅ [NinjaStorage] Playlist loaded: ${data.live?.length || 0} live, ${data.vod?.length || 0} vod, ${data.series?.length || 0} series`);
    return data;
  } catch (err) {
    console.error('❌ [NinjaStorage] Load failed:', err);
    return null;
  }
};

// ============================================================================
// HAS PLAYLIST — Check if a playlist exists (fast, reads metadata only)
// ============================================================================
export const hasPlaylist = async () => {
  try {
    const { value } = await Preferences.get({ key: PLAYLIST_META_KEY });
    return !!value;
  } catch (err) {
    return false;
  }
};

// ============================================================================
// GET PLAYLIST META — Returns metadata without loading full playlist
// ============================================================================
export const getPlaylistMeta = async () => {
  try {
    const { value } = await Preferences.get({ key: PLAYLIST_META_KEY });
    if (!value) return null;
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
};

// ============================================================================
// DELETE PLAYLIST — Removes playlist and metadata
// ============================================================================
export const deletePlaylist = async () => {
  try {
    await Preferences.remove({ key: PLAYLIST_KEY });
    await Preferences.remove({ key: PLAYLIST_META_KEY });
    console.log('🗑️ [NinjaStorage] Playlist deleted');
    return true;
  } catch (err) {
    console.error('❌ [NinjaStorage] Delete failed:', err);
    return false;
  }
};
