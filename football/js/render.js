/* =========================
   Render tabla + paginación
========================= */

function paginate(rows, page, size) {
  var total = rows.length;
  var pages = Math.max(1, Math.ceil(total / size));
  var p = Math.min(Math.max(1, page), pages);
  var start = (p - 1) * size;
  var end = Math.min(start + size, total);
  return { slice: rows.slice(start, end), page: p, pages, total, start, end };
}

function renderPagination(info) {
  var ul = document.getElementById("pagination");
  var rangeInfo = document.getElementById("rangeInfo");
  if (!ul || !rangeInfo) return;

  rangeInfo.textContent =
    info.total === 0
      ? ""
      : "Mostrando " + (info.start + 1) + "–" + info.end + " de " + info.total;
  ul.innerHTML = "";

  function addItem(label, page, disabled, aria) {
    var li = document.createElement("li");
    li.className = "page-item" + (disabled ? " disabled" : "");
    var a = document.createElement("button");
    a.className = "page-link";
    a.type = "button";
    a.textContent = label;
    if (aria) a.setAttribute("aria-label", aria);
    if (!disabled) {
      a.addEventListener("click", function () {
        __PAGE__ = page;
        render();
      });
    }
    li.appendChild(a);
    ul.appendChild(li);
  }

  addItem("«", info.page - 1, info.page <= 1, "Anterior");

  var maxButtons = 7;
  var start = Math.max(1, info.page - 3);
  var end = Math.min(info.pages, start + maxButtons - 1);
  start = Math.max(1, Math.min(start, end - maxButtons + 1));

  if (start > 1) addItem("1", 1, false);
  if (start > 2) {
    var liDots = document.createElement("li");
    liDots.className = "page-item disabled";
    liDots.innerHTML = '<span class="page-link">…</span>';
    ul.appendChild(liDots);
  }

  for (var p = start; p <= end; p++) {
    var li = document.createElement("li");
    li.className = "page-item" + (p === info.page ? " active" : "");
    var btn = document.createElement("button");
    btn.className = "page-link";
    btn.type = "button";
    btn.textContent = String(p);
    btn.addEventListener(
      "click",
      (function (pageNum) {
        return function () {
          __PAGE__ = pageNum;
          render();
        };
      })(p)
    );
    li.appendChild(btn);
    ul.appendChild(li);
  }

  if (end < info.pages - 1) {
    var liDots2 = document.createElement("li");
    liDots2.className = "page-item disabled";
    liDots2.innerHTML = '<span class="page-link">…</span>';
    ul.appendChild(liDots2);
  }
  if (end < info.pages) addItem(String(info.pages), info.pages, false);

  addItem("»", info.page + 1, info.page >= info.pages, "Siguiente");
}

function renderTable(rows) {
  var tbody = document.querySelector("#matchesTable tbody");
  tbody.innerHTML = "";

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var tr = document.createElement("tr");

    var order = [
      "Jornada",
      "Fecha",
      "Horario",
      "Local",
      "Resultado",
      "Visitante",
    ];

    var tdStar = document.createElement("td");
    tdStar.style.width = "20px";
    var v = r.Horario || "";
    var mostrarAviso = v !== "" && !/^\d{2}:\d{2}$/.test(v);
    tdStar.textContent = mostrarAviso ? "*" : "";
    tdStar.style.color = "red";
    tdStar.style.textAlign = "left";
    tr.appendChild(tdStar);

    for (var j = 0; j < order.length; j++) {
      var k = order[j];
      var td = document.createElement("td");
      td.textContent = r[k] != null ? r[k] : "";
      td.classList.add("text-truncate");
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  var hasRows = __FILTERED_ROWS__.length > 0;
  document.getElementById("tableWrapper").classList.toggle("d-none", !hasRows);
  document.getElementById("emptyState").classList.toggle("d-none", hasRows);
  document.getElementById("count").classList.toggle("d-none", !hasRows);
  document.getElementById("exportAdvise").classList.toggle("d-none", !hasRows);
  document.getElementById("count").textContent =
    __FILTERED_ROWS__.length +
    " " +
    (__FILTERED_ROWS__.length === 1 ? "partido" : "partidos");

  var exportWrapper = document.getElementById("exportWrapper");
  var exportBtn = document.getElementById("exportBtn");
  if (exportWrapper) exportWrapper.classList.toggle("d-none", !hasRows);
  if (exportBtn)
    exportBtn.onclick = function () {
      exportToCalendar(__FILTERED_ROWS__);
    };
}

function render() {
  __FILTERED_ROWS__ = applyFilters(__SOURCE_ROWS__);
  var sorted = sortRows(__FILTERED_ROWS__);
  var info = paginate(sorted, __PAGE__, __PAGE_SIZE__);
  renderTable(info.slice);
  renderPagination(info);
}
