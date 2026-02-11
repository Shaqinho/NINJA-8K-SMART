import React, { useState, useRef } from 'react';

const Keyboard_Extended = ({ onSearch, onClose }) => {
  const [searchValue, setSearchValue] = useState('');
  const [layout, setLayout] = useState('AZERTY');
  const [mode, setMode] = useState('live');
  const [shiftActive, setShiftActive] = useState(false);
  const [numpadVisible, setNumpadVisible] = useState(true);
  const [activeZone, setActiveZone] = useState('letters');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusVisible, setStatusVisible] = useState(false);
  const statusTimer = useRef(null);

  const AZERTY = ['a','z','e','r','t','y','u','i','o','p','q','s','d','f','g','h','j','k','l','m','w','x','c','v','b','n'];
  const QWERTY = ['q','w','e','r','t','y','u','i','o','p','a','s','d','f','g','h','j','k','l',';','z','x','c','v','b','n','m'];
  const letters = layout === 'AZERTY' ? AZERTY : QWERTY;

  const showStatus = (msg) => {
    setStatusMessage(msg);
    setStatusVisible(true);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatusVisible(false), 2000);
  };

  const type = (char) => setSearchValue(prev => prev + char);
  const typeLetter = (index) => {
    const char = letters[index];
    setSearchValue(prev => prev + (shiftActive ? char.toUpperCase() : char));
  };
  const backspace = () => setSearchValue(prev => prev.slice(0, -1));
  const clearAll = () => { setSearchValue(''); showStatus('Cleared'); };
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

  const Key = ({ char, onPress, onHover, style = {}, special, toggle, active, wide, glyph }) => (
    <button
      style={{
        backgroundColor: special ? 'rgba(0, 212, 255, 0.25)' : (toggle && active ? 'rgba(46, 204, 113, 0.25)' : 'rgba(255, 255, 255, 0.08)'),
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid',
        borderColor: special ? 'rgba(0, 212, 255, 0.4)' : (toggle && active ? 'rgba(46, 204, 113, 0.4)' : 'rgba(255, 255, 255, 0.1)'),
        borderRadius: '6px',
        minWidth: wide ? `${wide}px` : '50px',
        height: '50px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 8px',
        cursor: 'pointer',
        boxShadow: special || (toggle && active) ? '0 4px 12px rgba(0, 212, 255, 0.2)' : '0 2px 4px rgba(0, 0, 0, 0.1)',
        color: '#fff',
        fontSize: glyph ? '16px' : '13px',
        fontWeight: special || (toggle && active) ? '700' : '600',
        textShadow: special || (toggle && active) ? '0 1px 2px rgba(0, 0, 0, 0.2)' : 'none',
        ...style,
      }}
      onClick={onPress}
      onMouseEnter={() => onHover && showStatus(onHover)}
    >
      {char}
    </button>
  );

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%) scale(0.5)',
      transformOrigin: 'center',
      zIndex: 100000,
      backgroundColor: 'rgba(10, 10, 20, 0.75)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      padding: '20px',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
      display: 'flex',
      flexDirection: 'column',
      borderRadius: '12px',
    }}>
      <input
        type="text"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        placeholder="Search channel or program"
        style={{
          width: '100%',
          padding: '15px',
          marginBottom: '15px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: '12px',
          color: '#fff',
          fontSize: '18px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          outline: 'none',
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* ROW 1 */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', minHeight: '50px', position: 'relative' }}>
            {/* Status Toast */}
            {statusVisible && (
              <div style={{
                position: 'absolute',
                top: 0,
                right: '-180px',
                padding: '15px',
                backgroundColor: 'rgba(0, 212, 255, 0.35)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderRadius: '12px',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                minWidth: '200px',
                zIndex: 1000,
                boxShadow: '0 4px 16px rgba(0, 212, 255, 0.25)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: '700',
                textAlign: 'center',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
              }}>
                {statusMessage}
              </div>
            )}
            
            <Key char="HIDE" onPress={onClose} onHover="Hide keyboard" wide={80} />
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
                <Key char="⎙" onPress={() => showStatus('Paste')} onHover="Paste" wide={90} special glyph />
              </div>

              {/* ROW 5 */}
              <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', minHeight: '50px' }}>
                <Key char="CAPS" onPress={toggleShift} onHover="Toggle CAPS" wide={70} toggle active={shiftActive} />
                {letters.slice(20, 27).map((l, i) => (
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
  );
};

export default Keyboard_Extended;
