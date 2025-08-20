/* =========================
   Utilidades
========================= */

function debounce(fn, wait) {
  if (wait == null) wait = 200;
  var t;
  return function () {
    var args = arguments;
    clearTimeout(t);
    t = setTimeout(function () {
      fn.apply(null, args);
    }, wait);
  };
}

function parseFecha(str) {
  const s = String(str || "");
  const parts = s.trim().split(/\s+/); // "Dom 17-08-2025" o "17-08-2025"
  const fechaToken = parts.length > 1 ? parts[1] : parts[0];
  const [dd, mm, yyyy] = (fechaToken || "").split("-");
  return yyyy && mm && dd ? `${yyyy}-${mm}-${dd}` : "";
}

// Timestamp local a partir de YYYY-MM-DD
function dateStamp(ymd) {
  if (!ymd) return NaN;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

function parseHHMM(hhmm) {
  if (/^\d{2}:\d{2}$/.test(hhmm || "")) {
    const [hh, mm] = hhmm.split(":").map(Number);
    return { hh, mm, total: hh * 60 + mm };
  }
  return null;
}

/* Normalizador */
function normalizeRow(r) {
  return {
    Jornada: r["Jornada"],
    Fecha: r["Fecha"],
    FechaISO: parseFecha(r["Fecha"]),
    Horario: r["Horario"],
    Local: r["Local"],
    Resultado: r["Resultado"],
    Visitante: r["Visitante"],
  };
}

/* =========================
   Carga CSV
========================= */

function loadCSV(url) {
  return fetch(url)
    .then((res) => res.text())
    .then((text) => {
      var lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      var headers = lines.shift().split(",");
      return lines
        .map(function (line) {
          var cols = line.split(",");
          var obj = {};
          for (var i = 0; i < headers.length; i++) {
            var h = headers[i].trim();
            obj[h] = (cols[i] != null ? cols[i] : "").trim();
          }
          return normalizeRow(obj);
        })
        .filter(function (r) {
          return (
            r.Jornada ||
            r.Fecha ||
            r.Horario ||
            r.Local ||
            r.Visitante ||
            r.Resultado
          );
        });
    });
}

/* =========================
   Estado global
========================= */

var __SOURCE_ROWS__ = [];
var __FILTERED_ROWS__ = [];
var __PAGE__ = 1;
var __PAGE_SIZE__ = 10;
var __SORT__ = { col: "multi", asc: true };
var __WIRED__ = false;
function ensureWired() {
  if (!__WIRED__) {
    wireFilters();
    wireSorting();
    __WIRED__ = true;
  }
}

/* =========================
   Caché en localStorage
========================= */
var CACHE_KEY = "laliga_matches_v1";
var CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 6; // 6 horas

function canUseLocalStorage() {
  try {
    var k = "__test__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch (e) {
    return false;
  }
}

function saveCache(rows) {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ts: Date.now(), rows: rows })
    );
  } catch (_) {}
}

function loadCache() {
  if (!canUseLocalStorage()) return null;
  try {
    var raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (!obj || !Array.isArray(obj.rows)) return null;
    return obj;
  } catch (_) {
    return null;
  }
}

function clearCache() {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (_) {}
}

/* =========================
   Ordenación
========================= */

function cmpFecha(a, b) {
  const da = dateStamp(a.FechaISO);
  const db = dateStamp(b.FechaISO);
  if (isNaN(da) && isNaN(db)) return 0;
  if (isNaN(da)) return 1;
  if (isNaN(db)) return -1;
  return da - db;
}

function cmpHorario(a, b) {
  const ha = parseHHMM(a.Horario);
  const hb = parseHHMM(b.Horario);
  if (!ha && !hb) return 0;
  if (!ha) return 1;
  if (!hb) return -1;
  return ha.total - hb.total;
}

function cmpJornada(a, b) {
  const ja = parseInt(a.Jornada) || 0;
  const jb = parseInt(b.Jornada) || 0;
  return ja - jb;
}

function cmpFechaHorario(a, b) {
  const c1 = cmpFecha(a, b);
  return c1 !== 0 ? c1 : cmpHorario(a, b);
}

// Orden por defecto (Jornada → Fecha → Horario)
function multiKeySort(rows) {
  return rows.slice().sort(function (a, b) {
    const ja = parseInt(a.Jornada) || 0;
    const jb = parseInt(b.Jornada) || 0;
    if (ja !== jb) return ja - jb;
    return cmpFechaHorario(a, b);
  });
}

function sortRows(rows) {
  if (__SORT__.col === "multi") return multiKeySort(rows);

  const col = __SORT__.col;
  const asc = __SORT__.asc ? 1 : -1;
  const withDir = (cmpVal) => asc * cmpVal;

  // Blindaje + única ordenación permitida (Jornada)
  if (
    col === "Local" ||
    col === "Visitante" ||
    col === "Fecha" ||
    col === "Horario" ||
    col === "Resultado"
  ) {
    return multiKeySort(rows);
  }

  return rows.slice().sort(function (a, b) {
    if (col === "Jornada") {
      const ja = parseInt(a.Jornada) || 0;
      const jb = parseInt(b.Jornada) || 0;
      if (ja !== jb) return asc * (ja - jb);
      const cf = withDir(cmpFecha(a, b));
      if (cf !== 0) return cf;
      return withDir(cmpHorario(a, b));
    }
    // Cualquier otra cosa: vuelve al orden por defecto
    return cmpFechaHorario(a, b);
  });
}

// 🔹 Normaliza texto: minúsculas y sin acentos/diacríticos
function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/* =========================
   Filtrado (multi-equipo)
========================= */
function applyFilters(sourceRows) {
  var rawTeams = document.getElementById("teamFilter").value || "";
  // Admite separadores coma, punto y coma o barra vertical
  var teams = rawTeams
    .split(/[;,|]/)
    .map((t) => normalizeText(t.trim()))
    .filter(Boolean);

  var from = document.getElementById("fromDate").value;
  var to = document.getElementById("toDate").value;

  var fromTs = from ? dateStamp(from) : -Infinity;
  var toTs = to ? dateStamp(to) : Infinity;

  // Sin filtros → devolver todo
  if (teams.length === 0 && !from && !to) return sourceRows.slice();

  var out = [];
  for (var i = 0; i < sourceRows.length; i++) {
    var r = sourceRows[i];

    // --- filtro por equipos (OR) ---
    if (teams.length > 0) {
      var loc = normalizeText(r.Local);
      var vis = normalizeText(r.Visitante);

      // ¿Coincide alguno de los equipos con Local o Visitante?
      var matchAny = false;
      for (var k = 0; k < teams.length; k++) {
        var q = teams[k];
        if (q && (loc.indexOf(q) !== -1 || vis.indexOf(q) !== -1)) {
          matchAny = true;
          break;
        }
      }
      if (!matchAny) continue;
    }

    // --- filtro por fechas ---
    if (from || to) {
      var ts = dateStamp(r.FechaISO);
      if (isNaN(ts)) continue;
      if (ts < fromTs || ts > toTs) continue;
    }

    out.push(r);
  }
  return out;
}

/* =========================
   Render tabla + paginación
========================= */

function paginate(rows, page, size) {
  var total = rows.length;
  var pages = Math.max(1, Math.ceil(total / size));
  var p = Math.min(Math.max(1, page), pages);
  var start = (p - 1) * size;
  var end = Math.min(start + size, total);
  return { slice: rows.slice(start, end), page: p, pages, total, start, end };
}

function renderPagination(info) {
  var ul = document.getElementById("pagination");
  var rangeInfo = document.getElementById("rangeInfo");
  if (!ul || !rangeInfo) return;

  rangeInfo.textContent =
    info.total === 0
      ? ""
      : "Mostrando " + (info.start + 1) + "–" + info.end + " de " + info.total;
  ul.innerHTML = "";

  function addItem(label, page, disabled, aria) {
    var li = document.createElement("li");
    li.className = "page-item" + (disabled ? " disabled" : "");
    var a = document.createElement("button");
    a.className = "page-link";
    a.type = "button";
    a.textContent = label;
    if (aria) a.setAttribute("aria-label", aria);
    if (!disabled) {
      a.addEventListener("click", function () {
        __PAGE__ = page;
        render();
      });
    }
    li.appendChild(a);
    ul.appendChild(li);
  }

  addItem("«", info.page - 1, info.page <= 1, "Anterior");

  var maxButtons = 7;
  var start = Math.max(1, info.page - 3);
  var end = Math.min(info.pages, start + maxButtons - 1);
  start = Math.max(1, Math.min(start, end - maxButtons + 1));

  if (start > 1) addItem("1", 1, false);
  if (start > 2) {
    var liDots = document.createElement("li");
    liDots.className = "page-item disabled";
    liDots.innerHTML = '<span class="page-link">…</span>';
    ul.appendChild(liDots);
  }

  for (var p = start; p <= end; p++) {
    var li = document.createElement("li");
    li.className = "page-item" + (p === info.page ? " active" : "");
    var btn = document.createElement("button");
    btn.className = "page-link";
    btn.type = "button";
    btn.textContent = String(p);
    btn.addEventListener(
      "click",
      (function (pageNum) {
        return function () {
          __PAGE__ = pageNum;
          render();
        };
      })(p)
    );
    li.appendChild(btn);
    ul.appendChild(li);
  }

  if (end < info.pages - 1) {
    var liDots2 = document.createElement("li");
    liDots2.className = "page-item disabled";
    liDots2.innerHTML = '<span class="page-link">…</span>';
    ul.appendChild(liDots2);
  }
  if (end < info.pages) addItem(String(info.pages), info.pages, false);

  addItem("»", info.page + 1, info.page >= info.pages, "Siguiente");
}

function renderTable(rows) {
  var tbody = document.querySelector("#matchesTable tbody");
  tbody.innerHTML = "";

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var tr = document.createElement("tr");

    var order = [
      "Jornada",
      "Fecha",
      "Horario",
      "Local",
      "Resultado",
      "Visitante",
    ];

    var tdStar = document.createElement("td");
    tdStar.style.width = "20px";
    var v = r.Horario || "";
    var mostrarAviso = v !== "" && !/^\d{2}:\d{2}$/.test(v);
    tdStar.textContent = mostrarAviso ? "*" : "";
    tdStar.style.color = "red";
    tdStar.style.textAlign = "left";
    tr.appendChild(tdStar);

    for (var j = 0; j < order.length; j++) {
      var k = order[j];
      var td = document.createElement("td");
      td.textContent = r[k] != null ? r[k] : "";
      td.classList.add("text-truncate");
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  var hasRows = __FILTERED_ROWS__.length > 0;
  document.getElementById("tableWrapper").classList.toggle("d-none", !hasRows);
  document.getElementById("emptyState").classList.toggle("d-none", hasRows);
  document.getElementById("count").classList.toggle("d-none", !hasRows);
  document.getElementById("advise").classList.toggle("d-none", !hasRows);
  document.getElementById("exportAdvise").classList.toggle("d-none", !hasRows);
  document.getElementById("count").textContent =
    __FILTERED_ROWS__.length +
    " " +
    (__FILTERED_ROWS__.length === 1 ? "partido" : "partidos");

  var exportWrapper = document.getElementById("exportWrapper");
  var exportBtn = document.getElementById("exportBtn");
  if (exportWrapper) exportWrapper.classList.toggle("d-none", !hasRows);
  if (exportBtn)
    exportBtn.onclick = function () {
      exportToCalendar(__FILTERED_ROWS__);
    };
}

/* =========================
   Ciclo de render
========================= */

function render() {
  __FILTERED_ROWS__ = applyFilters(__SOURCE_ROWS__);
  var sorted = sortRows(__FILTERED_ROWS__);
  var info = paginate(sorted, __PAGE__, __PAGE_SIZE__);
  renderTable(info.slice);
  renderPagination(info);
}

/* =========================
   Eventos de filtros
========================= */

function wireFilters() {
  var onChange = debounce(function () {
    __PAGE__ = 1;
    render();
  }, 150);

  document.getElementById("teamFilter").addEventListener("input", onChange);
  document.getElementById("fromDate").addEventListener("input", onChange);
  document.getElementById("toDate").addEventListener("input", onChange);

  document
    .getElementById("clearTeamBtn")
    .addEventListener("click", function () {
      document.getElementById("teamFilter").value = "";
      __PAGE__ = 1;
      render();
    });

  document.getElementById("resetBtn").addEventListener("click", function () {
    document.getElementById("teamFilter").value = "";
    document.getElementById("fromDate").value = "";
    document.getElementById("toDate").value = "";
    __SORT__ = { col: "multi", asc: true };
    __PAGE__ = 1;
    render();
  });
}

/* =========================
   Ordenación por columnas (UI)
========================= */

function wireSorting() {
  var headers = document.querySelectorAll("th[data-col]");

  function updateIcons(activeCol) {
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i];
      var icon = h.querySelector(".sort-icon");
      h.classList.remove("active");
      if (icon) icon.className = "bi sort-icon bi-arrow-down-up";
    }
    if (activeCol) {
      var th = Array.prototype.find.call(headers, function (el) {
        return el.getAttribute("data-col") === activeCol;
      });
      if (th) {
        var ic = th.querySelector(".sort-icon");
        th.classList.add("active");
        if (ic)
          ic.className = __SORT__.asc
            ? "bi sort-icon bi-arrow-up"
            : "bi sort-icon bi-arrow-down";
      }
    }
  }

  function handleSort(col) {
    if (__SORT__.col !== col) {
      __SORT__ = { col: col, asc: true };
    } else if (__SORT__.asc) {
      __SORT__.asc = false;
    } else {
      __SORT__ = { col: "multi", asc: true };
      col = null;
    }
    updateIcons(col);
    __PAGE__ = 1;
    render();
  }

  function attach(th) {
    var col = th.getAttribute("data-col");
    // No ordenar por estas columnas
    if (["Resultado", "Fecha", "Horario", "Local", "Visitante"].includes(col)) {
      th.classList.remove("active");
      var ic = th.querySelector(".sort-icon");
      if (ic) ic.className = "bi sort-icon bi-arrow-down-up";
      th.style.cursor = "default";
      th.setAttribute("aria-disabled", "true");
      return;
    }
    th.addEventListener("click", function () {
      handleSort(col);
    });
    th.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSort(col);
      }
    });
  }

  for (var i = 0; i < headers.length; i++) attach(headers[i]);
  updateIcons(null);
}

/* =========================
   Exportar a Google Calendar (.ics)
========================= */

function generateICS(rows) {
  function p2(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function fmtLocal(y, m, d, hh, mm, ss) {
    return "" + y + p2(m) + p2(d) + "T" + p2(hh) + p2(mm) + p2(ss);
  }
  function parseYMD(ymd) {
    var p = (ymd || "").split("-");
    return { y: +p[0], m: +p[1], d: +p[2] };
  }
  function addHours(y, m, d, hh, mm, add) {
    var dt = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
    dt.setUTCHours(dt.getUTCHours() + add);
    return {
      y: dt.getUTCFullYear(),
      m: dt.getUTCMonth() + 1,
      d: dt.getUTCDate(),
      hh: dt.getUTCHours(),
      mm: dt.getUTCMinutes(),
      ss: dt.getUTCSeconds(),
    };
  }
  function fmtUTC(dt) {
    function p2(n) {
      return (n < 10 ? "0" : "") + n;
    }
    return (
      dt.getUTCFullYear() +
      p2(dt.getUTCMonth() + 1) +
      p2(dt.getUTCDate()) +
      "T" +
      p2(dt.getUTCHours()) +
      p2(dt.getUTCMinutes()) +
      p2(dt.getUTCSeconds()) +
      "Z"
    );
  }

  var now = new Date();
  var dtstamp = fmtUTC(now);

  var ics =
    "BEGIN:VCALENDAR\n" +
    "VERSION:2.0\n" +
    "PRODID:-\\-LaLiga Calendario//ES\n" +
    "CALSCALE:GREGORIAN\n" +
    "METHOD:PUBLISH\n" +
    "BEGIN:VTIMEZONE\n" +
    "TZID:Europe/Madrid\n" +
    "X-LIC-LOCATION:Europe/Madrid\n" +
    "BEGIN:DAYLIGHT\n" +
    "TZOFFSETFROM:+0100\n" +
    "TZOFFSETTO:+0200\n" +
    "TZNAME:CEST\n" +
    "DTSTART:19700329T020000\n" +
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\n" +
    "END:DAYLIGHT\n" +
    "BEGIN:STANDARD\n" +
    "TZOFFSETFROM:+0200\n" +
    "TZOFFSETTO:+0100\n" +
    "TZNAME:CET\n" +
    "DTSTART:19701025T030000\n" +
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\n" +
    "END:STANDARD\n" +
    "END:VTIMEZONE\n";

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var uid = Date.now() + "-" + i + "@laliga-cal";
    var ymdParts = parseYMD(r.FechaISO);
    var hm = parseHHMM(r.Horario);

    ics += "BEGIN:VEVENT\n";
    ics += "UID:" + uid + "\n";
    ics += "DTSTAMP:" + dtstamp + "\n";

    if (hm) {
      var startLocal = fmtLocal(
        ymdParts.y,
        ymdParts.m,
        ymdParts.d,
        hm.hh,
        hm.mm,
        0
      );
      var endParts = addHours(
        ymdParts.y,
        ymdParts.m,
        ymdParts.d,
        hm.hh,
        hm.mm,
        2
      );
      var endLocal = fmtLocal(
        endParts.y,
        endParts.m,
        endParts.d,
        endParts.hh,
        endParts.mm,
        endParts.ss
      );
      ics += "DTSTART;TZID=Europe/Madrid:" + startLocal + "\n";
      ics += "DTEND;TZID=Europe/Madrid:" + endLocal + "\n";
    } else {
      var d0 =
        "" +
        ymdParts.y +
        (ymdParts.m < 10 ? "0" : "") +
        ymdParts.m +
        (ymdParts.d < 10 ? "0" : "") +
        ymdParts.d;
      var endDay = addHours(ymdParts.y, ymdParts.m, ymdParts.d, 0, 0, 24);
      var d1 =
        "" +
        endDay.y +
        (endDay.m < 10 ? "0" : "") +
        endDay.m +
        (endDay.d < 10 ? "0" : "") +
        endDay.d;
      ics += "DTSTART;VALUE=DATE:" + d0 + "\n";
      ics += "DTEND;VALUE=DATE:" + d1 + "\n";
    }

    ics += "SUMMARY:" + (r.Local || "") + " vs " + (r.Visitante || "") + "\n";
    ics += "DESCRIPTION:Jornada " + (r.Jornada || "") + "\n";
    ics += "END:VEVENT\n";
  }

  ics += "END:VCALENDAR";
  return ics;
}

function exportToCalendar(rows) {
  var ics = generateICS(rows);
  var blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "laliga_calendario.ics";
  a.click();
  URL.revokeObjectURL(url);
}

/* =========================
   NUEVO: detección de jornada "actual"
========================= */

// YYYY-MM-DD local de "hoy"
function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Devuelve la jornada que corresponde a "hoy" según rangos min–max por jornada
function detectCurrentJornada(rows, todayTs) {
  // Construir rangos por jornada (min y max válidos)
  var map = new Map(); // j -> {min, max}
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var j = parseInt(r.Jornada) || 0;
    var ts = dateStamp(r.FechaISO);
    if (isNaN(ts) || j <= 0) continue;
    var cur = map.get(j);
    if (!cur) {
      map.set(j, { min: ts, max: ts });
    } else {
      if (ts < cur.min) cur.min = ts;
      if (ts > cur.max) cur.max = ts;
    }
  }

  // Pasar a lista ordenada por jornada
  var ranges = Array.from(map.entries())
    .map(function ([j, rng]) {
      return { j: j, min: rng.min, max: rng.max };
    })
    .sort(function (a, b) {
      return a.j - b.j;
    });

  if (ranges.length === 0) return 1; // fallback

  // Antes de la primera jornada → 1
  if (todayTs <= ranges[0].min) return ranges[0].j;

  for (var k = 0; k < ranges.length; k++) {
    var r = ranges[k];
    if (todayTs >= r.min && todayTs <= r.max) {
      return r.j; // estamos dentro
    }
    if (todayTs < r.min) {
      return r.j; // estamos antes de que empiece: próxima jornada
    }
  }

  // Después de la última → última
  return ranges[ranges.length - 1].j;
}

// Dada la jornada elegida, calcula la página inicial para que aparezca esa jornada
function pageForJornada(rows, jornada, pageSize) {
  var sorted = multiKeySort(rows);
  var idx = -1;
  for (var i = 0; i < sorted.length; i++) {
    var j = parseInt(sorted[i].Jornada) || 0;
    if (j === jornada) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return 1;
  return Math.floor(idx / pageSize) + 1;
}

/* =========================
   Generar Jornadas
========================= */

function generateRounds() {
  let ddRoundsMenu = document.getElementById("dropdownRoundsMenu");

  for (let i = 1; i <= 38; i++) {
    let ddRoundsLi = document.createElement("li");
    let ddRoundsBtn = document.createElement("button");

    ddRoundsLi.appendChild(ddRoundsBtn);
    ddRoundsBtn.id = `r${i}`;
    ddRoundsBtn.textContent = `Jornada ${i}`;
    ddRoundsBtn.classList.add("dropdown-item");

    ddRoundsMenu.appendChild(ddRoundsLi);
  }
}

function selectRound() {
  let ddRoundsMenu = document.getElementById("dropdownRoundsMenu");
  let ddMenuBtn = document.getElementById("dropdownMenuBtn");
  ddRoundsMenu.addEventListener("click", (e) => {
    if (e.target.id != "r") {
      document.getElementById("r").classList.remove("d-none");
      ddMenuBtn.textContent = e.target.textContent;
    } else {
      document.getElementById("r").classList.add("d-none");
      ddMenuBtn.textContent = e.target.textContent;
    }
  });
}
/* =========================
   Inicialización (semanas)
========================= */

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
