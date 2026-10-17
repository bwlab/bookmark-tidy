# Bookmark Tidy (bwlab)

Estensione MV3 per **Chrome** e **Firefox** per riordinare, ristrutturare e gestire i preferiti via API `bookmarks` (sync-safe: le modifiche si propagano a tutti i device tramite Chrome Sync / Firefox Sync).

## Features

- **Bookmark Manager**: pagina sostitutiva di `chrome://bookmarks` (override) con UX moderna, ricerca istantanea, drag & drop, gestione cartelle, dark/light theme
- **19 lingue**: italiano, inglese, spagnolo, francese, tedesco, portoghese (BR/PT), olandese, catalano, svedese, danese, norvegese, finlandese, greco, giapponese, cinese (semplificato/tradizionale), hindi, russo
- **Design System bwlab v2**: Inter Tight, dark-first

## Installazione

### Chrome
1. `chrome://extensions` → attiva **Modalità sviluppatore**
2. **Carica estensione non pacchettizzata** → seleziona cartella `extension/`
3. Apri il manager cliccando l'icona toolbar oppure premendo `Alt+Shift+B`

### Firefox (140+)
1. `./build.sh` → genera `dist/firefox/`
2. `about:debugging#/runtime/this-firefox` → **Carica componente aggiuntivo temporaneo** → seleziona `dist/firefox/manifest.json`
3. Apri il manager con l'icona toolbar o `Alt+Shift+B`

Differenze in Firefox: la pagina dei segnalibri del browser non è sostituibile (si apre solo da icona/scorciatoia) e non esiste un'API per le favicon in cache, quindi ogni preferito mostra l'iniziale del dominio su un colore derivato dal dominio. Firefox per Android non è supportato (manca l'API `bookmarks`).

## Note

- Profili Chrome gestiti (Workspace) possono bloccare `chrome_url_overrides`. In tal caso usa l'icona toolbar o `Alt+Shift+B`.
- Backup file `~/.config/google-chrome/Default/Bookmarks` raccomandato prima di operazioni distruttive.

## Build & release

```bash
./build.sh
# → dist/bookmark-tidy-bwlab-v<version>.zip          Chrome Web Store
# → dist/bookmark-tidy-bwlab-firefox-v<version>.zip  addons.mozilla.org
# → dist/firefox/                                    cartella per about:debugging
```

Il manifest Firefox è derivato in `build.sh` da `extension/manifest.json`: niente `chrome_url_overrides` né permesso `favicon`, background `scripts` al posto di `service_worker`, `browser_specific_settings.gecko` (id `bookmark-tidy@bwlab.it`, Firefox ≥ 140, nessuna raccolta dati), descrizione `extDescriptionFirefox`, locale `nb` copiato da `no`.

## Pubblicazione su Chrome Web Store

1. Crea account developer su https://chrome.google.com/webstore/devconsole/ (fee $5 una tantum)
2. Carica `dist/bookmark-tidy-bwlab-vX.Y.Z.zip`
3. Compila Store Listing: nome, descrizione, screenshot (1280×800 o 640×400), icone, categoria "Productivity"
4. Privacy practices: dichiara i permessi `bookmarks` (gestione preferiti utente), `tabs` (apertura manager) e `favicon` (icone siti dalla cache locale). Linka [PRIVACY.md](PRIVACY.md)
5. Invia a review (~1-3 giorni)

## Pubblicazione su addons.mozilla.org

1. Account su https://addons.mozilla.org/developers/ (gratuito)
2. **Submit a New Add-on** → carica `dist/bookmark-tidy-bwlab-firefox-vX.Y.Z.zip`, distribuzione "On this site"
3. Compatibilità: solo **Firefox desktop** (togliere Android)
4. Il codice sorgente non è minificato: non serve caricarlo a parte
5. Validazione locale (facoltativa): `npx addons-linter dist/bookmark-tidy-bwlab-firefox-vX.Y.Z.zip`

## Privacy

[PRIVACY.md](PRIVACY.md) — nessuna raccolta dati, tutto in locale.

## Licenza

MIT
