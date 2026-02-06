package io.ninja.ninja8k;

import android.graphics.Color;
import android.graphics.PixelFormat;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.coordinatorlayout.widget.CoordinatorLayout;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.videolan.libvlc.LibVLC;
import org.videolan.libvlc.Media;
import org.videolan.libvlc.MediaPlayer;
import org.videolan.libvlc.interfaces.IVLCVout;

import java.util.ArrayList;

/**
 * ============================================================================
 * NINJA 8K - LibVLC Plugin (Final Hybrid Layering)
 * ============================================================================
 */
@CapacitorPlugin(name = "LibVLCPlugin")
public class LibVLCPlugin extends Plugin {
    private static final String TAG = "LibVLCPlugin";

    private LibVLC libVLC;
    private MediaPlayer mediaPlayer;
    private SurfaceView surfaceView;
    private FrameLayout playerContainer;

    private boolean isSurfaceReady = false;
    private boolean isOverlayAttached = false;
    private String currentUrl = null;

    private int playerTop = 0;
    private int playerLeft = 0;
    private int playerWidth = 0;
    private int playerHeight = 0;
    private boolean isFullscreen = false;

    @PluginMethod
    public void initialize(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                cleanup();

                ArrayList<String> options = new ArrayList<>();
                options.add("--network-caching=1500");
                options.add("--no-sub-autodetect-file");
                options.add("--no-osd");
                options.add("--no-video-title-show");

                libVLC = new LibVLC(getContext(), options);
                mediaPlayer = new MediaPlayer(libVLC);
                
                surfaceView = new SurfaceView(getContext());
                
                // Initial state: MediaOverlay (pierces hole through transparent WebView)
                surfaceView.setZOrderMediaOverlay(true);
                surfaceView.getHolder().setFormat(PixelFormat.TRANSLUCENT);

                surfaceView.getHolder().addCallback(new SurfaceHolder.Callback() {
                    @Override
                    public void surfaceCreated(@NonNull SurfaceHolder holder) {
                        isSurfaceReady = true;
                        attachSurfaceToVLC();
                    }
                    @Override
                    public void surfaceChanged(@NonNull SurfaceHolder holder, int format, int width, int height) {
                        if (mediaPlayer != null) mediaPlayer.getVLCVout().setWindowSize(width, height);
                    }
                    @Override
                    public void surfaceDestroyed(@NonNull SurfaceHolder holder) {
                        isSurfaceReady = false;
                        detachSurfaceFromVLC();
                    }
                });

                playerContainer = new FrameLayout(getContext());
                playerContainer.setBackgroundColor(Color.TRANSPARENT);
                playerContainer.addView(surfaceView);
                playerContainer.setVisibility(View.GONE);

                attachBehindWebView();

                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    /**
     * Set video layering:
     * - onTop: true  => Video covers EVERYTHING (use for full immersive play)
     * - onTop: false => Video behind WebView (use to see web menus/buttons)
     */
    @PluginMethod
    public void setZOrder(PluginCall call) {
        boolean onTop = call.getBoolean("onTop", false);
        getActivity().runOnUiThread(() -> {
            if (surfaceView != null) {
                surfaceView.setZOrderOnTop(onTop);
                // When switching, we toggle MediaOverlay to force a re-render
                surfaceView.setZOrderMediaOverlay(!onTop);
                Log.d(TAG, "Z-Order set: onTop=" + onTop);
            }
            call.resolve();
        });
    }

    private void attachBehindWebView() {
        if (playerContainer == null || isOverlayAttached) return;
        getActivity().runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                ViewGroup parent = (ViewGroup) webView.getParent();
                
                webView.setBackgroundColor(Color.TRANSPARENT);
                
                if (playerContainer.getParent() == null) {
                    ViewGroup.LayoutParams lp;
                    if (parent instanceof CoordinatorLayout) {
                        lp = new CoordinatorLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
                    } else {
                        lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
                    }
                    parent.addView(playerContainer, 0, lp);
                }
                
                isOverlayAttached = true;
            } catch (Exception e) {
                Log.e(TAG, "Attach failed", e);
            }
        });
    }

    @PluginMethod
    public void play(PluginCall call) {
        String url = call.getString("url");
        getActivity().runOnUiThread(() -> {
            try {
                currentUrl = url;
                playerContainer.setVisibility(View.VISIBLE);
                updatePlayerPosition();

                getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);

                if (isSurfaceReady) {
                    playUrl(url);
                } else {
                    new Handler(Looper.getMainLooper()).postDelayed(() -> playUrl(url), 500);
                }
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    private void playUrl(String url) {
        if (mediaPlayer == null || url == null) return;
        mediaPlayer.stop();
        attachSurfaceToVLC();
        Media media = new Media(libVLC, Uri.parse(url));
        media.setHWDecoderEnabled(true, false);
        mediaPlayer.setMedia(media);
        media.release();
        mediaPlayer.play();
    }

    private void updatePlayerPosition() {
        if (playerContainer == null) return;
        ViewGroup.LayoutParams params = playerContainer.getLayoutParams();
        if (params == null) return;

        int w = isFullscreen ? ViewGroup.LayoutParams.MATCH_PARENT : (playerWidth > 0 ? playerWidth : ViewGroup.LayoutParams.MATCH_PARENT);
        int h = isFullscreen ? ViewGroup.LayoutParams.MATCH_PARENT : (playerHeight > 0 ? playerHeight : ViewGroup.LayoutParams.MATCH_PARENT);

        if (params instanceof CoordinatorLayout.LayoutParams) {
            CoordinatorLayout.LayoutParams lp = (CoordinatorLayout.LayoutParams) params;
            lp.width = w; lp.height = h;
            lp.leftMargin = isFullscreen ? 0 : playerLeft;
            lp.topMargin = isFullscreen ? 0 : playerTop;
            playerContainer.setLayoutParams(lp);
        } else if (params instanceof FrameLayout.LayoutParams) {
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) params;
            lp.width = w; lp.height = h;
            lp.leftMargin = isFullscreen ? 0 : playerLeft;
            lp.topMargin = isFullscreen ? 0 : playerTop;
            lp.gravity = Gravity.TOP | Gravity.START;
            playerContainer.setLayoutParams(lp);
        }
    }

    private void attachSurfaceToVLC() {
        if (mediaPlayer == null || surfaceView == null || !isSurfaceReady) return;
        IVLCVout vout = mediaPlayer.getVLCVout();
        if (!vout.areViewsAttached()) {
            vout.setVideoView(surfaceView);
            vout.attachViews();
        }
    }

    private void detachSurfaceFromVLC() {
        if (mediaPlayer != null) mediaPlayer.getVLCVout().detachViews();
    }

    @PluginMethod
    public void setPosition(PluginCall call) {
        int top = call.getInt("top", 0);
        int left = call.getInt("left", 0);
        int width = call.getInt("width", 0);
        int height = call.getInt("height", 0);
        float density = getContext().getResources().getDisplayMetrics().density;
        playerTop = Math.round(top * density);
        playerLeft = Math.round(left * density);
        playerWidth = Math.round(width * density);
        playerHeight = Math.round(height * density);
        getActivity().runOnUiThread(() -> {
            updatePlayerPosition();
            call.resolve();
        });
    }

    @PluginMethod
    public void setFullscreen(PluginCall call) {
        isFullscreen = call.getBoolean("fullscreen", false);
        getActivity().runOnUiThread(() -> {
            updatePlayerPosition();
            call.resolve();
        });
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        int volume = call.getInt("volume", 100);
        getActivity().runOnUiThread(() -> {
            try {
                if (mediaPlayer != null) {
                    // LibVLC volume: 0-200 (100 = normal, 0 = mute, 200 = max)
                    // Clamping: ensure volume is between 0 and 200
                    int vlcVolume = Math.max(0, Math.min(200, volume));
                    mediaPlayer.setVolume(vlcVolume);
                    Log.d(TAG, "Volume set to: " + vlcVolume);
                }
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (mediaPlayer != null) mediaPlayer.stop();
            if (playerContainer != null) playerContainer.setVisibility(View.GONE);
            call.resolve();
        });
    }

    @PluginMethod
    public void getAudioTracks(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (mediaPlayer == null) {
                    call.reject("Player not initialized");
                    return;
                }
                MediaPlayer.TrackDescription[] tracks = mediaPlayer.getAudioTracks();
                JSObject result = new JSObject();
                result.put("count", tracks != null ? tracks.length - 1 : 0); // -1 for "Disable" track
                com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
                if (tracks != null) {
                    for (MediaPlayer.TrackDescription t : tracks) {
                        if (t.id == -1) continue; // Skip "Disable" option
                        JSObject track = new JSObject();
                        track.put("id", t.id);
                        track.put("name", t.name);
                        arr.put(track);
                    }
                }
                result.put("tracks", arr);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("getAudioTracks failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void getSubtitleTracks(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (mediaPlayer == null) {
                    call.reject("Player not initialized");
                    return;
                }
                MediaPlayer.TrackDescription[] tracks = mediaPlayer.getSpuTracks();
                JSObject result = new JSObject();
                result.put("count", tracks != null ? tracks.length - 1 : 0); // -1 for "Disable" track
                com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
                if (tracks != null) {
                    for (MediaPlayer.TrackDescription t : tracks) {
                        if (t.id == -1) continue; // Skip "Disable" option
                        JSObject track = new JSObject();
                        track.put("id", t.id);
                        track.put("name", t.name);
                        arr.put(track);
                    }
                }
                result.put("tracks", arr);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("getSubtitleTracks failed: " + e.getMessage());
            }
        });
    }

    private void cleanup() {
        if (mediaPlayer != null) {
            mediaPlayer.stop();
            mediaPlayer.release();
            mediaPlayer = null;
        }
        if (libVLC != null) {
            libVLC.release();
            libVLC = null;
        }
        if (playerContainer != null && playerContainer.getParent() != null) {
            ((ViewGroup)playerContainer.getParent()).removeView(playerContainer);
            playerContainer = null;
        }
        isOverlayAttached = false;
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        cleanup();
    }
}
