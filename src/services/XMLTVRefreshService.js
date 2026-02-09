// ============================================================================
// XMLTV BACKGROUND REFRESH SERVICE
// Refresh EPG bulk toutes les 5 minutes (si nécessaire)
// ============================================================================

import { loadXMLTV, getSyncStatus } from '../database/ProgramQueries';

/**
 * XMLTV Background Refresh Manager
 * Refreshes XMLTV EPG every 5 minutes in background
 */
export class XMLTVRefreshService {
  constructor(xtreamService) {
    if (!xtreamService) {
      throw new Error('XtreamService instance required');
    }
    this.xtream = xtreamService;
    this.intervalId = null;
    this.isRefreshing = false;
  }

  /**
   * Start background refresh (every 5 minutes)
   */
  start() {
    if (this.intervalId) {
      console.warn('⚠️ XMLTV refresh already running');
      return;
    }

    console.log('🔄 Starting XMLTV background refresh (5 min interval)');

    // Check immediately, then every 5 minutes
    this.checkAndRefresh();

    this.intervalId = setInterval(() => {
      this.checkAndRefresh();
    }, 300000); // 5 minutes
  }

  /**
   * Stop background refresh
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 XMLTV background refresh stopped');
    }
  }

  /**
   * Check if refresh needed and execute
   */
  async checkAndRefresh() {
    if (this.isRefreshing) {
      console.log('⏳ XMLTV refresh already in progress, skipping...');
      return;
    }

    try {
      this.isRefreshing = true;

      const shouldRefresh = await this.shouldRefreshXMLTV();

      if (shouldRefresh) {
        console.log('🔄 XMLTV refresh needed, starting...');

        const startTime = Date.now();
        const result = await loadXMLTV(this.xtream);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (result.success) {
          console.log(
            `✅ XMLTV refreshed in ${elapsed}s: ${result.channelsCount} channels, ${result.programsCount} programs`
          );
        } else if (result.reason === 'timeout') {
          console.warn(
            `⚠️ XMLTV fetch took ${result.fetchTime?.toFixed(1)}s (>60s), skipped storage`
          );
        } else {
          console.error('❌ XMLTV refresh failed:', result.error);
        }
      } else {
        console.log('✅ XMLTV still fresh, no refresh needed');
      }
    } catch (err) {
      console.error('❌ XMLTV refresh error:', err);
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Check if XMLTV refresh is needed
   * Returns true if:
   * - No previous sync
   * - Last sync > 5 minutes ago
   */
  async shouldRefreshXMLTV() {
    try {
      const syncStatus = await getSyncStatus('xmltv');

      if (!syncStatus) {
        console.log('📭 No XMLTV sync found, refresh needed');
        return true;
      }

      const now = Math.floor(Date.now() / 1000);
      const timeSinceSync = now - syncStatus.last_sync;
      const minutesSinceSync = Math.floor(timeSinceSync / 60);

      // Refresh if > 5 minutes
      if (timeSinceSync > 300) {
        console.log(`⏰ Last XMLTV sync was ${minutesSinceSync} min ago, refresh needed`);
        return true;
      }

      console.log(`✅ Last XMLTV sync was ${minutesSinceSync} min ago, still fresh`);
      return false;
    } catch (err) {
      console.error('❌ Error checking XMLTV sync status:', err);
      return true; // Refresh on error to be safe
    }
  }

  /**
   * Force immediate refresh
   */
  async forceRefresh() {
    console.log('🔄 Force XMLTV refresh...');
    await this.checkAndRefresh();
  }

  /**
   * Get refresh status
   */
  getStatus() {
    return {
      isRunning: this.intervalId !== null,
      isRefreshing: this.isRefreshing,
    };
  }
}

export default XMLTVRefreshService;
