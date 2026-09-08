import { $, $$, esc, eur, toast, confirmDialog, fmtShort } from "../util.js?v=23";
import { listProducts, getProduct, listClients, listSales, loadRemote, IVA } from "../store.js?v=23";
import { apiSaleAdd, apiSaleDelete } from "../api.js?v=23";
import { makeCombobox } from "../combobox.js?v=23";

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
            <div class="cb-wrap" id="v-client-combo">
              <input class="cb-inp" id="v-client-inp" placeholder="Venta directa" autocomplete="off" spellcheck="false" />
              <input type="hidden" id="v-client-sel" />
              <div class="cb-drop" hidden></div>
            </div>
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

  // combobox de cliente (opcional): texto libre tipo "Venta directa", o elegir uno de la lista
  makeCombobox($("#v-client-combo", root), clients.map((c) => ({ value: c.id, label: c.name })), "", null, { freeText: true });

  const cont = $("#v-items", root);
  const recalc = () => {
    const lines = readLines(cont);
    $("#v-total", root).textContent = eur(lines.reduce((s, l) => s + l.price * l.qty, 0));
  };
  addLine(cont, products, recalc);
  $("#v-add", root).onclick = () => addLine(cont, products, recalc);
  recalc();

  $("#v-save", root).onclick = async () => {
    const lines = readLines(cont);
    if (!lines.length) { toast("Añade al menos un producto"); return; }
    const name = $("#v-client-inp", root).value.trim();
    const sel = $("#v-client-sel", root).value;
    const cli = clients.find((c) => c.id === sel) || clients.find((c) => c.name.toLowerCase() === name.toLowerCase());
    try {
      // El servidor asigna ticket, calcula totales y descuenta stock.
      const sale = await apiSaleAdd({ lines, method: $("#v-method", root).value, clientName: name || "Venta directa", clientId: cli ? cli.id : null });
      await loadRemote();
      toast(`Venta #${String(sale.sale.ticketNo).padStart(5, "0")} · ${eur(sale.sale.total)}`);
      renderVentas(root);
    } catch (e) {
      toast(`No se pudo cobrar la venta: ${e.message}`);
    }
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
    row.querySelector("[data-del]").onclick = async () => {
      if (!confirmDialog("¿Eliminar esta venta? Se devolverá el stock.")) return;
      try {
        await apiSaleDelete(a.id); // el servidor devuelve el stock en el mismo commit
        await loadRemote();
        renderVentas(root);
      } catch (e) { toast(`No se pudo eliminar: ${e.message}`); }
    };
    box.appendChild(row);
  }
}

// ---- widget de líneas (combobox de producto, precio, cantidad) ----
function addLine(container, products, onChange) {
  const el = document.createElement("div");
  el.className = "line";
  el.innerHTML = `
    <div class="cb-wrap">
      <input class="cb-inp" placeholder="— elegir producto —" autocomplete="off" spellcheck="false" />
      <input type="hidden" data-prod />
      <div class="cb-drop" hidden></div>
    </div>
    <input data-price type="number" step="0.01" min="0" placeholder="0,00" />
    <input data-qty type="number" min="1" value="1" />
    <button type="button" class="icon-btn del" data-rm title="Quitar">✕</button>`;
  const price = el.querySelector("[data-price]"), qty = el.querySelector("[data-qty]");
  const prodItems = products.map((p) => ({ value: p.id, label: `${p.name} — ${eur(p.price)}` }));
  makeCombobox(el.querySelector(".cb-wrap"), prodItems, "", (val) => {
    const p = getProduct(val);
    if (p) price.value = p.price;
    onChange && onChange();
  });
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
    const cbInp = el.querySelector(".cb-inp");
    const name = p ? p.name : (cbInp ? cbInp.value.split(" — ")[0].trim() : "");
    if (!sel.value && !price) return null;
    return { productId: sel.value || null, name: name || "Producto", price, cost: p ? p.cost : 0, qty };
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
