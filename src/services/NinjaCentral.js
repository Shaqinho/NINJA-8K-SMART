// ========================= NINJA CENTRAL =========================
// 
// Service de stockage centralisé IndexedDB pour NINJA 8K
// Permet de stocker et accéder rapidement à :
// - 47,000 chaînes Live
// - 150,000 films VOD
// - 40,000 séries
//
// Les pages Smart, Hub, OTT lisent toutes depuis cette source unique
// Le fetch ne se fait qu'une seule fois en arrière-plan
//
// ========================= FIN DESCRIPTION =========================

const DB_NAME = 'NinjaCentralDB';
const DB_VERSION = 1;

// Store names
const STORES = {
  VOD: 'vod',
  SERIES: 'series',
  LIVE: 'live',
  VOD_CATEGORIES: 'vod_categories',
  SERIES_CATEGORIES: 'series_categories',
  LIVE_CATEGORIES: 'live_categories',
  FAVORITES: 'favorites',
  RECENT: 'recent',
  META: 'meta', // Pour stocker timestamps de sync, etc.
};

class NinjaCentral {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  // ========================= INITIALIZATION =========================
  
  /**
   * Initialise la base de données IndexedDB
   * @returns {Promise<boolean>} - true si succès
   */
  async init() {
    if (this.isInitialized && this.db) {
      return true;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('❌ [NinjaCentral] IndexedDB error:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.isInitialized = true;
        console.log('✅ [NinjaCentral] IndexedDB initialized');
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // VOD Store
        if (!db.objectStoreNames.contains(STORES.VOD)) {
          const vodStore = db.createObjectStore(STORES.VOD, { keyPath: 'id' });
          vodStore.createIndex('categoryId', 'categoryId', { unique: false });
          vodStore.createIndex('name', 'name', { unique: false });
        }

        // Series Store
        if (!db.objectStoreNames.contains(STORES.SERIES)) {
          const seriesStore = db.createObjectStore(STORES.SERIES, { keyPath: 'id' });
          seriesStore.createIndex('categoryId', 'categoryId', { unique: false });
          seriesStore.createIndex('name', 'name', { unique: false });
        }

        // Live Store
        if (!db.objectStoreNames.contains(STORES.LIVE)) {
          const liveStore = db.createObjectStore(STORES.LIVE, { keyPath: 'id' });
          liveStore.createIndex('categoryId', 'categoryId', { unique: false });
          liveStore.createIndex('name', 'name', { unique: false });
        }

        // Categories Stores
        if (!db.objectStoreNames.contains(STORES.VOD_CATEGORIES)) {
          db.createObjectStore(STORES.VOD_CATEGORIES, { keyPath: 'category_id' });
        }
        if (!db.objectStoreNames.contains(STORES.SERIES_CATEGORIES)) {
          db.createObjectStore(STORES.SERIES_CATEGORIES, { keyPath: 'category_id' });
        }
        if (!db.objectStoreNames.contains(STORES.LIVE_CATEGORIES)) {
          db.createObjectStore(STORES.LIVE_CATEGORIES, { keyPath: 'category_id' });
        }

        // Favorites Store
        if (!db.objectStoreNames.contains(STORES.FAVORITES)) {
          const favStore = db.createObjectStore(STORES.FAVORITES, { keyPath: 'id' });
          favStore.createIndex('type', 'type', { unique: false });
          favStore.createIndex('addedAt', 'addedAt', { unique: false });
        }

        // Recent Store
        if (!db.objectStoreNames.contains(STORES.RECENT)) {
          const recentStore = db.createObjectStore(STORES.RECENT, { keyPath: 'id' });
          recentStore.createIndex('type', 'type', { unique: false });
          recentStore.createIndex('viewedAt', 'viewedAt', { unique: false });
        }

        // Meta Store
        if (!db.objectStoreNames.contains(STORES.META)) {
          db.createObjectStore(STORES.META, { keyPath: 'key' });
        }

        console.log('✅ [NinjaCentral] Database schema created');
      };
    });
  }

  // ========================= SYNC ALL =========================

  /**
   * Synchronise toutes les données depuis XtreamService
   * @param {XtreamService} xtreamService - Instance du service Xtream
   * @param {Function} onProgress - Callback pour progression (step, percent)
   * @returns {Promise<Object>} - Statistiques de sync
   */
  async syncAll(xtreamService, onProgress = () => {}) {
    if (!this.isInitialized) await this.init();

    const stats = { vod: 0, series: 0, live: 0, vodCategories: 0, seriesCategories: 0, liveCategories: 0 };

    try {
      // 1. Sync Live Categories
      onProgress('Syncing Live Categories...', 5);
      const liveCategories = await xtreamService.getLiveCategories();
      await this.saveCategories(STORES.LIVE_CATEGORIES, liveCategories || []);
      stats.liveCategories = liveCategories?.length || 0;

      // 2. Sync Live Streams
      onProgress('Syncing Live Channels...', 15);
      const liveStreams = await xtreamService.getLiveStreams();
      const parsedLive = xtreamService.parseLiveStreams(liveStreams, liveCategories);
      await this.saveItems(STORES.LIVE, parsedLive);
      stats.live = parsedLive.length;

      // 3. Sync VOD Categories
      onProgress('Syncing Movie Categories...', 30);
      const vodCategories = await xtreamService.getVodCategories();
      await this.saveCategories(STORES.VOD_CATEGORIES, vodCategories || []);
      stats.vodCategories = vodCategories?.length || 0;

      // 4. Sync VOD Streams
      onProgress('Syncing Movies...', 45);
      const vodStreams = await xtreamService.getVodStreams();
      const parsedVod = xtreamService.parseVodStreams(vodStreams, vodCategories);
      await this.saveItems(STORES.VOD, parsedVod);
      stats.vod = parsedVod.length;

      // 5. Sync Series Categories
      onProgress('Syncing Series Categories...', 65);
      const seriesCategories = await xtreamService.getSeriesCategories();
      await this.saveCategories(STORES.SERIES_CATEGORIES, seriesCategories || []);
      stats.seriesCategories = seriesCategories?.length || 0;

      // 6. Sync Series
      onProgress('Syncing Series...', 80);
      const seriesList = await xtreamService.getSeries();
      const parsedSeries = xtreamService.parseSeries(seriesList, seriesCategories);
      await this.saveItems(STORES.SERIES, parsedSeries);
      stats.series = parsedSeries.length;

      // 7. Save sync timestamp
      onProgress('Finalizing...', 95);
      await this.setMeta('lastSync', new Date().toISOString());
      await this.setMeta('syncStats', stats);

      onProgress('Done!', 100);
      console.log('✅ [NinjaCentral] Full sync complete:', stats);

      return stats;

    } catch (err) {
      console.error('❌ [NinjaCentral] Sync error:', err);
      throw err;
    }
  }

  // ========================= SAVE METHODS =========================

  /**
   * Sauvegarde des items en batch (VOD, Series, Live) avec ordre d'origine
   */
  async saveItems(storeName, items) {
    if (!this.db || !items || items.length === 0) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      // Clear existing data first
      store.clear();

      // Add all items with sort_order to preserve API order
      items.forEach((item, index) => {
        store.put({ ...item, sort_order: index });
      });

      transaction.oncomplete = () => {
        console.log(`✅ [NinjaCentral] Saved ${items.length} items to ${storeName}`);
        resolve();
      };

      transaction.onerror = (event) => {
        console.error(`❌ [NinjaCentral] Error saving to ${storeName}:`, event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Sauvegarde des catégories avec ordre d'origine
   */
  async saveCategories(storeName, categories) {
    if (!this.db || !categories || categories.length === 0) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      // Clear existing
      store.clear();

      // Add all categories with sort_order to preserve API order
      categories.forEach((cat, index) => {
        store.put({ ...cat, sort_order: index });
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event.target.error);
    });
  }

  // ========================= READ METHODS =========================

  /**
   * Récupère tous les items d'un store (triés par ordre d'origine)
   */
  async getAll(storeName) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by sort_order to preserve original API order
        const results = (request.result || []).sort((a, b) => {
          const orderA = a.sort_order ?? Infinity;
          const orderB = b.sort_order ?? Infinity;
          return orderA - orderB;
        });
        resolve(results);
      };
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * Récupère les items par catégorie
   */
  async getByCategory(storeName, categoryId) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index('categoryId');
      const request = index.getAll(String(categoryId));

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * Récupère un item par ID
   */
  async getById(storeName, id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  // ========================= CONVENIENCE METHODS =========================

  // VOD
  async getVod(categoryId = null) {
    if (categoryId) {
      return this.getByCategory(STORES.VOD, categoryId);
    }
    return this.getAll(STORES.VOD);
  }

  async getVodCategories() {
    return this.getAll(STORES.VOD_CATEGORIES);
  }

  // Series
  async getSeries(categoryId = null) {
    if (categoryId) {
      return this.getByCategory(STORES.SERIES, categoryId);
    }
    return this.getAll(STORES.SERIES);
  }

  async getSeriesCategories() {
    return this.getAll(STORES.SERIES_CATEGORIES);
  }

  // Live
  async getLive(categoryId = null) {
    if (categoryId) {
      return this.getByCategory(STORES.LIVE, categoryId);
    }
    return this.getAll(STORES.LIVE);
  }

  async getLiveCategories() {
    return this.getAll(STORES.LIVE_CATEGORIES);
  }

  // ========================= FAVORITES =========================

  async addFavorite(item, type) {
    if (!this.db) await this.init();

    const favorite = {
      id: `${type}_${item.id}`,
      itemId: item.id,
      type,
      name: item.name,
      logo: item.logo || item.stream_icon || item.cover,
      addedAt: new Date().toISOString(),
      item, // Store full item for easy access
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.FAVORITES], 'readwrite');
      const store = transaction.objectStore(STORES.FAVORITES);
      const request = store.put(favorite);

      request.onsuccess = () => {
        console.log(`✅ [NinjaCentral] Added to favorites: ${item.name}`);
        resolve(favorite);
      };
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async removeFavorite(itemId, type) {
    if (!this.db) await this.init();

    const id = `${type}_${itemId}`;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.FAVORITES], 'readwrite');
      const store = transaction.objectStore(STORES.FAVORITES);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`✅ [NinjaCentral] Removed from favorites: ${id}`);
        resolve(true);
      };
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async getFavorites(type = null) {
    if (!this.db) await this.init();

    if (type) {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORES.FAVORITES], 'readonly');
        const store = transaction.objectStore(STORES.FAVORITES);
        const index = store.index('type');
        const request = index.getAll(type);

        request.onsuccess = () => {
          // Sort by addedAt descending
          const results = (request.result || []).sort((a, b) => 
            new Date(b.addedAt) - new Date(a.addedAt)
          );
          resolve(results);
        };
        request.onerror = (event) => reject(event.target.error);
      });
    }

    const all = await this.getAll(STORES.FAVORITES);
    return all.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  }

  async isFavorite(itemId, type) {
    if (!this.db) await this.init();

    const id = `${type}_${itemId}`;
    const item = await this.getById(STORES.FAVORITES, id);
    return !!item;
  }

  // ========================= RECENT =========================

  async addRecent(item, type) {
    if (!this.db) await this.init();

    const recent = {
      id: `${type}_${item.id}`,
      itemId: item.id,
      type,
      name: item.name,
      logo: item.logo || item.stream_icon || item.cover,
      viewedAt: new Date().toISOString(),
      item,
    };

    // Also clean up old recent items (keep last 100)
    await this.cleanupRecent(100);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.RECENT], 'readwrite');
      const store = transaction.objectStore(STORES.RECENT);
      const request = store.put(recent);

      request.onsuccess = () => resolve(recent);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async getRecent(type = null, limit = 50) {
    if (!this.db) await this.init();

    let results;
    
    if (type) {
      results = await new Promise((resolve, reject) => {
        const transaction = this.db.transaction([STORES.RECENT], 'readonly');
        const store = transaction.objectStore(STORES.RECENT);
        const index = store.index('type');
        const request = index.getAll(type);

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (event) => reject(event.target.error);
      });
    } else {
      results = await this.getAll(STORES.RECENT);
    }

    // Sort by viewedAt descending and limit
    return results
      .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt))
      .slice(0, limit);
  }

  async cleanupRecent(keepCount = 100) {
    if (!this.db) await this.init();

    const all = await this.getAll(STORES.RECENT);
    if (all.length <= keepCount) return;

    // Sort by viewedAt and get items to delete
    const sorted = all.sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt));
    const toDelete = sorted.slice(keepCount);

    const transaction = this.db.transaction([STORES.RECENT], 'readwrite');
    const store = transaction.objectStore(STORES.RECENT);

    toDelete.forEach(item => {
      store.delete(item.id);
    });

    return new Promise((resolve) => {
      transaction.oncomplete = () => resolve(toDelete.length);
    });
  }

  // ========================= SEARCH =========================

  /**
   * Recherche rapide dans un store
   * @param {string} storeName - Nom du store
   * @param {string} query - Terme de recherche
   * @param {number} limit - Nombre max de résultats
   * @returns {Promise<Array>} - Résultats de recherche
   */
  async search(storeName, query, limit = 100) {
    if (!this.db) await this.init();
    if (!query || query.length < 2) return [];

    const all = await this.getAll(storeName);
    const q = query.toLowerCase();

    return all
      .filter(item => item.name?.toLowerCase().includes(q))
      .slice(0, limit);
  }

  /**
   * Recherche globale dans VOD, Series, Live
   */
  async searchAll(query, limit = 100) {
    if (!query || query.length < 2) return { vod: [], series: [], live: [] };

    const [vod, series, live] = await Promise.all([
      this.search(STORES.VOD, query, limit),
      this.search(STORES.SERIES, query, limit),
      this.search(STORES.LIVE, query, limit),
    ]);

    return { vod, series, live };
  }

  // ========================= META =========================

  async setMeta(key, value) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.META], 'readwrite');
      const store = transaction.objectStore(STORES.META);
      const request = store.put({ key, value });

      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async getMeta(key) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.META], 'readonly');
      const store = transaction.objectStore(STORES.META);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  async getLastSyncTime() {
    return this.getMeta('lastSync');
  }

  async getSyncStats() {
    return this.getMeta('syncStats');
  }

  // ========================= UTILITIES =========================

  /**
   * Vérifie si une sync est nécessaire (plus de 24h depuis la dernière)
   */
  async needsSync(maxAgeHours = 24) {
    const lastSync = await this.getLastSyncTime();
    if (!lastSync) return true;

    const lastSyncDate = new Date(lastSync);
    const now = new Date();
    const diffHours = (now - lastSyncDate) / (1000 * 60 * 60);

    return diffHours > maxAgeHours;
  }

  /**
   * Compte total des items
   */
  async getCounts() {
    const [vod, series, live] = await Promise.all([
      this.getAll(STORES.VOD),
      this.getAll(STORES.SERIES),
      this.getAll(STORES.LIVE),
    ]);

    return {
      vod: vod.length,
      series: series.length,
      live: live.length,
      total: vod.length + series.length + live.length,
    };
  }

  /**
   * Efface toute la base de données
   */
  async clearAll() {
    if (!this.db) await this.init();

    const storeNames = Object.values(STORES);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeNames, 'readwrite');
      
      storeNames.forEach(storeName => {
        transaction.objectStore(storeName).clear();
      });

      transaction.oncomplete = () => {
        console.log('✅ [NinjaCentral] All data cleared');
        resolve(true);
      };
      transaction.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * Ferme la connexion à la base
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('✅ [NinjaCentral] Database connection closed');
    }
  }
}

// Export singleton instance
export const ninjaCentral = new NinjaCentral();

// Export class for testing
export { NinjaCentral };

// Export store names for external use
export { STORES };
