import { $, $$ } from "./util.js?v=7";
import { getSettings, setSetting } from "./store.js?v=7";
import { renderAgenda } from "./views/agenda.js?v=7";
import { renderClientes } from "./views/clientes.js?v=7";
import { renderProductos } from "./views/productos.js?v=7";
import { renderStats } from "./views/stats.js?v=7";
import { renderFacturacion } from "./views/facturacion.js?v=7";

const AUTH = { user: "rossi", pass: "rossi2026" };
const SES = "pr_session";

const ROUTES = {
  "#/agenda": renderAgenda,
  "#/clientes": renderClientes,
  "#/productos": renderProductos,
  "#/stats": renderStats,
  "#/facturacion": renderFacturacion,
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

$("#login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if ($("#login-user").value.trim() === AUTH.user && $("#login-pass").value === AUTH.pass) {
    sessionStorage.setItem(SES, "1");
    $("#login-error").hidden = true;
    showApp();
  } else {
    $("#login-error").hidden = false;
  }
});
$("#logout").addEventListener("click", () => { sessionStorage.removeItem(SES); $("#login-form").reset(); showLogin(); });

$("#theme-toggle").addEventListener("click", () => {
  const next = (getSettings().theme === "dark") ? "light" : "dark";
  setSetting("theme", next); applyTheme(next);
});

window.addEventListener("hashchange", () => { if (sessionStorage.getItem(SES) === "1") route(); });

if (sessionStorage.getItem(SES) === "1") showApp(); else showLogin();
