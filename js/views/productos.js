import { $, esc, openModal, toast, confirmDialog, eur } from "../util.js";
import { listProducts, upsertProduct, deleteProduct, getProduct } from "../store.js";

export function renderProductos(root) {
  const prods = listProducts();
  root.innerHTML = `
    <div class="page-head">
      <div><h2>Productos y servicios</h2><p class="sub">${prods.length} en catálogo · el coste sirve para calcular el beneficio</p></div>
      <button class="btn btn-primary" id="pr-new">+ Nuevo</button>
    </div>
    <div class="card" style="padding:6px 0">
      <table class="tbl" style="width:100%">
        <thead><tr><th>Nombre</th><th>Tipo</th><th class="num">Precio</th><th class="num">Coste</th><th class="num">Margen</th><th></th></tr></thead>
        <tbody id="pr-body"></tbody>
      </table>
    </div>`;

  const body = $("#pr-body", root);
  body.innerHTML = prods.length ? "" : `<tr><td colspan="6" class="empty">Sin productos. Añade el primero.</td></tr>`;
  for (const p of prods) {
    const margin = p.price - p.cost;
    const pct = p.price ? Math.round((margin / p.price) * 100) : 0;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${esc(p.name)}</b>${p.active ? "" : ' <span class="muted">(inactivo)</span>'}</td>
      <td><span class="tag cat">${p.category === "servicio" ? "Servicio" : "Producto"}</span></td>
      <td class="num">${eur(p.price)}</td>
      <td class="num">${eur(p.cost)}</td>
      <td class="num ${margin >= 0 ? "pos" : "neg"}">${eur(margin)} <span class="muted">(${pct}%)</span></td>
      <td class="num"><button class="icon-btn" data-edit title="Editar">✏️</button> <button class="icon-btn del" data-del title="Eliminar">🗑</button></td>`;
    tr.querySelector("[data-edit]").onclick = () => editProduct(p.id, () => renderProductos(root));
    tr.querySelector("[data-del]").onclick = () => { if (confirmDialog(`¿Eliminar "${p.name}"?`)) { deleteProduct(p.id); renderProductos(root); } };
    body.appendChild(tr);
  }
  $("#pr-new", root).onclick = () => editProduct(null, () => renderProductos(root));
}

function form(p = {}) {
  const cat = p.category || "servicio";
  return `
    <div class="form-grid">
      <label>Nombre <input id="f-name" value="${esc(p.name || "")}" required /></label>
      <label>Tipo
        <select id="f-cat">
          <option value="servicio" ${cat === "servicio" ? "selected" : ""}>Servicio</option>
          <option value="producto" ${cat === "producto" ? "selected" : ""}>Producto (venta)</option>
        </select>
      </label>
      <div class="row-2">
        <label>Precio de venta (€) <input id="f-price" type="number" step="0.01" min="0" value="${p.price ?? ""}" /></label>
        <label>Coste para ti (€) <input id="f-cost" type="number" step="0.01" min="0" value="${p.cost ?? ""}" /></label>
      </div>
      <label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="f-active" ${p.active === false ? "" : "checked"} style="width:auto" /> Activo (disponible para cobrar)</label>
    </div>`;
}

export function editProduct(id, onDone) {
  const p = id ? getProduct(id) : {};
  openModal({
    title: id ? "Editar" : "Nuevo producto/servicio",
    body: form(p),
    onSave: (m) => {
      const name = $("#f-name", m).value.trim();
      if (!name) { toast("Indica el nombre"); return false; }
      upsertProduct({ id, name, category: $("#f-cat", m).value, price: $("#f-price", m).value, cost: $("#f-cost", m).value, active: $("#f-active", m).checked });
      toast("Guardado");
      onDone && onDone();
    },
  });
}
