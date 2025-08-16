/* =======================================================
   Utilidades DOM y helpers
======================================================= */

// Atajos para seleccionar elementos del DOM
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Función debounce: evita ejecutar una función muchas veces seguidas.
// Espera 'wait' ms desde la última llamada antes de ejecutarla.
function debounce(fn, wait = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* =======================================================
   Carga de datos
======================================================= */

// Carga un CSV remoto y lo convierte en un array de objetos
async function loadCSV(url) {
  const res = await fetch(url);
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/); // separar líneas
  const headers = lines.shift().split(","); // primera línea son los encabezados

  // Mapear cada línea del CSV a un objeto {header: valor}
  return lines.map((line) => {
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h, i) => (obj[h.trim()] = (cols[i] ?? "").trim()));
    return obj;
  });
}

/* =======================================================
   Renderizado de tabla
======================================================= */

// Rellena la tabla con las filas filtradas/ordenadas
function renderTable(rows) {
  const tbody = $("#matchesTable tbody");
  tbody.innerHTML = ""; // limpiar contenido anterior

  // Crear fila por cada partido
  rows.forEach((r) => {
    const tr = document.createElement("tr");

    ["Round", "Date", "Team 1", "Team 2", "Venue"].forEach((k) => {
      const td = document.createElement("td");

      if (k === "Round") {
        // De "Jornada X" nos quedamos solo con el número
        const roundNum = (r[k] || "").replace(/\D/g, "");
        td.textContent = roundNum;
      } else if (k === "Date") {
        // Mostrar fecha en formato local español
        const d = new Date(r[k]);
        td.textContent = isNaN(d)
          ? (r[k] || "")
          : d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
      } else {
        td.textContent = r[k] || "";
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  // Mostrar/ocultar tabla, contador y estado vacío
  const hasRows = rows.length > 0;
  $("#tableWrapper").classList.toggle("d-none", !hasRows);
  $("#emptyState").classList.toggle("d-none", hasRows);
  $("#count").classList.toggle("d-none", !hasRows);

  // Actualizar contador
  $("#count").textContent = `${rows.length} ${rows.length === 1 ? "partido" : "partidos"}`;
}

/* =======================================================
   Filtrado
======================================================= */

// Extrae el número de la jornada de un string
function getRoundNum(v) {
  return parseInt((v || "").replace(/\D/g, "")) || 0;
}

function applyFilters(sourceRows) {
  const teamVal = ($("#teamFilter").value || "").trim().toLowerCase();
  const from = $("#fromDate").value;
  const to   = $("#toDate").value;

  if (!teamVal) return [];

  const filtered = sourceRows.filter((r) => {
    const t1 = (r["Team 1"] || "").toLowerCase();
    const t2 = (r["Team 2"] || "").toLowerCase();
    const teamMatch = t1.includes(teamVal) || t2.includes(teamVal);

    const d = new Date(r["Date"]);
    const fromOk = !from || d >= new Date(from);
    const toOk   = !to   || d <= new Date(to);

    return teamMatch && fromOk && toOk;
  });

  // >>> Orden: 1) Jornada (asc), 2) Fecha (asc)
  if (filtered.length > 1) {
    filtered.sort((a, b) => {
      const ra = getRoundNum(a["Round"]);
      const rb = getRoundNum(b["Round"]);
      if (ra !== rb) return ra - rb;

      const da = new Date(a["Date"]);
      const db = new Date(b["Date"]);
      return da - db; // ascendente
    });
  }

  return filtered;
}


/* =======================================================
   Eventos de filtros (inputs)
======================================================= */

// Conecta los inputs de búsqueda/fechas a la tabla
function wireFilters(sourceRows) {
  // Debounce para no renderizar en exceso
  const onChange = debounce(() => renderTable(applyFilters(sourceRows)), 150);

  // Escuchar cambios en inputs
  ["#teamFilter", "#fromDate", "#toDate"].forEach((sel) => {
    $(sel).addEventListener("input", onChange);
  });

  // Botón borrar solo el filtro de equipo
  $("#clearTeamBtn").addEventListener("click", () => {
    $("#teamFilter").value = "";
    onChange();
  });

  // Botón reset: limpia todos los filtros y oculta la tabla
  $("#resetBtn").addEventListener("click", () => {
    $("#teamFilter").value = "";
    $("#fromDate").value = "";
    $("#toDate").value = "";
    $("#tableWrapper").classList.add("d-none");
    $("#emptyState").classList.add("d-none");
    $("#count").classList.add("d-none");
  });
}

/* =======================================================
   Ordenación por columnas
======================================================= */

// Conecta los <th> con funcionalidad de ordenación
function wireSorting(sourceRows) {
  const headers = $$("th[data-col]");
  const sortState = {}; // Guarda estado asc/desc de cada columna

  // Ordena por columna y re-renderiza
  function sortAndRender(col) {
    const asc = (sortState[col] = !sortState[col]); // toggle asc/desc
    let rows = applyFilters(sourceRows);

    rows.sort((a, b) => {
      if (col === "Date") {
        return asc ? new Date(a[col]) - new Date(b[col])
                   : new Date(b[col]) - new Date(a[col]);
      }
      if (col === "Round") {
        const na = getRoundNum(a[col]);
        const nb = getRoundNum(b[col]);
        return asc ? na - nb : nb - na;
      }
      const av = (a[col] || "");
      const bv = (b[col] || "");
      return asc ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    // Resetear iconos de sort
    headers.forEach((h) => {
      const icon = h.querySelector(".sort-icon");
      if (!icon) return;
      icon.className = "bi sort-icon bi-arrow-down-up";
      h.classList.remove("active");
    });

    // Activar icono de la columna seleccionada
    const th = [...headers].find((h) => h.getAttribute("data-col") === col);
    const icon = th?.querySelector(".sort-icon");
    if (icon) icon.className = asc ? "bi sort-icon bi-arrow-down"
                                   : "bi sort-icon bi-arrow-up";
    th?.classList.add("active");

    renderTable(rows);
  }

  // Asociar eventos a cada cabecera (click + teclado accesible)
  headers.forEach((th) => {
    const col = th.getAttribute("data-col");
    th.addEventListener("click", () => sortAndRender(col));
    th.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        sortAndRender(col);
      }
    });
  });
}

/* =======================================================
   Inicialización
======================================================= */

(async function init() {
  const TEAM_SLUGS = [
    "athletic-club","atletico-de-madrid","c-a-osasuna","d-alaves","elche-c-f",
    "fc-barcelona","getafe-cf","girona-fc","levante-ud","rayo-vallecano",
    "rc-celta","rcd-espanyol","rcd-mallorca","real-betis","real-madrid",
    "real-oviedo","real-sociedad","sevilla-fc","valencia-cf","villarreal-cf",
  ];
  const files = TEAM_SLUGS.map((slug) => `data/matches_${slug}.csv`);

  try {
    // Cargar todos los CSVs
    let all = [];
    for (const f of files) {
      const data = await loadCSV(f);
      all = all.concat(data);
    }

    // Eliminar duplicados (mismo día, mismo partido)
    const seen = new Set();
    const unique = all.filter((m) => {
      const key = `${m["Date"]}_${m["Team 1"]}_${m["Team 2"]}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Conectar filtros y ordenación
    wireFilters(unique);
    wireSorting(unique);

    // Ocultar spinner y preparar arranque en blanco
    $("#loading").classList.add("d-none");
    $("#tableWrapper").classList.add("d-none");
    $("#count").classList.add("d-none");
  } catch (e) {
    console.error(e);
    // Mostrar mensaje de error en UI
    $("#loading").innerHTML =
      `<span class="text-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i>Error cargando datos</span>`;
  }
})();
