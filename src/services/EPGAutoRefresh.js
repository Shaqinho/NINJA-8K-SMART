// ============================================================================
// EPG AUTO-REFRESH SERVICE
// Automatically refreshes EPG when next program starts
// ============================================================================
import { fetchAndStoreEPG, getProgramsForChannel } from './ProgramQueries';

/**
 * EPG Auto-Refresh Manager
 * Schedules automatic EPG refresh when next program starts
 */
export class EPGAutoRefresh {
  constructor(xtreamService) {
    if (!xtreamService) {
      throw new Error('XtreamService instance required');
    }
    this.xtream = xtreamService;
    this.timers = new Map(); // streamId -> timer
    this.scheduled = new Map(); // streamId -> { nextProgram, scheduledTime }
  }

  /**
   * Schedule refresh when NEXT program STARTS
   * @param {number} streamId - Channel stream ID
   * @param {Array} programs - Programs from DB
   */
  async scheduleRefresh(streamId, programs) {
    // Clear existing timer for this channel
    if (this.timers.has(streamId)) {
      clearTimeout(this.timers.get(streamId));
      this.timers.delete(streamId);
    }

    if (!programs || programs.length === 0) {
      console.log(`⚠️ No programs for channel ${streamId}, cannot schedule refresh`);
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    
    // Find CURRENT program (LIVE NOW)
    const currentProgram = programs.find(
      p => p.start_time <= now && p.end_time > now
    );
    
    if (!currentProgram) {
      // No current program, find NEXT one
      const nextProgram = programs.find(p => p.start_time > now);
      
      if (!nextProgram) {
        console.log(`⚠️ No upcoming programs for channel ${streamId}`);
        return;
      }
      
      // Schedule refresh when NEXT program STARTS
      const delay = (nextProgram.start_time - now) * 1000;
      this.scheduleTimer(streamId, nextProgram, delay);
      return;
    }

    // Find NEXT program (after current)
    const nextProgram = programs.find(
      p => p.start_time >= currentProgram.end_time
    );
    
    if (!nextProgram) {
      console.log(`⚠️ No next program after "${currentProgram.title}" on channel ${streamId}`);
      return;
    }

    // Calculate delay until NEXT program STARTS
    const delay = (nextProgram.start_time - now) * 1000;
    
    // Safety: max 24 hours
    if (delay > 86400000) {
      console.log(
        `⚠️ Next program too far away (${Math.round(delay / 3600000)}h) for channel ${streamId}, skipping auto-refresh`
      );
      return;
    }

    // Safety: min 1 minute (avoid too frequent refreshes)
    if (delay < 60000) {
      console.log(`⚠️ Next program too soon (${Math.round(delay / 1000)}s) for channel ${streamId}, skipping`);
      return;
    }

    this.scheduleTimer(streamId, nextProgram, delay);
  }

  /**
   * Schedule timer for refresh
   * @private
   */
  scheduleTimer(streamId, nextProgram, delay) {
    const scheduledTime = Date.now() + delay;
    const formattedTime = this.formatTime(nextProgram.start_time);
    const delayMinutes = Math.round(delay / 60000);

    console.log(
      `⏰ Channel ${streamId}: Auto-refresh in ${delayMinutes} min ` +
      `(when "${nextProgram.title}" starts at ${formattedTime})`
    );

    // Store scheduled info
    this.scheduled.set(streamId, {
      nextProgram: nextProgram.title,
      scheduledTime,
      startTime: nextProgram.start_time
    });

    // Create timer
    const timer = setTimeout(async () => {
      console.log(
        `🔄 "${nextProgram.title}" starting → Auto-refreshing EPG for channel ${streamId}`
      );
      
      try {
        // Fetch fresh EPG (4 programs)
        const result = await fetchAndStoreEPG(this.xtream, streamId, 4);
        
        if (result.success) {
          console.log(`✅ EPG refreshed for channel ${streamId}: ${result.count} programs`);
          
          // Get updated programs
          const updatedPrograms = await getProgramsForChannel(streamId, true);
          
          // Schedule next refresh (recursive)
          this.scheduleRefresh(streamId, updatedPrograms);
        } else {
          console.warn(`⚠️ EPG refresh failed for channel ${streamId}`);
        }
      } catch (err) {
        console.error(`❌ Auto-refresh error for channel ${streamId}:`, err);
      } finally {
        // Clean up
        this.timers.delete(streamId);
        this.scheduled.delete(streamId);
      }
    }, delay);

    // Store timer
    this.timers.set(streamId, timer);
  }

  /**
   * Stop auto-refresh for a specific channel
   * @param {number} streamId 
   */
  stop(streamId) {
    if (this.timers.has(streamId)) {
      clearTimeout(this.timers.get(streamId));
      this.timers.delete(streamId);
      this.scheduled.delete(streamId);
      console.log(`🛑 Auto-refresh stopped for channel ${streamId}`);
    }
  }

  /**
   * Stop all auto-refresh timers
   */
  stopAll() {
    this.timers.forEach((timer, streamId) => {
      clearTimeout(timer);
    });
    this.timers.clear();
    this.scheduled.clear();
    console.log(`🛑 All auto-refresh timers stopped (${this.timers.size} channels)`);
  }

  /**
   * Get scheduled refresh info for a channel
   * @param {number} streamId 
   * @returns {Object|null} Scheduled info or null
   */
  getScheduledInfo(streamId) {
    return this.scheduled.get(streamId) || null;
  }

  /**
   * Get all scheduled refreshes
   * @returns {Array} Array of {streamId, nextProgram, scheduledTime, startTime}
   */
  getAllScheduled() {
    const scheduled = [];
    this.scheduled.forEach((info, streamId) => {
      scheduled.push({ streamId, ...info });
    });
    return scheduled;
  }

  /**
   * Format Unix timestamp to HH:MM
   * @private
   */
  formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}

export default EPGAutoRefresh;
