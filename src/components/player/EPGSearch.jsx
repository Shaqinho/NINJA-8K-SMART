import React, { useState, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { searchChannelsByName, searchProgramsByTitle } from '../../database/ProgramQueries';

// ============================================================================
// EPG SEARCH - Search live channels and programs
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
      className="w-full flex items-center gap-3 px-4 py-3 active:bg-white/5 transition-colors relative"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="w-12 h-9 rounded bg-black/30 flex items-center justify-center overflow-hidden flex-shrink-0">
        {channel.logo ? (
          <img src={channel.logo} alt="" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
        ) : (
          <div className="text-gray-600 text-[10px]">TV</div>
        )}
      </div>

      <div className="flex-1 text-left min-w-0">
        <p className="text-gray-400 text-[10px] truncate uppercase">{channel.name || channel.channelName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {isLive && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white">LIVE</span>}
          <p className="text-white text-sm font-semibold truncate">{program?.title || channel.name}</p>
        </div>
        {program?.startTimestamp && (
          <p className="text-gray-500 text-xs mt-0.5">{formatTime(program.startTimestamp)} - {formatTime(program.stopTimestamp)}</p>
        )}
      </div>

      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#6225ff]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>

      {isLive && progress > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/20">
          <div className="h-full bg-[#6225ff]" style={{ width: `${progress}%` }} />
        </div>
      )}
    </button>
  );
};

// Simple channel search result (when no EPG data)
const ChannelRow = ({ channel, onSelect }) => {
  return (
    <button
      onClick={() => onSelect(channel)}
      className="w-full flex items-center gap-3 px-4 py-3 active:bg-white/5 transition-colors"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="w-12 h-9 rounded bg-black/30 flex items-center justify-center overflow-hidden flex-shrink-0">
        {channel.logo ? (
          <img src={channel.logo} alt="" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
        ) : (
          <div className="text-gray-600 text-[10px]">TV</div>
        )}
      </div>

      <div className="flex-1 text-left min-w-0">
        <p className="text-gray-400 text-[10px] truncate uppercase">{channel.category}</p>
        <p className="text-white text-sm font-semibold truncate">{channel.name}</p>
      </div>

      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#6225ff]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
    </button>
  );
};

const EPGSearch = ({ visible, onClose, onSelectChannel, channels: propsChannels }) => {
  const [query, setQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState(null);
  const [results, setResults] = useState([]);
  const [channels, setChannels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);

  // 1. Load channels from props if available
  useEffect(() => {
    if (visible) {
      if (propsChannels && propsChannels.length > 0) {
        setChannels(propsChannels);
      }
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [visible, propsChannels]);

  // 2. Search logic - search programs AND channels via SQL
  useEffect(() => {
    if (!visible || !query.trim()) {
      setResults([]);
      return;
    }

    const performSearch = async () => {
      const q = query.trim();
      const langFilters = countryFilter ? [countryFilter] : [];
      
      try {
        // First: Search PROGRAMS by title (real EPG search)
        const programResults = await searchProgramsByTitle(q, langFilters, true, true, 50);
        
        if (programResults && programResults.length > 0) {
          setResults(programResults.map(prog => ({
            channel: {
              id: prog.stream_id,
              name: prog.channel_name,
              logo: prog.channel_logo,
              category: prog.category_name,
            },
            program: {
              title: prog.title,
              description: prog.description,
              startTimestamp: prog.start_time,
              stopTimestamp: prog.end_time,
            },
            isLive: prog.is_currently_live === 1,
            progress: prog.progress || 0,
          })));
          return;
        }
        
        // Fallback: Search CHANNELS by name
        const channelResults = await searchChannelsByName(q, langFilters, true, 50);
        
        if (channelResults && channelResults.length > 0) {
          setResults(channelResults.map(ch => ({
            channel: {
              id: ch.stream_id,
              name: ch.name,
              logo: ch.logo,
              category: ch.category_name,
              categoryId: ch.category_id,
            },
            program: null,
            isLive: true,
            progress: 0
          })));
          return;
        }
        
        // Last fallback: search in memory
        if (channels.length > 0) {
          const qLower = q.toLowerCase();
          const channelMatches = channels.filter(ch => {
            const nameMatch = ch.name?.toLowerCase().includes(qLower);
            const categoryMatch = ch.category?.toLowerCase().includes(qLower);
            
            if (countryFilter) {
              const prefix = ch.name?.substring(0, 3).toUpperCase();
              if (!prefix.includes(countryFilter)) return false;
            }
            
            return nameMatch || categoryMatch;
          }).slice(0, 50);

          setResults(channelMatches.map(ch => ({
            channel: ch,
            program: null,
            isLive: true,
            progress: 0
          })));
        } else {
          setResults([]);
        }
      } catch (err) {
        console.warn('Search failed:', err);
        setResults([]);
      }
    };

    const timer = setTimeout(performSearch, 300);
    return () => clearTimeout(timer);
  }, [query, countryFilter, channels, channels.length, visible]);

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col"
      style={{ 
        background: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 p-4 border-b border-white/10">
        {/* Close button - VISIBLE */}
        <button 
          onClick={onClose} 
          className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95"
          style={{ background: 'rgba(255,255,255,0.1)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        
        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search channels..."
          className="flex-1 rounded-full px-5 py-3 text-white text-sm outline-none"
          style={{ 
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid transparent',
          }}
        />
        
        {/* Clear button */}
        {query && (
          <button 
            onClick={() => setQuery('')}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex gap-2 px-4 py-2 border-b border-white/5 overflow-x-auto">
        {/* Country filters */}
        {['FR', 'BE', 'UK', 'US', 'ES', 'DE'].map(country => (
          <button
            key={country}
            onClick={() => setCountryFilter(country === countryFilter ? null : country)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              countryFilter === country ? 'bg-[#6225ff] text-white' : 'bg-white/10 text-gray-500'
            }`}
          >
            {country}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-[#6225ff] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            {query ? (
              <>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 opacity-50">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
                <p>No results for "{query}"</p>
              </>
            ) : (
              <>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 opacity-50">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="M21 21l-4.35-4.35"/>
                </svg>
                <p>Type to search channels</p>
              </>
            )}
          </div>
        ) : (
          <List 
            height={window.innerHeight - 150} 
            itemCount={results.length} 
            itemSize={72} 
            width="100%"
          >
            {({ index, style }) => (
              <div style={style}>
                {results[index].program ? (
                  <ResultRow 
                    result={results[index]} 
                    onSelect={(channel) => { 
                      onSelectChannel(channel); 
                      onClose(); 
                    }} 
                  />
                ) : (
                  <ChannelRow 
                    channel={results[index].channel} 
                    onSelect={(channel) => { 
                      onSelectChannel(channel); 
                      onClose(); 
                    }} 
                  />
                )}
              </div>
            )}
          </List>
        )}
      </div>

      {/* Results count */}
      {results.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-t border-white/5 text-center">
          <span className="text-gray-500 text-xs">{results.length} results</span>
        </div>
      )}
    </div>
  );
};

export default EPGSearch;
