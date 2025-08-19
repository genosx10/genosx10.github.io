  document.addEventListener("DOMContentLoaded", () => {
    const btnPartidos = document.getElementById("seccionPartidos");
    const btnClasificacion = document.getElementById("seccionClasificacion");
    const path = window.location.pathname;

    // Si la ruta incluye "/matches"
    if (path.includes("matches")) {
      btnPartidos.classList.remove("bg-primary-subtle"); // quitamos estilo base
      btnPartidos.classList.add("btn-primary", "active"); // resaltado
    }
    if (path.includes("table")) {
      btnClasificacion.classList.remove("bg-primary-subtle"); // quitamos estilo base
      btnClasificacion.classList.add("btn-primary", "active"); // resaltado
    }
  });