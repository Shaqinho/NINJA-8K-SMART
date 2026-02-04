import React, { useState, useRef, useEffect, useCallback } from 'react';

// ============================================================================
// OTT SIDEBAR - Composant autonome pour mode paysage/fullscreen
// 
// Features:
// - Pill discrète avec animation jiggle à l'entrée
// - Respiration subtile (pulse blanc 20%)
// - Auto-hide après 3s d'inactivité
// - Combo: Tap (bounce) + Swipe → = ouvre sidebar
// - Long press = toggle sidebar
// - Swipe ← sur sidebar = ferme
// ============================================================================

const OTTSidebar = ({ 
  categories = [], 
  channels = [],
  selectedCategory,
  selectedChannel,
  onCategorySelect,
  onChannelSelect,
  onClose,
  isOpen: externalIsOpen,
  onToggle: externalOnToggle,
}) => {
  // States
  const [isVisible, setIsVisible] = useState(true);
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(false);
  const [isBouncing, setIsBouncing] = useState(false);
  const [showChannels, setShowChannels] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(null);
  
  // Use external control if provided, otherwise internal
  const isSidebarOpen = externalIsOpen !== undefined ? externalIsOpen : internalSidebarOpen;
  const setSidebarOpen = externalOnToggle || setInternalSidebarOpen;
  
  // Refs
  const pillRef = useRef(null);
  const sidebarRef = useRef(null);
  const hideTimerRef = useRef(null);
  const swipeStartRef = useRef({ x: 0, y: 0 });
  const longPressTimerRef = useRef(null);
  
  // ========== AUTO-HIDE LOGIC ==========
  const startHideTimer = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    if (!isSidebarOpen) {
      hideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 3000);
    }
  }, [isSidebarOpen]);
  
  const showPill = useCallback(() => {
    setIsVisible(true);
    startHideTimer();
  }, [startHideTimer]);
  
  // Reset timer on any screen touch
  useEffect(() => {
    const handleTouch = () => showPill();
    window.addEventListener('touchstart', handleTouch);
    window.addEventListener('mousemove', handleTouch);
    
    // Initial hide timer
    startHideTimer();
    
    return () => {
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('mousemove', handleTouch);
      clearTimeout(hideTimerRef.current);
    };
  }, [showPill, startHideTimer]);
  
  // ========== SIDEBAR CONTROLS ==========
  const openSidebar = useCallback(() => {
    setSidebarOpen(true);
    setIsBouncing(false);
    clearTimeout(hideTimerRef.current);
  }, [setSidebarOpen]);
  
  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    setShowChannels(false);
    setCurrentCategory(null);
    startHideTimer();
    onClose?.();
  }, [setSidebarOpen, startHideTimer, onClose]);
  
  // ========== PILL GESTURES ==========
  const triggerBounce = useCallback(() => {
    if (!isBouncing && !isSidebarOpen) {
      setIsBouncing(true);
      setTimeout(() => setIsBouncing(false), 600);
    }
  }, [isBouncing, isSidebarOpen]);
  
  const handlePillTouchStart = useCallback((e) => {
    e.stopPropagation();
    showPill();
    swipeStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
    
    // Trigger bounce
    triggerBounce();
    
    // Long press timer
    longPressTimerRef.current = setTimeout(() => {
      if (isSidebarOpen) {
        closeSidebar();
      } else {
        openSidebar();
      }
    }, 500);
  }, [showPill, triggerBounce, isSidebarOpen, openSidebar, closeSidebar]);
  
  const handlePillTouchMove = useCallback((e) => {
    // Swipe detection pendant bounce
    if (isBouncing) {
      const deltaX = e.touches[0].clientX - swipeStartRef.current.x;
      const deltaY = Math.abs(e.touches[0].clientY - swipeStartRef.current.y);
      
      if (deltaX > 30 && deltaY < 50) {
        e.preventDefault();
        clearTimeout(longPressTimerRef.current);
        openSidebar();
      }
    }
  }, [isBouncing, openSidebar]);
  
  const handlePillTouchEnd = useCallback(() => {
    clearTimeout(longPressTimerRef.current);
  }, []);
  
  // ========== SIDEBAR GESTURES ==========
  const handleSidebarTouchStart = useCallback((e) => {
    swipeStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  }, []);
  
  const handleSidebarTouchEnd = useCallback((e) => {
    const deltaX = e.changedTouches[0].clientX - swipeStartRef.current.x;
    if (deltaX < -50) {
      if (showChannels) {
        setShowChannels(false);
        setCurrentCategory(null);
      } else {
        closeSidebar();
      }
    }
  }, [showChannels, closeSidebar]);
  
  // ========== CATEGORY/CHANNEL SELECTION ==========
  const handleCategoryClick = useCallback((category) => {
    setCurrentCategory(category);
    setShowChannels(true);
    onCategorySelect?.(category);
  }, [onCategorySelect]);
  
  const handleChannelClick = useCallback((channel) => {
    onChannelSelect?.(channel);
    closeSidebar();
  }, [onChannelSelect, closeSidebar]);
  
  const handleBackToCategories = useCallback(() => {
    setShowChannels(false);
    setCurrentCategory(null);
  }, []);

  // ========== STYLES ==========
  const pillStyle = {
    position: 'absolute',
    left: isSidebarOpen ? '280px' : 0,
    top: '50%',
    transform: `translateY(-50%)${isBouncing ? ' translateX(25px)' : ''}`,
    width: isBouncing ? '6px' : '3px',
    height: '120px',
    background: `linear-gradient(180deg, 
      transparent 0%, 
      rgba(255, 255, 255, ${isBouncing ? 0.3 : 0.1}) 20%,
      rgba(255, 255, 255, ${isBouncing ? 0.4 : 0.2}) 50%,
      rgba(255, 255, 255, ${isBouncing ? 0.3 : 0.1}) 80%,
      transparent 100%
    )`,
    borderRadius: '0 3px 3px 0',
    cursor: 'pointer',
    opacity: isVisible ? 1 : 0,
    transition: isBouncing 
      ? 'transform 0.15s ease-out, width 0.15s ease-out, background 0.15s ease-out, left 0.3s ease' 
      : 'opacity 0.5s ease, left 0.3s ease, transform 0.3s ease',
    zIndex: 10001,
    pointerEvents: isVisible ? 'auto' : 'none',
  };
  
  const sidebarStyle = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '280px',
    background: 'linear-gradient(90deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 100%)',
    transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    zIndex: 10000,
    borderRight: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };
  
  const headerStyle = {
    padding: '20px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };
  
  const listStyle = {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  };
  
  const itemStyle = (isActive) => ({
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    background: isActive ? 'rgba(98, 37, 255, 0.25)' : 'transparent',
    borderLeft: isActive ? '3px solid #6225ff' : '3px solid transparent',
    transition: 'background 0.2s',
  });

  // Filtrer les chaînes de la catégorie courante
  const filteredChannels = currentCategory 
    ? channels.filter(ch => String(ch.categoryId) === String(currentCategory.category_id))
    : [];

  return (
    <>
      {/* Pill */}
      <div
        ref={pillRef}
        style={pillStyle}
        onTouchStart={handlePillTouchStart}
        onTouchMove={handlePillTouchMove}
        onTouchEnd={handlePillTouchEnd}
        onClick={(e) => {
          e.stopPropagation();
          triggerBounce();
        }}
      />
      
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        style={sidebarStyle}
        onTouchStart={handleSidebarTouchStart}
        onTouchEnd={handleSidebarTouchEnd}
      >
        {/* Header */}
        <div style={headerStyle}>
          {showChannels && (
            <button
              onClick={handleBackToCategories}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {showChannels ? currentCategory?.category_name : 'Catégories'}
            </div>
            {showChannels && (
              <div style={{ fontSize: '11px', color: '#444', marginTop: '2px' }}>
                {filteredChannels.length} chaînes
              </div>
            )}
          </div>
        </div>
        
        {/* List */}
        <div style={listStyle}>
          {!showChannels ? (
            // Categories list
            categories.map((cat) => (
              <div
                key={cat.category_id}
                style={itemStyle(selectedCategory?.category_id === cat.category_id)}
                onClick={() => handleCategoryClick(cat)}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                }}>
                  📁
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: 500, 
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {cat.category_name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    {cat.count || 0} chaînes
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </div>
            ))
          ) : (
            // Channels list
            filteredChannels.map((channel) => (
              <div
                key={channel.id || channel.stream_id}
                style={itemStyle(selectedChannel?.id === channel.id)}
                onClick={() => handleChannelClick(channel)}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}>
                  {channel.logo ? (
                    <img 
                      src={channel.logo} 
                      alt="" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <span style={{ fontSize: '14px' }}>📺</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: '13px', 
                    fontWeight: 500, 
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {channel.name}
                  </div>
                  {channel.epg_now && (
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#888',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {channel.epg_now}
                    </div>
                  )}
                </div>
                {selectedChannel?.id === channel.id && (
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#6225ff',
                    boxShadow: '0 0 10px rgba(98, 37, 255, 0.5)',
                  }} />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default OTTSidebar;
