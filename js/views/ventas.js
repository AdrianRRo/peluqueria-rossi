import { $, $$, esc, eur, toast, confirmDialog, todayStr, fmtShort } from "../util.js?v=12";
import { listProducts, getProduct, listClients, createSale, listSales, deleteAppt, restoreStock, IVA } from "../store.js?v=12";

export function renderVentas(root) {
  const products = listProducts(true).filter((p) => p.category === "producto");
  const clients = listClients();
  root.innerHTML = `
    <div class="page-head">
      <div><h2>Ventas de productos</h2><p class="sub">Venta directa sin cita (champú, mascarillas, etc.) · efectivo o tarjeta</p></div>
    </div>
    <div class="grid-2">
      <div class="section-card">
        <h3>Nueva venta</h3>
        <div class="form-grid">
          <label>Cliente (opcional)
            <input id="v-client" list="v-cli-dl" placeholder="Venta directa" />
            <datalist id="v-cli-dl">${clients.map((c) => `<option value="${esc(c.name)}">`).join("")}</datalist>
          </label>
          <div class="field">
            <label>Productos</label>
            <div class="lines-head" style="display:grid;grid-template-columns:1fr 86px 70px 36px;gap:8px;font-size:.7rem;color:var(--muted);margin-bottom:4px"><span>Producto</span><span>Precio €</span><span>Cant.</span><span></span></div>
            <div id="v-items"></div>
            <button type="button" class="btn btn-soft btn-sm" id="v-add">+ Añadir producto</button>
            <p class="muted" style="font-size:.76rem;margin-top:6px">Puedes vender varios iguales (cantidad) o distintos (varias líneas).</p>
          </div>
          <label>Método de pago
            <select id="v-method"><option value="efectivo">💵 Efectivo</option><option value="tarjeta">💳 Tarjeta</option></select>
          </label>
          <div class="checkout-total"><span>Total</span><span class="big" id="v-total">€0,00</span></div>
          <button class="btn btn-primary btn-block" id="v-save">Cobrar venta</button>
        </div>
      </div>
      <div class="section-card">
        <h3>Últimas ventas directas</h3>
        <div class="list" id="v-recent"></div>
      </div>
    </div>`;

  const cont = $("#v-items", root);
  const recalc = () => {
    const lines = readLines(cont);
    $("#v-total", root).textContent = eur(lines.reduce((s, l) => s + l.price * l.qty, 0));
  };
  addLine(cont, products, recalc);
  $("#v-add", root).onclick = () => addLine(cont, products, recalc);
  recalc();

  $("#v-save", root).onclick = () => {
    const lines = readLines(cont);
    if (!lines.length) { toast("Añade al menos un producto"); return; }
    const name = $("#v-client", root).value.trim();
    const cli = clients.find((c) => c.name.toLowerCase() === name.toLowerCase());
    const sale = createSale({ lines, method: $("#v-method", root).value, clientName: name || "Venta directa", clientId: cli ? cli.id : null });
    toast(`Venta #${String(sale.sale.ticketNo).padStart(5, "0")} · ${eur(sale.sale.total)}`);
    renderVentas(root);
  };

  drawRecent(root);
}

function drawRecent(root) {
  const sales = listSales().slice(0, 12);
  const box = $("#v-recent", root);
  box.innerHTML = sales.length ? "" : `<p class="empty">Todavía no hay ventas directas.</p>`;
  for (const a of sales) {
    const concept = a.sale.lines.map((l) => `${l.name}${(l.qty || 1) > 1 ? ` ×${l.qty}` : ""}`).join(", ");
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row-main">
        <h4>#${String(a.sale.ticketNo).padStart(5, "0")} · ${eur(a.sale.total)} ${a.sale.method === "tarjeta" ? "💳" : "💵"}</h4>
        <p>${fmtShort(a.date)} ${esc(a.time)} · ${esc(concept)}${a.clientName && a.clientName !== "Venta directa" ? " · " + esc(a.clientName) : ""}</p>
      </div>
      <div class="row-actions">
        <button class="icon-btn" data-print title="Imprimir ticket">🖨️</button>
        <button class="icon-btn del" data-del title="Eliminar">🗑</button>
      </div>`;
    row.querySelector("[data-print]").onclick = () => printTicket(a);
    row.querySelector("[data-del]").onclick = () => { if (confirmDialog("¿Eliminar esta venta? Se devolverá el stock.")) { restoreStock(a.sale.lines); deleteAppt(a.id); renderVentas(root); } };
    box.appendChild(row);
  }
}

// ---- widget de líneas (producto, precio, cantidad) ----
function addLine(container, products, onChange) {
  const el = document.createElement("div");
  el.className = "line";
  const opts = products.map((p) => `<option value="${p.id}">${esc(p.name)} — ${eur(p.price)}</option>`).join("");
  el.innerHTML = `
    <select data-prod><option value="">— elegir —</option>${opts}</select>
    <input data-price type="number" step="0.01" min="0" placeholder="0,00" />
    <input data-qty type="number" min="1" value="1" />
    <button type="button" class="icon-btn del" data-rm title="Quitar">✕</button>`;
  const sel = el.querySelector("[data-prod]"), price = el.querySelector("[data-price]"), qty = el.querySelector("[data-qty]");
  sel.addEventListener("change", () => { const p = getProduct(sel.value); if (p) price.value = p.price; onChange && onChange(); });
  price.addEventListener("input", () => onChange && onChange());
  qty.addEventListener("input", () => onChange && onChange());
  el.querySelector("[data-rm]").onclick = () => { el.remove(); onChange && onChange(); };
  container.appendChild(el);
}

function readLines(container) {
  return [...container.querySelectorAll(".line")].map((el) => {
    const sel = el.querySelector("[data-prod]");
    const p = getProduct(sel.value);
    const price = Number(el.querySelector("[data-price]").value) || 0;
    const qty = Number(el.querySelector("[data-qty]").value) || 1;
    if (!sel.value && !price) return null;
    return { productId: sel.value || null, name: p ? p.name : (sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text.split(" — ")[0] : "Producto"), price, cost: p ? p.cost : 0, qty };
  }).filter(Boolean);
}

function printTicket(a) {
  const base = a.sale.total / (1 + IVA), iva = a.sale.total - base;
  const lines = a.sale.lines.map((l) => `<tr><td>${esc(l.name)}</td><td style="text-align:center">${l.qty || 1}</td><td style="text-align:right">${eur(l.price * (l.qty || 1))}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Ticket #${a.sale.ticketNo}</title>
    <style>body{font-family:'Segoe UI',sans-serif;max-width:300px;margin:0 auto;padding:18px;color:#111}h1{font-size:19px;text-align:center;margin:0 0 2px}.sub{text-align:center;font-size:12px;color:#555;margin-bottom:10px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:4px 0}hr{border:0;border-top:1px dashed #aaa;margin:10px 0}.grand td{font-size:15px;font-weight:700}.foot{text-align:center;font-size:11px;color:#777;margin-top:18px}</style></head><body>
    <h1>✂️ Peluquería Rossi</h1>
    <div class="sub">Ticket nº ${String(a.sale.ticketNo).padStart(5, "0")}<br>${esc(a.date)} · ${esc(a.time)}</div>
    <hr><table><thead><tr><th style="text-align:left">Producto</th><th>Uds</th><th style="text-align:right">Importe</th></tr></thead><tbody>${lines}</tbody></table><hr>
    <table><tr><td>Base imponible</td><td style="text-align:right">${eur(base)}</td></tr><tr><td>IVA (${Math.round(IVA * 100)}%)</td><td style="text-align:right">${eur(iva)}</td></tr><tr class="grand"><td>TOTAL</td><td style="text-align:right">${eur(a.sale.total)}</td></tr></table>
    <div style="font-size:12px;margin-top:8px">Forma de pago: ${a.sale.method === "tarjeta" ? "Tarjeta" : "Efectivo"}</div>
    <div class="foot">¡Gracias por tu compra! ✂️</div>
    <script>window.onload=function(){setTimeout(function(){window.print()},150)}<\/script></body></html>`;
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) { toast("Permite las ventanas emergentes para imprimir"); return; }
  w.document.write(html); w.document.close();
}
