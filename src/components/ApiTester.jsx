import React, { useState, useMemo } from 'react';
import { THEME } from '../constants/theme';
import { XtreamService } from '../services/XtreamService';

// ============================================================================
// API TESTER - EPG Debug Only
// ============================================================================

const ApiTester = ({ visible, onClose, playlist }) => {
  const [loading, setLoading] = useState({});
  const [results, setResults] = useState({});
  
  // Inputs
  const [streamId, setStreamId] = useState('');
  const [epgLimit, setEpgLimit] = useState('4');

  // XtreamService instance
  const service = useMemo(() => {
    if (!playlist?.server || !playlist?.username || !playlist?.password) return null;
    return new XtreamService(playlist.server, playlist.username, playlist.password);
  }, [playlist]);

  // Base URL for display
  const baseUrl = playlist ? `${playlist.server}/player_api.php?username=${playlist.username}&password=${playlist.password}` : '';

  // ============================================================================
  // EPG - Get Short EPG RAW (no parsing)
  // ============================================================================
  const testShortEpgRaw = async () => {
    if (!playlist || !streamId) return;
    setLoading(prev => ({ ...prev, shortEpgRaw: true }));
    try {
      const limit = parseInt(epgLimit) || 4;
      const url = `${baseUrl}&action=get_short_epg&stream_id=${streamId}&limit=${limit}`;
      const start = Date.now();
      
      // Direct fetch - NO parsing
      const res = await fetch(url);
      const rawData = await res.json();
      const duration = Date.now() - start;
      
      // Decode titles if present
      let decodedListings = null;
      if (rawData?.epg_listings?.length > 0) {
        decodedListings = rawData.epg_listings.map(prog => ({
          ...prog,
          title_decoded: service?.decodeBase64UTF8(prog.title) || prog.title,
          description_decoded: service?.decodeBase64UTF8(prog.description) || prog.description,
        }));
      }
      
      setResults(prev => ({ ...prev, shortEpgRaw: { 
        url, 
        duration: `${duration}ms`,
        hasEpgListings: !!rawData?.epg_listings,
        listingsCount: rawData?.epg_listings?.length || 0,
        rawKeys: Object.keys(rawData || {}),
        decodedListings,
        rawData,
      }}));
    } catch (err) {
      setResults(prev => ({ ...prev, shortEpgRaw: { error: err.message } }));
    }
    setLoading(prev => ({ ...prev, shortEpgRaw: false }));
  };

  // ============================================================================
  // EPG - Get Short EPG (parsed)
  // ============================================================================
  const testShortEpg = async () => {
    if (!service || !streamId) return;
    setLoading(prev => ({ ...prev, shortEpg: true }));
    try {
      const limit = parseInt(epgLimit) || 4;
      const url = `${baseUrl}&action=get_short_epg&stream_id=${streamId}&limit=${limit}`;
      const start = Date.now();
      const result = await service.getShortEPG(parseInt(streamId), limit);
      const duration = Date.now() - start;
      
      setResults(prev => ({ ...prev, shortEpg: { 
        url, 
        duration: `${duration}ms`,
        programCount: result?.length || 0,
        data: result,
      }}));
    } catch (err) {
      setResults(prev => ({ ...prev, shortEpg: { error: err.message } }));
    }
    setLoading(prev => ({ ...prev, shortEpg: false }));
  };

  // ============================================================================
  // EPG - Get Full EPG (get_simple_data_table)
  // ============================================================================
  const testFullEpg = async () => {
    if (!service || !streamId) return;
    setLoading(prev => ({ ...prev, fullEpg: true }));
    try {
      const url = `${baseUrl}&action=get_simple_data_table&stream_id=${streamId}`;
      const start = Date.now();
      const result = await service.getFullEPG(parseInt(streamId));
      const duration = Date.now() - start;
      
      const listings = result?.epg_listings || [];
      
      // Decode base64 titles for sample
      const decodedSample = listings.slice(0, 5).map(prog => ({
        ...prog,
        title_decoded: service.decodeBase64UTF8(prog.title),
        description_decoded: service.decodeBase64UTF8(prog.description),
      }));
      
      setResults(prev => ({ ...prev, fullEpg: { 
        url, 
        duration: `${duration}ms`,
        totalPrograms: listings.length,
        rawKeys: Object.keys(result || {}),
        sample: decodedSample,
        rawData: result,
      }}));
    } catch (err) {
      setResults(prev => ({ ...prev, fullEpg: { error: err.message } }));
    }
    setLoading(prev => ({ ...prev, fullEpg: false }));
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: THEME.colors.bg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1 active:scale-95">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <h1 className="text-white font-bold">🔧 EPG Debugger</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Connection Info */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400">Server</p>
          <p className="text-sm text-white font-mono truncate">{playlist?.server || 'Not connected'}</p>
        </div>

        {/* Stream ID Input */}
        <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
          <label className="text-xs text-gray-400">Stream ID (visible dans la liste des chaînes [xxxxx])</label>
          <input
            type="text"
            value={streamId}
            onChange={(e) => setStreamId(e.target.value)}
            placeholder="Enter stream_id..."
            className="w-full bg-gray-700 rounded px-3 py-2 text-white text-sm font-mono"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-400">Limit</label>
              <input
                type="number"
                value={epgLimit}
                onChange={(e) => setEpgLimit(e.target.value)}
                className="w-full bg-gray-700 rounded px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
          
          {/* Quick test IDs */}
          <div className="pt-2">
            <p className="text-xs text-gray-500 mb-1">Quick test:</p>
            <div className="flex flex-wrap gap-1">
              {['16872125', '14526', '12345'].map(id => (
                <button
                  key={id}
                  onClick={() => setStreamId(id)}
                  className="px-2 py-1 bg-purple-600/30 hover:bg-purple-600/50 rounded text-xs text-white font-mono"
                >
                  {id}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="space-y-3">
          
          {/* RAW Test - Most important for debugging */}
          <TestButton 
            label="🔍 getShortEPG RAW (debug)" 
            onClick={testShortEpgRaw} 
            loading={loading.shortEpgRaw}
            description="Fetch direct sans parsing - voir la réponse brute"
            disabled={!streamId}
            highlight
          />
          {results.shortEpgRaw && (
            <div className="space-y-2">
              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-2">
                <StatCard 
                  label="Has epg_listings?" 
                  value={results.shortEpgRaw.hasEpgListings ? '✅ YES' : '❌ NO'} 
                  color={results.shortEpgRaw.hasEpgListings ? '#22c55e' : '#ef4444'}
                />
                <StatCard 
                  label="Listings count" 
                  value={results.shortEpgRaw.listingsCount} 
                />
              </div>
              
              {/* Raw keys */}
              <div className="bg-yellow-900/30 rounded-lg p-2">
                <p className="text-xs text-yellow-400">Response keys: {results.shortEpgRaw.rawKeys?.join(', ') || 'none'}</p>
              </div>
              
              {/* Decoded listings */}
              {results.shortEpgRaw.decodedListings && (
                <div className="bg-green-900/30 rounded-lg p-3">
                  <p className="text-xs text-green-400 mb-2">✅ Decoded programs:</p>
                  {results.shortEpgRaw.decodedListings.map((prog, i) => (
                    <div key={i} className="text-xs text-white mb-1">
                      <span className="text-gray-400">{prog.start?.split(' ')[1]?.substring(0,5)}</span>
                      {' - '}
                      <span className="font-semibold">{prog.title_decoded}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <ResultBox data={results.shortEpgRaw} />
            </div>
          )}

          <div className="border-t border-white/10 pt-4" />

          {/* Parsed Test */}
          <TestButton 
            label="getShortEPG (parsed)" 
            onClick={testShortEpg} 
            loading={loading.shortEpg}
            description="Via XtreamService.getShortEPG()"
            disabled={!streamId}
          />
          {results.shortEpg && <ResultBox data={results.shortEpg} />}

          <div className="border-t border-white/10 pt-4" />

          {/* Full EPG Test */}
          <TestButton 
            label="getFullEPG (get_simple_data_table)" 
            onClick={testFullEpg} 
            loading={loading.fullEpg}
            description="EPG complet pour plusieurs jours"
            disabled={!streamId}
          />
          {results.fullEpg && (
            <div className="space-y-2">
              <StatCard label="Total Programs" value={results.fullEpg.totalPrograms} />
              {results.fullEpg.rawKeys && (
                <div className="bg-yellow-900/30 rounded-lg p-2">
                  <p className="text-xs text-yellow-400">Response keys: {results.fullEpg.rawKeys?.join(', ')}</p>
                </div>
              )}
              <ResultBox data={results.fullEpg} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENTS
// ============================================================================

const TestButton = ({ label, onClick, loading, description, disabled, highlight }) => (
  <div className="space-y-1">
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="w-full py-3 rounded-lg font-bold text-sm active:scale-98 disabled:opacity-50"
      style={{ 
        background: highlight ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : THEME.gradients.primary 
      }}
    >
      {loading ? '⏳ Loading...' : label}
    </button>
    {description && <p className="text-xs text-gray-500 px-1">{description}</p>}
  </div>
);

const StatCard = ({ label, value, color = '#8B5CF6' }) => (
  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
    <p className="text-xl font-bold" style={{ color }}>{value}</p>
    <p className="text-xs text-gray-400">{label}</p>
  </div>
);

const ResultBox = ({ data }) => (
  <div className="bg-gray-900 rounded-lg p-3 overflow-hidden">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs text-gray-400">Result</span>
      {data.duration && <span className="text-xs text-green-400">{data.duration}</span>}
    </div>
    {data.url && (
      <p className="text-xs text-blue-400 break-all mb-2 font-mono">{data.url}</p>
    )}
    {data.error && (
      <p className="text-xs text-red-400 mb-2">❌ Error: {data.error}</p>
    )}
    <pre className="text-xs text-gray-300 overflow-x-auto max-h-60 whitespace-pre-wrap">
      {JSON.stringify(data.sample || data.decodedListings || data.data || data.rawData || data, null, 2)}
    </pre>
  </div>
);

export default ApiTester;
