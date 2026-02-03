import React, { useState } from 'react';
import { glassCard } from '../../constants/theme';

// ============================================================================
// CAST BUTTON & MODAL - Chromecast / AirPlay
// ============================================================================

export const CastButton = ({ available, connected, deviceName, type, onCast, onDisconnect }) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button 
        onClick={() => connected ? setShowMenu(!showMenu) : onCast?.()} 
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${connected ? 'bg-purple-500' : 'bg-white/10 hover:bg-white/20'}`} 
        disabled={!available}
      >
        <svg className={`w-5 h-5 ${connected ? 'text-white' : available ? 'text-white' : 'text-gray-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><line x1="2" y1="20" x2="2.01" y2="20"/>
        </svg>
      </button>

      {showMenu && connected && (
        <div className="absolute bottom-full right-0 mb-2 w-56 rounded-xl overflow-hidden" style={{ ...glassCard, background: 'transparent' }}>
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                </svg>
              </div>
              <div>
                <p className="text-white text-sm font-bold">{deviceName}</p>
                <p className="text-gray-500 text-xs">{type === 'chromecast' ? 'Chromecast' : 'AirPlay'}</p>
              </div>
            </div>
          </div>
          <button onClick={() => { onDisconnect?.(); setShowMenu(false); }} className="w-full px-4 py-3 text-left text-red-400 text-sm font-bold hover:bg-white/5 transition-colors">
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export const CastModal = ({ visible, onClose, devices = [], onSelectDevice, scanning = false }) => {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 bg-transparent" onClick={onClose}>
      <div className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden" style={{ ...glassCard, background: 'transparent' }} onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-white/10">
          <h3 className="text-white font-bold">Cast to Device</h3>
        </div>

        <div className="p-2">
          {scanning && (
            <div className="flex items-center justify-center gap-3 py-8">
              <svg className="w-6 h-6 animate-spin text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
              </svg>
              <span className="text-gray-400 text-sm">Searching for devices...</span>
            </div>
          )}

          {!scanning && devices.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-gray-500 text-sm">No devices found</p>
              <p className="text-gray-600 text-xs mt-1">Make sure your device is on the same network</p>
            </div>
          )}

          {devices.map((device) => (
            <button key={device.id} onClick={() => onSelectDevice?.(device)} className="w-full px-4 py-3 flex items-center gap-3 rounded-xl hover:bg-white/5 transition-colors">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <div className="flex-1 text-left">
                <p className="text-white text-sm font-bold">{device.name}</p>
                <p className="text-gray-500 text-xs">{device.type}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-white/10">
          <button onClick={onClose} className="w-full py-3 rounded-xl bg-white/5 text-white text-sm font-bold hover:bg-white/10 transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default CastButton;
