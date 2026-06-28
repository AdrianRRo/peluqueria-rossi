import { $, $$, esc, eur, toast, todayStr, addDays, weekStart, monthStart, yearStart, parseDate, dateToStr, fmtShort } from "../util.js";
import { statsBetween, apptsBetween, listClients, listProducts, getClient } from "../store.js";

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

    <div class="grid-2">
      <div class="section-card">
        <h3>Evolución de ingresos</h3>
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

  // chart (por día si <=31 días, si no por mes)
  drawChart($("#st-chart", root), from, to);

  // tabla conceptos
  const items = Object.entries(s.perItem).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue);
  $("#st-items", root).innerHTML = items.length
    ? items.map((i) => `<tr><td>${esc(i.name)}</td><td class="num">${i.qty}</td><td class="num">${eur(i.revenue)}</td><td class="num pos">${eur(i.revenue - i.cost)}</td></tr>`).join("")
    : `<tr><td colspan="4" class="muted">Sin ventas en este periodo.</td></tr>`;

  // tabla por día
  const days = Object.entries(s.perDay).map(([d, v]) => ({ d, ...v })).sort((a, b) => b.d.localeCompare(a.d));
  $("#st-days", root).innerHTML = days.length
    ? days.map((x) => `<tr><td>${fmtShort(x.d)}</td><td class="num">${x.count}</td><td class="num">${eur(x.revenue)}</td><td class="num neg">${eur(x.cost)}</td><td class="num pos">${eur(x.revenue - x.cost)}</td></tr>`).join("")
    : `<tr><td colspan="5" class="muted">Sin datos en este periodo.</td></tr>`;
}

function drawChart(host, from, to) {
  const days = Math.round((parseDate(to) - parseDate(from)) / 86400000) + 1;
  const buckets = [];
  if (days <= 31) {
    for (let i = 0; i < days; i++) { const d = addDays(from, i); buckets.push({ label: fmtShort(d), from: d, to: d }); }
  } else {
    let cur = monthStart(from);
    while (cur <= to) {
      const dd = parseDate(cur); const end = dateToStr(new Date(dd.getFullYear(), dd.getMonth() + 1, 0));
      buckets.push({ label: dd.toLocaleDateString("es-ES", { month: "short" }), from: cur, to: end > to ? to : end });
      cur = dateToStr(new Date(dd.getFullYear(), dd.getMonth() + 1, 1));
    }
  }
  const data = buckets.map((b) => ({ label: b.label, v: statsBetween(b.from, b.to).revenue }));
  const max = Math.max(1, ...data.map((d) => d.v));
  host.innerHTML = data.map((d) =>
    `<div class="bar-row"><span class="muted">${esc(d.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round((d.v / max) * 100)}%"></div></div><span>${eur(d.v)}</span></div>`
  ).join("") || `<p class="muted">Sin datos.</p>`;
}

// ---------- Export ----------
function exportExcel(from, to) {
  const inRange = apptsBetween(from, to);
  const done = inRange.filter((a) => a.status === "completada" && a.sale);

  const daily = {};
  for (const a of done) { const d = (daily[a.date] ||= { Fecha: a.date, Citas: 0, Ingresos: 0, Costes: 0, Beneficio: 0 }); d.Citas++; d.Ingresos += a.sale.total; d.Costes += a.sale.cost; d.Beneficio += a.sale.profit; }
  const dailyRows = Object.values(daily).sort((a, b) => a.Fecha.localeCompare(b.Fecha));

  const saleRows = [];
  for (const a of done) for (const l of a.sale.lines) saleRows.push({ Fecha: a.date, Cliente: a.clientName, Concepto: l.name, Cantidad: l.qty || 1, "Precio (€)": l.price, "Coste (€)": l.cost, "Beneficio (€)": (l.price - (l.cost || 0)) * (l.qty || 1) });

  const apptRows = inRange.map((a) => ({ Fecha: a.date, Hora: a.time, Cliente: a.clientName, Teléfono: a.phone || "", Servicios: (a.sale ? a.sale.lines.map((l) => l.name) : (a.items || []).map((i) => i.name)).join(", "), Estado: a.status, "Importe (€)": a.sale ? a.sale.total : "" }));

  const clientRows = listClients().map((c) => ({ Nombre: c.name, Teléfono: c.phone || "", Email: c.email || "", Cabello: c.hairType || "", Notas: c.notes || "" }));
  const prodRows = listProducts().map((p) => ({ Nombre: p.name, Tipo: p.category, "Precio (€)": p.price, "Coste (€)": p.cost, "Margen (€)": p.price - p.cost, Activo: p.active ? "Sí" : "No" }));

  if (!window.XLSX) {
    // fallback CSV (resumen diario)
    const csv = ["Fecha;Citas;Ingresos;Costes;Beneficio", ...dailyRows.map((r) => `${r.Fecha};${r.Citas};${r.Ingresos};${r.Costes};${r.Beneficio}`)].join("\n");
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
