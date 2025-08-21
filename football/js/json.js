/* =========================
   Carga JSON
========================= */
function loadJSON(url) {
  return fetch(url)
    .then((res) => res.json())
    .then((obj) => {
      // obj es { "1": [...], "2": [...], ... }
      const rows = [];
      Object.entries(obj).forEach(([jornada, partidos]) => {
        partidos.forEach((p) => {
          // Añade el campo Jornada si no está
          p.Jornada = p.Jornada || jornada;
          rows.push(normalizeRow(p));
        });
      });
      return rows.filter(
        (r) =>
          r.Jornada || r.Fecha || r.Horario || r.Local || r.Visitante || r.Resultado
      );
    });
}