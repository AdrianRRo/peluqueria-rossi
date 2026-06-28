import { $, esc, openModal, whatsapp, toast, confirmDialog, eur, fmtShort } from "../util.js";
import { listClients, upsertClient, deleteClient, listAppointments } from "../store.js";

export function renderClientes(root) {
  const clients = listClients();
  root.innerHTML = `
    <div class="page-head">
      <div><h2>Clientes</h2><p class="sub">${clients.length} cliente${clients.length === 1 ? "" : "s"}</p></div>
      <div class="head-actions">
        <input id="cli-search" placeholder="Buscar..." style="width:200px" />
        <button class="btn btn-primary" id="cli-new">+ Nuevo cliente</button>
      </div>
    </div>
    <div class="list" id="cli-list"></div>`;

  const draw = (q = "") => {
    const list = $("#cli-list", root);
    const filtered = clients.filter((c) => (c.name + " " + (c.phone || "")).toLowerCase().includes(q.toLowerCase()));
    list.innerHTML = filtered.length ? "" : `<p class="empty">Sin resultados.</p>`;
    const appts = listAppointments();
    for (const c of filtered) {
      const visits = appts.filter((a) => a.clientId === c.id && a.status === "completada").length;
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <div class="row-main">
          <h4>${esc(c.name)}</h4>
          <p>${esc(c.phone || "sin teléfono")}${c.hairType ? " · " + esc(c.hairType) : ""} · ${visits} visita${visits === 1 ? "" : "s"}</p>
        </div>
        <div class="row-actions">
          <button class="icon-btn" title="Ver ficha" data-act="view">👁️</button>
          <button class="icon-btn" title="Editar" data-act="edit">✏️</button>
          <button class="icon-btn wa" title="WhatsApp" data-act="wa">💬</button>
          <button class="icon-btn del" title="Eliminar" data-act="del">🗑</button>
        </div>`;
      row.querySelector('[data-act="view"]').onclick = () => viewClient(c.id, () => draw($("#cli-search", root).value));
      row.querySelector('[data-act="edit"]').onclick = () => editClient(c.id, () => renderClientes(root));
      row.querySelector('[data-act="wa"]').onclick = () => whatsapp(c.phone, `Hola ${c.name}, te escribimos de Peluquería Rossi ✂️`);
      row.querySelector('[data-act="del"]').onclick = () => { if (confirmDialog(`¿Eliminar a ${c.name}?`)) { deleteClient(c.id); renderClientes(root); } };
      list.appendChild(row);
    }
  };
  draw();
  $("#cli-search", root).addEventListener("input", (e) => draw(e.target.value));
  $("#cli-new", root).onclick = () => editClient(null, () => renderClientes(root));
}

function clientForm(c = {}) {
  return `
    <div class="form-grid">
      <label>Nombre y apellidos <input id="f-name" value="${esc(c.name || "")}" required /></label>
      <div class="row-2">
        <label>Teléfono <input id="f-phone" type="tel" value="${esc(c.phone || "")}" placeholder="+34..." /></label>
        <label>Email <input id="f-email" type="email" value="${esc(c.email || "")}" /></label>
      </div>
      <label>Tipo de cabello <input id="f-hair" value="${esc(c.hairType || "")}" placeholder="Largo / liso / teñido..." /></label>
      <label>Notas <textarea id="f-notes" placeholder="Preferencias, alergias, color habitual...">${esc(c.notes || "")}</textarea></label>
    </div>`;
}

export function editClient(id, onDone) {
  const c = id ? { ...require_(id) } : {};
  openModal({
    title: id ? "Editar cliente" : "Nuevo cliente",
    body: clientForm(c),
    saveLabel: "Guardar",
    onSave: (m) => {
      const name = $("#f-name", m).value.trim();
      if (!name) { toast("Indica el nombre"); return false; }
      upsertClient({ id, name, phone: $("#f-phone", m).value.trim(), email: $("#f-email", m).value.trim(), hairType: $("#f-hair", m).value.trim(), notes: $("#f-notes", m).value.trim() });
      toast("Cliente guardado");
      onDone && onDone();
    },
  });
}

function require_(id) { return listClients().find((c) => c.id === id) || {}; }

export function viewClient(id, onChange) {
  const c = require_(id);
  const appts = listAppointments().filter((a) => a.clientId === id).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const completed = appts.filter((a) => a.status === "completada" && a.sale);
  const spent = completed.reduce((s, a) => s + a.sale.total, 0);
  const hist = appts.slice(0, 12).map((a) => {
    const detail = a.sale ? a.sale.lines.map((l) => l.name).join(", ") : (a.items || []).map((i) => i.name).join(", ");
    const amount = a.sale ? eur(a.sale.total) : "";
    return `<tr><td>${fmtShort(a.date)} ${esc(a.time)}</td><td>${esc(detail || "—")}</td><td><span class="tag s-${a.status}">${a.status.replace("_", " ")}</span></td><td class="num">${amount}</td></tr>`;
  }).join("");
  openModal({
    title: c.name,
    body: `
      <div class="form-grid" style="gap:8px">
        <p class="muted">${esc(c.phone || "sin teléfono")}${c.email ? " · " + esc(c.email) : ""}</p>
        ${c.hairType ? `<p><b>Cabello:</b> ${esc(c.hairType)}</p>` : ""}
        ${c.notes ? `<p><b>Notas:</b> ${esc(c.notes)}</p>` : ""}
        <div class="kpis" style="grid-template-columns:repeat(3,1fr);margin:10px 0 4px">
          <div class="kpi"><div class="v">${completed.length}</div><div class="l">visitas</div></div>
          <div class="kpi accent"><div class="v">${eur(spent)}</div><div class="l">gastado total</div></div>
          <div class="kpi"><div class="v">${completed.length ? eur(spent / completed.length) : eur(0)}</div><div class="l">ticket medio</div></div>
        </div>
        <h3 style="margin-top:8px;font-size:1rem">Historial</h3>
        <table class="tbl"><thead><tr><th>Fecha</th><th>Concepto</th><th>Estado</th><th class="num">Importe</th></tr></thead>
        <tbody>${hist || `<tr><td colspan="4" class="muted">Sin citas todavía.</td></tr>`}</tbody></table>
      </div>`,
    extra: [
      { label: "💬 WhatsApp", cls: "btn-soft", onClick: () => { whatsapp(c.phone, `Hola ${c.name}, te escribimos de Peluquería Rossi ✂️`); return false; }, closeAfter: false },
      { label: "✏️ Editar", cls: "btn-ghost", onClick: (m, close) => { close(); editClient(id, onChange); } },
    ],
  });
}
