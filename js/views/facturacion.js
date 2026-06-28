import { $, $$, esc, eur, toast, todayStr, addDays, weekStart, monthStart, yearStart, parseDate, dateToStr, fmtShort, fmtLong } from "../util.js?v=11";
import { apptsBetween, ensureTicketNumbers, IVA } from "../store.js?v=11";

let preset = "mes";
let cFrom = todayStr(), cTo = todayStr();

function range() {
  const t = todayStr();
  if (preset === "hoy") return [t, t];
  if (preset === "semana") { const f = weekStart(t); return [f, addDays(f, 6)]; }
  if (preset === "mes") { const f = monthStart(t); const d = parseDate(f); return [f, dateToStr(new Date(d.getFullYear(), d.getMonth() + 1, 0))]; }
  if (preset === "anio") return [yearStart(t), `${parseDate(t).getFullYear()}-12-31`];
  return [cFrom, cTo];
}

const baseOf = (total) => total / (1 + IVA);

export function renderFacturacion(root) {
  ensureTicketNumbers();
  const [from, to] = range();
  const tickets = apptsBetween(from, to).filter((a) => a.status === "completada" && a.sale)
    .sort((a, b) => (a.sale.ticketNo || 0) - (b.sale.ticketNo || 0));

  let total = 0, efx = 0, tar = 0;
  for (const a of tickets) { total += a.sale.total; if (a.sale.method === "tarjeta") tar += a.sale.total; else if (a.sale.method === "efectivo") efx += a.sale.total; }
  const base = baseOf(total), iva = total - base;

  root.innerHTML = `
    <div class="page-head">
      <div><h2>Facturación</h2><p class="sub">${fmtShort(from)} – ${fmtShort(to)} · IVA ${Math.round(IVA * 100)}% (precios con IVA incluido)</p></div>
      <div class="head-actions">
        <div class="seg" id="fa-seg">
          <button data-p="hoy">Hoy</button><button data-p="semana">Semana</button>
          <button data-p="mes">Mes</button><button data-p="anio">Año</button><button data-p="custom">Rango</button>
        </div>
        <button class="btn btn-soft" id="fa-export">⬇ Exportar facturación</button>
      </div>
    </div>
    <div id="fa-custom" ${preset === "custom" ? "" : "hidden"} style="margin:-6px 0 16px">
      <div class="row-2" style="max-width:340px">
        <label class="field" style="font-size:.78rem;color:var(--muted)">Desde <input type="date" id="fa-from" value="${cFrom}"></label>
        <label class="field" style="font-size:.78rem;color:var(--muted)">Hasta <input type="date" id="fa-to" value="${cTo}"></label>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi"><div class="v">${eur(base)}</div><div class="l">Base imponible</div></div>
      <div class="kpi"><div class="v">${eur(iva)}</div><div class="l">IVA (${Math.round(IVA * 100)}%)</div></div>
      <div class="kpi accent"><div class="v">${eur(total)}</div><div class="l">Total facturado</div></div>
      <div class="kpi"><div class="v">${tickets.length}</div><div class="l">tickets emitidos</div></div>
    </div>

    <div class="section-card" style="margin-bottom:16px;display:flex;gap:28px;align-items:center;flex-wrap:wrap">
      <b>Cobrado por método</b>
      <span>💵 Efectivo: <b>${eur(efx)}</b></span>
      <span>💳 Tarjeta: <b>${eur(tar)}</b></span>
    </div>

    <div class="section-card" style="padding:6px 0">
      <table class="tbl">
        <thead><tr><th>Nº</th><th>Fecha</th><th>Cliente</th><th>Concepto</th><th class="num">Base</th><th class="num">IVA</th><th class="num">Total</th><th>Pago</th><th></th></tr></thead>
        <tbody id="fa-body"></tbody>
      </table>
    </div>`;

  $$("#fa-seg button", root).forEach((b) => { b.classList.toggle("active", b.dataset.p === preset); b.onclick = () => { preset = b.dataset.p; renderFacturacion(root); }; });
  if (preset === "custom") {
    $("#fa-from", root).onchange = (e) => { cFrom = e.target.value; renderFacturacion(root); };
    $("#fa-to", root).onchange = (e) => { cTo = e.target.value; renderFacturacion(root); };
  }
  $("#fa-export", root).onclick = () => exportFacturas(from, to, tickets);

  const body = $("#fa-body", root);
  body.innerHTML = tickets.length ? "" : `<tr><td colspan="9" class="empty">Sin tickets en este periodo.</td></tr>`;
  for (const a of tickets) {
    const b = baseOf(a.sale.total);
    const concepto = a.sale.lines.map((l) => `${l.name}${(l.qty || 1) > 1 ? ` ×${l.qty}` : ""}`).join(", ");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>#${String(a.sale.ticketNo).padStart(5, "0")}</b></td>
      <td style="white-space:nowrap">${fmtShort(a.date)}</td>
      <td>${esc(a.clientName)}</td>
      <td>${esc(concepto)}</td>
      <td class="num">${eur(b)}</td>
      <td class="num">${eur(a.sale.total - b)}</td>
      <td class="num"><b>${eur(a.sale.total)}</b></td>
      <td>${a.sale.method === "tarjeta" ? "💳" : a.sale.method === "efectivo" ? "💵" : "—"}</td>
      <td class="num"><button class="icon-btn" data-print title="Imprimir ticket">🖨️</button></td>`;
    tr.querySelector("[data-print]").onclick = () => printTicket(a);
    body.appendChild(tr);
  }
}

function printTicket(a) {
  const base = baseOf(a.sale.total), iva = a.sale.total - base;
  const lines = a.sale.lines.map((l) => `<tr><td>${esc(l.name)}</td><td style="text-align:center">${l.qty || 1}</td><td style="text-align:right">${eur(l.price * (l.qty || 1))}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Ticket #${a.sale.ticketNo}</title>
    <style>
      body{font-family:'Segoe UI',sans-serif;max-width:300px;margin:0 auto;padding:18px;color:#111}
      h1{font-size:19px;text-align:center;margin:0 0 2px}
      .sub{text-align:center;font-size:12px;color:#555;margin-bottom:10px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      td,th{padding:4px 0}
      hr{border:0;border-top:1px dashed #aaa;margin:10px 0}
      .tot td{font-size:13px}
      .grand td{font-size:15px;font-weight:700}
      .foot{text-align:center;font-size:11px;color:#777;margin-top:18px}
    </style></head><body>
    <h1>✂️ Peluquería Rossi</h1>
    <div class="sub">Ticket nº ${String(a.sale.ticketNo).padStart(5, "0")}<br>${fmtLong(a.date)} · ${a.time}</div>
    <div style="font-size:12px">Cliente: ${esc(a.clientName)}</div>
    <hr>
    <table><thead><tr><th style="text-align:left">Concepto</th><th>Uds</th><th style="text-align:right">Importe</th></tr></thead><tbody>${lines}</tbody></table>
    <hr>
    <table class="tot">
      <tr><td>Base imponible</td><td style="text-align:right">${eur(base)}</td></tr>
      <tr><td>IVA (${Math.round(IVA * 100)}%)</td><td style="text-align:right">${eur(iva)}</td></tr>
      <tr class="grand"><td>TOTAL</td><td style="text-align:right">${eur(a.sale.total)}</td></tr>
    </table>
    <div style="font-size:12px;margin-top:8px">Forma de pago: ${a.sale.method === "tarjeta" ? "Tarjeta" : "Efectivo"}</div>
    <div class="foot">¡Gracias por tu visita! ✂️</div>
    <script>window.onload=function(){setTimeout(function(){window.print()},150)}<\/script>
    </body></html>`;
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) { toast("Permite las ventanas emergentes para imprimir"); return; }
  w.document.write(html); w.document.close();
}

function exportFacturas(from, to, tickets) {
  const r2 = (n) => Math.round(n * 100) / 100;
  const rows = tickets.map((a) => { const b = baseOf(a.sale.total); return { "Nº": a.sale.ticketNo, Fecha: a.date, Cliente: a.clientName, Concepto: a.sale.lines.map((l) => l.name).join(", "), "Base (€)": r2(b), [`IVA ${Math.round(IVA * 100)}% (€)`]: r2(a.sale.total - b), "Total (€)": a.sale.total, Pago: a.sale.method || "" }; });
  const totT = tickets.reduce((s, a) => s + a.sale.total, 0);
  const baseT = baseOf(totT);
  const resumen = [
    { Concepto: "Base imponible", "Importe (€)": r2(baseT) },
    { Concepto: `IVA ${Math.round(IVA * 100)}%`, "Importe (€)": r2(totT - baseT) },
    { Concepto: "Total facturado", "Importe (€)": r2(totT) },
    { Concepto: "Cobrado en efectivo", "Importe (€)": r2(tickets.filter((a) => a.sale.method === "efectivo").reduce((s, a) => s + a.sale.total, 0)) },
    { Concepto: "Cobrado con tarjeta", "Importe (€)": r2(tickets.filter((a) => a.sale.method === "tarjeta").reduce((s, a) => s + a.sale.total, 0)) },
    { Concepto: "Nº de tickets", "Importe (€)": tickets.length },
  ];
  if (!window.XLSX) {
    const csv = ["Nº;Fecha;Cliente;Concepto;Base;IVA;Total;Pago", ...rows.map((x) => `${x["Nº"]};${x.Fecha};${x.Cliente};${x.Concepto};${x["Base (€)"]};${x[`IVA ${Math.round(IVA * 100)}% (€)`]};${x["Total (€)"]};${x.Pago}`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `facturacion_${from}_${to}.csv`; link.click();
    toast("Exportado (CSV)"); return;
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), "Resumen");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), "Facturas");
  XLSX.writeFile(wb, `facturacion_${from}_${to}.xlsx`);
  toast("Facturación exportada");
}
