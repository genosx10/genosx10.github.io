/* =========================
   Caché en localStorage
========================= */
/* =========================
   Caché en localStorage (namespaced)
========================= */
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 6; // 6h
const CACHE_PREFIX = "matches_cache_v2::";   // bump versión para no reutilizar v1

function canUseLocalStorage() {
  try {
    localStorage.setItem("__test__", "1");
    localStorage.removeItem("__test__");
    return true;
  } catch {
    return false;
  }
}

function getCacheKey(baseDir) {
  // baseDir suele ser /football/data/<liga>/csv
  return CACHE_PREFIX + (baseDir || "unknown");
}

function saveCache(rows, baseDir) {
  if (!canUseLocalStorage()) return;
  try {
    const payload = { ts: Date.now(), rows, baseDir };
    localStorage.setItem(getCacheKey(baseDir), JSON.stringify(payload));
  } catch {}
}

function loadCache(baseDir) {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(getCacheKey(baseDir));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    // Seguridad: comprueba que la caché es de este baseDir
    if (!obj || !Array.isArray(obj.rows) || obj.baseDir !== baseDir) return null;
    return obj;
  } catch {
    return null;
  }
}

// (Opcional) Borrar solo la caché de un baseDir
function clearCache(baseDir) {
  if (!canUseLocalStorage()) return;
  try { localStorage.removeItem(getCacheKey(baseDir)); } catch {}
}

// (Opcional legacy) borrar todas las v1 para evitar basura anterior
(function clearLegacy() {
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("laliga_matches_v1")) localStorage.removeItem(k);
    });
  } catch {}
})();
