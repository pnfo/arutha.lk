#!/usr/bin/env bash
# Deploys a release to the droplet (tipitaka.lk, shared with tipitaka.app and tipitaka.lk). From tipitaka.app.
#   scripts/deploy.sh            prints what would be done (nothing is changed)
#   scripts/deploy.sh --stage    uploads a release and runs it on 127.0.0.1:3001 (ssh -L 3001:127.0.0.1:3001 tipitaka.lk,
#                                then http://localhost:3001); the live site is not touched. Stop: sudo systemctl stop arutha_lk_stage
#   scripts/deploy.sh --go       uploads a release, points `current` at it and restarts arutha_lk (the live site)
# The linux binary is cross-compiled here (macOS: brew tap messense/macos-cross-toolchains, x86_64-unknown-linux-gnu-gcc).
# Server layout (~/www/arutha.lk):
#   db/dict-<hash>.db                       shared by releases, only uploaded when new
#   releases/<ts>/{arutha_lk, dist/, db/dict.db -> ../../../db/...}   and `current` -> releases/<ts>
#   the v1 files (arutha_lk_linux_intel, dist/, server-data/) stay until v3 has run for a while (rollback: dev-docs/deploy.md)
set -euo pipefail
cd "$(dirname "$0")/.."
MODE=${1:-plan}
HOST=${DEPLOY_HOST:-tipitaka.lk}
BASE=${DEPLOY_BASE:-www/arutha.lk}
SITE=${DEPLOY_SITE:-https://arutha.lk}
[ -f db/dict.db ] || { echo "build the db first (npm run build:dict)"; exit 1; }
EXPECTED=$(node -p "require('./db/build-info.json').content_hash")
DICT="dict-$EXPECTED.db"
if [ "$MODE" = plan ]; then
  echo "would deploy content $EXPECTED ($DICT, $(du -h db/dict.db | cut -f1)) to $HOST:$BASE and restart arutha_lk"
  echo "run with --stage (port 3001, live site untouched) or --go (live)"
  exit 0
fi
[ "$MODE" = --stage ] || [ "$MODE" = --go ] || { echo "usage: $0 [--stage|--go]"; exit 2; }
bash scripts/check-sync.sh
BIN=server/bin/arutha_lk_linux_amd64
echo "building $BIN"
(cd server && CGO_ENABLED=1 GOOS=linux GOARCH=amd64 CC=${LINUX_CC:-x86_64-unknown-linux-gnu-gcc} go build -trimpath -ldflags "-s -w" -o bin/arutha_lk_linux_amd64 .)
# always a fresh web build: an old web/dist would not match the binary and the db
npm run build:web
TS=$(date +%Y%m%d-%H%M%S)
REL="$BASE/releases/$TS"
ssh "$HOST" "mkdir -p $BASE/db $REL/db && df -h ~ | tail -1"
# the db goes compressed (zstd -19 --long), resumable, unpacked on the server
mkdir -p .cache/deploy
if ssh "$HOST" "test -f $BASE/db/$DICT"; then echo "$DICT already on the server"; else
  zst=.cache/deploy/$DICT.zst
  [ -f "$zst" ] || { echo "compressing db/dict.db"; zstd -q -f -T0 -19 --long=27 db/dict.db -o "$zst.tmp" && mv "$zst.tmp" "$zst"; }
  rsync --partial --info=progress2 "$zst" "$HOST:$BASE/db/$DICT.zst"
  ssh "$HOST" "cd $BASE/db && zstd -q -d -f --long=27 $DICT.zst -o $DICT.part && mv $DICT.part $DICT && rm -f $DICT.zst"
fi
find .cache/deploy -name '*.db.zst' ! -name "$DICT.zst" -delete
rsync -az --info=progress2 web/dist/ "$HOST:$REL/dist/"
rsync -az "$BIN" "$HOST:$REL/arutha_lk"
ssh "$HOST" "cd $REL && chmod +x arutha_lk && ln -sfn ../../../db/$DICT db/dict.db"
# the country database (server/geo.go): DB-IP's country lite file of the month
ssh "$HOST" "mkdir -p $BASE/geo && cd $BASE/geo && f=dbip-country-lite-\$(date -u +%Y-%m).csv.gz && { [ -s \$f ] \
  || { curl -fsS -o \$f.part https://download.db-ip.com/free/\$f && mv \$f.part \$f && ln -sfn \$f country.csv.gz \
       && ls -1 dbip-*.csv.gz | grep -vx \$f | xargs -r rm -f; } \
  || { rm -f \$f.part; echo 'geoip: no DB-IP file for this month yet, keeping the last one'; }; }"

if [ "$MODE" = --stage ]; then
  # as the user, no sudo: the previous staged server (its pid in stage.pid) is stopped first
  # (; not &&: only the server goes to the background, so that $! is its pid)
  ssh "$HOST" "cd ~/$BASE; [ -f stage.pid ] && kill \$(cat stage.pid) 2>/dev/null; sleep 1; \
    setsid nohup /home/janaka/$REL/arutha_lk -listen 127.0.0.1:3001 -root-path /home/janaka/$REL > stage.log 2>&1 < /dev/null & echo \$! > stage.pid"
  sleep 3
  ssh "$HOST" "curl -fsS http://127.0.0.1:3001/api/health" && echo && echo "staged $TS on 127.0.0.1:3001: ssh -L 3001:127.0.0.1:3001 $HOST"
  exit 0
fi

PREV=$(ssh "$HOST" "readlink $BASE/current || true")
PID=$(ssh "$HOST" "systemctl show -p MainPID --value arutha_lk")
# the systemd units: installed when they differ from the droplet's
rsync -az server/arutha_lk.service server/arutha_lk_watchdog.{service,timer,sh} "$HOST:$REL/systemd/"
UNITS="cd ~/$REL/systemd && same=1; cmp -s arutha_lk_watchdog.sh /usr/local/bin/arutha_lk_watchdog || same=; \
  for f in *.service *.timer; do cmp -s \$f /etc/systemd/system/\$f || same=; done; [ -n \"\$same\" ] || { echo 'installing the systemd units' \
  && sudo install -m 644 *.service *.timer /etc/systemd/system/ && sudo install -m 755 arutha_lk_watchdog.sh /usr/local/bin/arutha_lk_watchdog \
  && sudo systemctl daemon-reload && sudo systemctl enable --now arutha_lk_watchdog.timer; }"
ssh -t "$HOST" "cd ~/$BASE && ln -sfn releases/$TS current.new && mv -T current.new current && ($UNITS) && sudo systemctl restart arutha_lk"
for i in $(seq 1 20); do
  if curl -fsS "$SITE/api/health" 2>/dev/null | grep -q "\"contentHash\":\"$EXPECTED\"" \
    && [ "$(ssh "$HOST" "systemctl show -p MainPID --value arutha_lk")" != "$PID" ]; then
    echo "deployed $TS ($EXPECTED)"
    # keep the current and the previous release and the dbs they use
    ssh "$HOST" "cd ~/$BASE && ls -1d releases/* | head -n -2 | xargs -r rm -rf && \
      used=\$(readlink -f releases/*/db/*.db | xargs -n1 basename | sort -u) && \
      for f in db/*.db; do echo \"\$used\" | grep -qx \"\$(basename \$f)\" || rm -f \"\$f\"; done && df -h ~ | tail -1"
    exit 0
  fi
  sleep 2
done
echo "health check failed. rollback: ssh $HOST 'cd $BASE && ln -sfn ${PREV#$HOME/} current && sudo systemctl restart arutha_lk'"
echo "(first v3 deploy: reinstall the v1 unit legacy/server/arutha_lk.service, see dev-docs/deploy.md)"
exit 1
