package io.ninja.ninja8k;

import android.content.Context;
import android.graphics.Color;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;
import androidx.media3.exoplayer.hls.HlsMediaSource;
import androidx.media3.exoplayer.dash.DashMediaSource;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * ============================================================================
 * NINJA 8K - ExoPlayer Plugin (Televizo Pattern)
 * ============================================================================
 * 
 * Based on reverse engineering of Televizo IPTV app.
 * Key differences from previous version:
 * 
 * 1. Uses SurfaceView directly (not PlayerView wrapper)
 * 2. Implements SurfaceHolder.Callback for proper surface lifecycle
 * 3. Calls setVideoSurfaceHolder() in surfaceCreated()
 * 4. Auto-retry on SOURCE errors with position save/restore
 * 5. setKeepScreenOn(true) to prevent screen timeout
 * 
 * ============================================================================
 */
@UnstableApi
@CapacitorPlugin(name = "ExoPlayerPlugin")
public class ExoPlayerPlugin extends Plugin {

    private static final String TAG = "ExoPlayerPlugin";

    // ========================================================================
    // PLAYER COMPONENTS
    // ========================================================================
    private ExoPlayer player;
    private SurfaceView surfaceView;
    private SurfaceHolder surfaceHolder;
    private FrameLayout playerContainer;

    // ========================================================================
    // STATE
    // ========================================================================
    private boolean isPlaying = false;
    private boolean isSurfaceReady = false;
    private boolean isOverlayAttached = false;
    private String currentUrl = null;

    // ========================================================================
    // POSITION (from JS)
    // ========================================================================
    private int playerTop = 0;
    private int playerLeft = 0;
    private int playerWidth = 0;
    private int playerHeight = 0;
    private boolean isFullscreen = false;

    // ========================================================================
    // RETRY SYSTEM (Televizo pattern)
    // ========================================================================
    private static final int RETRY_TIMEOUT_MS = 5000; // 5 seconds like Televizo
    private static final int RETRY_CHECK_INTERVAL_MS = 1000; // Check every 1 second
    private static final int MAX_RETRIES = 3;

    private int retryCount = 0;
    private long savedPosition = 0;
    private long retryStartTime = 0;
    private Handler retryHandler;
    private Runnable retryRunnable;
    private boolean isRetrying = false;

    // ========================================================================
    // LIFECYCLE
    // ========================================================================

    @Override
    public void load() {
        super.load();
        retryHandler = new Handler(Looper.getMainLooper());
        Log.d(TAG, "ExoPlayerPlugin loaded (Televizo pattern)");
    }

    // ========================================================================
    // INITIALIZE - Creates player with SurfaceView (Televizo pattern)
    // ========================================================================

    @PluginMethod
    public void initialize(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                // ============================================================
                // 1. CREATE EXOPLAYER with AudioAttributes (CRITICAL FOR SOUND!)
                // ============================================================
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setUsage(C.USAGE_MEDIA)
                        .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                        .build();

                player = new ExoPlayer.Builder(getContext())
                        .setAudioAttributes(audioAttributes, true) // true = handle audio focus
                        .build();

                // ============================================================
                // 2. CREATE SURFACEVIEW (Televizo pattern - NOT PlayerView!)
                // ============================================================
                surfaceView = new SurfaceView(getContext());
                surfaceHolder = surfaceView.getHolder();

                // Keep screen on (Televizo does this)
                surfaceHolder.setKeepScreenOn(true);

                // ============================================================
                // 3. SURFACEHOLDER CALLBACK (Critical for video rendering!)
                // ============================================================
                surfaceHolder.addCallback(new SurfaceHolder.Callback() {
                    @Override
                    public void surfaceCreated(@NonNull SurfaceHolder holder) {
                        Log.d(TAG, "surfaceCreated - Attaching to player");
                        isSurfaceReady = true;

                        // CRITICAL: Attach surface to player (Televizo pattern)
                        if (player != null) {
                            player.setVideoSurfaceHolder(holder);
                        }
                    }

                    @Override
                    public void surfaceChanged(@NonNull SurfaceHolder holder, int format, int width, int height) {
                        Log.d(TAG, "surfaceChanged: " + width + "x" + height);

                        // Re-attach if surface changed
                        if (player != null && isSurfaceReady) {
                            player.setVideoSurfaceHolder(holder);
                        }
                    }

                    @Override
                    public void surfaceDestroyed(@NonNull SurfaceHolder holder) {
                        Log.d(TAG, "surfaceDestroyed - Detaching from player");
                        isSurfaceReady = false;

                        // Detach surface and pause (Televizo pattern)
                        if (player != null) {
                            player.setVideoSurfaceHolder(null);
                            player.pause();
                        }
                    }
                });

                // ============================================================
                // 4. CREATE CONTAINER
                // ============================================================
                playerContainer = new FrameLayout(getContext());
                playerContainer.setBackgroundColor(Color.TRANSPARENT);

                // Add SurfaceView to container (MATCH_PARENT)
                FrameLayout.LayoutParams surfaceParams = new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT);
                surfaceView.setLayoutParams(surfaceParams);
                playerContainer.addView(surfaceView);

                // Hidden until play() is called
                playerContainer.setVisibility(View.GONE);

                // ============================================================
                // 5. PLAYER LISTENER (with retry on error)
                // ============================================================
                player.addListener(new Player.Listener() {
                    @Override
                    public void onPlaybackStateChanged(int state) {
                        String stateStr = getStateString(state);
                        Log.d(TAG, "onPlaybackStateChanged: " + stateStr);

                        JSObject ret = new JSObject();
                        ret.put("state", stateStr);
                        notifyListeners("playbackStateChanged", ret);

                        // Reset retry on successful playback
                        if (state == Player.STATE_READY) {
                            retryCount = 0;
                            isRetrying = false;
                            cancelRetry();
                        }
                    }

                    @Override
                    public void onIsPlayingChanged(boolean playing) {
                        isPlaying = playing;
                        JSObject ret = new JSObject();
                        ret.put("isPlaying", playing);
                        notifyListeners("isPlayingChanged", ret);
                    }

                    @Override
                    public void onPlayerError(@NonNull PlaybackException error) {
                        Log.e(TAG, "Player error: " + error.getMessage() + " (code: " + error.errorCode + ")");

                        // Try auto-retry for SOURCE errors (Televizo pattern)
                        if (shouldRetry(error)) {
                            startRetry();
                        } else {
                            // Notify JS of error
                            JSObject ret = new JSObject();
                            ret.put("error", error.getMessage());
                            ret.put("errorCode", error.errorCode);
                            notifyListeners("error", ret);
                        }
                    }
                });

                // ============================================================
                // 6. ATTACH BEHIND WEBVIEW
                // ============================================================
                attachBehindWebView();

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);

                Log.d(TAG, "ExoPlayer initialized with SurfaceView (Televizo pattern)");

            } catch (Exception e) {
                Log.e(TAG, "Failed to initialize ExoPlayer", e);
                call.reject("Failed to initialize: " + e.getMessage());
            }
        });
    }

    // ========================================================================
    // PLAY
    // ========================================================================

    @PluginMethod
    public void play(PluginCall call) {
        String url = call.getString("url");

        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                if (player == null) {
                    call.reject("Player not initialized. Call initialize() first.");
                    return;
                }

                currentUrl = url;
                retryCount = 0;
                savedPosition = 0;

                // Show player
                playerContainer.setVisibility(View.VISIBLE);
                updatePlayerPosition();

                // Wait for surface if not ready yet
                if (!isSurfaceReady) {
                    Log.d(TAG, "Surface not ready, waiting...");
                    waitForSurfaceAndPlay(url, call);
                    return;
                }

                // Play immediately
                playUrl(url);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("url", url);
                call.resolve(ret);

            } catch (Exception e) {
                Log.e(TAG, "Failed to play", e);
                call.reject("Failed to play: " + e.getMessage());
            }
        });
    }

    /**
     * Wait for surface to be ready before playing
     */
    private void waitForSurfaceAndPlay(String url, PluginCall call) {
        Handler handler = new Handler(Looper.getMainLooper());
        final int[] attempts = { 0 };
        final int maxAttempts = 10; // 1 second max wait

        Runnable checkSurface = new Runnable() {
            @Override
            public void run() {
                if (isSurfaceReady) {
                    playUrl(url);
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("url", url);
                    call.resolve(ret);
                } else if (attempts[0] < maxAttempts) {
                    attempts[0]++;
                    handler.postDelayed(this, 100);
                } else {
                    Log.e(TAG, "Surface not ready after 1 second");
                    call.reject("Surface not ready");
                }
            }
        };

        handler.post(checkSurface);
    }

    /**
     * Actually play the URL
     */
    private void playUrl(String url) {
        if (player == null)
            return;

        Log.d(TAG, "Playing: " + url);

        // Create media source based on URL type
        MediaSource mediaSource = createMediaSource(url);

        // Set media source and prepare
        player.setMediaSource(mediaSource);
        player.prepare();

        // Seek to saved position if resuming after error
        if (savedPosition > 0) {
            player.seekTo(savedPosition);
            Log.d(TAG, "Resuming from position: " + savedPosition);
        }

        player.play();
    }

    // ========================================================================
    // RETRY SYSTEM (Televizo pattern - class 'c')
    // ========================================================================

    /**
     * Check if we should retry on this error
     */
    private boolean shouldRetry(PlaybackException error) {
        // Only retry on SOURCE/IO errors, not render errors
        int errorCode = error.errorCode;
        boolean isSourceError = errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED ||
                errorCode == PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT ||
                errorCode == PlaybackException.ERROR_CODE_IO_UNSPECIFIED ||
                errorCode == PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS ||
                errorCode == PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED ||
                errorCode == PlaybackException.ERROR_CODE_PARSING_MANIFEST_MALFORMED;

        return isSourceError && retryCount < MAX_RETRIES && currentUrl != null;
    }

    /**
     * Start retry process (Televizo pattern)
     */
    private void startRetry() {
        if (isRetrying)
            return;

        isRetrying = true;
        retryCount++;
        retryStartTime = System.currentTimeMillis();

        // Save current position for resume
        if (player != null) {
            savedPosition = player.getCurrentPosition();
        }

        Log.d(TAG, "Starting retry #" + retryCount + " (saved position: " + savedPosition + ")");

        // Notify JS that we're buffering/retrying
        JSObject ret = new JSObject();
        ret.put("state", "buffering");
        ret.put("retrying", true);
        ret.put("retryCount", retryCount);
        notifyListeners("playbackStateChanged", ret);

        // Start retry check loop
        retryRunnable = new Runnable() {
            @Override
            public void run() {
                if (!isRetrying)
                    return;

                long elapsed = System.currentTimeMillis() - retryStartTime;

                if (elapsed < RETRY_TIMEOUT_MS) {
                    // Try to reconnect
                    attemptReconnect();

                    // Check again in 1 second
                    retryHandler.postDelayed(this, RETRY_CHECK_INTERVAL_MS);
                } else {
                    // Timeout - notify error
                    Log.e(TAG, "Retry timeout after " + RETRY_TIMEOUT_MS + "ms");
                    isRetrying = false;

                    JSObject err = new JSObject();
                    err.put("error", "Connection timeout after " + retryCount + " retries");
                    err.put("errorCode", -1);
                    notifyListeners("error", err);
                }
            }
        };

        retryHandler.post(retryRunnable);
    }

    /**
     * Attempt to reconnect
     */
    private void attemptReconnect() {
        if (player == null || currentUrl == null)
            return;

        Log.d(TAG, "Attempting reconnect...");

        try {
            // Recreate media source and prepare
            MediaSource mediaSource = createMediaSource(currentUrl);
            player.setMediaSource(mediaSource);
            player.prepare();
            player.seekTo(savedPosition);
            player.play();
        } catch (Exception e) {
            Log.e(TAG, "Reconnect attempt failed: " + e.getMessage());
        }
    }

    /**
     * Cancel retry process
     */
    private void cancelRetry() {
        isRetrying = false;
        if (retryHandler != null && retryRunnable != null) {
            retryHandler.removeCallbacks(retryRunnable);
        }
    }

    // ========================================================================
    // PLAYBACK CONTROLS
    // ========================================================================

    @PluginMethod
    public void pause(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (player != null) {
                player.pause();
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void resume(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (player != null) {
                player.play();
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            cancelRetry();

            if (player != null) {
                player.stop();
                player.clearMediaItems();
            }

            if (playerContainer != null) {
                playerContainer.setVisibility(View.GONE);
            }

            currentUrl = null;
            savedPosition = 0;
            retryCount = 0;

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        Long position = call.getLong("position", 0L);

        getActivity().runOnUiThread(() -> {
            if (player != null) {
                player.seekTo(position);
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Float volume = call.getFloat("volume", 1.0f);

        getActivity().runOnUiThread(() -> {
            if (player != null) {
                player.setVolume(volume);
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void getState(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            JSObject ret = new JSObject();

            if (player != null) {
                ret.put("isPlaying", player.isPlaying());
                ret.put("currentPosition", player.getCurrentPosition());
                ret.put("duration", player.getDuration());
                ret.put("bufferedPosition", player.getBufferedPosition());
                ret.put("playbackState", getStateString(player.getPlaybackState()));
                ret.put("volume", player.getVolume());
                ret.put("currentUrl", currentUrl);
                ret.put("isSurfaceReady", isSurfaceReady);
            } else {
                ret.put("isPlaying", false);
                ret.put("currentPosition", 0);
                ret.put("duration", 0);
                ret.put("playbackState", "idle");
                ret.put("isSurfaceReady", false);
            }

            call.resolve(ret);
        });
    }

    // ========================================================================
    // POSITION & FULLSCREEN
    // ========================================================================

    @PluginMethod
    public void setPosition(PluginCall call) {
        int top = call.getInt("top", 0);
        int left = call.getInt("left", 0);
        int width = call.getInt("width", 0);
        int height = call.getInt("height", 0);

        // Get device pixel ratio
        float density = getContext().getResources().getDisplayMetrics().density;

        playerTop = Math.round(top * density);
        playerLeft = Math.round(left * density);
        playerWidth = Math.round(width * density);
        playerHeight = Math.round(height * density);

        getActivity().runOnUiThread(() -> {
            updatePlayerPosition();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        });

        Log.d(TAG, "Position set: " + playerLeft + "," + playerTop + " " + playerWidth + "x" + playerHeight);
    }

    @PluginMethod
    public void setFullscreen(PluginCall call) {
        Boolean fullscreen = call.getBoolean("fullscreen", false);

        isFullscreen = fullscreen;

        getActivity().runOnUiThread(() -> {
            updatePlayerPosition();

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("fullscreen", fullscreen);
            call.resolve(ret);
        });
    }

    // ========================================================================
    // DESTROY
    // ========================================================================

    @PluginMethod
    public void destroy(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            cleanup();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);

            Log.d(TAG, "ExoPlayer destroyed");
        });
    }

    private void cleanup() {
        cancelRetry();
        detachFromWebView();

        if (player != null) {
            player.setVideoSurfaceHolder(null);
            player.release();
            player = null;
        }

        if (playerContainer != null) {
            playerContainer.removeAllViews();
            playerContainer = null;
        }

        surfaceView = null;
        surfaceHolder = null;
        currentUrl = null;
        savedPosition = 0;
        retryCount = 0;
        isSurfaceReady = false;
    }

    // ========================================================================
    // VIEW HIERARCHY MANAGEMENT
    // ========================================================================

    /**
     * Update player position based on JS coordinates or fullscreen
     */
    private void updatePlayerPosition() {
        if (playerContainer == null)
            return;

        FrameLayout.LayoutParams params;

        if (isFullscreen) {
            // Fullscreen: fill entire screen
            params = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT);
            params.setMargins(0, 0, 0, 0);
        } else if (playerWidth > 0 && playerHeight > 0) {
            // Positioned: use JS coordinates
            params = new FrameLayout.LayoutParams(playerWidth, playerHeight);
            params.leftMargin = playerLeft;
            params.topMargin = playerTop;
            params.gravity = Gravity.TOP | Gravity.START;
        } else {
            // Default: 16:9 at top
            int screenWidth = getContext().getResources().getDisplayMetrics().widthPixels;
            int height = (int) (screenWidth * 9.0 / 16.0);
            params = new FrameLayout.LayoutParams(screenWidth, height);
            params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        }

        playerContainer.setLayoutParams(params);
    }

    /**
     * Attach player BEHIND the WebView (at index 0)
     * WebView must be transparent to see the video
     */
    private void attachBehindWebView() {
        if (playerContainer == null || isOverlayAttached)
            return;

        try {
            ViewGroup rootView = (ViewGroup) getActivity().getWindow().getDecorView().getRootView();

            // Default params - will be updated by setPosition
            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT);
            playerContainer.setLayoutParams(params);

            if (playerContainer.getParent() == null) {
                // Add at index 0 (BEHIND everything else including WebView)
                rootView.addView(playerContainer, 0);
            }

            // Hidden until play() is called
            playerContainer.setVisibility(View.GONE);
            isOverlayAttached = true;

            Log.d(TAG, "Player attached BEHIND WebView (index 0) with SurfaceView");
        } catch (Exception e) {
            Log.e(TAG, "Failed to attach player", e);
        }
    }

    /**
     * Detach player from view hierarchy
     */
    private void detachFromWebView() {
        if (playerContainer == null || !isOverlayAttached)
            return;

        try {
            if (playerContainer.getParent() != null) {
                ((ViewGroup) playerContainer.getParent()).removeView(playerContainer);
            }

            isOverlayAttached = false;

            Log.d(TAG, "Player detached");
        } catch (Exception e) {
            Log.e(TAG, "Failed to detach player", e);
        }
    }

    // ========================================================================
    // MEDIA SOURCE FACTORY
    // ========================================================================

    private MediaSource createMediaSource(String url) {
        Uri uri = Uri.parse(url);
        String path = uri.getPath() != null ? uri.getPath().toLowerCase() : "";

        // HTTP data source for network streams
        DataSource.Factory httpDataSourceFactory = new DefaultHttpDataSource.Factory()
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(15000)
                .setUserAgent("NINJA8K/1.0");

        DataSource.Factory dataSourceFactory = new DefaultDataSource.Factory(
                getContext(),
                httpDataSourceFactory);

        // Detect format and create appropriate media source
        if (path.endsWith(".m3u8") || url.contains("m3u8")) {
            // HLS
            Log.d(TAG, "Creating HLS source for: " + url);
            return new HlsMediaSource.Factory(dataSourceFactory)
                    .createMediaSource(MediaItem.fromUri(uri));

        } else if (path.endsWith(".mpd")) {
            // DASH
            Log.d(TAG, "Creating DASH source for: " + url);
            return new DashMediaSource.Factory(dataSourceFactory)
                    .createMediaSource(MediaItem.fromUri(uri));

        } else {
            // Progressive (TS, MP4, MKV, etc.) - Default for IPTV
            Log.d(TAG, "Creating Progressive source for: " + url);
            return new ProgressiveMediaSource.Factory(dataSourceFactory)
                    .createMediaSource(MediaItem.fromUri(uri));
        }
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    private String getStateString(int state) {
        switch (state) {
            case Player.STATE_IDLE:
                return "idle";
            case Player.STATE_BUFFERING:
                return "buffering";
            case Player.STATE_READY:
                return "ready";
            case Player.STATE_ENDED:
                return "ended";
            default:
                return "unknown";
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        cleanup();
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        // Pause playback when app goes to background
        if (player != null && player.isPlaying()) {
            player.pause();
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        // Re-attach surface if needed when app comes back
        if (player != null && surfaceHolder != null && isSurfaceReady) {
            player.setVideoSurfaceHolder(surfaceHolder);
        }
    }
}
