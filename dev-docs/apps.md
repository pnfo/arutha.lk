# Apps: build, test, release

## Build
| | command | output |
|---|---|---|
| engine | `scripts/build-mobile.sh android\|ios` | `server/mobile/build/engine.aar`, `Engine.xcframework` |
| Android assets | `scripts/android-assets.sh [project] [--fixture]` | web build, AAR and `dict.db` into `/Volumes/2TB/Android/Dictionary-v3` |
| Android release | `cd /Volumes/2TB/Android/Dictionary-v3 && ./gradlew bundleRelease` | `app/build/outputs/bundle/release/app-release.aab` (~110 MB) |
| iOS release | `scripts/build-apple.sh ios [--upload]` | `apple/build/export/Dictionary.ipa` (~100 MB), upload to App Store Connect |
| icons | `design/tools/brand.py`, `render.mjs`, `android-icons.mjs <res>` | `design/brand/icon/`, Android mipmaps |
| store images | `node scripts/store-screenshots.mjs` | `release/store-screenshots/` (bilingual captions) |

## Test (emulators and simulators of this Mac)
* Android: `scripts/android-reload.sh [https://arutha.lk/<route>] [--full]` builds and installs the debug app on the
  running emulator (fixture db, `--full`: the full db). Emulators: `Tipitaka_API24` (Android 7, WebView 53) and
  `Dictionary_API36` (an empty Android 16 one: the 358 MB db does not fit next to the tipitaka apps on `Tipitaka_API36`).
  The WebView of debug builds is debuggable (`adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>`).
* iOS: `scripts/build-apple.sh sim [route] [--fixture]` on the booted simulator (iPhone 17 Pro, iPad Pro 13).
* Measured 2026-11-01 (Dictionary_API36, full db): first-run copy ~8 s, queries 9–93 ms through the bridge.

## Release (straight to production after the emulator tests)
1. Web first (the app links): `scripts/deploy.sh --go` (apple-app-site-association, the app-aware web build).
2. Android: `node scripts/play/play-listing.mjs` (si-LK, en-US texts of `release/store/listing.mjs`, screenshots,
   feature graphic, icon), then `node scripts/play/play-release.mjs` (production; `--dry` first).
3. Farewell of `lk.arutha.dictionary` 1.4 (`/Volumes/2TB/Android/Arutha.lk`, dialog with an Install button):
   `./gradlew bundleRelease` there, `node scripts/play/play-farewell.mjs`.
4. iOS: the App Store record is created by hand (App Store Connect → Apps → +: name "ශබ්දකෝෂය: Sinhala English Pali",
   primary language English (U.S.), bundle id lk.pitaka.dictionary, SKU lk.pitaka.dictionary). Then
   `scripts/build-apple.sh ios --upload`, `ASC_APP=<id> node scripts/asc/asc-screenshots.mjs`,
   `ASC_APP=<id> node scripts/asc/asc-submit.mjs --submit` (age rating, category Reference, privacy "no data
   collected" and the price are set once in App Store Connect). After the review: `IOS_URL` in `web/src/apps.ts`, deploy.
