/* =========================
   Estado global + helpers
========================= */

// Estado compartido
window.__SOURCE_ROWS__ = [];
window.__FILTERED_ROWS__ = [];
window.__PAGE__ = 1;
window.__PAGE_SIZE__ = 10;
window.__SORT__ = { col: "multi", asc: true };
window.__WIRED__ = false;
window.__ROUND__ = null;
// Evita FOUC: lanzamos boot() tras window.load
function boot() {
  window.__PAGE_SIZE__ = resolvePageSize();
  const { baseDir } = resolvePageDataConfig();

  // Define el archivo JSON principal según la liga
  let jsonFile = "";
  if (baseDir.includes("laliga2")) {
    jsonFile = "/football/data/laliga2/matches_laliga2.json";
  } else {
    jsonFile = "/football/data/laliga/matches_laliga.json";
  }

  const loading = document.getElementById("loading");
  function setLoading(msg, isError) {
    if (!loading) return;
    loading.innerHTML = isError
      ? '<span class="text-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i>' +
        msg +
        "</span>"
      : '<span class="text-muted">' + msg + "</span>";
  }

  if (!jsonFile) {
    setLoading("No se pudo resolver el fichero de datos.", true);
    return;
  }

  setLoading("Cargando calendario…", false);

  // Carga el JSON principal
  loadJSON(jsonFile)
    .then((data) => {
      window.__SOURCE_ROWS__ = Array.isArray(data) ? data : [];
      ensureWired();
      hideLoading();
      showExportAdvise();

      window.__SORT__ = { col: "multi", asc: true };
      const hoyTs = dateStamp(todayYMD());
      const jActual = detectCurrentJornada(window.__SOURCE_ROWS__, hoyTs);
      window.__PAGE__ = pageForJornada(
        window.__SOURCE_ROWS__,
        jActual,
        window.__PAGE_SIZE__
      );
      render();
      generateRounds();
      selectRound();
    })
    .catch(() => {
      setLoading("No se pudo cargar el calendario.", true);
    });

  function hideLoading() {
    if (loading) loading.classList.add("d-none");
  }
  function showExportAdvise() {
    const el = document.getElementById("exportAdvise");
    if (el) el.classList.remove("d-none");
  }
}

// Asegura que los event handlers están conectados una sola vez
window.ensureWired = function ensureWired() {
  if (!window.__WIRED__) {
    if (
      typeof wireFilters !== "function" ||
      typeof wireSorting !== "function"
    ) {
      console.error(
        "[init] Missing wireFilters/wireSorting. Check /football/js/events.js load order."
      );
      return;
    }
    wireFilters();
    wireSorting();
    window.__WIRED__ = true;
  }
};

/* =========================
   Resolución de origen de datos
========================= */

// Lee de <main id="app" data-data-dir="..." data-max-weeks="...">
function configFromDom() {
  const el = document.querySelector("#app[data-data-dir]");
  if (!el) return null;
  const baseDir = el.dataset.dataDir || "";
  const maxWeeks = parseInt(el.dataset.maxWeeks || "38", 10);
  if (!baseDir) return null;
  return { baseDir, maxWeeks };
}

// Infiera desde la URL: /football/<liga>/matches/... -> /football/data/<liga>/csv
function inferFromPath(pathname = location.pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length >= 3 && parts[0] === "football" && parts[2] === "matches") {
    const league = parts[1];
    return { baseDir: `/football/data/${league}/csv`, maxWeeks: 38 };
  }
  return null;
}

function resolvePageDataConfig() {
  if (window.APP_CONFIG?.baseDir) {
    return {
      baseDir: window.APP_CONFIG.baseDir,
      maxWeeks: window.APP_CONFIG.maxWeeks || 38,
    };
  }
  return configFromDom() || inferFromPath() || { baseDir: "", maxWeeks: 0 };
}

function buildWeekFiles(baseDir, maxWeeks) {
  const files = [];
  for (let w = 1; w <= maxWeeks; w++) {
    files.push(`${baseDir}/matches_week_${w}.csv`);
  }
  return files;
}
// Determina PAGE_SIZE según la URL o data attributes
function resolvePageSize(pathname = location.pathname) {
  // Prioridad 1: atributo en DOM, si lo quieres forzar desde HTML
  const el = document.querySelector("#app[data-page-size]");
  if (el && el.dataset.pageSize) {
    const n = parseInt(el.dataset.pageSize, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }

  // Prioridad 2: inferir por ruta /football/<liga>/matches.html
  const parts = pathname.split("/").filter(Boolean);
  if (
    parts.length >= 3 &&
    parts[0] === "football" &&
    parts[2].startsWith("matches")
  ) {
    const league = parts[1];
    const sizes = {
      laliga: 10,
      laliga2: 11,
      // añade más ligas si las necesitas
    };
    return sizes[league] ?? 10;
  }

  // Fallback
  return 10;
}

/* =========================
   Arranque controlado
========================= */

if (document.readyState === "complete") {
  boot();
} else {
  // ejecuta cuando TODO (incluidas CSS) está cargado → menos FOUC y medidas coherentes
  window.addEventListener("load", boot, { once: true });
}
