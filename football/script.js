async function loadCSV(url) {
  const res = await fetch(url);
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  return lines.map((line) => {
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h, i) => (obj[h.trim()] = cols[i]?.trim() || ""));
    return obj;
  });
}

function renderTable(rows) {
  const tbody = document.querySelector("#matchesTable tbody");
  tbody.innerHTML = "";

  rows.forEach((r) => {
    const tr = document.createElement("tr");

    ["Round", "Date", "Team 1", "Team 2", "Venue"].forEach((k) => {
      const td = document.createElement("td");
      if (k === "Round") {
        // Eliminar la palabra "Jornada" y dejar solo el número
        const roundNum = (r[k] || "").replace(/\D/g, ""); 
        td.textContent = roundNum;
      } else {
        td.textContent = r[k] || "";
      }
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  // Contador en inglés
  document.getElementById("count").textContent = `${rows.length} matches found`;

  const visible = rows.length > 0;
  document.getElementById("tableWrapper").classList.toggle("d-none", !visible);
  document.getElementById("count").classList.toggle("d-none", !visible);
}

function applyFilters(rows) {
  const teamValRaw = document.getElementById("teamFilter").value;
  const teamVal = (teamValRaw || "").trim().toLowerCase(); // <- clave: trim()

  const from = document.getElementById("fromDate").value;
  const to   = document.getElementById("toDate").value;

  if (!teamVal) {
    // Si el campo está vacío o son solo espacios, ocultamos tabla y contador
    document.getElementById("tableWrapper").classList.add("d-none");
    document.getElementById("count").classList.add("d-none");
    return [];
  }

  // Filtrar por equipo + fechas
  let filtered = rows.filter(r => {
    const teamMatch =
      (r["Team 1"] || "").toLowerCase().includes(teamVal) ||
      (r["Team 2"] || "").toLowerCase().includes(teamVal);

    const d = new Date(r["Date"]);
    const fromOk = !from || d >= new Date(from);
    const toOk   = !to   || d <= new Date(to);

    return teamMatch && fromOk && toOk;
  });

  // Ordenar por jornada ascendente (numérica)
  filtered.sort((a, b) => {
    const numA = parseInt((a["Round"] || "").replace(/\D/g, "")) || 0;
    const numB = parseInt((b["Round"] || "").replace(/\D/g, "")) || 0;
    return numA - numB;
  });

  return filtered;
}


function addFilters(rows) {
  ["teamFilter", "fromDate", "toDate"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      renderTable(applyFilters(rows));
    });
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    document.getElementById("teamFilter").value = "";
    document.getElementById("fromDate").value = "";
    document.getElementById("toDate").value = "";
    document.getElementById("tableWrapper").classList.add("d-none");
    document.getElementById("count").classList.add("d-none");
  });
}

function addSorting(rows) {
  const headers = document.querySelectorAll("th[data-col]");
  let sortState = {};

  headers.forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.getAttribute("data-col");
      sortState[col] = !sortState[col];
      const asc = sortState[col];

      let filtered = applyFilters(rows);

      filtered.sort((a, b) => {
        if (col === "Date") {
          return asc
            ? new Date(a[col]) - new Date(b[col])
            : new Date(b[col]) - new Date(a[col]);
        }
        if (col === "Round") {
          const numA = parseInt((a[col] || "").replace(/\D/g, "")) || 0;
          const numB = parseInt((b[col] || "").replace(/\D/g, "")) || 0;
          return asc ? numA - numB : numB - numA;
        }
        return asc
          ? (a[col] || "").localeCompare(b[col] || "")
          : (b[col] || "").localeCompare(a[col] || "");
      });

      headers.forEach((h) => {
        const icon = h.querySelector(".sort-icon");
        if (!icon) return;
        icon.className = "bi sort-icon bi-arrow-down-up";
      });
      const icon = th.querySelector(".sort-icon");
      if (icon) {
        icon.className = asc
          ? "bi sort-icon bi-arrow-down"
          : "bi sort-icon bi-arrow-up";
      }

      renderTable(filtered);
    });
  });
}

(async function init() {
  const TEAM_SLUGS = [
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

  const files = TEAM_SLUGS.map((slug) => `data/matches_${slug}.csv`);

  let allData = [];
  for (const f of files) {
    const data = await loadCSV(f);
    allData = allData.concat(data);
  }

  const seen = new Set();
  const uniqueData = allData.filter((match) => {
    const key = `${match["Date"]}_${match["Team 1"]}_${match["Team 2"]}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  addFilters(uniqueData);
  addSorting(uniqueData);

  document.getElementById("tableWrapper").classList.add("d-none");
  document.getElementById("count").classList.add("d-none");
})();

document.getElementById("teamFilter").addEventListener("input", (e) => {
  // si el usuario mete solo espacios, lo dejamos vacío
  if (!e.target.value.trim()) e.target.value = "";
  renderTable(applyFilters(rows)); // donde 'rows' sea tu dataset original
});
