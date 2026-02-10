import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Animated } from 'react-native';

const Keyboard_Extended = ({ onSearch, onClose }) => {
  const [searchValue, setSearchValue] = useState('');
  const [layout, setLayout] = useState('AZERTY');
  const [mode, setMode] = useState('live');
  const [shiftActive, setShiftActive] = useState(false);
  const [numpadVisible, setNumpadVisible] = useState(true);
  const [activeZone, setActiveZone] = useState('letters'); // letters, url, accents
  const [statusMessage, setStatusMessage] = useState('');
  
  const statusOpacity = useRef(new Animated.Value(0)).current;
  const statusTimer = useRef(null);

  const AZERTY = ['a','z','e','r','t','y','u','i','o','p','q','s','d','f','g','h','j','k','l','m','w','x','c','v','b','n'];
  const QWERTY = ['q','w','e','r','t','y','u','i','o','p','a','s','d','f','g','h','j','k','l',';','z','x','c','v','b','n'];
  
  const letters = layout === 'AZERTY' ? AZERTY : QWERTY;

  const showStatus = (msg) => {
    setStatusMessage(msg);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    
    Animated.sequence([
      Animated.timing(statusOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(statusOpacity, { toValue: 0, duration: 200, delay: 1800, useNativeDriver: true })
    ]).start();
    
    statusTimer.current = setTimeout(() => setStatusMessage(''), 2200);
  };

  const type = (char) => {
    setSearchValue(prev => prev + char);
  };

  const typeLetter = (index) => {
    const char = letters[index];
    setSearchValue(prev => prev + (shiftActive ? char.toUpperCase() : char));
  };

  const backspace = () => {
    setSearchValue(prev => prev.slice(0, -1));
  };

  const clearAll = () => {
    setSearchValue('');
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

  const Key = ({ char, onPress, onHover, style, special, toggle, active, wide, glyph }) => (
    <TouchableOpacity
      style={[
        styles.key,
        special && styles.keySpecial,
        toggle && active && styles.keyActive,
        wide && { minWidth: wide },
        style
      ]}
      onPress={onPress}
      onPressIn={() => onHover && showStatus(onHover)}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.keyText,
        special && styles.keyTextSpecial,
        toggle && active && styles.keyTextActive,
        glyph && styles.keyGlyph
      ]}>
        {char}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⌨️ NINJA KEYBOARD</Text>
      <Text style={styles.subtitle}>Extended Layout</Text>

      <TextInput
        style={styles.searchInput}
        value={searchValue}
        onChangeText={setSearchValue}
        placeholder="Type to search..."
        placeholderTextColor="#666"
      />

      <View style={styles.keyboard}>
        <Animated.View style={[styles.statusToast, { opacity: statusOpacity }]}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </Animated.View>

        <View style={styles.keyboardLeft}>
          {/* ROW 1 */}
          <View style={styles.row}>
            <Key char="HIDE" onPress={onClose} onHover="Hide keyboard" wide={80} />
            <View style={styles.spacer} />
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
          </View>

          {/* ROW 2 */}
          <View style={styles.row}>
            {[':','/','.','-','_','?','!','&','#','='].map((c, i) => (
              <Key key={i} char={c} onPress={() => type(c)} onHover={c} />
            ))}
            <Key char="⌫" onPress={backspace} onHover="Delete" wide={90} special glyph />
          </View>

          {/* LETTERS ZONE */}
          {activeZone === 'letters' && (
            <>
              {/* ROW 3 */}
              <View style={styles.row}>
                {letters.slice(0, 10).map((l, i) => (
                  <Key key={i} char={shiftActive ? l.toUpperCase() : l} onPress={() => typeLetter(i)} onHover={l.toUpperCase()} />
                ))}
                <Key char="⏎" onPress={handleEnter} onHover="Enter" wide={90} special glyph />
              </View>

              {/* ROW 4 */}
              <View style={styles.row}>
                {letters.slice(10, 20).map((l, i) => (
                  <Key key={i} char={shiftActive ? l.toUpperCase() : l} onPress={() => typeLetter(i + 10)} onHover={l.toUpperCase()} />
                ))}
                <Key char="⎙" onPress={() => showStatus('Paste')} onHover="Paste" wide={90} special glyph />
              </View>

              {/* ROW 5 */}
              <View style={styles.row}>
                <Key char="CAPS" onPress={toggleShift} onHover="Toggle CAPS" wide={140} toggle active={shiftActive} />
                {letters.slice(20, 26).map((l, i) => (
                  <Key key={i} char={shiftActive ? l.toUpperCase() : l} onPress={() => typeLetter(i + 20)} onHover={l.toUpperCase()} />
                ))}
              </View>
            </>
          )}

          {/* URL ZONE */}
          {activeZone === 'url' && (
            <>
              {/* ROW 3 URL */}
              <View style={styles.row}>
                {['http://','https://','get.php?','username=','&password=','&type=m3u','&output=','ts'].map((u, i) => (
                  <Key key={i} char={u} onPress={() => type(u)} onHover={u} style={styles.keySmall} />
                ))}
              </View>

              {/* ROW 4 URL */}
              <View style={styles.row}>
                {['.com','.net','.org','.xyz','.io','.me',':','/','8080','80'].map((u, i) => (
                  <Key key={i} char={u} onPress={() => type(u)} onHover={u} style={styles.keySmall} />
                ))}
              </View>

              {/* ROW 5 URL - Empty */}
              <View style={styles.row} />
            </>
          )}

          {/* ACCENTS ZONE */}
          {activeZone === 'accents' && (
            <>
              {/* ROW 3 ACCENTS */}
              <View style={styles.row}>
                {['à','â','é','è','ê','ë','î','ï','ô','ù'].map((a, i) => (
                  <Key key={i} char={a} onPress={() => type(a)} onHover={a} style={styles.keySmall} />
                ))}
              </View>

              {/* ROW 4 ACCENTS */}
              <View style={styles.row}>
                {['À','Â','É','È','Ê','Ë','Î','Ï','Ô','Ù'].map((a, i) => (
                  <Key key={i} char={a} onPress={() => type(a)} onHover={a} style={styles.keySmall} />
                ))}
              </View>

              {/* ROW 5 ACCENTS */}
              <View style={styles.row}>
                {['û','ü','ç','œ','ñ','ÿ','ä','ö','ß','æ'].map((a, i) => (
                  <Key key={i} char={a} onPress={() => type(a)} onHover={a} style={styles.keySmall} />
                ))}
              </View>
            </>
          )}

          {/* ROW 6 */}
          <View style={styles.row}>
            <Key char="SPACE" onPress={() => type(' ')} onHover="Space" wide={320} />
            <Key char="URL" onPress={toggleURL} onHover="Toggle URL builder" wide={70} toggle active={activeZone === 'url'} />
            <Key char="!=?" onPress={toggleAccents} onHover="Toggle accents" wide={70} toggle active={activeZone === 'accents'} />
            <Key char="CLEAR ALL" onPress={clearAll} onHover="Clear all" wide={140} special />
          </View>
        </View>

        {/* NUMPAD */}
        {numpadVisible && (
          <View style={styles.numpad}>
            {['7','8','9','4','5','6','1','2','3'].map((n, i) => (
              <Key key={i} char={n} onPress={() => type(n)} onHover={n} />
            ))}
            <Key char="0" onPress={() => type('0')} onHover="0" />
            <Key char="▲" onPress={() => type('▲')} onHover="▲" />
            <Key char="⏎" onPress={handleEnter} onHover="Enter" special glyph />
            <Key char="◀" onPress={() => type('◀')} onHover="◀" />
            <Key char="▼" onPress={() => type('▼')} onHover="▼" />
            <Key char="▶" onPress={() => type('▶')} onHover="▶" />
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 20, 0.75)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    padding: 20,
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    color: '#00d4ff',
    marginBottom: 5,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
    marginBottom: 15,
  },
  searchInput: {
    width: '100%',
    padding: 15,
    marginBottom: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 12,
    color: '#fff',
    fontSize: 18,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  keyboard: {
    flexDirection: 'row',
    gap: 10,
    position: 'relative',
  },
  keyboardLeft: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
    minHeight: 50,
  },
  spacer: {
    width: 20,
  },
  key: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    minWidth: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
  keySmall: {
    paddingHorizontal: 4,
  },
  keyText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  keyGlyph: {
    fontSize: 16,
  },
  keySpecial: {
    backgroundColor: 'rgba(0, 212, 255, 0.25)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderColor: 'rgba(0, 212, 255, 0.4)',
    boxShadow: '0 4px 12px rgba(0, 212, 255, 0.2)',
  },
  keyTextSpecial: {
    color: '#fff',
    fontWeight: '700',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
  },
  keyActive: {
    backgroundColor: 'rgba(46, 204, 113, 0.25)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderColor: 'rgba(46, 204, 113, 0.4)',
    boxShadow: '0 4px 12px rgba(46, 204, 113, 0.2)',
  },
  keyTextActive: {
    color: '#fff',
    fontWeight: '700',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
  },
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 162,
    gap: 6,
    marginTop: 55,
  },
  statusToast: {
    position: 'absolute',
    top: 0,
    right: -220,
    padding: 15,
    backgroundColor: 'rgba(0, 212, 255, 0.35)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    minWidth: 200,
    zIndex: 1000,
    boxShadow: '0 4px 16px rgba(0, 212, 255, 0.25)',
  },
  statusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
  },
});

export default Keyboard_Extended;
