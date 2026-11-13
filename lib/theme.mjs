export const themeKey = "vestiquay.theme";

export const themeBootstrap = `(() => {
  let saved;
  try { saved = localStorage.getItem("${themeKey}"); } catch {}
  document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
})();`;
