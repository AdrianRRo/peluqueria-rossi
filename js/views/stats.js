import { $, $$, esc, eur, toast, openModal, todayStr, addDays, weekStart, monthStart, yearStart, parseDate, dateToStr, fmtShort, fmtLong } from "../util.js?v=15";
import { statsBetween, apptsBetween, apptsByDate, listClients, listProducts, getClient } from "../store.js?v=15";

let calMonth = monthStart(todayStr());

let preset = "mes";
let customFrom = todayStr(), customTo = todayStr();

function range() {
  const t = todayStr();
  if (preset === "hoy") return [t, t];
  if (preset === "semana") { const f = weekStart(t); return [f, addDays(f, 6)]; }
  if (preset === "mes") { const f = monthStart(t); const d = parseDate(f); const end = new Date(d.getFullYear(), d.getMonth() + 1, 0); return [f, dateToStr(end)]; }
  if (preset === "anio") return [yearStart(t), `${parseDate(t).getFullYear()}-12-31`];
  return [customFrom, customTo];
}

export function renderStats(root) {
  const [from, to] = range();
  const s = statsBetween(from, to);

  root.innerHTML = `
    <div class="page-head">
      <div><h2>Estadísticas</h2><p class="sub">${fmtShort(from)} – ${fmtShort(to)}</p></div>
      <div class="head-actions">
        <div class="seg" id="st-seg">
          <button data-p="hoy">Hoy</button><button data-p="semana">Semana</button>
          <button data-p="mes">Mes</button><button data-p="anio">Año</button><button data-p="custom">Rango</button>
        </div>
        <button class="btn btn-soft" id="st-export">⬇ Exportar a Excel</button>
      </div>
    </div>
    <div id="st-custom" ${preset === "custom" ? "" : "hidden"} style="margin:-6px 0 16px">
      <div class="row-2" style="max-width:340px">
        <label class="field" style="font-size:.78rem;color:var(--muted)">Desde <input type="date" id="st-from" value="${customFrom}"></label>
        <label class="field" style="font-size:.78rem;color:var(--muted)">Hasta <input type="date" id="st-to" value="${customTo}"></label>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi accent"><div class="v">${eur(s.revenue)}</div><div class="l">Ingresos (bruto)</div></div>
      <div class="kpi bad"><div class="v">${eur(s.cost)}</div><div class="l">Costes (productos)</div></div>
      <div class="kpi good"><div class="v">${eur(s.profit)}</div><div class="l">Beneficio neto</div></div>
      <div class="kpi"><div class="v">${s.count}</div><div class="l">citas · ${eur(s.avgTicket)} ticket medio</div></div>
    </div>

    <div class="section-card" style="margin-bottom:16px;display:flex;gap:28px;align-items:center;flex-wrap:wrap">
      <b>Cobros por método</b>
      <span>💵 Efectivo: <b>${eur(s.byMethod.efectivo.total)}</b> <span class="muted">(${s.byMethod.efectivo.count})</span></span>
      <span>💳 Tarjeta: <b>${eur(s.byMethod.tarjeta.total)}</b> <span class="muted">(${s.byMethod.tarjeta.count})</span></span>
      ${s.byMethod.otro.count ? `<span class="muted">Sin especificar: ${eur(s.byMethod.otro.total)} (${s.byMethod.otro.count})</span>` : ""}
    </div>

    <div class="grid-2">
      <div class="section-card">
        <h3>Ingresos por día <span class="muted" style="font-weight:400;font-size:.8rem">· pulsa un día para ver el detalle</span></h3>
        <div id="st-chart"></div>
      </div>
      <div class="section-card">
        <h3>Qué genera más dinero</h3>
        <table class="tbl">
          <thead><tr><th>Concepto</th><th class="num">Uds</th><th class="num">Ingresos</th><th class="num">Beneficio</th></tr></thead>
          <tbody id="st-items"></tbody>
        </table>
      </div>
    </div>

    <div class="section-card" style="margin-top:16px">
      <h3>Detalle por día</h3>
      <table class="tbl">
        <thead><tr><th>Día</th><th class="num">Citas</th><th class="num">Ingresos</th><th class="num">Costes</th><th class="num">Beneficio</th></tr></thead>
        <tbody id="st-days"></tbody>
      </table>
      ${s.noShow ? `<p class="muted" style="margin-top:10px">⚠️ ${s.noShow} cita(s) sin presentarse en este periodo.</p>` : ""}
    </div>`;

  // segmento
  $$("#st-seg button", root).forEach((b) => {
    b.classList.toggle("active", b.dataset.p === preset);
    b.onclick = () => { preset = b.dataset.p; renderStats(root); };
  });
  if (preset === "custom") {
    $("#st-from", root).onchange = (e) => { customFrom = e.target.value; renderStats(root); };
    $("#st-to", root).onchange = (e) => { customTo = e.target.value; renderStats(root); };
  }
  $("#st-export", root).onclick = () => exportExcel(from, to);

  // calendario de ingresos (se navega por mes; inicia en el mes del periodo)
  if (preset !== "custom") calMonth = monthStart(from);
  renderCalendar($("#st-chart", root));

  // tabla conceptos
  const items = Object.entries(s.perItem).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue);
  $("#st-items", root).innerHTML = items.length
    ? items.map((i) => `<tr><td>${esc(i.name)}</td><td class="num">${i.qty}</td><td class="num">${eur(i.revenue)}</td><td class="num pos">${eur(i.revenue - i.cost)}</td></tr>`).join("")
    : `<tr><td colspan="4" class="muted">Sin ventas en este periodo.</td></tr>`;

  // tabla por día
  const days = Object.entries(s.perDay).map(([d, v]) => ({ d, ...v })).sort((a, b) => b.d.localeCompare(a.d));
  $("#st-days", root).innerHTML = days.length
    ? days.map((x) => `<tr data-d="${x.d}" style="cursor:pointer"><td>${fmtShort(x.d)}</td><td class="num">${x.count}</td><td class="num">${eur(x.revenue)}</td><td class="num neg">${eur(x.cost)}</td><td class="num pos">${eur(x.revenue - x.cost)}</td></tr>`).join("")
    : `<tr><td colspan="5" class="muted">Sin datos en este periodo.</td></tr>`;
  $$("#st-days tr[data-d]", root).forEach((tr) => tr.onclick = () => dayDetail(tr.dataset.d));
}

// ---------- calendario de ingresos ----------
function renderCalendar(host) {
  const d0 = parseDate(calMonth);
  const year = d0.getFullYear(), month = d0.getMonth();
  const lead = (d0.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayStr();
  const vals = {}; let max = 0;
  for (let i = 1; i <= daysInMonth; i++) { const ds = dateToStr(new Date(year, month, i)); const v = statsBetween(ds, ds).revenue; vals[ds] = v; if (v > max) max = v; }
  const dow = ["L", "M", "X", "J", "V", "S", "D"];
  let cells = dow.map((x) => `<div class="cm-dow">${x}</div>`).join("");
  for (let i = 0; i < lead; i++) cells += `<div></div>`;
  for (let i = 1; i <= daysInMonth; i++) {
    const ds = dateToStr(new Date(year, month, i)); const v = vals[ds];
    const lvl = v <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4));
    cells += `<button class="cm-day lvl-${lvl} ${ds === today ? "today" : ""}" data-date="${ds}"><span class="cm-n">${i}</span>${v > 0 ? `<span class="cm-v">${Math.round(v)}€</span>` : ""}</button>`;
  }
  host.innerHTML = `
    <div class="cm-head">
      <button class="icon-btn" data-cm="-1">‹</button>
      <b style="text-transform:capitalize">${d0.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</b>
      <button class="icon-btn" data-cm="1">›</button>
    </div>
    <div class="cm-grid">${cells}</div>`;
  host.querySelector('[data-cm="-1"]').onclick = () => { calMonth = dateToStr(new Date(year, month - 1, 1)); renderCalendar(host); };
  host.querySelector('[data-cm="1"]').onclick = () => { calMonth = dateToStr(new Date(year, month + 1, 1)); renderCalendar(host); };
  host.querySelectorAll(".cm-day").forEach((b) => b.onclick = () => dayDetail(b.dataset.date));
}

// ---------- detalle de un día ----------
function dayDetail(date) {
  const appts = apptsByDate(date).filter((a) => a.status === "completada" && a.sale);
  let revenue = 0, cost = 0;
  const blocks = appts.map((a) => {
    revenue += a.sale.total; cost += a.sale.cost;
    const lines = a.sale.lines.map((l) => `<tr><td>${esc(l.name)}</td><td class="num">${l.qty || 1}</td><td class="num">${eur(l.price)}</td><td class="num">${eur(l.price * (l.qty || 1))}</td></tr>`).join("");
    const m = a.sale.method === "tarjeta" ? "💳 Tarjeta" : a.sale.method === "efectivo" ? "💵 Efectivo" : "";
    return `<div class="section-card" style="padding:12px;margin-bottom:10px">
      <b>${esc(a.time)} · ${esc(a.clientName)}</b>${m ? ` <span class="muted" style="font-weight:400">· ${m}</span>` : ""}
      <table class="tbl" style="margin-top:6px"><thead><tr><th>Concepto</th><th class="num">Uds</th><th class="num">Precio</th><th class="num">Subtotal</th></tr></thead><tbody>${lines}</tbody></table>
    </div>`;
  }).join("");
  openModal({
    title: fmtLong(date),
    body: appts.length
      ? `${blocks}<div class="checkout-total"><span>Total cobrado · beneficio ${eur(revenue - cost)}</span><span class="big">${eur(revenue)}</span></div>`
      : `<p class="empty">No hubo citas completadas este día.</p>`,
  });
}

// ---------- Export ----------
function exportExcel(from, to) {
  const inRange = apptsBetween(from, to);
  const done = inRange.filter((a) => a.status === "completada" && a.sale);

  const daily = {};
  for (const a of done) { const d = (daily[a.date] ||= { Fecha: a.date, Citas: 0, Ingresos: 0, Efectivo: 0, Tarjeta: 0, Costes: 0, Beneficio: 0 }); d.Citas++; d.Ingresos += a.sale.total; if (a.sale.method === "tarjeta") d.Tarjeta += a.sale.total; else if (a.sale.method === "efectivo") d.Efectivo += a.sale.total; d.Costes += a.sale.cost; d.Beneficio += a.sale.profit; }
  const dailyRows = Object.values(daily).sort((a, b) => a.Fecha.localeCompare(b.Fecha));

  const saleRows = [];
  for (const a of done) for (const l of a.sale.lines) saleRows.push({ Fecha: a.date, Cliente: a.clientName, Concepto: l.name, Cantidad: l.qty || 1, "Precio (€)": l.price, "Coste (€)": l.cost, "Beneficio (€)": (l.price - (l.cost || 0)) * (l.qty || 1), Pago: a.sale.method || "" });

  const apptRows = inRange.map((a) => ({ Fecha: a.date, Hora: a.time, Cliente: a.clientName, Teléfono: a.phone || "", Servicios: (a.sale ? a.sale.lines.map((l) => l.name) : (a.items || []).map((i) => i.name)).join(", "), Estado: a.status, "Importe (€)": a.sale ? a.sale.total : "", Pago: a.sale ? a.sale.method : "" }));

  const clientRows = listClients().map((c) => ({ Nombre: c.name, Teléfono: c.phone || "", Email: c.email || "", Cabello: c.hairType || "", Notas: c.notes || "" }));
  const prodRows = listProducts().map((p) => ({ Nombre: p.name, Tipo: p.category, "Precio (€)": p.price, "Coste (€)": p.cost, "Margen (€)": p.price - p.cost, Activo: p.active ? "Sí" : "No" }));

  if (!window.XLSX) {
    // fallback CSV (resumen diario)
    const csv = ["Fecha;Citas;Ingresos;Efectivo;Tarjeta;Costes;Beneficio", ...dailyRows.map((r) => `${r.Fecha};${r.Citas};${r.Ingresos};${r.Efectivo};${r.Tarjeta};${r.Costes};${r.Beneficio}`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `peluqueria-rossi_${from}_${to}.csv`; a.click();
    toast("Exportado (CSV)");
    return;
  }
  const wb = XLSX.utils.book_new();
  const add = (rows, name) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), name);
  add(dailyRows, "Resumen diario");
  add(saleRows, "Ventas (detalle)");
  add(apptRows, "Citas");
  add(clientRows, "Clientes");
  add(prodRows, "Productos");
  XLSX.writeFile(wb, `peluqueria-rossi_${from}_${to}.xlsx`);
  toast("Excel generado");
}
