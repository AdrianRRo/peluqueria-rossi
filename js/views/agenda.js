import { $, $$, esc, openModal, toast, confirmDialog, whatsapp, eur, uid, todayStr, addDays, weekStart, parseDate, dateToStr, dowShort, fmtLong, fmtShort } from "../util.js?v=19";
import { apptsByDate, apptsBetween, getAppt, upsertAppt, deleteAppt, listClients, getClient, upsertClient, listProducts, getProduct, nextTicketNo, consumeStock, closedInfo } from "../store.js?v=19";
import { apiNotify } from "../api.js?v=19";

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
  const cl = {}; days.forEach((d) => (cl[d] = closedInfo(d)));

  const clsOf = (c) => (c ? (c.type === "vac" ? "closed closed-vac" : "closed closed-weekly") : "");

  let head = `<div class="cal-corner"></div>`;
  for (const d of days) {
    const c = cl[d];
    head += `<div class="cal-dayhead ${d === today ? "today" : ""} ${clsOf(c)}"><div class="dn">${dowShort(d)}${c ? (c.type === "vac" ? " 🌴" : " ✕") : ""}</div><div class="dd">${parseDate(d).getDate()}</div></div>`;
  }
  let rows = "";
  for (let h = START_H; h < END_H; h++) {
    rows += `<div class="cal-hour">${String(h).padStart(2, "0")}:00</div>`;
    for (const d of days) {
      const items = apptsByDate(d).filter((a) => a.kind !== "venta" && clampH(a.time) === h);
      const chips = items.map((a) => chipHTML(a)).join("");
      rows += `<div class="cal-cell ${clsOf(cl[d])}" data-date="${d}" data-hour="${h}" ${cl[d] ? `title="${esc(cl[d].label)}"` : ""}>${chips}</div>`;
    }
  }
  $("#ag-body", root).innerHTML = `<div class="cal"><div class="cal-grid" style="--cols:7">${head}${rows}</div></div>`;
  wireCells(root);
}

function drawDay(root) {
  $("#ag-sub", root).textContent = fmtLong(anchor);
  const items = apptsByDate(anchor).filter((a) => a.kind !== "venta");
  const body = $("#ag-body", root);
  const cl = closedInfo(anchor);
  const banner = cl ? `<div class="section-card" style="margin-bottom:14px;border-color:var(--accent);background:var(--accent-soft, var(--bg-soft))"><b>${cl.type === "vac" ? "🌴" : "✕"} Día cerrado</b> · ${esc(cl.label)} <span class="muted">— no se dan citas</span></div>` : "";
  if (!items.length) { body.innerHTML = banner + `<p class="empty">No hay citas este día.${cl ? "" : " Pulsa “+ Nueva cita”."}</p>`; return; }
  const list = document.createElement("div");
  list.className = "list day-list";
  for (const a of items) {
    const detail = (a.sale ? a.sale.lines.map((l) => l.name) : (a.items || []).map((i) => i.name)).join(", ") || "—";
    const amount = a.sale ? ` · ${eur(a.sale.total)}` : "";
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="time-badge"><b>${esc(a.time)}</b><span>${esc(endOf(a))}</span></div>
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
  body.innerHTML = banner;
  body.appendChild(list);
}

function clampH(time) { return Math.min(Math.max(parseInt(time.split(":")[0], 10) || START_H, START_H), END_H - 1); }
function toMin(t) { const [h, m] = (t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); }
function addMin(t, mins) { const v = toMin(t) + (mins || 0); const h = Math.floor(v / 60) % 24, m = v % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; }
function diffMin(a, b) { return toMin(b) - toMin(a); }
function endOf(a) { return a.endTime || addMin(a.time, a.durationMin || 30); }

// paleta de fondos pastel (texto oscuro legible en ambos temas)
const CHIP_BG = ["#fde2e4", "#dfe7fd", "#e2f0cb", "#fff1cc", "#ece2f7", "#d8f3f0", "#ffe0d6", "#dfeffb", "#fbe0ef", "#e6efd9"];
const STATUS_BORDER = { pendiente: "#c98aa0", confirmada: "#3f7ddc", completada: "#2e9e5b", no_show: "#d99a2b", cancelada: "#9a8fa8" };
function hashIdx(str, n) { let h = 0; for (let i = 0; i < (str || "").length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h % n; }
function chipStyle(a) {
  const bg = CHIP_BG[hashIdx(a.clientName || a.id, CHIP_BG.length)];
  const bd = STATUS_BORDER[a.status] || "#c98aa0";
  const txt = a.status === "cancelada" ? "rgba(36,34,45,.6)" : "#241a2d";
  return `background:${bg};color:${txt};border-left-color:${bd}${a.status === "cancelada" ? ";text-decoration:line-through" : ""}`;
}
function chipHTML(a) {
  const svc = (a.sale ? a.sale.lines.map((l) => l.name) : (a.items || []).map((i) => i.name)).join(", ");
  return `<div class="chip" data-appt="${a.id}" style="${chipStyle(a)}"><b>${esc(a.time)}</b> ${esc(a.clientName)}<br><span style="opacity:.7">${esc(svc || "—")}</span></div>`;
}

function wireCells(root) {
  $$(".cal-cell", root).forEach((cell) => {
    cell.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-appt]");
      if (chip) { e.stopPropagation(); editAppt(chip.dataset.appt, null, () => renderAgenda(root)); return; }
      const cl = closedInfo(cell.dataset.date);
      if (cl) { toast(`${cl.label}. Cámbialo en Ajustes.`); return; }
      editAppt(null, { date: cell.dataset.date, time: `${String(cell.dataset.hour).padStart(2, "0")}:00` }, () => renderAgenda(root));
    });
  });
}

function reminderText(a) {
  return `Hola ${a.clientName}, te recordamos tu cita en Rossi salón para el día ${fmtLong(a.date)} a las ${a.time}, ¿me confirmas por favor?`;
}
// Envía el WhatsApp al teléfono del cliente automáticamente vía el backend (bot).
// Si no hay teléfono avisa; si el backend falla, abre wa.me como respaldo.
async function remind(a) {
  const phone = (a.phone || "").trim();
  if (!phone) { toast("La cita no tiene teléfono del cliente"); return; }
  const text = reminderText(a);
  try {
    const res = await apiNotify(phone, text);
    if (res && res.sent === false) toast("Envío de WhatsApp desactivado por ahora");
    else toast("WhatsApp enviado al cliente ✅");
  } catch (e) {
    toast("No se pudo enviar automático; abriendo WhatsApp…");
    whatsapp(phone, text);
  }
}

// ---------- editor de cita ----------
function editAppt(id, preset, onDone) {
  const a = id ? { ...getAppt(id) } : { status: "pendiente", durationMin: 30, items: [], ...preset };
  const clients = listClients();
  const services = listProducts(true);
  const isPast = (a.date || todayStr()) < todayStr();
  const remindDefault = a.remind != null ? a.remind : !isPast;
  const known = a.clientId && clients.some((c) => c.id === a.clientId);
  const keepLegacy = !known && a.clientName; // cita antigua sin cliente en la lista
  const body = `
    <div class="form-grid">
      <label>Cliente
        <select id="f-client-sel">
          <option value="">— Selecciona cliente —</option>
          ${keepLegacy ? `<option value="__keep__" selected>${esc(a.clientName)} (actual)</option>` : ""}
          ${clients.map((c) => `<option value="${c.id}" ${known && a.clientId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
          <option value="__new__">➕ Nuevo cliente…</option>
        </select>
      </label>
      <label id="f-newclient-wrap" hidden>Nombre del nuevo cliente
        <input id="f-newname" placeholder="Nombre y apellidos" />
      </label>
      <div class="row-2">
        <label>Teléfono <input id="f-phone" type="tel" value="${esc(a.phone || "")}" placeholder="+34..." /></label>
        <label>Estado <select id="f-status">${STATUS.map(([v, t]) => `<option value="${v}" ${a.status === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      </div>
      <div class="row-2">
        <label>Fecha <input id="f-date" type="date" value="${esc(a.date || todayStr())}" /></label>
        <label>Desde <input id="f-time" type="time" value="${esc(a.time || "10:00")}" /></label>
        <label>Hasta <input id="f-end" type="time" value="${esc(a.endTime || addMin(a.time || "10:00", a.durationMin || 30))}" /></label>
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
    extra: id ? [
      ...(a.status !== "completada" ? [{ label: "💶 Completar y cobrar", cls: "btn-primary", onClick: (mm, close) => { close(); checkout(id, onDone); } }] : []),
      { label: "🗑 Eliminar", cls: "btn-danger", onClick: () => { if (confirmDialog("¿Eliminar la cita?")) { deleteAppt(id); onDone && onDone(); } else return false; } },
    ] : [],
    onSave: (mm) => {
      const sel = $("#f-client-sel", mm).value;
      let phone = $("#f-phone", mm).value.trim();
      let clientId = null, clientName = "";
      if (sel === "__new__") {
        clientName = $("#f-newname", mm).value.trim();
        if (!clientName) { toast("Indica el nombre del nuevo cliente"); return false; }
        const c = upsertClient({ name: clientName, phone });
        clientId = c.id;
      } else if (sel === "__keep__") {
        clientId = a.clientId || null; clientName = a.clientName || "";
      } else if (sel) {
        const c = getClient(sel); clientId = c.id; clientName = c.name;
        if (!phone) phone = c.phone || "";
      } else {
        toast("Selecciona un cliente o crea uno nuevo"); return false;
      }
      const date = $("#f-date", mm).value;
      const cl = closedInfo(date);
      if (cl && !confirmDialog(`Ese día está cerrado (${cl.label}). ¿Crear la cita igualmente?`)) return false;
      const time = $("#f-time", mm).value;
      const endTime = $("#f-end", mm).value;
      if (endTime && diffMin(time, endTime) <= 0) { toast("La hora 'hasta' debe ser posterior a la de inicio"); return false; }
      const durationMin = endTime ? diffMin(time, endTime) : (a.durationMin || 30);
      const items = readLines(mm.querySelector("#f-items"), false);
      const remindOn = $("#f-remind", mm).checked;
      const saved = upsertAppt({
        id, clientId, clientName,
        phone, status: $("#f-status", mm).value,
        date, time, endTime: endTime || null, durationMin,
        items, note: $("#f-note", mm).value.trim(), sale: a.sale, remind: remindOn,
      });
      toast("Cita guardada");
      onDone && onDone();
      // recordatorio solo al CREAR una cita futura, con la opción marcada y si el día NO está cerrado
      if (!id && remindOn && saved.date >= todayStr() && !closedInfo(saved.date)) remind(saved);
    },
  });

  // mostrar campo de nombre al elegir "Nuevo cliente" y autocompletar teléfono al elegir uno existente
  const selEl = $("#f-client-sel", m);
  const syncClient = () => {
    const v = selEl.value;
    $("#f-newclient-wrap", m).hidden = v !== "__new__";
    if (v === "__new__") { $("#f-newname", m).focus(); return; }
    const c = v && v !== "__keep__" ? getClient(v) : null;
    if (c && !$("#f-phone", m).value) $("#f-phone", m).value = c.phone || "";
  };
  selEl.addEventListener("change", syncClient);
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
      consumeStock(lines);
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
