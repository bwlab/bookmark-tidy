// Applica chrome.i18n a elementi marcati data-i18n / data-i18n-title / data-i18n-placeholder.
function t(key, subs) { return chrome.i18n.getMessage(key, subs) || key; }

function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
}
document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  applyI18n();
});
