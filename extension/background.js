// Apre manager.html su shortcut Alt+Shift+B. Una sola tab riutilizzata se gia' aperta.

async function openManager() {
  const url = chrome.runtime.getURL("manager.html");
  const tabs = await chrome.tabs.query({ url });
  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
}

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "open-manager") openManager();
});
