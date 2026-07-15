# UI — Bookmark Tidy bwlab

Documentazione struttura interfaccia, contenuti, icone, navigazione.

---

## 1. Punti di accesso

L'estensione espone **due UI distinte**, accessibili in modi diversi:

| UI | Come si apre | Scopo |
|----|--------------|-------|
| **Bookmark Manager** | `chrome://bookmarks` (override) · `Alt+Shift+B` · click icona toolbar → bottone blu "📑 Apri Bookmark Manager" | Navigazione, ricerca, gestione quotidiana dei preferiti |
| **Popup Tidy** | Click sull'icona estensione (puzzle-piece se nascosta) | Operazioni bulk sul tree (dedup, ristrutturazione, consolidamento) |

Entrambe usano la palette **bwlab Heritage** (giallo `#F5D000` + rosso `#E30613`), font Inter Tight.

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
│    vecchi   │     10 preferiti                            ✎ ✕       │
│    100      │  📁 Shopify                                            │
│  • Senza    │     2 preferiti                             ✎ ✕       │
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
   - Quadrato 28×28 con gradient diagonale 135°: metà giallo `#F5D000`, metà rosso `#E30613`
   - Testo "bwlab" minuscolo grassetto + "PREFERITI" maiuscolo letter-spacing wider colore muted

2. **Ricerca** (centro, flex)
   - Input fullwidth, placeholder "Cerca tra i preferiti (premi /)"
   - Focus → bordo giallo accent + glow soft
   - Tipizzando filtra istantaneamente (debounce 120ms) titolo + URL + path cartella

3. **Header-right** (destra)
   - **Theme toggle** rotondo 42×42px: 🌙 in light mode, ☀ in dark mode. Hover → bordo+icona giallo, scale 1.05
   - **Meta counter**: "N URL · M cartelle"

### 2.2 Sidebar sinistra (300px)

#### Sezione "VISTE" (presets)

4 bottoni cliccabili, esclusivi (uno alla volta attivo):

- **Tutti** — mostra tutti gli URL flat indicizzati
- **Recenti 30gg** — URL aggiunti negli ultimi 30 giorni, ordinati data desc
- **Più vecchi 100** — i 100 URL più antichi
- **Senza cartella** — URL al root di Barra preferiti / Altri preferiti (orfani)

Stile attivo: sfondo giallo pieno, testo nero, font weight 600.

#### Sezione "CARTELLE"

Header con titolo "CARTELLE" maiuscolo + bottone `+ nuova` (crea cartella in Barra preferiti).

Albero ricorsivo. Ogni nodo è una riga grid con colonne:

| Twisty | Icon | Label | Conteggio | Actions (hover) |
|--------|------|-------|-----------|-----------------|
| `▶`/`▼` | `📁`/`📂` | Nome cartella | N (mono) | `+ ✎ ✕` |

- **Twisty** `▶` chiusa, `▼` aperta. Click solo sul twisty espande/collassa
- **Folder icon** 18px: `📁` chiusa, `📂` aperta
- **Label**: nome cartella (truncate ellipsis)
- **Conteggio**: numero ricorsivo di URL contenuti (sostituito da actions su hover)
- **Actions hover**:
  - `+` → crea sotto-cartella (prompt nome)
  - `✎` → rinomina (prompt)
  - `✕` → elimina con conferma; se non vuota usa `removeTree`
  - Root (Barra/Altri/Mobile): solo `+`, no rinomina/cancella

**Click sul nome cartella** → seleziona, pannello content mostra contenuto.

**Drag handle**: l'intero nodo è draggable (eccetto root). Drop su altra cartella → sposta dentro.

**Cartella selezionata**: sfondo giallo soft 16%, testo giallo, bordo sinistro pieno giallo 3px.

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
| Quadrato 48×48 giallo soft + bordo giallo, dentro 📁 grande | Titolo cartella **giallo grassetto** + sotto-info "N preferiti · M sotto-cartelle" o "vuota" | `✎` `✕` |

- Click ovunque (tranne actions) → entra nella cartella (selectFolder)
- Drag → sposta cartella altrove
- Drop → accetta item/cartelle dentro

##### URL row

Grid 56px | 1fr | auto:

| Slot 1 | Slot 2 | Slot 3 (hover) |
|--------|--------|----------------|
| **Favicon 48×48** rounded, padding 6, bordo soft. Caricata da `google.com/s2/favicons?sz=64` | **Titolo** (link, font 16px, hover giallo) sopra · **Sotto-info**: dominio (mono) · data relativa (oggi/2g/3set/...) · chip cartella `📁 path/...` quando sei in search/preset | 5 bottoni icon: `↗` (nuova tab) · `⎘` (copia URL) · `✎` (rinomina) · `→` (sposta in path testuale) · `✕` (elimina, rosso hover) |

- Click sul titolo → naviga (current tab)
- Ctrl+click / middle-click → nuova tab (default `<a href>`)
- Double-click → naviga
- Drag → sposta su altra cartella in sidebar/lista
- **Bookmarklet** (`javascript:URL`) → titolo rosso + chip "bookmarklet", click avvisa CSP block

**Item selezionato** (tastiera o click): bordo sinistro giallo 3px + sfondo surface-1.

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
5. **Tipizza nella ricerca** → tutto si resetta, lista mostra match cross-folder con highlight giallo + chip cartella

### Operazioni su item

- **Apri**: click titolo (current tab) · Ctrl+click (nuova tab) · `↗` (nuova tab background)
- **Copia URL**: `⎘` → clipboard + chip verde "URL copiato" 1.5s
- **Rinomina**: `✎` o tasto `E` con item selezionato → prompt
- **Sposta**: `→` → prompt con path testuale (es. `01 Lavoro/Server`); cartelle mancanti vengono create
- **Elimina**: `✕` o `Del` → conferma → `chrome.bookmarks.remove`
- **Drag**: trascina item su qualsiasi cartella (sidebar o lista) → sposta

### Operazioni su cartelle

- **Crea root**: bottone `+ nuova` accanto a "CARTELLE" → prompt → crea sotto Barra preferiti
- **Crea sotto-cartella**: hover su nodo sidebar → bottone `+`
- **Rinomina**: `✎` (sidebar o folder row in lista)
- **Elimina**: `✕` con conferma (mostra conteggio URL+sub se non vuota); usa `removeTree` ricorsivo

### Theme switch

Click 🌙/☀ in header → toggla `data-theme` su `<html>` tra `dark` (default) e `light`. Persistito in `localStorage.bwlab-theme`. Anti-FOUC tramite `theme-init.js` caricato in `<head>`.

### Auto-refresh

Listener su `chrome.bookmarks.onCreated/onRemoved/onChanged/onMoved/onChildrenReordered` — debounce 400ms → `refresh()`. Quando sync da telefono/altro PC propaga modifiche, la pagina si aggiorna sola.

---

## 4. Popup Tidy — Struttura

Dimensioni 520×auto, mostrato al click icona toolbar.

```
┌────────────────────────────────────────────────┐
│ Bookmark Tidy — bwlab                          │
├────────────────────────────────────────────────┤
│  📑 Apri Bookmark Manager (Alt+Shift+B)       │
├────────────────────────────────────────────────┤
│  [1. Analizza Fase 1]  [2. Applica Fase 1]    │
├────────────────────────────────────────────────┤
│  [3. Analizza Fase 2]  [4. Applica Fase 2]    │
├────────────────────────────────────────────────┤
│  [5. Consolida AI + Google (flat)] [Pulisci]  │
├────────────────────────────────────────────────┤
│  Analizza prima, applica dopo. Modifiche via  │
│  chrome.bookmarks → sync propaga.             │
├────────────────────────────────────────────────┤
│ ╔═════════ LOG OUTPUT (mono, scroll) ═══════╗ │
│ ║                                           ║ │
│ ║                                           ║ │
│ ╚═══════════════════════════════════════════╝ │
└────────────────────────────────────────────────┘
```

### 4.1 Bottoni

| # | Bottone | Colore | Azione |
|---|---------|--------|--------|
| 0 | 📑 Apri Bookmark Manager | blu primary | Apre tab manager (riusa se già aperta) |
| 1 | Analizza Fase 1 | blu primary | Dry-run: lista typo, merge, dup |
| 2 | Applica Fase 1 | rosso danger | Esegue dedup/merge/typo/empty |
| 3 | Analizza Fase 2 | blu primary | Dry-run: tabella classificazione URL |
| 4 | Applica Fase 2 | rosso danger | Crea top-level numerati, sposta cartelle, classifica URL |
| 5 | Consolida AI + Google | rosso danger | Raccoglie *.google.com in `04 Dev/Google-Tools`, flatten 02 AI |
| - | Pulisci log | neutro | Svuota area log |

### 4.2 Log area

Area scroll mono 11px, max 360px altezza. Ogni operazione appende righe con risultati (typo X→Y, dedup URL, merge cartelle, errori).

---

## 5. Icone usate

### Brand
- **Quadrato bwlab** (header manager, popup): gradient diagonale 135° giallo→rosso, rounded-md

### UI universali
- 🌙 / ☀ — theme toggle
- 🔍 — ricerca (placeholder + breadcrumb search state)
- ⚑ — preset attivo (breadcrumb)
- 📁 / 📂 — cartella chiusa/aperta (sidebar tree, lista folder row)
- ▶ / ▼ — twisty espandi/collassa
- 📑 — apri manager (popup)

### Actions item
- ↗ apri in nuova tab
- ⎘ copia URL
- ✎ rinomina
- → sposta in
- ✕ elimina (rosso hover)

### Actions cartella (sidebar)
- + nuova sotto-cartella
- ✎ rinomina
- ✕ elimina (rosso hover)

### Favicon
- Caricate da `https://www.google.com/s2/favicons?sz=64&domain=<host>` — fallback grigio se errore

---

## 6. Stati visivi

### Drop target (drag&drop attivo)

- **Cartella sidebar**: sfondo rosso pieno, ombra rossa
- **Folder row in lista**: sfondo rosso soft + bordo sinistro rosso

### Empty state

Lista vuota → testo centrato muted "Cartella vuota" o `Nessun risultato per "<query>"`

### Highlight ricerca

Ogni token query → `<mark>` con sfondo giallo soft + testo giallo grassetto

---

## 7. Responsive / Accessibility

- Layout fisso desktop-first (sidebar 300px + content fluido)
- Scrollbar custom dark
- Bottoni min 36×40px (touch friendly)
- Hover effects rapidi (120ms ease-out)
- Tasti scorciatoia coprono navigazione completa senza mouse
- `tabindex` nativo su button/a/input
