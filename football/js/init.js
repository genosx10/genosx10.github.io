/* =========================
   Inicialización (semanas)
========================= */

// init.js (al principio del archivo)
window.__SOURCE_ROWS__ = [];
window.__FILTERED_ROWS__ = [];
window.__PAGE__ = 1;
window.__PAGE_SIZE__ = 10;
window.__SORT__ = { col: "multi", asc: true };
window.__WIRED__ = false;

// Asegura que wireFilters() y wireSorting() existan (events.js debe haberse cargado antes)
window.ensureWired = function ensureWired() {
  if (!window.__WIRED__) {
    if (typeof wireFilters !== "function" || typeof wireSorting !== "function") {
      console.error("Faltan wireFilters o wireSorting. ¿Se cargó /football/js/events.js antes?");
      return;
    }
    wireFilters();
    wireSorting();
    window.__WIRED__ = true;
  }
};

(function init() {
  // Ajusta si cambias la ruta en tu build
  var MAX_WEEKS = 38;

  // Genera la lista de ficheros por jornada
  var files = [];
  for (var w = 1; w <= MAX_WEEKS; w++) {
    files.push("/football/data/laliga/csv/matches_week_" + w + ".csv");
  }

  var loading = document.getElementById("loading");
  function setLoading(msg, isError) {
    if (!loading) return;
    loading.innerHTML = isError
      ? '<span class="text-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i>' +
        msg +
        "</span>"
      : '<span class="text-muted">' + msg + "</span>";
  }
  // 🔹 Intentar servir desde caché
  var cached = loadCache();
  var haveFreshCache =
    cached &&
    typeof cached.ts === "number" &&
    Date.now() - cached.ts < CACHE_MAX_AGE_MS;

  if (haveFreshCache && Array.isArray(cached.rows) && cached.rows.length) {
    __SOURCE_ROWS__ = cached.rows.slice(); // ya normalizados
    ensureWired();

    if (loading) loading.classList.add("d-none");
    document.getElementById("exportAdvise").classList.remove("d-none");

    __SORT__ = { col: "multi", asc: true };

    var hoyYMD = todayYMD();
    var hoyTs = dateStamp(hoyYMD);
    var jActual = detectCurrentJornada(__SOURCE_ROWS__, hoyTs);
    __PAGE__ = pageForJornada(__SOURCE_ROWS__, jActual, __PAGE_SIZE__);

    render();

    generateRounds();
  selectRound();

    // Opcional: muestra que se está refrescando en segundo plano
    setLoading("Actualizando datos…", false);
  } else {
    setLoading("Cargando calendario…", false);
  }

  var i = 0;
  var loaded = 0;
  function next() {
    if (i >= files.length) return afterLoad();
    var url = files[i];
    setLoading(
      "Cargando " + url + " … (" + (i + 1) + "/" + files.length + ")",
      false
    );

    loadCSV(url)
      .then(function (data) {
        // Si el archivo existe pero viene vacío, lo ignoramos igualmente
        if (Array.isArray(data) && data.length) {
          __SOURCE_ROWS__ = __SOURCE_ROWS__.concat(data);
          loaded++;
        }
        i++;
        next();
      })
      .catch(function () {
        // 404 u otros errores: omitimos y continuamos
        i++;
        next();
      });
  }

  function afterLoad() {
    if (loaded === 0) {
      setLoading("No se encontró ningún matches_week_*.csv", true);
      return;
    }

    // Deduplicado ligero por si en el futuro se mezclan fuentes
    var seen = new Set();
    var unique = [];
    for (var k = 0; k < __SOURCE_ROWS__.length; k++) {
      var m = __SOURCE_ROWS__[k];
      var key =
        (m.Jornada || "") +
        "|" +
        (m.FechaISO || "") +
        "|" +
        (m.Local || "") +
        "|" +
        (m.Visitante || "");
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(m);
    }
    __SOURCE_ROWS__ = unique;

    // 🔹 Guardar en caché (deduplicado ya aplicado)
    saveCache(__SOURCE_ROWS__);

    ensureWired();

    if (loading) loading.classList.add("d-none");
    document.getElementById("exportAdvise").classList.remove("d-none");

    // =========================
    // Mantener lógica de jornada/página por defecto
    // =========================
    __SORT__ = { col: "multi", asc: true };

    var hoyYMD = todayYMD();
    var hoyTs = dateStamp(hoyYMD);
    var jActual = detectCurrentJornada(__SOURCE_ROWS__, hoyTs);
    __PAGE__ = pageForJornada(__SOURCE_ROWS__, jActual, __PAGE_SIZE__);

    render();

    wireFilters();
    wireSorting();

    generateRounds();
  selectRound();

    if (loading) loading.classList.add("d-none");
    document.getElementById("exportAdvise").classList.remove("d-none");

    // =========================
    // NUEVO: fijar jornada/página por defecto según "hoy"
    // =========================
    __SORT__ = { col: "multi", asc: true }; // asegurar orden Jornada → Fecha → Hora

    var hoyYMD = todayYMD();
    var hoyTs = dateStamp(hoyYMD);
    var jActual = detectCurrentJornada(__SOURCE_ROWS__, hoyTs);
    __PAGE__ = pageForJornada(__SOURCE_ROWS__, jActual, __PAGE_SIZE__);

    render();
  }

  next();
})();
