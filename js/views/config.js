import { $, $$, esc, toast, confirmDialog, todayStr, fmtShort } from "../util.js?v=18";
import { getClosedWeekdays, setClosedWeekdays, listVacations, addVacation, deleteVacation } from "../store.js?v=18";

// orden de visualización lun→dom; el valor es el getDay() de JS (0=domingo)
const WEEKDAYS = [[1, "Lunes"], [2, "Martes"], [3, "Miércoles"], [4, "Jueves"], [5, "Viernes"], [6, "Sábado"], [0, "Domingo"]];
const wdName = (d) => (WEEKDAYS.find(([v]) => v === d) || [, ""])[1];

export function renderConfig(root) {
  root.innerHTML = `
    <div class="page-head">
      <div><h2>Ajustes del negocio</h2><p class="sub">Días de cierre semanal y vacaciones</p></div>
    </div>
    <div class="section-card" style="margin-bottom:16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <b>Cómo se marcan en la agenda:</b>
      <div class="closed-legend">
        <span class="legend-chip lc-weekly">✕ Cierre semanal</span>
        <span class="legend-chip lc-vac">🌴 Vacaciones</span>
      </div>
    </div>
    <div class="grid-2">
      <div class="section-card">
        <h3>Cierre semanal</h3>
        <p class="muted" style="font-size:.82rem;margin-bottom:12px">Elige los días que el salón cierra cada semana. No se podrán dar citas en esos días.</p>
        <div id="cfg-week" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px"></div>
        <div id="cfg-week-tags" style="display:flex;gap:8px;flex-wrap:wrap"></div>
      </div>
      <div class="section-card">
        <h3>Vacaciones / cierres puntuales</h3>
        <div class="form-grid">
          <div class="row-2">
            <label>Desde <input id="vac-from" type="date" value="${todayStr()}" /></label>
            <label>Hasta <input id="vac-to" type="date" value="${todayStr()}" /></label>
          </div>
          <label>Motivo (opcional) <input id="vac-note" placeholder="Vacaciones, festivo, cierre..." /></label>
          <button class="btn btn-primary btn-sm" id="vac-add">+ Añadir vacaciones</button>
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
    toast("Vacaciones añadidas");
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
  const tags = () => {
    const sel = $$("[data-wd]", box).filter((x) => x.checked).map((x) => Number(x.dataset.wd));
    $("#cfg-week-tags", root).innerHTML = sel.length
      ? sel.sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)).map((d) => `<span class="day-pill">✕ ${wdName(d)}</span>`).join("")
      : `<span class="muted" style="font-size:.8rem">Ningún día cerrado por ahora.</span>`;
  };
  $$("[data-wd]", box).forEach((cb) => (cb.onchange = () => {
    const arr = $$("[data-wd]", box).filter((x) => x.checked).map((x) => Number(x.dataset.wd));
    setClosedWeekdays(arr);
    tags();
    toast("Horario actualizado");
  }));
  tags();
}

function drawVacations(root) {
  const list = listVacations();
  const box = $("#vac-list", root);
  box.innerHTML = list.length ? "" : `<p class="empty">No hay vacaciones programadas.</p>`;
  for (const v of list) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row-main"><h4><span class="legend-chip lc-vac" style="margin-right:8px;padding:1px 9px">🌴</span>${fmtShort(v.from)}${v.to !== v.from ? ` – ${fmtShort(v.to)}` : ""}</h4><p>${esc(v.note || "Cerrado")}</p></div>
      <div class="row-actions"><button class="icon-btn del" data-del title="Quitar">🗑</button></div>`;
    row.querySelector("[data-del]").onclick = () => { if (confirmDialog("¿Quitar estas vacaciones?")) { deleteVacation(v.id); drawVacations(root); } };
    box.appendChild(row);
  }
}
