import { $, $$, esc, toast, confirmDialog, todayStr, fmtShort } from "../util.js?v=14";
import { getClosedWeekdays, setClosedWeekdays, listVacations, addVacation, deleteVacation } from "../store.js?v=14";

// orden de visualización lun→dom; el valor es el getDay() de JS (0=domingo)
const WEEKDAYS = [[1, "Lunes"], [2, "Martes"], [3, "Miércoles"], [4, "Jueves"], [5, "Viernes"], [6, "Sábado"], [0, "Domingo"]];

export function renderConfig(root) {
  root.innerHTML = `
    <div class="page-head">
      <div><h2>Ajustes</h2><p class="sub">Días de cierre del negocio y vacaciones</p></div>
    </div>
    <div class="grid-2">
      <div class="section-card">
        <h3>Días de cierre semanal</h3>
        <p class="muted" style="font-size:.82rem;margin-bottom:12px">Marca los días que el salón cierra cada semana. No se podrán dar citas en esos días.</p>
        <div id="cfg-week" style="display:flex;flex-direction:column;gap:8px"></div>
      </div>
      <div class="section-card">
        <h3>Vacaciones / cierres puntuales</h3>
        <div class="form-grid">
          <div class="row-2">
            <label>Desde <input id="vac-from" type="date" value="${todayStr()}" /></label>
            <label>Hasta <input id="vac-to" type="date" value="${todayStr()}" /></label>
          </div>
          <label>Motivo (opcional) <input id="vac-note" placeholder="Vacaciones, festivo, cierre..." /></label>
          <button class="btn btn-primary btn-sm" id="vac-add">+ Añadir cierre</button>
          <div class="field"><label>Cierres programados</label><div class="list" id="vac-list"></div></div>
        </div>
      </div>
    </div>`;

  drawWeek(root);
  drawVacations(root);

  $("#vac-add", root).onclick = () => {
    const from = $("#vac-from", root).value;
    const to = $("#vac-to", root).value || from;
    if (!from) { toast("Indica la fecha"); return; }
    if (to < from) { toast("La fecha 'hasta' es anterior a 'desde'"); return; }
    addVacation(from, to, $("#vac-note", root).value.trim());
    $("#vac-note", root).value = "";
    toast("Cierre añadido");
    drawVacations(root);
  };
}

function drawWeek(root) {
  const closed = getClosedWeekdays();
  const box = $("#cfg-week", root);
  box.innerHTML = WEEKDAYS.map(([d, name]) => `
    <label style="flex-direction:row;align-items:center;gap:10px;cursor:pointer">
      <input type="checkbox" data-wd="${d}" ${closed.includes(d) ? "checked" : ""} style="width:auto" />
      <span>${name}</span>
    </label>`).join("");
  $$("[data-wd]", box).forEach((cb) => (cb.onchange = () => {
    const arr = $$("[data-wd]", box).filter((x) => x.checked).map((x) => Number(x.dataset.wd));
    setClosedWeekdays(arr);
    toast("Horario actualizado");
  }));
}

function drawVacations(root) {
  const list = listVacations();
  const box = $("#vac-list", root);
  box.innerHTML = list.length ? "" : `<p class="empty">No hay cierres programados.</p>`;
  for (const v of list) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row-main"><h4>${fmtShort(v.from)}${v.to !== v.from ? ` – ${fmtShort(v.to)}` : ""}</h4><p>${esc(v.note || "Cerrado")}</p></div>
      <div class="row-actions"><button class="icon-btn del" data-del title="Quitar">🗑</button></div>`;
    row.querySelector("[data-del]").onclick = () => { if (confirmDialog("¿Quitar este cierre?")) { deleteVacation(v.id); drawVacations(root); } };
    box.appendChild(row);
  }
}
