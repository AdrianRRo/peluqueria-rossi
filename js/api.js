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
  return true;
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
