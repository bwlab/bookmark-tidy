// Bookmark Manager bwlab — pagina custom (override chrome://bookmarks).

const BAR_ROOT_ID = "1";

const el = {
  search: document.getElementById("search"),
  tree: document.getElementById("tree"),
  list: document.getElementById("list"),
  breadcrumb: document.getElementById("breadcrumb"),
  count: document.getElementById("count"),
  meta: document.getElementById("meta"),
  sort: document.getElementById("sort"),
  presets: document.querySelectorAll(".preset"),
};

const state = {
  tree: null,
  flat: [],                  // {id,title,url,path,pathIds,parentId,dateAdded}
  folders: new Map(),        // id -> {node, count, path}
  selectedFolderId: BAR_ROOT_ID,
  selectedItemId: null,
  query: "",
  sort: "manual",
  preset: null,
  expanded: new Set(["1", "2", "3"]),
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

const ROOT_IDS = new Set(["0", "1", "2", "3"]); // non toccare

// ---- utils ----
function hostOf(u) { try { return new URL(u).hostname; } catch { return ""; } }
function faviconUrl(u) {
  try {
    const h = new URL(u).hostname;
    return `https://www.google.com/s2/favicons?sz=64&domain=${h}`;
  } catch { return ""; }
}
function formatDate(ms) {
  if (!ms) return "";
  const diff = (Date.now() - Number(ms)) / 86400000;
  if (diff < 1) return "oggi";
  if (diff < 2) return "ieri";
  if (diff < 7) return `${Math.floor(diff)}g`;
  if (diff < 30) return `${Math.floor(diff/7)}set`;
  if (diff < 365) return `${Math.floor(diff/30)}mes`;
  return `${Math.floor(diff/365)}ann`;
}
function formatDateFull(ms) {
  if (!ms) return "";
  const d = new Date(Number(ms));
  return d.toLocaleDateString("it-IT") + " " + d.toLocaleTimeString("it-IT", {hour:"2-digit",minute:"2-digit"});
}
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function highlight(text, query) {
  if (!query) return escapeHtml(text);
  const tokens = query.split(/\s+/).filter(Boolean);
  let html = escapeHtml(text);
  for (const t of tokens) {
    const re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
    html = html.replace(re, "<mark>$1</mark>");
  }
  return html;
}

// ---- data ----
async function loadTree() {
  const t = await bm.tree();
  state.tree = t[0];
  state.flat = [];
  state.folders.clear();
  buildIndex(state.tree, [], []);
}

function buildIndex(node, path, pathIds) {
  if (node.url) {
    state.flat.push({
      id: node.id, title: node.title || "", url: node.url,
      path, pathIds, parentId: node.parentId, dateAdded: node.dateAdded || 0,
    });
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
    return state.flat.filter(x => x.parentId === "1" || x.parentId === "2");
  }
  return state.flat.filter(x => x.parentId === state.selectedFolderId);
}

function sortItems(items) {
  if (state.preset === "recent" || state.preset === "oldest") return items;
  const s = state.sort;
  if (s === "title")     return items.slice().sort((a,b) => a.title.localeCompare(b.title,"it"));
  if (s === "date-desc") return items.slice().sort((a,b) => Number(b.dateAdded) - Number(a.dateAdded));
  if (s === "date-asc")  return items.slice().sort((a,b) => Number(a.dateAdded) - Number(b.dateAdded));
  if (s === "domain")    return items.slice().sort((a,b) => hostOf(a.url).localeCompare(hostOf(b.url)));
  return items;
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

  const twisty = document.createElement("span");
  twisty.className = "twisty " + (hasSubFolders ? (isExpanded ? "expanded" : "collapsed") : "leaf");
  const icon = document.createElement("span");
  icon.className = "folder-icon";
  icon.textContent = hasSubFolders && isExpanded ? "📂" : "📁";
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = node.title || "(root)";
  const cnt = document.createElement("span");
  cnt.className = "count";
  cnt.textContent = count;
  const actions = document.createElement("span");
  actions.className = "folder-actions";
  if (!ROOT_IDS.has(node.id)) {
    actions.innerHTML = `
      <button class="folder-act" data-fact="new" title="Nuova sotto-cartella">+</button>
      <button class="folder-act" data-fact="rename" title="Rinomina">✎</button>
      <button class="folder-act danger" data-fact="delete" title="Elimina">✕</button>
    `;
  } else {
    actions.innerHTML = `<button class="folder-act" data-fact="new" title="Nuova sotto-cartella">+</button>`;
  }

  row.appendChild(twisty); row.appendChild(icon); row.appendChild(label); row.appendChild(cnt); row.appendChild(actions);
  parent.appendChild(row);

  // folder drag to reparent (no-op per root)
  if (!ROOT_IDS.has(node.id)) {
    row.draggable = true;
    row.addEventListener("dragstart", (e) => {
      e.stopPropagation();
      e.dataTransfer.setData("text/plain", JSON.stringify([node.id]));
      e.dataTransfer.effectAllowed = "move";
    });
  }

  // folder actions
  actions.querySelector("[data-fact=new]")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    const name = prompt("Nome nuova sotto-cartella:");
    if (!name) return;
    await bm.create({ parentId: node.id, title: name });
    state.expanded.add(node.id);
    await refresh();
  });
  actions.querySelector("[data-fact=rename]")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    const nv = prompt("Nuovo nome cartella:", node.title);
    if (nv !== null && nv !== node.title) { await bm.update(node.id, { title: nv }); await refresh(); }
  });
  actions.querySelector("[data-fact=delete]")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    const fi = state.folders.get(node.id);
    const count = fi ? fi.count : 0;
    const msg = count > 0
      ? `Eliminare "${node.title}" e ${count} preferiti dentro? Irreversibile.`
      : `Eliminare cartella vuota "${node.title}"?`;
    if (!confirm(msg)) return;
    try {
      await bm.removeTree(node.id);
      if (state.selectedFolderId === node.id) selectFolder(BAR_ROOT_ID);
      else await refresh();
    } catch (err) { alert("Errore: " + err.message); }
  });

  twisty.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!hasSubFolders) return;
    state.expanded.has(node.id) ? state.expanded.delete(node.id) : state.expanded.add(node.id);
    renderTree();
  });
  row.addEventListener("click", () => selectFolder(node.id));

  row.addEventListener("dragover", (e) => { e.preventDefault(); row.classList.add("drop-target"); });
  row.addEventListener("dragleave", () => row.classList.remove("drop-target"));
  row.addEventListener("drop", async (e) => {
    e.preventDefault();
    row.classList.remove("drop-target");
    const ids = JSON.parse(e.dataTransfer.getData("text/plain") || "[]");
    for (const id of ids) {
      try { await bm.move(id, { parentId: node.id }); } catch (err) { console.error(err); }
    }
    await refresh();
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
  el.list.innerHTML = "";
  const subfolders = getSubFolders();
  let items = sortItems(getItems());
  renderBreadcrumb();

  if (subfolders.length > 0 && state.sort === "title") {
    subfolders.sort((a,b) => (a.title||"").localeCompare(b.title||"","it"));
  }

  const totalTxt = [];
  if (subfolders.length) totalTxt.push(`${subfolders.length} ${subfolders.length === 1 ? "cartella" : "cartelle"}`);
  totalTxt.push(`${items.length} ${items.length === 1 ? "preferito" : "preferiti"}`);
  el.count.textContent = totalTxt.join(" · ");

  if (!items.length && !subfolders.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = state.query ? `Nessun risultato per "${state.query}"` : "Cartella vuota";
    el.list.appendChild(empty);
    return;
  }

  const showPath = state.query || state.preset;
  const frag = document.createDocumentFragment();

  // render sotto-cartelle prima
  for (const f of subfolders) frag.appendChild(buildFolderRow(f));

  for (const it of items) {
    const li = document.createElement("li");
    li.className = "item";
    li.dataset.id = it.id;
    li.draggable = true;
    const isJsUrl = /^javascript:/i.test(it.url);
    const safeHref = isJsUrl ? "#" : escapeHtml(it.url);
    li.innerHTML = `
      <img class="favicon" src="${faviconUrl(it.url)}" alt="" referrerpolicy="no-referrer">
      <div class="main">
        <a class="title${isJsUrl ? ' jsurl' : ''}" href="${safeHref}" title="${escapeHtml(it.url)}" data-url="${escapeHtml(it.url)}">${highlight(it.title || it.url, state.query)}${isJsUrl ? ' <span class="folder-chip">bookmarklet</span>' : ''}</a>
        <div class="subline">
          <span class="domain">${escapeHtml(hostOf(it.url))}</span>
          <span class="dot">·</span>
          <span class="date" title="${formatDateFull(it.dateAdded)}">${formatDate(it.dateAdded)}</span>
          ${showPath && it.path.length ? `<span class="dot">·</span><span class="folder-chip">📁 ${escapeHtml(it.path.join(" / "))}</span>` : ""}
        </div>
      </div>
      <div class="actions">
        <button class="act" data-act="newtab" title="Apri in nuova tab">↗</button>
        <button class="act" data-act="copy" title="Copia URL">⎘</button>
        <button class="act" data-act="rename" title="Rinomina (E)">✎</button>
        <button class="act" data-act="move" title="Sposta in...">→</button>
        <button class="act danger" data-act="delete" title="Elimina (Del)">✕</button>
      </div>
    `;
    bindItemEvents(li, it);
    const img = li.querySelector("img.favicon");
    if (img) img.addEventListener("error", () => { img.style.opacity = 0.3; });
    frag.appendChild(li);
  }
  el.list.appendChild(frag);
}

function buildFolderRow(f) {
  const li = document.createElement("li");
  li.className = "item folder-row";
  li.dataset.id = f.id;
  li.draggable = !ROOT_IDS.has(f.id);
  const fi = state.folders.get(f.id);
  const count = fi ? fi.count : 0;
  const subFolders = (f.children || []).filter(c => !c.url).length;
  const subInfo = [];
  if (count) subInfo.push(`${count} ${count === 1 ? "preferito" : "preferiti"}`);
  if (subFolders) subInfo.push(`${subFolders} ${subFolders === 1 ? "sotto-cartella" : "sotto-cartelle"}`);
  li.innerHTML = `
    <span class="favicon folder-big-icon">📁</span>
    <div class="main">
      <a class="title folder-title" href="#" data-folder-id="${f.id}">${escapeHtml(f.title || "(senza nome)")}</a>
      <div class="subline">
        <span class="date">${subInfo.join(" · ") || "vuota"}</span>
      </div>
    </div>
    <div class="actions">
      <button class="act" data-fact="rename" title="Rinomina (E)">✎</button>
      <button class="act danger" data-fact="delete" title="Elimina (Del)">✕</button>
    </div>
  `;
  // apri al click
  li.addEventListener("click", (e) => {
    if (e.target.closest(".actions")) return;
    e.preventDefault();
    selectFolder(f.id);
  });
  // drag folder
  if (!ROOT_IDS.has(f.id)) {
    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", JSON.stringify([f.id]));
      e.dataTransfer.effectAllowed = "move";
    });
  }
  // drop (accetta item/cartelle dentro)
  li.addEventListener("dragover", (e) => { e.preventDefault(); li.classList.add("drop-target"); });
  li.addEventListener("dragleave", () => li.classList.remove("drop-target"));
  li.addEventListener("drop", async (e) => {
    e.preventDefault();
    li.classList.remove("drop-target");
    const ids = JSON.parse(e.dataTransfer.getData("text/plain") || "[]");
    for (const id of ids) {
      try { await bm.move(id, { parentId: f.id }); } catch (err) { console.error(err); }
    }
    await refresh();
  });
  // rename / delete
  li.querySelector("[data-fact=rename]").addEventListener("click", async (e) => {
    e.stopPropagation();
    const nv = prompt("Nuovo nome cartella:", f.title);
    if (nv !== null && nv !== f.title) { await bm.update(f.id, { title: nv }); await refresh(); }
  });
  li.querySelector("[data-fact=delete]").addEventListener("click", async (e) => {
    e.stopPropagation();
    const msg = count > 0 || subFolders > 0
      ? `Eliminare "${f.title}" e ${count} preferiti + ${subFolders} sotto-cartelle? Irreversibile.`
      : `Eliminare cartella vuota "${f.title}"?`;
    if (!confirm(msg)) return;
    try { await bm.removeTree(f.id); await refresh(); }
    catch (err) { alert("Errore: " + err.message); }
  });
  return li;
}

function bindItemEvents(li, it) {
  const titleLink = li.querySelector(".title");
  const isJsUrl = /^javascript:/i.test(it.url);
  titleLink.addEventListener("click", (e) => {
    selectItem(li, it);
    if (isJsUrl) {
      e.preventDefault();
      alert("Bookmarklet (javascript:URL) non eseguibile da qui per motivi di sicurezza CSP. Copia URL e incolla nella barra indirizzi.");
    }
  });
  li.addEventListener("click", (e) => {
    if (e.target.closest(".actions") || e.target.closest("a")) return;
    selectItem(li, it);
  });
  li.addEventListener("dblclick", (e) => {
    if (e.target.closest(".actions")) return;
    if (isJsUrl) return;
    window.location.href = it.url;
  });
  li.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", JSON.stringify([it.id]));
    e.dataTransfer.effectAllowed = "move";
  });

  li.querySelector("[data-act=newtab]").addEventListener("click", (e) => {
    e.stopPropagation();
    chrome.tabs.create({ url: it.url, active: false });
  });
  li.querySelector("[data-act=copy]").addEventListener("click", async (e) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(it.url);
    flash(li, "URL copiato");
  });
  li.querySelector("[data-act=rename]").addEventListener("click", async (e) => {
    e.stopPropagation();
    const nv = prompt("Nuovo titolo:", it.title);
    if (nv !== null && nv !== it.title) { await bm.update(it.id, { title: nv }); await refresh(); }
  });
  li.querySelector("[data-act=move]").addEventListener("click", async (e) => {
    e.stopPropagation();
    const path = prompt("Sposta in (path tipo '01 Lavoro/Server', separato da /):", it.path.join("/"));
    if (!path) return;
    const segs = path.split("/").map(s => s.trim()).filter(Boolean);
    let pid = BAR_ROOT_ID;
    for (const seg of segs) {
      const kids = await bm.children(pid);
      let f = kids.find(k => !k.url && k.title === seg);
      if (!f) f = await bm.create({ parentId: pid, title: seg });
      pid = f.id;
    }
    await bm.move(it.id, { parentId: pid });
    await refresh();
  });
  li.querySelector("[data-act=delete]").addEventListener("click", async (e) => {
    e.stopPropagation();
    if (confirm(`Eliminare "${it.title || it.url}" ?`)) {
      await bm.remove(it.id); await refresh();
    }
  });
}

function flash(li, msg) {
  const chip = document.createElement("span");
  chip.className = "folder-chip";
  chip.style.background = "var(--ok)"; chip.style.color = "#fff";
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
    el.breadcrumb.textContent = `🔍 Risultati per "${state.query}"`;
    return;
  }
  if (state.preset) {
    const labels = { all: "Tutti", recent: "Recenti 30gg", oldest: "Piu' vecchi 100", stray: "Senza cartella" };
    el.breadcrumb.textContent = `⚑ ${labels[state.preset]}`;
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
    c.textContent = a.title || "Preferiti";
    c.addEventListener("click", () => selectFolder(a.id));
    el.breadcrumb.appendChild(c);
  });
}

function updateMeta() {
  el.meta.textContent = `${state.flat.length} URL · ${state.folders.size} cartelle`;
}

// ---- selection actions ----
function selectFolder(id) {
  state.selectedFolderId = id;
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
  el.presets.forEach(b => b.classList.toggle("active", b.dataset.preset === name));
  document.querySelectorAll(".node.active").forEach(n => n.classList.remove("active"));
  renderList();
}

// ---- refresh ----
async function refresh() {
  await loadTree();
  renderTree();
  renderList();
  updateMeta();
}

// ---- keyboard ----
document.addEventListener("keydown", (e) => {
  const isInput = e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA";
  if (isInput) {
    if (e.key === "Escape") {
      el.search.value = ""; state.query = ""; renderList(); el.search.blur();
    }
    return;
  }
  if (e.key === "/") { e.preventDefault(); el.search.focus(); return; }
  if (e.key === "Escape") { selectFolder(BAR_ROOT_ID); return; }

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
    if (sel) {
      const a = sel.querySelector(".title");
      if (e.ctrlKey || e.metaKey) chrome.tabs.create({ url: a.href, active: false });
      else window.location.href = a.href;
    }
  } else if (e.key === "Delete") {
    const sel = el.list.querySelector(".item.selected");
    sel?.querySelector("[data-act=delete]").click();
  } else if (e.key.toLowerCase() === "e" && !e.ctrlKey && !e.metaKey) {
    const sel = el.list.querySelector(".item.selected");
    sel?.querySelector("[data-act=rename]").click();
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
document.getElementById("new-root-folder")?.addEventListener("click", async (e) => {
  e.stopPropagation();
  const name = prompt("Nome nuova cartella (sotto Barra preferiti):");
  if (!name) return;
  await bm.create({ parentId: BAR_ROOT_ID, title: name });
  state.expanded.add(BAR_ROOT_ID);
  await refresh();
});

// ---- init ----
refresh();
