// flags globales simples
window.__ROUNDS_BUILT__ = false;
window.__ROUNDS_WIRED__ = false;

/* =========================
   Generar Jornadas
========================= */
function generateRounds() {
  const ddRoundsMenu = document.getElementById("dropdownRoundsMenu");
  if (!ddRoundsMenu) return;

  // Limpia todo menos el primer <li> (el botón "reset" con id="r")
  while (ddRoundsMenu.children.length > 1) {
    ddRoundsMenu.removeChild(ddRoundsMenu.lastElementChild);
  }

  // Asegura que el botón "Jornada" (id="r") sirve para limpiar
  const resetBtn = document.getElementById("r");
  if (resetBtn) {
    resetBtn.setAttribute("data-value", ""); // limpiar
    resetBtn.textContent = "Jornada";        // texto del botón limpiar
  }

  // Repobla de forma determinista
  for (let i = 1; i <= 38; i++) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "dropdown-item";
    btn.setAttribute("data-value", String(i));
    btn.textContent = `Jornada ${i}`;
    li.appendChild(btn);
    ddRoundsMenu.appendChild(li);
  }

  window.__ROUNDS_BUILT__ = true;
}

function selectRound() {
  if (window.__ROUNDS_WIRED__) return; // evita listeners duplicados

  const menu = document.getElementById("dropdownRoundsMenu");
  const ddMenuBtn = document.getElementById("dropdownMenuBtn");
  const resetBtn = document.getElementById("r");
  if (!menu || !ddMenuBtn || !resetBtn) return;

  menu.addEventListener("click", (e) => {
    const el = e.target.closest("button.dropdown-item");
    if (!el) return;

    const val = el.getAttribute("data-value");
    if (val) {
      window.__ROUND__ = parseInt(val, 10);
      ddMenuBtn.textContent = el.textContent; // "Jornada X"
      resetBtn.classList.remove("d-none");
    } else {
      window.__ROUND__ = null;
      ddMenuBtn.textContent = "Jornada";
      resetBtn.classList.add("d-none");
    }

    __PAGE__ = 1;
    render();
  });

  window.__ROUNDS_WIRED__ = true;
}
