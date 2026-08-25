// ====== cliente del backend (sync de estado + login) ======
// La URL es pública (no es secreto). El secreto es la contraseña, que se valida
// en el servidor y devuelve un token temporal (JWT). No hay claves en este código.
const API_BASE = "https://botarmy.tail0680ed.ts.net:10000";
const TKEY = "pr_token";

export const getToken = () => localStorage.getItem(TKEY) || "";
export const setToken = (t) => localStorage.setItem(TKEY, t);
export const clearToken = () => localStorage.removeItem(TKEY);

export async function apiLogin(user, pass) {
  const r = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, pass }),
  });
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
