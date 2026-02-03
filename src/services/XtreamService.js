// ========================= XTREAM SERVICE =========================
// 
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                        XTREAM API ENDPOINTS REFERENCE                        ║
// ╠══════════════════════════════════════════════════════════════════════════════╣
// ║ ENDPOINT                          │ METHOD              │ STATUS             ║
// ╠═══════════════════════════════════╪═════════════════════╪════════════════════╣
// ║ AUTH (player_api.php sans action) │ authenticate()      │ ✅ UTILISÉ         ║
// ╠═══════════════════════════════════╪═════════════════════╪════════════════════╣
// ║ LIVE                                                                         ║
// ║ get_live_categories               │ getLiveCategories() │ ✅ UTILISÉ         ║
// ║ get_live_streams                  │ getLiveStreams()    │ ✅ UTILISÉ         ║
// ╠═══════════════════════════════════╪═════════════════════╪════════════════════╣
// ║ VOD (MOVIES)                                                                 ║
// ║ get_vod_categories                │ getVodCategories()  │ ✅ UTILISÉ         ║
// ║ get_vod_streams                   │ getVodStreams()     │ ✅ UTILISÉ         ║
// ║ get_vod_info                      │ getVodInfo()        │ ✅ UTILISÉ (Hub)   ║
// ╠═══════════════════════════════════╪═════════════════════╪════════════════════╣
// ║ SERIES                                                                       ║
// ║ get_series_categories             │ getSeriesCategories()│ ✅ UTILISÉ        ║
// ║ get_series                        │ getSeries()         │ ✅ UTILISÉ         ║
// ║ get_series_info                   │ getSeriesInfo()     │ ✅ UTILISÉ (Hub)   ║
// ╠═══════════════════════════════════╪═════════════════════╪════════════════════╣
// ║ EPG                                                                          ║
// ║ get_short_epg                     │ getShortEPG()       │ ✅ UTILISÉ         ║
// ║ get_simple_data_table             │ getFullEPG()        │ ✅ UTILISÉ         ║
// ║ xmltv.php                         │ getXMLTV()          │ 🔶 RÉSERVÉ FUTUR   ║
// ╠═══════════════════════════════════╪═════════════════════╪════════════════════╣
// ║ EXPORT                                                                       ║
// ║ get.php (M3U export)              │ getM3UExport()      │ 🔶 RÉSERVÉ FUTUR   ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
//
// ========================= FIN REFERENCE =========================

export class XtreamService {
  constructor(server, username, password) {
    this.server = server.replace(/\/$/, '');
    this.username = username;
    this.password = password;
  }

  // ========================= AUTH =========================
  async authenticate() {
    const url = `${this.server}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Authentication failed');
    const data = await res.json();
    if (data.user_info?.auth === 0) throw new Error('Invalid credentials');
    return {
      user: data.user_info,
      serverInfo: data.server_info,
      expirationDate: data.user_info?.exp_date ? new Date(data.user_info.exp_date * 1000).toISOString() : null,
    };
  }

  // ========================= LIVE =========================
  async getLiveCategories() {
    const url = `${this.server}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_live_categories`;
    const res = await fetch(url);
    return res.json();
  }

  async getLiveStreams(categoryId = null) {
    let url = `${this.server}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_live_streams`;
    if (categoryId) url += `&category_id=${categoryId}`;
    const res = await fetch(url);
    return res.json();
  }

  // ========================= VOD =========================
  async getVodCategories() {
    const url = `${this.server}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_vod_categories`;
    const res = await fetch(url);
    return res.json();
  }

  async getVodStreams(categoryId = null) {
    let url = `${this.server}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_vod_streams`;
    if (categoryId) url += `&category_id=${categoryId}`;
    const res = await fetch(url);
    return res.json();
  }

  /**
   * Get detailed VOD info (cast, director, plot, TMDB data, etc.)
   * @param {number|string} vodId - The VOD stream ID
   * @returns {Promise<Object>} - Detailed movie information
   * 
   * Response includes:
   * - info: { movie_image, tmdb_id, name, o_name, plot, cast, director, genre, release_date, duration, rating, etc. }
   * - movie_data: { stream_id, container_extension, etc. }
   */
  async getVodInfo(vodId) {
    const url = `${this.server}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_vod_info&vod_id=${vodId}`;
    const res = await fetch(url);
    return res.json();
  }

  // ========================= SERIES =========================
  async getSeriesCategories() {
    const url = `${this.server}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_series_categories`;
    const res = await fetch(url);
    return res.json();
  }

  async getSeries(categoryId = null) {
    let url = `${this.server}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_series`;
    if (categoryId) url += `&category_id=${categoryId}`;
    const res = await fetch(url);
    return res.json();
  }

  /**
   * Get detailed series info (seasons, episodes, cast, etc.)
   * @param {number|string} seriesId - The series ID
   * @returns {Promise<Object>} - Detailed series information
   * 
   * Response includes:
   * - info: { name, cover, plot, cast, director, genre, release_date, rating, etc. }
   * - seasons: Array of season objects
   * - episodes: { "season_number": [{ id, episode_num, title, container_extension, info, etc. }] }
   */
  async getSeriesInfo(seriesId) {
    const url = `${this.server}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_series_info&series_id=${seriesId}`;
    const res = await fetch(url);
    return res.json();
  }

  // ========================= EPG =========================
  
  /**
   * Get short EPG for a single stream (current + next programs)
   */
  async getShortEPG(streamId, limit = 4) {
    const url = `${this.server}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_short_epg&stream_id=${streamId}&limit=${limit}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data.epg_listings) return [];
    
    return data.epg_listings.map(prog => ({
      title: this.decodeBase64UTF8(prog.title),
      description: this.decodeBase64UTF8(prog.description),
      start: prog.start,
      end: prog.end,
      startTimestamp: prog.start_timestamp,
      stopTimestamp: prog.stop_timestamp,
    }));
  }

  /**
   * Get short EPG for multiple streams in batch
   * Returns object: { streamId: { epg_now, epg_start, epg_end, progress } }
   */
  async getShortEPGBatch(streamIds, limit = 2, concurrency = 10) {
    const results = {};
    
    // Process in batches to avoid overwhelming the server
    for (let i = 0; i < streamIds.length; i += concurrency) {
      const batch = streamIds.slice(i, i + concurrency);
      
      const promises = batch.map(async (streamId) => {
        try {
          const epg = await this.getShortEPG(streamId, limit);
          if (epg && epg.length > 0) {
            const now = Date.now() / 1000;
            const current = epg.find(p => p.startTimestamp <= now && p.stopTimestamp > now) || epg[0];
            
            if (current) {
              const start = current.startTimestamp || 0;
              const end = current.stopTimestamp || 0;
              const progress = end > start ? Math.round(((now - start) / (end - start)) * 100) : 0;
              
              results[streamId] = {
                epg_now: current.title,
                epg_start: current.start ? current.start.split(' ')[1]?.substring(0, 5) : '',
                epg_end: current.end ? current.end.split(' ')[1]?.substring(0, 5) : '',
                progress: Math.min(100, Math.max(0, progress)),
              };
            }
          }
        } catch (err) {
          console.warn(`EPG fetch failed for stream ${streamId}:`, err.message);
        }
      });
      
      await Promise.all(promises);
    }
    
    return results;
  }

  /**
   * Get full EPG from XMLTV endpoint
   * Returns object: { channelId: [{ title, description, start, end }] }
   * 
   * 🔶 RÉSERVÉ FUTUR - Fichier potentiellement très volumineux (100-500MB)
   * Non recommandé pour recherche temps réel sur 47k chaînes
   */
  async getXMLTV() {
    const url = `${this.server}/xmltv.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`;
    
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`XMLTV fetch failed: ${res.status}`);
      
      const xmlText = await res.text();
      return this.parseXMLTV(xmlText);
    } catch (err) {
      console.error('XMLTV fetch error:', err);
      return {};
    }
  }

  /**
   * Parse XMLTV XML format to usable object
   */
  parseXMLTV(xmlText) {
    const epgData = {};
    
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      // Check for parse errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.error('XMLTV parse error');
        return {};
      }
      
      // Get all programmes
      const programmes = xmlDoc.querySelectorAll('programme');
      
      programmes.forEach(prog => {
        const channelId = prog.getAttribute('channel');
        const startStr = prog.getAttribute('start');
        const stopStr = prog.getAttribute('stop');
        
        if (!channelId || !startStr) return;
        
        // Parse XMLTV date format: "20250123180000 +0000"
        const parseXMLTVDate = (str) => {
          if (!str) return null;
          // Extract YYYYMMDDHHMMSS
          const match = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
          if (!match) return null;
          const [, year, month, day, hour, min, sec] = match;
          // Extract timezone offset if present
          const tzMatch = str.match(/([+-])(\d{2})(\d{2})$/);
          let tzOffset = 0;
          if (tzMatch) {
            const [, sign, hours, mins] = tzMatch;
            tzOffset = (parseInt(hours) * 60 + parseInt(mins)) * (sign === '-' ? -1 : 1);
          }
          const date = new Date(Date.UTC(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(min),
            parseInt(sec)
          ));
          // Adjust for timezone
          date.setMinutes(date.getMinutes() - tzOffset);
          return date.toISOString();
        };
        
        const titleEl = prog.querySelector('title');
        const descEl = prog.querySelector('desc');
        
        const program = {
          title: titleEl?.textContent || 'Sans titre',
          description: descEl?.textContent || '',
          start: parseXMLTVDate(startStr),
          end: parseXMLTVDate(stopStr),
        };
        
        if (!epgData[channelId]) {
          epgData[channelId] = [];
        }
        epgData[channelId].push(program);
      });
      
      // Sort each channel's programs by start time
      Object.keys(epgData).forEach(channelId => {
        epgData[channelId].sort((a, b) => new Date(a.start) - new Date(b.start));
      });
      
      console.log(`✅ XMLTV parsed: ${Object.keys(epgData).length} channels`);
      return epgData;
      
    } catch (err) {
      console.error('XMLTV parse error:', err);
      return {};
    }
  }

  /**
   * Get full EPG for a single stream (alternative endpoint)
   */
  async getFullEPG(streamId = null) {
    let url = `${this.server}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_simple_data_table`;
    if (streamId) url += `&stream_id=${streamId}`;
    const res = await fetch(url);
    return res.json();
  }

  // ========================= EXPORT =========================

  /**
   * Get full M3U playlist export
   * 
   * 🔶 RÉSERVÉ FUTUR - Actuellement remplacé par Xtream API
   * 
   * @param {string} type - Output type: 'm3u_plus' (default), 'm3u', 'ts', 'rtmp'
   * @param {string} output - Stream format: 'ts' (default), 'm3u8', 'rtmp'
   * @returns {Promise<string>} - M3U playlist content
   */
  async getM3UExport(type = 'm3u_plus', output = 'ts') {
    const url = `${this.server}/get.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&type=${type}&output=${output}`;
    const res = await fetch(url);
    return res.text();
  }

  // ========================= PARSERS =========================
  parseLiveStreams(data, categories) {
    if (!Array.isArray(data)) return [];
    const catMap = {};
    categories?.forEach(c => { catMap[c.category_id] = c.category_name; });
    return data.map(stream => ({
      id: stream.stream_id,
      name: stream.name,
      type: 'live',
      category: catMap[stream.category_id] || 'Other',
      categoryId: stream.category_id,
      logo: stream.stream_icon || null,
      epgChannelId: stream.epg_channel_id,
      streamUrl: `${this.server}/live/${this.username}/${this.password}/${stream.stream_id}.ts`,
    }));
  }

  parseVodStreams(data, categories) {
    if (!Array.isArray(data)) return [];
    const catMap = {};
    categories?.forEach(c => { catMap[c.category_id] = c.category_name; });
    return data.map(stream => ({
      id: stream.stream_id,
      name: stream.name,
      type: 'vod',
      category: catMap[stream.category_id] || 'Other',
      categoryId: stream.category_id,
      logo: stream.stream_icon || null,
      rating: stream.rating || null,
      year: stream.year || null,
      genre: stream.genre || null,
      plot: stream.plot || null,
      streamUrl: `${this.server}/movie/${this.username}/${this.password}/${stream.stream_id}.mp4`,
    }));
  }

  parseSeries(data, categories) {
    if (!Array.isArray(data)) return [];
    const catMap = {};
    categories?.forEach(c => { catMap[c.category_id] = c.category_name; });
    return data.map(series => ({
      id: series.series_id,
      name: series.name,
      type: 'series',
      category: catMap[series.category_id] || 'Other',
      categoryId: series.category_id,
      logo: series.cover || null,
      rating: series.rating || null,
      year: series.year || null,
      genre: series.genre || null,
      plot: series.plot || null,
    }));
  }

  // ========================= UTILITIES =========================
  
  /**
   * Decode Base64 string with proper UTF-8 support
   * Fixes accented characters like "vérité" appearing as "vÃ©ritÃ©"
   */
  decodeBase64UTF8(str) {
    if (!str) return '';
    try {
      // Decode Base64 to binary string
      const binaryStr = atob(str);
      
      // Convert binary string to Uint8Array
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      
      // Decode UTF-8 bytes to string
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes);
    } catch {
      // If Base64 decode fails, return original string (might not be encoded)
      return str;
    }
  }

  /**
   * @deprecated Use decodeBase64UTF8 instead
   */
  decodeBase64(str) {
    return this.decodeBase64UTF8(str);
  }

  normalizeData(rawData, providerName) {
    if (!Array.isArray(rawData)) return [];
    return rawData.map(item => ({
      uid: `${providerName}_${item.stream_id || item.series_id || item.movie_id}`,
      streamId: item.stream_id || item.series_id || item.movie_id,
      name: item.name,
      logo: item.stream_icon || item.cover,
      categoryId: item.category_id,
      epgChannelId: item.epg_channel_id || null,
      provider: providerName,
    }));
  }

  // ========================= SQL DEEP SEARCH EPG =========================

  /**
   * Initialise la table FTS5 pour une recherche plein texte ultra-rapide
   */
  async initEPGDatabase(db) {
    const sql = `
      CREATE VIRTUAL TABLE IF NOT EXISTS epg_search USING fts5(
        stream_id,
        category_name,
        title,
        description,
        start_time UNINDEXED,
        stop_time UNINDEXED,
        tokenize='unicode61'
      );
    `;
    await db.execute(sql);
  }

  /**
   * Windowing & Mapping : Prépare les données pour les langues choisies + VIP
   */
  async syncEPGWithMapping(selectedLangs = ['FR', 'BE']) {
    const allLive = await this.getLiveStreams();
    const categories = await this.getLiveCategories();
    const targetLangs = [...new Set([...selectedLangs, 'VIP'])];

    const streamMap = new Map();
    this.parseLiveStreams(allLive, categories).forEach(s => {
      const catUpper = s.category.toUpperCase();
      if (targetLangs.some(lang => catUpper.includes(lang.toUpperCase()))) {
        streamMap.set(s.id.toString(), s.category);
      }
    });

    const fullEpg = await this.getFullEPG();
    const now = Math.floor(Date.now() / 1000);
    const limitTime = now + (12 * 3600); // Fenêtre de 12h
    const batchToInsert = [];

    if (fullEpg.epg_listings) {
      Object.entries(fullEpg.epg_listings).forEach(([sId, programs]) => {
        const category = streamMap.get(sId);
        if (category && Array.isArray(programs)) {
          programs.forEach(prog => {
            const start = parseInt(prog.start_timestamp);
            const stop = parseInt(prog.stop_timestamp);
            if (stop > now && start < limitTime) {
              batchToInsert.push({
                streamId: sId,
                category: category,
                title: this.decodeBase64UTF8(prog.title),
                description: this.decodeBase64UTF8(prog.description),
                start,
                stop
              });
            }
          });
        }
      });
    }
    return batchToInsert;
  }

  /**
   * Insertion massive en transaction (Vitesse max)
   */
  async saveEPGToSQL(db, batchData) {
    try {
      await db.execute('BEGIN TRANSACTION');
      const now = Math.floor(Date.now() / 1000);
      
      // Nettoyage intelligent des programmes expirés
      await db.run('DELETE FROM epg_search WHERE stop_time < ?', [now]);

      const insertSql = `
        INSERT INTO epg_search (stream_id, category_name, title, description, start_time, stop_time)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      for (const item of batchData) {
        await db.run(insertSql, [
          item.streamId, 
          item.category, 
          item.title, 
          item.description, 
          item.start, 
          item.stop
        ]);
      }
      await db.execute('COMMIT');
      console.log(`✅ SQL Sync: ${batchData.length} programmes indexés.`);
    } catch (err) {
      await db.execute('ROLLBACK');
      console.error('❌ SQL Sync Error:', err);
      throw err;
    }
  }

  /**
   * Recherche FTS5 avec Prefix Matching (*) et priorité VIP
   */
  async searchProgramsSQL(db, query, selectedLangs = ['FR', 'BE']) {
    const langs = [...new Set([...selectedLangs, 'VIP'])];
    const placeholders = langs.map(() => '?').join(',');
    
    // Transforme "foot" en "foot*" pour matcher "football"
    const formattedQuery = query.trim().split(/\s+/).map(word => `${word}*`).join(' ');

    const sql = `
      SELECT stream_id, category_name, title, description, start_time, stop_time
      FROM epg_search 
      WHERE epg_search MATCH ? 
      AND category_name IN (${placeholders})
      AND stop_time > ? 
      ORDER BY rank, start_time ASC 
      LIMIT 40
    `;

    const now = Math.floor(Date.now() / 1000);
    try {
      return await db.query(sql, [formattedQuery, ...langs, now]);
    } catch (err) {
      console.error('❌ SQL Search Error:', err);
      return [];
    }
  }

  /**
   * Enrichit les résultats SQL avec les logos et noms de chaînes
   */
  enrichSearchResults(sqlResults, allStreams) {
    if (!sqlResults || !allStreams) return [];
    const streamInfoMap = new Map();
    allStreams.forEach(s => streamInfoMap.set(s.id.toString(), s));

    return sqlResults.map(prog => {
      const info = streamInfoMap.get(prog.stream_id.toString());
      return {
        ...prog,
        logo: info?.logo || info?.stream_icon || null,
        channelName: info?.name || 'Unknown',
        streamUrl: info?.streamUrl || null
      };
    });
  }
}

// ========================= URL PARSER =========================
export const parseXtreamUrl = (text) => {
  try {
    const cleanText = text.trim();
    const urlMatch = cleanText.match(/(https?:\/\/[^/]+)\/get\.php\?username=([^&]+)&password=([^&\s]+)/i) ||
                     cleanText.match(/(https?:\/\/[^/]+)\/player_api\.php\?username=([^&]+)&password=([^&\s]+)/i) ||
                     cleanText.match(/(https?:\/\/[^/]+).*[?&]username=([^&]+)&password=([^&\s]+)/i);

    if (urlMatch) {
      return {
        hasCredentials: true,
        server: urlMatch[1],
        username: urlMatch[2],
        password: urlMatch[3]
      };
    }
    return { hasCredentials: false };
  } catch (err) {
    return { hasCredentials: false };
  }
};

// ========================= M3U PARSER =========================
export const parseM3U = (content) => {
  const lines = content.split('\n');
  const items = [];
  let currentItem = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('#EXTINF:')) {
      const titleMatch = line.match(/,(.+)$/);
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const groupMatch = line.match(/group-title="([^"]+)"/);
      const epgIdMatch = line.match(/tvg-id="([^"]+)"/);
      
      currentItem = {
        id: Date.now() + i,
        name: titleMatch ? titleMatch[1].trim() : 'Unknown',
        logo: logoMatch ? logoMatch[1] : null,
        category: groupMatch ? groupMatch[1] : 'Other',
        epgChannelId: epgIdMatch ? epgIdMatch[1] : null,
        type: 'live',
      };
    } else if (line && !line.startsWith('#') && currentItem) {
      currentItem.streamUrl = line;
      items.push(currentItem);
      currentItem = null;
    }
  }

  return items;
};

// ========================= DEMO CONTENT =========================
export const DEMO_CONTENT = {
  live: [],
  vod: [
    { id: 1, name: 'HDR10 Tone Mapping Test', type: 'vod', category: '4K Demo', streamUrl: 'https://ninja-apps.io/demo/8k-demo-1.mp4', logo: null, rating: '8.5', year: '2024', genre: 'Demo' },
    { id: 2, name: 'Dolby Digital Plus 7.1', type: 'vod', category: 'Audio Demo', streamUrl: 'https://ninja-apps.io/demo/8k-demo-2.mp4', logo: null, rating: '9.0', year: '2024', genre: 'Demo' },
    { id: 3, name: 'H.265 HEVC Test', type: 'vod', category: '4K Demo', streamUrl: 'https://github.com/mpvkit/video-test/raw/master/resources/h265.mp4', logo: null, rating: '8.0', year: '2024', genre: 'Demo' },
    { id: 4, name: 'HDR Test Video', type: 'vod', category: 'HDR Demo', streamUrl: 'https://github.com/mpvkit/video-test/raw/master/resources/hdr.mkv', logo: null, rating: '9.2', year: '2024', genre: 'Demo' },
    { id: 5, name: 'Dolby Vision Profile 5', type: 'vod', category: 'Dolby Vision', streamUrl: 'https://github.com/mpvkit/video-test/raw/master/resources/DolbyVision_P5.mp4', logo: null, rating: '9.5', year: '2024', genre: 'Demo' },
    { id: 6, name: 'Dolby Vision Profile 8', type: 'vod', category: 'Dolby Vision', streamUrl: 'https://github.com/mpvkit/video-test/raw/master/resources/DolbyVision_P8.mp4', logo: null, rating: '9.5', year: '2024', genre: 'Demo' },
    { id: 7, name: 'Subtitle Test (PGS)', type: 'vod', category: 'Subtitle Demo', streamUrl: 'https://github.com/mpvkit/video-test/raw/master/resources/pgs_subtitle.mkv', logo: null, rating: '7.5', year: '2024', genre: 'Demo' },
    { id: 8, name: 'Ocean Waves H.264', type: 'vod', category: '4K Demo', streamUrl: 'https://vjs.zencdn.net/v/oceans.mp4', logo: null, rating: '8.0', year: '2024', genre: 'Nature' },
  ],
  series: [],
};
