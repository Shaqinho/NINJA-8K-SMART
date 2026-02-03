// src/components/MultiSourceSelector.jsx
import React from 'react';

/**
 * NINJA 8K - Sélecteur Multi-Sources
 * Bottom Sheet pour choisir parmi plusieurs sources d'un même programme
 * "Secret Weapon" - Cross-Channel Search
 */
const MultiSourceSelector = ({ 
  isOpen, 
  program, 
  sources, 
  onSelectSource, 
  onClose 
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
        <div className="bg-ninja-dark/95 backdrop-blur-xl rounded-t-3xl border-t border-ninja-purple/20">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-ninja-purple/50 rounded-full" />
          </div>

          {/* Content */}
          <div className="px-6 pb-8 max-h-[60vh] overflow-y-auto">
            {/* Header */}
            <div className="text-center mb-6">
              <p className="text-ninja-purple text-xs font-black tracking-widest mb-2">
                MULTIPLES SOURCES DÉTECTÉES
              </p>
              <h3 className="text-white text-lg font-bold">
                {program?.title || 'Programme'}
              </h3>
              {program?.time && (
                <p className="text-gray-500 text-sm mt-1">{program.time}</p>
              )}
            </div>

            {/* Liste des sources */}
            <div className="space-y-3">
              {sources?.map((source, index) => (
                <button
                  key={source.uid || index}
                  onClick={() => onSelectSource(source)}
                  className="w-full flex items-center gap-4 p-4 bg-neutral-900 rounded-xl border border-white/5 hover:border-ninja-purple/50 transition-colors group"
                >
                  {/* Logo / Initiales */}
                  <div className="w-12 h-12 rounded-lg bg-ninja-black border border-ninja-purple/30 flex items-center justify-center flex-shrink-0">
                    {source.logo ? (
                      <img
                        src={source.logo}
                        alt=""
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <span className="text-white font-bold text-sm">
                        {source.channelName?.substring(0, 2).toUpperCase() || '??'}
                      </span>
                    )}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 text-left">
                    <p className="text-white font-semibold group-hover:text-ninja-purple transition-colors">
                      {source.channelName || `Source ${index + 1}`}
                    </p>
                    <p className="text-ninja-magenta text-xs font-bold mt-0.5">
                      {source.quality || 'HD'}
                    </p>
                  </div>

                  {/* Badge provider */}
                  {source.provider && (
                    <span className="text-gray-600 text-xs">
                      {source.provider}
                    </span>
                  )}

                  {/* Play icon */}
                  <div className="w-8 h-8 rounded-full bg-ninja-purple/10 flex items-center justify-center group-hover:bg-ninja-purple/30 transition-colors">
                    <span className="text-ninja-magenta">▶</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Empty state */}
            {(!sources || sources.length === 0) && (
              <div className="text-center py-8">
                <p className="text-gray-500">Aucune source alternative trouvée</p>
              </div>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="w-full mt-6 py-3 text-gray-500 text-sm hover:text-white transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default MultiSourceSelector;
