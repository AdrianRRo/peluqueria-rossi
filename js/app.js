// ====== arranque: login, tema y router ======
// API-first: el servidor es la única fuente de datos. localStorage solo guarda
// el token (api.js) y el tema (store.js). Sin token → login; con token →
// loadRemote() (GET /api/state) y a la app. Si el backend no responde, se
// muestra el banner de sin conexión (no hay modo offline silencioso).
import { $, $$ } from "./util.js?v=23";
import { loadRemote, resetState, getTheme, setTheme } from "./store.js?v=23";
import { apiLogin, getToken, clearToken, showOfflineBanner } from "./api.js?v=23";
import { renderAgenda } from "./views/agenda.js?v=23";
import { renderClientes } from "./views/clientes.js?v=23";
import { renderProductos } from "./views/productos.js?v=23";
import { renderStock } from "./views/stock.js?v=23";
import { renderStats } from "./views/stats.js?v=23";
import { renderFacturacion } from "./views/facturacion.js?v=23";
import { renderVentas } from "./views/ventas.js?v=23";
import { renderConfig } from "./views/config.js?v=23";
import { renderWeb } from "./views/web.js?v=23";

const ROUTES = {
  "#/agenda": renderAgenda,
  "#/clientes": renderClientes,
  "#/productos": renderProductos,
  "#/stock": renderStock,
  "#/ventas": renderVentas,
  "#/stats": renderStats,
  "#/facturacion": renderFacturacion,
  "#/web": renderWeb,
  "#/config": renderConfig,
};

// ---- tema ----
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const btn = $("#theme-toggle");
  if (btn) btn.textContent = t === "dark" ? "☀️" : "🌙";
  document.querySelector('meta[name="theme-color"]').setAttribute("content", t === "dark" ? "#15101a" : "#ffffff");
}
applyTheme(getTheme());

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

// Carga el estado del servidor (única fuente). Migración única del tema: si
// aún no hay preferencia local, adopta la que hubiera en el servidor.
async function loadAndTheme() {
  const st = await loadRemote();
  if (!localStorage.getItem("pr_theme") && st?.settings?.theme) setTheme(st.settings.theme);
  applyTheme(getTheme());
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = $("#login-error");
  errEl.hidden = true;
  const btn = $("#login-form button[type=submit]");
  if (btn) { btn.disabled = true; btn.dataset.txt = btn.textContent; btn.textContent = "Entrando…"; }
  try {
    await apiLogin($("#login-user").value.trim(), $("#login-pass").value);
    await loadAndTheme();
    showApp();
  } catch (err) {
    errEl.textContent = err.message === "sin conexión"
      ? "Sin conexión con el servidor. Comprueba la red y reintenta."
      : "Usuario o contraseña incorrectos.";
    errEl.hidden = false;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.txt || "Entrar"; }
  }
});

$("#logout").addEventListener("click", () => {
  clearToken();
  resetState();
  $("#login-form").reset();
  showLogin();
});

$("#theme-toggle").addEventListener("click", () => {
  const next = getTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  applyTheme(next);
});

window.addEventListener("hashchange", () => { if (getToken()) route(); });

// Arranque: con token se sincroniza del servidor; si el token caducó, al login.
// Si el backend está caído, se entra igualmente con el banner de sin conexión
// visible (reintentar = recargar y volver a sincronizar).
if (getToken()) {
  loadAndTheme()
    .then(() => showApp())
    .catch((e) => {
      if (String(e.message) === "401") showLogin();
      else { showOfflineBanner(); showApp(); }
    });
} else {
  showLogin();
}