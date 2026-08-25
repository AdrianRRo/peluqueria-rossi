// ====== Vista "Página web": galería + grupos/servicios de la web pública ======
// La dueña gestiona aquí lo que se ve en la web (rossisalondebelleza.com):
//  - Fotos de la sección "Nuestro estilo".
//  - Grupos de servicios (con descripción) y sus servicios. El precio es OPCIONAL:
//    si no hay precio, en la web sale el servicio SIN precio.
//  - Flag "mostrar en la portada": los grupos marcados salen como tarjeta en la
//    home; todos salen en la página de servicios.
import { $, $$, esc, openModal, toast, confirmDialog } from "../util.js?v=22";
import {
  imgUrl, apiGalleryList, apiGalleryAdd, apiGalleryPatch, apiGalleryDelete,
  apiWebGroups, apiWebGroupAdd, apiWebGroupPatch, apiWebGroupDelete,
  apiWebServiceAdd, apiWebServicePatch, apiWebServiceDelete,
} from "../api.js?v=22";

const MAX_MB = 6;
const TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export async function renderWeb(root) {
  root.innerHTML = `
    <div class="page-head">
      <div><h2>Página web</h2><p class="sub">Gestiona lo que se ve en tu web: fotos y servicios</p></div>
    </div>
    <div class="card" style="padding:14px;margin-bottom:16px">
      <div class="page-head" style="margin:0 0 10px">
        <div><h3 style="margin:0">Fotos de “Nuestro estilo”</h3>
          <p class="sub">Se muestran en la galería de la web. Formatos: JPG, PNG o WebP (máx ${MAX_MB} MB).</p></div>
        <button class="btn btn-primary" id="g-add">+ Subir foto</button>
      </div>
      <div id="g-grid" class="web-galeria"></div>
    </div>
    <div class="card" style="padding:14px">
      <div class="page-head" style="margin:0 0 10px">
        <div><h3 style="margin:0">Servicios</h3>
          <p class="sub">Grupos y servicios. El precio es opcional: si lo dejas vacío, en la web no se muestra precio. Marca “portada” para que el grupo salga en la página principal.</p></div>
        <button class="btn btn-primary" id="s-add-group">+ Nuevo grupo</button>
      </div>
      <div id="s-groups"></div>
    </div>`;

  await Promise.all([loadGallery(root), loadGroups(root)]);
  $("#g-add", root).onclick = () => uploadPhoto(() => loadGallery(root));
  $("#s-add-group", root).onclick = () => editGroup(null, () => loadGroups(root));
}

// ---------- Galería ----------
async function loadGallery(root) {
  const grid = $("#g-grid", root);
  grid.innerHTML = `<p class="muted">Cargando…</p>`;
  let imgs = [];
  try { imgs = await apiGalleryList(); }
  catch (e) { grid.innerHTML = `<p class="neg">No se pudo cargar (${esc(e.message)})</p>`; return; }
  if (!imgs.length) { grid.innerHTML = `<p class="empty">Aún no hay fotos. Sube la primera.</p>`; return; }
  grid.innerHTML = "";
  imgs.forEach((im, i) => {
    const card = document.createElement("figure");
    card.className = "web-foto";
    card.innerHTML = `
      <img src="${imgUrl(im.id)}" alt="${esc(im.alt || "")}" loading="lazy" />
      <figcaption>${esc(im.alt || "Sin descripción")}</figcaption>
      <div class="web-foto__acc">
        <button class="icon-btn" data-up title="Subir" ${i === 0 ? "disabled" : ""}>↑</button>
        <button class="icon-btn" data-down title="Bajar" ${i === imgs.length - 1 ? "disabled" : ""}>↓</button>
        <button class="icon-btn" data-alt title="Editar descripción">✏️</button>
        <button class="icon-btn del" data-del title="Eliminar">🗑</button>
      </div>`;
    card.querySelector("[data-alt]").onclick = () => editAlt(im, () => loadGallery(root));
    card.querySelector("[data-del]").onclick = async () => {
      if (!confirmDialog("¿Eliminar esta foto de la web?")) return;
      try { await apiGalleryDelete(im.id); toast("Foto eliminada"); loadGallery(root); }
      catch (e) { toast("Error: " + e.message); }
    };
    card.querySelector("[data-up]").onclick = () => swapSort(imgs, i, i - 1, root);
    card.querySelector("[data-down]").onclick = () => swapSort(imgs, i, i + 1, root);
    grid.appendChild(card);
  });
}

async function swapSort(imgs, i, j, root) {
  if (j < 0 || j >= imgs.length) return;
  const a = imgs[i], b = imgs[j];
  try {
    await apiGalleryPatch(a.id, { sort: b.sort });
    await apiGalleryPatch(b.id, { sort: a.sort });
    loadGallery(root);
  } catch (e) { toast("Error: " + e.message); }
}

function editAlt(im, onDone) {
  openModal({
    title: "Descripción de la foto",
    body: `<div class="form-grid"><label>Texto alternativo (ayuda al SEO y accesibilidad)
      <input id="f-alt" value="${esc(im.alt || "")}" maxlength="200" placeholder="Ej: Mechas balayage en melena larga" /></label></div>`,
    onSave: async (m) => {
      try { await apiGalleryPatch(im.id, { alt: $("#f-alt", m).value.trim() }); toast("Guardado"); onDone(); }
      catch (e) { toast("Error: " + e.message); return false; }
    },
  });
}

function uploadPhoto(onDone) {
  openModal({
    title: "Subir foto",
    body: `<div class="form-grid">
        <label>Foto (JPG, PNG o WebP · máx ${MAX_MB} MB)
          <input id="f-file" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        <label>Descripción (opcional)
          <input id="f-alt" maxlength="200" placeholder="Ej: Recogido de novia" /></label>
        <div id="f-prev"></div>
      </div>`,
    saveLabel: "Subir",
    onShow: (m) => {
      $("#f-file", m).addEventListener("change", () => {
        const f = $("#f-file", m).files[0];
        $("#f-prev", m).innerHTML = f ? `<img src="${URL.createObjectURL(f)}" style="max-width:100%;border-radius:8px;margin-top:8px" />` : "";
      });
    },
    onSave: async (m) => {
      const f = $("#f-file", m).files[0];
      if (!f) { toast("Elige una foto"); return false; }
      if (!TYPES.includes(f.type)) { toast("Formato no válido (JPG, PNG o WebP)"); return false; }
      if (f.size > MAX_MB * 1024 * 1024) { toast(`Demasiado grande (máx ${MAX_MB} MB)`); return false; }
      const btn = $("[data-save]", m); if (btn) { btn.disabled = true; btn.textContent = "Subiendo…"; }
      try {
        const data = await fileToBase64(f);
        await apiGalleryAdd(f.type, data, $("#f-alt", m).value.trim());
        toast("Foto subida");
        onDone();
      } catch (e) { toast("Error: " + e.message); if (btn) { btn.disabled = false; btn.textContent = "Subir"; } return false; }
    },
  });
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",", 2)[1] || "");
    r.onerror = () => rej(new Error("no se pudo leer el archivo"));
    r.readAsDataURL(file);
  });
}

// ---------- Servicios (grupos + servicios) ----------
async function loadGroups(root) {
  const wrap = $("#s-groups", root);
  wrap.innerHTML = `<p class="muted">Cargando…</p>`;
  let groups = [];
  try { groups = await apiWebGroups(); }
  catch (e) { wrap.innerHTML = `<p class="neg">No se pudo cargar (${esc(e.message)})</p>`; return; }
  if (!groups.length) { wrap.innerHTML = `<p class="empty">Aún no hay grupos. Crea el primero (p. ej. “Cortes”).</p>`; return; }
  wrap.innerHTML = "";
  groups.forEach((g, gi) => {
    const box = document.createElement("div");
    box.className = "web-grupo";
    const rows = g.services.map((s) => `
      <tr>
        <td><b>${esc(s.name)}</b>${s.active ? "" : ' <span class="muted">(oculto)</span>'}</td>
        <td class="num">${s.price == null ? '<span class="muted">sin precio</span>' : esc(String(s.price)) + " €"}</td>
        <td class="num">
          <button class="icon-btn" data-se="${s.id}" title="Editar">✏️</button>
          <button class="icon-btn del" data-sd="${s.id}" title="Eliminar">🗑</button>
        </td>
      </tr>`).join("");
    box.innerHTML = `
      <div class="web-grupo__head">
        <div>
          <h4>${esc(g.title)}
            ${g.show_in_landing ? '<span class="tag cat">en portada</span>' : '<span class="tag">solo en servicios</span>'}
          </h4>
          <p class="sub">${esc(g.description || "Sin descripción")}</p>
        </div>
        <div class="web-grupo__acc">
          <button class="icon-btn" data-gup ${gi === 0 ? "disabled" : ""} title="Subir grupo">↑</button>
          <button class="icon-btn" data-gdown ${gi === groups.length - 1 ? "disabled" : ""} title="Bajar grupo">↓</button>
          <button class="btn btn-ghost" data-gedit>Editar grupo</button>
          <button class="btn btn-ghost del" data-gdel>Eliminar</button>
        </div>
      </div>
      <table class="tbl" style="width:100%">
        <thead><tr><th>Servicio</th><th class="num">Precio</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3" class="empty">Sin servicios</td></tr>`}</tbody>
      </table>
      <button class="btn btn-ghost" data-sadd>+ Añadir servicio</button>`;

    box.querySelector("[data-gedit]").onclick = () => editGroup(g, () => loadGroups(root));
    box.querySelector("[data-gdel]").onclick = async () => {
      if (!confirmDialog(`¿Eliminar el grupo "${g.title}" y todos sus servicios?`)) return;
      try { await apiWebGroupDelete(g.id); toast("Grupo eliminado"); loadGroups(root); }
      catch (e) { toast("Error: " + e.message); }
    };
    box.querySelector("[data-sadd]").onclick = () => editService(g.id, null, () => loadGroups(root));
    box.querySelector("[data-gup]").onclick = () => swapGroup(groups, gi, gi - 1, root);
    box.querySelector("[data-gdown]").onclick = () => swapGroup(groups, gi, gi + 1, root);
    $$("[data-se]", box).forEach((b) => b.onclick = () => {
      const s = g.services.find((x) => x.id == b.dataset.se);
      editService(g.id, s, () => loadGroups(root));
    });
    $$("[data-sd]", box).forEach((b) => b.onclick = async () => {
      const s = g.services.find((x) => x.id == b.dataset.sd);
      if (!confirmDialog(`¿Eliminar el servicio "${s.name}"?`)) return;
      try { await apiWebServiceDelete(s.id); toast("Servicio eliminado"); loadGroups(root); }
      catch (e) { toast("Error: " + e.message); }
    });
    wrap.appendChild(box);
  });
}

async function swapGroup(groups, i, j, root) {
  if (j < 0 || j >= groups.length) return;
  const a = groups[i], b = groups[j];
  try {
    await apiWebGroupPatch(a.id, { sort: b.sort });
    await apiWebGroupPatch(b.id, { sort: a.sort });
    loadGroups(root);
  } catch (e) { toast("Error: " + e.message); }
}

function editGroup(g, onDone) {
  const isNew = !g;
  openModal({
    title: isNew ? "Nuevo grupo" : "Editar grupo",
    body: `<div class="form-grid">
        <label>Título <input id="f-title" value="${esc(g?.title || "")}" maxlength="120" placeholder="Ej: Color y mechas" /></label>
        <label>Descripción corta (se ve en la portada)
          <input id="f-desc" value="${esc(g?.description || "")}" maxlength="400" placeholder="Ej: Balayage, mechas babylight y tintes a tu medida." /></label>
        <label style="flex-direction:row;align-items:center;gap:8px">
          <input type="checkbox" id="f-land" ${g?.show_in_landing ? "checked" : ""} style="width:auto" />
          Mostrar en la portada (página principal)</label>
      </div>`,
    saveLabel: isNew ? "Crear" : "Guardar",
    onSave: async (m) => {
      const title = $("#f-title", m).value.trim();
      if (!title) { toast("Indica el título"); return false; }
      const payload = { title, description: $("#f-desc", m).value.trim(), show_in_landing: $("#f-land", m).checked };
      try {
        if (isNew) await apiWebGroupAdd(payload); else await apiWebGroupPatch(g.id, payload);
        toast("Guardado"); onDone();
      } catch (e) { toast("Error: " + e.message); return false; }
    },
  });
}

function editService(gid, s, onDone) {
  const isNew = !s;
  openModal({
    title: isNew ? "Nuevo servicio" : "Editar servicio",
    body: `<div class="form-grid">
        <label>Nombre <input id="f-name" value="${esc(s?.name || "")}" maxlength="120" placeholder="Ej: Corte de mujer" /></label>
        <label>Precio en € (opcional — vacío = no se muestra precio en la web)
          <input id="f-price" type="number" step="0.01" min="0" value="${s?.price ?? ""}" placeholder="Ej: 16" /></label>
        ${isNew ? "" : `<label style="flex-direction:row;align-items:center;gap:8px">
          <input type="checkbox" id="f-active" ${s?.active === false ? "" : "checked"} style="width:auto" /> Visible en la web</label>`}
      </div>`,
    saveLabel: isNew ? "Añadir" : "Guardar",
    onSave: async (m) => {
      const name = $("#f-name", m).value.trim();
      if (!name) { toast("Indica el nombre"); return false; }
      const price = $("#f-price", m).value;
      try {
        if (isNew) {
          await apiWebServiceAdd(gid, { name, price });
        } else {
          await apiWebServicePatch(s.id, { name, price, active: $("#f-active", m).checked });
        }
        toast("Guardado"); onDone();
      } catch (e) { toast("Error: " + e.message); return false; }
    },
  });
}
