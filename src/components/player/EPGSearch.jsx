import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import { 
  searchProgramsByCategories, 
  getNowByCategories, 
  insertMassiveEpgNow 
} from '../../database/ProgramQueries';

// ============================================================================
// EPG SEARCH - Recherche Asymétrique & Sélective
// 
// - Droite : Prend tout le reste de l'écran (left: 300px)
// - Windowing : Gère 48k programmes sans lag
// - Sélectivité : Toggle Description (OFF = record de vitesse)
// - Action : Clic -> Envoie la chaîne à la sidebar de gauche
// ============================================================================

const EPGSearch = ({ xtreamService, onChannelSelect, onClose }) => {
  const [results, setResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Options sélectives (Choix de l'utilisateur pour la performance)
  const [syncOptions, setSyncOptions] = useState({
    includeDesc: false, // OFF par défaut pour tenir les 10 secondes
    includeTime: true
  });

  const searchTimerRef = useRef(null);

  // 1. Moteur de Recherche avec Windowing
  const performSearch = useCallback(async (query) => {
    const q = query.trim();
    setLoading(true);
    try {
      const presets = JSON.parse(localStorage.getItem('ninja_epg_presets') || '[]');
      const categoryIds = presets.flatMap(p => p.categoryIds);
      
      let data = [];
      if (q.length >= 2) {
        data = await searchProgramsByCategories(q, categoryIds, 150);
      } else {
        data = await getNowByCategories(categoryIds, 150);
      }
      setResults(data);
    } catch (err) {
      console.error("EPGSearch Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => performSearch(searchQuery), 350);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery, performSearch]);

  // 2. Rendu d'une ligne (Windowing)
  const ProgramRow = ({ index, style }) => {
    const prog = results[index];
    if (!prog) return null;

    const startTime = prog.start_formatted ? prog.start_formatted.split(' ')[1]?.substring(0, 5) : '--:--';

    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 15px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          cursor: 'pointer',
          background: 'transparent',
          transition: 'background 0.2s'
        }}
        onClick={() => {
          onChannelSelect?.({ 
            stream_id: prog.stream_id, 
            id: prog.stream_id, 
            name: prog.channel_name, 
            logo: prog.channel_logo 
          });
          navigator.vibrate?.(30);
        }}
      >
        <div style={{ width: '45px', height: '30px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <img src={prog.channel_logo} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {prog.title}
          </div>
          <div style={{ fontSize: '10px', color: '#6225ff', fontWeight: 600 }}>
            {startTime} • {prog.channel_name}
          </div>
        </div>

        {prog.is_live === 1 && (
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff4b4b', boxShadow: '0 0 8px #ff4b4b' }} />
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      
      {/* Barre de Recherche & Filtres */}
      <div style={{ padding: '20px 15px 15px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <input 
          type="text" 
          placeholder="Recherche (Titre, Acteur...)" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(98, 37, 255, 0.4)',
            borderRadius: '6px',
            padding: '10px 12px',
            color: '#fff',
            fontSize: '13px',
            outline: 'none',
            marginBottom: '12px'
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={syncOptions.includeDesc} 
                onChange={(e) => setSyncOptions(prev => ({ ...prev, includeDesc: e.target.checked }))}
                style={{ accentColor: '#6225ff' }}
              />
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Profond (Desc)</span>
            </label>
            <button style={{ background: 'none', border: '1px solid #444', borderRadius: '4px', padding: '2px 8px', color: '#888', fontSize: '9px', fontWeight: 700 }}>
              START À...
            </button>
          </div>
          <div style={{ fontSize: '10px', color: '#444', fontWeight: 700 }}>{results.length} RÉSULTATS</div>
        </div>
      </div>

      {/* Liste Windowed */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {loading && results.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6225ff', fontSize: '11px', fontWeight: 700 }}>SCANNING EPG...</div>
        ) : (
          <List
            height={window.innerHeight - 130}
            itemCount={results.length}
            itemSize={55}
            width="100%"
          >
            {ProgramRow}
          </List>
        )}
      </div>

      <style>{`
        input::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
};

export default EPGSearch;
