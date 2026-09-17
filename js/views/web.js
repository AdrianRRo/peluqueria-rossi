// ====== Vista "Página web": galería + grupos/servicios de la web pública ======
// La dueña gestiona aquí lo que se ve en la web (rossisalondebelleza.com):
//  - Fotos de la sección "Nuestro estilo".
//  - Grupos de servicios (con descripción) y sus servicios. El precio es OPCIONAL:
//    si no hay precio, en la web sale el servicio SIN precio.
//  - Flag "mostrar en la portada": los grupos marcados salen como tarjeta en la
//    home; todos salen en la página de servicios.
import { $, $$, esc, openModal, toast, confirmDialog } from "../util.js?v=24";
import {
  imgUrl, apiGalleryList, apiGalleryAdd, apiGalleryPatch, apiGalleryDelete,
  apiWebGroups, apiWebGroupAdd, apiWebGroupPatch, apiWebGroupDelete,
  apiWebServiceAdd, apiWebServicePatch, apiWebServiceDelete,
  apiWebStats, apiWebGroupImageSet, apiWebGroupImageDel, groupImgUrl,
} from "../api.js?v=24";

const MAX_MB = 6;
const TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export async function renderWeb(root) {
  root.innerHTML = `
    <div class="page-head">
      <div><h2>Página web</h2><p class="sub">Gestiona lo que se ve en tu web: fotos y servicios</p></div>
    </div>
    <div class="card" style="padding:14px;margin-bottom:16px">
      <div class="page-head" style="margin:0 0 10px">
        <div><h3 style="margin:0">Estadísticas de la web</h3>
          <p class="sub">Visitas y clics en WhatsApp registrados por rossisalondebelleza.com.</p></div>
        <button class="btn btn-soft" id="w-refresh">↻ Actualizar</button>
      </div>
      <div id="w-stats"></div>
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

  loadWebStats(root); // sin await: la carga de stats no bloquea el resto del tab
  await Promise.all([loadGallery(root), loadGroups(root)]);
  $("#w-refresh", root).onclick = () => loadWebStats(root);
  $("#g-add", root).onclick = () => uploadPhoto(() => loadGallery(root));
  $("#s-add-group", root).onclick = () => editGroup(null, () => loadGroups(root));
}

// ---------- Estadísticas de la web ----------
const KIND_LABEL = { visit: "visita", click_wa: "clic WhatsApp" };

function hostOnly(url) {
  if (!url) return null;
  try { return new URL(url).hostname; } catch { return url; }
}

// El backend ya clasifica el User-Agent en columnas propias (ua_browser, ua_os,
// ua_device, is_bot). ANTES esta función hacía `ua.split(" ")[0]`, que en todos los
// navegadores reales devuelve "Mozilla/5.0" -> el panel pintaba siempre lo mismo.
// Ahora se usan las columnas y el UA crudo es solo el último recurso.
function browserOf(e) {
  return e?.navegador || e?.ua_browser || null;
}

function osOf(e) { return e?.so || e?.ua_os || null; }
function deviceOf(e) { return e?.dispositivo || e?.ua_device || null; }

// Un bot no es una visita: se marca en su propia columna para que la dueña no lo
// confunda con una clienta (Googlebot aparecía como "Chrome").
function quienOf(e) {
  if (e?.is_bot) return { txt: "Bot", cls: "tag" };
  const b = browserOf(e), o = osOf(e), d = deviceOf(e);
  const partes = [b, o].filter(Boolean);
  return { txt: (partes.length ? partes.join(" · ") : (d || "—")), cls: "tag cat" };
}

// Agrupa los eventos por sesión anónima (sid). Sin sid no hay sesión que agrupar.
function porSesion(evs) {
  const m = new Map();
  evs.forEach((e) => {
    const k = e.sesion || null;
    if (!k) return;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(e);
  });
  return m;
}

async function loadWebStats(root) {
  const host = $("#w-stats", root);
  if (!host) return; // el usuario cambió de tab mientras cargaba
  host.innerHTML = `<p class="muted">Cargando…</p>`;
  let s;
  try { s = await apiWebStats(); }
  catch (e) {
    // 404 = backend anterior al panel; red/caída = servicio no disponible.
    // En cualquier caso el resto del tab sigue funcionando.
    host.innerHTML = `<p class="empty">Estadísticas no disponibles todavía</p>`;
    return;
  }
  const sinDatos = !s.total_visitas && !s.clicks_wa_total && !(s.ultimos || []).length;
  if (sinDatos) {
    host.innerHTML = `<p class="empty">Aún no hay visitas registradas. Cuando la web pública reciba tráfico, lo verás aquí.</p>`;
    return;
  }

  const sesiones = porSesion(s.ultimos || []);
  const rows = (s.ultimos || []).map((e) => {
    const d = new Date(e.ts);
    const q = quienOf(e);
    return `<tr>
      <td>${Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
      <td>${esc(KIND_LABEL[e.kind] || e.kind)}</td>
      <td>${esc(e.path || "—")}</td>
      <td><span class="${q.cls}">${esc(q.txt)}</span></td>
      <td>${esc(e.country || "—")}</td>
      <td>${e.sesion ? `<code>${esc(String(e.sesion).slice(0, 6))}</code>` : "—"}</td>
    </tr>`;
  }).join("");

  host.innerHTML = `
    <div class="kpis" style="margin-bottom:14px">
      <div class="kpi accent"><div class="v">${s.total_visitas}</div><div class="l">Visitas totales</div></div>
      <div class="kpi"><div class="v">${s.sesiones_30d ?? 0}</div><div class="l">Sesiones (30d)</div></div>
      <div class="kpi"><div class="v">${s.unicos_30d}</div><div class="l">Visitantes únicos (30d)</div></div>
      <div class="kpi good"><div class="v">${s.clicks_wa_total}</div><div class="l">Clics WhatsApp (total)</div></div>
      <div class="kpi"><div class="v">${s.clicks_wa_30d}</div><div class="l">Clics WhatsApp (30d)</div></div>
      <div class="kpi"><div class="v">${s.bots_excluidos ?? 0}</div><div class="l">Bots excluidos</div></div>
    </div>
    ${bloqueReparto("Dispositivo", s.por_dispositivo)}
    ${bloqueReparto("Navegador", s.por_navegador)}
    ${bloqueReparto("Sistema operativo", s.por_so)}
    ${bloqueReparto("País", s.por_pais)}
    <p class="sub" style="margin:14px 0 6px">
      Visitas agrupadas en <b>${sesiones.size}</b> sesión(es) anónima(s). Los bots no cuentan como visitas.
    </p>
    <table class="tbl" style="width:100%">
      <thead><tr><th>Hora</th><th>Tipo</th><th>Página</th><th>Quién</th><th>País</th><th>Sesión</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// Reparto horizontal (navegador/SO/dispositivo/país) con barras proporcionales.
function bloqueReparto(titulo, lista) {
  const arr = lista || [];
  if (!arr.length) return "";
  const max = Math.max(...arr.map((x) => x.n)) || 1;
  const filas = arr.map((x) => `
    <div style="display:flex;align-items:center;gap:8px;margin:3px 0">
      <div style="flex:0 0 120px" class="sub">${esc(x.valor)}</div>
      <div style="flex:1;background:var(--borde,#eee);border-radius:4px;height:10px">
        <div style="width:${Math.round((x.n / max) * 100)}%;height:10px;border-radius:4px;background:#e8798f"></div>
      </div>
      <div style="flex:0 0 34px;text-align:right" class="num">${x.n}</div>
    </div>`).join("");
  return `<div style="margin-top:10px">
    <p class="sub" style="margin:0 0 2px"><b>${titulo}</b></p>${filas}</div>`;
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
      <div class="web-grupo__foto">
        ${g.image_url
          ? `<img src="${esc(groupImgUrl(g.id, g.image_thumb || g.image_url))}" alt="${esc(g.title)}" class="web-grupo__img" />
             <div class="web-grupo__fotoacc">
               <button class="btn btn-ghost" data-gimg>Cambiar imagen</button>
               <button class="btn btn-ghost del" data-gimgdel>Quitar imagen</button>
             </div>`
          : `<div class="web-grupo__sinfoto">
               <span class="muted">Sin imagen. Esta imagen se ve en la portada y en “Servicios”.</span>
               <button class="btn btn-ghost" data-gimg>+ Añadir imagen</button>
             </div>`}
      </div>
      <table class="tbl" style="width:100%">
        <thead><tr><th>Servicio</th><th class="num">Precio</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3" class="empty">Sin servicios</td></tr>`}</tbody>
      </table>
      <button class="btn btn-ghost" data-sadd>+ Añadir servicio</button>`;

    box.querySelector("[data-gedit]").onclick = () => editGroup(g, () => loadGroups(root));
    box.querySelector("[data-gimg]").onclick = () => uploadGroupImage(g, () => loadGroups(root));
    const bDel = box.querySelector("[data-gimgdel]");
    if (bDel) bDel.onclick = async () => {
      if (!confirmDialog(`¿Quitar la imagen del grupo "${g.title}"?`)) return;
      try { await apiWebGroupImageDel(g.id); toast("Imagen quitada"); loadGroups(root); }
      catch (e) { toast("Error: " + e.message); }
    };
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

// Imagen de cabecera del grupo: 1 imagen por grupo, igual que las fotos de la
// galería (base64 -> API, que la optimiza y guarda). Se ve en portada y servicios.
function uploadGroupImage(g, onDone) {
  openModal({
    title: `Imagen de "${g.title}"`,
    body: `<div class="form-grid">
        <label>Imagen (JPG, PNG o WebP · máx ${MAX_MB} MB)
          <input id="f-file" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        <p class="sub" style="margin:0">Se verá en la portada y en la página de servicios.</p>
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
      if (!f) { toast("Elige una imagen"); return false; }
      if (!TYPES.includes(f.type)) { toast("Formato no válido (JPG, PNG o WebP)"); return false; }
      if (f.size > MAX_MB * 1024 * 1024) { toast(`Demasiado grande (máx ${MAX_MB} MB)`); return false; }
      const btn = $("[data-save]", m); if (btn) { btn.disabled = true; btn.textContent = "Subiendo…"; }
      try {
        const data = await fileToBase64(f);
        await apiWebGroupImageSet(g.id, f.type, data);
        toast("Imagen guardada"); onDone();
      } catch (e) { toast("Error: " + e.message); if (btn) { btn.disabled = false; btn.textContent = "Subir"; } return false; }
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
