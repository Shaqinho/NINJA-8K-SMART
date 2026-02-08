// ============================================================================
// GUIDE D'INTÉGRATION - LandingPage.jsx
// Modifications à apporter pour intégrer XMLTV + Background Sync
// ============================================================================

/*
ÉTAPE 1 : Imports à ajouter en haut du fichier
============================================
*/

import { loadXMLTV, syncEmptyChannels } from '../database/ProgramQueries';

/*
ÉTAPE 2 : Dans fetchXtreamData(), REMPLACER le Background EPG Sync
====================================================================

ANCIEN CODE (lignes 282-368) :
-------------------------------
// ============================================================
// BACKGROUND EPG SYNC - Gaming Style (Cercle 2)
// Batching 20ch max, 1000ms pause, vrais timestamps serveur
// ============================================================
const epgAbortController = new AbortController();
window.__epgAbortController = epgAbortController;
window.__epgSyncProgress = 0;

const startEpgBackgroundSync = async (allChannels, signal) => {
  const BATCH_SIZE = 20;
  const BATCH_DELAY = 1000;
  const streamIds = allChannels.map(ch => ch.id || ch.stream_id).filter(Boolean);
  const totalBatches = Math.ceil(streamIds.length / BATCH_SIZE);
  let batchesDone = 0;

  try {
    await cleanExpiredPrograms();
  } catch (cleanErr) {
    console.warn('⚠️ EPG cleanup skipped:', cleanErr);
  }

  for (let i = 0; i < streamIds.length; i += BATCH_SIZE) {
    if (signal.aborted) {
      console.log('🛑 EPG sync aborted');
      return;
    }

    const batchIds = streamIds.slice(i, i + BATCH_SIZE);

    try {
      const epgResults = await service.getShortEPGBatch(batchIds, 2, 20);

      if (signal.aborted) return;

      const epgForInsert = {};
      Object.entries(epgResults).forEach(([streamId, data]) => {
        const programs = [];
        if (data.epg_now) {
          programs.push({
            title: data.epg_now,
            start: data.epg_start || '',
            end: data.epg_end || '',
            startTimestamp: data.epg_start_timestamp || null,
            stopTimestamp: data.epg_end_timestamp || null,
            description: data.epg_description || '',
          });
        }
        if (data.epg_next) {
          programs.push({
            title: data.epg_next,
            start: data.epg_next_start || '',
            end: data.epg_next_end || '',
            startTimestamp: data.epg_next_start_timestamp || null,
            stopTimestamp: data.epg_next_end_timestamp || null,
            description: data.epg_next_description || '',
          });
        }
        if (programs.length > 0) {
          epgForInsert[streamId] = programs;
        }
      });

      if (Object.keys(epgForInsert).length > 0) {
        await insertProgramsBatch(epgForInsert);
      }
    } catch (batchErr) {
      console.warn(`⚠️ EPG batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, batchErr);
    }

    batchesDone++;
    window.__epgSyncProgress = Math.round((batchesDone / totalBatches) * 100);

    if (i + BATCH_SIZE < streamIds.length && !signal.aborted) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }

  window.__epgSyncProgress = 100;
  console.log(`✅ EPG background sync complete: ${streamIds.length} channels indexed`);
};

startEpgBackgroundSync(mappedLive, epgAbortController.signal).catch(err => {
  if (!epgAbortController.signal.aborted) {
    console.warn('⚠️ Background EPG sync failed:', err);
  }
});


NOUVEAU CODE (à mettre à la place) :
=====================================
*/

// ============================================================
// EPG LOADING - XMLTV (Fast) + Background Sync (Empty Channels)
// ============================================================

// Step 1: Load XMLTV (covers 70-80% of channels)
setProgress({ step: 'Loading XMLTV...', percent: 85 });

const xmltvResult = await loadXMLTV(service);

if (xmltvResult.success) {
  console.log(`✅ XMLTV: ${xmltvResult.channelsCount} channels, ${xmltvResult.programsCount} programs in ${xmltvResult.elapsed}s`);
} else {
  console.warn('⚠️ XMLTV load failed, will fallback to on-demand EPG');
}

// Step 2: Background sync for empty channels (folders 1-150)
// This runs AFTER navigation to player (non-blocking)
setTimeout(async () => {
  console.log('🔄 Starting background sync for empty channels...');
  
  const syncResult = await syncEmptyChannels(service, liveCategories);
  
  if (syncResult) {
    console.log(`✅ Background sync: ${syncResult.synced} channels synced, ${syncResult.skipped} skipped`);
  }
}, 3000); // Start 3 seconds after navigation

/*
ÉTAPE 3 : RÉSULTAT
==================

AVANT :
- 22 minutes de background sync (9000 channels)
- Batch EPG NOW/NEXT pour tous les channels
- Requêtes HTTP constantes

APRÈS :
- 34 secondes XMLTV load (70-80% channels)
- Background sync seulement pour empty channels (folders 1-150)
- Beaucoup moins de requêtes HTTP
- Expérience user ultra rapide

*/
