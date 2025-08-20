/* =========================
   Generar Jornadas
========================= */

function generateRounds() {
  let ddRoundsMenu = document.getElementById("dropdownRoundsMenu");

  for (let i = 1; i <= 38; i++) {
    let ddRoundsLi = document.createElement("li");
    let ddRoundsBtn = document.createElement("button");

    ddRoundsLi.appendChild(ddRoundsBtn);
    ddRoundsBtn.id = `r${i}`;
    ddRoundsBtn.textContent = `Jornada ${i}`;
    ddRoundsBtn.classList.add("dropdown-item");

    ddRoundsMenu.appendChild(ddRoundsLi);
  }
}

function selectRound() {
  let ddRoundsMenu = document.getElementById("dropdownRoundsMenu");
  let ddMenuBtn = document.getElementById("dropdownMenuBtn");
  ddRoundsMenu.addEventListener("click", (e) => {
    if (e.target.id != "r") {
      document.getElementById("r").classList.remove("d-none");
      ddMenuBtn.textContent = e.target.textContent;
    } else {
      document.getElementById("r").classList.add("d-none");
      ddMenuBtn.textContent = e.target.textContent;
    }
  });
}