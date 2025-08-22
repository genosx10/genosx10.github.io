/* =========================
   Estilo
========================= */

// Si ya lo haces en script.js, puedes omitir esto.
(function () {
  const selects = document.querySelectorAll(".theme-select");
  const root = document.documentElement; // <html>

  // Inicializa según localStorage o atributo actual
  const saved = localStorage.getItem("theme");
  const initial = saved || root.getAttribute("data-bs-theme") || "light";
  selects.forEach((s) => (s.value = initial));
  root.setAttribute("data-bs-theme", initial);

  // Sincroniza todos los selectores
  selects.forEach((select) => {
    select.addEventListener("change", (e) => {
      const val = e.target.value;
      root.setAttribute("data-bs-theme", val);
      localStorage.setItem("theme", val);
      selects.forEach((s) => {
        if (s.value !== val) s.value = val;
      });
    });
  });
})();
