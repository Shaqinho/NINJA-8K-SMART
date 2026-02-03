// ============================================================================
// THEME CONSTANTS - NINJA 8K
// ============================================================================
// Theme 1: Purple/Violet with green NOW badge
// Theme 2: (Reserved for future use)
// ============================================================================

// ============================================================================
// THEME SELECTION
// ============================================================================
const CURRENT_THEME = 'theme1'; // 'theme1' or 'theme2'

// ============================================================================
// THEME 1 - Purple/Violet
// ============================================================================
const THEME_1 = {
  colors: {
    // Base colors
    bg: '#0a0a0f',
    card: '#13131a',
    row: 'rgba(255, 255, 255, 0.05)',
    
    // Primary accent
    primary: '#6225FF',
    primaryLight: '#B85CFF',
    
    // Channel text colors
    channelText: '#5D28F1',           // Non-selected channels
    channelTextSelected: '#ffffff',    // Selected channel
    
    // NOW badge (in channel rows)
    nowBadge: '#00ed0f',              // Green
    nowBadgeText: '#000000',
    
    // NOW button (in header) - stays purple
    nowButtonActive: '#6225FF',
    nowButtonInactive: 'rgba(255,255,255,0.1)',
    
    // Status colors
    live: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    
    // Text colors
    textPrimary: '#ffffff',
    textSecondary: '#9ca3af',
    textMuted: '#6b7280',
  },
  
  gradients: {
    // Primary gradient
    primary: 'linear-gradient(135deg, #6225FF 0%, #B85CFF 100%)',
    
    // Selected channel gradient
    selectedChannel: 'linear-gradient(135deg, #6225FF 0%, #B85CFF 100%)',
    
    // Background gradients
    dark: 'linear-gradient(180deg, #0a0a0f 0%, #13131a 100%)',
    overlay: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
    overlayTop: 'linear-gradient(rgba(0,0,0,0.8), transparent)',
  },
};

// ============================================================================
// THEME 2 - Reserved for future
// ============================================================================
const THEME_2 = {
  colors: {
    // Base colors
    bg: '#0a0a0f',
    card: '#13131a',
    row: 'rgba(255, 255, 255, 0.05)',
    
    // Primary accent (different color scheme)
    primary: '#00d4ff',
    primaryLight: '#00ffcc',
    
    // Channel text colors
    channelText: '#00b8e6',
    channelTextSelected: '#ffffff',
    
    // NOW badge
    nowBadge: '#ff6b00',
    nowBadgeText: '#000000',
    
    // NOW button (in header)
    nowButtonActive: '#00d4ff',
    nowButtonInactive: 'rgba(255,255,255,0.1)',
    
    // Status colors
    live: '#ef4444',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    
    // Text colors
    textPrimary: '#ffffff',
    textSecondary: '#9ca3af',
    textMuted: '#6b7280',
  },
  
  gradients: {
    primary: 'linear-gradient(135deg, #00d4ff 0%, #00ffcc 100%)',
    selectedChannel: 'linear-gradient(135deg, #00d4ff 0%, #00ffcc 100%)',
    dark: 'linear-gradient(180deg, #0a0a0f 0%, #13131a 100%)',
    overlay: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
    overlayTop: 'linear-gradient(rgba(0,0,0,0.8), transparent)',
  },
};

// ============================================================================
// THEME SELECTOR
// ============================================================================
const THEMES = {
  theme1: THEME_1,
  theme2: THEME_2,
};

export const THEME = THEMES[CURRENT_THEME] || THEME_1;

// ============================================================================
// GLASS CARD STYLE
// ============================================================================
export const glassCard = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
};

// ============================================================================
// GLASS INPUT STYLE
// ============================================================================
export const glassInput = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  color: '#ffffff',
  outline: 'none',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
export const getTheme = (themeName) => THEMES[themeName] || THEME_1;

export const setTheme = (themeName) => {
  localStorage.setItem('ninja_theme', themeName);
  // Note: Requires app reload to apply
};

export const getCurrentThemeName = () => {
  return localStorage.getItem('ninja_theme') || CURRENT_THEME;
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================
const themeExports = { THEME, glassCard, glassInput, getTheme, setTheme, getCurrentThemeName };
export default themeExports;
