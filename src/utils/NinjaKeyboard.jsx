import React, { useState, useRef, useEffect, useCallback } from 'react';

// ============================================================================
// NINJA KEYBOARD - Composant réutilisable
// 
// Features:
// - QWERTY/AZERTY layouts (auto-détection langue navigateur)
// - Draggable (poignée en haut)
// - Zoom popup au tap
// - Caractères spéciaux + raccourcis URL
// - Numpad intégré
// - Backspace avec icône
// - Space bar
// - Display search query en header
// ============================================================================

const LAYOUTS = {
  qwerty: {
    nums: ['1','2','3','4','5','6','7','8','9','0'],
    rows: [
      ['Q','W','E','R','T','Y','U','I','O','P'],
      ['A','S','D','F','G','H','J','K','L'],
      ['Z','X','C','V','B','N','M'],
    ],
  },
  azerty: {
    nums: ['1','2','3','4','5','6','7','8','9','0'],
    rows: [
      ['A','Z','E','R','T','Y','U','I','O','P'],
      ['Q','S','D','F','G','H','J','K','L'],
      ['W','X','C','V','B','N','M'],
    ],
  },
};

const SPECIAL_CHARS = [':','@','-','_','*','+','/','=','.'];
const SHORTCUTS = ['http://','https://'];

const detectDefaultLayout = () => /^(fr|be)/i.test(navigator.language || '') ? 'azerty' : 'qwerty';

// ============================================================================
// NINJA KEYBOARD COMPONENT
// ============================================================================
const NinjaKeyboard = ({ 
  position,           // { x: number, y: number }
  onPositionChange,   // (newPos) => void
  onInput,            // (char) => void
  onBackspace,        // () => void
  onClose,            // () => void
  searchQuery = '',   // Display current query in header
}) => {
  const dragRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const isDraggingRef = useRef(false);
  const [layout, setLayout] = useState(detectDefaultLayout);
  const [pressedKey, setPressedKey] = useState(null);
  const pressTimerRef = useRef(null);

  // ============================================================================
  // DRAG HANDLERS
  // ============================================================================
  const handleDragStart = useCallback((e) => {
    const touch = e.touches?.[0] || e;
    dragStartRef.current = { x: touch.clientX, y: touch.clientY, posX: position.x, posY: position.y };
    isDraggingRef.current = true;
  }, [position]);

  const handleDragMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const touch = e.touches?.[0] || e;
    const dx = touch.clientX - dragStartRef.current.x;
    const dy = touch.clientY - dragStartRef.current.y;
    onPositionChange({
      x: Math.max(0, Math.min(window.innerWidth - 380, dragStartRef.current.posX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - 200, dragStartRef.current.posY + dy)),
    });
  }, [onPositionChange]);

  const handleDragEnd = useCallback(() => { isDraggingRef.current = false; }, []);

  useEffect(() => {
    if (!isDraggingRef.current) return;
    window.addEventListener('touchmove', handleDragMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
    return () => {
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [handleDragMove, handleDragEnd]);

  useEffect(() => () => clearTimeout(pressTimerRef.current), []);

  // ============================================================================
  // KEY PRESS HANDLERS
  // ============================================================================
  const handleKeyPress = useCallback((char, keyId) => {
    onInput(char);
    setPressedKey(keyId);
    clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => setPressedKey(null), 150);
  }, [onInput]);

  const handleBackspacePress = useCallback(() => {
    onBackspace();
    setPressedKey('⌫');
    clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => setPressedKey(null), 150);
  }, [onBackspace]);

  const currentLayout = LAYOUTS[layout];

  // ============================================================================
  // STYLES
  // ============================================================================
  const keyBase = {
    minWidth: '30px', height: '34px', borderRadius: '6px', border: 'none',
    color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent', position: 'relative', padding: 0,
  };

  const getKeyStyle = (keyId) => ({
    ...keyBase,
    background: pressedKey === keyId ? '#6225ff' : 'rgba(255,255,255,0.12)',
    transform: pressedKey === keyId ? 'scale(1.05)' : 'scale(1)',
    transition: 'background 0.08s, transform 0.08s',
  });

  // ============================================================================
  // ZOOM POPUP (shows enlarged char when pressed)
  // ============================================================================
  const ZoomPopup = ({ keyId, children }) => {
    if (pressedKey !== keyId) return null;
    return (
      <div style={{
        position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
        background: '#6225ff', color: '#fff', fontSize: '18px', fontWeight: 700,
        borderRadius: '8px', padding: '4px 10px', minWidth: '32px', textAlign: 'center',
        boxShadow: '0 4px 16px rgba(98,37,255,0.5)', pointerEvents: 'none', zIndex: 10,
        whiteSpace: 'nowrap',
      }}>
        {children}
      </div>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div style={{
      position: 'fixed', left: `${position.x}px`, top: `${position.y}px`, zIndex: 10002,
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)', userSelect: 'none', touchAction: 'none',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ========== DRAG HANDLE + HEADER ========== */}
      <div ref={dragRef} onTouchStart={handleDragStart} onMouseDown={handleDragStart}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 10px', cursor: 'grab', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
        <div style={{ width: '24px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)' }} />
        
        {/* Search Query Display */}
        <div style={{ fontSize: '10px', color: '#888', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {searchQuery || '...'}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Layout toggle */}
          <button onClick={() => setLayout(l => l === 'qwerty' ? 'azerty' : 'qwerty')}
            style={{ background: 'rgba(98,37,255,0.2)', border: '1px solid rgba(98,37,255,0.3)', borderRadius: '4px', padding: '2px 6px', color: '#a78bfa', fontSize: '9px', fontWeight: 700, cursor: 'pointer' }}>
            {layout === 'qwerty' ? 'QWE' : 'AZE'}
          </button>
          
          {/* Close button */}
          <button onClick={onClose} style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      {/* ========== MAIN CONTENT: Keys left + Special right ========== */}
      <div style={{ display: 'flex', gap: '6px', padding: '6px 8px 8px' }}>
        {/* ========== LEFT: Main keyboard ========== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* Numbers row */}
          <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
            {currentLayout.nums.map(key => (
              <button key={`n${key}`} onClick={() => handleKeyPress(key, `n${key}`)} style={{ ...getKeyStyle(`n${key}`), minWidth: '26px', fontSize: '11px', color: '#aaa' }}>
                <ZoomPopup keyId={`n${key}`}>{key}</ZoomPopup>
                {key}
              </button>
            ))}
          </div>
          
          {/* Letter rows */}
          <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
            {currentLayout.rows[0].map(key => (
              <button key={key} onClick={() => handleKeyPress(key.toLowerCase(), key)} style={getKeyStyle(key)}>
                <ZoomPopup keyId={key}>{key}</ZoomPopup>
                {key}
              </button>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: '3px', justifyContent: 'center', paddingLeft: '10px', paddingRight: '10px' }}>
            {currentLayout.rows[1].map(key => (
              <button key={key} onClick={() => handleKeyPress(key.toLowerCase(), key)} style={getKeyStyle(key)}>
                <ZoomPopup keyId={key}>{key}</ZoomPopup>
                {key}
              </button>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
            {currentLayout.rows[2].map(key => (
              <button key={key} onClick={() => handleKeyPress(key.toLowerCase(), key)} style={getKeyStyle(key)}>
                <ZoomPopup keyId={key}>{key}</ZoomPopup>
                {key}
              </button>
            ))}
            
            {/* Backspace */}
            <button onClick={handleBackspacePress} style={{ ...getKeyStyle('⌫'), minWidth: '42px', background: pressedKey === '⌫' ? '#ef4444' : 'rgba(255,80,80,0.2)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
              </svg>
            </button>
          </div>
          
          {/* Space row */}
          <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
            <button onClick={() => handleKeyPress(' ', 'space')} style={{ ...getKeyStyle('space'), flex: 1, minWidth: '160px', color: '#888' }}>
              <ZoomPopup keyId="space">␣</ZoomPopup>
              space
            </button>
          </div>
        </div>

        {/* ========== RIGHT: Special chars + shortcuts ========== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '6px' }}>
          {/* Special characters in 3-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}>
            {SPECIAL_CHARS.map(ch => (
              <button key={ch} onClick={() => handleKeyPress(ch, `sp_${ch}`)} style={{ ...getKeyStyle(`sp_${ch}`), minWidth: '28px', fontSize: '12px', color: '#ccc' }}>
                <ZoomPopup keyId={`sp_${ch}`}>{ch}</ZoomPopup>
                {ch}
              </button>
            ))}
          </div>
          
          {/* URL shortcuts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
            {SHORTCUTS.map(sc => (
              <button key={sc} onClick={() => handleKeyPress(sc, `sc_${sc}`)}
                style={{
                  ...getKeyStyle(`sc_${sc}`), minWidth: '80px', fontSize: '8px', fontWeight: 600,
                  color: '#a78bfa', background: pressedKey === `sc_${sc}` ? '#6225ff' : 'rgba(98,37,255,0.12)',
                  padding: '0 4px', whiteSpace: 'nowrap',
                }}>
                {sc}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NinjaKeyboard;
