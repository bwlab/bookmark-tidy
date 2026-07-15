# Bookmark Tidy (bwlab)

Estensione Chrome MV3 per riordinare, ristrutturare e gestire i preferiti via API `chrome.bookmarks` (sync-safe, propaga modifiche a tutti i device).

## Features

- **Bookmark Manager**: pagina sostitutiva di `chrome://bookmarks` (override) con UX moderna, ricerca istantanea, drag & drop, gestione cartelle, dark/light theme
- **Design System bwlab v2**: Inter Tight, dark-first

## Installazione

1. `chrome://extensions` → attiva **Modalità sviluppatore**
2. **Carica estensione non pacchettizzata** → seleziona cartella `extension/`
3. Apri il manager cliccando l'icona toolbar oppure premendo `Alt+Shift+B`

## Note

- Profili Chrome gestiti (Workspace) possono bloccare `chrome_url_overrides`. In tal caso usa l'icona toolbar o `Alt+Shift+B`.
- Backup file `~/.config/google-chrome/Default/Bookmarks` raccomandato prima di operazioni distruttive.

## Build & release

Pacchettizzare per Chrome Web Store:

```bash
./build.sh
# → dist/bookmark-tidy-bwlab-v<version>.zip
```

## Pubblicazione su Chrome Web Store

1. Crea account developer su https://chrome.google.com/webstore/devconsole/ (fee $5 una tantum)
2. Carica `dist/bookmark-tidy-bwlab-vX.Y.Z.zip`
3. Compila Store Listing: nome, descrizione, screenshot (1280×800 o 640×400), icone, categoria "Productivity"
4. Privacy practices: dichiara i permessi `bookmarks` (gestione preferiti utente) e `tabs` (apertura manager). Linka [PRIVACY.md](PRIVACY.md)
5. Invia a review (~1-3 giorni)

## Privacy

[PRIVACY.md](PRIVACY.md) — nessuna raccolta dati, tutto in locale.

## Licenza

MIT
