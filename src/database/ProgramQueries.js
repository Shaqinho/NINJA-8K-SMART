// ============================================================================
// PROGRAM QUERIES - CRUD Operations for EPG Search (Capacitor)
// ============================================================================
import { getDatabase, extractLangPrefix, normalizeText, querySql, executeSql } from './NinjaLocalDB';

// Insert Channels (bulk)
export const insertChannels = async (channels) => {
  if (!channels?.length) return 0;
  const db = getDatabase();
  const statements = channels.map(ch => ({
    statement: `INSERT OR REPLACE INTO channels (stream_id, name, lang_prefix, category_id, category_name, epg_channel_id, logo, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))`,
    values: [ch.id || ch.stream_id, ch.name || '', extractLangPrefix(ch.name), ch.categoryId || ch.category_id || null, ch.category || ch.category_name || null, ch.epgChannelId || ch.epg_channel_id || null, ch.logo || ch.stream_icon || null],
  }));
  await db.executeSet(statements);
  console.log(`✅ ${channels.length} channels inserted`);
  return channels.length;
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

const ProgramQueriesExports = { insertChannels, insertProgramsBatch, cleanExpiredPrograms, searchChannelsByName, getChannelsByLang, getAvailableLanguages, searchProgramsByTitle, searchProgramsByCategories, getNowByCategories, getStreamIdsByCategories, getProgramsForChannel, updateSyncStatus, getSyncStatus, isSyncNeeded };
export default ProgramQueriesExports;
