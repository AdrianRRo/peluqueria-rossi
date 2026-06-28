import { $, $$ } from "./util.js?v=19";
import { getSettings, setSetting, hydrate } from "./store.js?v=19";
import { apiLogin, apiGetState, getToken, clearToken } from "./api.js?v=19";
import { renderAgenda } from "./views/agenda.js?v=19";
import { renderClientes } from "./views/clientes.js?v=19";
import { renderProductos } from "./views/productos.js?v=19";
import { renderStock } from "./views/stock.js?v=19";
import { renderStats } from "./views/stats.js?v=19";
import { renderFacturacion } from "./views/facturacion.js?v=19";
import { renderVentas } from "./views/ventas.js?v=19";
import { renderConfig } from "./views/config.js?v=19";

const ROUTES = {
  "#/agenda": renderAgenda,
  "#/clientes": renderClientes,
  "#/productos": renderProductos,
  "#/stock": renderStock,
  "#/ventas": renderVentas,
  "#/stats": renderStats,
  "#/facturacion": renderFacturacion,
  "#/config": renderConfig,
};

// ---- tema ----
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const btn = $("#theme-toggle");
  if (btn) btn.textContent = t === "dark" ? "☀️" : "🌙";
  document.querySelector('meta[name="theme-color"]').setAttribute("content", t === "dark" ? "#15101a" : "#ffffff");
}
applyTheme(getSettings().theme || "light");

// ---- router ----
function route() {
  const hash = location.hash && ROUTES[location.hash] ? location.hash : "#/agenda";
  if (location.hash !== hash) { location.hash = hash; return; }
  $$("#nav .tab").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === hash));
  const root = $("#view-root");
  root.innerHTML = "";
  ROUTES[hash](root);
}

// ---- auth ----
function showApp() {
  $("#login-view").hidden = true;
  $("#app-view").hidden = false;
  if (!location.hash) location.hash = "#/agenda"; else route();
}
function showLogin() {
  $("#app-view").hidden = true;
  $("#login-view").hidden = false;
}

// Carga el estado desde el servidor y lo aplica. Devuelve "ok" | "auth" | "net".
async function loadRemote() {
  try {
    hydrate(await apiGetState());
    applyTheme(getSettings().theme || "light");
    return "ok";
  } catch (e) {
    return String(e.message) === "401" ? "auth" : "net";
  }
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#login-error").hidden = true;
  const btn = $("#login-form button[type=submit]");
  if (btn) { btn.disabled = true; btn.dataset.txt = btn.textContent; btn.textContent = "Entrando…"; }
  try {
    await apiLogin($("#login-user").value.trim(), $("#login-pass").value);
    await loadRemote();
    showApp();
  } catch (err) {
    $("#login-error").hidden = false;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.txt || "Entrar"; }
  }
});
$("#logout").addEventListener("click", () => { clearToken(); $("#login-form").reset(); showLogin(); });

$("#theme-toggle").addEventListener("click", () => {
  const next = (getSettings().theme === "dark") ? "light" : "dark";
  setSetting("theme", next); applyTheme(next);
});

window.addEventListener("hashchange", () => { if (getToken()) route(); });

// Arranque: si hay sesión, intenta cargar del servidor; si el token caducó,
// vuelve al login; si solo falla la red, sigue con la caché local (offline).
if (getToken()) {
  loadRemote().then((st) => { if (st === "auth") showLogin(); else showApp(); });
} else {
  showLogin();
}
