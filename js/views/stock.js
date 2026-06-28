import { $, esc, eur, toast, openModal } from "../util.js?v=12";
import { listStock, isLow, adjustStock, setStockValues } from "../store.js?v=12";

export function renderStock(root) {
  const items = listStock();
  const low = items.filter(isLow);
  const units = items.reduce((s, p) => s + (Number(p.stock) || 0), 0);
  const value = items.reduce((s, p) => s + (Number(p.stock) || 0) * (p.cost || 0), 0);

  root.innerHTML = `
    <div class="page-head">
      <div><h2>Stock</h2><p class="sub">Inventario de productos de venta · se descuenta solo al cobrar</p></div>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="v">${items.length}</div><div class="l">Productos en stock</div></div>
      <div class="kpi"><div class="v">${units}</div><div class="l">Unidades totales</div></div>
      <div class="kpi accent"><div class="v">${eur(value)}</div><div class="l">Valor inventario (a coste)</div></div>
      <div class="kpi ${low.length ? "bad" : "good"}"><div class="v">${low.length}</div><div class="l">${low.length ? "Hay que reponer" : "Todo en orden"}</div></div>
    </div>
    ${low.length ? `<div class="section-card" style="margin-bottom:16px;border-color:var(--red);background:var(--red-soft)">
      <b style="color:var(--red)">⚠️ Reponer pronto:</b> ${low.map((p) => esc(p.name)).join(" · ")}
    </div>` : ""}
    <div class="card" style="padding:6px 0">
      <table class="tbl" style="width:100%">
        <thead><tr><th>Producto</th><th class="num">Stock</th><th class="num">Mínimo</th><th>Estado</th><th class="num">Valor (coste)</th><th></th></tr></thead>
        <tbody id="st-body"></tbody>
      </table>
    </div>
    <p class="muted" style="font-size:.78rem;margin-top:10px">El coste de cada producto ya se descuenta del beneficio al venderlo (ver Estadísticas). Aquí ves el capital que tienes inmovilizado en stock.</p>`;

  const body = $("#st-body", root);
  body.innerHTML = items.length ? "" : `<tr><td colspan="6" class="empty">No hay productos de venta. Créalos en la pestaña Productos.</td></tr>`;
  for (const p of items) {
    const stock = Number(p.stock) || 0;
    const lowIt = isLow(p);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${esc(p.name)}</b></td>
      <td class="num"><b style="${lowIt ? "color:var(--red)" : ""}">${stock}</b></td>
      <td class="num muted">${p.minStock ?? 0}</td>
      <td>${lowIt
        ? '<span class="tag" style="background:var(--red-soft);color:var(--red)">Reponer</span>'
        : '<span class="tag s-completada">OK</span>'}</td>
      <td class="num">${eur(stock * (p.cost || 0))}</td>
      <td class="num">
        <button class="icon-btn" data-add title="Reponer (entrada)">➕</button>
        <button class="icon-btn" data-edit title="Ajustar stock y mínimo">✏️</button>
      </td>`;
    tr.querySelector("[data-add]").onclick = () => restock(p, () => renderStock(root));
    tr.querySelector("[data-edit]").onclick = () => adjust(p, () => renderStock(root));
    body.appendChild(tr);
  }
}

function restock(p, onDone) {
  openModal({
    title: `Reponer · ${p.name}`,
    saveLabel: "Añadir",
    body: `<div class="form-grid">
      <label>Unidades que entran <input id="r-add" type="number" min="1" value="1" /></label>
      <p class="muted" style="font-size:.8rem">Stock actual: <b>${Number(p.stock) || 0}</b> uds</p>
    </div>`,
    onSave: (m) => {
      const n = Number($("#r-add", m).value) || 0;
      if (n <= 0) { toast("Indica una cantidad válida"); return false; }
      adjustStock(p.id, n);
      toast(`+${n} uds en ${p.name}`);
      onDone && onDone();
    },
  });
}

function adjust(p, onDone) {
  openModal({
    title: `Ajustar · ${p.name}`,
    saveLabel: "Guardar",
    body: `<div class="form-grid">
      <div class="row-2">
        <label>Stock actual (uds) <input id="a-stock" type="number" min="0" value="${Number(p.stock) || 0}" /></label>
        <label>Avisar si baja de <input id="a-min" type="number" min="0" value="${p.minStock ?? 0}" /></label>
      </div>
      <p class="muted" style="font-size:.8rem">Usa esto para corregir tras un recuento manual.</p>
    </div>`,
    onSave: (m) => {
      setStockValues(p.id, $("#a-stock", m).value, $("#a-min", m).value);
      toast("Stock actualizado");
      onDone && onDone();
    },
  });
}
