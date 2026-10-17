#!/usr/bin/env bash
# Pacchettizza extension/ per i due store:
#   dist/bookmark-tidy-bwlab-v<X.Y.Z>.zip          → Chrome Web Store (manifest invariato)
#   dist/bookmark-tidy-bwlab-firefox-v<X.Y.Z>.zip  → addons.mozilla.org
#   dist/firefox/                                  → cartella per about:debugging ("Carica componente aggiuntivo temporaneo")
# Il manifest Firefox e' derivato da extension/manifest.json (unica fonte da mantenere).
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(python3 -c "import json; print(json.load(open('extension/manifest.json'))['version'])")
DIST="dist"
OUT="$DIST/bookmark-tidy-bwlab-v${VERSION}.zip"
FF_DIR="$DIST/firefox"
FF_OUT="$DIST/bookmark-tidy-bwlab-firefox-v${VERSION}.zip"
EXCLUDES=(-x "*.DS_Store" -x "icons/*.svg" -x "*.bak" -x "*.swp")

mkdir -p "$DIST"
rm -rf "$OUT" "$FF_DIR" "$FF_OUT"

# ---- Chrome ----
(cd extension && zip -qr "../$OUT" . "${EXCLUDES[@]}")

# ---- Firefox ----
cp -r extension "$FF_DIR"
rm -f "$FF_DIR"/icons/*.svg
python3 - "$FF_DIR" <<'PY'
import json, shutil, sys, os
d = sys.argv[1]
p = os.path.join(d, "manifest.json")
m = json.load(open(p))
m["description"] = "__MSG_extDescriptionFirefox__"
# Firefox non permette di sostituire la pagina dei preferiti: si apre da icona toolbar e Alt+Shift+B
m.pop("chrome_url_overrides", None)
# niente API favicon in Firefox: il manager mostra l'iniziale del dominio
m["permissions"] = [x for x in m["permissions"] if x != "favicon"]
# Firefox MV3: background come event page ("scripts"), non service_worker
m["background"] = {"scripts": [m["background"]["service_worker"]]}
m["browser_specific_settings"] = {"gecko": {
    "id": "bookmark-tidy@bwlab.it",
    "strict_min_version": "140.0",  # data_collection_permissions (richiesto da AMO) da Firefox 140
    "data_collection_permissions": {"required": ["none"]},
}}
json.dump(m, open(p, "w"), ensure_ascii=False, indent=2)
# Firefox usa "nb" per il norvegese bokmål, Chrome "no": stessa traduzione sotto entrambi i nomi
shutil.copytree(os.path.join(d, "_locales", "no"), os.path.join(d, "_locales", "nb"))
PY
(cd "$FF_DIR" && zip -qr "../$(basename "$FF_OUT")" . "${EXCLUDES[@]}")

echo
echo "Chrome:  $OUT"
echo "Firefox: $FF_OUT  (cartella di test: $FF_DIR)"
ls -lh "$OUT" "$FF_OUT"
