  document.addEventListener("DOMContentLoaded", () => {
    const laLigaBtn = document.getElementById("laLigaMatches");
    const laLiga2Btn = document.getElementById("laLiga2Matches");
    const path = window.location.pathname;

    console.log(path)
    // Si la ruta incluye "/matches"
    if (path.match("/football/laliga/matches/")) {
      laLigaBtn.classList.remove("bg-primary-subtle"); // quitamos estilo base
      laLigaBtn.classList.add("btn-primary", "active"); // resaltado
    }
    if (path.match("/football/laliga2/matches/")) {
      laLiga2Btn.classList.remove("bg-primary-subtle"); // quitamos estilo base
      laLiga2Btn.classList.add("btn-primary", "active"); // resaltado
    }
  });