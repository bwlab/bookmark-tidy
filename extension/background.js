// Apre manager.html su click icona o shortcut Alt+Shift+B. Una sola tab riutilizzata se gia' aperta.

const MANAGER_URL = chrome.runtime.getURL("manager.html");

// Il manager puo' essere aperto come chrome-extension://.../manager.html oppure come
// chrome://bookmarks (override): entrambe le forme contano come "gia' aperto".
function isManagerTab(tab) {
  const u = tab.url || tab.pendingUrl || "";
  return u.startsWith(MANAGER_URL) || u.startsWith("chrome://bookmarks");
}

async function openManager() {
  try {
    const tab = (await chrome.tabs.query({})).find(isManagerTab);
    if (tab) {
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      return;
    }
  } catch (err) {
    console.warn("Bookmark Tidy: tab manager non riutilizzabile", err);
  }
  await chrome.tabs.create({ url: MANAGER_URL });
}

chrome.action.onClicked.addListener(() => { openManager(); });

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "open-manager") openManager();
});
