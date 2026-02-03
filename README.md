# NINJA 8K - OTT & IPTV HUB

> Premium IPTV Player for Android with ExoPlayer, EPG Search, and stunning particle effects.

---

## 📱 Features

- **ExoPlayer Integration** - Native Android player supporting all formats (.ts, .m3u8, .mp4, .mkv, .avi, DASH)
- **Xtream Codes API** - Full compatibility with Xtream-based IPTV providers
- **EPG Search** - Local SQLite database for fast program search
- **Live TV** - Real-time streaming with timeshift support
- **VOD & Series** - Movies and series catalog
- **Particle Themes** - Beautiful animated backgrounds (Ultimate & Soft)
- **Immersive Mode** - Full screen experience, swipe to show navigation
- **Cast Support** - Chromecast integration
- **Multi-language Ready** - English UI, prepared for i18n

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 + Capacitor 5 |
| Native Player | ExoPlayer / Media3 |
| Database | SQLite (Capacitor Community) |
| Styling | Tailwind CSS |
| State | React Context + Hooks |
| Build | Codemagic CI/CD |

---

## 📦 Dependencies

```json
{
  "@capacitor/core": "^5.0.0",
  "@capacitor/android": "^5.0.0",
  "@capacitor/status-bar": "^5.0.0",
  "@capacitor-community/sqlite": "^5.6.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-window": "^1.8.10",
  "lodash.debounce": "^4.0.8"
}
```

### Android (build.gradle)

```gradle
implementation 'androidx.media3:media3-exoplayer:1.2.0'
implementation 'androidx.media3:media3-exoplayer-hls:1.2.0'
implementation 'androidx.media3:media3-exoplayer-dash:1.2.0'
implementation 'androidx.media3:media3-datasource:1.2.0'
implementation 'androidx.media3:media3-ui:1.2.0'
implementation 'androidx.media3:media3-common:1.2.0'
```

---

## 📂 Project Structure

```
NINJA-8K---IPTV-HUB/
│
├── 📁 android/
│   └── 📁 app/
│       └── 📁 src/
│           └── 📁 main/
│               ├── 📁 java/io/ninja/ninja8k/
│               │   ├── MainActivity.java
│               │   └── ExoPlayerPlugin.java
│               ├── 📁 res/
│               │   ├── 📁 values/
│               │   │   └── styles.xml
│               │   └── 📁 xml/
│               │       └── network_security_config.xml
│               └── AndroidManifest.xml
│
├── 📁 assets/
│   ├── Ninja8K.png
│   ├── ninja4k.m3u
│   └── ninja8k.m3u
│
├── 📁 public/
│   ├── index.html
│   └── manifest.json
│
├── 📁 src/
│   ├── 📁 api/
│   │   └── fusion.js
│   │
│   ├── 📁 components/
│   │   ├── 📁 player/
│   │   │   ├── CastButton.jsx
│   │   │   ├── EPGBar.jsx
│   │   │   ├── EPGSearch.jsx
│   │   │   ├── exoPlayer.js
│   │   │   ├── exoPlayerWeb.js
│   │   │   ├── MultiGrid.jsx
│   │   │   ├── PiPManager.jsx
│   │   │   ├── Player.jsx
│   │   │   ├── PlayerControls.jsx
│   │   │   ├── PlayerOverlay.jsx
│   │   │   ├── PlayerSettings.jsx
│   │   │   ├── TimeshiftBar.jsx
│   │   │   ├── VideoPlayer.jsx
│   │   │   └── index.js
│   │   │
│   │   ├── ActivationBlock.jsx
│   │   ├── ChannelRow.jsx
│   │   ├── Dashboard.jsx
│   │   ├── EPGGrid.jsx
│   │   ├── EPGProgress.jsx
│   │   ├── EPGSearch.jsx
│   │   ├── FolderRow.jsx
│   │   ├── Hub.jsx
│   │   ├── Icons.jsx
│   │   ├── LandingPage.jsx
│   │   ├── LoadingScreen.jsx
│   │   ├── MultiSourceSelector.jsx
│   │   ├── NinjaPlayer.jsx
│   │   ├── ParticleThemes.jsx
│   │   ├── PlaylistForm.jsx
│   │   ├── SearchBar.jsx
│   │   ├── Settings.jsx
│   │   ├── Smart.jsx
│   │   └── StarDust.jsx
│   │
│   ├── 📁 constants/
│   │   └── theme.js
│   │
│   ├── 📁 context/
│   │   └── PlaylistContext.jsx
│   │
│   ├── 📁 database/
│   │   ├── NinjaLocalDB.js
│   │   └── ProgramQueries.js
│   │
│   ├── 📁 hooks/
│   │   ├── useCast.js
│   │   ├── useEpgSearch.js
│   │   ├── usePiP.js
│   │   ├── usePlaylist.js
│   │   ├── useQueue.js
│   │   ├── useTimeshift.js
│   │   └── useVideoPlayer.js
│   │
│   ├── 📁 pages/
│   │   └── PlayerPage.jsx
│   │
│   ├── 📁 services/
│   │   ├── NinjaSyncService.js
│   │   └── XtreamService.js
│   │
│   ├── 📁 styles/
│   │   ├── EPGSearch.css
│   │   └── globals.css
│   │
│   ├── 📁 utils/
│   │   ├── device.js
│   │   ├── immersive.js
│   │   └── security.js
│   │
│   ├── App.jsx
│   └── index.js
│
├── capacitor.config.json
├── codemagic.yaml
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── LICENSE
└── README.md
```

---

## 🎨 Themes

### Color Theme 1 (Active)

| Element | Color |
|---------|-------|
| Channel text | `#5D28F1` |
| Selected channel | Gradient `#6225FF → #B85CFF` |
| NOW badge (channels) | `#00ed0f` (green) |
| NOW badge (header) | Purple |
| Background | `#0a0a0f` |

### Particle Themes

| Theme | Description |
|-------|-------------|
| `ultimate` | Nebula + StarDust + Ember |
| `soft` | Nebula + StarDust only |
| `off` | No particles |

---

## 🚀 Build & Deploy

### Development

```bash
npm install
npm start
```

### Android Build

```bash
npm run build
npx cap sync
npx cap open android
```

### Codemagic

Push to GitHub → Automatic APK build via `codemagic.yaml`

---

## 📺 Supported Formats

| Format | Extension | Support |
|--------|-----------|---------|
| MPEG-TS | `.ts` | ✅ |
| HLS | `.m3u8` | ✅ |
| MP4 | `.mp4` | ✅ |
| MKV | `.mkv` | ✅ |
| DASH | `.mpd` | ✅ |
| AVI | `.avi` | ✅ |
| WebM | `.webm` | ✅ |

---

## 📱 Target Platforms

| Platform | Status |
|----------|--------|
| Android Phone | ✅ |
| Android TV | ✅ |
| Android Tablet | ✅ |
| iOS (iPhone/iPad) | ✅ |
| Web | ⚠️ Limited (no .ts support) |

---

## 📄 License

MIT License - NINJA 8K © 2026

---

## 👤 Author

**NINJA 8K**
- Website: [ninja-apps.io](https://ninja-apps.io)
- Email: ninjadigi@proton.me
