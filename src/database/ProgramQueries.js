// ============================================================================
// PROGRAM QUERIES - CRUD Operations for EPG Search (Capacitor)
// ============================================================================
import { getDatabase, extractLangPrefix, normalizeText, querySql, executeSql } from './NinjaLocalDB';

// Insert Channels (bulk)
export const insertChannels = async (channels) => {
  if (!channels?.length) return 0;
  const db = getDatabase();
  
  await db.execute('BEGIN TRANSACTION');
  try {
    for (const ch of channels) {
      await db.execute(
        `INSERT OR REPLACE INTO channels (stream_id, name, lang_prefix, category_id, category_name, epg_channel_id, logo, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))`,
        [
          ch.id || ch.stream_id, 
          ch.name || '', 
          extractLangPrefix(ch.name), 
          ch.categoryId || ch.category_id || null, 
          ch.category || ch.category_name || null, 
          ch.epgChannelId || ch.epg_channel_id || null, 
          ch.logo || ch.stream_icon || null
        ]
      );
    }
    await db.execute('COMMIT');
    console.log(`✅ ${channels.length} channels inserted (transactional)`);
    return channels.length;
  } catch (err) {
    await db.execute('ROLLBACK');
    console.error('❌ insertChannels failed:', err);
    throw err;
  }
};

// ============================================================================
// INSERT CATEGORIES & ITEMS
// ============================================================================

// Insert Live Categories (bulk)
export const insertLiveCategories = async (categories) => {
  if (!categories?.length) return 0;
  const db = getDatabase();
  
  await db.execute('BEGIN TRANSACTION');
  try {
    for (const cat of categories) {
      await db.execute(
        `INSERT OR REPLACE INTO live_categories (category_id, category_name, parent_id) VALUES (?, ?, ?)`,
        [
          cat.category_id || cat.id,
          cat.category_name || cat.name || '',
          cat.parent_id || 0
        ]
      );
    }
    await db.execute('COMMIT');
    console.log(`✅ ${categories.length} live categories inserted (transactional)`);
    return categories.length;
  } catch (err) {
    await db.execute('ROLLBACK');
    console.error('❌ insertLiveCategories failed:', err);
    throw err;
  }
};

// Insert VOD Categories (bulk)
export const insertVODCategories = async (categories) => {
  if (!categories?.length) return 0;
  const db = getDatabase();
  
  await db.execute('BEGIN TRANSACTION');
  try {
    for (const cat of categories) {
      await db.execute(
        `INSERT OR REPLACE INTO vod_categories (category_id, category_name, parent_id) VALUES (?, ?, ?)`,
        [
          cat.category_id || cat.id,
          cat.category_name || cat.name || '',
          cat.parent_id || 0
        ]
      );
    }
    await db.execute('COMMIT');
    console.log(`✅ ${categories.length} VOD categories inserted (transactional)`);
    return categories.length;
  } catch (err) {
    await db.execute('ROLLBACK');
    console.error('❌ insertVODCategories failed:', err);
    throw err;
  }
};

// Insert Series Categories (bulk)
export const insertSeriesCategories = async (categories) => {
  if (!categories?.length) return 0;
  const db = getDatabase();
  
  await db.execute('BEGIN TRANSACTION');
  try {
    for (const cat of categories) {
      await db.execute(
        `INSERT OR REPLACE INTO series_categories (category_id, category_name, parent_id) VALUES (?, ?, ?)`,
        [
          cat.category_id || cat.id,
          cat.category_name || cat.name || '',
          cat.parent_id || 0
        ]
      );
    }
    await db.execute('COMMIT');
    console.log(`✅ ${categories.length} series categories inserted (transactional)`);
    return categories.length;
  } catch (err) {
    await db.execute('ROLLBACK');
    console.error('❌ insertSeriesCategories failed:', err);
    throw err;
  }
};

// Insert VOD Items (bulk)
export const insertVODItems = async (items) => {
  if (!items?.length) return 0;
  const db = getDatabase();
  
  await db.execute('BEGIN TRANSACTION');
  try {
    for (const item of items) {
      await db.execute(
        `INSERT OR REPLACE INTO vod_items (stream_id, name, category_id, category_name, logo, rating, year, genre) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.stream_id || item.id,
          item.name || '',
          item.categoryId || item.category_id || null,
          item.category || item.category_name || null,
          item.logo || item.stream_icon || null,
          item.rating || null,
          item.year || null,
          item.genre || null
        ]
      );
    }
    await db.execute('COMMIT');
    console.log(`✅ ${items.length} VOD items inserted (transactional)`);
    return items.length;
  } catch (err) {
    await db.execute('ROLLBACK');
    console.error('❌ insertVODItems failed:', err);
    throw err;
  }
};

// Insert Series Items (bulk)
export const insertSeriesItems = async (items) => {
  if (!items?.length) return 0;
  const db = getDatabase();
  
  await db.execute('BEGIN TRANSACTION');
  try {
    for (const item of items) {
      await db.execute(
        `INSERT OR REPLACE INTO series_items (series_id, name, category_id, category_name, cover, rating, year, genre) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.series_id || item.id,
          item.name || '',
          item.categoryId || item.category_id || null,
          item.category || item.category_name || null,
          item.cover || item.cover_big || null,
          item.rating || null,
          item.year || null,
          item.genre || null
        ]
      );
    }
    await db.execute('COMMIT');
    console.log(`✅ ${items.length} series items inserted (transactional)`);
    return items.length;
  } catch (err) {
    await db.execute('ROLLBACK');
    console.error('❌ insertSeriesItems failed:', err);
    throw err;
  }
};

// Clean expired programs (end_time < now)
export const cleanExpiredPrograms = async () => {
  const now = Math.floor(Date.now() / 1000);
  const result = await executeSql('DELETE FROM programs WHERE end_time < ? AND end_time IS NOT NULL', [now]);
  console.log(`🧹 Cleaned expired programs (before ${now})`);
  return result;
};

// Insert Programs (bulk for multiple channels) - Single Transaction
export const insertProgramsBatch = async (epgData) => {
  if (!epgData || !Object.keys(epgData).length) return 0;
  const db = getDatabase();
  const now = Math.floor(Date.now() / 1000);
  let total = 0;

  // Single transaction for all inserts - crucial for Capacitor/SQLite perf
  try {
    await db.execute('BEGIN TRANSACTION');

    for (const [streamId, programs] of Object.entries(epgData)) {
      if (!programs?.length) continue;

      // Clear old programs for this channel
      await db.run('DELETE FROM programs WHERE stream_id = ?', [parseInt(streamId)]);

      for (const prog of programs) {
        const startTime = prog.startTimestamp || (prog.start ? Math.floor(new Date(prog.start).getTime() / 1000) : null);
        const endTime = prog.stopTimestamp || prog.endTimestamp || (prog.end ? Math.floor(new Date(prog.end).getTime() / 1000) : null);
        const isLive = (startTime && endTime && startTime <= now && endTime > now) ? 1 : 0;

        await db.run(
          `INSERT INTO programs (stream_id, title, title_normalized, description, start_time, end_time, start_formatted, end_formatted, is_live) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [parseInt(streamId), prog.title || 'Sans titre', normalizeText(prog.title), prog.description || '', startTime, endTime || null, prog.start || '', prog.end || '', isLive]
        );
        total++;
      }
    }

    await db.execute('COMMIT');
    console.log(`✅ ${total} programs inserted (single transaction)`);
  } catch (txErr) {
    try { await db.execute('ROLLBACK'); } catch (rbErr) { /* rollback best effort */ }
    console.error('❌ insertProgramsBatch transaction failed:', txErr);
    throw txErr;
  }

  return total;
};

// Search Channels by Name
export const searchChannelsByName = async (query, langFilters = [], includeVip = true, limit = 100) => {
  const q = normalizeText(query);
  let sql = `SELECT * FROM channels WHERE LOWER(name) LIKE ?`;
  const params = [`%${q}%`];
  if (langFilters.length) {
    const filters = includeVip && !langFilters.includes('VIP') ? [...langFilters, 'VIP'] : langFilters;
    sql += ` AND lang_prefix IN (${filters.map(() => '?').join(', ')})`;
    params.push(...filters);
  }
  sql += ` ORDER BY name ASC LIMIT ?`;
  params.push(limit);
  return await querySql(sql, params);
};

// Get Channels by Language
export const getChannelsByLang = async (langFilters = [], includeVip = true) => {
  let sql = 'SELECT * FROM channels';
  const params = [];
  if (langFilters.length) {
    const filters = includeVip && !langFilters.includes('VIP') ? [...langFilters, 'VIP'] : langFilters;
    sql += ` WHERE lang_prefix IN (${filters.map(() => '?').join(', ')})`;
    params.push(...filters);
  }
  sql += ' ORDER BY name ASC';
  return await querySql(sql, params);
};

// Get Available Languages
export const getAvailableLanguages = async () => {
  return await querySql(`SELECT lang_prefix, COUNT(*) as count FROM channels WHERE lang_prefix IS NOT NULL GROUP BY lang_prefix ORDER BY count DESC`);
};

// Search Programs by Title (main EPG search)
export const searchProgramsByTitle = async (query, langFilters = [], includeVip = true, liveFirst = true, limit = 100) => {
  const q = normalizeText(query);
  const now = Math.floor(Date.now() / 1000);
  let sql = `SELECT p.*, c.name as channel_name, c.logo as channel_logo, c.lang_prefix, c.category_name,
    CASE WHEN p.start_time <= ${now} AND p.end_time > ${now} THEN 1 ELSE 0 END as is_currently_live
    FROM programs p INNER JOIN channels c ON p.stream_id = c.stream_id WHERE (p.title_normalized LIKE ? OR p.description LIKE ?)`;
  const params = [`%${q}%`, `%${q}%`];
  if (langFilters.length) {
    const filters = includeVip && !langFilters.includes('VIP') ? [...langFilters, 'VIP'] : langFilters;
    sql += ` AND c.lang_prefix IN (${filters.map(() => '?').join(', ')})`;
    params.push(...filters);
  }
  sql += ` AND p.end_time > ?`;
  params.push(now);
  sql += liveFirst ? ` ORDER BY is_currently_live DESC, p.start_time ASC` : ` ORDER BY p.start_time ASC`;
  sql += ` LIMIT ?`;
  params.push(limit);
  const results = await querySql(sql, params);
  return results.map(r => ({
    ...r,
    progress: r.is_currently_live && r.start_time && r.end_time ? Math.min(100, Math.max(0, Math.round(((now - r.start_time) / (r.end_time - r.start_time)) * 100))) : 0,
  }));
};

// Get Programs for Channel
export const getProgramsForChannel = async (streamId, futureOnly = true) => {
  const now = Math.floor(Date.now() / 1000);
  let sql = `SELECT p.*, CASE WHEN p.start_time <= ${now} AND p.end_time > ${now} THEN 1 ELSE 0 END as is_currently_live FROM programs p WHERE p.stream_id = ?`;
  const params = [streamId];
  if (futureOnly) { sql += ` AND p.end_time > ?`; params.push(now); }
  sql += ` ORDER BY p.start_time ASC`;
  const results = await querySql(sql, params);
  return results.map(r => ({
    ...r,
    progress: r.is_currently_live && r.start_time && r.end_time ? Math.min(100, Math.max(0, Math.round(((now - r.start_time) / (r.end_time - r.start_time)) * 100))) : 0,
  }));
};

// Sync Status
export const updateSyncStatus = async (syncKey, syncType, channelsCount = 0, programsCount = 0) => {
  await executeSql(`INSERT OR REPLACE INTO sync_status (sync_key, last_sync, sync_type, channels_count, programs_count) VALUES (?, ?, ?, ?, ?)`, [syncKey, Math.floor(Date.now() / 1000), syncType, channelsCount, programsCount]);
};

export const getSyncStatus = async (syncKey) => {
  const results = await querySql('SELECT * FROM sync_status WHERE sync_key = ?', [syncKey]);
  return results.length ? results[0] : null;
};

export const isSyncNeeded = async (syncKey, maxAgeSeconds = 900) => {
  const status = await getSyncStatus(syncKey);
  if (!status) return true;
  return (Math.floor(Date.now() / 1000) - status.last_sync) > maxAgeSeconds;
};

// Get NOW programs for specific category IDs (EPG Presets)
export const getNowByCategories = async (categoryIds = [], limit = 200) => {
  if (!categoryIds.length) return [];
  const now = Math.floor(Date.now() / 1000);
  const placeholders = categoryIds.map(() => '?').join(', ');
  const sql = `SELECT p.*, c.name as channel_name, c.logo as channel_logo, c.lang_prefix, c.category_name, c.category_id,
    1 as is_currently_live
    FROM programs p
    INNER JOIN channels c ON p.stream_id = c.stream_id
    WHERE c.category_id IN (${placeholders})
    AND p.start_time <= ? AND p.end_time > ?
    ORDER BY c.category_name ASC, c.name ASC
    LIMIT ?`;
  const params = [...categoryIds, now, now, limit];
  const results = await querySql(sql, params);
  return results.map(r => ({
    ...r,
    progress: r.start_time && r.end_time ? Math.min(100, Math.max(0, Math.round(((now - r.start_time) / (r.end_time - r.start_time)) * 100))) : 0,
  }));
};

// Search programs by text within specific category IDs (EPG Presets)
export const searchProgramsByCategories = async (query, categoryIds = [], limit = 100) => {
  if (!categoryIds.length || !query?.trim()) return [];
  const q = normalizeText(query);
  const now = Math.floor(Date.now() / 1000);
  const placeholders = categoryIds.map(() => '?').join(', ');
  const sql = `SELECT p.*, c.name as channel_name, c.logo as channel_logo, c.lang_prefix, c.category_name, c.category_id,
    CASE WHEN p.start_time <= ${now} AND p.end_time > ${now} THEN 1 ELSE 0 END as is_currently_live
    FROM programs p
    INNER JOIN channels c ON p.stream_id = c.stream_id
    WHERE c.category_id IN (${placeholders})
    AND (p.title_normalized LIKE ? OR p.description LIKE ?)
    AND p.end_time > ?
    ORDER BY is_currently_live DESC, p.start_time ASC
    LIMIT ?`;
  const params = [...categoryIds, `%${q}%`, `%${q}%`, now, limit];
  const results = await querySql(sql, params);
  return results.map(r => ({
    ...r,
    progress: r.is_currently_live && r.start_time && r.end_time ? Math.min(100, Math.max(0, Math.round(((now - r.start_time) / (r.end_time - r.start_time)) * 100))) : 0,
  }));
};

// Get stream IDs for specific category IDs (for EPG batch fetch fallback)
export const getStreamIdsByCategories = async (categoryIds = []) => {
  if (!categoryIds.length) return [];
  const placeholders = categoryIds.map(() => '?').join(', ');
  const results = await querySql(`SELECT stream_id FROM channels WHERE category_id IN (${placeholders})`, categoryIds);
  return results.map(r => r.stream_id);
};

// ============================================================================
// EPG FETCHING - JSON API (getShortEPG via XtreamService)
// ============================================================================

/**
 * Parse EPG date "2026-02-08 22:50:00" to Unix timestamp
 * @param {string} dateStr - Date format "YYYY-MM-DD HH:MM:SS"
 * @returns {number|null} Unix timestamp in seconds
 */
const parseEPGDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr.replace(' ', 'T'));
    return Math.floor(date.getTime() / 1000);
  } catch (err) {
    console.warn('⚠️ Invalid EPG date:', dateStr);
    return null;
  }
};

/**
 * Fetch EPG from Xtream API and store in DB
 * Uses XtreamService.getShortEPG() which already decodes Base64
 * @param {XtreamService} xtreamService - Instance of XtreamService
 * @param {number} streamId - Channel stream ID
 * @param {number} limit - Number of programs (1, 2, or 4)
 * @returns {Promise<{success: boolean, count: number}>}
 */
export const fetchAndStoreEPG = async (xtreamService, streamId, limit = 4) => {
  if (!xtreamService) {
    throw new Error('XtreamService instance required');
  }

  try {
    // XtreamService.getShortEPG already decodes Base64
    const programs = await xtreamService.getShortEPG(streamId, limit);
    
    if (!programs || programs.length === 0) {
      console.log(`ℹ️ No EPG found for stream ${streamId}`);
      return { success: false, count: 0 };
    }

    const db = getDatabase();
    const now = Math.floor(Date.now() / 1000);

    // Delete old programs for this channel
    await db.run('DELETE FROM programs WHERE stream_id = ?', [streamId]);

    // Insert new programs
    for (const prog of programs) {
      // Parse dates (NOT timestamps)
      const startTime = parseEPGDate(prog.start);
      const endTime = parseEPGDate(prog.end);
      
      if (!startTime || !endTime) {
        console.warn(`⚠️ Invalid dates for stream ${streamId}, skipping program`);
        continue;
      }

      const isLive = (startTime <= now && endTime > now) ? 1 : 0;

      await db.run(
        `INSERT INTO programs (stream_id, title, title_normalized, description, start_time, end_time, is_live) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          streamId,
          prog.title || 'Sans titre',
          normalizeText(prog.title),
          prog.description || '',
          startTime,
          endTime,
          isLive
        ]
      );
    }

    console.log(`✅ Stored ${programs.length} programs for stream ${streamId}`);
    return { success: true, count: programs.length };

  } catch (err) {
    console.error(`❌ Failed to fetch/store EPG for stream ${streamId}:`, err);
    return { success: false, count: 0, error: err.message };
  }
};

/**
 * Deep Search - Try to find EPG with limit=2 (minimum for auto-refresh)
 * Used when channel has no EPG in XMLTV
 * Fetches 2 programs minimum to enable auto-refresh (NOW + NEXT)
 * @param {XtreamService} xtreamService 
 * @param {number} streamId 
 * @returns {Promise<{success: boolean, count: number}>}
 */
export const deepSearchEPG = async (xtreamService, streamId) => {
  console.log(`🔍 Deep Search EPG for stream ${streamId}`);
  return await fetchAndStoreEPG(xtreamService, streamId, 2);  // Minimum 2 for auto-refresh
};

// ============================================================================
// XMLTV LOADING & PARSING
// ============================================================================

/**
 * Load XMLTV from Xtream API and store in DB
 * @param {XtreamService} xtreamService - Instance of XtreamService
 * @returns {Promise<{success: boolean, channelsCount: number, programsCount: number}>}
 */
export const loadXMLTV = async (xtreamService) => {
  if (!xtreamService) {
    throw new Error('XtreamService instance required');
  }

  try {
    console.log('🔄 Loading XMLTV...');
    const startTime = Date.now();

    // Fetch XMLTV data
    const xmltvData = await xtreamService.getFullEPG();
    
    if (!xmltvData || !xmltvData.epg_listings) {
      console.warn('⚠️ No XMLTV data returned');
      return { success: false, channelsCount: 0, programsCount: 0 };
    }

    const db = getDatabase();
    const now = Math.floor(Date.now() / 1000);
    let programsCount = 0;
    let channelsCount = 0;

    // Single transaction for performance
    await db.execute('BEGIN TRANSACTION');

    try {
      // Parse and store programs
      for (const [streamId, programs] of Object.entries(xmltvData.epg_listings)) {
        if (!programs || !Array.isArray(programs) || programs.length === 0) {
          continue;
        }

        channelsCount++;

        // Delete old programs for this channel
        await db.run('DELETE FROM programs WHERE stream_id = ?', [parseInt(streamId)]);

        // Insert new programs
        for (const prog of programs) {
          // Parse timestamps
          const startTime = prog.start_timestamp ? parseInt(prog.start_timestamp) : parseEPGDate(prog.start);
          const endTime = prog.stop_timestamp ? parseInt(prog.stop_timestamp) : parseEPGDate(prog.stop);

          if (!startTime || !endTime) continue;

          // Only store future programs (not expired)
          if (endTime < now) continue;

          const isLive = (startTime <= now && endTime > now) ? 1 : 0;

          await db.run(
            `INSERT INTO programs (stream_id, title, title_normalized, description, start_time, end_time, is_live) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              parseInt(streamId),
              prog.title || 'Sans titre',
              normalizeText(prog.title),
              prog.description || '',
              startTime,
              endTime,
              isLive
            ]
          );

          programsCount++;
        }
      }

      await db.execute('COMMIT');

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`✅ XMLTV loaded: ${channelsCount} channels, ${programsCount} programs in ${elapsed}s`);

      // Update sync status
      await updateSyncStatus('xmltv', 'full', channelsCount, programsCount);

      return { success: true, channelsCount, programsCount, elapsed };

    } catch (err) {
      await db.execute('ROLLBACK');
      throw err;
    }

  } catch (err) {
    console.error('❌ Failed to load XMLTV:', err);
    return { success: false, channelsCount: 0, programsCount: 0, error: err.message };
  }
};

/**
 * Sync EPG for empty channels in folders 1-150
 * Background task after XMLTV load
 * @param {XtreamService} xtreamService 
 * @param {Array} allFolders - All live categories/folders
 * @returns {Promise<{synced: number, skipped: number}>}
 */
export const syncEmptyChannels = async (xtreamService, allFolders) => {
  if (!xtreamService || !allFolders?.length) {
    console.warn('⚠️ Invalid parameters for syncEmptyChannels');
    return { synced: 0, skipped: 0 };
  }

  try {
    console.log('🔄 Syncing empty channels (folders 1-150)...');

    // Get folders 1-150
    const targetFolders = allFolders.slice(0, 150);
    
    // Extract all stream IDs from these folders
    const allStreamIds = [];
    targetFolders.forEach(folder => {
      if (folder.channels && Array.isArray(folder.channels)) {
        folder.channels.forEach(ch => {
          const streamId = ch.id || ch.stream_id;
          if (streamId) allStreamIds.push(parseInt(streamId));
        });
      }
    });

    if (allStreamIds.length === 0) {
      console.log('ℹ️ No channels found in folders 1-150');
      return { synced: 0, skipped: 0 };
    }

    console.log(`📊 Checking ${allStreamIds.length} channels for empty EPG...`);

    // Find empty channels (no programs in DB)
    const emptyChannels = [];
    for (const streamId of allStreamIds) {
      const programs = await getProgramsForChannel(streamId, true);
      if (programs.length === 0) {
        emptyChannels.push(streamId);
      }
    }

    console.log(`🔍 Found ${emptyChannels.length} empty channels`);

    if (emptyChannels.length === 0) {
      return { synced: 0, skipped: allStreamIds.length };
    }

    // Sync empty channels in batches
    const BATCH_SIZE = 20;
    const BATCH_DELAY = 1000; // 1 second pause
    let synced = 0;

    for (let i = 0; i < emptyChannels.length; i += BATCH_SIZE) {
      const batch = emptyChannels.slice(i, i + BATCH_SIZE);
      
      console.log(`🔄 Syncing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(emptyChannels.length / BATCH_SIZE)} (${batch.length} channels)`);

      // Fetch EPG for each channel in batch
      for (const streamId of batch) {
        try {
          const result = await fetchAndStoreEPG(xtreamService, streamId, 4);
          if (result.success) {
            synced++;
          }
        } catch (err) {
          console.warn(`⚠️ Failed to sync channel ${streamId}:`, err.message);
        }
      }

      // Pause between batches (except last batch)
      if (i + BATCH_SIZE < emptyChannels.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    console.log(`✅ Empty channels sync complete: ${synced}/${emptyChannels.length} synced`);

    return { synced, skipped: allStreamIds.length - emptyChannels.length };

  } catch (err) {
    console.error('❌ syncEmptyChannels failed:', err);
    return { synced: 0, skipped: 0, error: err.message };
  }
};

// ============================================================================
// CHANNEL LOGOS OVERRIDE SYSTEM
// ============================================================================

/**
 * Sync channel logos override from Google Apps Script JSON endpoint
 * @param {string} jsonUrl - URL to fetch JSON from (e.g., Google Apps Script deployment URL)
 * @returns {Promise<{success: boolean, inserted: number, cleared: number}>}
 */
export const syncChannelLogosOverride = async (jsonUrl) => {
  try {
    console.log('🔄 Syncing channel logos override from:', jsonUrl);
    
    // Fetch JSON from URL
    const response = await fetch(jsonUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.channels || !Array.isArray(data.channels)) {
      throw new Error('Invalid JSON format: missing channels array');
    }
    
    const db = getDatabase();
    
    // Clear old overrides
    await db.execute('DELETE FROM channel_logos_override');
    console.log('🗑️ Cleared old logo overrides');
    
    // Insert new overrides
    const statements = data.channels.map(ch => ({
      statement: `INSERT INTO channel_logos_override (channel_name, logo_url, match_patterns, channel_type, updated_at) VALUES (?, ?, ?, ?, strftime('%s', 'now'))`,
      values: [
        ch.name,
        ch.logo_url,
        JSON.stringify(ch.match_patterns || []),
        ch.type || null
      ],
    }));
    
    await db.executeSet(statements);
    
    console.log(`✅ Synced ${data.channels.length} premium channel logos`);
    
    return {
      success: true,
      inserted: data.channels.length,
      cleared: data.channels.length,
      version: data.version,
      last_updated: data.last_updated
    };
    
  } catch (err) {
    console.error('❌ syncChannelLogosOverride failed:', err);
    return { success: false, inserted: 0, cleared: 0, error: err.message };
  }
};

/**
 * Get premium logo override for a channel
 * @param {string} channelName - Name of the channel
 * @param {string} epgChannelId - EPG channel ID (optional)
 * @returns {Promise<string|null>} Premium logo URL or null
 */
export const getLogoOverride = async (channelName, epgChannelId = null) => {
  try {
    if (!channelName) return null;
    
    const rows = await querySql('SELECT logo_url, match_patterns FROM channel_logos_override');
    
    if (!rows || rows.length === 0) return null;
    
    const channelNameLower = channelName.toLowerCase().trim();
    const epgIdLower = epgChannelId ? epgChannelId.toLowerCase().trim() : null;
    
    for (const row of rows) {
      const patterns = JSON.parse(row.match_patterns || '[]');
      
      for (const pattern of patterns) {
        const patternLower = pattern.toLowerCase().trim();
        
        // Exact match
        if (channelNameLower === patternLower) {
          return row.logo_url;
        }
        
        // EPG ID match
        if (epgIdLower && epgIdLower === patternLower) {
          return row.logo_url;
        }
        
        // Contains match (for "VIP: TF1 RAW" matching "TF1")
        if (channelNameLower.includes(patternLower)) {
          return row.logo_url;
        }
      }
    }
    
    return null;
    
  } catch (err) {
    console.error('❌ getLogoOverride failed:', err);
    return null;
  }
};

/**
 * Get premium logo overrides for multiple channels (batch)
 * @param {Array} channels - Array of channel objects with name and epg_channel_id
 * @returns {Promise<Map>} Map of stream_id -> premium logo URL
 */
export const getLogoOverrideBatch = async (channels) => {
  try {
    if (!channels || channels.length === 0) return new Map();
    
    const rows = await querySql('SELECT logo_url, match_patterns FROM channel_logos_override');
    
    if (!rows || rows.length === 0) return new Map();
    
    const logoMap = new Map();
    
    for (const channel of channels) {
      const channelNameLower = (channel.name || '').toLowerCase().trim();
      const epgIdLower = channel.epg_channel_id ? channel.epg_channel_id.toLowerCase().trim() : null;
      
      for (const row of rows) {
        const patterns = JSON.parse(row.match_patterns || '[]');
        
        let matched = false;
        for (const pattern of patterns) {
          const patternLower = pattern.toLowerCase().trim();
          
          if (channelNameLower === patternLower || 
              (epgIdLower && epgIdLower === patternLower) ||
              channelNameLower.includes(patternLower)) {
            logoMap.set(channel.stream_id, row.logo_url);
            matched = true;
            break;
          }
        }
        
        if (matched) break;
      }
    }
    
    console.log(`✅ Matched ${logoMap.size}/${channels.length} channels with premium logos`);
    return logoMap;
    
  } catch (err) {
    console.error('❌ getLogoOverrideBatch failed:', err);
    return new Map();
  }
};

/**
 * Clear all logo overrides
 * @returns {Promise<{success: boolean, cleared: number}>}
 */
export const clearLogoOverrides = async () => {
  try {
    await executeSql('DELETE FROM channel_logos_override');
    console.log('🗑️ Cleared all logo overrides');
    return { success: true, cleared: 0 };
  } catch (err) {
    console.error('❌ clearLogoOverrides failed:', err);
    return { success: false, cleared: 0, error: err.message };
  }
};

/**
 * Get logo override statistics
 * @returns {Promise<{count: number, types: Array}>}
 */
export const getLogoOverrideStats = async () => {
  try {
    const countResult = await querySql('SELECT COUNT(*) as count FROM channel_logos_override');
    const typesResult = await querySql('SELECT channel_type, COUNT(*) as count FROM channel_logos_override GROUP BY channel_type');
    
    return {
      count: countResult[0]?.count || 0,
      types: typesResult || []
    };
  } catch (err) {
    console.error('❌ getLogoOverrideStats failed:', err);
    return { count: 0, types: [] };
  }
};

/**
 * Upgrade channels array with premium logos (mutates channel.logo in place)
 * Call this AFTER loading channels to progressively replace logos with premium versions
 * @param {Array} channels - Array of channel objects (will be mutated)
 * @returns {Promise<{upgraded: number, total: number}>}
 */
export const upgradeToPremiumLogos = async (channels) => {
  try {
    if (!channels || channels.length === 0) {
      return { upgraded: 0, total: 0 };
    }
    
    console.log(`🔄 Upgrading ${channels.length} channels with premium logos...`);
    
    // Get all logo overrides from DB
    const rows = await querySql('SELECT logo_url, match_patterns FROM channel_logos_override');
    
    if (!rows || rows.length === 0) {
      console.log('⚠️ No premium logos available in database');
      return { upgraded: 0, total: channels.length };
    }
    
    let upgraded = 0;
    
    // For each channel, check if we have a premium logo
    for (const channel of channels) {
      const channelName = channel.name || '';
      const epgChannelId = channel.epg_channel_id || channel.epgChannelId || null;
      
      if (!channelName) continue;
      
      const channelNameLower = channelName.toLowerCase().trim();
      const epgIdLower = epgChannelId ? epgChannelId.toLowerCase().trim() : null;
      
      // Try to find a match
      let matched = false;
      for (const row of rows) {
        const patterns = JSON.parse(row.match_patterns || '[]');
        
        for (const pattern of patterns) {
          const patternLower = pattern.toLowerCase().trim();
          
          // Exact match
          if (channelNameLower === patternLower) {
            channel.logo = row.logo_url;  // ← ÉCRASE le logo
            channel.stream_icon = row.logo_url;  // ← Pour compatibilité
            upgraded++;
            matched = true;
            break;
          }
          
          // EPG ID match
          if (epgIdLower && epgIdLower === patternLower) {
            channel.logo = row.logo_url;
            channel.stream_icon = row.logo_url;
            upgraded++;
            matched = true;
            break;
          }
          
          // Contains match (for "VIP: TF1 RAW" matching "TF1")
          if (channelNameLower.includes(patternLower)) {
            channel.logo = row.logo_url;
            channel.stream_icon = row.logo_url;
            upgraded++;
            matched = true;
            break;
          }
        }
        
        if (matched) break;
      }
    }
    
    console.log(`✅ Upgraded ${upgraded}/${channels.length} channels with premium logos`);
    
    return { upgraded, total: channels.length };
    
  } catch (err) {
    console.error('❌ upgradeToPremiumLogos failed:', err);
    return { upgraded: 0, total: channels.length };
  }
};

