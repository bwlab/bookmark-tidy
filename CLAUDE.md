# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Cosa è

Estensione Chrome MV3 (vanilla JS, niente bundler) per riordinare, deduplicare e gestire preferiti Chrome. Due UI separate:

- **Popup** (icona toolbar): operazioni bulk in 3 fasi (Fase 1 normalizzazione → Fase 2 ristrutturazione → Consolida AI/Google)
- **Manager** (override `chrome://bookmarks`): page application con sidebar albero, lista item, ricerca istantanea, drag&drop, gestione cartelle

Tutte le mutazioni passano da `chrome.bookmarks` API → sync Chrome propaga ad altri device dell'utente.

## Comandi

```bash
./build.sh                       # zip pronto per Chrome Web Store in dist/bookmark-tidy-bwlab-v<X.Y.Z>.zip
git push                         # repo pubblico github.com/bwlab/bookmark-tidy
```

Niente test, niente lint, niente bundler. Modifiche → ricaricare estensione (`chrome://extensions` → ↻) → su modifiche manifest serve **rimuovere e ricaricare da zero** (override e service worker si registrano solo a load iniziale).

Per aprire il manager senza override (utile se profilo Workspace blocca `chrome_url_overrides`): `Alt+Shift+B` o popup → bottone blu "Apri Bookmark Manager".

## Architettura

### File chiave

- **`extension/manifest.json`** — MV3. Permessi `bookmarks`+`tabs`. Dichiara action+popup, `chrome_url_overrides.bookmarks → manager.html`, command `Alt+Shift+B`, service worker, icone.
- **`extension/popup.html`** + **`popup.js`** — UI bulk operazioni Fase 1/2/Consolida. Tutta la logica di trasformazione (dedup, merge, classify, split) sta qui.
- **`extension/manager.html`** + **`manager.js`** + **`manager.css`** — bookmark manager (override `chrome://bookmarks`). SPA con sidebar albero, lista item, ricerca istantanea, drag&drop, gestione cartelle, theme switch.
- **`extension/theme-init.js`** — anti-FOUC. Legge `localStorage.bwlab-theme` e applica `data-theme` su `<html>` PRIMA del render. Caricato in `<head>`, file separato per evitare CSP inline-script block.
- **`extension/background.js`** — service worker. Handler `chrome.commands.onCommand` per shortcut `Alt+Shift+B`. Riusa tab manager esistente se già aperta.
- **`extension/icons/`** — `icon-{16,32,48,128}.png` generate da `icon.svg` (palette Heritage giallo+rosso) via `rsvg-convert`.
- **`build.sh`** — pacchettizza `extension/` in `dist/bookmark-tidy-bwlab-v<version>.zip` per Chrome Web Store.

### Flusso Fase 2 (popup.js)

`FASE2_OPS` array dichiarativo: ogni op ha `src` (rootId+name), `op` (move/merge/classify), `target` (path segments). `applyPhase2` itera, helper `ensurePath` crea la gerarchia su demand. Classifier per cartelle obese (AI/marketing/G/ToCheck) sono funzioni pure `(url, title) → segments[]`.

### Bookmark Manager state (manager.js)

Stato globale `state` con `tree`, `flat[]` (URL flat indicizzati con path), `folders` Map (id→{node,count,path}). `loadTree()` ricostruisce ad ogni `refresh()`. Listener su `chrome.bookmarks.on*` triggera auto-refresh debounced (per propagazione sync da altri device).

Render diviso: `renderTree()` per sidebar, `renderList()` per content. Quando in folder view, `renderList` mostra **prima sotto-cartelle** (`buildFolderRow`) poi URL (`bindItemEvents`).

## Vincoli MV3 da ricordare

- **CSP `script-src 'self'`**: no inline `onclick=`, no inline `<script>`, no `javascript:` URLs eseguibili. Tutti gli handler via `addEventListener`. Bookmarklet (`javascript:` URL) renderizzati con `href="#"` neutralizzato + alert su click.
- **Override bloccabile**: Chrome managed profiles (Workspace) possono ignorare `chrome_url_overrides`. Sempre garantire fallback popup+shortcut.
- **Popup chiuso = state perso**: il popup di action Chrome distrugge tutto al close. `applyPhase2` ricostruisce il piano se `window.__fase2plan` non c'è (popup riaperto tra Analizza e Applica).
- **Root IDs non toccabili**: `1` (bookmark_bar), `2` (other), `3` (synced), `0` (super-root). `ROOT_IDS` set in manager.js + popup.js — nessun delete/rename/move su questi.

## Mai fare

**Non scrivere mai** direttamente `~/.config/google-chrome/Default/Bookmarks` quando sync è attivo. Chrome al riavvio: trova file senza `checksum` → scarta come corrotto → ripristina da `Bookmarks.bak` → sync cloud reimposta vecchi duplicati. Modifiche perse. Sempre usare API via estensione.

## Design System v2 (riferimento)

Token CSS in `manager.css :root` derivati da `design-tokens.css` del sito bwlab (`/media/extra/Progetti/astrojs-primereact/CascadeProjects/windsurf-project/astro-primereact/src/styles/design-tokens.css`). Palette **Heritage** è il default brand. Per nuovi componenti: usare variabili `--surface-*`, `--fg-*`, `--accent-a/b`, `--accent-a-weak`, font `var(--font-sans)` Inter Tight, mai colori hard-coded.

## Repo

- GitHub: https://github.com/bwlab/bookmark-tidy (pubblico)
- License: MIT
- Privacy: PRIVACY.md (zero data collection, tutto locale)
