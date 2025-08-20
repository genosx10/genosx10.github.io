/* =========================
   Detección de jornada "actual"
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
  const map = new Map(); // j -> {min, max}
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const j = parseInt(r.Jornada) || 0;
    const ts = dateStamp(r.FechaISO);
    if (isNaN(ts) || j <= 0) continue;
    const cur = map.get(j);
    if (!cur) {
      map.set(j, { min: ts, max: ts });
    } else {
      if (ts < cur.min) cur.min = ts;
      if (ts > cur.max) cur.max = ts;
    }
  }

  const ranges = Array.from(map.entries())
    .map(([j, rng]) => ({ j, min: rng.min, max: rng.max }))
    .sort((a, b) => a.j - b.j);

  if (ranges.length === 0) return 1;

  if (todayTs <= ranges[0].min) return ranges[0].j;

  for (const r of ranges) {
    if (todayTs >= r.min && todayTs <= r.max) return r.j;
    if (todayTs < r.min) return r.j;
  }
  return ranges[ranges.length - 1].j;
}

// Dada la jornada elegida, calcula la página inicial
function pageForJornada(rows, jornada, pageSize) {
  const sorted = multiKeySort(rows);
  let idx = -1;
  for (let i = 0; i < sorted.length; i++) {
    const j = parseInt(sorted[i].Jornada) || 0;
    if (j === jornada) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return 1;
  return Math.floor(idx / pageSize) + 1;
}