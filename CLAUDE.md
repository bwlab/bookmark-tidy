# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Cosa è

Estensione MV3 per Chrome e Firefox (vanilla JS, niente bundler) per riordinare e gestire i preferiti. Un solo sorgente in `extension/`; `build.sh` genera i pacchetti per entrambi gli store. Una sola UI:

- **Manager** (override `chrome://bookmarks`, apribile anche da icona toolbar o `Alt+Shift+B`): page application con sidebar albero, lista item, ricerca istantanea, drag&drop, gestione cartelle

Tutte le mutazioni passano da `chrome.bookmarks` API → sync Chrome propaga ad altri device dell'utente.

## Comandi

```bash
./build.sh                       # dist/bookmark-tidy-bwlab-v<X.Y.Z>.zip (Chrome) + -firefox-v<X.Y.Z>.zip (AMO) + dist/firefox/ (about:debugging)
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

Mutazioni via `mutate(fn)`: esegue, mostra l'errore nel dialog, poi `refresh()`. Niente `prompt/confirm/alert` nativi: usare `ui.prompt/ui.confirm/ui.alert` (Promise, `<dialog id="dialog">` in manager.html). Drag&drop interno con MIME custom `DND_TYPE` (drag esterni ignorati).

## i18n

`extension/_locales/` con 19 lingue: it (default), en, es, fr, de, pt_BR, pt_PT, nl, ca, sv, da, no, fi, el, ja, zh_CN, zh_TW, hi, ru. Testi via `t(key, subs)` (i18n.js) e attributi `data-i18n`, `data-i18n-title`, `data-i18n-placeholder`.

- **Ogni chiave nuova va aggiunta in tutte le 19 lingue** (in Firefox `no` viene servito anche come `nb`) (stessi `placeholders` di `en`). `extDescription` ≤132 caratteri (limite manifest).
- Conteggi con `countLabel(n, base)`: forma scelta da `Intl.PluralRules` → `<base>Singular` / `<base>Plural`, più `<base>Few` / `<base>Many` opzionali (presenti solo in `ru`). Nei messaggi con numeri interpolati preferire la forma neutra "Etichetta: N" dove la lingua ha più plurali.
- `dateUnit*` vengono concatenate al numero senza spazio (`3d`, `3日前`): includere lo spazio iniziale nel messaggio se la lingua lo richiede (`ru`, `hi`).
- I testi per il Chrome Web Store, per lingua, stanno in `STORE_LISTING.md`.

## Firefox

Stesso codice, nessuno sniffing del browser: le differenze sono gestite con **feature detection** in `manager.js` e con il **manifest derivato** in `build.sh` (fonte unica: `extension/manifest.json`, che resta quello Chrome).

- **Albero**: super-root `root________` (non `"0"`) → usare `state.rootId`; root `menu________`, `toolbar_____` (= `state.barId`, Firefox non ha `folderType`), `unfiled_____`, `mobile______` con titoli interni non localizzati → mostrarli sempre con `nodeTitle(node)` (chiavi `rootMenu`/`rootToolbar`/`rootUnfiled`/`rootMobile`), anche nei path e nel confronto di "Sposta in…".
- **Separatori**: Firefox li restituisce come nodi `type: "separator"` con `url: "data:"`. Usare sempre `isFolder(n)` / `isBookmark(n)`, mai `n.url` / `!n.url`, per distinguere cartelle e preferiti.
- **Favicon**: `HAS_FAVICON_API` (permesso `favicon` nel manifest) → `_favicon/`; altrimenti `faviconHtml()` disegna l'iniziale del dominio (`.favicon-letter`, tinta da `--hue`).
- **Niente override** di `chrome://bookmarks`, niente `onChildrenReordered`: il manager si apre da icona/`Alt+Shift+B`, i listener sono già condizionali.
- **Manifest Firefox** (in `build.sh`): via `chrome_url_overrides` e `favicon`, `background.scripts`, `browser_specific_settings.gecko` (id `bookmark-tidy@bwlab.it`, `strict_min_version` 140 per `data_collection_permissions`), `description` = `__MSG_extDescriptionFirefox__`, `_locales/nb` copiato da `no`.
- **Verifica**: `npx addons-linter dist/bookmark-tidy-bwlab-firefox-v<X.Y.Z>.zip` → 0 errori; avvisi attesi: Android (non supportato) e `innerHTML` della lista (valori escapati).

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
