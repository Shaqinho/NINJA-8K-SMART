import React, { useState } from 'react';

const KeyboardSettings = ({ onClose }) => {
  const [selectedKeyboard, setSelectedKeyboard] = useState(() => {
    return localStorage.getItem('ninja_keyboard_type') || 'extended';
  });

  const keyboards = [
    { 
      id: 'extended', 
      name: 'Extended Keyboard', 
      description: 'Full-featured keyboard with URL builder, accents, numpad'
    },
    { 
      id: 'ninja', 
      name: 'Ninja Keyboard', 
      description: 'Compact QWERTY/AZERTY keyboard with drag support'
    },
  ];

  const handleSelect = (keyboardId) => {
    setSelectedKeyboard(keyboardId);
    localStorage.setItem('ninja_keyboard_type', keyboardId);
    window.dispatchEvent(new Event('keyboard_settings_changed'));
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
      zIndex: 10003, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }}>
      <div style={{
        background: 'rgba(18, 18, 31, 0.95)', borderRadius: '16px',
        border: '1px solid rgba(98, 37, 255, 0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        maxWidth: '500px', width: '100%', padding: '30px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', margin: 0 }}>⌨️ Keyboard Settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '24px', padding: '4px' }}>✕</button>
        </div>
        <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px' }}>
          Choose your preferred keyboard layout. The selected keyboard will be used throughout the app.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {keyboards.map(kb => (
            <div key={kb.id} onClick={() => handleSelect(kb.id)} style={{
              padding: '16px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s ease',
              border: selectedKeyboard === kb.id ? '2px solid rgba(98, 37, 255, 0.6)' : '2px solid rgba(255, 255, 255, 0.1)',
              background: selectedKeyboard === kb.id ? 'rgba(98, 37, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%', border: '2px solid',
                  borderColor: selectedKeyboard === kb.id ? '#6225ff' : '#444',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {selectedKeyboard === kb.id && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6225ff' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>{kb.name}</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>{kb.description}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '24px', padding: '12px', borderRadius: '8px', background: 'rgba(0, 212, 255, 0.1)', border: '1px solid rgba(0, 212, 255, 0.2)' }}>
          <p style={{ color: '#00d4ff', fontSize: '11px', margin: 0 }}>ℹ️ Changes are applied immediately. No restart required.</p>
        </div>
      </div>
    </div>
  );
};

export default KeyboardSettings;
