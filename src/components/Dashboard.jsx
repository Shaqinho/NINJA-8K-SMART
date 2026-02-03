// src/components/Dashboard.jsx
import React, { memo } from 'react';

/**
 * NINJA 8K - Dashboard Modulaire
 * Optimisé pour le défilement haute performance sur S25 Ultra (120Hz)
 */
const Dashboard = ({ folders, onStreamSelect, activeCategory }) => {
  return (
    <div className="flex-1 overflow-y-auto bg-ninja-black pb-20">
      {folders.map((folder) => (
        <div key={folder.id} className="mb-8 mt-4">
          {/* Titre de la Catégorie */}
          <div className="flex justify-between items-center px-6 mb-4">
            <h3 className="text-white text-lg font-bold tracking-wide uppercase">
              {folder.name}
            </h3>
            <span className="text-ninja-purple text-xs font-black">
              {folder.streams.length} CHAÎNES
            </span>
          </div>

          {/* Liste Horizontale des Streams */}
          <div className="flex overflow-x-auto px-4 gap-4 scrollbar-hide">
            {folder.streams.map((stream) => (
              <StreamCard
                key={stream.uid}
                stream={stream}
                onClick={() => onStreamSelect(stream)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * StreamCard - Carte individuelle (mémoïsée)
 * Évite les re-renders inutiles lors du scroll
 */
const StreamCard = memo(({ stream, onClick }) => (
  <button
    onClick={onClick}
    className="flex-shrink-0 w-32 group transition-transform active:scale-95"
  >
    {/* Conteneur avec ratio 3:4 */}
    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-neutral-900 border border-white/10 group-hover:border-ninja-purple transition-colors">
      {stream.logo ? (
        <img
          src={stream.logo}
          alt=""
          className="w-full h-full object-contain p-2 img-logo-ninja"
          loading="lazy"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      ) : null}
      
      {/* Placeholder si pas de logo */}
      <div 
        className={`w-full h-full items-center justify-center bg-ninja-gradient opacity-20 ${stream.logo ? 'hidden' : 'flex'}`}
      >
        <span className="text-white font-bold text-lg">8K</span>
      </div>

      {/* Overlay dégradé discret sur le bas */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
      
      {/* Badge multi-sources */}
      {stream.sources && stream.sources.length > 1 && (
        <div className="absolute top-2 right-2 bg-ninja-purple/80 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
          {stream.sources.length}
        </div>
      )}
    </div>

    {/* Nom du stream */}
    <p className="mt-2 text-[10px] text-gray-500 truncate px-1 uppercase tracking-tighter group-hover:text-white transition-colors">
      {stream.name}
    </p>
  </button>
));

StreamCard.displayName = 'StreamCard';

export default memo(Dashboard);
