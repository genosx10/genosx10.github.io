const teamDateBtn = document.getElementById("teamDateBtn");
const roundBtn    = document.getElementById("roundBtn");
const teamsDate   = document.getElementById("teamsDate");
const rounds      = document.getElementById("rounds");

if (!teamDateBtn || !roundBtn || !teamsDate || !rounds) {
  console.warn("Faltan elementos en el DOM.");
}

// utilidades
const swapClasses = (el, oldClasses = [], newClasses = []) => {
  oldClasses.forEach(c => el.classList.remove(c));
  newClasses.forEach(c => el.classList.add(c));
};

const activeClasses   = ["bg-info-subtle", "text-info-emphasis", "border-info-subtle"];
const inactiveClasses = ["bg-secondary-subtle", "text-secondary-emphasis", "border-secondary-subtle"];

const activate = (activeBtn, inactiveBtn, showEl, hideEl) => {
  swapClasses(activeBtn,  inactiveClasses, activeClasses);
  swapClasses(inactiveBtn, activeClasses,   inactiveClasses);

  showEl.classList.remove("d-none");
  hideEl.classList.add("d-none");

  activeBtn.setAttribute("aria-selected", "true");
  inactiveBtn.setAttribute("aria-selected", "false");

  if (typeof wireFilters === "function") wireFilters();
  if (showEl === teamsDate && typeof wireSorting === "function") wireSorting();
  if (showEl === rounds && rounds.classList.add("d-flex"));
  if (hideEl === rounds && rounds.classList.remove("d-flex"));

};

// listeners
roundBtn.addEventListener("click", () => {
  // Reinicia filtros de equipo y fecha
  document.getElementById("teamFilter").value = "";
  document.getElementById("fromDate").value = "";
  document.getElementById("toDate").value = "";
  document.getElementById("dropdownMenuBtn").textContent = "Jornada";
  document.getElementById("r").classList.add("d-none");
  window.__ROUND__ = null;
  __SORT__ = { col: "multi", asc: true };

  // Detecta jornada actual y muestra esa página
  if (window.__SOURCE_ROWS__ && typeof detectCurrentJornada === "function" && typeof pageForJornada === "function") {
    const hoyTs = dateStamp(todayYMD());
    const jActual = detectCurrentJornada(window.__SOURCE_ROWS__, hoyTs);
    __PAGE__ = pageForJornada(window.__SOURCE_ROWS__, jActual, window.__PAGE_SIZE__);
  } else {
    __PAGE__ = 1;
  }
  render();

  activate(roundBtn, teamDateBtn, rounds, teamsDate);
});

teamDateBtn.addEventListener("click", () => {
  // Elimina filtro de jornada y muestra partidos de la jornada actual
  window.__ROUND__ = null;
  document.getElementById("dropdownMenuBtn").textContent = "Jornada";
  document.getElementById("r").classList.add("d-none");
  __SORT__ = { col: "multi", asc: true };

  // Detecta jornada actual y muestra esa página
  if (window.__SOURCE_ROWS__ && typeof detectCurrentJornada === "function" && typeof pageForJornada === "function") {
    const hoyTs = dateStamp(todayYMD());
    const jActual = detectCurrentJornada(window.__SOURCE_ROWS__, hoyTs);
    __PAGE__ = pageForJornada(window.__SOURCE_ROWS__, jActual, window.__PAGE_SIZE__);
  } else {
    __PAGE__ = 1;
  }
  render();

  activate(teamDateBtn, roundBtn, teamsDate, rounds);
});