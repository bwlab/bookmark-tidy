// Anti-FOUC: applica tema salvato prima che il body renderizzi.
(function () {
  try {
    const t = localStorage.getItem("bwlab-theme") || "dark";
    document.documentElement.dataset.theme = t;
  } catch (e) {
    document.documentElement.dataset.theme = "dark";
  }
})();
