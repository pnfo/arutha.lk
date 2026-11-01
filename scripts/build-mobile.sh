#!/usr/bin/env bash
# Builds the engine for the apps with gomobile (from tipitaka.app):
#   scripts/build-mobile.sh android   -> server/mobile/build/engine.aar (arm64, armv7, x86_64 emulator)
#   scripts/build-mobile.sh ios       -> server/mobile/build/Engine.xcframework
# gomobile and gobind are tools of server/go.mod; the NDK is found by gomobile (ANDROID_HOME, default below).
set -euo pipefail
cd "$(dirname "$0")/../server"
export ANDROID_HOME=${ANDROID_HOME:-$HOME/Library/Android/sdk}
export PATH="$(go env GOPATH)/bin:$PATH"
go install golang.org/x/mobile/cmd/gomobile golang.org/x/mobile/cmd/gobind
gomobile init
mkdir -p mobile/build
case "${1:-android}" in
  android) gomobile bind -target=android/arm64,android/arm,android/amd64 -androidapi 24 -javapkg lk.pitaka.dictionary.engine -trimpath \
    -ldflags "-s -w -extldflags=-Wl,-z,max-page-size=16384" -o mobile/build/engine.aar ./mobile ;; # 16 KB pages (Play, Android 15+)
  ios) gomobile bind -target=ios,iossimulator -trimpath -ldflags "-s -w" -o mobile/build/Engine.xcframework ./mobile ;;
  *) echo "usage: $0 android|ios"; exit 1 ;;
esac
ls -la mobile/build
