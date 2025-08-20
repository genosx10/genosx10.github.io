/* =========================
   Filtrado
========================= */
function applyFilters(sourceRows) {
  const rawTeams = document.getElementById("teamFilter").value || "";
  const teams = rawTeams.split(/[;,|]/).map(t => normalizeText(t.trim())).filter(Boolean);
  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;
  const fromTs = from ? dateStamp(from) : -Infinity;
  const toTs = to ? dateStamp(to) : Infinity;

  if (teams.length === 0 && !from && !to) return sourceRows.slice();

  return sourceRows.filter(r => {
    if (teams.length > 0) {
      const loc = normalizeText(r.Local);
      const vis = normalizeText(r.Visitante);
      if (!teams.some(q => loc.includes(q) || vis.includes(q))) return false;
    }
    if (from || to) {
      const ts = dateStamp(r.FechaISO);
      if (isNaN(ts)) return false;
      if (ts < fromTs || ts > toTs) return false;
    }
    return true;
  });
}
