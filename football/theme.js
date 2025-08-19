
/* =========================
   Estilo
========================= */

      // Si ya lo haces en script.js, puedes omitir esto.
      (function () {
        const select = document.getElementById('theme');
        const root = document.documentElement; // <html>

        // Inicializa según localStorage o atributo actual
        const saved = localStorage.getItem('theme');
        if (saved) {
          root.setAttribute('data-bs-theme', saved);
          select.value = saved;
        } else {
          select.value = root.getAttribute('data-bs-theme') || 'light';
        }

        select.addEventListener('change', (e) => {
          const val = e.target.value;
          root.setAttribute('data-bs-theme', val);
          localStorage.setItem('theme', val);
        });
      })();