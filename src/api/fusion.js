// src/api/fusion.js
/**
 * NINJA 8K - Moteur de Fusion
 * Dédoublonnage intelligent et multi-sources
 */

export const FusionEngine = {
  /**
   * Fusionne plusieurs playlists en une seule avec dédoublonnage
   * @param {Array} playlists - [{name: 'Server1', data: [...streams]}]
   * @returns {Array} - Streams fusionnés avec sources multiples
   */
  merge(playlists) {
    const unified = {};

    playlists.forEach((playlist) => {
      playlist.data.forEach((stream) => {
        // Nettoyage du nom pour la comparaison
        const key = this.cleanName(stream.name);

        if (!unified[key]) {
          unified[key] = {
            ...stream,
            sources: [{
              uid: stream.uid,
              provider: stream.provider,
              url: stream.url,
              quality: this.detectQuality(stream.name),
            }],
          };
        } else {
          // Ajoute une nouvelle source au stream existant
          unified[key].sources.push({
            uid: stream.uid,
            provider: stream.provider,
            url: stream.url,
            quality: this.detectQuality(stream.name),
          });
        }
      });
    });

    return Object.values(unified);
  },

  /**
   * Nettoie le nom pour comparaison (enlève HD, FHD, 4K, etc.)
   */
  cleanName(name) {
    return name
      .toLowerCase()
      .replace(/\s*(hd|fhd|4k|uhd|8k|h\.265|hevc|sd)\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  /**
   * Détecte la qualité depuis le nom du stream
   */
  detectQuality(name) {
    const upper = name.toUpperCase();
    if (upper.includes('8K')) return '8K';
    if (upper.includes('4K') || upper.includes('UHD')) return '4K';
    if (upper.includes('FHD') || upper.includes('1080')) return 'FHD';
    if (upper.includes('HD') || upper.includes('720')) return 'HD';
    if (upper.includes('SD')) return 'SD';
    return 'HD'; // Default
  },

  /**
   * Recherche croisée dans l'EPG pour trouver un programme sur d'autres chaînes
   */
  findAlternativeSources(programTitle, globalEPG) {
    const query = programTitle.toLowerCase();

    return globalEPG.filter((item) => {
      const current = item.currentProgram?.toLowerCase() || '';
      return current.includes(query) || query.includes(current);
    });
  },

  /**
   * Comparaison intelligente par mots-clés
   * Ex: "PSG vs OM" et "Ligue 1: Paris Marseille" → match
   */
  isSimilarProgram(title1, title2) {
    const words1 = title1.toLowerCase().split(/[\s\-:,]+/);
    const words2 = title2.toLowerCase();

    // Compte les mots de plus de 3 caractères qui matchent
    const common = words1.filter(
      (word) => word.length > 3 && words2.includes(word)
    );

    return common.length >= 2;
  },

  /**
   * Trie les sources par qualité (meilleure en premier)
   */
  sortByQuality(sources) {
    const qualityOrder = { '8K': 0, '4K': 1, 'FHD': 2, 'HD': 3, 'SD': 4 };

    return [...sources].sort((a, b) => {
      const orderA = qualityOrder[a.quality] ?? 5;
      const orderB = qualityOrder[b.quality] ?? 5;
      return orderA - orderB;
    });
  },

  /**
   * Groupe les streams par catégorie pour le Dashboard
   */
  groupByCategory(streams, categories) {
    const grouped = {};

    categories.forEach((cat) => {
      grouped[cat.category_id] = {
        id: cat.category_id,
        name: cat.category_name,
        streams: [],
      };
    });

    streams.forEach((stream) => {
      if (grouped[stream.category]) {
        grouped[stream.category].streams.push(stream);
      }
    });

    // Retourne seulement les catégories non vides
    return Object.values(grouped).filter((cat) => cat.streams.length > 0);
  },
};

export default FusionEngine;
