package io.ninja.ninja8k;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * ============================================================================
 * NINJA 8K - MainActivity
 * ============================================================================
 * 
 * Critical for LibVLC visibility:
 * - WebView MUST be transparent to see video behind it
 * - Transparency applied in onStart() AFTER Capacitor fully initializes
 * - Parent view also made transparent for complete transparency chain
 * - Layout extends behind notch to use full screen space
 * 
 * ============================================================================
 */
public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "MainActivity";
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // ====================================================================
        // Force layout behind notch BEFORE Capacitor init
        // This ensures video uses full screen including notch area
        // ====================================================================
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
        }
        
        // ====================================================================
        // Register LibVLC plugin BEFORE super.onCreate()
        // ====================================================================
        registerPlugin(LibVLCPlugin.class);
        registerPlugin(ExoPlayerPlugin.class);
        
        super.onCreate(savedInstanceState);
        
        // Enable immersive mode
        enableImmersiveMode();
    }
    
    @Override
    public void onStart() {
        super.onStart();
        
        // ====================================================================
        // CRITICAL: Force WebView transparency (Required for LibVLC)
        // Optimized for Android 16
        // ====================================================================
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            
            // 1. Force transparency with literal hex 0x00000000
            webView.setBackgroundColor(0x00000000);
            
            // 2. Enable Hardware Layer for transparency support
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            
            // 3. Chain transparency to parent
            if (webView.getParent() instanceof View) {
                ((View) webView.getParent()).setBackgroundColor(0x00000000);
            }
            
            android.util.Log.d(TAG, "WebView transparency and hardware layer applied");
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableImmersiveMode();
        }
    }

    private void enableImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(
                getWindow(), 
                getWindow().getDecorView()
            );
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
        } else {
            View decorView = getWindow().getDecorView();
            int uiOptions = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN;
            decorView.setSystemUiVisibility(uiOptions);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
