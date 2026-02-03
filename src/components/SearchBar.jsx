// src/components/SearchBar.jsx
import React, { useState, useMemo, useCallback } from 'react';
import debounce from 'lodash.debounce';

/**
 * NINJA 8K - Barre de Recherche Ultra-Rapide
 * Optimisée pour 60K+ streams avec instant search <10ms
 */
const SearchBar = ({ streams, onResults, onClear }) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Créer un index de recherche léger (une seule fois)
  const searchIndex = useMemo(() => {
    if (!streams) return [];
    return streams.map((item) => ({
      uid: item.uid,
      searchString: item.name.toLowerCase(),
    }));
  }, [streams]);

  // Fonction de recherche avec tri par pertinence
  const performSearch = useCallback(
    (searchQuery) => {
      if (!searchQuery || searchQuery.length < 2) {
        onClear?.();
        return;
      }

      const q = searchQuery.toLowerCase();

      // Filtre sur l'index léger
      const filtered = searchIndex.filter((item) =>
        item.searchString.includes(q)
      );

      // Tri par pertinence (startsWith > includes)
      const sorted = filtered.sort((a, b) => {
        const aStarts = a.searchString.startsWith(q) ? 1 : 0;
        const bStarts = b.searchString.startsWith(q) ? 1 : 0;
        return bStarts - aStarts;
      });

      // Limite à 50 résultats pour la performance
      const limited = sorted.slice(0, 50);

      // Récupère les objets complets
      const results = limited
        .map((f) => streams.find((s) => s.uid === f.uid))
        .filter(Boolean);

      onResults?.(results);
    },
    [searchIndex, streams, onResults, onClear]
  );

  // Debounce pour éviter trop de calculs pendant la frappe
  const debouncedSearch = useMemo(
    () => debounce(performSearch, 150),
    [performSearch]
  );

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  const handleClear = () => {
    setQuery('');
    onClear?.();
  };

  return (
    <div className="px-4 py-3">
      <div
        className={`
          flex items-center gap-3
          bg-neutral-900 rounded-full
          px-5 py-3
          border transition-colors duration-200
          ${isFocused ? 'border-ninja-purple' : 'border-white/10'}
        `}
      >
        {/* Icône de recherche */}
        <svg
          className={`w-5 h-5 transition-colors ${
            isFocused ? 'text-ninja-purple' : 'text-gray-500'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>

        {/* Input */}
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Rechercher une chaîne..."
          className="flex-1 bg-transparent text-white text-base outline-none placeholder-gray-600"
        />

        {/* Bouton Clear */}
        {query && (
          <button
            onClick={handleClear}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Compteur de résultats */}
      {query && (
        <p className="text-gray-600 text-xs mt-2 px-2">
          {query.length < 2
            ? 'Tapez au moins 2 caractères...'
            : `Recherche de "${query}"...`}
        </p>
      )}
    </div>
  );
};

export default SearchBar;
