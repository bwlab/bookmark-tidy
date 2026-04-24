// Bookmark Tidy — Fase 1 normalizzazione via chrome.bookmarks API.
// Operazioni: fix typo, merge cartelle omonime sibling, dedup URL, rimuovi cartelle vuote.

const TYPO_FIXES = [
  ["Maaglioni", "Maglioni"],
  ["Soceta di consulenza", "Società di consulenza"],
  ["Soceta", "Società"],
  ["leurea", "laurea"],
  ["Managment", "Management"],
];

document.getElementById("btn-open-manager")?.addEventListener("click", async () => {
  const url = chrome.runtime.getURL("manager.html");
  const tabs = await chrome.tabs.query({ url });
  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    window.close();
  } else {
    await chrome.tabs.create({ url });
    window.close();
  }
});

const logEl = document.getElementById("log");
const btnAnalyze = document.getElementById("btn-analyze");
const btnPhase1 = document.getElementById("btn-phase1");
const btnClear = document.getElementById("btn-clear");
const btnAnalyze2 = document.getElementById("btn-analyze2");
const btnPhase2 = document.getElementById("btn-phase2");

function log(msg) {
  logEl.textContent += "\n" + msg;
  logEl.scrollTop = logEl.scrollHeight;
}
function clearLog() { logEl.textContent = ""; }

function normUrl(u) {
  try {
    const p = new URL(u);
    const path = (p.pathname || "/").replace(/\/+$/, "") || "/";
    return `${p.protocol}//${p.hostname.toLowerCase()}${path}${p.search}${p.hash}`;
  } catch { return u; }
}

function walk(node, depth, cb, pathArr = []) {
  cb(node, depth, pathArr);
  if (node.children) {
    const np = node.url ? pathArr : [...pathArr, node.title || ""];
    for (const c of node.children) walk(c, depth + 1, cb, np);
  }
}

// --- Analisi dry-run ---

function analyze(tree) {
  const urls = []; // {id, url, normUrl, path, dateAdded, parentId}
  const folders = []; // {id, title, parentId, path, emptyLikely, childrenIds}
  const foldersByParent = new Map(); // parentId -> [{id,title}]
  const emptyFolderIds = new Set();

  walk(tree[0], 0, (n, d, p) => {
    if (n.url) {
      urls.push({
        id: n.id,
        url: n.url,
        key: normUrl(n.url),
        title: n.title,
        path: p.join(" / "),
        dateAdded: n.dateAdded || 0,
        parentId: n.parentId,
      });
    } else {
      const path = [...p, n.title || ""].join(" / ");
      folders.push({
        id: n.id,
        title: n.title || "",
        parentId: n.parentId,
        path,
        children: n.children || [],
      });
      if (n.parentId) {
        if (!foldersByParent.has(n.parentId)) foldersByParent.set(n.parentId, []);
        foldersByParent.get(n.parentId).push({ id: n.id, title: n.title || "" });
      }
    }
  });

  // typo: folders whose title contains a bad token
  const typoHits = [];
  for (const f of folders) {
    for (const [bad, good] of TYPO_FIXES) {
      if (f.title.includes(bad)) {
        typoHits.push({ id: f.id, old: f.title, fixed: f.title.replaceAll(bad, good), path: f.path });
        break;
      }
    }
  }

  // sibling folders with same normalized title (case-insensitive, trimmed)
  const mergeGroups = []; // [{parentId, keeperId, donorIds, title}]
  for (const [parentId, fs] of foldersByParent) {
    const by = new Map();
    for (const f of fs) {
      const k = f.title.trim().toLowerCase();
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(f);
    }
    for (const [k, arr] of by) {
      if (arr.length > 1) {
        mergeGroups.push({
          parentId,
          keeperId: arr[0].id,
          donorIds: arr.slice(1).map(x => x.id),
          title: arr[0].title,
        });
      }
    }
  }

  // dedup: group urls by normalized key, if >1 drop all but deepest-path / oldest
  const dupGroups = new Map();
  for (const u of urls) {
    if (!dupGroups.has(u.key)) dupGroups.set(u.key, []);
    dupGroups.get(u.key).push(u);
  }
  const toDrop = [];
  for (const [k, arr] of dupGroups) {
    if (arr.length > 1) {
      const sorted = [...arr].sort((a, b) => {
        const da = (a.path.match(/\//g) || []).length;
        const db = (b.path.match(/\//g) || []).length;
        if (db !== da) return db - da; // deeper wins
        return a.dateAdded - b.dateAdded; // older wins
      });
      const keeper = sorted[0];
      for (const drop of sorted.slice(1)) {
        toDrop.push({ id: drop.id, url: drop.url, keeperPath: keeper.path, dropPath: drop.path });
      }
    }
  }

  return { urls, folders, typoHits, mergeGroups, toDrop };
}

// --- Esecuzione ---

async function bmRemove(id) {
  return new Promise((res, rej) => chrome.bookmarks.remove(id, () => {
    if (chrome.runtime.lastError) rej(chrome.runtime.lastError); else res();
  }));
}
async function bmRemoveTree(id) {
  return new Promise((res, rej) => chrome.bookmarks.removeTree(id, () => {
    if (chrome.runtime.lastError) rej(chrome.runtime.lastError); else res();
  }));
}
async function bmUpdate(id, changes) {
  return new Promise((res, rej) => chrome.bookmarks.update(id, changes, r => {
    if (chrome.runtime.lastError) rej(chrome.runtime.lastError); else res(r);
  }));
}
async function bmMove(id, dest) {
  return new Promise((res, rej) => chrome.bookmarks.move(id, dest, r => {
    if (chrome.runtime.lastError) rej(chrome.runtime.lastError); else res(r);
  }));
}
async function bmGetChildren(id) {
  return new Promise((res, rej) => chrome.bookmarks.getChildren(id, r => {
    if (chrome.runtime.lastError) rej(chrome.runtime.lastError); else res(r);
  }));
}
async function bmGetTree() {
  return new Promise((res, rej) => chrome.bookmarks.getTree(r => {
    if (chrome.runtime.lastError) rej(chrome.runtime.lastError); else res(r);
  }));
}

async function applyPhase1(plan) {
  let counts = { typos: 0, merges: 0, dups: 0, empties: 0 };

  // 1) Typo fixes
  for (const t of plan.typoHits) {
    try {
      await bmUpdate(t.id, { title: t.fixed });
      counts.typos++;
      log(`  typo: ${t.old} → ${t.fixed}`);
    } catch (e) { log(`  ! typo fail ${t.id}: ${e.message}`); }
  }

  // 2) Merge sibling omonimi: sposta figli del donor nel keeper, poi rimuovi donor (che ora è vuoto)
  for (const m of plan.mergeGroups) {
    for (const donorId of m.donorIds) {
      try {
        const kids = await bmGetChildren(donorId);
        for (const k of kids) {
          await bmMove(k.id, { parentId: m.keeperId });
        }
        await bmRemove(donorId);
        counts.merges++;
        log(`  merge: donor ${donorId} → keeper ${m.keeperId} (${m.title})`);
      } catch (e) { log(`  ! merge fail ${donorId}: ${e.message}`); }
    }
  }

  // 3) Dedup URL: rimuove i duplicati
  for (const d of plan.toDrop) {
    try {
      await bmRemove(d.id);
      counts.dups++;
    } catch (e) { log(`  ! dedup fail ${d.id}: ${e.message}`); }
  }
  log(`  dedup rimossi: ${counts.dups}`);

  // 4) Rimuovi cartelle vuote ricorsivamente (iterate fino a stabilita'). Skippa i root.
  const rootIds = new Set(["0", "1", "2", "3"]);
  let round = 0, removedThisRound;
  do {
    round++;
    removedThisRound = 0;
    const tree = await bmGetTree();
    const empties = [];
    walk(tree[0], 0, (n) => {
      if (!n.url && n.id && !rootIds.has(n.id)) {
        if (!n.children || n.children.length === 0) empties.push({ id: n.id, title: n.title || "" });
      }
    });
    for (const f of empties) {
      try {
        await bmRemove(f.id);
        counts.empties++; removedThisRound++;
        log(`  empty rm: ${f.title} [${f.id}]`);
      } catch (e) { log(`  ! empty fail ${f.id}: ${e.message}`); }
    }
  } while (removedThisRound > 0 && round < 10);

  return counts;
}

btnAnalyze.addEventListener("click", async () => {
  clearLog();
  log("Analisi in corso…");
  const tree = await bmGetTree();
  const plan = analyze(tree);
  window.__plan = plan;
  log(`URL totali: ${plan.urls.length}`);
  log(`Cartelle totali: ${plan.folders.length}`);
  log(`Typo da fixare: ${plan.typoHits.length}`);
  plan.typoHits.forEach(t => log(`  • ${t.path} — "${t.old}" → "${t.fixed}"`));
  log(`Merge sibling omonimi: ${plan.mergeGroups.length} gruppi`);
  plan.mergeGroups.forEach(m => log(`  • parent=${m.parentId} keeper="${m.title}" donor_ids=${m.donorIds.join(",")}`));
  log(`Duplicati URL da rimuovere: ${plan.toDrop.length}`);
  plan.toDrop.slice(0, 20).forEach(d => log(`  • ${d.dropPath} (drop) — keeper: ${d.keeperPath}`));
  if (plan.toDrop.length > 20) log(`  … altri ${plan.toDrop.length - 20}`);
  log("");
  log("Pronto per applicare Fase 1. Clic su bottone rosso.");
  btnPhase1.disabled = false;
});

btnPhase1.addEventListener("click", async () => {
  if (!window.__plan) { log("Esegui analisi prima."); return; }
  btnPhase1.disabled = true;
  log("\n=== APPLICAZIONE FASE 1 ===");
  const counts = await applyPhase1(window.__plan);
  log("\n=== FINITO ===");
  log(`typo: ${counts.typos}  merges: ${counts.merges}  dups: ${counts.dups}  empties: ${counts.empties}`);
  log("Sync Chrome pushera' le modifiche agli altri device.");
});

// ===================== FASE 2 =====================
// Ristrutturazione tassonomica: top-level con prefissi numerici, split cartelle obese,
// archivio Clienti-SAP e Impresa-legacy, unificazione `other` in bar.

const BAR_ROOT_ID = "1";
const OTHER_ROOT_ID = "2";

const TOP_LEVEL = [
  "01 Lavoro", "02 AI", "03 Marketing", "04 Dev",
  "05 Risorse", "06 PA", "07 Personale", "08 Università",
  "09 Inbox", "_Archivio",
];

// cache path segments (under BAR_ROOT_ID) -> id
const folderIdCache = new Map(); // key: "a/b/c" -> id

async function ensurePath(segments) {
  // segments: array of names, under BAR_ROOT_ID
  if (segments.length === 0) return BAR_ROOT_ID;
  let parentId = BAR_ROOT_ID;
  let cumulative = [];
  for (const seg of segments) {
    cumulative.push(seg);
    const key = cumulative.join("");
    if (folderIdCache.has(key)) { parentId = folderIdCache.get(key); continue; }
    const kids = await bmGetChildren(parentId);
    let existing = kids.find(k => !k.url && k.title === seg);
    if (!existing) {
      existing = await new Promise((res, rej) => chrome.bookmarks.create(
        { parentId, title: seg }, r => {
          if (chrome.runtime.lastError) rej(chrome.runtime.lastError); else res(r);
        }));
    }
    folderIdCache.set(key, existing.id);
    parentId = existing.id;
  }
  return parentId;
}

function hostOf(u) { try { return new URL(u).hostname.toLowerCase(); } catch { return ""; } }
function any(s, ...ns) { const x = (s || "").toLowerCase(); return ns.some(n => x.includes(n)); }

function classifyAI(url, title) {
  const h = hostOf(url), t = (title || "").toLowerCase(), u = (url || "").toLowerCase();
  if (any(h, "openai.com", "anthropic.com", "claude.ai", "gemini.google.com", "platform.openai", "aistudio.google", "perplexity.ai", "cohere.com", "mistral.ai")) return ["02 AI", "Providers"];
  if (any(h, "huggingface.co", "replicate.com", "stability.ai", "runwayml.com", "civitai.com")) return ["02 AI", "Modelli"];
  if (any(h, "arxiv.org", "papers.ssrn.com", "semanticscholar.org", "paperswithcode.com")) return ["02 AI", "Paper"];
  if (any(h, "github.com")) return ["02 AI", "GitHub"];
  if (any(t, "prompt") || any(u, "/prompt", "prompt-")) return ["02 AI", "Prompt"];
  return ["02 AI", "Tool"];
}

function classifyMarketing(url, title) {
  const h = hostOf(url), t = (title || "").toLowerCase(), u = (url || "").toLowerCase();
  if (any(h, "analytics.google", "ga4") || any(u, "googletagmanager", "gtm.js") || any(t, "analytics", "ga4")) return ["03 Marketing", "Analytics"];
  if (any(h, "ads.google", "adwords") || any(u, "adwords", "google-ads") || any(t, " ads ", "adwords")) return ["03 Marketing", "Ads"];
  if (any(h, "semrush", "ahrefs", "moz.com", "ubersuggest", "serpapi", "screamingfrog", "seozoom") || any(t, "seo", "serp")) return ["03 Marketing", "SEO"];
  if (any(h, "mailchimp", "brevo", "sendgrid", "klaviyo", "sendinblue", "mailjet", "mailerlite", "activecampaign") || any(t, "email")) return ["03 Marketing", "Email"];
  if (any(h, "instagram.com", "tiktok.com", "linkedin.com", "pinterest.com", "facebook.com", "fb.com", "meta.com", "youtube.com")) return ["03 Marketing", "Social"];
  return ["03 Marketing", "Generale"];
}

function classifyG(url, title) {
  const h = hostOf(url);
  if (h.includes("analytics.google")) return ["03 Marketing", "Analytics"];
  if (h.includes("ads.google") || h.includes("adwords")) return ["03 Marketing", "Ads"];
  if (h.includes("search.google") || h.includes("searchconsole")) return ["03 Marketing", "SEO"];
  if (h.includes("gemini.google") || h.includes("aistudio.google") || h.includes("notebooklm")) return ["02 AI", "Providers"];
  if (h.includes("cloud.google")) return ["01 Lavoro", "Cloud", "GCP"];
  if (h.includes("docs.google")) return ["04 Dev", "Google-Tools", "Docs"];
  if (h.includes("drive.google")) return ["04 Dev", "Google-Tools", "Drive"];
  if (h.includes("sheets.google")) return ["04 Dev", "Google-Tools", "Sheets"];
  if (h.includes("developers.google") || h.includes("codelabs")) return ["04 Dev", "Google-Tools", "Dev"];
  if (h.includes("mail.google") || h.includes("gmail")) return ["04 Dev", "Google-Tools", "Mail"];
  return ["04 Dev", "Google-Tools", "Altro"];
}

function classifyToCheck(url, title) {
  const h = hostOf(url);
  if (h.includes("github.com")) return ["04 Dev", "GitHub"];
  if (any(h, "openai.com", "anthropic.com", "claude.ai", "gemini.google", "aistudio.google", "perplexity.ai")) return ["02 AI", "Providers"];
  if (h.includes("arxiv.org")) return ["02 AI", "Paper"];
  if (h.includes("huggingface")) return ["02 AI", "Modelli"];
  return ["09 Inbox"];
}

// Definizione azioni Fase 2. src identifica cartella per path relativo a root Chrome.
// op = "move" (sposta e rinomina), "merge" (sposta figli nel target, elimina source),
//      "classify" (classifica ogni figlio URL con classifier, rimuove source dopo)
//      "moveChildren" (sposta figli come-sono nel target, mantiene source se ha sub-folder scolaro)
const FASE2_OPS = [
  // --- bar ---
  { src: { rootId: BAR_ROOT_ID, name: "Pubblica amm" }, op: "merge", target: ["06 PA"] },
  { src: { rootId: BAR_ROOT_ID, name: "Anthropic" }, op: "move", target: ["02 AI", "Providers", "Anthropic"] },
  { src: { rootId: BAR_ROOT_ID, name: "marketing" }, op: "classify", classifier: classifyMarketing, removeAfter: true },
  { src: { rootId: BAR_ROOT_ID, name: "fb" }, op: "move", target: ["03 Marketing", "Social", "fb"] },
  { src: { rootId: BAR_ROOT_ID, name: "G" }, op: "classify", classifier: classifyG, removeAfter: true },
  { src: { rootId: BAR_ROOT_ID, name: "AI" }, op: "classify", classifier: classifyAI, removeAfter: true, preserveChildFolder: "scuola", preserveTarget: ["08 Università", "scuola"] },
  { src: { rootId: BAR_ROOT_ID, name: "Corsi" }, op: "move", target: ["07 Personale", "Corsi"] },
  { src: { rootId: BAR_ROOT_ID, name: "inv" }, op: "move", target: ["07 Personale", "Investimenti"] },
  { src: { rootId: BAR_ROOT_ID, name: "BigCommerce" }, op: "move", target: ["01 Lavoro", "E-commerce", "BigCommerce"] },
  { src: { rootId: BAR_ROOT_ID, name: "Shopify" }, op: "move", target: ["01 Lavoro", "E-commerce", "Shopify"] },
  { src: { rootId: BAR_ROOT_ID, name: "Sylius" }, op: "move", target: ["01 Lavoro", "E-commerce", "Sylius"] },
  { src: { rootId: BAR_ROOT_ID, name: "prestashop" }, op: "move", target: ["01 Lavoro", "E-commerce", "prestashop"] },
  { src: { rootId: BAR_ROOT_ID, name: "Server" }, op: "move", target: ["01 Lavoro", "Server"] },
  { src: { rootId: BAR_ROOT_ID, name: "Radio" }, op: "move", target: ["07 Personale", "Radio"] },
  { src: { rootId: BAR_ROOT_ID, name: "BPM" }, op: "move", target: ["07 Personale", "BPM"] },
  { src: { rootId: BAR_ROOT_ID, name: "Ethereum" }, op: "move", target: ["01 Lavoro", "Cloud", "Ethereum"] },
  { src: { rootId: BAR_ROOT_ID, name: "Camper" }, op: "move", target: ["07 Personale", "Camper"] },
  { src: { rootId: BAR_ROOT_ID, name: "aws" }, op: "move", target: ["01 Lavoro", "Cloud", "aws"] },
  { src: { rootId: BAR_ROOT_ID, name: "JS" }, op: "move", target: ["04 Dev", "JS"] },

  // --- other ---
  { src: { rootId: OTHER_ROOT_ID, name: "Impresa" }, op: "move", target: ["_Archivio", "Impresa-legacy"] },
  { src: { rootId: OTHER_ROOT_ID, name: "Tool web" }, op: "move", target: ["04 Dev", "Tool-web"] },
  { src: { rootId: OTHER_ROOT_ID, name: "Progetti web" }, op: "move", target: ["04 Dev", "Progetti-web"] },
  { src: { rootId: OTHER_ROOT_ID, name: "Risorse" }, op: "merge", target: ["05 Risorse"] },
  { src: { rootId: OTHER_ROOT_ID, name: "0 - ToCheck" }, op: "classify", classifier: classifyToCheck, removeAfter: true },
  { src: { rootId: OTHER_ROOT_ID, name: "OpenData" }, op: "merge", target: ["06 PA", "OpenData"] },
  { src: { rootId: OTHER_ROOT_ID, name: "Universita" }, op: "merge", target: ["08 Università"] },
  { src: { rootId: OTHER_ROOT_ID, name: "Clienti" }, op: "move", target: ["_Archivio", "Clienti-SAP-legacy"] },
  { src: { rootId: OTHER_ROOT_ID, name: "Plesk" }, op: "move", target: ["01 Lavoro", "Server", "Plesk"] },
  { src: { rootId: OTHER_ROOT_ID, name: "Negozi di Maglioni di Lana" }, op: "move", target: ["07 Personale", "Shopping"] },
];

async function findDirectChild(parentId, title) {
  const kids = await bmGetChildren(parentId);
  return kids.find(k => !k.url && k.title === title);
}

async function analyzePhase2() {
  clearLog();
  log("=== ANALISI FASE 2 ===");
  const tree = await bmGetTree();
  log(`Albero letto.`);

  // URL sparsi al root bar/other
  const barChildren = await bmGetChildren(BAR_ROOT_ID);
  const otherChildren = await bmGetChildren(OTHER_ROOT_ID);
  const strayBar = barChildren.filter(c => c.url);
  const strayOther = otherChildren.filter(c => c.url);
  log(`URL sparsi root bar: ${strayBar.length} → 09 Inbox`);
  log(`URL sparsi root other: ${strayOther.length} → 09 Inbox`);

  const foundOps = [];
  const missingOps = [];
  for (const opDef of FASE2_OPS) {
    const f = await findDirectChild(opDef.src.rootId, opDef.src.name);
    if (f) {
      foundOps.push({ ...opDef, sourceId: f.id });
    } else {
      missingOps.push(opDef);
    }
  }
  log(`\nOp mapping cartelle: ${foundOps.length} trovate / ${missingOps.length} mancanti`);
  if (missingOps.length) {
    missingOps.forEach(m => log(`  (skip, non trovata) ${m.src.name}`));
  }
  log(`\nTop-level da creare se mancanti: ${TOP_LEVEL.join(", ")}`);

  log(`\nClassificazioni URL preview:`);
  const previewSamples = {};
  for (const op of foundOps.filter(o => o.op === "classify")) {
    const kids = await bmGetChildren(op.sourceId);
    const urlKids = kids.filter(k => k.url);
    const buckets = {};
    for (const u of urlKids) {
      const segs = op.classifier(u.url, u.title);
      const key = segs.join("/");
      buckets[key] = (buckets[key] || 0) + 1;
    }
    log(`  [${op.src.name}] ${urlKids.length} URL:`);
    Object.entries(buckets).sort((a,b)=>b[1]-a[1]).forEach(([k,n]) => log(`    ${n.toString().padStart(4)} → ${k}`));
    previewSamples[op.src.name] = { total: urlKids.length, buckets };
  }

  window.__fase2plan = { foundOps, strayBar, strayOther };
  log(`\nPronto per applicare. Clic su bottone rosso "4. Applica Fase 2".`);
  btnPhase2.disabled = false;
}

async function buildPhase2Plan() {
  const barChildren = await bmGetChildren(BAR_ROOT_ID);
  const otherChildren = await bmGetChildren(OTHER_ROOT_ID);
  const strayBar = barChildren.filter(c => c.url);
  const strayOther = otherChildren.filter(c => c.url);
  const foundOps = [];
  for (const opDef of FASE2_OPS) {
    const f = await findDirectChild(opDef.src.rootId, opDef.src.name);
    if (f) foundOps.push({ ...opDef, sourceId: f.id });
  }
  return { foundOps, strayBar, strayOther };
}

async function applyPhase2() {
  btnPhase2.disabled = true;
  folderIdCache.clear();
  log("\n=== APPLICAZIONE FASE 2 ===");
  if (!window.__fase2plan) {
    log("(ricostruisco piano, popup era stato chiuso)");
    window.__fase2plan = await buildPhase2Plan();
  }

  // 1. Assicura top-level
  log("Creo top-level…");
  for (const tl of TOP_LEVEL) {
    await ensurePath([tl]);
  }

  // 2. Esegui ogni op
  const { foundOps, strayBar, strayOther } = window.__fase2plan;
  let stats = { moved: 0, merged: 0, classified: 0, folderRemoved: 0 };

  for (const op of foundOps) {
    try {
      if (op.op === "move") {
        // creo target path tranne l'ultimo segmento; sposto la cartella source come ultimo figlio rinominato
        const parentSegs = op.target.slice(0, -1);
        const newName = op.target[op.target.length - 1];
        const parentId = await ensurePath(parentSegs);
        await bmMove(op.sourceId, { parentId });
        await bmUpdate(op.sourceId, { title: newName });
        stats.moved++;
        log(`  move: ${op.src.name} → ${op.target.join("/")}`);
      } else if (op.op === "merge") {
        // sposta tutti i figli di source nel target path, poi elimina source (se vuoto)
        const targetId = await ensurePath(op.target);
        const kids = await bmGetChildren(op.sourceId);
        for (const k of kids) await bmMove(k.id, { parentId: targetId });
        // rimuove source se vuoto
        const remaining = await bmGetChildren(op.sourceId);
        if (remaining.length === 0) {
          await bmRemove(op.sourceId);
          stats.folderRemoved++;
        }
        stats.merged++;
        log(`  merge: ${op.src.name} → ${op.target.join("/")} (${kids.length} figli)`);
      } else if (op.op === "classify") {
        const kids = await bmGetChildren(op.sourceId);
        let countMoved = 0;
        for (const k of kids) {
          if (k.url) {
            const segs = op.classifier(k.url, k.title);
            const tid = await ensurePath(segs);
            await bmMove(k.id, { parentId: tid });
            countMoved++;
          } else {
            // sottocartella: se preserveChildFolder match, spostala
            if (op.preserveChildFolder && k.title === op.preserveChildFolder) {
              const parentSegs = op.preserveTarget.slice(0, -1);
              const newName = op.preserveTarget[op.preserveTarget.length - 1];
              const pid = await ensurePath(parentSegs);
              await bmMove(k.id, { parentId: pid });
              await bmUpdate(k.id, { title: newName });
            } else {
              // sottocartella non prevista → Inbox
              const pid = await ensurePath(["09 Inbox"]);
              await bmMove(k.id, { parentId: pid });
              log(`    sub-folder non prevista "${k.title}" → 09 Inbox`);
            }
          }
        }
        stats.classified += countMoved;
        log(`  classify: ${op.src.name} → ${countMoved} URL smistati`);
        if (op.removeAfter) {
          const remaining = await bmGetChildren(op.sourceId);
          if (remaining.length === 0) {
            await bmRemove(op.sourceId);
            stats.folderRemoved++;
          } else {
            log(`    source "${op.src.name}" non rimosso (ha ancora ${remaining.length} figli)`);
          }
        }
      }
    } catch (e) {
      log(`  ! errore op ${op.src.name}: ${e.message}`);
    }
  }

  // 3. URL sparsi root → 09 Inbox
  const inboxId = await ensurePath(["09 Inbox"]);
  for (const s of [...strayBar, ...strayOther]) {
    try { await bmMove(s.id, { parentId: inboxId }); } catch (e) { log(`  ! stray ${s.id}: ${e.message}`); }
  }
  log(`  stray: ${strayBar.length + strayOther.length} URL root → 09 Inbox`);

  log(`\n=== FATTO ===`);
  log(`moved=${stats.moved} merged=${stats.merged} classified=${stats.classified} folderRemoved=${stats.folderRemoved}`);
  log(`Sync pusha le modifiche su telefono/tablet/altri PC entro qualche minuto.`);
}

document.getElementById("btn-analyze2").addEventListener("click", analyzePhase2);
document.getElementById("btn-phase2").addEventListener("click", applyPhase2);

// ===================== CONSOLIDA AI + GOOGLE =====================
// Raccoglie tutti gli URL *.google.com in 04 Dev/Google-Tools (flat) e
// appiattisce 02 AI e 04 Dev/Google-Tools rimuovendo sottocartelle.

function isGoogleHost(h) {
  if (!h) return false;
  // esclude domini non-google di proprieta' google ambigui (tieni largo: gmail.com, blogger.com, youtube.com NO — li escludiamo)
  return h === "google.com" || h.endsWith(".google.com")
      || h === "google.it" || h.endsWith(".google.it");
}

async function flattenInto(folderId, targetId) {
  // Sposta tutti gli URL discendenti in targetId, rimuove sottocartelle vuote.
  const kids = await bmGetChildren(folderId);
  let moved = 0;
  for (const k of kids) {
    if (k.url) {
      if (k.parentId !== targetId) {
        try { await bmMove(k.id, { parentId: targetId }); moved++; }
        catch (e) { log(`  ! move ${k.id}: ${e.message}`); }
      }
    } else {
      moved += await flattenInto(k.id, targetId);
      const rem = await bmGetChildren(k.id);
      if (rem.length === 0) {
        try { await bmRemove(k.id); } catch (e) { log(`  ! rm ${k.id}: ${e.message}`); }
      }
    }
  }
  return moved;
}

async function consolidateAIGoogle() {
  clearLog();
  folderIdCache.clear();
  log("=== CONSOLIDA AI + GOOGLE ===");

  const aiId = await ensurePath(["02 AI"]);
  const gId = await ensurePath(["04 Dev", "Google-Tools"]);
  log(`Target AI id=${aiId}  Google-Tools id=${gId}`);

  // 1) Raccolta Google URL da tutto l'albero sotto bar (escluso target stesso)
  const tree = await bmGetTree();
  const barNode = tree[0].children.find(c => c.id === BAR_ROOT_ID);
  const googleUrls = [];
  function walkCollectGoogle(n) {
    if (n.url) {
      if (isGoogleHost(hostOf(n.url)) && n.parentId !== gId) {
        googleUrls.push(n);
      }
      return;
    }
    for (const c of (n.children || [])) walkCollectGoogle(c);
  }
  walkCollectGoogle(barNode);
  log(`URL *.google.com trovati fuori target: ${googleUrls.length}`);

  let gMoved = 0;
  for (const u of googleUrls) {
    try { await bmMove(u.id, { parentId: gId }); gMoved++; }
    catch (e) { log(`  ! google move ${u.id}: ${e.message}`); }
  }
  log(`Google spostati: ${gMoved}`);

  // 2) Flatten 04 Dev/Google-Tools (le sue sottocartelle spariscono)
  const gFlat = await flattenInto(gId, gId);
  log(`Google-Tools flattened: ${gFlat} URL dai sub → flat`);

  // 3) Flatten 02 AI (tutte le sottocartelle: Tool, Providers, Modelli, Paper, Prompt, GitHub, Anthropic)
  const aiFlat = await flattenInto(aiId, aiId);
  log(`02 AI flattened: ${aiFlat} URL dai sub → flat`);

  const gFinal = (await bmGetChildren(gId)).filter(k => k.url).length;
  const aiFinal = (await bmGetChildren(aiId)).filter(k => k.url).length;
  log(`\n=== FATTO ===`);
  log(`02 AI: ${aiFinal} URL flat`);
  log(`04 Dev/Google-Tools: ${gFinal} URL flat`);
  log(`Sync pusha su altri device.`);
}

document.getElementById("btn-consolidate").addEventListener("click", consolidateAIGoogle);

btnClear.addEventListener("click", clearLog);
