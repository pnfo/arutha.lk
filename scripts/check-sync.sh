#!/usr/bin/env bash
# server/engine/{dict,normalize,lru}.go are verbatim copies of tipitaka.app (../cst/server/engine): the Pali lookup
# (DPD inflections, the Sinhala Pali dictionaries) must behave the same in both. tipitaka.lk keeps the same copies.
# Fix a difference in ../cst first, then copy the file here.
set -e
cd "$(dirname "$0")/.."
CST=${CST:-../cst}
if [ ! -d "$CST/server/engine" ]; then echo "check-sync: $CST not found, skipped"; exit 0; fi
status=0
for f in dict.go normalize.go lru.go; do
  if ! cmp -s "server/engine/$f" "$CST/server/engine/$f"; then echo "check-sync: server/engine/$f differs from $CST/server/engine/$f"; status=1; fi
done
[ $status = 0 ] && echo "check-sync: dict.go normalize.go lru.go are in sync with $CST"
exit $status
