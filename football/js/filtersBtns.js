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

const activeClasses   = ["bg-success-subtle", "text-success-emphasis", "border-success-subtle"];
const inactiveClasses = ["bg-body", "text-body-secondary", "border"];

const activate = (activeBtn, inactiveBtn, showEl, hideEl) => {
  swapClasses(activeBtn,  inactiveClasses, activeClasses);
  swapClasses(inactiveBtn, activeClasses,   inactiveClasses);

  showEl.classList.remove("d-none");
  hideEl.classList.add("d-none");

  activeBtn.setAttribute("aria-selected", "true");
  inactiveBtn.setAttribute("aria-selected", "false");

  if (typeof wireFilters === "function") wireFilters();
  if (showEl === teamsDate && typeof wireSorting === "function") wireSorting();
};

// listeners
roundBtn.addEventListener("click", () => {
  activate(roundBtn, teamDateBtn, rounds, teamsDate);
});

teamDateBtn.addEventListener("click", () => {
  activate(teamDateBtn, roundBtn, teamsDate, rounds);
});
