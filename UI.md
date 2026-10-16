# UI — Bookmark Tidy bwlab

Documentazione struttura interfaccia, contenuti, icone, navigazione.

---

## 1. Punti di accesso

L'estensione espone **una sola UI**, il Bookmark Manager (nessuna popup):

| UI | Come si apre | Scopo |
|----|--------------|-------|
| **Bookmark Manager** | `chrome://bookmarks` (override) · `Alt+Shift+B` · click icona toolbar (riusa la tab se già aperta) | Navigazione, ricerca, gestione quotidiana dei preferiti |

Pagina accessoria: **Credits** (`credits.html`), linkata dall'header del manager.

Palette bwlab: accent lime `#B8FF3E` (`--accent-a`) + rosso `#E30613` (`--accent-b`, stati di errore/drop), font Inter Tight.

---

## 2. Bookmark Manager — Struttura pagina

```
┌─────────────────────────────────────────────────────────────────────┐
│  ◆ bwlab PREFERITI │ 🔍 Cerca tra i preferiti (premi /)  │ 🌙 │1234 URL│
├─────────────┬───────────────────────────────────────────────────────┤
│  VISTE      │  Preferiti › 01 Lavoro › E-commerce        ← breadcrumb│
│  ─────      │  ─────────────────────────────────────────────────────│
│  • Tutti    │  ORDINE [Manuale ▾]                       N cartelle ·│
│  • Recenti  │                                            M preferiti│
│    30gg     │  ─────────────────────────────────────────────────────│
│  • Più      │  📁 BigCommerce                                        │
│    vecchi   │     10 preferiti                          ✎ → ✕       │
│    100      │  📁 Shopify                                            │
│  • Senza    │     2 preferiti                           ✎ → ✕       │
│    cartella │  ────                                                  │
│             │  [favicon] PrestaShop Hooks Reference                  │
│  CARTELLE   │           devdocs.prestashop-project.org · 2m         │
│  + nuova    │                                          ↗ ⎘ ✎ → ✕   │
│             │  [favicon] PrestaShop Performance Tips                 │
│  ▼ 📁Barra  │           medium.com · 1set                            │
│   ▶📁01 Lav │                                                        │
│   ▶📁02 AI  │                                                        │
│   ...       │                                                        │
├─────────────┴───────────────────────────────────────────────────────┤
│  / cerca · ↑↓ naviga · Enter apri · Ctrl+Click nuova tab · ...     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.1 Header (top, 60px)

3 colonne grid:

1. **Brand bwlab** (sinistra, 240px)
   - Quadrato 28×28 con gradient diagonale 135°: metà lime `#B8FF3E`, metà nero
   - Testo "bwlab" minuscolo grassetto + "PREFERITI" maiuscolo letter-spacing wider colore muted
   - Sotto: link "Credits" → `credits.html`

2. **Ricerca** (centro, flex)
   - Input fullwidth, placeholder "Cerca tra i preferiti (premi /)"
   - Focus → bordo lime accent + glow soft
   - Tipizzando filtra istantaneamente (debounce 120ms) titolo + URL + path cartella

3. **Header-right** (destra)
   - **☕ Offrimi un caffè**: pulsante pill giallo pieno (`--support-bg`, uguale nei due temi) → `https://buymeacoffee.com/bwlab` in nuova tab. Sotto 1100px di larghezza mostra solo l'icona (testo nel tooltip). Presente anche nella pagina Credits
   - **Theme toggle** rotondo 42×42px: 🌙 in light mode, ☀ in dark mode. Hover → bordo+icona lime, scale 1.05
   - **Meta counter**: "N URL · M cartelle"

### 2.2 Sidebar sinistra (300px)

#### Sezione "VISTE" (presets)

4 bottoni cliccabili, esclusivi (uno alla volta attivo):

- **Tutti** — mostra tutti gli URL flat indicizzati
- **Recenti 30gg** — URL aggiunti negli ultimi 30 giorni, ordinati data desc
- **Più vecchi 100** — i 100 URL più antichi
- **Senza cartella** — URL al root di Barra preferiti / Altri preferiti (orfani)

Stile attivo: sfondo lime pieno, testo nero, font weight 600.

#### Sezione "CARTELLE"

Header con titolo "CARTELLE" maiuscolo + bottone `+ nuova` (crea cartella in Barra preferiti).

Albero ricorsivo. Ogni nodo è una riga grid con colonne:

| Twisty | Icon | Label | Conteggio | Actions (hover) |
|--------|------|-------|-----------|-----------------|
| `▶`/`▼` | `📁`/`📂` | Nome cartella | N (mono) | `+ ✎ → ✕` |

- **Twisty** `▶` chiusa, `▼` aperta. Click solo sul twisty espande/collassa
- **Folder icon** 18px: `📁` chiusa, `📂` aperta
- **Label**: nome cartella (truncate ellipsis)
- **Conteggio**: numero ricorsivo di URL contenuti (sostituito da actions su hover)
- **Actions hover**:
  - `+` → crea sotto-cartella (dialog con nome)
  - `✎` → rinomina (dialog)
  - `→` → sposta in (dialog con path testuale, come per i preferiti)
  - `✕` → elimina con conferma; se non vuota usa `removeTree`
  - Root (Barra/Altri/Mobile): solo `+`, no rinomina/cancella

**Click sul nome cartella** → seleziona, pannello content mostra contenuto.

**Drag handle**: l'intero nodo è draggable (eccetto root). Drop su altra cartella → sposta dentro.

**Cartella selezionata**: sfondo lime soft 18%, bordo sinistro pieno lime 3px.

### 2.3 Content area (destra, flex)

#### Breadcrumb (top, 42px)

Tre tipi di stato:

1. **Folder view**: catena cliccabile `Preferiti › 01 Lavoro › E-commerce` (ultimo grassetto)
2. **Search**: `🔍 Risultati per "<query>"`
3. **Preset**: `⚑ Tutti` / `⚑ Recenti 30gg` / etc

Click su crumb → naviga al livello corrispondente.

#### Toolbar (40px)

- **Sinistra**: label "ORDINE" + select 5 opzioni (Manuale · Titolo · Recenti prima · Vecchi prima · Dominio). Manuale = ordine Chrome originale.
- **Destra**: counter "N cartelle · M preferiti" (mono, tabular-nums).

#### Lista item (scrollabile)

In **folder view**: prima sotto-cartelle, poi URL.

##### Folder row

Grid 56px | 1fr | auto, padding 14px·24px:

| Slot 1 | Slot 2 | Slot 3 (hover) |
|--------|--------|----------------|
| Quadrato 48×48 lime soft + bordo lime, dentro 📁 grande | Titolo cartella **grassetto** + sotto-info "N preferiti · M sotto-cartelle" o "vuota" | `✎` `→` `✕` |

- Click ovunque (tranne actions) o `Enter` con riga selezionata → entra nella cartella (selectFolder)
- `E` / `Del` con riga selezionata → rinomina / elimina cartella
- Drag → sposta cartella altrove
- Drop → accetta item/cartelle dentro

##### URL row

Grid 56px | 1fr | auto:

| Slot 1 | Slot 2 | Slot 3 (hover) |
|--------|--------|----------------|
| **Favicon 48×48** rounded, padding 6, bordo soft. Dalla cache locale di Chrome (`_favicon/?pageUrl=…&size=32`, permesso `favicon`), lazy | **Titolo** (link, font 16px, hover lime) sopra · **Sotto-info**: dominio (mono) · data relativa (oggi/2g/3set/...) · chip cartella `📁 path/...` quando sei in search/preset | 5 bottoni icon: `↗` (nuova tab) · `⎘` (copia URL) · `✎` (rinomina) · `→` (sposta in path testuale) · `✕` (elimina, rosso hover) |

- Click sul titolo → naviga (current tab)
- Ctrl+click / middle-click → nuova tab (default `<a href>`)
- Double-click → naviga
- Drag → sposta su altra cartella in sidebar/lista
- **Bookmarklet** (`javascript:URL`) → titolo rosso + chip "bookmarklet", click avvisa CSP block

**Item selezionato** (tastiera o click): bordo sinistro lime 3px + sfondo surface-1.

**Item hover**: actions appaiono, sfondo lievemente più chiaro.

### 2.4 Footer hint (24px)

Linea unica con keyboard shortcuts in `<kbd>` mono pill: `/` cerca · `↑` `↓` naviga · `Enter` apri · `Ctrl+Click` nuova tab · `E` rinomina · `Del` elimina · `Esc` reset

---

## 3. Flusso di navigazione

### All'apertura

- Pagina carica con cartella `Barra preferiti` (id=1) selezionata di default
- Sidebar: tree con root espansi (Barra/Altri/Mobile)
- Content: breadcrumb "Preferiti", lista mostra sotto-cartelle top-level (01 Lavoro, 02 AI, ...) + eventuali URL sparsi

### Esplorazione cartelle

1. **Click cartella sidebar** → seleziona, mostra contenuto, espande automaticamente i parent
2. **Click cartella nella lista content** → entra (selezione si sposta)
3. **Click crumb breadcrumb** → torna a livello superiore
4. **Click bottone preset** (Tutti/Recenti/...) → sidebar deselezionata, lista mostra preset, breadcrumb mostra `⚑ <nome>`
5. **Tipizza nella ricerca** → tutto si resetta, lista mostra match cross-folder con highlight lime + chip cartella
6. **Svuota la ricerca** (Backspace o `Esc` nel campo) → torna alla vista attiva prima della ricerca (cartella o preset); se la cartella nel frattempo è stata eliminata, torna alla Barra

### Operazioni su item

- **Apri**: click titolo (current tab) · Ctrl+click (nuova tab) · `↗` (nuova tab background)
- **Copia URL**: `⎘` → clipboard + chip verde "URL copiato" 1.5s
- **Rinomina**: `✎` o tasto `E` con item selezionato → dialog
- **Sposta**: `→` → dialog con path testuale precompilato con il path attuale (es. `Barra dei preferiti/01 Lavoro`). Se il primo segmento è il nome di una root (Barra/Altri/Mobile) si parte da lì, altrimenti il path è relativo alla Barra (es. `01 Lavoro/Server`); cartelle mancanti vengono create
- **Elimina**: `✕` o `Del` → conferma (bottone rosso) → `chrome.bookmarks.remove`
- **Drag**: trascina item su qualsiasi cartella (sidebar o lista) → sposta. Accetta solo drag interni al manager (MIME `application/x-bookmark-tidy-ids`); link/testo trascinati da altre pagine vengono ignorati. Errori di spostamento (es. cartella dentro sé stessa) → dialog di errore

### Operazioni su cartelle

- **Crea root**: bottone `+ nuova` accanto a "CARTELLE" → dialog → crea sotto Barra preferiti
- **Crea sotto-cartella**: hover su nodo sidebar → bottone `+`
- **Rinomina**: `✎` (sidebar o folder row in lista)
- **Sposta**: `→` (sidebar o folder row) → dialog precompilato con il path della cartella genitore; stesse regole dei preferiti (root iniziale opzionale, cartelle mancanti create). Spostare una cartella dentro sé stessa o una sua sotto-cartella → errore, senza creare nulla. Oppure drag&drop
- **Elimina**: `✕` con conferma (mostra conteggio URL+sub se non vuota); usa `removeTree` ricorsivo

### Theme switch

Click 🌙/☀ in header → toggla `data-theme` su `<html>` tra `dark` (default) e `light`. Persistito in `localStorage.bwlab-theme`. Anti-FOUC tramite `theme-init.js` caricato in `<head>`.

### Auto-refresh

Listener su `chrome.bookmarks.onCreated/onRemoved/onChanged/onMoved/onChildrenReordered` — debounce 400ms → `refresh()`. Quando sync da telefono/altro PC propaga modifiche, la pagina si aggiorna sola.

---

## 4. Icone usate

### Brand
- **Icona estensione** (toolbar, chrome://extensions, Web Store): nastro segnalibro lime con angolo piegato nero; righe decrescenti solo a 128/48 px, silhouette a 32 px, versione a pixel a 16 px (`extension/icons/`)
- **Quadrato bwlab** (header manager e credits): gradient diagonale 135° lime→nero, rounded

### UI universali
- 🌙 / ☀ — theme toggle
- 🔍 — ricerca (placeholder + breadcrumb search state)
- ⚑ — preset attivo (breadcrumb)
- 📁 / 📂 — cartella chiusa/aperta (sidebar tree, lista folder row)
- ▶ / ▼ — twisty espandi/collassa

### Actions item
- ↗ apri in nuova tab
- ⎘ copia URL
- ✎ rinomina
- → sposta in
- ✕ elimina (rosso hover)

### Actions cartella (sidebar)
- + nuova sotto-cartella
- ✎ rinomina
- → sposta in
- ✕ elimina (rosso hover)

### Favicon
- Lette dalla cache favicon locale di Chrome: `chrome-extension://<id>/_favicon/?pageUrl=<url>&size=32` (permesso `favicon`). Nessuna richiesta di rete; siti mai visitati su questo device mostrano l'icona generica

---

## 5. Stati visivi

### Drop target (drag&drop attivo)

- **Cartella sidebar**: sfondo rosso pieno, ombra rossa
- **Folder row in lista**: sfondo rosso soft + bordo sinistro rosso

### Dialog

`<dialog>` modale nativo al posto di `prompt/confirm/alert`: messaggio, input opzionale, bottoni Annulla / OK (OK lime, rosso per le conferme di eliminazione). `Enter` conferma, `Esc` annulla; mentre è aperto le scorciatoie globali sono disattivate.

### Nodi protetti

Root (Barra/Altri/Mobile) e preferiti/cartelle gestiti da policy aziendale (`unmodifiable`): niente bottoni rinomina/sposta/elimina, non trascinabili.

### Empty state

Lista vuota → testo centrato muted "Cartella vuota" o `Nessun risultato per "<query>"`

### Highlight ricerca

Ogni token query → `<mark>` con sfondo lime soft + testo lime grassetto

---

## 6. Responsive / Accessibility

- Layout fisso desktop-first (sidebar 300px + content fluido)
- Scrollbar custom dark
- Bottoni min 36×40px (touch friendly)
- Hover effects rapidi (120ms ease-out)
- Tasti scorciatoia coprono navigazione completa senza mouse
- `tabindex` nativo su button/a/input
