/* =========================
   Caché en localStorage
========================= */
const CACHE_KEY = "laliga_matches_v1";
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 6;

function canUseLocalStorage() {
  try {
    localStorage.setItem("__test__", "1");
    localStorage.removeItem("__test__");
    return true;
  } catch {
    return false;
  }
}

function saveCache(rows) {
  if (!canUseLocalStorage()) return;
  localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), rows }));
}

function loadCache() {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !Array.isArray(obj.rows)) return null;
    return obj;
  } catch {
    return null;
  }
}

function clearCache() {
  if (canUseLocalStorage()) localStorage.removeItem(CACHE_KEY);
}
