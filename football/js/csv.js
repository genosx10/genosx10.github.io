/* =========================
   Carga CSV
========================= */
function loadCSV(url) {
  return fetch(url)
    .then((res) => res.text())
    .then((text) => {
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      const headers = lines.shift().split(",");
      return lines
        .map((line) => {
          const cols = line.split(",");
          const obj = {};
          for (let i = 0; i < headers.length; i++) {
            const h = headers[i].trim();
            obj[h] = (cols[i] != null ? cols[i] : "").trim();
          }
          return normalizeRow(obj);
        })
        .filter((r) => r.Jornada || r.Fecha || r.Horario || r.Local || r.Visitante || r.Resultado);
    });
}
