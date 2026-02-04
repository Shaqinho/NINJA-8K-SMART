import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { ninjaCentral, STORES } from '../services/NinjaCentral';

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
// - Tabs LIVE | MOVIES | SERIES
// - Windowing pour performance (400+ dossiers)
// - Fond translucide avec particles visibles
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
  const [activeTab, setActiveTab] = useState('live'); // live | movies | series
  const [categoryCounts, setCategoryCounts] = useState({});
  
  // Use external control if provided, otherwise internal
  const isSidebarOpen = externalIsOpen !== undefined ? externalIsOpen : internalSidebarOpen;
  const setSidebarOpen = externalOnToggle || setInternalSidebarOpen;
  
  // Refs
  const pillRef = useRef(null);
  const sidebarRef = useRef(null);
  const hideTimerRef = useRef(null);
  const swipeStartRef = useRef({ x: 0, y: 0 });
  const longPressTimerRef = useRef(null);
  const listRef = useRef(null);

  // ========== LOAD CATEGORY COUNTS FROM NINJACENTRAL ==========
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const liveChannels = await ninjaCentral.getAll(STORES.LIVE);
        const counts = {};
        
        liveChannels.forEach(channel => {
          const catId = String(channel.categoryId);
          counts[catId] = (counts[catId] || 0) + 1;
        });
        
        setCategoryCounts(counts);
      } catch (err) {
        console.warn('OTTSidebar: Could not load counts from NinjaCentral', err);
      }
    };
    
    if (isSidebarOpen) {
      loadCounts();
    }
  }, [isSidebarOpen]);

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

  // ========== FILTERED DATA ==========
  const filteredChannels = useMemo(() => {
    if (!currentCategory) return [];
    return channels.filter(ch => String(ch.categoryId) === String(currentCategory.category_id));
  }, [currentCategory, channels]);

  // ========== VIRTUALIZED CATEGORY ROW ==========
  const CategoryRow = useCallback(({ index, style }) => {
    const cat = categories[index];
    const isActive = selectedCategory?.category_id === cat.category_id;
    const count = categoryCounts[String(cat.category_id)] || 0;
    
    return (
      <div
        style={{
          ...style,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          background: isActive ? 'rgba(98, 37, 255, 0.25)' : 'transparent',
          borderLeft: isActive ? '3px solid #6225ff' : '3px solid transparent',
        }}
        onClick={() => handleCategoryClick(cat)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontSize: '12px', 
            fontWeight: 500, 
            color: '#fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {cat.category_name}
          </div>
          <div style={{ fontSize: '10px', color: '#666' }}>
            {count} channels
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    );
  }, [categories, selectedCategory, categoryCounts, handleCategoryClick]);

  // ========== VIRTUALIZED CHANNEL ROW ==========
  const ChannelRow = useCallback(({ index, style }) => {
    const channel = filteredChannels[index];
    const isActive = selectedChannel?.id === channel.id;
    
    return (
      <div
        style={{
          ...style,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          background: isActive ? 'rgba(98, 37, 255, 0.25)' : 'transparent',
          borderLeft: isActive ? '3px solid #6225ff' : '3px solid transparent',
        }}
        onClick={() => handleChannelClick(channel)}
      >
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '6px',
          background: 'rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {channel.logo ? (
            <img 
              src={channel.logo} 
              alt="" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <span style={{ fontSize: '12px', color: '#666' }}>TV</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontSize: '11px', 
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
              fontSize: '9px', 
              color: '#888',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {channel.epg_now}
            </div>
          )}
        </div>
        {isActive && (
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#6225ff',
            boxShadow: '0 0 8px rgba(98, 37, 255, 0.5)',
            flexShrink: 0,
          }} />
        )}
      </div>
    );
  }, [filteredChannels, selectedChannel, handleChannelClick]);

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
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    zIndex: 10000,
    borderRight: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  // ========== TABS ==========
  const tabs = [
    { id: 'live', label: 'LIVE', enabled: true },
    { id: 'movies', label: 'MOVIES', enabled: false },
    { id: 'series', label: 'SERIES', enabled: false },
  ];

  // Calculate list height
  const listHeight = window.innerHeight - 100; // Header + tabs height

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
        {/* Header with Tabs */}
        <div style={{ 
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          {/* Back button when showing channels */}
          {showChannels && (
            <div style={{ 
              padding: '12px 16px 8px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px' 
            }}>
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#fff', fontWeight: 500 }}>
                  {currentCategory?.category_name}
                </div>
                <div style={{ fontSize: '9px', color: '#666' }}>
                  {filteredChannels.length} channels
                </div>
              </div>
            </div>
          )}
          
          {/* Tabs */}
          {!showChannels && (
            <div style={{ 
              display: 'flex', 
              width: '100%',
              padding: '12px 0 0 0',
            }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => tab.enabled && setActiveTab(tab.id)}
                  disabled={!tab.enabled}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    background: 'none',
                    border: 'none',
                    color: !tab.enabled ? '#444' : activeTab === tab.id ? '#fff' : '#888',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: tab.enabled ? 'pointer' : 'not-allowed',
                    opacity: tab.enabled ? 1 : 0.5,
                    borderBottom: activeTab === tab.id ? '2px solid #6225ff' : '2px solid transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* List */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {!showChannels ? (
            // Categories list (virtualized)
            <List
              ref={listRef}
              height={listHeight}
              itemCount={categories.length}
              itemSize={52}
              width="100%"
              overscanCount={5}
            >
              {CategoryRow}
            </List>
          ) : (
            // Channels list (virtualized)
            <List
              height={listHeight}
              itemCount={filteredChannels.length}
              itemSize={52}
              width="100%"
              overscanCount={5}
            >
              {ChannelRow}
            </List>
          )}
        </div>
      </div>
    </>
  );
};

export default OTTSidebar;
