#!/usr/bin/env bash
# dev helper (from tipitaka.lk): rebuilds the app assets + debug APK, reinstalls it on the running emulator, opens a
# route and prints the web console log.  scripts/android-reload.sh [https://arutha.lk/<route>] [--full]
# Debug builds use the fixture db (app/src/debug/assets/db); --full puts the full db there instead.
set -euo pipefail
cd "$(dirname "$0")/.."
ANDROID=${ANDROID:-/Volumes/2TB/Android/Dictionary-v3}
ADB=${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}
URL=${1:-}
bash scripts/android-assets.sh "$ANDROID" --fixture >/dev/null
[ "${2:-}" = "--full" ] && cp db/dict.db "$ANDROID/app/src/debug/assets/db/dict.db"
(cd "$ANDROID" && ./gradlew -q assembleDebug)
$ADB install -r "$ANDROID/app/build/outputs/apk/debug/app-debug.apk" | tail -1
$ADB shell am force-stop lk.pitaka.dictionary; sleep 1; $ADB logcat -c
$ADB shell am start -W -n lk.pitaka.dictionary/.MainActivity ${URL:+-a android.intent.action.VIEW -d "$URL"} >/dev/null
sleep 4
$ADB logcat -d | grep -E 'chromium|Console|AruthaBridge|DbInstaller|AndroidRuntime' | tail -25
