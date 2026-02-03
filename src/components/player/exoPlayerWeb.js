// ============================================================================
// EXOPLAYER WEB FALLBACK - Uses HTML5 video for web platform
// ============================================================================

export class ExoPlayerWeb {
  constructor() {
    this.videoElement = null;
    this.listeners = {};
  }

  async initialize() {
    console.log('ExoPlayerWeb: Using HTML5 video fallback');
    return { success: true };
  }

  async play(options) {
    // Web fallback - handled by VideoPlayer component directly
    console.log('ExoPlayerWeb: play() - handled by HTML5 video');
    return { success: true, url: options.url };
  }

  async pause() {
    return { success: true };
  }

  async resume() {
    return { success: true };
  }

  async stop() {
    return { success: true };
  }

  async seekTo(options) {
    return { success: true };
  }

  async seekRelative(options) {
    return { success: true };
  }

  async setVolume(options) {
    return { success: true };
  }

  async getState() {
    return {
      isPlaying: false,
      currentPosition: 0,
      duration: 0,
      playbackState: 'idle',
    };
  }

  async destroy() {
    return { success: true };
  }

  addListener(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return {
      remove: () => {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      }
    };
  }
}

export default ExoPlayerWeb;
