import React from 'react';

// ============================================================================
// PLAYER OVERLAY - Simple overlay with title only
// ============================================================================

export const PlayerOverlay = ({
  title,
  subtitle,
  logo,
  category,
  visible = true,
}) => {
  /* FIX : Si l'overlay n'est pas visible ou n'a pas de titre, on ne rend RIEN */
  /* Cela évite qu'une div invisible mais présente bloque les clics ou la vidéo */
  if (!visible || !title) return null;

  return (
    <div
      className="absolute top-0 left-0 right-0 p-6 z-40"
      /* On utilise background: transparent ici et on met le dégradé dans le style */
      style={{
        background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.3), transparent)',
        pointerEvents: 'none' // Très important pour ne pas bloquer les contrôles
      }}
    >
      <div className="flex items-center gap-4" style={{ alignItems: 'center' }}>
        {/* Logo - Garde aspect ratio exact */}
        {logo && (
          <img
            src={logo}
            alt=""
            className="flex-shrink-0"
            style={{ 
              maxHeight: '40px', 
              maxWidth: '240px',
              objectFit: 'contain',
              objectPosition: 'left center',
            }}
            onError={(e) => e.target.style.display = 'none'}
          />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          {category && (
            <p className="text-[#a020f0] text-[10px] font-black uppercase tracking-widest mb-0.5 italic">
              {category}
            </p>
          )}
          <h1 className="text-white text-lg font-black truncate uppercase italic tracking-tighter leading-none">
            {title}
          </h1>
          {subtitle && (
            <p className="text-gray-400 text-xs truncate font-bold uppercase opacity-70">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerOverlay;
