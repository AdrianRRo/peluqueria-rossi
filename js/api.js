// ====== cliente del backend (sync de estado + login) ======
// La URL es pública (no es secreto). El secreto es la contraseña, que se valida
// en el servidor y devuelve un token temporal (JWT). No hay claves en este código.
const API_BASE = "https://api.rossisalondebelleza.com"; // Cloudflare tunnel (cross-origin): repo servido como static site en Render
const TKEY = "pr_token";

export const getToken = () => localStorage.getItem(TKEY) || "";
export const setToken = (t) => localStorage.setItem(TKEY, t);
export const clearToken = () => localStorage.removeItem(TKEY);

export async function apiLogin(user, pass) {
  let r;
  try {
    r = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, pass }),
    });
  } catch (e) {
    showOfflineBanner();
    throw new Error("sin conexión");
  }
  hideOfflineBanner();
  if (!r.ok) throw new Error("login");
  const { token } = await r.json();
  setToken(token);
  return token;
}

export async function apiGetState() {
  const r = await fetch(`${API_BASE}/api/state`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (r.status === 401) { clearToken(); throw new Error("401"); }
  if (!r.ok) throw new Error("state");
  return r.json();
}

export async function apiNotify(to, message) {
  const r = await fetch(`${API_BASE}/api/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ to, message }),
  });
  if (r.status === 401) clearToken();
  if (!r.ok) throw new Error("notify");
  return r.json().catch(() => ({ ok: true, sent: true }));
}

export async function apiPutState(state) {
  const r = await fetch(`${API_BASE}/api/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(state),
  });
  if (r.status === 401) clearToken();
  return r.ok;
}

// ====== Errores visibles: banner global de sin conexión ======
// API-first: si el backend está caído o responde 5xx, se muestra un banner
// fijo arriba con botón de reintentar (recarga y vuelve a sincronizar).
// Los errores de validación (400/404/422) NO muestran banner: los maneja
// la vista con un toast y el detalle del backend.
const BANNER_ID = "offline-banner";

export function showOfflineBanner() {
  const b = document.getElementById(BANNER_ID);
  if (!b) return;
  b.hidden = false;
  const btn = b.querySelector("button");
  if (btn && !btn.dataset.wired) {
    btn.dataset.wired = "1";
    btn.onclick = () => location.reload(); // reintenta: re-login si hace falta y GET /api/state
  }
}

export function hideOfflineBanner() {
  const b = document.getElementById(BANNER_ID);
  if (b) b.hidden = true;
}

// ====== Cliente HTTP por recurso ======
// req() centraliza auth + manejo de errores:
//   - fetch lanza (red caída) o 5xx  -> banner "Sin conexión" + Error("sin conexión")
//   - 401                            -> limpia el token y lanza Error("401")
//   - resto de !ok                   -> Error con el `detail` del backend
//   - ok                             -> esconde el banner y devuelve el JSON
async function req(method, path, body) {
  const headers = { Authorization: `Bearer ${getToken()}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let r;
  try {
    r = await fetch(`${API_BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    showOfflineBanner();
    throw new Error("sin conexión");
  }
  if (r.status === 401) { clearToken(); throw new Error("401"); }
  if (!r.ok) {
    if (r.status >= 500) { showOfflineBanner(); throw new Error("sin conexión"); }
    let msg = `error ${r.status}`;
    try { msg = (await r.json()).detail || msg; } catch {}
    throw new Error(msg);
  }
  hideOfflineBanner();
  return r.status === 204 ? null : r.json().catch(() => ({}));
}

export const apiGet = (path) => req("GET", path);
export const apiPost = (path, body) => req("POST", path, body);
export const apiPatch = (path, body) => req("PATCH", path, body);
export const apiDelete = (path) => req("DELETE", path);

// ---- citas ----
export const apiAppointments = () => apiGet(`/api/appointments`);
export const apiApptAdd = (a) => apiPost(`/api/appointments`, a);
export const apiApptPatch = (id, patch) => apiPatch(`/api/appointments/${id}`, patch);
export const apiApptDelete = (id) => apiDelete(`/api/appointments/${id}`);

// ---- clientas ----
export const apiClients = () => apiGet(`/api/clients`);
export const apiClientAdd = (c) => apiPost(`/api/clients`, c);
export const apiClientPatch = (id, patch) => apiPatch(`/api/clients/${id}`, patch);
export const apiClientDelete = (id) => apiDelete(`/api/clients/${id}`);

// ---- productos / stock ----
export const apiProducts = () => apiGet(`/api/products`);
export const apiProductAdd = (p) => apiPost(`/api/products`, p);
export const apiProductPatch = (id, patch) => apiPatch(`/api/products/${id}`, patch);
export const apiProductDelete = (id) => apiDelete(`/api/products/${id}`);
export const apiStockMove = (productId, delta) => apiPost(`/api/stock/movements`, { productId, delta });

// ---- ventas directas ----
export const apiSales = () => apiGet(`/api/sales`);
export const apiSaleAdd = (s) => apiPost(`/api/sales`, s);
export const apiSaleDelete = (id) => apiDelete(`/api/sales/${id}`);

// ---- ajustes del negocio ----
export const apiSettingsPut = (patch) => req("PUT", `/api/settings`, patch);
export const apiVacationAdd = (v) => apiPost(`/api/vacations`, v);
export const apiVacationDelete = (id) => apiDelete(`/api/vacations/${id}`);

// ====== Página web: galería + grupos/servicios ======
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const jsonH = () => ({ "Content-Type": "application/json", ...authH() });

async function apiJson(path, opts = {}) {
  const r = await fetch(`${API_BASE}${path}`, opts);
  if (r.status === 401) { clearToken(); throw new Error("401"); }
  if (!r.ok) {
    let msg = `error ${r.status}`;
    try { msg = (await r.json()).detail || msg; } catch {}
    throw new Error(msg);
  }
  return r.status === 204 ? null : r.json().catch(() => ({}));
}

export const imgUrl = (id) => `${API_BASE}/api/gallery/${id}`;
export const apiGalleryList = () => apiJson(`/api/gallery`);
export const apiGalleryAdd = (content_type, data, alt = "") =>
  apiJson(`/api/gallery`, { method: "POST", headers: jsonH(), body: JSON.stringify({ content_type, data, alt }) });
export const apiGalleryPatch = (id, patch) =>
  apiJson(`/api/gallery/${id}`, { method: "PATCH", headers: jsonH(), body: JSON.stringify(patch) });
export const apiGalleryDelete = (id) =>
  apiJson(`/api/gallery/${id}`, { method: "DELETE", headers: authH() });

export const apiWebGroups = () => apiJson(`/api/web/groups`, { headers: authH() });
export const apiWebGroupAdd = (g) =>
  apiJson(`/api/web/groups`, { method: "POST", headers: jsonH(), body: JSON.stringify(g) });
export const apiWebGroupPatch = (id, patch) =>
  apiJson(`/api/web/groups/${id}`, { method: "PATCH", headers: jsonH(), body: JSON.stringify(patch) });
export const apiWebGroupDelete = (id) =>
  apiJson(`/api/web/groups/${id}`, { method: "DELETE", headers: authH() });
export const apiWebServiceAdd = (gid, s) =>
  apiJson(`/api/web/groups/${gid}/services`, { method: "POST", headers: jsonH(), body: JSON.stringify(s) });
export const apiWebServicePatch = (id, patch) =>
  apiJson(`/api/web/services/${id}`, { method: "PATCH", headers: jsonH(), body: JSON.stringify(patch) });
export const apiWebServiceDelete = (id) =>
  apiJson(`/api/web/services/${id}`, { method: "DELETE", headers: authH() });

// Estadísticas de la web pública (visitas y clics WhatsApp registrados por el
// beacon /api/track). En un backend anterior al panel puede no existir aún (404).
export const apiWebStats = () => apiJson(`/api/web/stats`, { headers: authH() });
