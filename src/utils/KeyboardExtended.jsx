import React, { useState, useRef, useCallback } from 'react';

const Keyboard_Extended = ({ onSearch, onClose, onInput }) => {
  const [searchValue, setSearchValue] = useState('');
  const [layout, setLayout] = useState('AZERTY');
  const [mode, setMode] = useState('live');
  const [shiftActive, setShiftActive] = useState(false);
  const [numpadVisible, setNumpadVisible] = useState(true);
  const [activeZone, setActiveZone] = useState('letters');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusVisible, setStatusVisible] = useState(false);
  const statusTimer = useRef(null);
  
  // Drag & Zoom states
  const [position, setPosition] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [scale, setScale] = useState(1.3); // 130% par défaut
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const lastPinchDistance = useRef(null);

  const AZERTY = ['a','z','e','r','t','y','u','i','o','p','q','s','d','f','g','h','j','k','l','m','w','x','c','v','b','n','@','+','|'];
  const QWERTY = ['q','w','e','r','t','y','u','i','o','p','a','s','d','f','g','h','j','k','l',';','z','x','c','v','b','n','m','@','+','|'];
  const letters = layout === 'AZERTY' ? AZERTY : QWERTY;

  const showStatus = (msg) => {
    setStatusMessage(msg);
    setStatusVisible(true);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatusVisible(false), 2000);
  };

  const type = (char) => {
    setSearchValue(prev => prev + char);
    onInput && onInput(char);
  };
  
  const typeLetter = (index) => {
    const char = letters[index];
    const finalChar = shiftActive ? char.toUpperCase() : char;
    setSearchValue(prev => prev + finalChar);
    onInput && onInput(finalChar);
  };
  
  const backspace = () => {
    setSearchValue(prev => prev.slice(0, -1));
    onInput && onInput('BACKSPACE');
  };
  
  const clearAll = () => {
    setSearchValue('');
    onInput && onInput('CLEAR');
    showStatus('Cleared');
  };
  const handleEnter = () => {
    if (searchValue.trim()) {
      onSearch && onSearch(searchValue, mode);
      showStatus(mode === 'deep' ? `DEEP: ${searchValue}` : `LIVE: ${searchValue}`);
    } else {
      showStatus('Enter query');
    }
  };

  const toggleMode = () => {
    const newMode = mode === 'live' ? 'deep' : 'live';
    setMode(newMode);
    showStatus(newMode === 'deep' ? 'DEEP SEARCH' : 'IS LIVE');
  };
  const toggleLayout = () => {
    const newLayout = layout === 'AZERTY' ? 'QWERTY' : 'AZERTY';
    setLayout(newLayout);
    showStatus(newLayout);
  };
  const toggleShift = () => {
    setShiftActive(prev => !prev);
    showStatus(shiftActive ? 'CAPS OFF' : 'CAPS ON');
  };
  const toggleNumpad = () => {
    setNumpadVisible(prev => !prev);
    showStatus(numpadVisible ? 'Numpad OFF' : 'Numpad ON');
  };
  const toggleURL = () => {
    setActiveZone(activeZone === 'url' ? 'letters' : 'url');
    showStatus(activeZone === 'url' ? 'URL OFF' : 'URL ON');
  };
  const toggleAccents = () => {
    setActiveZone(activeZone === 'accents' ? 'letters' : 'accents');
    showStatus(activeZone === 'accents' ? 'ACCENTS OFF' : 'ACCENTS ON');
  };

  // ========== DRAG HANDLERS ==========
  const handleDragStart = (e) => {
    e.stopPropagation();
    const touch = e.touches?.[0] || e;
    dragStart.current = { x: touch.clientX, y: touch.clientY, posX: position.x, posY: position.y };
    setIsDragging(true);
  };

  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches?.[0] || e;
    const dx = touch.clientX - dragStart.current.x;
    const dy = touch.clientY - dragStart.current.y;
    setPosition({
      x: dragStart.current.posX + dx,
      y: dragStart.current.posY + dy,
    });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ========== PINCH ZOOM HANDLERS ==========
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastPinchDistance.current = dist;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && lastPinchDistance.current) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = dist - lastPinchDistance.current;
      const newScale = Math.max(1.0, Math.min(1.3, scale + delta * 0.001));
      setScale(newScale);
      lastPinchDistance.current = dist;
    }
  };

  const handleTouchEnd = () => {
    lastPinchDistance.current = null;
  };

  // UseEffect pour drag
  React.useEffect(() => {
    if (!isDragging) return;
    const moveHandler = (e) => handleDragMove(e);
    const upHandler = () => handleDragEnd();
    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', upHandler);
    return () => {
      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('mouseup', upHandler);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const Key = ({ char, onPress, onHover, style = {}, special, toggle, active, wide, glyph }) => {
    const [isPressed, setIsPressed] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const handleClick = (e) => {
      setIsPressed(true);
      setTimeout(() => setIsPressed(false), 200);
      onPress(e);
    };

    return (
      <div style={{ position: 'relative' }}>
        {/* Popup preview au-dessus quand pressé */}
        {isPressed && (
          <div style={{
            position: 'absolute',
            bottom: '60px',
            left: '50%',
            transform: 'translateX(-50%) scale(1.5)',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            color: '#000',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '24px',
            fontWeight: '800',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            zIndex: 10000,
            pointerEvents: 'none',
            border: '2px solid rgba(255, 255, 255, 0.3)',
          }}>
            {typeof char === 'string' ? char : '👁️'}
          </div>
        )}
        
        <button
          style={{
            backgroundColor: isPressed 
              ? 'rgba(255, 255, 255, 0.4)' 
              : (isHovered ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)'),
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid',
            borderColor: isPressed 
              ? 'rgba(255, 255, 255, 0.6)' 
              : (isHovered ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.1)'),
            borderRadius: '6px',
            minWidth: wide ? `${wide}px` : '50px',
            height: '50px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '0 8px',
            cursor: 'pointer',
            boxShadow: isPressed 
              ? '0 0 20px rgba(255, 255, 255, 0.5), inset 0 2px 8px rgba(0, 0, 0, 0.3)' 
              : (isHovered ? '0 0 10px rgba(255, 255, 255, 0.2)' : '0 2px 4px rgba(0, 0, 0, 0.1)'),
            color: '#fff',
            fontSize: glyph ? '16px' : '13px',
            fontWeight: '600',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
            fontFamily: 'Arial, sans-serif',
            transform: isPressed ? 'scale(0.92)' : 'scale(1)',
            transition: 'all 0.1s ease',
          ...style,
        }}
        onClick={handleClick}
        onMouseEnter={() => { setIsHovered(true); onHover && showStatus(onHover); }}
        onMouseLeave={() => setIsHovered(false)}
      >
        {char}
      </button>
      </div>
    );
  };

  return (
    <>
      {/* Overlay invisible pour tap en dehors */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
        }}
        onClick={onClose}
        onTouchEnd={onClose}
      />
      
      <div 
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: `translate(-50%, -50%) scale(${scale * 0.5})`,
          transformOrigin: 'center',
          zIndex: 100000,
          backgroundColor: 'rgba(10, 10, 20, 0.5)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '20px',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '12px',
          cursor: isDragging ? 'grabbing' : 'default',
          userSelect: 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
      {/* DRAG HANDLE + STATUS LOG */}
      <div 
        style={{
          width: '100%',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
          position: 'relative',
        }}
      >
        {/* Drag handle - gauche */}
        <div 
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          style={{
            width: '100px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            cursor: isDragging ? 'grabbing' : 'grab',
            padding: '8px',
          }}
        >
          <div style={{
            width: '60px',
            height: '6px',
            borderRadius: '3px',
            backgroundColor: 'rgba(255, 255, 255, 0.4)',
          }} />
        </div>

        {/* Status log - centre */}
        {statusVisible && (
          <div style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%) scale(0.7)',
            padding: '8px 12px',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            color: '#fff',
            fontSize: '11px',
            fontWeight: '700',
            textAlign: 'center',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
            whiteSpace: 'nowrap',
          }}>
            {statusMessage}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* ROW 1 */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', minHeight: '50px', position: 'relative' }}>
            
            <Key 
              char={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              }
              onPress={onClose} 
              onHover="Hide keyboard" 
              wide={80} 
            />
            <div style={{ width: '20px' }} />
            <Key char="EPG GRID" onPress={() => showStatus('EPG Grid')} onHover="Navigate to EPG Grid" wide={100} special />
            <Key 
              char={mode === 'live' ? 'IS LIVE' : 'DEEP SEARCH'} 
              onPress={toggleMode} 
              onHover="Toggle IS LIVE / DEEP SEARCH" 
              wide={100}
              toggle
              active={mode === 'deep'}
            />
            <Key char={layout} onPress={toggleLayout} onHover={`Switch to ${layout === 'AZERTY' ? 'QWERTY' : 'AZERTY'}`} wide={100} toggle />
            <Key char="#" onPress={toggleNumpad} onHover="Toggle numeric keypad" wide={100} toggle active={numpadVisible} />
          </div>

          {/* ROW 2 */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', minHeight: '50px' }}>
            {[':','/','.','-','_','?','!','&','#','='].map((c, i) => (
              <Key key={i} char={c} onPress={() => type(c)} onHover={c} />
            ))}
            <Key char="⌫" onPress={backspace} onHover="Delete" wide={90} special glyph />
          </div>

          {/* LETTERS ZONE */}
          {activeZone === 'letters' && (
            <>
              {/* ROW 3 */}
              <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', minHeight: '50px' }}>
                {letters.slice(0, 10).map((l, i) => (
                  <Key key={i} char={shiftActive ? l.toUpperCase() : l} onPress={() => typeLetter(i)} onHover={l.toUpperCase()} />
                ))}
                <Key char="⏎" onPress={handleEnter} onHover="Enter" wide={90} special glyph />
              </div>

              {/* ROW 4 */}
              <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', minHeight: '50px' }}>
                {letters.slice(10, 20).map((l, i) => (
                  <Key key={i} char={shiftActive ? l.toUpperCase() : l} onPress={() => typeLetter(i + 10)} onHover={l.toUpperCase()} />
                ))}
              </div>

              {/* ROW 5 */}
              <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', minHeight: '50px' }}>
                <Key char="CAPS" onPress={toggleShift} onHover="Toggle CAPS" wide={70} toggle active={shiftActive} />
                {letters.slice(20, 30).map((l, i) => (
                  <Key key={i} char={shiftActive ? l.toUpperCase() : l} onPress={() => typeLetter(i + 20)} onHover={l.toUpperCase()} />
                ))}
              </div>
            </>
          )}

          {/* URL ZONE */}
          {activeZone === 'url' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', minHeight: '50px', flexWrap: 'wrap' }}>
                {['http://','https://','get.php?','username=','&password=','&type=m3u','&output=','ts'].map((u, i) => (
                  <Key key={i} char={u} onPress={() => type(u)} onHover={u} style={{ paddingLeft: '4px', paddingRight: '4px' }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', minHeight: '50px', flexWrap: 'wrap' }}>
                {['.com','.net','.org','.xyz','.io','.me',':','/','8080','80'].map((u, i) => (
                  <Key key={i} char={u} onPress={() => type(u)} onHover={u} style={{ paddingLeft: '4px', paddingRight: '4px' }} />
                ))}
              </div>
              <div style={{ minHeight: '50px' }} />
            </>
          )}

          {/* ACCENTS ZONE */}
          {activeZone === 'accents' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', minHeight: '50px' }}>
                {['à','â','é','è','ê','ë','î','ï','ô','ù'].map((a, i) => (
                  <Key key={i} char={a} onPress={() => type(a)} onHover={a} style={{ paddingLeft: '4px', paddingRight: '4px' }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', minHeight: '50px' }}>
                {['À','Â','É','È','Ê','Ë','Î','Ï','Ô','Ù'].map((a, i) => (
                  <Key key={i} char={a} onPress={() => type(a)} onHover={a} style={{ paddingLeft: '4px', paddingRight: '4px' }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', minHeight: '50px' }}>
                {['û','ü','ç','œ','ñ','ÿ','ä','ö','ß','æ'].map((a, i) => (
                  <Key key={i} char={a} onPress={() => type(a)} onHover={a} style={{ paddingLeft: '4px', paddingRight: '4px' }} />
                ))}
              </div>
            </>
          )}

          {/* ROW 6 */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', minHeight: '50px' }}>
            <Key char="SPACE" onPress={() => type(' ')} onHover="Space" wide={320} />
            <Key char="URL" onPress={toggleURL} onHover="Toggle URL builder" wide={70} toggle active={activeZone === 'url'} />
            <Key char="!=?" onPress={toggleAccents} onHover="Toggle accents" wide={70} toggle active={activeZone === 'accents'} />
            <Key char="CLEAR ALL" onPress={clearAll} onHover="Clear all" wide={140} special />
          </div>
        </div>

        {/* NUMPAD */}
        {numpadVisible && (
          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', width: '162px', gap: '6px', marginTop: '55px', alignContent: 'flex-start' }}>
            {['7','8','9','4','5','6','1','2','3'].map((n, i) => (
              <Key key={i} char={n} onPress={() => type(n)} onHover={n} />
            ))}
            <Key char="0" onPress={() => type('0')} onHover="0" />
            <Key char="▲" onPress={() => type('▲')} onHover="UP" />
            <Key char="⏎" onPress={handleEnter} onHover="Enter" special glyph />
            <Key char="◀" onPress={() => type('◀')} onHover="LEFT" />
            <Key char="▼" onPress={() => type('▼')} onHover="DOWN" />
            <Key char="▶" onPress={() => type('▶')} onHover="RIGHT" />
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default Keyboard_Extended;
