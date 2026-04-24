#!/usr/bin/env bash
# Pacchettizza extension/ in dist/bookmark-tidy-bwlab-vX.Y.Z.zip per Chrome Web Store.
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(python3 -c "import json; print(json.load(open('extension/manifest.json'))['version'])")
DIST="dist"
OUT="$DIST/bookmark-tidy-bwlab-v${VERSION}.zip"

mkdir -p "$DIST"
rm -f "$OUT"

cd extension
zip -r "../$OUT" . \
  -x "*.DS_Store" \
  -x "icons/icon.svg" \
  -x "*.bak" \
  -x "*.swp"
cd ..

echo
echo "Pacchetto: $OUT"
ls -lh "$OUT"
