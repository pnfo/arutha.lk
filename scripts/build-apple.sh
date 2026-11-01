#!/usr/bin/env bash
# The iOS app (apple/project.yml), with Xcode on this Mac. From tipitaka.app.
#   scripts/build-apple.sh sim [route] [--fixture]   debug build on the booted simulator, launched at the route (/love)
#   scripts/build-apple.sh ios [--upload]            App Store archive + export -> apple/build/export/*.ipa (and upload)
# Signing is automatic with the account signed in to Xcode: -allowProvisioningUpdates creates the app id
# (lk.pitaka.dictionary, with the associated domain arutha.lk), certificates and profiles when they are missing; the
# API key only uploads (altool). ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (the .p8 file); TEAM_ID.
# The version is package.json's (VERSION overrides it); BUILD (default yymmddHHMM) must be new for every upload.
set -euo pipefail
cd "$(dirname "$0")/.."
TEAM_ID=${TEAM_ID:-4456F3J27A} # the Apple developer team (developer.apple.com → Membership), as the Books app
VERSION=${VERSION:-$(node -p "require('./package.json').version")}
BUILD=${BUILD:-$(date +%y%m%d%H%M)}
export TEAM_ID VERSION BUILD
WHAT=${1:-ios}
B=apple/build
DB=db/dict.db
[[ " $* " == *" --fixture "* ]] && DB=e2e/fixtures/db/dict.db
[ -f "$DB" ] || { echo "build the db first (npm run build:dict)"; exit 1; }
mkdir -p "$B/db"
cmp -s "$DB" "$B/db/dict.db" || cp -c "$DB" "$B/db/dict.db" # APFS clone
npm run -s build:web:app >/dev/null
[ -d server/mobile/build/Engine.xcframework ] && [ "${REBUILD_ENGINE:-}" = "" ] || bash scripts/build-mobile.sh ios >/dev/null
(cd apple && xcodegen generate --quiet)

if [ "$WHAT" = sim ]; then
  ROUTE=${2:-}
  [ "$ROUTE" = --fixture ] && ROUTE=
  xcodebuild -project apple/Dictionary.xcodeproj -scheme Dictionary-iOS -configuration Debug -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "$B/derived" build -quiet
  APP="$B/derived/Build/Products/Debug-iphonesimulator/Dictionary.app"
  xcrun simctl install booted "$APP"
  xcrun simctl terminate booted lk.pitaka.dictionary 2>/dev/null || true
  xcrun simctl launch booted lk.pitaka.dictionary ${ROUTE:+-start "$ROUTE"}
  exit 0
fi

ASC_KEY_ID=${ASC_KEY_ID:-CNJQZ82QCH} ASC_ISSUER_ID=${ASC_ISSUER_ID:-177929b9-56d5-4755-88a7-b8a4a017d089}
ASC_KEY_PATH=${ASC_KEY_PATH:-/Volumes/2TB/Android/AuthKey_CNJQZ82QCH.p8}
xcodebuild -project apple/Dictionary.xcodeproj -scheme Dictionary-iOS -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$B/Dictionary.xcarchive" -allowProvisioningUpdates archive -quiet
cat > "$B/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>export</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
  <key>uploadSymbols</key><true/>
</dict></plist>
PLIST
rm -rf "$B/export"
# the export copies with /usr/bin/rsync, which runs "rsync" from PATH: Homebrew's rejects Apple's options
PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH" xcodebuild -exportArchive -archivePath "$B/Dictionary.xcarchive" -exportOptionsPlist "$B/ExportOptions.plist" \
  -exportPath "$B/export" -allowProvisioningUpdates -quiet
IPA=$(find "$B/export" -maxdepth 1 -name '*.ipa' | head -1)
echo "iOS $VERSION ($BUILD): $IPA ($(du -h "$IPA" | cut -f1))"
[ "${2:-}" = --upload ] || exit 0
xcrun altool --upload-app -f "$IPA" -t ios --api-key "$ASC_KEY_ID" --api-issuer "$ASC_ISSUER_ID" --p8-file-path "$ASC_KEY_PATH" 2>&1 | grep -v -e Progress -e '^$'
