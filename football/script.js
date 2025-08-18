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
  const parts = s.trim().split(/\s+/); // "JornadaX 16-08-2025" o "16-08-2025"
  const fechaToken = parts.length > 1 ? parts[1] : parts[0];
  const [dd, mm, yyyy] = (fechaToken || "").split("-");
  return yyyy && mm && dd ? `${yyyy}-${mm}-${dd}` : "";
}

// Timestamp local a partir de YYYY-MM-DD
function dateStamp(ymd) {
  if (!ymd) return NaN;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime(); // <-- mes 0-based
}

function parseHHMM(hhmm) {
  if (/^\d{2}:\d{2}$/.test(hhmm || "")) {
    const [hh, mm] = hhmm.split(":").map(Number);
    return { hh, mm, total: hh * 60 + mm };
  }
  return null;
}

/* Normalizador a claves de UI (ES) */
function normalizeRow(r) {
  return {
    Jornada: r["Jornada"],
    Fecha: r["Fecha"],
    FechaISO: parseFecha(r["Fecha"]),
    Horario: r["Horario"],
    Local: r["Local"],
    Visitante: r["Visitante"],
    Estado: r["Estado"],
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
      return (
        lines
          .map(function (line) {
            var cols = line.split(",");
            var obj = {};
            for (var i = 0; i < headers.length; i++) {
              var h = headers[i].trim();
              obj[h] = (cols[i] != null ? cols[i] : "").trim();
            }
            return normalizeRow(obj);
          })
          // ⬇️ descartar filas totalmente vacías
          .filter(function (r) {
            return (
              r.Jornada ||
              r.Fecha ||
              r.Horario ||
              r.Local ||
              r.Visitante ||
              r.Estado
            );
          })
      );
    });
}

/* =========================
   Estado global
========================= */

var __SOURCE_ROWS__ = []; // dataset completo
var __FILTERED_ROWS__ = []; // después de filtros (sin paginar)
var __PAGE__ = 1;
var __PAGE_SIZE__ = 10;

// orden por defecto (Jornada ↑, Fecha ↑, Horario ↑)
var __SORT__ = { col: "multi", asc: true };

/* =========================
   Ordenación
========================= */

function parseHHMM(hhmm) {
  if (/^\d{2}:\d{2}$/.test(hhmm || "")) {
    const [hh, mm] = hhmm.split(":").map(Number);
    return { hh, mm, total: hh * 60 + mm };
  }
  return null;
}

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
  if (c1 !== 0) return c1;
  return cmpHorario(a, b);
}

function cmpTextField(a, b, field) {
  const av = (a[field] || "").toString();
  const bv = (b[field] || "").toString();
  // 'es' + sensitivity:'base' -> ignora acentos y mayúsculas/minúsculas
  return av.localeCompare(bv, "es", { sensitivity: "base" });
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

// Ordenación según columna seleccionada,
// con criterios secundarios para mantener orden lógico
function sortRows(rows) {
  if (__SORT__.col === "multi") return multiKeySort(rows);

  const col = __SORT__.col;
  const asc = __SORT__.asc ? 1 : -1;

  // pequeño ayudante para aplicar asc/desc a comparadores que ya son "asc"
  const withDir = (cmpVal) => asc * cmpVal;

  return rows.slice().sort(function (a, b) {
    if (col === "Jornada") {
      const ja = parseInt(a.Jornada) || 0;
      const jb = parseInt(b.Jornada) || 0;
      if (ja !== jb) return asc * (ja - jb);
      // Desempate consistente con la jornada seleccionada
      const cf = withDir(cmpFecha(a, b));
      if (cf !== 0) return cf;
      return withDir(cmpHorario(a, b));
    }

    if (col === "Fecha") {
      const cf = withDir(cmpFecha(a, b));
      if (cf !== 0) return cf;
      // Si la fecha es igual, usa jornada y hora en el mismo sentido
      const cj = withDir(cmpJornada(a, b));
      if (cj !== 0) return cj;
      return withDir(cmpHorario(a, b));
    }

    if (col === "Horario") {
      // Mantén el orden lógico también en el mismo sentido elegido
      const ch = withDir(cmpHorario(a, b));
      if (ch !== 0) return ch;
      const cf = withDir(cmpFecha(a, b));
      if (cf !== 0) return cf;
      return withDir(cmpJornada(a, b));
    }

    if (col === "Estado") {
      const orden = ["Pendiente", "Finalizado"];
      const rank = (v) => {
        const i = orden.indexOf(v);
        return i === -1 ? orden.length : i;
      };

      const ra = rank(a.Estado);
      const rb = rank(b.Estado);
      if (ra !== rb) return asc * (ra - rb);

      // Desempates en el mismo sentido
      const cj = withDir(cmpJornada(a, b));
      if (cj !== 0) return cj;
      const cf = withDir(cmpFecha(a, b));
      if (cf !== 0) return cf;
      return withDir(cmpHorario(a, b));
    }

    // 🔹 CASO NUEVO: Local / Visitante con desempates en cascada
    if (col === "Local" || col === "Visitante") {
      const cTeam = asc * ( (a[col] || "").toString()
        .localeCompare((b[col] || "").toString(), "es", { sensitivity: "base" }) );
      if (cTeam !== 0) return cTeam;

      const cj = withDir(cmpJornada(a, b));
      if (cj !== 0) return cj;

      const cf = withDir(cmpFecha(a, b));
      if (cf !== 0) return cf;

      return withDir(cmpHorario(a, b));
    }

    // Alfabético genérico (por si añades otras columnas de texto)
    const av = (a[col] || "").toString();
    const bv = (b[col] || "").toString();
    return asc * av.localeCompare(bv, "es", { sensitivity: "base" });
  });
}


/* =========================
   Filtrado
========================= */

function applyFilters(sourceRows, opts) {
  opts = opts || {};
  var ignoreTeam = !!opts.ignoreTeam;

  var teamVal = (document.getElementById("teamFilter").value || "")
    .trim()
    .toLowerCase();
  var from = document.getElementById("fromDate").value;
  var to = document.getElementById("toDate").value;

  var fromTs = from ? dateStamp(from) : -Infinity;
  var toTs = to ? dateStamp(to) : Infinity;

  // Si no hay filtros (o estamos ignorando equipo y tampoco hay fechas) -> devolver TODO
  if ((!teamVal || ignoreTeam) && !from && !to) return sourceRows.slice();

  var out = [];
  for (var i = 0; i < sourceRows.length; i++) {
    var r = sourceRows[i];

    // --- filtro por equipo (solo si NO lo estamos ignorando) ---
    if (!ignoreTeam && teamVal) {
      var t1 = String(r.Local || "").toLowerCase();
      var t2 = String(r.Visitante || "").toLowerCase();
      var estado = String(r.Estado || "").toLowerCase();
      // Coincidencia en Local, Visitante o Estado (como tenías)
      if (
        t1.indexOf(teamVal) === -1 &&
        t2.indexOf(teamVal) === -1 &&
        estado.indexOf(teamVal) === -1
      ) {
        continue;
      }
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

  // Info "Mostrando X–Y de N"
  if (info.total === 0) {
    rangeInfo.textContent = "";
  } else {
    rangeInfo.textContent =
      "Mostrando " + (info.start + 1) + "–" + info.end + " de " + info.total;
  }

  ul.innerHTML = "";

  function addItem(label, page, disabled, active, aria) {
    var li = document.createElement("li");
    li.className =
      "page-item" + (disabled ? " disabled" : "") + (active ? " active" : "");
    var a = document.createElement("button");
    a.className = "page-link";
    a.type = "button";
    a.textContent = label;
    if (aria) a.setAttribute("aria-label", aria);
    if (!disabled) {
      a.addEventListener("click", function () {
        __PAGE__ = page;
        render(); // re-render general
      });
    }
    li.appendChild(a);
    ul.appendChild(li);
  }

  // Prev
  addItem("«", info.page - 1, info.page <= 1, false, "Anterior");

  // Números (máx ~7 visibles con elipsis simple)
  var maxButtons = 7;
  var start = Math.max(1, info.page - 3);
  var end = Math.min(info.pages, start + maxButtons - 1);
  start = Math.max(1, Math.min(start, end - maxButtons + 1));

  if (start > 1) addItem("1", 1, false, info.page === 1);
  if (start > 2) {
    var liDots = document.createElement("li");
    liDots.className = "page-item disabled";
    liDots.innerHTML = '<span class="page-link">…</span>';
    ul.appendChild(liDots);
  }

  for (var p = start; p <= end; p++) {
    addItem(String(p), p, false, p === info.page);
  }

  if (end < info.pages - 1) {
    var liDots2 = document.createElement("li");
    liDots2.className = "page-item disabled";
    liDots2.innerHTML = '<span class="page-link">…</span>';
    ul.appendChild(liDots2);
  }
  if (end < info.pages)
    addItem(String(info.pages), info.pages, false, info.page === info.pages);

  // Next
  addItem("»", info.page + 1, info.page >= info.pages, false, "Siguiente");
}

function renderTable(rows) {
  var tbody = document.querySelector("#matchesTable tbody");
  tbody.innerHTML = "";

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var tr = document.createElement("tr");

    var order = ["Jornada", "Fecha", "Horario", "Local", "Visitante", "Estado"];
    for (var j = 0; j < order.length; j++) {
      var k = order[j];
      var td = document.createElement("td");
      td.textContent = r[k] != null ? r[k] : "";
      tr.appendChild(td);
    }

    // 🔹 Nueva columna con * si NO es una hora hh:mm válida
    var tdStar = document.createElement("td");
    tdStar.style.width = "1%";

    // regex para validar formato HH:MM
    var v = r.Horario || "";
    var mostrarAviso = v !== "" && !/^\d{2}:\d{2}$/.test(v);
    tdStar.textContent = mostrarAviso ? "*" : "";

    tdStar.style.color = "red";
    tdStar.style.textAlign = "left";
    tr.appendChild(tdStar);

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

  // Botón export
  var exportWrapper = document.getElementById("exportWrapper");
  var exportBtn = document.getElementById("exportBtn");
  if (exportWrapper) exportWrapper.classList.toggle("d-none", !hasRows);
  if (exportBtn)
    exportBtn.onclick = function () {
      exportToCalendar(__FILTERED_ROWS__);
    };
}

/* =========================
   Ciclo de render completo
========================= */

function render() {
  // 1) aplicar filtros
  __FILTERED_ROWS__ = applyFilters(__SOURCE_ROWS__);

  // 2) ordenar
  var sorted = sortRows(__FILTERED_ROWS__);

  // 3) paginar
  var info = paginate(sorted, __PAGE__, __PAGE_SIZE__);

  // 4) dibujar tabla y paginación
  renderTable(info.slice);
  renderPagination(info);
}

/* =========================
   Eventos de filtros
========================= */

function wireFilters() {
  var onChange = debounce(function () {
    __PAGE__ = 1; // volver a primera página tras cualquier cambio
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
    __SORT__ = { col: "multi", asc: true }; // ordenar por defecto
    __PAGE__ = 1;
    render(); // <- muestra toda la base de datos
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
      if (!icon) continue;
      icon.className = "bi sort-icon bi-arrow-down-up";
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

  // 🆕 Pequeño helper para aplicar el ciclo asc → desc → sin orden (por defecto)
  function handleSort(col) {
    if (__SORT__.col !== col) {
      // 1er clic sobre una columna nueva: asc
      __SORT__ = { col: col, asc: true };
      updateIcons(col);
      __PAGE__ = 1;
      render();
      return;
    }
    if (__SORT__.asc) {
      // 2º clic: desc
      __SORT__.asc = false;
      updateIcons(col);
      __PAGE__ = 1;
      render();
      return;
    }
    // 3er clic: quitar orden y volver al multi-key por defecto
    __SORT__ = { col: "multi", asc: true };
    updateIcons(null); // vuelve a mostrar el icono neutro en todas
    __PAGE__ = 1;
    render();
  }

  function attach(th) {
    var col = th.getAttribute("data-col");
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

  // estado inicial: orden múltiple por defecto (sin ninguna columna activa)
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
  function parseHHMM2(hhmm) {
    if (!/^\d{2}:\d{2}$/.test(hhmm || "")) return null;
    var t = hhmm.split(":");
    return { hh: +t[0], mm: +t[1] };
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
    var ymd = r.FechaISO;
    var hm = r.Horario;
    var ymdParts = parseYMD(ymd);
    var hmParts = parseHHMM2(hm);

    ics += "BEGIN:VEVENT\n";
    ics += "UID:" + uid + "\n";
    ics += "DTSTAMP:" + dtstamp + "\n";

    if (hmParts) {
      var startLocal = fmtLocal(
        ymdParts.y,
        ymdParts.m,
        ymdParts.d,
        hmParts.hh,
        hmParts.mm,
        0
      );
      var endParts = addHours(
        ymdParts.y,
        ymdParts.m,
        ymdParts.d,
        hmParts.hh,
        hmParts.mm,
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
      var d0 = "" + ymdParts.y + p2(ymdParts.m) + p2(ymdParts.d);
      var endDay = addHours(ymdParts.y, ymdParts.m, ymdParts.d, 0, 0, 24);
      var d1 = "" + endDay.y + p2(endDay.m) + p2(endDay.d);
      ics += "DTSTART;VALUE=DATE:" + d0 + "\n";
      ics += "DTEND;VALUE=DATE:" + d1 + "\n";
    }

    ics += "SUMMARY:" + (r.Local || "") + " vs " + (r.Visitante || "") + "\n";
    ics +=
      "DESCRIPTION:Jornada " +
      (r.Jornada || "") +
      " — Estado: " +
      (r.Estado || "") +
      "\n";
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
   Inicialización
========================= */

(function init() {
  var TEAM_SLUGS = [
    "athletic-club",
    "atletico-de-madrid",
    "c-a-osasuna",
    "d-alaves",
    "elche-c-f",
    "fc-barcelona",
    "getafe-cf",
    "girona-fc",
    "levante-ud",
    "rayo-vallecano",
    "rc-celta",
    "rcd-espanyol",
    "rcd-mallorca",
    "real-betis",
    "real-madrid",
    "real-oviedo",
    "real-sociedad",
    "sevilla-fc",
    "valencia-cf",
    "villarreal-cf",
  ];
  var files = TEAM_SLUGS.map(function (slug) {
    return "data/matches_" + slug + ".csv";
  });

  var i = 0;
  function next() {
    if (i >= files.length) return afterLoad();
    loadCSV(files[i])
      .then(function (data) {
        __SOURCE_ROWS__ = __SOURCE_ROWS__.concat(data);
        i++;
        next();
      })
      .catch(function (e) {
        console.error(e);
        var loading = document.getElementById("loading");
        if (loading) {
          loading.innerHTML =
            '<span class="text-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i>Error cargando datos</span>';
        }
      });
  }

  function afterLoad() {
    // deduplicado simple
    var seen = new Set();
    var unique = [];
    for (var k = 0; k < __SOURCE_ROWS__.length; k++) {
      var m = __SOURCE_ROWS__[k];
      var key =
        (m.FechaISO || "") + "_" + (m.Local || "") + "_" + (m.Visitante || "");
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(m);
    }
    __SOURCE_ROWS__ = unique;

    wireFilters();
    wireSorting();

    // Estado inicial: mostrar TODA la base (orden por defecto y página 1)
    document.getElementById("loading").classList.add("d-none");
    __PAGE__ = 1;
    __SORT__ = { col: "multi", asc: true };
    render();
  }

  next();
})();
