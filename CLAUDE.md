# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Cosa è

Estensione Chrome MV3 (vanilla JS, niente bundler) per riordinare e gestire preferiti Chrome. Una sola UI:

- **Manager** (override `chrome://bookmarks`, apribile anche da icona toolbar o `Alt+Shift+B`): page application con sidebar albero, lista item, ricerca istantanea, drag&drop, gestione cartelle

Tutte le mutazioni passano da `chrome.bookmarks` API → sync Chrome propaga ad altri device dell'utente.

## Comandi

```bash
./build.sh                       # zip pronto per Chrome Web Store in dist/bookmark-tidy-bwlab-v<X.Y.Z>.zip
git push                         # repo pubblico github.com/bwlab/bookmark-tidy
```

Niente test, niente lint, niente bundler. Modifiche → ricaricare estensione (`chrome://extensions` → ↻) → su modifiche manifest serve **rimuovere e ricaricare da zero** (override e service worker si registrano solo a load iniziale).

## Architettura

### File chiave

- **`extension/manifest.json`** — MV3. Permessi `bookmarks`+`tabs`+`favicon` (favicon dalla cache locale di Chrome via `chrome-extension://<id>/_favicon/`, nessuna richiesta di rete). Dichiara action (nessuna popup, click icona apre il manager), `chrome_url_overrides.bookmarks → manager.html`, command `Alt+Shift+B`, service worker, icone.
- **`extension/manager.html`** + **`manager.js`** + **`manager.css`** — bookmark manager (override `chrome://bookmarks`). SPA con sidebar albero, lista item, ricerca istantanea, drag&drop, gestione cartelle, theme switch.
- **`extension/theme-init.js`** — anti-FOUC. Legge `localStorage.bwlab-theme` e applica `data-theme` su `<html>` PRIMA del render. Caricato in `<head>`, file separato per evitare CSP inline-script block.
- **`extension/background.js`** — service worker. `openManager()` riusa la tab manager esistente se già aperta, altrimenti la crea. Chiamata da `chrome.action.onClicked` (click icona toolbar) e da `chrome.commands.onCommand` (shortcut `Alt+Shift+B`).
- **`extension/credits.html`** — pagina credits bwlab, linkata dall'header del manager.
- **`extension/icons/`** — `icon-{16,32,48,128}.png` generate da `icon.svg` (palette lime+nero) via `rsvg-convert`.
- **`build.sh`** — pacchettizza `extension/` in `dist/bookmark-tidy-bwlab-v<version>.zip` per Chrome Web Store.

### Bookmark Manager state (manager.js)

Stato globale `state` con `tree`, `flat[]` (URL flat indicizzati con path), `folders` Map (id→{node,count,path}). `loadTree()` ricostruisce ad ogni `refresh()`. Listener su `chrome.bookmarks.on*` triggera auto-refresh debounced (per propagazione sync da altri device).

Render diviso: `renderTree()` per sidebar, `renderList()` per content. Quando in folder view, `renderList` mostra **prima sotto-cartelle** (`folderRowHtml`) poi URL (`itemRowHtml`). La lista è generata come unica stringa HTML; click/dblclick/drag&drop sono **listener delegati su `#list`** (item ritrovati via `state.byId` / `state.folders`), così migliaia di righe non costano migliaia di listener. Righe con `content-visibility: auto` in CSS.

Mutazioni via `mutate(fn)`: esegue, mostra l'errore nel dialog, poi `refresh()`. Niente `prompt/confirm/alert` nativi: usare `ui.prompt/ui.confirm/ui.alert` (Promise, `<dialog id="dialog">` in manager.html). Drag&drop interno con MIME custom `DND_TYPE` (drag esterni ignorati).

## Vincoli MV3 da ricordare

- **CSP `script-src 'self'`**: no inline `onclick=`, no inline `<script>`, no `javascript:` URLs eseguibili. Tutti gli handler via `addEventListener`. Bookmarklet (`javascript:` URL) renderizzati con `href="#"` neutralizzato + alert su click.
- **Override bloccabile**: Chrome managed profiles (Workspace) possono ignorare `chrome_url_overrides`. Sempre garantire fallback icona/shortcut (`chrome.action.onClicked` + `Alt+Shift+B`).
- **Root non toccabili**: `0` (super-root) e i suoi figli diretti (Barra, Altri, Mobile, eventuali root account). Calcolati in `loadTree()` (`state.rootIds`), non hard-coded; la Barra è `state.barId` (`folderType === "bookmarks-bar"`, preferendo quella con `syncing`, fallback primo root). `isProtected(node)` blocca delete/rename/move su root e su nodi `unmodifiable` (gestiti da policy aziendale).

## Mai fare

**Non scrivere mai** direttamente `~/.config/google-chrome/Default/Bookmarks` quando sync è attivo. Chrome al riavvio: trova file senza `checksum` → scarta come corrotto → ripristina da `Bookmarks.bak` → sync cloud reimposta vecchi duplicati. Modifiche perse. Sempre usare API via estensione.

## Design System v2 (riferimento)

Token CSS in `manager.css :root` derivati da `design-tokens.css` del sito bwlab (`/media/extra/Progetti/astrojs-primereact/CascadeProjects/windsurf-project/astro-primereact/src/styles/design-tokens.css`). `--heritage-a` è impostato su lime bwlab (`#B8FF3E`, dal palette Lab dei design-tokens) invece del giallo originale; `--heritage-b` (rosso) resta per gli stati di errore. Per nuovi componenti: usare variabili `--surface-*`, `--fg-*`, `--accent-a/b`, `--accent-a-weak`, font `var(--font-sans)` Inter Tight, mai colori hard-coded.

## Repo

- GitHub: https://github.com/bwlab/bookmark-tidy (pubblico)
- License: MIT
- Privacy: PRIVACY.md (zero data collection, tutto locale)
