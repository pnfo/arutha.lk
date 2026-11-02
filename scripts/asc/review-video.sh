#!/usr/bin/env bash
# The App Review screen recording (Guideline 2.1): a fresh install of the debug build on an iPhone simulator, recorded
# from the home screen through the launch and the typical use (scripts/asc/review-demo.js) -> release/review-video.mp4.
#   scripts/build-apple.sh sim && scripts/asc/review-video.sh [simulator udid] [seconds]
set -euo pipefail
cd "$(dirname "$0")/../.."
DEV=${1:-booted}
SECS=${2:-100}
APP=apple/build/derived/Build/Products/Debug-iphonesimulator/Dictionary.app
OUT=release/review-video.mp4
TMP=${TMPDIR:-/tmp}/review-video.mp4 # simctl cannot always write to other volumes
xcrun simctl uninstall "$DEV" lk.pitaka.dictionary 2>/dev/null || true # no history or bookmarks
xcrun simctl install "$DEV" "$APP"
# the script as a default (App.swift): a file on another volume would wait for a permission
xcrun simctl spawn "$DEV" defaults write lk.pitaka.dictionary script -string "$(cat scripts/asc/review-demo.js)"
xcrun simctl ui "$DEV" appearance light
xcrun simctl status_bar "$DEV" override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3
rm -f "$OUT" "$TMP"
xcrun simctl io "$DEV" recordVideo --codec h264 --force "$TMP" &
REC=$!
sleep 3 # the home screen
xcrun simctl launch "$DEV" lk.pitaka.dictionary
sleep "$SECS"
kill -INT $REC
wait $REC || true
xcrun simctl status_bar "$DEV" clear
xcrun simctl spawn "$DEV" defaults delete lk.pitaka.dictionary script
cp "$TMP" "$OUT"
ls -lh "$OUT"
