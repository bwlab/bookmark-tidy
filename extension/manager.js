// Bookmark Manager bwlab — pagina custom (override chrome://bookmarks).

const el = {
  search: document.getElementById("search"),
  tree: document.getElementById("tree"),
  list: document.getElementById("list"),
  breadcrumb: document.getElementById("breadcrumb"),
  count: document.getElementById("count"),
  meta: document.getElementById("meta"),
  sort: document.getElementById("sort"),
  presets: document.querySelectorAll(".preset"),
  dialog: document.getElementById("dialog"),
  dialogMsg: document.getElementById("dialog-msg"),
  dialogInput: document.getElementById("dialog-input"),
  dialogOk: document.getElementById("dialog-ok"),
  dialogCancel: document.getElementById("dialog-cancel"),
};

const state = {
  tree: null,
  flat: [],                  // {id,title,url,path,pathIds,parentId,dateAdded,unmodifiable}
  byId: new Map(),           // id -> item di flat
  folders: new Map(),        // id -> {node, count, path}
  rootIds: new Set(["0"]),   // super-root + figli diretti (Barra, Altri, Mobile, eventuali root account)
  barId: "1",                // Barra preferiti (ricalcolata in loadTree)
  selectedFolderId: null,
  selectedItemId: null,
  query: "",
  sort: "manual",
  preset: null,
  expanded: new Set(),
};

// ---- Chrome API wrappers ----
const bm = {
  tree:     ()               => new Promise(r => chrome.bookmarks.getTree(r)),
  children: (id)             => new Promise(r => chrome.bookmarks.getChildren(id, r)),
  move:     (id, d)          => new Promise((res, rej) => chrome.bookmarks.move(id, d,
                                  x => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(x))),
  update:   (id, c)          => new Promise((res, rej) => chrome.bookmarks.update(id, c,
                                  x => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(x))),
  remove:   (id)             => new Promise((res, rej) => chrome.bookmarks.remove(id,
                                  () => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res())),
  removeTree: (id)           => new Promise((res, rej) => chrome.bookmarks.removeTree(id,
                                  () => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res())),
  create:   (args)           => new Promise((res, rej) => chrome.bookmarks.create(args,
                                  x => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(x))),
};

// Root (figli di "0") e nodi gestiti da policy (unmodifiable) non si rinominano/spostano/eliminano.
function isProtected(node) { return state.rootIds.has(node.id) || !!node.unmodifiable; }

// Esegue una mutazione, mostra eventuali errori e ricarica l'albero.
async function mutate(fn) {
  try { await fn(); }
  catch (err) { await ui.alert(t("errorPrefix") + err.message); }
  await refresh();
}

// ---- dialog (sostituisce prompt/confirm/alert nativi) ----
function openDialog({ message, input = false, defaultValue = "", alertOnly = false, danger = false }) {
  return new Promise(resolve => {
    el.dialogMsg.textContent = message;
    el.dialogInput.hidden = !input;
    el.dialogInput.value = defaultValue;
    el.dialogCancel.hidden = alertOnly;
    el.dialogOk.classList.toggle("danger", danger);
    el.dialog.returnValue = "";
    el.dialog.addEventListener("close", () => {
      const ok = el.dialog.returnValue === "ok";
      resolve(input ? (ok ? el.dialogInput.value : null) : ok);
    }, { once: true });
    el.dialog.showModal();
    if (input) { el.dialogInput.focus(); el.dialogInput.select(); }
    else el.dialogOk.focus();
  });
}
const ui = {
  prompt:  (message, defaultValue) => openDialog({ message, input: true, defaultValue }),
  confirm: (message, danger = true) => openDialog({ message, danger }),
  alert:   (message) => openDialog({ message, alertOnly: true }),
};
el.dialogCancel.addEventListener("click", () => el.dialog.close("cancel"));

// ---- drag&drop interno ----
// MIME custom: drag esterni (link/testo da altre pagine) non vengono accettati come drop.
const DND_TYPE = "application/x-bookmark-tidy-ids";
function setDragIds(e, ids) {
  e.dataTransfer.setData(DND_TYPE, JSON.stringify(ids));
  e.dataTransfer.effectAllowed = "move";
}
function isInternalDrag(e) { return e.dataTransfer.types.includes(DND_TYPE); }
async function dropInto(parentId, e) {
  let ids = [];
  try { ids = JSON.parse(e.dataTransfer.getData(DND_TYPE) || "[]"); } catch { return; }
  await mutate(async () => {
    for (const id of ids) {
      if (id !== parentId) await bm.move(id, { parentId });
    }
  });
}

// ---- utils ----
function hostOf(u) { try { return new URL(u).hostname; } catch { return ""; } }
// Favicon dalla cache locale di Chrome (permesso "favicon"): nessuna richiesta di rete.
function faviconUrl(u) {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", u);
  url.searchParams.set("size", "32");
  return url.toString();
}
function formatDate(ms) {
  if (!ms) return "";
  const diff = (Date.now() - Number(ms)) / 86400000;
  if (diff < 1) return t("dateToday");
  if (diff < 2) return t("dateYesterday");
  if (diff < 7) return `${Math.floor(diff)}${t("dateUnitDay")}`;
  if (diff < 30) return `${Math.floor(diff/7)}${t("dateUnitWeek")}`;
  if (diff < 365) return `${Math.floor(diff/30)}${t("dateUnitMonth")}`;
  return `${Math.floor(diff/365)}${t("dateUnitYear")}`;
}
// Formatter creato una volta: toLocale*String per riga costa ~0.2ms (lento su migliaia di item).
let dateFullFmt;
function formatDateFull(ms) {
  if (!ms) return "";
  dateFullFmt ??= new Intl.DateTimeFormat(chrome.i18n.getUILanguage(),
    { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return dateFullFmt.format(new Date(Number(ms)));
}
// "N preferiti" con la forma plurale giusta per la lingua (Intl.PluralRules):
// chiavi <base>Singular/<base>Plural, piu' <base>Few/<base>Many opzionali (es. russo: 2 закладки, 5 закладок).
let pluralRules;
function countLabel(n, base) {
  pluralRules ??= new Intl.PluralRules(chrome.i18n.getUILanguage());
  const suffix = { one: "Singular", few: "Few", many: "Many" }[pluralRules.select(n)] || "Plural";
  const word = chrome.i18n.getMessage(base + suffix) || t(base + (n === 1 ? "Singular" : "Plural"));
  return `${n} ${word}`;
}
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
// Match sul testo grezzo, escape per segmento: le entity (&amp; ...) non vengono spezzate da <mark>.
function highlight(text, query) {
  const tokens = (query || "").split(/\s+/).filter(Boolean)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!tokens.length) return escapeHtml(text);
  const re = new RegExp("(" + tokens.join("|") + ")", "gi");
  return String(text).split(re)
    .map((part, i) => i % 2 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part))
    .join("");
}

// ---- data ----
async function loadTree() {
  const t = await bm.tree();
  state.tree = t[0];
  state.flat = [];
  state.byId.clear();
  state.folders.clear();
  const roots = state.tree.children || [];
  state.rootIds = new Set(["0", ...roots.map(r => r.id)]);
  // Chrome recenti: folderType + syncing distinguono Barra locale/account; fallback primo root (id "1").
  const bars = roots.filter(r => r.folderType === "bookmarks-bar");
  state.barId = (bars.find(r => r.syncing) || bars[0] || roots[0])?.id || "1";
  buildIndex(state.tree, [], []);
}

function buildIndex(node, path, pathIds) {
  if (node.url) {
    const it = {
      id: node.id, title: node.title || "", url: node.url,
      path, pathIds, parentId: node.parentId, dateAdded: node.dateAdded || 0,
      unmodifiable: node.unmodifiable,
    };
    state.flat.push(it);
    state.byId.set(it.id, it);
    return 1;
  }
  const p = node.id === "0" ? [] : [...path, node.title || ""];
  const pids = node.id === "0" ? [] : [...pathIds, node.id];
  let count = 0;
  for (const c of node.children || []) count += buildIndex(c, p, pids);
  state.folders.set(node.id, { node, count, path: p });
  return count;
}

function getItems() {
  if (state.query) {
    const q = state.query.toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    return state.flat.filter(x => {
      const hay = (x.title + " " + x.url + " " + x.path.join(" ")).toLowerCase();
      return tokens.every(t => hay.includes(t));
    });
  }
  if (state.preset === "all") return state.flat.slice();
  if (state.preset === "recent") {
    const cutoff = Date.now() - 30 * 86400000;
    return state.flat.filter(x => Number(x.dateAdded) > cutoff)
      .sort((a,b) => Number(b.dateAdded) - Number(a.dateAdded));
  }
  if (state.preset === "oldest") {
    return state.flat.slice().sort((a,b) => Number(a.dateAdded) - Number(b.dateAdded)).slice(0, 100);
  }
  if (state.preset === "stray") {
    return state.flat.filter(x => state.rootIds.has(x.parentId));
  }
  return state.flat.filter(x => x.parentId === state.selectedFolderId);
}

function sortItems(items) {
  if (state.preset === "recent" || state.preset === "oldest") return items;
  const s = state.sort;
  if (s === "title")     return items.slice().sort((a,b) => a.title.localeCompare(b.title, chrome.i18n.getUILanguage()));
  if (s === "date-desc") return items.slice().sort((a,b) => Number(b.dateAdded) - Number(a.dateAdded));
  if (s === "date-asc")  return items.slice().sort((a,b) => Number(a.dateAdded) - Number(b.dateAdded));
  if (s === "domain")    return items.slice().sort((a,b) => hostOf(a.url).localeCompare(hostOf(b.url)));
  return items;
}

// ---- azioni cartella (condivise da sidebar e folder row) ----
async function newSubfolder(parentId, promptKey = "folderNewNamePrompt") {
  const name = (await ui.prompt(t(promptKey)))?.trim();
  if (!name) return;
  state.expanded.add(parentId);
  await mutate(() => bm.create({ parentId, title: name }));
}

async function renameNode(node, promptKey) {
  const nv = await ui.prompt(t(promptKey), node.title);
  if (nv === null || nv === node.title) return;
  await mutate(() => bm.update(node.id, { title: nv }));
}

async function deleteFolder(node) {
  const fi = state.folders.get(node.id);
  const count = fi ? fi.count : 0;
  const subFolders = (node.children || []).filter(c => !c.url).length;
  const msg = count > 0 || subFolders > 0
    ? t("folderDeleteConfirmFull", [node.title, String(count), String(subFolders)])
    : t("folderDeleteConfirmEmpty", [node.title]);
  if (!(await ui.confirm(msg))) return;
  await mutate(() => bm.removeTree(node.id));
}

// ---- rendering: sidebar tree ----
function renderTree() {
  el.tree.innerHTML = "";
  for (const r of state.tree.children || []) renderNode(r, el.tree);
}

function renderNode(node, parent) {
  if (node.url) return;
  const row = document.createElement("div");
  row.className = "node";
  row.dataset.id = node.id;
  if (state.selectedFolderId === node.id && !state.preset && !state.query) row.classList.add("active");
  const hasSubFolders = (node.children || []).some(c => !c.url);
  const isExpanded = state.expanded.has(node.id);
  const fi = state.folders.get(node.id);
  const count = fi ? fi.count : 0;
  const locked = isProtected(node);

  const twisty = document.createElement("span");
  twisty.className = "twisty " + (hasSubFolders ? (isExpanded ? "expanded" : "collapsed") : "leaf");
  const icon = document.createElement("span");
  icon.className = "folder-icon";
  icon.textContent = hasSubFolders && isExpanded ? "📂" : "📁";
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = node.title || t("rootNodeLabel");
  const cnt = document.createElement("span");
  cnt.className = "count";
  cnt.textContent = count;
  const actions = document.createElement("span");
  actions.className = "folder-actions";
  if (!node.unmodifiable) {
    actions.innerHTML = `<button class="folder-act" data-fact="new" title="${t("newSubfolderTitle")}">+</button>`;
  }
  if (!locked) {
    actions.innerHTML += `
      <button class="folder-act" data-fact="rename" title="${t("renameTitleAttr")}">✎</button>
      <button class="folder-act danger" data-fact="delete" title="${t("deleteTitleAttr")}">✕</button>
    `;
  }

  row.appendChild(twisty); row.appendChild(icon); row.appendChild(label); row.appendChild(cnt); row.appendChild(actions);
  parent.appendChild(row);

  // folder drag to reparent (no-op per root)
  if (!locked) {
    row.draggable = true;
    row.addEventListener("dragstart", (e) => {
      e.stopPropagation();
      setDragIds(e, [node.id]);
    });
  }

  // folder actions
  actions.querySelector("[data-fact=new]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    newSubfolder(node.id);
  });
  actions.querySelector("[data-fact=rename]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    renameNode(node, "folderRenamePrompt");
  });
  actions.querySelector("[data-fact=delete]")?.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteFolder(node);
  });

  twisty.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!hasSubFolders) return;
    state.expanded.has(node.id) ? state.expanded.delete(node.id) : state.expanded.add(node.id);
    renderTree();
  });
  row.addEventListener("click", () => selectFolder(node.id));

  row.addEventListener("dragover", (e) => {
    if (!isInternalDrag(e)) return;
    e.preventDefault(); row.classList.add("drop-target");
  });
  row.addEventListener("dragleave", () => row.classList.remove("drop-target"));
  row.addEventListener("drop", (e) => {
    e.preventDefault();
    row.classList.remove("drop-target");
    dropInto(node.id, e);
  });

  if (isExpanded && hasSubFolders) {
    const sub = document.createElement("div");
    sub.className = "subtree";
    parent.appendChild(sub);
    for (const c of node.children) renderNode(c, sub);
  }
}

// ---- rendering: list ----
function getSubFolders() {
  if (state.query || state.preset) return [];
  const fi = state.folders.get(state.selectedFolderId);
  if (!fi) return [];
  return (fi.node.children || []).filter(c => !c.url);
}

function renderList() {
  const subfolders = getSubFolders();
  let items = sortItems(getItems());
  renderBreadcrumb();

  if (subfolders.length > 0 && state.sort === "title") {
    subfolders.sort((a,b) => (a.title||"").localeCompare(b.title||"", chrome.i18n.getUILanguage()));
  }

  const totalTxt = [];
  if (subfolders.length) totalTxt.push(countLabel(subfolders.length, "subfolderCount"));
  totalTxt.push(countLabel(items.length, "itemsCount"));
  el.count.textContent = totalTxt.join(" · ");

  if (!items.length && !subfolders.length) {
    el.list.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = state.query ? t("noResultsFor", [state.query]) : t("emptyFolder");
    el.list.appendChild(empty);
    return;
  }

  // Una sola stringa HTML + listener delegati su #list (vedi "list events"): scala a migliaia di item.
  const html = subfolders.map(folderRowHtml);
  for (const it of items) html.push(itemRowHtml(it));
  el.list.innerHTML = html.join("");

  // mantiene la selezione tra un refresh e l'altro
  if (state.selectedItemId) {
    el.list.querySelector(`.item[data-id="${CSS.escape(state.selectedItemId)}"]`)?.classList.add("selected");
  }
}

function itemRowHtml(it) {
  const showPath = state.query || state.preset;
  const isJsUrl = /^javascript:/i.test(it.url);
  const safeHref = isJsUrl ? "#" : escapeHtml(it.url);
  const editActions = it.unmodifiable ? "" : `
        <button class="act" data-act="rename" title="${t("renameShortcutTitle")}">✎</button>
        <button class="act" data-act="move" title="${t("moveToTitle")}">→</button>
        <button class="act danger" data-act="delete" title="${t("deleteShortcutTitle")}">✕</button>`;
  return `
    <li class="item" data-id="${escapeHtml(it.id)}" draggable="${!it.unmodifiable}">
      <img class="favicon" src="${faviconUrl(it.url)}" alt="" loading="lazy">
      <div class="main">
        <a class="title${isJsUrl ? ' jsurl' : ''}" href="${safeHref}" title="${escapeHtml(it.url)}" data-url="${escapeHtml(it.url)}">${highlight(it.title || it.url, state.query)}${isJsUrl ? ` <span class="folder-chip">${t("bookmarkletChip")}</span>` : ''}</a>
        <div class="subline">
          <span class="domain">${escapeHtml(hostOf(it.url))}</span>
          <span class="dot">·</span>
          <span class="date" title="${formatDateFull(it.dateAdded)}">${formatDate(it.dateAdded)}</span>
          ${showPath && it.path.length ? `<span class="dot">·</span><span class="folder-chip">📁 ${escapeHtml(it.path.join(" / "))}</span>` : ""}
        </div>
      </div>
      <div class="actions">
        <button class="act" data-act="newtab" title="${t("openNewTabTitle")}">↗</button>
        <button class="act" data-act="copy" title="${t("copyUrlTitle")}">⎘</button>${editActions}
      </div>
    </li>`;
}

function folderRowHtml(f) {
  const locked = isProtected(f);
  const fi = state.folders.get(f.id);
  const count = fi ? fi.count : 0;
  const subFolders = (f.children || []).filter(c => !c.url).length;
  const subInfo = [];
  if (count) subInfo.push(countLabel(count, "itemsCount"));
  if (subFolders) subInfo.push(countLabel(subFolders, "subfolderCount"));
  const actions = locked ? "" : `
      <button class="act" data-fact="rename" title="${t("renameShortcutTitle")}">✎</button>
      <button class="act danger" data-fact="delete" title="${t("deleteShortcutTitle")}">✕</button>`;
  return `
    <li class="item folder-row" data-id="${escapeHtml(f.id)}" draggable="${!locked}">
      <span class="favicon folder-big-icon">📁</span>
      <div class="main">
        <a class="title folder-title" href="#">${escapeHtml(f.title || t("noNameFolder"))}</a>
        <div class="subline">
          <span class="date">${subInfo.join(" · ") || t("emptyFolderLabel")}</span>
        </div>
      </div>
      <div class="actions">${actions}</div>
    </li>`;
}

// ---- list events (delegati) ----
el.list.addEventListener("click", (e) => {
  const li = e.target.closest(".item");
  if (!li) return;
  const id = li.dataset.id;

  if (li.classList.contains("folder-row")) {
    const node = state.folders.get(id)?.node;
    if (!node) return;
    const fact = e.target.closest("[data-fact]")?.dataset.fact;
    if (fact === "rename") renameNode(node, "folderRenamePrompt");
    else if (fact === "delete") deleteFolder(node);
    else if (!e.target.closest(".actions")) { e.preventDefault(); selectFolder(id); }
    return;
  }

  const it = state.byId.get(id);
  if (!it) return;
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (act) { itemAction(act, li, it); return; }
  if (e.target.closest(".actions")) return;
  selectItem(li, it);
  if (e.target.closest("a.title") && /^javascript:/i.test(it.url)) {
    e.preventDefault();
    ui.alert(t("bookmarkletAlert"));
  }
});

el.list.addEventListener("dblclick", (e) => {
  const li = e.target.closest(".item:not(.folder-row)");
  if (!li || e.target.closest(".actions")) return;
  const it = state.byId.get(li.dataset.id);
  if (it && !/^javascript:/i.test(it.url)) window.location.href = it.url;
});

el.list.addEventListener("dragstart", (e) => {
  const li = e.target.closest(".item");
  if (li && li.draggable) setDragIds(e, [li.dataset.id]);
});

// drop solo su folder row (accetta item/cartelle dentro)
el.list.addEventListener("dragover", (e) => {
  const row = e.target.closest(".folder-row");
  if (!row || !isInternalDrag(e)) return;
  e.preventDefault(); row.classList.add("drop-target");
});
el.list.addEventListener("dragleave", (e) => {
  const row = e.target.closest(".folder-row");
  if (row && !row.contains(e.relatedTarget)) row.classList.remove("drop-target");
});
el.list.addEventListener("drop", (e) => {
  const row = e.target.closest(".folder-row");
  if (!row) return;
  e.preventDefault();
  row.classList.remove("drop-target");
  dropInto(row.dataset.id, e);
});

async function itemAction(act, li, it) {
  if (act === "newtab") {
    chrome.tabs.create({ url: it.url, active: false });
  } else if (act === "copy") {
    await navigator.clipboard.writeText(it.url);
    flash(li, t("urlCopiedFlash"));
  } else if (act === "rename") {
    await renameNode(it, "renameTitlePrompt");
  } else if (act === "move") {
    const path = await ui.prompt(t("moveToPrompt"), it.path.join("/"));
    if (!path) return;
    await mutate(async () => {
      const segs = path.split("/").map(s => s.trim()).filter(Boolean);
      // Il path proposto parte dal nome della root (es. "Barra dei preferiti/...", come it.path):
      // se il primo segmento e' una root si parte da li', altrimenti path relativo alla Barra.
      const roots = await bm.children("0");
      const root = roots.find(r => r.title === segs[0]);
      let pid = state.barId;
      if (root) { pid = root.id; segs.shift(); }
      for (const seg of segs) {
        const kids = await bm.children(pid);
        let f = kids.find(k => !k.url && k.title === seg);
        if (!f) f = await bm.create({ parentId: pid, title: seg });
        pid = f.id;
      }
      await bm.move(it.id, { parentId: pid });
    });
  } else if (act === "delete") {
    if (await ui.confirm(t("itemDeleteConfirm", [it.title || it.url]))) {
      await mutate(() => bm.remove(it.id));
    }
  }
}

function flash(li, msg) {
  const chip = document.createElement("span");
  chip.className = "folder-chip";
  chip.style.background = "var(--state-success)"; chip.style.color = "#fff";
  chip.textContent = msg;
  li.querySelector(".subline").appendChild(chip);
  setTimeout(() => chip.remove(), 1500);
}

function selectItem(li, it) {
  document.querySelectorAll(".item.selected").forEach(x => x.classList.remove("selected"));
  li.classList.add("selected");
  state.selectedItemId = it.id;
}

// ---- breadcrumb ----
function renderBreadcrumb() {
  el.breadcrumb.innerHTML = "";
  if (state.query) {
    el.breadcrumb.textContent = t("searchResultsFor", [state.query]);
    return;
  }
  if (state.preset) {
    const labels = { all: "presetAll", recent: "presetRecent", oldest: "presetOldest", stray: "presetStray" };
    el.breadcrumb.textContent = `⚑ ${t(labels[state.preset])}`;
    return;
  }
  const fi = state.folders.get(state.selectedFolderId);
  if (!fi) return;
  const ancestors = [];
  let cur = fi.node;
  while (cur) {
    ancestors.unshift(cur);
    cur = cur.parentId ? state.folders.get(cur.parentId)?.node : null;
  }
  ancestors.forEach((a, i) => {
    if (i > 0) {
      const s = document.createElement("span"); s.className = "sep"; s.textContent = "›";
      el.breadcrumb.appendChild(s);
    }
    const c = document.createElement("span");
    c.className = "crumb" + (i === ancestors.length - 1 ? " current" : "");
    c.textContent = a.title || t("bookmarksRootLabel");
    c.addEventListener("click", () => selectFolder(a.id));
    el.breadcrumb.appendChild(c);
  });
}

function updateMeta() {
  el.meta.textContent = t("metaSummary", [String(state.flat.length), String(state.folders.size)]);
}

// ---- selection actions ----
function selectFolder(id) {
  state.selectedFolderId = id;
  state.selectedItemId = null;
  state.preset = null;
  state.query = "";
  el.search.value = "";
  state.expanded.add(id);
  let p = state.folders.get(id)?.node?.parentId;
  while (p) { state.expanded.add(p); p = state.folders.get(p)?.node?.parentId; }
  el.presets.forEach(b => b.classList.remove("active"));
  renderTree();
  renderList();
}

function selectPreset(name) {
  state.preset = name;
  state.query = "";
  el.search.value = "";
  state.selectedFolderId = null;
  state.selectedItemId = null;
  el.presets.forEach(b => b.classList.toggle("active", b.dataset.preset === name));
  document.querySelectorAll(".node.active").forEach(n => n.classList.remove("active"));
  renderList();
}

// ---- refresh ----
async function refresh() {
  await loadTree();
  // cartella selezionata eliminata (anche da altro device via sync) → torna alla Barra
  if (!state.preset && !state.query && !state.folders.has(state.selectedFolderId)) {
    state.selectedFolderId = state.barId;
  }
  renderTree();
  renderList();
  updateMeta();
}

// ---- keyboard ----
document.addEventListener("keydown", (e) => {
  if (el.dialog.open) return;  // il dialog gestisce Enter/Esc da se'
  const isInput = e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";
  if (isInput) {
    if (e.key === "Escape") {
      el.search.value = ""; state.query = ""; renderList(); el.search.blur();
    }
    return;
  }
  if (e.key === "/") { e.preventDefault(); el.search.focus(); return; }
  if (e.key === "Escape") { selectFolder(state.barId); return; }

  const items = [...el.list.querySelectorAll(".item")];
  if (!items.length) return;
  const curIdx = items.findIndex(i => i.classList.contains("selected"));

  if (e.key === "ArrowDown") {
    e.preventDefault();
    const idx = curIdx < 0 ? 0 : Math.min(items.length - 1, curIdx + 1);
    items.forEach(i => i.classList.remove("selected"));
    items[idx].classList.add("selected");
    items[idx].scrollIntoView({ block: "nearest" });
    state.selectedItemId = items[idx].dataset.id;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    const idx = curIdx < 0 ? 0 : Math.max(0, curIdx - 1);
    items.forEach(i => i.classList.remove("selected"));
    items[idx].classList.add("selected");
    items[idx].scrollIntoView({ block: "nearest" });
    state.selectedItemId = items[idx].dataset.id;
  } else if (e.key === "Enter") {
    const sel = el.list.querySelector(".item.selected");
    if (!sel) return;
    if (sel.classList.contains("folder-row")) { selectFolder(sel.dataset.id); return; }
    const url = sel.querySelector(".title").dataset.url;
    if (/^javascript:/i.test(url)) { ui.alert(t("bookmarkletAlert")); return; }
    if (e.ctrlKey || e.metaKey) chrome.tabs.create({ url, active: false });
    else window.location.href = url;
  } else if (e.key === "Delete") {
    const sel = el.list.querySelector(".item.selected");
    sel?.querySelector("[data-act=delete], [data-fact=delete]")?.click();
  } else if (e.key.toLowerCase() === "e" && !e.ctrlKey && !e.metaKey) {
    const sel = el.list.querySelector(".item.selected");
    sel?.querySelector("[data-act=rename], [data-fact=rename]")?.click();
  }
});

// ---- search input ----
el.search.addEventListener("input", debounce((e) => {
  state.query = e.target.value.trim();
  if (state.query) {
    state.preset = null; state.selectedFolderId = null;
    el.presets.forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".node.active").forEach(n => n.classList.remove("active"));
  }
  renderList();
}, 120));

// ---- sort ----
el.sort.addEventListener("change", (e) => { state.sort = e.target.value; renderList(); });

// ---- presets ----
el.presets.forEach(b => b.addEventListener("click", () => selectPreset(b.dataset.preset)));

// ---- listen bookmark changes for auto-refresh ----
const debouncedRefresh = debounce(refresh, 400);
["onCreated", "onRemoved", "onChanged", "onMoved", "onChildrenReordered"]
  .forEach(ev => chrome.bookmarks[ev] && chrome.bookmarks[ev].addListener(debouncedRefresh));

// ---- theme toggle ----
document.getElementById("theme-toggle")?.addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const next = cur === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("bwlab-theme", next); } catch {}
});

// ---- bottone nuova cartella root ----
document.getElementById("new-root-folder")?.addEventListener("click", (e) => {
  e.stopPropagation();
  newSubfolder(state.barId, "rootFolderPrompt");
});

// ---- init ----
(async () => {
  await loadTree();
  state.selectedFolderId = state.barId;
  state.rootIds.forEach(id => state.expanded.add(id));
  renderTree();
  renderList();
  updateMeta();
})();
