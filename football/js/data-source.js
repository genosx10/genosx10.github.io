// Lee la config declarada en el HTML
function getPageDataConfigFromDom() {
  const el = document.querySelector('[data-data-dir]');
  if (!el) return null;
  const baseDir = el.dataset.dataDir || '';
  const maxWeeks = parseInt(el.dataset.maxWeeks || '38', 10);
  if (!baseDir) return null;
  return { baseDir, maxWeeks };
}

// Deducción a partir de la ruta: /football/<league>/matches/...
function inferDataDirFromPath(pathname = location.pathname) {
  const parts = pathname.split('/').filter(Boolean);
  // Espera: ["football", "<league>", "matches", ...]
  if (parts.length >= 3 && parts[0] === 'football' && parts[2] === 'matches') {
    const league = parts[1];
    return `/football/data/${league}/csv`;
  }
  return null;
}

function getPageDataConfig() {
  const fromDom = getPageDataConfigFromDom();
  if (fromDom) return fromDom;

  const inferred = inferDataDirFromPath();
  if (inferred) return { baseDir: inferred, maxWeeks: 38 }; // por defecto 38

  console.error('[data-source] Cannot resolve data dir. ' +
                'Add data-data-dir to <main> or use /football/<league>/matches/.');
  return { baseDir: '', maxWeeks: 0 };
}

function buildWeekFiles(baseDir, maxWeeks) {
  const files = [];
  for (let w = 1; w <= maxWeeks; w++) {
    files.push(`${baseDir}/matches_week_${w}.csv`);
  }
  return files;
}

// Exponer helpers globales para init.js
window.getPageDataConfig = getPageDataConfig;
window.buildWeekFiles = buildWeekFiles;
