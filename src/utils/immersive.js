// ============================================================================
// IMMERSIVE MODE - Hide Android Navigation Bar
// ============================================================================
// Shows navigation bar only when swiping from edge
// ============================================================================

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

// ============================================================================
// ENABLE IMMERSIVE MODE
// ============================================================================
export const enableImmersiveMode = async () => {
  if (Capacitor.getPlatform() !== 'android') return;

  try {
    // Hide status bar
    await StatusBar.hide();
    
    // Set overlay mode (content behind status bar)
    await StatusBar.setOverlaysWebView({ overlay: true });

    // Use native Android immersive mode via JavaScript bridge
    if (window.AndroidFullScreen) {
      window.AndroidFullScreen.immersiveMode();
    } else {
      // Fallback: inject CSS for fullscreen feel
      document.documentElement.style.setProperty('--sat', 'env(safe-area-inset-top)');
      document.documentElement.style.setProperty('--sab', 'env(safe-area-inset-bottom)');
    }

    console.log('✅ Immersive mode enabled');
  } catch (error) {
    console.error('❌ Failed to enable immersive mode:', error);
  }
};

// ============================================================================
// DISABLE IMMERSIVE MODE
// ============================================================================
export const disableImmersiveMode = async () => {
  if (Capacitor.getPlatform() !== 'android') return;

  try {
    await StatusBar.show();
    await StatusBar.setOverlaysWebView({ overlay: false });
    
    if (window.AndroidFullScreen) {
      window.AndroidFullScreen.showSystemUI();
    }

    console.log('✅ Immersive mode disabled');
  } catch (error) {
    console.error('❌ Failed to disable immersive mode:', error);
  }
};

// ============================================================================
// SET STATUS BAR STYLE
// ============================================================================
export const setStatusBarStyle = async (dark = true) => {
  if (Capacitor.getPlatform() !== 'android') return;

  try {
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: '#0a0a0f' });
  } catch (error) {
    console.error('❌ Failed to set status bar style:', error);
  }
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================
export default {
  enableImmersiveMode,
  disableImmersiveMode,
  setStatusBarStyle,
};
