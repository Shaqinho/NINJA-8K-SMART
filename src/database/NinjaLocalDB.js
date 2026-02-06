// ============================================================================
// NINJA LOCAL DB - SQLite Database for EPG Search (Capacitor Version)
// ============================================================================
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

const DB_CONFIG = {
  name: 'NinjaEPG',
  encrypted: false,
  mode: 'no-encryption',
  version: 1,
};

let sqlite = null;
let db = null;

// Initialize SQLite
const initSQLite = async () => {
  if (sqlite) return sqlite;
  sqlite = new SQLiteConnection(CapacitorSQLite);
  const platform = Capacitor.getPlatform();
  if (platform === 'web') {
    await customElements.whenDefined('jeep-sqlite');
    const jeepEl = document.querySelector('jeep-sqlite');
    if (jeepEl) await sqlite.initWebStore();
  }
  return sqlite;
};

// Open Database
export const openDatabase = async () => {
  if (db) return db;
  try {
    await initSQLite();
    const retCC = await sqlite.checkConnectionsConsistency();
    const isConn = (await sqlite.isConnection(DB_CONFIG.name, false)).result;
    if (retCC.result && isConn) {
      db = await sqlite.retrieveConnection(DB_CONFIG.name, false);
    } else {
      db = await sqlite.createConnection(DB_CONFIG.name, DB_CONFIG.encrypted, DB_CONFIG.mode, DB_CONFIG.version, false);
    }
    await db.open();
    await initSchema();
    console.log('✅ NinjaLocalDB: Database opened');
    return db;
  } catch (error) {
    console.error('❌ NinjaLocalDB: Failed to open:', error);
    throw error;
  }
};

export const getDatabase = () => {
  if (!db) throw new Error('Database not initialized');
  return db;
};

export const executeSql = async (statement, values = []) => {
  if (!db) throw new Error('Database not initialized');
  return await db.run(statement, values);
};

export const querySql = async (statement, values = []) => {
  if (!db) throw new Error('Database not initialized');
  const result = await db.query(statement, values);
  return result.values || [];
};

// Initialize Schema
const initSchema = async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS channels (
      stream_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      lang_prefix TEXT,
      category_id INTEGER,
      category_name TEXT,
      epg_channel_id TEXT,
      logo TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stream_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      title_normalized TEXT,
      description TEXT,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      start_formatted TEXT,
      end_formatted TEXT,
      is_live INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (stream_id) REFERENCES channels(stream_id) ON DELETE CASCADE
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_key TEXT UNIQUE NOT NULL,
      last_sync INTEGER NOT NULL,
      sync_type TEXT,
      channels_count INTEGER DEFAULT 0,
      programs_count INTEGER DEFAULT 0
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_channels_lang ON channels(lang_prefix)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_channels_cat ON channels(category_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_channels_epg ON channels(epg_channel_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_programs_stream ON programs(stream_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_programs_title ON programs(title_normalized)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_programs_start ON programs(start_time)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_programs_live ON programs(is_live, start_time)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_programs_end ON programs(end_time)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_programs_timerange ON programs(start_time, end_time)`);
  
  // WAL mode pour perf lectures pendant écritures massives
  await db.execute(`PRAGMA journal_mode=WAL`);
  
  console.log('✅ NinjaLocalDB: Schema initialized');
};

export const closeDatabase = async () => {
  if (db) {
    await db.close();
    await sqlite.closeConnection(DB_CONFIG.name, false);
    db = null;
  }
};

export const clearAllData = async () => {
  await db.execute('DELETE FROM programs');
  await db.execute('DELETE FROM channels');
  await db.execute('DELETE FROM sync_status');
};

export const clearPrograms = async () => {
  await db.execute('DELETE FROM programs');
};

export const getDatabaseStats = async () => {
  const channels = await db.query('SELECT COUNT(*) as count FROM channels');
  const programs = await db.query('SELECT COUNT(*) as count FROM programs');
  const langs = await db.query('SELECT lang_prefix, COUNT(*) as count FROM channels GROUP BY lang_prefix ORDER BY count DESC');
  return {
    channelsCount: channels.values?.[0]?.count || 0,
    programsCount: programs.values?.[0]?.count || 0,
    languageBreakdown: langs.values || [],
  };
};

export const extractLangPrefix = (name) => {
  if (!name) return 'OTHER';
  const match = name.match(/^([A-Z]{2,3})[\s:]/i);
  if (match) return match[1].toUpperCase();
  if (name.toUpperCase().startsWith('VIP')) return 'VIP';
  return 'OTHER';
};

export const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
};

const NinjaLocalDBExports = { openDatabase, getDatabase, closeDatabase, clearAllData, clearPrograms, getDatabaseStats, extractLangPrefix, normalizeText, executeSql, querySql };
export default NinjaLocalDBExports;
