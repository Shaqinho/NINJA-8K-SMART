// ============================================================================
// PROBE SERVICE - Universal track detection for VOD & SERIES
// ============================================================================
// Handles both VOD movies and SERIES episodes  
// Returns audio/subtitle tracks from libVLC probe or metadata
// ============================================================================

import { XtreamService } from './XtreamService';

// ============================================================================
// LANGUAGE MAPPING (31 langues)
// ============================================================================
const LANG_MAP = {
  // French
  fra: 'FRENCH', fre: 'FRENCH', fr: 'FRENCH',
  // English
  eng: 'ENGLISH', en: 'ENGLISH',
  // Turkish
  tur: 'TURKISH', tr: 'TURKISH',
  // Arabic
  ara: 'ARABIC', ar: 'ARABIC',
  // Spanish
  spa: 'SPANISH', esp: 'SPANISH', es: 'SPANISH',
  // German
  ger: 'GERMAN', deu: 'GERMAN', de: 'GERMAN',
  // Italian
  ita: 'ITALIAN', it: 'ITALIAN',
  // Portuguese
  por: 'PORTUGUESE', pt: 'PORTUGUESE',
  // Russian
  rus: 'RUSSIAN', ru: 'RUSSIAN',
  // Dutch
  dut: 'DUTCH', nld: 'DUTCH', nl: 'DUTCH',
  // Polish
  pol: 'POLISH', pl: 'POLISH',
  // Japanese
  jpn: 'JAPANESE', ja: 'JAPANESE',
  // Chinese
  chi: 'CHINESE', zho: 'CHINESE', zh: 'CHINESE',
  // Korean
  kor: 'KOREAN', ko: 'KOREAN',
  // Hindi
  hin: 'HINDI', hi: 'HINDI',
  // Greek
  gre: 'GREEK', ell: 'GREEK', el: 'GREEK',
  // Swedish
  swe: 'SWEDISH', sv: 'SWEDISH',
  // Norwegian
  nor: 'NORWEGIAN', no: 'NORWEGIAN',
  // Danish
  dan: 'DANISH', da: 'DANISH',
  // Finnish
  fin: 'FINNISH', fi: 'FINNISH',
  // Hebrew
  heb: 'HEBREW', he: 'HEBREW',
  // Romanian
  rum: 'ROMANIAN', ron: 'ROMANIAN', ro: 'ROMANIAN',
  // Hungarian
  hun: 'HUNGARIAN', hu: 'HUNGARIAN',
  // Czech
  cze: 'CZECH', ces: 'CZECH', cs: 'CZECH',
  // Vietnamese
  vie: 'VIETNAMESE', vi: 'VIETNAMESE',
  // Thai
  tha: 'THAI', th: 'THAI',
  // Indonesian
  ind: 'INDONESIAN', id: 'INDONESIAN',
  // Malay
  may: 'MALAY', msa: 'MALAY', ms: 'MALAY'
};

/**
 * Get language display name from code
 * @param {string} code - Language code (eng, fra, es, etc.)
 * @returns {string} Display name (ENGLISH, FRENCH, etc.)
 */
export const getLangName = (code) => {
  if (!code) return 'UNKNOWN';
  const cleanCode = code.toLowerCase().trim();
  return LANG_MAP[cleanCode] || cleanCode.toUpperCase();
};

// ============================================================================
// PROBE SERVICE
// ============================================================================
export const ProbeService = {
  
  /**
   * Probe tracks for VOD or SERIES episode
   * @param {Object} credentials - { server, username, password }
   * @param {Object} item - VOD or episode object with id/stream_id
   * @param {string} type - 'vod' or 'series'
   * @returns {Promise<Object>} { success, probeUrl, audioTracks, subtitleTracks, technical }
   */
  async probeTracks(credentials, item, type = 'vod') {
    try {
      const xtream = new XtreamService(credentials.server, credentials.username, credentials.password);
      let probeUrl = '';
      let metadata = {};
      
      if (type === 'vod') {
        // VOD: Use getVodDetailsWithProbeUrl
        console.log(`🔍 Probe VOD: ${item.name || item.id}`);
        const { info, probeUrl: url } = await xtream.getVodDetailsWithProbeUrl(item.id || item.stream_id);
        probeUrl = url;
        metadata = info;
      } else if (type === 'series') {
        // SERIES: Build episode probe URL manually
        console.log(`🔍 Probe SERIES Episode: ${item.title || item.id}`);
        const container = item.container_extension || 'mkv';
        probeUrl = `${credentials.server}/series/${credentials.username}/${credentials.password}/${item.id}.${container}`;
        metadata = item;
      } else {
        throw new Error(`Invalid type: ${type}. Must be 'vod' or 'series'`);
      }
      
      console.log(`🚀 Ninja Probe [${type.toUpperCase()}]: ${probeUrl}`);
      
      // ========== PROBE LOGIC ==========
      // Option 1: If libVLC player is available (NINJA 8K desktop app)
      if (window.vlcPlayer && typeof window.vlcPlayer.probeStream === 'function') {
        console.log('📡 Using libVLC probe...');
        const probeResult = await window.vlcPlayer.probeStream(probeUrl);
        
        return {
          success: true,
          probeUrl,
          audioTracks: this.formatTracks(probeResult.audioTracks || [], 'audio'),
          subtitleTracks: this.formatTracks(probeResult.subtitleTracks || [], 'subtitle'),
          technical: {
            codec: probeResult.video?.codec || this.getCodecFromContainer(item.container_extension),
            container: item.container_extension || 'mkv',
            resolution: probeResult.video?.width ? `${probeResult.video.width}×${probeResult.video.height}` : null
          }
        };
      }
      
      // Option 2: Check if metadata from API contains tracks (rare but possible)
      const apiAudio = metadata.info?.audio_tracks || metadata.audio_tracks || [];
      const apiSubs = metadata.info?.subtitle_tracks || metadata.subtitle_tracks || [];
      
      if (apiAudio.length > 0 || apiSubs.length > 0) {
        console.log('📊 Using API metadata tracks');
        return {
          success: true,
          probeUrl,
          audioTracks: this.formatTracks(apiAudio, 'audio'),
          subtitleTracks: this.formatTracks(apiSubs, 'subtitle'),
          technical: {
            codec: this.getCodecFromContainer(item.container_extension),
            container: item.container_extension || 'mkv'
          }
        };
      }
      
      // Option 3: No probe available - return URL for manual probe
      console.warn('⚠️ No probe method available. Returning probe URL only.');
      return {
        success: true,
        probeUrl,
        audioTracks: [],
        subtitleTracks: [],
        requiresManualProbe: true,
        message: 'Probe URL ready. Use libVLC or FFprobe for track detection.',
        technical: {
          codec: this.getCodecFromContainer(item.container_extension),
          container: item.container_extension || 'mkv'
        }
      };
      
    } catch (error) {
      console.error('❌ Probe Error:', error);
      return { 
        success: false, 
        error: error.message,
        audioTracks: [],
        subtitleTracks: []
      };
    }
  },
  
  /**
   * Format tracks for display
   * @param {Array} tracks - Array of track objects or strings
   * @param {string} trackType - 'audio' or 'subtitle'
   * @returns {Array} Formatted tracks
   */
  formatTracks(tracks, trackType = 'audio') {
    if (!Array.isArray(tracks)) return [];
    
    return tracks.map(track => {
      // If track is already a string, parse it
      if (typeof track === 'string') {
        return this.parseTrackString(track, trackType);
      }
      
      // If track is an object, format it
      return {
        language: track.language || track.lang || 'unknown',
        displayName: getLangName(track.language || track.lang || 'unknown'),
        codec: track.codec || track.codec_name || null,
        channels: trackType === 'audio' ? (track.channels || null) : null,
        label: track.label || null
      };
    });
  },
  
  /**
   * Parse track string like "FRENCH (5.1)" into object
   * @param {string} trackString - "FRENCH (5.1)" or "English (Full)"
   * @param {string} trackType - 'audio' or 'subtitle'
   * @returns {Object} Parsed track object
   */
  parseTrackString(trackString, trackType = 'audio') {
    const match = trackString.match(/^([A-Z]+)\s*(?:\((.+)\))?$/i);
    if (match) {
      const lang = match[1];
      const detail = match[2];
      
      return {
        language: lang.toLowerCase(),
        displayName: lang.toUpperCase(),
        codec: null,
        channels: trackType === 'audio' && detail ? detail : null,
        label: trackType === 'subtitle' && detail ? detail : null
      };
    }
    
    // Fallback: treat whole string as language
    return {
      language: trackString.toLowerCase(),
      displayName: trackString.toUpperCase(),
      codec: null,
      channels: null,
      label: null
    };
  },
  
  /**
   * Get codec from container extension
   * @param {string} container - mkv, mp4, avi, etc.
   * @returns {string} Codec name
   */
  getCodecFromContainer(container) {
    const codecMap = {
      'mkv': 'HEVC 4K',
      'mp4': 'H.264',
      'avi': 'H.264',
      'ts': 'MPEG-2',
      'webm': 'VP9'
    };
    return codecMap[container] || 'Unknown';
  }
};

export default ProbeService;
