import { $, $$, esc, openModal, toast, confirmDialog, whatsapp, eur, uid, todayStr, addDays, weekStart, parseDate, dateToStr, dowShort, fmtLong, fmtShort } from "../util.js?v=7";
import { apptsByDate, apptsBetween, getAppt, upsertAppt, deleteAppt, listClients, getClient, listProducts, getProduct, nextTicketNo } from "../store.js?v=7";

const START_H = 9, END_H = 21;
const STATUS = [
  ["pendiente", "Pendiente"], ["confirmada", "Confirmada"],
  ["completada", "Completada"], ["no_show", "No se presentó"], ["cancelada", "Cancelada"],
];
let view = "semana";
let anchor = todayStr();

export function renderAgenda(root) {
  root.innerHTML = `
    <div class="page-head">
      <div><h2>Agenda</h2><p class="sub" id="ag-sub"></p></div>
      <div class="head-actions">
        <div class="seg" id="ag-seg">
          <button data-v="semana">Semana</button>
          <button data-v="dia">Día</button>
        </div>
        <div class="nav-week">
          <button class="icon-btn" id="ag-prev">‹</button>
          <button class="btn btn-soft btn-sm" id="ag-today">Hoy</button>
          <button class="icon-btn" id="ag-next">›</button>
        </div>
        <button class="btn btn-primary" id="ag-new">+ Nueva cita</button>
      </div>
    </div>
    <div id="ag-body"></div>`;

  $$("#ag-seg button", root).forEach((b) => {
    b.classList.toggle("active", b.dataset.v === view);
    b.onclick = () => { view = b.dataset.v; renderAgenda(root); };
  });
  $("#ag-prev", root).onclick = () => { anchor = addDays(anchor, view === "semana" ? -7 : -1); renderAgenda(root); };
  $("#ag-next", root).onclick = () => { anchor = addDays(anchor, view === "semana" ? 7 : 1); renderAgenda(root); };
  $("#ag-today", root).onclick = () => { anchor = todayStr(); renderAgenda(root); };
  $("#ag-new", root).onclick = () => editAppt(null, { date: anchor, time: "10:00" }, () => renderAgenda(root));

  if (view === "semana") drawWeek(root); else drawDay(root);
}

function drawWeek(root) {
  const start = weekStart(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  $("#ag-sub", root).textContent = `${fmtShort(days[0])} – ${fmtShort(days[6])}`;
  const today = todayStr();

  let head = `<div class="cal-corner"></div>`;
  for (const d of days) {
    head += `<div class="cal-dayhead ${d === today ? "today" : ""}"><div class="dn">${dowShort(d)}</div><div class="dd">${parseDate(d).getDate()}</div></div>`;
  }
  let rows = "";
  for (let h = START_H; h < END_H; h++) {
    rows += `<div class="cal-hour">${String(h).padStart(2, "0")}:00</div>`;
    for (const d of days) {
      const items = apptsByDate(d).filter((a) => clampH(a.time) === h);
      const chips = items.map((a) => chipHTML(a)).join("");
      rows += `<div class="cal-cell" data-date="${d}" data-hour="${h}">${chips}</div>`;
    }
  }
  $("#ag-body", root).innerHTML = `<div class="cal"><div class="cal-grid" style="--cols:7">${head}${rows}</div></div>`;
  wireCells(root);
}

function drawDay(root) {
  $("#ag-sub", root).textContent = fmtLong(anchor);
  const items = apptsByDate(anchor);
  const body = $("#ag-body", root);
  if (!items.length) { body.innerHTML = `<p class="empty">No hay citas este día. Pulsa “+ Nueva cita”.</p>`; return; }
  const list = document.createElement("div");
  list.className = "list day-list";
  for (const a of items) {
    const detail = (a.sale ? a.sale.lines.map((l) => l.name) : (a.items || []).map((i) => i.name)).join(", ") || "—";
    const amount = a.sale ? ` · ${eur(a.sale.total)}` : "";
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="time-badge"><b>${esc(a.time)}</b><span>${a.durationMin || 30}'</span></div>
      <div class="row-main">
        <h4>${esc(a.clientName)} <span class="tag s-${a.status}">${a.status.replace("_", " ")}</span></h4>
        <p>${esc(detail)}${amount}</p>
      </div>
      <div class="row-actions">
        ${a.status !== "completada" ? `<button class="icon-btn" data-act="done" title="Completar y cobrar">💶</button>` : ""}
        <button class="icon-btn wa" data-act="wa" title="Recordatorio WhatsApp">💬</button>
        <button class="icon-btn" data-act="edit" title="Editar">✏️</button>
        <button class="icon-btn del" data-act="del" title="Eliminar">🗑</button>
      </div>`;
    row.querySelector('[data-act="edit"]').onclick = () => editAppt(a.id, null, () => renderAgenda(root));
    if (a.status !== "completada") row.querySelector('[data-act="done"]').onclick = () => checkout(a.id, () => renderAgenda(root));
    row.querySelector('[data-act="wa"]').onclick = () => remind(a);
    row.querySelector('[data-act="del"]').onclick = () => { if (confirmDialog("¿Eliminar la cita?")) { deleteAppt(a.id); renderAgenda(root); } };
    list.appendChild(row);
  }
  body.innerHTML = "";
  body.appendChild(list);
}

function clampH(time) { return Math.min(Math.max(parseInt(time.split(":")[0], 10) || START_H, START_H), END_H - 1); }

function chipHTML(a) {
  const svc = (a.sale ? a.sale.lines.map((l) => l.name) : (a.items || []).map((i) => i.name)).join(", ");
  return `<div class="chip s-${a.status}" data-appt="${a.id}"><b>${esc(a.time)}</b> ${esc(a.clientName)}<br><span class="muted">${esc(svc || "—")}</span></div>`;
}

function wireCells(root) {
  $$(".cal-cell", root).forEach((cell) => {
    cell.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-appt]");
      if (chip) { e.stopPropagation(); editAppt(chip.dataset.appt, null, () => renderAgenda(root)); return; }
      editAppt(null, { date: cell.dataset.date, time: `${String(cell.dataset.hour).padStart(2, "0")}:00` }, () => renderAgenda(root));
    });
  });
}

function remind(a) {
  whatsapp(a.phone, `Hola ${a.clientName}, te recordamos tu cita en Peluquería Rossi el ${fmtLong(a.date)} a las ${a.time}. ¡Te esperamos! ✂️`);
}

// ---------- editor de cita ----------
function editAppt(id, preset, onDone) {
  const a = id ? { ...getAppt(id) } : { status: "pendiente", durationMin: 30, items: [], ...preset };
  const clients = listClients();
  const services = listProducts(true);
  const isPast = (a.date || todayStr()) < todayStr();
  const remindDefault = a.remind != null ? a.remind : !isPast;
  const body = `
    <div class="form-grid">
      <label>Cliente
        <input id="f-client" list="cli-dl" value="${esc(a.clientName || "")}" placeholder="Nombre del cliente" />
        <datalist id="cli-dl">${clients.map((c) => `<option value="${esc(c.name)}">`).join("")}</datalist>
      </label>
      <div class="row-2">
        <label>Teléfono <input id="f-phone" type="tel" value="${esc(a.phone || "")}" placeholder="+34..." /></label>
        <label>Estado <select id="f-status">${STATUS.map(([v, t]) => `<option value="${v}" ${a.status === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      </div>
      <div class="row-2">
        <label>Fecha <input id="f-date" type="date" value="${esc(a.date || todayStr())}" /></label>
        <label>Hora <input id="f-time" type="time" value="${esc(a.time || "10:00")}" /></label>
        <label>Duración (min) <input id="f-dur" type="number" min="5" step="5" value="${a.durationMin || 30}" /></label>
      </div>
      <div class="field">
        <label>Servicios previstos</label>
        <div class="lines-head" style="display:grid;grid-template-columns:1fr 86px 36px;gap:8px;font-size:.7rem;color:var(--muted);margin-bottom:4px"><span>Concepto</span><span>Precio €</span><span></span></div>
        <div id="f-items"></div>
        <button type="button" class="btn btn-soft btn-sm" id="add-item">+ Añadir servicio</button>
      </div>
      <label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="f-remind" ${remindDefault ? "checked" : ""} style="width:auto" /> Enviar recordatorio por WhatsApp al crear (citas futuras)</label>
      <label>Nota <textarea id="f-note" placeholder="Observaciones...">${esc(a.note || "")}</textarea></label>
    </div>`;

  const m = openModal({
    title: id ? "Editar cita" : "Nueva cita",
    body,
    saveLabel: "Guardar",
    extra: id && a.status !== "completada" ? [
      { label: "💶 Completar y cobrar", cls: "btn-primary", onClick: (mm, close) => { close(); checkout(id, onDone); } },
      { label: "🗑", cls: "btn-danger", onClick: () => { if (confirmDialog("¿Eliminar la cita?")) { deleteAppt(id); onDone && onDone(); } else return false; } },
    ] : [],
    onSave: (mm) => {
      const name = $("#f-client", mm).value.trim();
      if (!name) { toast("Indica el cliente"); return false; }
      const items = readLines(mm.querySelector("#f-items"), false);
      const cli = clients.find((c) => c.name.toLowerCase() === name.toLowerCase());
      const remindOn = $("#f-remind", mm).checked;
      const saved = upsertAppt({
        id, clientId: cli ? cli.id : (a.clientId || null), clientName: name,
        phone: $("#f-phone", mm).value.trim(), status: $("#f-status", mm).value,
        date: $("#f-date", mm).value, time: $("#f-time", mm).value, durationMin: Number($("#f-dur", mm).value) || 30,
        items, note: $("#f-note", mm).value.trim(), sale: a.sale, remind: remindOn,
      });
      toast("Cita guardada");
      onDone && onDone();
      // recordatorio solo al CREAR una cita futura y con la opción marcada
      if (!id && remindOn && saved.date >= todayStr()) remind(saved);
    },
  });

  // autocompletar teléfono al elegir cliente
  $("#f-client", m).addEventListener("change", () => {
    const c = clients.find((x) => x.name.toLowerCase() === $("#f-client", m).value.trim().toLowerCase());
    if (c && !$("#f-phone", m).value) $("#f-phone", m).value = c.phone || "";
  });
  // al cambiar la fecha, ajusta el recordatorio por defecto (futura sí / pasada no)
  $("#f-date", m).addEventListener("change", () => { $("#f-remind", m).checked = $("#f-date", m).value >= todayStr(); });
  const cont = $("#f-items", m);
  (a.items && a.items.length ? a.items : []).forEach((it) => addLine(cont, services, it, false));
  $("#add-item", m).onclick = () => addLine(cont, services, null, false);
}

// ---------- cobro (checkout) ----------
function checkout(id, onDone) {
  const a = getAppt(id);
  const services = listProducts(true);
  const initial = (a.items && a.items.length) ? a.items : [];
  const body = `
    <div class="form-grid">
      <p class="muted">${esc(a.clientName)} · ${esc(a.date)} ${esc(a.time)}</p>
      <div class="field">
        <label>Conceptos cobrados (precio editable por cliente)</label>
        <div class="lines-head" style="display:grid;grid-template-columns:1fr 86px 70px 36px;gap:8px;font-size:.7rem;color:var(--muted);margin-bottom:4px"><span>Concepto</span><span>Precio €</span><span>Cant.</span><span></span></div>
        <div id="co-items"></div>
        <button type="button" class="btn btn-soft btn-sm" id="co-add">+ Añadir concepto</button>
        <p class="muted" style="font-size:.76rem;margin-top:6px">Puedes añadir varios conceptos en la misma cita (p. ej. labios + corte).</p>
      </div>
      <label>Método de pago
        <select id="co-method">
          <option value="efectivo" ${a.sale && a.sale.method === "efectivo" ? "selected" : ""}>💵 Efectivo</option>
          <option value="tarjeta" ${a.sale && a.sale.method === "tarjeta" ? "selected" : ""}>💳 Tarjeta</option>
        </select>
      </label>
      <div class="checkout-total"><span>Total a cobrar</span><span class="big" id="co-total">€0,00</span></div>
    </div>`;
  const m = openModal({
    title: "Completar y cobrar",
    body,
    saveLabel: "Cobrar y completar",
    onSave: (mm) => {
      const lines = readLines(mm.querySelector("#co-items"), true);
      if (!lines.length) { toast("Añade al menos un concepto"); return false; }
      const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
      const cost = lines.reduce((s, l) => s + l.cost * l.qty, 0);
      const method = $("#co-method", mm).value;
      upsertAppt({ id, status: "completada", sale: { completedAt: todayStr(), method, ticketNo: nextTicketNo(), lines, total, cost, profit: total - cost } });
      toast(`Cobrado ${eur(total)} · ${method === "tarjeta" ? "tarjeta" : "efectivo"}`);
      onDone && onDone();
    },
  });
  const cont = $("#co-items", m);
  const recalc = () => {
    const lines = readLines(cont, true);
    $("#co-total", m).textContent = eur(lines.reduce((s, l) => s + l.price * l.qty, 0));
  };
  (initial.length ? initial : [null]).forEach((it) => addLine(cont, services, it, true, recalc));
  $("#co-add", m).onclick = () => addLine(cont, services, null, true, recalc);
  recalc();
}

// ---------- widget de líneas ----------
function addLine(container, services, line, withQty, onChange) {
  const el = document.createElement("div");
  el.className = "line";
  if (!withQty) el.style.gridTemplateColumns = "1fr 86px 36px";
  const opts = services.map((p) => `<option value="${p.id}" ${line && line.productId === p.id ? "selected" : ""}>${esc(p.name)} — ${eur(p.price)}</option>`).join("");
  el.innerHTML = `
    <select data-prod><option value="">— elegir —</option>${opts}</select>
    <input data-price type="number" step="0.01" min="0" value="${line && line.price != null ? line.price : ""}" placeholder="0,00" />
    ${withQty ? `<input data-qty type="number" min="1" value="${line && line.qty ? line.qty : 1}" />` : ""}
    <button type="button" class="icon-btn del" data-rm title="Quitar">✕</button>`;
  const sel = el.querySelector("[data-prod]"), price = el.querySelector("[data-price]");
  sel.addEventListener("change", () => { const p = getProduct(sel.value); if (p) price.value = p.price; onChange && onChange(); });
  price.addEventListener("input", () => onChange && onChange());
  const qty = el.querySelector("[data-qty]"); if (qty) qty.addEventListener("input", () => onChange && onChange());
  el.querySelector("[data-rm]").onclick = () => { el.remove(); onChange && onChange(); };
  container.appendChild(el);
}

function readLines(container, withQty) {
  return [...container.querySelectorAll(".line")].map((el) => {
    const sel = el.querySelector("[data-prod]");
    const p = getProduct(sel.value);
    const price = Number(el.querySelector("[data-price]").value) || 0;
    const qty = withQty ? (Number(el.querySelector("[data-qty]").value) || 1) : 1;
    const name = p ? p.name : (sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text.split(" — ")[0] : "");
    if (!sel.value && !price) return null;
    return withQty
      ? { productId: sel.value || null, name, price, cost: p ? p.cost : 0, qty }
      : { productId: sel.value || null, name, price };
  }).filter(Boolean);
}
