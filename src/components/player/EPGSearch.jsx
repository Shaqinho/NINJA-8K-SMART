import React, { useState, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';

// ============================================================================
// EPG SEARCH - SQL POWERED
// ============================================================================

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const getProgress = (startTs, stopTs) => {
  const now = Math.floor(Date.now() / 1000);
  if (now < startTs) return 0;
  if (now > stopTs) return 100;
  return Math.round(((now - startTs) / (stopTs - startTs)) * 100);
};

const ResultRow = ({ result, onSelect }) => {
  const { channel, program, isLive, progress } = result;
  
  return (
    <button
      onClick={() => onSelect(channel)}
      className="w-full flex items-center gap-3 px-4 py-3 active:bg-transparent transition-colors relative"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="w-12 h-9 rounded bg-transparent flex items-center justify-center overflow-hidden flex-shrink-0">
        {channel.logo ? (
          <img src={channel.logo} alt="" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
        ) : (
          <div className="text-gray-600 text-[10px]">TV</div>
        )}
      </div>

      <div className="flex-1 text-left min-w-0">
        <p className="text-gray-400 text-[10px] truncate uppercase">{channel.channelName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {isLive && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white">LIVE</span>}
          <p className="text-white text-sm font-semibold truncate">{program.title}</p>
        </div>
        <p className="text-gray-500 text-xs mt-0.5">{formatTime(program.startTimestamp)} - {formatTime(program.stopTimestamp)}</p>
      </div>

      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#6225ff]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>

      {isLive && progress > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-transparent">
          <div className="h-full bg-[#6225ff]" style={{ width: `${progress}%` }} />
        </div>
      )}
    </button>
  );
};

const EPGSearch = ({ visible, onClose, onSelectChannel, xtreamService }) => {
  const [query, setQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState(null);
  const [results, setResults] = useState([]);
  const [channels, setChannels] = useState([]);
  const inputRef = useRef(null);

  // 1. Chargement initial des chaînes pour le mapping des logos
  useEffect(() => {
    if (visible && channels.length === 0 && xtreamService) {
      const loadData = async () => {
        const live = await xtreamService.getLiveStreams();
        const cats = await xtreamService.getLiveCategories();
        setChannels(xtreamService.parseLiveStreams(live, cats));
      };
      loadData();
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [visible, xtreamService, channels]);

  // 2. Moteur de Recherche SQL (Debounced)
  useEffect(() => {
    const performSearch = async () => {
      if (!window.db || !xtreamService || !visible) return;

      const langs = countryFilter ? [countryFilter] : ['FR', 'BE'];
      const sqlRows = await xtreamService.searchProgramsSQL(window.db, query || ' ', langs);
      const enriched = xtreamService.enrichSearchResults(sqlRows, channels);

      const now = Math.floor(Date.now() / 1000);
      const finalResults = enriched.map(item => ({
        channel: item,
        program: {
          title: item.title,
          description: item.description,
          startTimestamp: item.start_time,
          stopTimestamp: item.stop_time
        },
        isLive: item.stop_time > now && item.start_time < now,
        progress: getProgress(item.start_time, item.stop_time)
      }));

      setResults(finalResults);
    };

    const timer = setTimeout(performSearch, 300);
    return () => clearTimeout(timer);
  }, [query, countryFilter, channels, xtreamService, visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-transparent">
      <div className="flex-shrink-0 flex items-center gap-3 p-4 border-b border-white/10">
        <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center bg-transparent active:scale-95">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search programs (Deep Search)..."
          className="flex-1 bg-transparent rounded-full px-5 py-3 text-white text-sm outline-none border border-transparent focus:border-[#6225ff]/50"
        />
      </div>

      <div className="flex-shrink-0 flex gap-2 px-4 py-2 border-b border-white/5 overflow-x-auto">
        {['FR', 'BE', 'UK', 'US'].map(country => (
          <button
            key={country}
            onClick={() => setCountryFilter(country === countryFilter ? null : country)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${countryFilter === country ? 'bg-[#6225ff] text-white' : 'bg-transparent text-gray-500'}`}
          >
            {country}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        <List height={window.innerHeight - 150} itemCount={results.length} itemSize={88} width="100%">
          {({ index, style }) => (
            <div style={style}>
              <ResultRow result={results[index]} onSelect={(channel) => { onSelectChannel(channel); onClose(); }} />
            </div>
          )}
        </List>
      </div>
    </div>
  );
};

export default EPGSearch;
