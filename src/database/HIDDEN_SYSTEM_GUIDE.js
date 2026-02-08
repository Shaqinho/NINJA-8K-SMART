// ============================================================================
// GUIDE D'UTILISATION - SYSTÈME HIDE/SHOW
// ============================================================================

/*
╔══════════════════════════════════════════════════════════════════════════╗
║                    SYSTÈME HIDE/SHOW FOLDERS & CHANNELS                  ║
╠══════════════════════════════════════════════════════════════════════════╣
║ FONCTIONNALITÉS                                                          ║
║ ✅ Hide/Show dossiers (folders/categories)                              ║
║ ✅ Hide/Show chaînes individuelles                                      ║
║ ✅ Persisté en DB (NinjaLocalDB)                                        ║
║ ✅ Sync entre sessions                                                  ║
║ ✅ Filtrage automatique dans les queries                               ║
╚══════════════════════════════════════════════════════════════════════════╝
*/

// ============================================================================
// EXEMPLE 1 : HIDE/SHOW FOLDERS (Dans OTTSidebar.jsx)
// ============================================================================

import { toggleFolder, filterVisibleFolders, isFolderHidden } from '../database/HiddenManager';

// Toggle folder visibility (bouton eye icon)
const handleToggleFolder = async (folder) => {
  const result = await toggleFolder(folder.category_id, folder.category_name);
  
  if (result.hidden) {
    alert(`👁️‍🗨️ Dossier "${folder.category_name}" masqué`);
  } else {
    alert(`👁️ Dossier "${folder.category_name}" affiché`);
  }
  
  // Refresh UI
  loadFolders();
};

// Load folders (with filtering)
const loadFolders = async () => {
  const allFolders = await fetchLiveCategories();
  
  // Filter hidden folders
  const visibleFolders = await filterVisibleFolders(allFolders);
  
  setFolders(visibleFolders);
};

// Check if folder is hidden (pour afficher icon eye)
const checkFolderVisibility = async (categoryId) => {
  const hidden = await isFolderHidden(categoryId);
  return hidden; // true = hidden, false = visible
};

// ============================================================================
// EXEMPLE 2 : HIDE/SHOW CHANNELS (Dans OTTRight.jsx)
// ============================================================================

import { toggleChannel, filterVisibleChannels, isChannelHidden } from '../database/HiddenManager';

// Toggle channel visibility
const handleToggleChannel = async (channel) => {
  const result = await toggleChannel(channel.stream_id);
  
  if (result.hidden) {
    alert(`👁️‍🗨️ Chaîne "${channel.name}" masquée`);
  } else {
    alert(`👁️ Chaîne "${channel.name}" affichée`);
  }
  
  // Refresh channel list
  loadChannels();
};

// Load channels from folder (with filtering)
const loadChannels = async (folderId) => {
  const allChannels = await fetchChannelsInFolder(folderId);
  
  // Filter hidden channels
  const visibleChannels = await filterVisibleChannels(allChannels);
  
  setChannels(visibleChannels);
};

// Check if channel is hidden
const checkChannelVisibility = async (streamId) => {
  const hidden = await isChannelHidden(streamId);
  return hidden;
};

// ============================================================================
// EXEMPLE 3 : UI COMPONENTS
// ============================================================================

// Bouton Eye Icon (Toggle)
const EyeButton = ({ item, type }) => {
  const [hidden, setHidden] = useState(false);
  
  useEffect(() => {
    const checkVisibility = async () => {
      if (type === 'folder') {
        const isHidden = await isFolderHidden(item.category_id);
        setHidden(isHidden);
      } else if (type === 'channel') {
        const isHidden = await isChannelHidden(item.stream_id);
        setHidden(isHidden);
      }
    };
    checkVisibility();
  }, [item]);
  
  const handleToggle = async () => {
    if (type === 'folder') {
      const result = await toggleFolder(item.category_id, item.category_name);
      setHidden(result.hidden);
    } else if (type === 'channel') {
      const result = await toggleChannel(item.stream_id);
      setHidden(result.hidden);
    }
  };
  
  return (
    <TouchableOpacity onPress={handleToggle}>
      <Text style={{ fontSize: 20 }}>
        {hidden ? '👁️‍🗨️' : '👁️'}
      </Text>
    </TouchableOpacity>
  );
};

// ============================================================================
// EXEMPLE 4 : SETTINGS PAGE - MANAGE HIDDEN ITEMS
// ============================================================================

import { getHiddenFolders, getHiddenChannels, getHiddenStats, resetAllHidden } from '../database/HiddenManager';

const HiddenItemsSettings = () => {
  const [hiddenFolders, setHiddenFolders] = useState([]);
  const [hiddenChannels, setHiddenChannels] = useState([]);
  const [stats, setStats] = useState({ hiddenFolders: 0, hiddenChannels: 0 });
  
  useEffect(() => {
    loadHiddenItems();
  }, []);
  
  const loadHiddenItems = async () => {
    const folders = await getHiddenFolders();
    const channels = await getHiddenChannels();
    const statistics = await getHiddenStats();
    
    setHiddenFolders(folders);
    setHiddenChannels(channels);
    setStats(statistics);
  };
  
  const handleResetAll = async () => {
    if (confirm('Afficher tous les dossiers et chaînes masqués ?')) {
      await resetAllHidden();
      loadHiddenItems();
      alert('✅ Tous les éléments sont maintenant visibles');
    }
  };
  
  return (
    <View>
      <Text>📊 Statistiques</Text>
      <Text>Dossiers masqués: {stats.hiddenFolders}</Text>
      <Text>Chaînes masquées: {stats.hiddenChannels}</Text>
      
      <Button onPress={handleResetAll}>
        Tout afficher
      </Button>
      
      {/* Liste des dossiers masqués */}
      {hiddenFolders.map(folder => (
        <View key={folder.category_id}>
          <Text>{folder.category_name}</Text>
          <Button onPress={() => showFolder(folder.category_id)}>
            Afficher
          </Button>
        </View>
      ))}
      
      {/* Liste des chaînes masquées */}
      {hiddenChannels.map(channel => (
        <View key={channel.stream_id}>
          <Text>{channel.name}</Text>
          <Button onPress={() => showChannel(channel.stream_id)}>
            Afficher
          </Button>
        </View>
      ))}
    </View>
  );
};

// ============================================================================
// EXEMPLE 5 : HIDE ALL CHANNELS IN FOLDER
// ============================================================================

import { hideAllChannelsInFolder, showAllChannelsInFolder } from '../database/HiddenManager';

// Hide toutes les chaînes d'un dossier
const handleHideAllInFolder = async (categoryId) => {
  await hideAllChannelsInFolder(categoryId);
  alert('✅ Toutes les chaînes du dossier ont été masquées');
  loadChannels();
};

// Show toutes les chaînes d'un dossier
const handleShowAllInFolder = async (categoryId) => {
  await showAllChannelsInFolder(categoryId);
  alert('✅ Toutes les chaînes du dossier sont maintenant visibles');
  loadChannels();
};

// ============================================================================
// EXEMPLE 6 : INTÉGRATION AVEC SEARCH
// ============================================================================

import { searchChannelsByName } from '../database/ProgramQueries';
import { filterVisibleChannels } from '../database/HiddenManager';

// Search channels (exclude hidden)
const searchChannels = async (query) => {
  // 1. Search in DB
  const results = await searchChannelsByName(query);
  
  // 2. Filter hidden channels
  const visible = await filterVisibleChannels(results);
  
  return visible;
};

// ============================================================================
// API COMPLÈTE
// ============================================================================

/*
FOLDERS:
--------
hideFolder(categoryId, categoryName)       // Masquer un dossier
showFolder(categoryId)                     // Afficher un dossier
toggleFolder(categoryId, categoryName)     // Toggle visibility
isFolderHidden(categoryId)                 // Check si masqué
getHiddenFolders()                         // Liste dossiers masqués
filterVisibleFolders(folders)              // Filtre dossiers visibles

CHANNELS:
---------
hideChannel(streamId)                      // Masquer une chaîne
showChannel(streamId)                      // Afficher une chaîne
toggleChannel(streamId)                    // Toggle visibility
isChannelHidden(streamId)                  // Check si masquée
getHiddenChannels()                        // Liste chaînes masquées
filterVisibleChannels(channels)            // Filtre chaînes visibles
hideAllChannelsInFolder(categoryId)        // Masquer toutes dans dossier
showAllChannelsInFolder(categoryId)        // Afficher toutes dans dossier

STATS & RESET:
--------------
getHiddenStats()                           // Stats { hiddenFolders, hiddenChannels }
resetAllHidden()                           // Tout afficher (reset)
*/

// ============================================================================
// WORKFLOW UI RECOMMANDÉ
// ============================================================================

/*
OTTSidebar (Liste dossiers):
  → Long press sur dossier → Menu contextuel
    → "👁️‍🗨️ Masquer ce dossier"
    → "👁️ Afficher ce dossier"

OTTRight (Liste chaînes):
  → Long press sur chaîne → Menu contextuel
    → "👁️‍🗨️ Masquer cette chaîne"
    → "👁️ Afficher cette chaîne"
    
Settings → Hidden Items:
  → Liste dossiers masqués (avec bouton Afficher)
  → Liste chaînes masquées (avec bouton Afficher)
  → Bouton "Tout afficher" (reset)
  → Stats affichées
*/
