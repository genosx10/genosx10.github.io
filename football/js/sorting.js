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

function multiKeySort(rows) {
  return rows.slice().sort((a, b) => {
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
  if (["Local", "Visitante", "Fecha", "Horario", "Resultado"].includes(col)) {
    return multiKeySort(rows);
  }
  return rows.slice().sort((a, b) => {
    if (col === "Jornada") {
      const ja = parseInt(a.Jornada) || 0;
      const jb = parseInt(b.Jornada) || 0;
      if (ja !== jb) return asc * (ja - jb);
      const cf = asc * cmpFecha(a, b);
      if (cf !== 0) return cf;
      return asc * cmpHorario(a, b);
    }
    return cmpFechaHorario(a, b);
  });
}
