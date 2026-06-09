import { registerPlugin } from '@capacitor/core';

const Native = registerPlugin('LibVLCPlugin');

let isInitialized = false;

export const libVLC = {
  /**
   * Initialize the player (must be called before play)
   */
  async initialize() {
    if (isInitialized) return true;
    
    try {
      await Native.initialize();
      isInitialized = true;
      console.log('[LibVLC] Initialized successfully');
      return true;
    } catch (e) {
      console.error('[LibVLC] Initialize failed:', e);
      return false;
    }
  },

  /**
   * Play a stream URL (.ts, .m3u8, .mp4, etc.)
   */
  async play(url) {
    try {
      // CRITICAL: Initialize first if not done
      if (!isInitialized) {
        const initResult = await this.initialize();
        if (!initResult) {
          console.error('[LibVLC] Cannot play - initialization failed');
          return false;
        }
      }
      
      await Native.play({
        url,
        autoPlay: true
      });
      console.log('[LibVLC] Playing:', url);
      return true;
    } catch (e) {
      console.error('[LibVLC] Play failed:', e);
      return false;
    }
  },

  /**
   * Pause playback
   */
  async pause() { 
    try {
      await Native.pause(); 
    } catch (e) {
      console.error('[LibVLC] Pause failed:', e);
    }
  },

  /**
   * Resume playback
   */
  async resume() { 
    try {
      await Native.resume(); 
    } catch (e) {
      console.error('[LibVLC] Resume failed:', e);
    }
  },

  /**
   * Stop playback and hide player
   */
  async stop() { 
    try {
      await Native.stop(); 
    } catch (e) {
      console.error('[LibVLC] Stop failed:', e);
    }
  },

  /**
   * Set player position (for positioning behind WebView)
   */
  async setPosition(top, left, width, height) {
    try {
      await Native.setPosition({ top, left, width, height });
    } catch (e) {
      console.error('[LibVLC] SetPosition failed:', e);
    }
  },

  /**
   * Set fullscreen mode
   */
  async setFullscreen(fullscreen) {
    try {
      await Native.setFullscreen({ fullscreen });
    } catch (e) {
      console.error('[LibVLC] SetFullscreen failed:', e);
    }
  },

  /**
   * Set volume (0 to 200 for LibVLC)
   */
  async setVolume(volume) {
    try {
      // Convert 0.0-1.0 to 0-200 for LibVLC
      const vlcVolume = Math.round(volume * 200);
      await Native.setVolume({ volume: vlcVolume });
    } catch (e) {
      console.error('[LibVLC] SetVolume failed:', e);
    }
  },

  /**
   * Seek to position (in milliseconds)
   */
  async seekTo(position) {
    try {
      await Native.seekTo({ position });
    } catch (e) {
      console.error('[LibVLC] SeekTo failed:', e);
    }
  },

  /**
   * Get current player state
   */
  async getState() {
    try {
      return await Native.getState();
    } catch (e) {
      console.error('[LibVLC] GetState failed:', e);
      return null;
    }
  },

  /**
   * Probe a stream URL WITHOUT playing it (parse-only).
   * Returns { audioTracks:[{id,language,channels,name}], subtitleTracks:[{id,language,name}], video:{width,height} }
   */
  async probeStream(url) {
    try {
      return await Native.probeStream({ url });
    } catch (e) {
      console.error('[LibVLC] probeStream failed:', e);
      return { audioTracks: [], subtitleTracks: [], video: null };
    }
  },

  /**
   * Get audio tracks { count, tracks: [{ id, name }] }
   */
  async getAudioTracks() {
    try {
      return await Native.getAudioTracks();
    } catch (e) {
      console.error('[LibVLC] GetAudioTracks failed:', e);
      return { count: 0, tracks: [] };
    }
  },

  /**
   * Get subtitle tracks { count, tracks: [{ id, name }] }
   */
  async getSubtitleTracks() {
    try {
      return await Native.getSubtitleTracks();
    } catch (e) {
      console.error('[LibVLC] GetSubtitleTracks failed:', e);
      return { count: 0, tracks: [] };
    }
  },

  /**
   * Select audio track by id (from getAudioTracks)
   */
  async setAudioTrack(id) {
    try {
      await Native.setAudioTrack({ id });
    } catch (e) {
      console.error('[LibVLC] SetAudioTrack failed:', e);
    }
  },

  /**
   * Select subtitle track by id (-1 = disable)
   */
  async setSubtitleTrack(id) {
    try {
      await Native.setSubtitleTrack({ id });
    } catch (e) {
      console.error('[LibVLC] SetSubtitleTrack failed:', e);
    }
  },

  /**
   * Destroy player and release resources
   */
  async destroy() {
    try {
      await Native.destroy();
      isInitialized = false;
    } catch (e) {
      console.error('[LibVLC] Destroy failed:', e);
    }
  }
};

// Also export as default for easy import
export default libVLC;
