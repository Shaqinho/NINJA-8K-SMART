// ============================================================================
// HIDDEN MANAGER - Manage hidden folders and channels
// ============================================================================
import { getDatabase, querySql, executeSql } from './NinjaLocalDB';

// ============================================================================
// FOLDERS (Categories)
// ============================================================================

/**
 * Hide a folder/category
 * @param {number} categoryId 
 * @param {string} categoryName 
 */
export const hideFolder = async (categoryId, categoryName = '') => {
  try {
    await executeSql(
      'INSERT OR REPLACE INTO hidden_folders (category_id, category_name, hidden_at) VALUES (?, ?, strftime("%s", "now"))',
      [categoryId, categoryName]
    );
    console.log(`👁️‍🗨️ Folder hidden: ${categoryName} (${categoryId})`);
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to hide folder:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Show a folder/category
 * @param {number} categoryId 
 */
export const showFolder = async (categoryId) => {
  try {
    await executeSql('DELETE FROM hidden_folders WHERE category_id = ?', [categoryId]);
    console.log(`👁️ Folder shown: ${categoryId}`);
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to show folder:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Toggle folder visibility
 * @param {number} categoryId 
 * @param {string} categoryName 
 * @returns {Promise<{hidden: boolean}>}
 */
export const toggleFolder = async (categoryId, categoryName = '') => {
  const isHidden = await isFolderHidden(categoryId);
  
  if (isHidden) {
    await showFolder(categoryId);
    return { hidden: false };
  } else {
    await hideFolder(categoryId, categoryName);
    return { hidden: true };
  }
};

/**
 * Check if folder is hidden
 * @param {number} categoryId 
 * @returns {Promise<boolean>}
 */
export const isFolderHidden = async (categoryId) => {
  try {
    const results = await querySql(
      'SELECT category_id FROM hidden_folders WHERE category_id = ?',
      [categoryId]
    );
    return results.length > 0;
  } catch (err) {
    console.error('❌ Failed to check folder visibility:', err);
    return false;
  }
};

/**
 * Get all hidden folders
 * @returns {Promise<Array>}
 */
export const getHiddenFolders = async () => {
  try {
    return await querySql('SELECT * FROM hidden_folders ORDER BY category_name ASC');
  } catch (err) {
    console.error('❌ Failed to get hidden folders:', err);
    return [];
  }
};

/**
 * Filter folders to exclude hidden ones
 * @param {Array} folders - Array of folder objects
 * @returns {Promise<Array>} Filtered folders
 */
export const filterVisibleFolders = async (folders) => {
  if (!folders || folders.length === 0) return [];
  
  const hiddenFolders = await getHiddenFolders();
  const hiddenIds = new Set(hiddenFolders.map(f => f.category_id));
  
  return folders.filter(folder => {
    const categoryId = folder.category_id || folder.categoryId || folder.id;
    return !hiddenIds.has(categoryId);
  });
};

// ============================================================================
// CHANNELS
// ============================================================================

/**
 * Hide a channel
 * @param {number} streamId 
 */
export const hideChannel = async (streamId) => {
  try {
    await executeSql(
      'UPDATE channels SET is_hidden = 1 WHERE stream_id = ?',
      [streamId]
    );
    console.log(`👁️‍🗨️ Channel hidden: ${streamId}`);
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to hide channel:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Show a channel
 * @param {number} streamId 
 */
export const showChannel = async (streamId) => {
  try {
    await executeSql(
      'UPDATE channels SET is_hidden = 0 WHERE stream_id = ?',
      [streamId]
    );
    console.log(`👁️ Channel shown: ${streamId}`);
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to show channel:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Toggle channel visibility
 * @param {number} streamId 
 * @returns {Promise<{hidden: boolean}>}
 */
export const toggleChannel = async (streamId) => {
  const isHidden = await isChannelHidden(streamId);
  
  if (isHidden) {
    await showChannel(streamId);
    return { hidden: false };
  } else {
    await hideChannel(streamId);
    return { hidden: true };
  }
};

/**
 * Check if channel is hidden
 * @param {number} streamId 
 * @returns {Promise<boolean>}
 */
export const isChannelHidden = async (streamId) => {
  try {
    const results = await querySql(
      'SELECT is_hidden FROM channels WHERE stream_id = ?',
      [streamId]
    );
    return results.length > 0 && results[0].is_hidden === 1;
  } catch (err) {
    console.error('❌ Failed to check channel visibility:', err);
    return false;
  }
};

/**
 * Get all hidden channels
 * @returns {Promise<Array>}
 */
export const getHiddenChannels = async () => {
  try {
    return await querySql(
      'SELECT * FROM channels WHERE is_hidden = 1 ORDER BY name ASC'
    );
  } catch (err) {
    console.error('❌ Failed to get hidden channels:', err);
    return [];
  }
};

/**
 * Filter channels to exclude hidden ones
 * @param {Array} channels - Array of channel objects
 * @returns {Promise<Array>} Filtered channels
 */
export const filterVisibleChannels = async (channels) => {
  if (!channels || channels.length === 0) return [];
  
  const hiddenChannels = await getHiddenChannels();
  const hiddenIds = new Set(hiddenChannels.map(ch => ch.stream_id));
  
  return channels.filter(channel => {
    const streamId = channel.stream_id || channel.id;
    return !hiddenIds.has(streamId);
  });
};

/**
 * Hide all channels in a folder
 * @param {number} categoryId 
 */
export const hideAllChannelsInFolder = async (categoryId) => {
  try {
    await executeSql(
      'UPDATE channels SET is_hidden = 1 WHERE category_id = ?',
      [categoryId]
    );
    console.log(`👁️‍🗨️ All channels hidden in folder: ${categoryId}`);
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to hide channels in folder:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Show all channels in a folder
 * @param {number} categoryId 
 */
export const showAllChannelsInFolder = async (categoryId) => {
  try {
    await executeSql(
      'UPDATE channels SET is_hidden = 0 WHERE category_id = ?',
      [categoryId]
    );
    console.log(`👁️ All channels shown in folder: ${categoryId}`);
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to show channels in folder:', err);
    return { success: false, error: err.message };
  }
};

// ============================================================================
// STATS
// ============================================================================

/**
 * Get hidden stats
 * @returns {Promise<{hiddenFolders: number, hiddenChannels: number}>}
 */
export const getHiddenStats = async () => {
  try {
    const folders = await querySql('SELECT COUNT(*) as count FROM hidden_folders');
    const channels = await querySql('SELECT COUNT(*) as count FROM channels WHERE is_hidden = 1');
    
    return {
      hiddenFolders: folders[0]?.count || 0,
      hiddenChannels: channels[0]?.count || 0
    };
  } catch (err) {
    console.error('❌ Failed to get hidden stats:', err);
    return { hiddenFolders: 0, hiddenChannels: 0 };
  }
};

/**
 * Reset all hidden (show everything)
 */
export const resetAllHidden = async () => {
  try {
    await executeSql('DELETE FROM hidden_folders');
    await executeSql('UPDATE channels SET is_hidden = 0');
    console.log('✅ All hidden items reset (everything visible)');
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to reset hidden:', err);
    return { success: false, error: err.message };
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

const HiddenManagerExports = {
  // Folders
  hideFolder,
  showFolder,
  toggleFolder,
  isFolderHidden,
  getHiddenFolders,
  filterVisibleFolders,
  
  // Channels
  hideChannel,
  showChannel,
  toggleChannel,
  isChannelHidden,
  getHiddenChannels,
  filterVisibleChannels,
  hideAllChannelsInFolder,
  showAllChannelsInFolder,
  
  // Stats & Reset
  getHiddenStats,
  resetAllHidden
};

export default HiddenManagerExports;
