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
- **Pulsante supporto** `.support-btn` (header manager + credits) → `https://buymeacoffee.com/bwlab`. Colori dai token `--support-bg` / `--support-bg-hover` / `--support-fg` (giallo Buy Me a Coffee, unico colore fuori palette, voluto per visibilità).
- **`extension/icons/`** — icona prodotto: nastro segnalibro lime con angolo piegato nero (richiamo alla diagonale del marchio bwlab), sfondo trasparente. Tre sorgenti SVG, una per fascia di dimensioni:
  - `icon.svg` → 128, 48 (con righe decrescenti = "tidy"; soggetto entro 96×96 centrali come da linee guida Web Store)
  - `icon-small.svg` → 32 (solo silhouette, contorno più spesso)
  - `icon-16.svg` → 16 (disegnata a pixel, `crispEdges`)

  Rigenerare con: `rsvg-convert -w 128 icon.svg -o icon-128.png`, `-w 48 icon.svg -o icon-48.png`, `-w 32 icon-small.svg -o icon-32.png`, `-w 16 icon-16.svg -o icon-16.png`. Gli SVG sono esclusi dallo zip (`build.sh`). La stessa icona è il logo nell'header di manager e Credits (`.brand::before`, da `icon-128.png`) e la favicon della scheda (`<link rel="icon">` 16/32 in entrambe le pagine).
- **`build.sh`** — pacchettizza `extension/` in `dist/bookmark-tidy-bwlab-v<version>.zip` per Chrome Web Store.

### Bookmark Manager state (manager.js)

Stato globale `state` con `tree`, `flat[]` (URL flat indicizzati con path), `folders` Map (id→{node,count,path}). `loadTree()` ricostruisce ad ogni `refresh()`. Listener su `chrome.bookmarks.on*` triggera auto-refresh debounced (per propagazione sync da altri device).

Render diviso: `renderTree()` per sidebar, `renderList()` per content. Quando in folder view, `renderList` mostra **prima sotto-cartelle** (`folderRowHtml`) poi URL (`itemRowHtml`). La lista è generata come unica stringa HTML; click/dblclick/drag&drop sono **listener delegati su `#list`** (item ritrovati via `state.byId` / `state.folders`), così migliaia di righe non costano migliaia di listener. Righe con `content-visibility: auto` in CSS.

Mutazioni via `mutate(fn)`: esegue, mostra l'errore nel dialog, poi `refresh()`. Niente `prompt/confirm/alert` nativi: usare `ui.prompt/ui.confirm/ui.alert` e, per più campi, `ui.form(message, fields, validate)` (Promise, `<dialog id="dialog">` in manager.html; i campi sono generati in `#dialog-fields`, `validate` restituisce un messaggio d'errore e il dialog resta aperto). Nuovo preferito: `newBookmark()` (pulsante `#new-bookmark` e tasto `N`), URL normalizzato da `normalizeUrl()`. Drag&drop interno con MIME custom `DND_TYPE` (drag esterni ignorati).

## i18n

`extension/_locales/` con 19 lingue: it (default), en, es, fr, de, pt_BR, pt_PT, nl, ca, sv, da, no, fi, el, ja, zh_CN, zh_TW, hi, ru. Testi via `t(key, subs)` (i18n.js) e attributi `data-i18n`, `data-i18n-title`, `data-i18n-placeholder`.

- **Ogni chiave nuova va aggiunta in tutte le 19 lingue** (stessi `placeholders` di `en`). `extDescription` ≤132 caratteri (limite manifest).
- Conteggi con `countLabel(n, base)`: forma scelta da `Intl.PluralRules` → `<base>Singular` / `<base>Plural`, più `<base>Few` / `<base>Many` opzionali (presenti solo in `ru`). Nei messaggi con numeri interpolati preferire la forma neutra "Etichetta: N" dove la lingua ha più plurali.
- `dateUnit*` vengono concatenate al numero senza spazio (`3d`, `3日前`): includere lo spazio iniziale nel messaggio se la lingua lo richiede (`ru`, `hi`).
- I testi per il Chrome Web Store, per lingua, stanno in `STORE_LISTING.md`.

## Vincoli MV3 da ricordare

- **CSP `script-src 'self'`**: no inline `onclick=`, no inline `<script>`, no `javascript:` URLs eseguibili. Tutti gli handler via `addEventListener`. Bookmarklet (`javascript:` URL) renderizzati con `href="#"` neutralizzato + alert su click.
- **Override bloccabile**: Chrome managed profiles (Workspace) possono ignorare `chrome_url_overrides`. Sempre garantire fallback icona/shortcut (`chrome.action.onClicked` + `Alt+Shift+B`).
- **Root non toccabili**: `0` (super-root) e i suoi figli diretti (Barra, Altri, Mobile, eventuali root account). Calcolati in `loadTree()` (`state.rootIds`), non hard-coded; la Barra è `state.barId` (`folderType === "bookmarks-bar"`, preferendo quella con `syncing`, fallback primo root). `isProtected(node)` blocca delete/rename/move su root e su nodi `unmodifiable` (gestiti da policy aziendale).

## Mai fare

**Non scrivere mai** direttamente `~/.config/google-chrome/Default/Bookmarks` quando sync è attivo. Chrome al riavvio: trova file senza `checksum` → scarta come corrotto → ripristina da `Bookmarks.bak` → sync cloud reimposta vecchi duplicati. Modifiche perse. Sempre usare API via estensione.

## Design System v2 (riferimento)

Token CSS in `manager.css :root` derivati da `design-tokens.css` del sito bwlab (`/media/extra/Progetti/astrojs-primereact/CascadeProjects/windsurf-project/astro-primereact/src/styles/design-tokens.css`). `--heritage-a` è impostato su lime bwlab (`#B8FF3E`, dal palette Lab dei design-tokens) invece del giallo originale; `--heritage-b` (rosso) resta per gli stati di errore. Per nuovi componenti: usare variabili `--surface-*`, `--fg-*`, `--accent-a/b`, `--accent-a-weak`, **`--accent-a-text` per testo in colore accent** (lime nel tema scuro, `#3D6600` nel chiaro: il lime su bianco ha contrasto 1.2:1; `--accent-a` solo per bordi/sfondi), font `var(--font-sans)` Inter Tight, mai colori hard-coded.

## Repo

- GitHub: https://github.com/bwlab/bookmark-tidy (pubblico)
- License: MIT
- Privacy: PRIVACY.md (zero data collection, tutto locale)
