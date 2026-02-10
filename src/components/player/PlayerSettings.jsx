import React, { useState } from 'react';
import { glassCard } from '../../constants/theme';
import SettingsOverlay from './SettingsOverlay';

// ============================================================================
// PLAYER SETTINGS - Quality, Speed, Subtitles, Audio, Aspect + Global Settings
// ============================================================================

const SettingItem = ({ label, active, onClick }) => (
  <button onClick={onClick} className={`w-full px-4 py-3 flex items-center justify-between rounded-xl transition-all ${active ? 'bg-purple-500/20 border border-purple-500/50' : 'hover:bg-white/5'}`}>
    <span className="text-white text-sm">{label}</span>
    {active && (
      <svg className="w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    )}
  </button>
);

const TabIcons = {
  quality: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 8h4l-2 8M15 8v8M15 12h2"/></svg>,
  speed: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  subtitles: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 12h4M14 12h4M6 16h8"/></svg>,
  audio: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>,
  aspect: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/></svg>,
  more: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>,
};

export const PlayerSettings = ({
  visible,
  onClose,
  activeTab = 'quality',
  qualities = ['Auto', '1080p', '720p', '480p', '360p'],
  currentQuality = 'Auto',
  onQualityChange,
  speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
  currentSpeed = 1,
  onSpeedChange,
  subtitles = [{ id: 'off', label: 'Off' }],
  currentSubtitle = 'off',
  onSubtitleChange,
  audioTracks = [{ id: 'default', label: 'Default' }],
  currentAudioTrack = 'default',
  onAudioTrackChange,
  aspectRatios = ['Auto', '16:9', '4:3', 'Fill', 'Cover'],
  currentAspectRatio = 'Auto',
  onAspectRatioChange,
  // SettingsOverlay props
  xtreamService,
  onEPGGrid,
  onServers,
}) => {
  const [tab, setTab] = useState(activeTab);
  const [showMore, setShowMore] = useState(false);
  
  const tabs = [
    { id: 'quality', label: 'Quality', Icon: TabIcons.quality },
    { id: 'speed', label: 'Speed', Icon: TabIcons.speed },
    { id: 'subtitles', label: 'Subtitles', Icon: TabIcons.subtitles },
    { id: 'audio', label: 'Audio', Icon: TabIcons.audio },
    { id: 'aspect', label: 'Aspect', Icon: TabIcons.aspect },
    { id: 'more', label: 'More', Icon: TabIcons.more },
  ];

  if (!visible) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden" 
        style={{ ...glassCard, background: 'rgba(10, 10, 15, 0.95)' }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-white font-bold">Settings</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex overflow-x-auto p-2 gap-1 border-b border-white/10">
          {tabs.map((t) => (
            <button 
              key={t.id} 
              onClick={() => {
                if (t.id === 'more') {
                  setShowMore(true);
                } else {
                  setTab(t.id);
                }
              }} 
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${tab === t.id ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <t.Icon />{t.label}
            </button>
          ))}
        </div>

        <div className="p-2 max-h-64 overflow-y-auto">
          {tab === 'quality' && (
            <div className="space-y-1">
              {qualities.map((q) => <SettingItem key={q} label={q} active={currentQuality === q} onClick={() => onQualityChange?.(q)}/>)}
            </div>
          )}
          {tab === 'speed' && (
            <div className="space-y-1">
              {speeds.map((s) => <SettingItem key={s} label={s === 1 ? 'Normal' : `${s}x`} active={currentSpeed === s} onClick={() => onSpeedChange?.(s)}/>)}
            </div>
          )}
          {tab === 'subtitles' && (
            <div className="space-y-1">
              {subtitles.map((s) => <SettingItem key={s.id} label={s.label} active={currentSubtitle === s.id} onClick={() => onSubtitleChange?.(s.id)}/>)}
            </div>
          )}
          {tab === 'audio' && (
            <div className="space-y-1">
              {audioTracks.map((a) => <SettingItem key={a.id} label={a.label} active={currentAudioTrack === a.id} onClick={() => onAudioTrackChange?.(a.id)}/>)}
            </div>
          )}
          {tab === 'aspect' && (
            <div className="space-y-1">
              {aspectRatios.map((a) => <SettingItem key={a} label={a} active={currentAspectRatio === a} onClick={() => onAspectRatioChange?.(a)}/>)}
            </div>
          )}
        </div>
      </div>

      {/* SettingsOverlay (More) */}
      <SettingsOverlay
        visible={showMore}
        onClose={() => setShowMore(false)}
        xtreamService={xtreamService}
        onEPGGrid={() => {
          setShowMore(false);
          onClose();
          onEPGGrid?.();
        }}
        onServers={() => {
          setShowMore(false);
          onClose();
          onServers?.();
        }}
        sidebarOpen={false}
      />
    </div>
  );
};

export default PlayerSettings;
