/* =========================
   Utilidades
========================= */

function debounce(fn, wait = 200) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), wait);
  };
}

function parseFecha(str) {
  const s = String(str || "");
  const parts = s.trim().split(/\s+/);
  const fechaToken = parts.length > 1 ? parts[1] : parts[0];
  const [dd, mm, yyyy] = (fechaToken || "").split("-");
  return yyyy && mm && dd ? `${yyyy}-${mm}-${dd}` : "";
}

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

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

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
