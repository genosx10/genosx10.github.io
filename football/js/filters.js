/* =========================
   Filtrado
========================= */
function applyFilters(sourceRows) {
  const rawTeams = document.getElementById("teamFilter").value || "";
  const teams = rawTeams
    .split(/[;,|]/)
    .map((t) => normalizeText(t.trim()))
    .filter(Boolean);
  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;
  const fromTs = from ? dateStamp(from) : -Infinity;
  const toTs = to ? dateStamp(to) : Infinity;

  // 🟢 Nuevo: jornada seleccionada (null = sin filtro)
  const roundFilter = (typeof window !== "undefined" && window.__ROUND__ != null)
    ? Number(window.__ROUND__)
    : null;

  // Si no hay ningún filtro activo, evita trabajo
  if (teams.length === 0 && !from && !to && roundFilter == null) {
    return sourceRows.slice();
  }

  return sourceRows.filter((r) => {
    // Filtro por equipos
    if (teams.length > 0) {
      const loc = normalizeText(r.Local);
      const vis = normalizeText(r.Visitante);
      if (!teams.some((q) => loc.includes(q) || vis.includes(q))) return false;
    }

    // Filtro por fechas
    if (from || to) {
      const ts = dateStamp(r.FechaISO);
      if (isNaN(ts)) return false;
      if (ts < fromTs || ts > toTs) return false;
    }

    // 🟢 Filtro por jornada
    if (roundFilter != null) {
      // Intenta varias claves por robustez
      const rr =
        Number(r.Jornada ?? r.Round ?? r.round ?? r["Jornada"] ?? NaN);
      if (!Number.isFinite(rr) || rr !== roundFilter) return false;
    }

    return true;
  });
}
