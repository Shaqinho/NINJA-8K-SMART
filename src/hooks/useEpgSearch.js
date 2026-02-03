// ============================================================================
// USE EPG SEARCH - React Hook for EPG Search
// ============================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { searchProgramsByTitle, searchChannelsByName, getProgramsForChannel, getAvailableLanguages } from '../database/ProgramQueries';
import { initSyncService, syncEPGForLanguages, syncSingleChannel, manualReload, getDebounceRemaining, setProgressCallback } from '../services/NinjaSyncService';

const CONFIG = { SEARCH_DEBOUNCE: 150, MIN_QUERY_LENGTH: 2, MAX_RESULTS: 100 };
export const SEARCH_MODES = { PROGRAM: 'program', CHANNEL: 'channel' };

export const useEpgSearch = (xtreamService) => {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState(SEARCH_MODES.PROGRAM);
  const [langFilters, setLangFilters] = useState([]);
  const [includeVip, setIncludeVip] = useState(true);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availableLanguages, setAvailableLanguages] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [channelEpg, setChannelEpg] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, percent: 0 });
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const debounceRef = useRef(null);
  const initRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      if (initRef.current) return;
      try {
        setProgressCallback((p) => setSyncProgress(p));
        await initSyncService();
        const langs = await getAvailableLanguages();
        setAvailableLanguages(langs);
        initRef.current = true;
      } catch (e) { setError('Erreur d\'initialisation'); }
    };
    init();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const loadLanguages = async () => { try { setAvailableLanguages(await getAvailableLanguages()); } catch (e) {} };

  const performSearch = useCallback(async (q) => {
    if (!q || q.length < CONFIG.MIN_QUERY_LENGTH) { setResults([]); setIsLoading(false); return; }
    setIsLoading(true); setError(null);
    try {
      const res = searchMode === SEARCH_MODES.PROGRAM
        ? await searchProgramsByTitle(q, langFilters, includeVip, true, CONFIG.MAX_RESULTS)
        : await searchChannelsByName(q, langFilters, includeVip, CONFIG.MAX_RESULTS);
      setResults(res);
    } catch (e) { setError('Erreur recherche'); setResults([]); }
    finally { setIsLoading(false); }
  }, [searchMode, langFilters, includeVip]);

  const handleQueryChange = useCallback((q) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(q), CONFIG.SEARCH_DEBOUNCE);
  }, [performSearch]);

  const clearSearch = useCallback(() => { setQuery(''); setResults([]); setError(null); setSelectedChannel(null); setChannelEpg([]); }, []);
  const setMode = useCallback((m) => { if (m === SEARCH_MODES.PROGRAM || m === SEARCH_MODES.CHANNEL) { setSearchMode(m); setResults([]); setSelectedChannel(null); setChannelEpg([]); if (query.length >= CONFIG.MIN_QUERY_LENGTH) setTimeout(() => performSearch(query), 50); } }, [query, performSearch]);
  const setLangFilter = useCallback((l) => { setLangFilters(!l || l === 'ALL' ? [] : [l]); if (query.length >= CONFIG.MIN_QUERY_LENGTH) setTimeout(() => performSearch(query), 50); }, [query, performSearch]);
  const toggleVip = useCallback(() => { setIncludeVip(v => { if (query.length >= CONFIG.MIN_QUERY_LENGTH) setTimeout(() => performSearch(query), 50); return !v; }); }, [query, performSearch]);

  const selectChannel = useCallback(async (ch) => {
    setSelectedChannel(ch); setIsLoading(true);
    try {
      if (xtreamService) await syncSingleChannel(xtreamService, ch.stream_id, 20);
      setChannelEpg(await getProgramsForChannel(ch.stream_id, true));
    } catch (e) { setError('Erreur EPG'); setChannelEpg([]); }
    finally { setIsLoading(false); }
  }, [xtreamService]);

  const closeChannelEpg = useCallback(() => { setSelectedChannel(null); setChannelEpg([]); }, []);

  const showToast = useCallback((msg, type = 'info') => { setToast({ visible: true, message: msg, type }); setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000); }, []);
  const hideToast = useCallback(() => setToast(t => ({ ...t, visible: false })), []);

  const handleManualReload = useCallback(async () => {
    if (!xtreamService) { showToast('Service non disponible', 'error'); return; }
    const rem = getDebounceRemaining();
    if (rem > 0) { showToast(`Patientez ${rem}s`, 'warning'); return; }
    setIsSyncing(true);
    try {
      const res = await manualReload(xtreamService, langFilters, includeVip);
      if (res.success) { showToast(`EPG rechargé: ${res.programsCount} programmes`, 'success'); await loadLanguages(); if (query.length >= CONFIG.MIN_QUERY_LENGTH) await performSearch(query); }
      else showToast(res.message, res.debounced ? 'warning' : 'error');
    } catch (e) { showToast('Erreur rechargement', 'error'); }
    finally { setIsSyncing(false); }
  }, [xtreamService, langFilters, includeVip, query, performSearch, showToast]);

  const initialSync = useCallback(async () => {
    if (!xtreamService) return;
    setIsSyncing(true);
    try { await syncEPGForLanguages(xtreamService, langFilters, includeVip, true); await loadLanguages(); showToast('EPG synchronisé', 'success'); }
    catch (e) { showToast('Erreur sync', 'error'); }
    finally { setIsSyncing(false); }
  }, [xtreamService, langFilters, includeVip, showToast]);

  return { query, searchMode, results, isLoading, error, langFilters, includeVip, availableLanguages, selectedChannel, channelEpg, isSyncing, syncProgress, toast, showToast, hideToast, handleQueryChange, clearSearch, setMode, setLangFilter, toggleVip, selectChannel, closeChannelEpg, handleManualReload, initialSync, SEARCH_MODES, CONFIG };
};

export default useEpgSearch;
