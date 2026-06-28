// ====== Peluquería Rossi — app de demostración (datos en el navegador) ======
const AUTH = { user: "rossi", pass: "rossi2026" };
const SERVICES = ["Corte", "Tinte", "Mechas", "Peinado", "Barba", "Tratamiento"];
const SK = { appts: "pr_appointments", clients: "pr_clients", session: "pr_session" };

// ---- utilidades ----
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const uid = () => Math.random().toString(36).slice(2, 9);
const load = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const fmtDate = (s) => new Date(s + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

// ---- semilla inicial ----
function seed() {
  if (load(SK.clients, null)) return;
  const clients = [
    { id: uid(), name: "María López", phone: "+34611223344" },
    { id: uid(), name: "Carlos Ruiz", phone: "+34622334455" },
    { id: uid(), name: "Lucía Fernández", phone: "+34633445566" },
  ];
  const t = todayStr();
  const appts = [
    { id: uid(), date: t, time: "10:00", client: "María López", phone: "+34611223344", service: "Corte", status: "pending" },
    { id: uid(), date: t, time: "11:30", client: "Carlos Ruiz", phone: "+34622334455", service: "Barba", status: "pending" },
    { id: uid(), date: t, time: "13:00", client: "Lucía Fernández", phone: "+34633445566", service: "Tinte", status: "done" },
  ];
  save(SK.clients, clients);
  save(SK.appts, appts);
}

// ====== AUTH ======
function showApp() {
  $("#login-view").hidden = true;
  $("#app-view").hidden = false;
  $("#date-filter").value = todayStr();
  renderTurnos();
}
function checkSession() { if (sessionStorage.getItem(SK.session) === "1") showApp(); }

$("#login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const u = $("#login-user").value.trim();
  const p = $("#login-pass").value;
  if (u === AUTH.user && p === AUTH.pass) {
    sessionStorage.setItem(SK.session, "1");
    $("#login-error").hidden = true;
    showApp();
  } else {
    $("#login-error").hidden = false;
  }
});
$("#logout").addEventListener("click", () => {
  sessionStorage.removeItem(SK.session);
  $("#app-view").hidden = true;
  $("#login-view").hidden = false;
  $("#login-form").reset();
});

// ====== TABS ======
$$(".tab").forEach((t) =>
  t.addEventListener("click", () => {
    $$(".tab").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    const tab = t.dataset.tab;
    $("#tab-turnos").hidden = tab !== "turnos";
    $("#tab-clientes").hidden = tab !== "clientes";
    if (tab === "clientes") renderClientes();
    else renderTurnos();
  })
);

// ====== TURNOS ======
$("#date-filter").addEventListener("change", renderTurnos);

function renderTurnos() {
  const date = $("#date-filter").value || todayStr();
  $("#day-label").textContent = fmtDate(date);
  const appts = load(SK.appts, []).filter((a) => a.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));

  $("#st-total").textContent = appts.length;
  $("#st-pend").textContent = appts.filter((a) => a.status === "pending").length;
  $("#st-done").textContent = appts.filter((a) => a.status === "done").length;

  const list = $("#appt-list");
  list.innerHTML = "";
  $("#appt-empty").hidden = appts.length > 0;

  for (const a of appts) {
    const row = document.createElement("div");
    row.className = "card-row " + (a.status === "done" ? "done" : a.status === "cancelled" ? "cancelled" : "");
    row.innerHTML = `
      <div class="time-badge"><b>${a.time}</b><span>h</span></div>
      <div class="row-main">
        <h4>${esc(a.client)}</h4>
        <p>${esc(a.phone || "sin teléfono")}</p>
        <span class="tag">${esc(a.service)}</span>
      </div>
      <div class="row-actions">
        <button class="icon-btn wa" title="Recordatorio WhatsApp" data-act="wa" data-id="${a.id}">💬</button>
        <button class="icon-btn" title="Marcar completado" data-act="done" data-id="${a.id}">✓</button>
        <button class="icon-btn" title="Cancelar" data-act="cancel" data-id="${a.id}">✕</button>
        <button class="icon-btn del" title="Eliminar" data-act="del" data-id="${a.id}">🗑</button>
      </div>`;
    list.appendChild(row);
  }
}

$("#appt-list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const { act, id } = btn.dataset;
  const appts = load(SK.appts, []);
  const a = appts.find((x) => x.id === id);
  if (!a) return;
  if (act === "wa") return sendWhatsapp(a);
  if (act === "done") a.status = a.status === "done" ? "pending" : "done";
  if (act === "cancel") a.status = a.status === "cancelled" ? "pending" : "cancelled";
  if (act === "del") { if (!confirm("¿Eliminar este turno?")) return; appts.splice(appts.indexOf(a), 1); }
  save(SK.appts, appts);
  renderTurnos();
});

function sendWhatsapp(a) {
  const phone = (a.phone || "").replace(/[^0-9]/g, "");
  if (!phone) return alert("Este turno no tiene teléfono.");
  const msg = `Hola ${a.client}, te recordamos tu cita en Peluquería Rossi el ${fmtDate(a.date)} a las ${a.time} para ${a.service}. ¡Te esperamos! ✂️`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
}

// ====== CLIENTES ======
function renderClientes() {
  const clients = load(SK.clients, []);
  const appts = load(SK.appts, []);
  const list = $("#client-list");
  list.innerHTML = "";
  $("#client-empty").hidden = clients.length > 0;
  for (const c of clients) {
    const visits = appts.filter((a) => a.client === c.name && a.status === "done").length;
    const row = document.createElement("div");
    row.className = "card-row";
    row.innerHTML = `
      <div class="row-main">
        <h4>${esc(c.name)}</h4>
        <p>${esc(c.phone || "sin teléfono")} · ${visits} visita${visits === 1 ? "" : "s"}</p>
      </div>
      <div class="row-actions">
        <button class="icon-btn wa" title="WhatsApp" data-act="wac" data-id="${c.id}">💬</button>
        <button class="icon-btn del" title="Eliminar" data-act="delc" data-id="${c.id}">🗑</button>
      </div>`;
    list.appendChild(row);
  }
}

$("#client-list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const { act, id } = btn.dataset;
  const clients = load(SK.clients, []);
  const c = clients.find((x) => x.id === id);
  if (!c) return;
  if (act === "wac") {
    const phone = (c.phone || "").replace(/[^0-9]/g, "");
    if (!phone) return alert("Sin teléfono.");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent("Hola " + c.name + ", te escribimos de Peluquería Rossi ✂️")}`, "_blank");
    return;
  }
  if (act === "delc") {
    if (!confirm("¿Eliminar cliente?")) return;
    clients.splice(clients.indexOf(c), 1);
    save(SK.clients, clients);
    renderClientes();
  }
});

// ====== MODAL (nuevo turno / cliente) ======
const modal = $("#modal");
$("#modal-cancel").addEventListener("click", () => (modal.hidden = true));
modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });

$("#new-appt").addEventListener("click", () => openApptModal());
$("#new-client").addEventListener("click", () => openClientModal());

function openApptModal() {
  $("#modal-title").textContent = "Nuevo turno";
  const clients = load(SK.clients, []);
  $("#modal-form").innerHTML = `
    <label>Cliente
      <input list="clients-dl" id="m-client" placeholder="Nombre del cliente" required />
      <datalist id="clients-dl">${clients.map((c) => `<option value="${esc(c.name)}">`).join("")}</datalist>
    </label>
    <label>Teléfono <input type="tel" id="m-phone" placeholder="+34..." /></label>
    <label>Servicio
      <select id="m-service">${SERVICES.map((s) => `<option>${s}</option>`).join("")}</select>
    </label>
    <div style="display:flex;gap:10px">
      <label style="flex:1">Fecha <input type="date" id="m-date" value="${$("#date-filter").value || todayStr()}" /></label>
      <label style="flex:1">Hora <input type="time" id="m-time" value="10:00" /></label>
    </div>`;
  // autorrelleno del teléfono si el cliente existe
  $("#m-client").addEventListener("change", () => {
    const c = load(SK.clients, []).find((x) => x.name === $("#m-client").value);
    if (c) $("#m-phone").value = c.phone || "";
  });
  $("#modal-save").onclick = () => {
    const client = $("#m-client").value.trim();
    if (!client) return alert("Indica el cliente.");
    const phone = $("#m-phone").value.trim();
    const appts = load(SK.appts, []);
    appts.push({ id: uid(), date: $("#m-date").value, time: $("#m-time").value, client, phone, service: $("#m-service").value, status: "pending" });
    save(SK.appts, appts);
    // crea el cliente si es nuevo
    const clients = load(SK.clients, []);
    if (!clients.some((c) => c.name === client)) { clients.push({ id: uid(), name: client, phone }); save(SK.clients, clients); }
    modal.hidden = true;
    $("#date-filter").value = $("#m-date").value;
    renderTurnos();
  };
  modal.hidden = false;
}

function openClientModal() {
  $("#modal-title").textContent = "Nuevo cliente";
  $("#modal-form").innerHTML = `
    <label>Nombre <input type="text" id="c-name" placeholder="Nombre y apellidos" required /></label>
    <label>Teléfono <input type="tel" id="c-phone" placeholder="+34..." /></label>`;
  $("#modal-save").onclick = () => {
    const name = $("#c-name").value.trim();
    if (!name) return alert("Indica el nombre.");
    const clients = load(SK.clients, []);
    clients.push({ id: uid(), name, phone: $("#c-phone").value.trim() });
    save(SK.clients, clients);
    modal.hidden = true;
    renderClientes();
  };
  modal.hidden = false;
}

// escape básico para evitar romper el HTML
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

// ====== init ======
seed();
checkSession();
