import { registerPlugin } from '@capacitor/core';
const Native = registerPlugin('ExoPlayerPlugin');

let isInitialized = false;

export const exoPlayer = {
  /**
   * Initialize the player (must be called before play)
   */
  async initialize() {
    if (isInitialized) return true;
    try {
      await Native.initialize();
      isInitialized = true;
      console.log('[ExoPlayer] Initialized successfully');
      return true;
    } catch (e) {
      console.error('[ExoPlayer] Initialize failed:', e);
      return false;
    }
  },

  /**
   * Play a stream URL
   */
  async play(url) {
    try {
      // CRITICAL: Initialize first if not done
      if (!isInitialized) {
        const initResult = await this.initialize();
        if (!initResult) {
          console.error('[ExoPlayer] Cannot play - initialization failed');
          return false;
        }
      }
      
      await Native.play({
        url,
        autoPlay: true
      });
      console.log('[ExoPlayer] Playing:', url);
      return true;
    } catch (e) {
      console.error('[ExoPlayer] Play failed:', e);
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
      console.error('[ExoPlayer] Pause failed:', e);
    }
  },

  /**
   * Stop playback and hide player
   */
  async stop() { 
    try {
      await Native.stop(); 
    } catch (e) {
      console.error('[ExoPlayer] Stop failed:', e);
    }
  },

  /**
   * Set player position (for positioning behind WebView)
   */
  async setPosition(top, left, width, height) {
    try {
      await Native.setPosition({ top, left, width, height });
    } catch (e) {
      console.error('[ExoPlayer] SetPosition failed:', e);
    }
  },

  /**
   * Set volume (0.0 to 1.0)
   */
  async setVolume(volume) {
    try {
      await Native.setVolume({ volume });
    } catch (e) {
      console.error('[ExoPlayer] SetVolume failed:', e);
    }
  },

  /**
   * Get current player state
   */
  async getState() {
    try {
      return await Native.getState();
    } catch (e) {
      console.error('[ExoPlayer] GetState failed:', e);
      return null;
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
      console.error('[ExoPlayer] Destroy failed:', e);
    }
  }
};
