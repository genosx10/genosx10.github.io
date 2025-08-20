function wireFilters() {
  var onChange = debounce(function () {
    __PAGE__ = 1;
    render();
  }, 150);

  document.getElementById("teamFilter").addEventListener("input", onChange);
  document.getElementById("fromDate").addEventListener("input", onChange);
  document.getElementById("toDate").addEventListener("input", onChange);

  document
    .getElementById("clearTeamBtn")
    .addEventListener("click", function () {
      document.getElementById("teamFilter").value = "";
      __PAGE__ = 1;
      render();
    });

  document.getElementById("resetBtn").addEventListener("click", function () {
    document.getElementById("teamFilter").value = "";
    document.getElementById("fromDate").value = "";
    document.getElementById("toDate").value = "";
    document.getElementById("dropdownMenuBtn").textContent = "Jornada";
    document.getElementById("r").classList.add("d-none");

    window.__ROUND__ = null; // 🟢 importante

    __SORT__ = { col: "multi", asc: true };
    __PAGE__ = 1;
    render();
  });
}

/* =========================
   Ordenación por columnas (UI)
========================= */

function wireSorting() {
  var headers = document.querySelectorAll("th[data-col]");

  function updateIcons(activeCol) {
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i];
      var icon = h.querySelector(".sort-icon");
      h.classList.remove("active");
      if (icon) icon.className = "bi sort-icon bi-arrow-down-up";
    }
    if (activeCol) {
      var th = Array.prototype.find.call(headers, function (el) {
        return el.getAttribute("data-col") === activeCol;
      });
      if (th) {
        var ic = th.querySelector(".sort-icon");
        th.classList.add("active");
        if (ic)
          ic.className = __SORT__.asc
            ? "bi sort-icon bi-arrow-up"
            : "bi sort-icon bi-arrow-down";
      }
    }
  }

  function handleSort(col) {
    if (__SORT__.col !== col) {
      __SORT__ = { col: col, asc: true };
    } else if (__SORT__.asc) {
      __SORT__.asc = false;
    } else {
      __SORT__ = { col: "multi", asc: true };
      col = null;
    }
    updateIcons(col);
    __PAGE__ = 1;
    render();
  }

  function attach(th) {
    var col = th.getAttribute("data-col");
    // No ordenar por estas columnas
    if (["Resultado", "Fecha", "Horario", "Local", "Visitante"].includes(col)) {
      th.classList.remove("active");
      var ic = th.querySelector(".sort-icon");
      if (ic) ic.className = "bi sort-icon bi-arrow-down-up";
      th.style.cursor = "default";
      th.setAttribute("aria-disabled", "true");
      return;
    }
    th.addEventListener("click", function () {
      handleSort(col);
    });
    th.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSort(col);
      }
    });
  }

  for (var i = 0; i < headers.length; i++) attach(headers[i]);
  updateIcons(null);
}
