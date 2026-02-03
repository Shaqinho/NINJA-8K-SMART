// ============================================================================
// NINJA SYNC SERVICE - EPG Synchronization
// ============================================================================
import { openDatabase } from '../database/NinjaLocalDB';
import { insertChannels, insertProgramsBatch, updateSyncStatus, isSyncNeeded, getChannelsByLang } from '../database/ProgramQueries';

const SYNC_CONFIG = {
  AUTO_SYNC_INTERVAL: 15 * 60 * 1000,
  MANUAL_RELOAD_DEBOUNCE: 60 * 1000,
  EPG_BATCH_SIZE: 10,
  EPG_LIMIT_DEFAULT: 4,
  MAX_CHANNELS_PER_SYNC: 1000,
};

let syncState = { isRunning: false, lastManualReload: 0, autoSyncTimer: null, currentProgress: 0, totalChannels: 0, onProgressCallback: null };

export const initSyncService = async (onProgress = null) => {
  await openDatabase();
  syncState.onProgressCallback = onProgress;
  console.log('✅ NinjaSyncService: Initialized');
  return true;
};

export const startAutoSync = (xtreamService, defaultLangFilters = []) => {
  stopAutoSync();
  syncState.autoSyncTimer = setInterval(async () => {
    try { await syncEPGForLanguages(xtreamService, defaultLangFilters, true, false); } catch (e) { console.error('Auto-sync failed:', e); }
  }, SYNC_CONFIG.AUTO_SYNC_INTERVAL);
};

export const stopAutoSync = () => {
  if (syncState.autoSyncTimer) { clearInterval(syncState.autoSyncTimer); syncState.autoSyncTimer = null; }
};

export const manualReload = async (xtreamService, langFilters = [], includeVip = true) => {
  const now = Date.now();
  const timeSince = now - syncState.lastManualReload;
  if (timeSince < SYNC_CONFIG.MANUAL_RELOAD_DEBOUNCE) {
    const remaining = Math.ceil((SYNC_CONFIG.MANUAL_RELOAD_DEBOUNCE - timeSince) / 1000);
    return { success: false, debounced: true, message: `Patientez ${remaining}s`, remainingSeconds: remaining };
  }
  syncState.lastManualReload = now;
  try {
    const result = await syncEPGForLanguages(xtreamService, langFilters, includeVip, true);
    return { success: true, debounced: false, message: `EPG rechargé: ${result.programsCount} programmes`, ...result };
  } catch (error) {
    return { success: false, debounced: false, message: `Erreur: ${error.message}`, error };
  }
};

export const getDebounceRemaining = () => {
  const timeSince = Date.now() - syncState.lastManualReload;
  return timeSince >= SYNC_CONFIG.MANUAL_RELOAD_DEBOUNCE ? 0 : Math.ceil((SYNC_CONFIG.MANUAL_RELOAD_DEBOUNCE - timeSince) / 1000);
};

export const syncChannels = async (xtreamService) => {
  const categories = await xtreamService.getLiveCategories();
  const streams = await xtreamService.getLiveStreams();
  const parsed = xtreamService.parseLiveStreams(streams, categories);
  return await insertChannels(parsed);
};

export const syncEPGForLanguages = async (xtreamService, langFilters = [], includeVip = true, forceRefresh = false) => {
  if (syncState.isRunning) return { channelsCount: 0, programsCount: 0, method: 'skipped' };
  const syncKey = langFilters.length ? `lang_${langFilters.join('_')}${includeVip ? '_vip' : ''}` : 'all';
  if (!forceRefresh && !(await isSyncNeeded(syncKey, SYNC_CONFIG.AUTO_SYNC_INTERVAL / 1000))) {
    return { channelsCount: 0, programsCount: 0, method: 'cached' };
  }
  syncState.isRunning = true;
  syncState.currentProgress = 0;
  try {
    await syncChannels(xtreamService);
    const channels = await getChannelsByLang(langFilters, includeVip);
    if (!channels.length) { syncState.isRunning = false; return { channelsCount: 0, programsCount: 0, method: 'no_channels' }; }
    const toSync = channels.slice(0, SYNC_CONFIG.MAX_CHANNELS_PER_SYNC);
    syncState.totalChannels = toSync.length;
    let result = await tryXMLTVSync(xtreamService, toSync);
    if (!result.success) result = await syncWithShortEPG(xtreamService, toSync);
    await updateSyncStatus(syncKey, result.method, toSync.length, result.programsCount);
    syncState.isRunning = false;
    return { channelsCount: toSync.length, programsCount: result.programsCount, method: result.method };
  } catch (error) {
    syncState.isRunning = false;
    throw error;
  }
};

const tryXMLTVSync = async (xtreamService, channels) => {
  try {
    const xmltvData = await xtreamService.getXMLTV();
    if (!xmltvData || !Object.keys(xmltvData).length) return { success: false, programsCount: 0, method: 'xmltv_empty' };
    const epgMap = {};
    channels.forEach(ch => { if (ch.epg_channel_id) epgMap[ch.epg_channel_id] = ch.stream_id; });
    const programsData = {};
    let total = 0;
    for (const [epgId, progs] of Object.entries(xmltvData)) {
      const streamId = epgMap[epgId];
      if (streamId && progs?.length) {
        programsData[streamId] = progs.map(p => ({ title: p.title, description: p.description, start: p.start, end: p.end, startTimestamp: Math.floor(new Date(p.start).getTime() / 1000), stopTimestamp: Math.floor(new Date(p.end).getTime() / 1000) }));
        total += progs.length;
      }
    }
    if (!total) return { success: false, programsCount: 0, method: 'xmltv_no_match' };
    await insertProgramsBatch(programsData);
    return { success: true, programsCount: total, method: 'xmltv' };
  } catch (error) {
    return { success: false, programsCount: 0, method: 'xmltv_error' };
  }
};

const syncWithShortEPG = async (xtreamService, channels, limit = SYNC_CONFIG.EPG_LIMIT_DEFAULT) => {
  const streamIds = channels.map(ch => ch.stream_id);
  const programsData = {};
  let total = 0;
  let processed = 0;
  
  const processBatch = async (batch) => {
    const results = await Promise.all(batch.map(async (id) => {
      try {
        const progs = await xtreamService.getShortEPG(id, limit);
        if (progs?.length) { 
          programsData[id] = progs; 
          return progs.length; 
        }
      } catch (e) { /* skip */ }
      return 0;
    }));
    return results.reduce((sum, count) => sum + count, 0);
  };
  
  for (let i = 0; i < streamIds.length; i += SYNC_CONFIG.EPG_BATCH_SIZE) {
    const batch = streamIds.slice(i, i + SYNC_CONFIG.EPG_BATCH_SIZE);
    const batchTotal = await processBatch(batch);
    total += batchTotal;
    processed += batch.length;
    syncState.currentProgress = Math.round((processed / streamIds.length) * 100);
    if (syncState.onProgressCallback) syncState.onProgressCallback({ current: processed, total: streamIds.length, percent: syncState.currentProgress });
  }
  if (total) await insertProgramsBatch(programsData);
  return { success: true, programsCount: total, method: 'short_epg' };
};

export const syncSingleChannel = async (xtreamService, streamId, limit = 20) => {
  try {
    const progs = await xtreamService.getShortEPG(streamId, limit);
    if (progs?.length) { await insertProgramsBatch({ [streamId]: progs }); return { success: true, programsCount: progs.length }; }
    return { success: true, programsCount: 0 };
  } catch (error) {
    return { success: false, programsCount: 0, error };
  }
};

export const isSyncRunning = () => syncState.isRunning;
export const getSyncProgress = () => ({ current: Math.round((syncState.currentProgress / 100) * syncState.totalChannels), total: syncState.totalChannels, percent: syncState.currentProgress });
export const setProgressCallback = (cb) => { syncState.onProgressCallback = cb; };

const NinjaSyncServiceExports = { initSyncService, startAutoSync, stopAutoSync, syncChannels, syncEPGForLanguages, syncSingleChannel, manualReload, isSyncRunning, getSyncProgress, getDebounceRemaining, setProgressCallback, SYNC_CONFIG };
export default NinjaSyncServiceExports;
