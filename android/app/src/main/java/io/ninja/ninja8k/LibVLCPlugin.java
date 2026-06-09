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
    public void pause(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (mediaPlayer != null) mediaPlayer.setPause(true);
                call.resolve();
            } catch (Exception e) {
                call.reject("pause failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void resume(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (mediaPlayer != null) mediaPlayer.setPause(false);
                call.resolve();
            } catch (Exception e) {
                call.reject("resume failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        int position = call.getInt("position", 0);
        getActivity().runOnUiThread(() -> {
            try {
                if (mediaPlayer != null) mediaPlayer.setTime(position);
                call.resolve();
            } catch (Exception e) {
                call.reject("seekTo failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void getState(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                JSObject result = new JSObject();
                if (mediaPlayer != null) {
                    result.put("time", mediaPlayer.getTime());
                    result.put("length", mediaPlayer.getLength());
                    result.put("playing", mediaPlayer.isPlaying());
                } else {
                    result.put("time", 0);
                    result.put("length", 0);
                    result.put("playing", false);
                }
                call.resolve(result);
            } catch (Exception e) {
                call.reject("getState failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void setAudioTrack(PluginCall call) {
        int id = call.getInt("id", -1);
        getActivity().runOnUiThread(() -> {
            try {
                if (mediaPlayer != null) mediaPlayer.setAudioTrack(id);
                call.resolve();
            } catch (Exception e) {
                call.reject("setAudioTrack failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void setSubtitleTrack(PluginCall call) {
        int id = call.getInt("id", -1);
        getActivity().runOnUiThread(() -> {
            try {
                if (mediaPlayer != null) mediaPlayer.setSpuTrack(id);
                call.resolve();
            } catch (Exception e) {
                call.reject("setSubtitleTrack failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void getAudioTracks(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                JSObject result = new JSObject();
                com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
                if (mediaPlayer != null) {
                    Media media = mediaPlayer.getMedia();
                    if (media != null) {
                        int n = media.getTrackCount();
                        Log.d(TAG, "getAudioTracks: media trackCount=" + n);
                        for (int i = 0; i < n; i++) {
                            Media.Track t = media.getTrack(i);
                            if (t == null || t.type != Media.Track.Type.Audio) continue;
                            JSObject track = new JSObject();
                            track.put("id", t.id);
                            track.put("language", t.language != null ? t.language : "");
                            String label = (t.description != null && !t.description.isEmpty())
                                    ? t.description
                                    : (t.language != null ? t.language : "Audio " + t.id);
                            track.put("name", label);
                            if (t instanceof Media.AudioTrack) {
                                track.put("channels", ((Media.AudioTrack) t).channels);
                            }
                            arr.put(track);
                        }
                        media.release();
                    } else {
                        Log.d(TAG, "getAudioTracks: media is null");
                    }
                }
                Log.d(TAG, "getAudioTracks -> " + arr.length() + " audio track(s)");
                result.put("count", arr.length());
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
                JSObject result = new JSObject();
                com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
                if (mediaPlayer != null) {
                    Media media = mediaPlayer.getMedia();
                    if (media != null) {
                        int n = media.getTrackCount();
                        Log.d(TAG, "getSubtitleTracks: media trackCount=" + n);
                        for (int i = 0; i < n; i++) {
                            Media.Track t = media.getTrack(i);
                            if (t == null || t.type != Media.Track.Type.Text) continue;
                            JSObject track = new JSObject();
                            track.put("id", t.id);
                            track.put("language", t.language != null ? t.language : "");
                            String label = (t.description != null && !t.description.isEmpty())
                                    ? t.description
                                    : (t.language != null ? t.language : "Sub " + t.id);
                            track.put("name", label);
                            arr.put(track);
                        }
                        media.release();
                    } else {
                        Log.d(TAG, "getSubtitleTracks: media is null");
                    }
                }
                Log.d(TAG, "getSubtitleTracks -> " + arr.length() + " subtitle track(s)");
                result.put("count", arr.length());
                result.put("tracks", arr);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("getSubtitleTracks failed: " + e.getMessage());
            }
        });
    }

    /**
     * Probe a URL WITHOUT playing it. Parses the media (network), reads its
     * audio/subtitle/video tracks, returns them, then releases. Safe timeout.
     */
    @PluginMethod
    public void probeStream(PluginCall call) {
        String url = call.getString("url");
        if (url == null) { call.reject("probeStream: no url"); return; }
        getActivity().runOnUiThread(() -> {
            try {
                final Media media = new Media(libVLC, Uri.parse(url));
                media.setHWDecoderEnabled(false, false);
                final java.util.concurrent.atomic.AtomicBoolean done =
                        new java.util.concurrent.atomic.AtomicBoolean(false);

                media.setEventListener(event -> {
                    if (event.type != Media.Event.ParsedChanged) return;
                    if (!done.compareAndSet(false, true)) return;
                    try {
                        JSObject result = new JSObject();
                        com.getcapacitor.JSArray audioArr = new com.getcapacitor.JSArray();
                        com.getcapacitor.JSArray subArr = new com.getcapacitor.JSArray();
                        int n = media.getTrackCount();
                        Log.d(TAG, "probeStream: trackCount=" + n);
                        for (int i = 0; i < n; i++) {
                            Media.Track t = media.getTrack(i);
                            if (t == null) continue;
                            if (t.type == Media.Track.Type.Audio) {
                                JSObject tr = new JSObject();
                                tr.put("id", t.id);
                                tr.put("language", t.language != null ? t.language : "");
                                tr.put("channels", ((Media.AudioTrack) t).channels);
                                String label = (t.description != null && !t.description.isEmpty())
                                        ? t.description
                                        : (t.language != null ? t.language : "Audio " + t.id);
                                tr.put("name", label);
                                audioArr.put(tr);
                            } else if (t.type == Media.Track.Type.Text) {
                                JSObject tr = new JSObject();
                                tr.put("id", t.id);
                                tr.put("language", t.language != null ? t.language : "");
                                String label = (t.description != null && !t.description.isEmpty())
                                        ? t.description
                                        : (t.language != null ? t.language : "Sub " + t.id);
                                tr.put("name", label);
                                subArr.put(tr);
                            } else if (t.type == Media.Track.Type.Video && !result.has("video")) {
                                Media.VideoTrack vt = (Media.VideoTrack) t;
                                JSObject v = new JSObject();
                                v.put("width", vt.width);
                                v.put("height", vt.height);
                                result.put("video", v);
                            }
                        }
                        result.put("audioTracks", audioArr);
                        result.put("subtitleTracks", subArr);
                        Log.d(TAG, "probeStream -> audio=" + audioArr.length() + " subs=" + subArr.length());
                        call.resolve(result);
                    } catch (Exception ex) {
                        call.reject("probeStream parse error: " + ex.getMessage());
                    } finally {
                        try { media.release(); } catch (Exception ignored) {}
                    }
                });

                // Safety net: never hang the fiche if ParsedChanged never fires.
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    if (!done.compareAndSet(false, true)) return;
                    try {
                        JSObject result = new JSObject();
                        result.put("audioTracks", new com.getcapacitor.JSArray());
                        result.put("subtitleTracks", new com.getcapacitor.JSArray());
                        Log.d(TAG, "probeStream: timeout, returning empty");
                        call.resolve(result);
                    } catch (Exception ignored) {}
                    try { media.release(); } catch (Exception ignored) {}
                }, 12000);

                media.parseAsync(Media.Parse.ParseNetwork, 10000);
            } catch (Exception e) {
                call.reject("probeStream failed: " + e.getMessage());
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
