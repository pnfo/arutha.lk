#!/usr/bin/env bash
# Copies the web app build, the engine AAR and the database into the Android project (its README.md). From tipitaka.app.
#   scripts/android-assets.sh [/Volumes/2TB/Android/Dictionary-v3] [--fixture]
# --fixture: the small test db (e2e/fixtures/db) goes into the debug assets instead of the full one.
set -euo pipefail
cd "$(dirname "$0")/.."
APP=${1:-/Volumes/2TB/Android/Dictionary-v3}
npm run build:web:app >/dev/null
[ -f server/mobile/build/engine.aar ] || bash scripts/build-mobile.sh android
rm -rf "$APP/app/src/main/assets/dist-app" && mkdir -p "$APP/app/src/main/assets" "$APP/app/libs"
cp -R web/dist-app "$APP/app/src/main/assets/dist-app"
cp server/mobile/build/engine.aar "$APP/app/libs/engine.aar"
if [ "${2:-}" = "--fixture" ]; then
  mkdir -p "$APP/app/src/debug/assets/db" && cp e2e/fixtures/db/dict.db "$APP/app/src/debug/assets/db/"
else
  mkdir -p "$APP/dict_data/src/main/assets/db" && cp db/dict.db "$APP/dict_data/src/main/assets/db/"
fi
echo "copied web app, engine and db to $APP"
