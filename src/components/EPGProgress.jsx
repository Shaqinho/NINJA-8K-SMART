// src/components/EPGProgress.jsx
import React, { useState, useEffect } from 'react';

/**
 * NINJA 8K - Barre de Progression EPG
 * Affiche la progression du programme en cours
 */
const EPGProgress = ({ start, end, title }) => {
  const [percentage, setPercentage] = useState(0);

  useEffect(() => {
    if (!start || !end) return;

    const updateProgress = () => {
      const now = Date.now() / 1000;
      const total = end - start;
      const elapsed = now - start;
      setPercentage(Math.max(0, Math.min(1, elapsed / total)));
    };

    updateProgress();
    const interval = setInterval(updateProgress, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [start, end]);

  // Calcul du temps restant
  const getTimeRemaining = () => {
    if (!end) return '';
    const now = Date.now() / 1000;
    const remaining = Math.max(0, end - now);
    const minutes = Math.floor(remaining / 60);
    
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mt-2 w-full">
      {/* Titre du programme */}
      {title && (
        <p className="text-gray-500 text-[10px] mb-1 truncate">
          {title}
        </p>
      )}

      {/* Barre de progression */}
      <div className="relative">
        <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-ninja-gradient transition-all duration-1000 ease-out"
            style={{ width: `${percentage * 100}%` }}
          />
        </div>

        {/* Temps restant */}
        {end && (
          <p className="text-gray-600 text-[9px] mt-1 text-right">
            {getTimeRemaining()} restant
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * EPGBadge - Badge compact pour les cartes
 */
export const EPGBadge = ({ isLive, progress }) => {
  if (!isLive) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 p-2">
      <div className="h-0.5 bg-black/50 rounded-full overflow-hidden">
        <div
          className="h-full bg-ninja-purple"
          style={{ width: `${(progress || 0) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default EPGProgress;
